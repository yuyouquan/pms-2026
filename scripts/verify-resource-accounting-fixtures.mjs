import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
const load = createTypeScriptModuleLoader(), get = file => load(path.resolve(file))
const { RESOURCE_FORMAL_IDS } = get('src/mock/projectRegistry.ts')
const { resourceAccountingDataset } = get('src/mock/resourceAccounting.ts')
const { buildAccountingAnalysis } = get('src/components/project-resources/resourceAccounting.ts')
const { dashboardMonthDates, isDashboardWorkday } = get('src/components/project-resources/resourceDashboardPeriods.ts')
const totals = [], ids = new Set(), personDates = new Set()
for (const [category, id] of Object.entries(RESOURCE_FORMAL_IDS)) {
  const dataset = resourceAccountingDataset(id), snapshot = JSON.stringify(dataset)
  assert.equal(dataset.projectId, id)
  const actual = buildAccountingAnalysis(dataset, 5, { startDate: '2026-01-01', endDate: '2026-10-09' })
  assert.equal(actual.issues.length, 0)
  totals.push({ category, labor: actual.labor, cost: actual.cost })
  const firstNine = actual.monthly.slice(0, 9).map(row => row.labor)
  assert.ok(Math.max(...firstNine) / Math.min(...firstNine) > 1.4, `${category} shows meaningful monthly phases`)
  for (const row of dataset.worklogs) {
    assert.ok(row.personDays > 0 && row.personDays <= 1, 'one person contributes at most one day per date')
    assert.ok(isDashboardWorkday(row.date))
    assert.equal(row.monthWorkingDays, dashboardMonthDates(row.date.slice(0, 7)).filter(isDashboardWorkday).length)
    assert.ok(!ids.has(row.id)); ids.add(row.id)
    const personDate = `${row.person}:${row.date}`
    assert.ok(!personDates.has(personDate), 'distinct mock teams never duplicate a full working day across projects'); personDates.add(personDate)
  }
  for (const row of dataset.expenses) { assert.ok(Number.isFinite(row.amountYuan) && row.amountYuan > 0); assert.ok(!ids.has(row.id)); ids.add(row.id) }
  assert.equal(JSON.stringify(resourceAccountingDataset(id)), snapshot, 'refreshes and calculations do not randomize the fixture')
}
assert.equal(new Set(totals.map(row => row.labor.toFixed(1))).size, 4, 'four distinct project accounting totals')
assert.equal(new Set(totals.map(row => row.cost.toFixed(1))).size, 4)
assert.ok(Math.max(...totals.map(row => row.labor)) / Math.min(...totals.map(row => row.labor)) > 1.75, 'ranking has visible differences')
assert.equal(resourceAccountingDataset('user-created-project'), undefined, 'no invented actuals for unconfigured projects')
console.log('PASS deterministic, distinct, valid shared accounting fixtures', totals)
