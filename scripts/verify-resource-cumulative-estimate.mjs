import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'
globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = { localStorage }
const load = createTypeScriptModuleLoader()
const { buildCumulativeEstimate, buildResourceDepartmentDetails, selectCumulativeEstimateSource, executionPercent } = load(path.resolve('src/components/project-resources/cumulativeEstimateData.ts'))
const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-8, `${label}: ${actual} != ${expected}`)
const source = (type, id = type) => ({ owner: { id: 'p' }, version: { id, budgetType: type, versionNumber: '正式1', isActive: true, estimatedInvestment: 100, projectStartTime: '2026-09-01', projectEndTime: '2026-09-21', departmentInvestments: [
  { id: 'a', primaryDepartment: '研发', secondaryDepartment: '软件', estimatedInvestment: 60 },
  { id: 'b', primaryDepartment: '硬件', secondaryDepartment: '软件', estimatedInvestment: 40 },
] } })
const annual = source('annual'), estimate = source('projectEstimate'), budget = source('projectBudget')
const sources = [annual, estimate, budget]
const monthly = sources.flatMap(s => s.version.departmentInvestments.map(row => ({ ...row, versionId: s.version.id, estimatedTotal: row.estimatedInvestment, monthlyData: { '2026-09': row.estimatedInvestment } })))
const cumulative = (ss = sources, date = '2026-09-11', filter = {}, start = '2026-09-01', mm = monthly, category = 'capability') => buildCumulativeEstimate(category, ss, 5, filter, date, mm, start)
assert.equal(selectCumulativeEstimateSource(sources), budget)
assert.equal(selectCumulativeEstimateSource([annual, estimate]), estimate)
assert.equal(selectCumulativeEstimateSource([annual]), annual)
assert.equal(selectCumulativeEstimateSource([{ ...budget, version: { ...budget.version, isActive: false } }]), undefined)
assert.equal(cumulative([]), undefined)
for (const [today, expected] of [['2026-08-31', 0], ['2026-09-01', 100 / 30], ['2026-09-11', 100 * 11 / 30], ['2026-09-30', 100], ['2026-10-01', 100]]) {
  for (const category of ['machine', 'tos', 'technical', 'capability']) {
    const result = cumulative(sources, today, {}, '2026-09-01', monthly, category)
    close(result.labor, expected, `${category} inclusive calendar boundary ${today}`)
    close(result.cost, expected * 5, 'labor-only cost')
  }
}
close(cumulative(sources, '2026-09-11', {}, '2026-09-05').labor, 100 * 7 / 30, 'partial initial month includes start and today')
close(cumulative(sources, '2026-09-11', { primary: '研发', startDate: '2030-01-01', year: '2030' }).labor, 22, 'only department filter applies')
const broken = structuredClone(budget)
broken.version.projectEndTime = null
close(cumulative([annual, estimate, broken]).labor, 100 * 11 / 30, 'monthly source does not depend on milestones')
const missing = cumulative([annual, estimate, broken], '2026-09-11', {}, '')
assert.equal(missing.source, broken, 'invalid selected source never silently falls back')
assert.equal(missing.labor, undefined)
assert.ok(missing.issues.length)
assert.equal(cumulative(sources, '2026-09-11', {}, '2026-02-30').labor, undefined)
assert.equal(cumulative(sources, '2026-09-11', {}, '2026-09-01', []).labor, undefined, 'missing positive monthly plan is unknown')
const zero = structuredClone(budget)
zero.version.estimatedInvestment = 0
zero.version.departmentInvestments.forEach(row => { row.estimatedInvestment = 0 })
assert.equal(cumulative([zero], '2026-09-11', {}, '2026-09-01', []).labor, 0)
for (const bad of [-1, NaN]) assert.equal(cumulative(sources, '2026-09-11', {}, '2026-09-01', monthly.map(row => ({ ...row, monthlyData: { '2026-09': bad } }))).labor, undefined)
const irrelevant = [...monthly, ...monthly.map(row => ({ ...row, isArchived: true, monthlyData: { '2026-09': 999 } })), { ...monthly[0], versionId: 'foreign', monthlyData: { '2026-09': 999 } }]
close(cumulative(sources, '2026-09-11', {}, '2026-09-01', irrelevant).labor, 100 * 11 / 30, 'archived and foreign rows excluded')
const leapSource = structuredClone(budget)
leapSource.version.departmentInvestments = [budget.version.departmentInvestments[1]]
const leap = [{ ...monthly.at(-1), monthlyData: { '2023-12': 31, '2024-01': 31, '2024-02': 29 } }]
close(cumulative([leapSource], '2024-02-29', {}, '2023-12-31', leap).labor, 61, 'cross-year and leap-day calendar')
close(cumulative([leapSource], '2024-02-01', {}, '2023-12-31', leap).labor, 33, 'first day of leap month')
assert.equal(executionPercent(1, 0), undefined)
assert.equal(executionPercent(undefined, 5), undefined)
assert.equal(executionPercent(0, 5), 0)
const dataset = { projectId: 'p', startDate: '2026-09-01', endDate: '2026-09-30', worklogs: [
  { id: '1', date: '2026-09-05', person: 'A', primaryDepartment: '研发', secondaryDepartment: '软件', personDays: 10, monthWorkingDays: 20 },
  { id: '2', date: '2026-09-11', person: 'B', primaryDepartment: '硬件', secondaryDepartment: '软件', personDays: 20, monthWorkingDays: 25 },
  { id: '3', date: '2026-09-25', person: 'C', primaryDepartment: '研发', secondaryDepartment: '软件', personDays: 100, monthWorkingDays: 20 },
], expenses: [{ id: 'e', date: '2026-09-11', primaryDepartment: '研发', secondaryDepartment: '软件', amountYuan: 10000 }] }
const snapshot = JSON.stringify({ sources, monthly, dataset })
const details = buildResourceDepartmentDetails('capability', sources, monthly, 5, dataset, {}, '2026-09-11', '2026-09-01')
assert.equal(details.rows.length, 2, 'same secondary department under different parents stays separate')
close(details.total.actual.labor, 6.3, 'numerator matches displayed accounting, including later records')
close(details.total.toDateExecution, 6.3 / (100 * 11 / 30) * 100, 'labor execution uses displayed actual person-months')
close(details.total.lifecycleExecution, 6.3 / 100 * 100, 'lifecycle primary percentage uses person-months')
close(details.total.lifecycleCostExecution, (6.3 * 5 + 1) / 500 * 100, 'lifecycle cost percentage includes actual nonlabor')
close(details.total.toDateCostExecution, (6.3 * 5 + 1) / (500 * 11 / 30) * 100, 'cumulative cost has its own percentage')
for (const key of ['annual', 'estimate', 'budget', 'cumulative', 'actual']) for (const unit of ['labor', 'cost']) close(details.rows.reduce((sum, row) => sum + row[key][unit], 0), details.total[key][unit], `${key} ${unit} reconciles`)
const totalsFromParts = details.rows.reduce((sum, row) => sum + row.actual.labor, 0) / details.rows.reduce((sum, row) => sum + row.cumulative.labor, 0) * 100
close(details.total.toDateExecution, totalsFromParts, 'total rate is ratio of sums')
const edited = monthly.map(row => ({ ...row, monthlyData: { '2026-09': 999 } }))
close(buildResourceDepartmentDetails('capability', sources, edited, 5, dataset, {}, '2026-09-11', '2026-09-01').cumulative.labor, 1998 * 11 / 30, 'manual monthly edits change the cumulative estimate')
const filtered = buildResourceDepartmentDetails('capability', sources, monthly, 5, dataset, { primary: '研发', startDate: '2026-09-25', endDate: '2026-09-30' }, '2026-09-11', '2026-09-01')
close(filtered.cumulative.labor, 22, 'top date has no effect on planned-to-date')
close(filtered.total.toDateExecution, 5 / 22 * 100, 'date filter changes both actual card and cumulative numerator')
close(filtered.total.actual.labor, 5, 'existing actual column still respects date')
assert.equal(buildResourceDepartmentDetails('capability', sources, monthly, 5, undefined, {}, '2026-09-11', '2026-09-01').total.toDateExecution, undefined)
const incomplete = structuredClone(budget)
incomplete.version.departmentInvestments[0].secondaryDepartment = ''
incomplete.version.departmentInvestments[1].primaryDepartment = '研发'
const incompleteMonthly = monthly.filter(row => row.versionId === budget.version.id).map(row => ({ ...row, primaryDepartment: '研发', secondaryDepartment: row.id === 'a' ? '' : row.secondaryDepartment }))
const incompleteDetails = buildResourceDepartmentDetails('capability', [undefined, undefined, incomplete], incompleteMonthly, 5, undefined, {}, '2026-09-11', '2026-09-01')
close(incompleteDetails.rows.reduce((sum, row) => sum + row.budget.labor, 0), 100, 'unfilled secondary department never includes other department totals')
assert.equal(JSON.stringify({ sources, monthly, dataset }), snapshot, 'analytics never mutate stores')
console.log('PASS cumulative estimates: official fallback, four project types, calendar/date boundaries, missing/zero data, monthly updates, department detail reconciliation, source calendars and rate formulas')

