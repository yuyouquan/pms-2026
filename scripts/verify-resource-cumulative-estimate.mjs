import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'
globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = { localStorage }
const load = createTypeScriptModuleLoader()
const { buildCumulativeEstimate, buildResourceDepartmentDetails, milestoneProgress, selectCumulativeEstimateSource, executionPercent } = load(path.resolve('src/components/project-resources/cumulativeEstimateData.ts'))
const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-8, `${label}: ${actual} != ${expected}`)
const source = (type, id = type) => ({ owner: { id: 'p' }, version: { id, budgetType: type, versionNumber: '正式1', isActive: true, estimatedInvestment: 100, projectStartTime: '2026-09-01', projectEndTime: '2026-09-21', departmentInvestments: [
  { id: 'a', primaryDepartment: '研发', secondaryDepartment: '软件', estimatedInvestment: 60 },
  { id: 'b', primaryDepartment: '硬件', secondaryDepartment: '软件', estimatedInvestment: 40 },
] } })
const annual = source('annual'), estimate = source('projectEstimate'), budget = source('projectBudget')
const sources = [annual, estimate, budget]
assert.equal(selectCumulativeEstimateSource(sources), budget)
assert.equal(selectCumulativeEstimateSource([annual, estimate]), annual)
assert.equal(selectCumulativeEstimateSource([undefined, estimate]), estimate)
assert.equal(selectCumulativeEstimateSource([{ ...budget, version: { ...budget.version, isActive: false } }]), undefined)
assert.equal(buildCumulativeEstimate('capability', [], 5, {}, '2026-09-11'), undefined)
for (const [today, expected] of [['2026-08-31', 0], ['2026-09-01', 0], ['2026-09-11', 50], ['2026-09-21', 100], ['2026-10-01', 100]]) {
  const result = buildCumulativeEstimate('capability', sources, 5, {}, today)
  close(result.labor, expected, `date boundary ${today}`)
  close(result.cost, expected * 5, 'labor-only cost')
}
close(milestoneProgress('2026-09-01', '2026-09-01', '2026-09-01'), 1, 'instant milestone')
assert.equal(milestoneProgress('2026-09-21', '2026-09-01', '2026-09-11'), undefined)
assert.equal(milestoneProgress('2026-02-30', '2026-09-01', '2026-09-11'), undefined)
close(buildCumulativeEstimate('capability', sources, 5, { primary: '研发', startDate: '2030-01-01', year: '2030' }, '2026-09-11').labor, 30, 'only department filter applies')
const broken = structuredClone(budget)
broken.version.projectEndTime = null
const missing = buildCumulativeEstimate('capability', [annual, estimate, broken], 5, {}, '2026-09-11')
assert.equal(missing.source, broken, 'missing dates do not fall back to another official source')
assert.equal(missing.labor, undefined)
assert.equal(missing.issues.length, 2)
const empty = structuredClone(budget)
empty.version.departmentInvestments = []
assert.equal(buildCumulativeEstimate('capability', [empty], 5, {}, '2026-09-11').labor, undefined)
const zero = structuredClone(budget)
zero.version.estimatedInvestment = 0
zero.version.departmentInvestments.forEach(row => { row.estimatedInvestment = 0 })
zero.version.projectEndTime = null
assert.equal(buildCumulativeEstimate('capability', [zero], 5, {}, '2026-09-11').labor, 0, 'zero phases need no dates')
assert.equal(executionPercent(1, 0), undefined)
assert.equal(executionPercent(undefined, 5), undefined)
assert.equal(executionPercent(0, 5), 0)