const withExpenses = structuredClone(budget)
withExpenses.version.nonLaborInvestment = { startMonth: '2026-08', endMonth: '2026-10', items: [
  { id: 'expense', secondaryDepartment: '软件', monthlyAmounts: { '2026-08': 10000, '2026-09': 22000, '2026-10': 30000, '2026-11': 999999 } },
  { id: 'expense-only', secondaryDepartment: '采购', monthlyAmounts: { '2026-09': 22000 } },
] }
const expenseSources = [annual, estimate, withExpenses]
const expenseFilter = { departmentParents: { 软件: '研发', 采购: '供应链' } }
const expenseDetails = buildResourceDepartmentDetails('capability', expenseSources, monthly, 5, dataset, expenseFilter, '2026-09-11', '2026-08-01')
// Calendar days include weekends and today. Nonlabor is converted from yuan to ten-thousand yuan.
close(expenseDetails.cumulative.cost, 500 * 11 / 30 + 1 + 4.4 * 11 / 30, 'cumulative cost adds past and prorated current nonlabor, excludes future and hidden months')
const expenseOnly = expenseDetails.rows.find(row => row.secondary === '采购')
close(expenseOnly.cumulative.labor, 0, 'expense-only department does not gain labor')
close(expenseOnly.cumulative.cost, 2.2 * 11 / 30, 'expense-only department retains planned costs')
close(expenseDetails.total.toDateCostExecution, 32.5 / (500 * 11 / 30 + 1 + 4.4 * 11 / 30) * 100, 'nonlabor changes cost execution independently')
assert.notEqual(expenseDetails.total.toDateCostExecution, expenseDetails.total.toDateExecution)
for (const key of ['annual', 'estimate', 'budget', 'cumulative', 'actual']) for (const unit of ['labor', 'cost']) close(expenseDetails.rows.reduce((sum, row) => sum + row[key][unit], 0), expenseDetails.total[key][unit], `expense-bearing ${key} ${unit} reconciles`)
close(cumulative(expenseSources, '2026-09-11', { ...expenseFilter, startDate: '2030-01-01', endDate: '2030-01-31', year: '2030' }, '2026-08-01').cost, 500 * 11 / 30 + 1 + 4.4 * 11 / 30, 'cumulative expense ignores top date/year filters')
const ambiguous = cumulative(expenseSources, '2026-09-11', {}, '2026-08-01')
close(ambiguous.rows.find(row => row.primary === '未归属一级部门' && row.secondary === '软件').cost, 1 + 2.2 * 11 / 30, 'ambiguous expenses counted once in unassigned parent')
const expenseActual = { ...dataset, worklogs: [], expenses: [{ id: 'only', date: '2026-09-11', primaryDepartment: '供应链', secondaryDepartment: '采购', amountYuan: 18000 }] }
const onlyDetails = buildResourceDepartmentDetails('capability', expenseSources, monthly, 5, expenseActual, { ...expenseFilter, primary: '供应链' }, '2026-09-11', '2026-09-01')
assert.equal(onlyDetails.total.toDateExecution, undefined, 'zero labor denominator stays undefined')
close(onlyDetails.total.toDateCostExecution, 1.8 / (2.2 * 11 / 30) * 100, 'positive expense denominator remains independently usable')
assert.equal(buildResourceDepartmentDetails('capability', sources, monthly, 5, dataset, { startDate: '2030-01-01', endDate: '2030-01-31' }, '2026-09-11', '2026-09-01').total.toDateExecution, undefined, 'missing displayed actual cannot become zero numerator')
console.log('PASS overview revision: displayed actual numerator, independent labor/cost rates, partial-month nonlabor, expense-only departments and sum reconciliation')
const partial = monthly.filter(row => row.versionId !== budget.version.id || row.primaryDepartment === '研发')
const partialDetails = buildResourceDepartmentDetails('capability', sources, partial, 5, dataset, {}, '2026-09-11', '2026-09-01')
assert.equal(partialDetails.cumulative.labor, undefined, 'partially missing source department is unknown, not zero')
assert.ok(partialDetails.cumulative.issues.some(issue => issue.includes('硬件 / 软件')))
assert.equal(partialDetails.rows.find(row => row.primary === '硬件').cumulative.labor, undefined)
close(buildResourceDepartmentDetails('capability', sources, partial, 5, dataset, {primary:'研发'}, '2026-09-11', '2026-09-01').cumulative.labor, 22, 'complete filtered department remains usable')
console.log('PASS incomplete locked monthly snapshots are not silently treated as zero')