for (const [category, phase1, phase2, dates] of [
  ['tos', 'planningPhase', 'conceptPhase', { planningKO: '2026-09-01', conceptStart: '2026-09-11', str1: '2026-09-21' }],
  ['technical', 'planningPhase', 'conceptPhase', { planningStart: '2026-09-01', charterDCP: '2026-09-11', tdr1: '2026-09-21' }],
]) {
  const version = { ...budget.version, milestones: dates, departmentInvestments: [budget.version.departmentInvestments[0]], departmentPhaseRatios: { a: { [phase1]: 25, [phase2]: 75 } } }
  const result = buildCumulativeEstimate(category, [{ ...budget, version }], 5, {}, '2026-09-16')
  close(result.labor, 60 * (.25 + .75 * .5), `${category} uses saved phase percentages`)
  version.departmentPhaseRatios.a[phase1] = 20
  assert.equal(buildCumulativeEstimate(category, [{ ...budget, version }], 5, {}, '2026-09-16').labor, undefined, 'unbalanced phase percentages are unknown')
}
const periods = load(path.resolve('src/lib/hrMachinePeriods.ts')).MACHINE_INVESTMENT_PERIODS
const machineRow = { ...budget.version.departmentInvestments[0], estimatedInvestment: 60, ...Object.fromEntries(periods.map(item => [item.key, 0])), str5ToSixMonths: 60 }
const machineSource = { ...budget, version: { ...budget.version, hrModelVersion: 'M', machineDepartmentInvestments: [machineRow], milestones: { str5: '2026-03-31' } } }
close(buildCumulativeEstimate('machine', [machineSource], 5, {}, '2026-09-30').labor, 60, 'machine derived six-calendar-month endpoint')
close(buildCumulativeEstimate('machine', [machineSource], 5, {}, '2026-03-31').labor, 0, 'machine tail starts at STR5')

const monthly = sources.flatMap(s => s.version.departmentInvestments.map(row => ({ ...row, versionId: s.version.id, estimatedTotal: row.estimatedInvestment, monthlyData: { '2026-09': row.estimatedInvestment } })))
const dataset = { projectId: 'p', startDate: '2026-09-01', endDate: '2026-09-30', worklogs: [
  { id: '1', date: '2026-09-05', person: 'A', primaryDepartment: '研发', secondaryDepartment: '软件', personDays: 10, monthWorkingDays: 20 },
  { id: '2', date: '2026-09-11', person: 'B', primaryDepartment: '硬件', secondaryDepartment: '软件', personDays: 20, monthWorkingDays: 25 },
  { id: '3', date: '2026-09-25', person: 'C', primaryDepartment: '研发', secondaryDepartment: '软件', personDays: 100, monthWorkingDays: 20 },
], expenses: [{ id: 'e', date: '2026-09-11', primaryDepartment: '研发', secondaryDepartment: '软件', amountYuan: 10000 }] }
const snapshot = JSON.stringify({ sources, monthly, dataset })
const details = buildResourceDepartmentDetails('capability', sources, monthly, 5, dataset, {}, '2026-09-11')
assert.equal(details.rows.length, 2, 'same secondary department under different parents stays separate')
close(details.total.actual.labor, 6.3, 'numerator matches displayed accounting, including later records')
close(details.total.toDateExecution, 6.3 / 50 * 100, 'labor execution uses displayed actual person-months')
close(details.total.lifecycleExecution, 6.3 / 100 * 100, 'lifecycle primary percentage uses person-months')
close(details.total.lifecycleCostExecution, (6.3 * 5 + 1) / 500 * 100, 'lifecycle cost percentage includes actual nonlabor')
close(details.total.toDateCostExecution, (6.3 * 5 + 1) / 250 * 100, 'cumulative cost has its own percentage')
for (const key of ['annual', 'estimate', 'budget', 'cumulative', 'actual']) for (const unit of ['labor', 'cost']) close(details.rows.reduce((sum, row) => sum + row[key][unit], 0), details.total[key][unit], `${key} ${unit} reconciles`)
const totalsFromParts = details.rows.reduce((sum, row) => sum + row.actual.labor, 0) / details.rows.reduce((sum, row) => sum + row.cumulative.labor, 0) * 100
close(details.total.toDateExecution, totalsFromParts, 'total rate is ratio of sums')
const edited = monthly.map(row => ({ ...row, monthlyData: { '2026-09': 999 } }))
close(buildResourceDepartmentDetails('capability', sources, edited, 5, dataset, {}, '2026-09-11').cumulative.labor, 50, 'manual monthly edits do not change estimate')
const filtered = buildResourceDepartmentDetails('capability', sources, monthly, 5, dataset, { primary: '研发', startDate: '2026-09-25', endDate: '2026-09-30' }, '2026-09-11')
close(filtered.cumulative.labor, 30, 'top date has no effect on planned-to-date')
close(filtered.total.toDateExecution, 5 / 30 * 100, 'date filter changes both actual card and cumulative numerator')
close(filtered.total.actual.labor, 5, 'existing actual column still respects date')
assert.equal(buildResourceDepartmentDetails('capability', sources, monthly, 5, undefined, {}, '2026-09-11').total.toDateExecution, undefined)
const incomplete = structuredClone(budget)
incomplete.version.departmentInvestments[0].secondaryDepartment = ''
incomplete.version.departmentInvestments[1].primaryDepartment = '研发'
const incompleteMonthly = monthly.filter(row => row.versionId === budget.version.id).map(row => ({ ...row, primaryDepartment: '研发', secondaryDepartment: row.id === 'a' ? '' : row.secondaryDepartment }))
const incompleteDetails = buildResourceDepartmentDetails('capability', [undefined, undefined, incomplete], incompleteMonthly, 5, undefined, {}, '2026-09-11')
close(incompleteDetails.rows.reduce((sum, row) => sum + row.budget.labor, 0), 100, 'unfilled secondary department never includes other department totals')
assert.equal(JSON.stringify({ sources, monthly, dataset }), snapshot, 'analytics never mutate stores')
console.log('PASS cumulative estimates: official fallback, four project types, phase/date boundaries, missing/zero data, monthly independence, department detail reconciliation, source calendars and rate formulas')

const withExpenses = structuredClone(budget)
withExpenses.version.nonLaborInvestment = { startMonth: '2026-08', endMonth: '2026-10', items: [
  { id: 'expense', secondaryDepartment: '软件', monthlyAmounts: { '2026-08': 10000, '2026-09': 22000, '2026-10': 30000, '2026-11': 999999 } },
  { id: 'expense-only', secondaryDepartment: '采购', monthlyAmounts: { '2026-09': 22000 } },
] }
const expenseSources = [annual, estimate, withExpenses]
const expenseFilter = { departmentParents: { 软件: '研发', 采购: '供应链' } }
const expenseDetails = buildResourceDepartmentDetails('capability', expenseSources, monthly, 5, dataset, expenseFilter, '2026-09-11')
// September 2026 has 22 weekdays; 9 have elapsed through Friday September 11.
close(expenseDetails.cumulative.cost, 250 + 1 + .9 + .9, 'cumulative cost adds past and prorated current nonlabor, excludes future and hidden months')
const expenseOnly = expenseDetails.rows.find(row => row.secondary === '采购')
close(expenseOnly.cumulative.labor, 0, 'expense-only department does not gain labor')
close(expenseOnly.cumulative.cost, .9, 'expense-only department retains planned costs')
close(expenseDetails.total.toDateCostExecution, 32.5 / 252.8 * 100, 'nonlabor changes cost execution independently')
assert.notEqual(expenseDetails.total.toDateCostExecution, expenseDetails.total.toDateExecution)
for (const key of ['annual', 'estimate', 'budget', 'cumulative', 'actual']) for (const unit of ['labor', 'cost']) close(expenseDetails.rows.reduce((sum, row) => sum + row[key][unit], 0), expenseDetails.total[key][unit], `expense-bearing ${key} ${unit} reconciles`)
close(buildCumulativeEstimate('capability', expenseSources, 5, { ...expenseFilter, startDate: '2030-01-01', endDate: '2030-01-31', year: '2030' }, '2026-09-11').cost, 252.8, 'cumulative expense ignores top date/year filters')
const ambiguous = buildCumulativeEstimate('capability', expenseSources, 5, {}, '2026-09-11')
close(ambiguous.rows.find(row => row.primary === '未归属一级部门' && row.secondary === '软件').cost, 1.9, 'ambiguous expenses counted once in unassigned parent')
const expenseActual = { ...dataset, worklogs: [], expenses: [{ id: 'only', date: '2026-09-11', primaryDepartment: '供应链', secondaryDepartment: '采购', amountYuan: 18000 }] }
const onlyDetails = buildResourceDepartmentDetails('capability', expenseSources, monthly, 5, expenseActual, { ...expenseFilter, primary: '供应链' }, '2026-09-11')
assert.equal(onlyDetails.total.toDateExecution, undefined, 'zero labor denominator stays undefined')
close(onlyDetails.total.toDateCostExecution, 200, 'positive expense denominator remains independently usable')
assert.equal(buildResourceDepartmentDetails('capability', sources, monthly, 5, dataset, { startDate: '2030-01-01', endDate: '2030-01-31' }, '2026-09-11').total.toDateExecution, undefined, 'missing displayed actual cannot become zero numerator')
console.log('PASS overview revision: displayed actual numerator, independent labor/cost rates, partial-month nonlabor, expense-only departments and sum reconciliation')
