import assert from 'node:assert/strict'
import path from 'node:path'
import { createRequire } from 'node:module'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'
globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = { localStorage }
let sheets
const load = createTypeScriptModuleLoader(new Map([[path.resolve('src/utils/exportExcel.ts'), { exports: { exportTimestamp: () => 'test', exportMultiSheet: value => { sheets = value } } }]]))
const get = file => load(path.resolve(`src/components/project-resources/${file}.ts`))
const { buildDashboardAnalysis, selectDashboardSource } = get('resourceDashboardData')
const { buildAccountingAnalysis, dashboardDepartmentParents, UNASSIGNED_PRIMARY } = get('resourceAccounting')
const { dashboardBusinessMetrics, dashboardBusinessTrend } = get('resourceDashboardBusiness')
const { dashboardWeekStart, dashboardMonthDates, isDashboardWorkday } = get('resourceDashboardPeriods')
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 0.00001, `${message}: ${actual} != ${expected}`)
const source = { owner: { id: 'owner', name: '预算来源' }, version: { id: 'v', budgetType: 'projectBudget', versionNumber: '正式A', isActive: true, lockState: 'locked', estimatedInvestment: 43,
  projectStartTime: '2026-12-01', projectEndTime: '2027-01-31', departmentInvestments: [{ id: 'dept', primaryDepartment: '研发', secondaryDepartment: '软件', estimatedInvestment: 43 }],
  nonLaborInvestment: { startMonth: '2026-12', endMonth: '2027-01', items: [
    { id: 'e', secondaryDepartment: '软件', secondarySubject: '设备', tertiarySubject: '电脑', monthlyAmounts: { '2026-12': 23000, '2027-01': 21000, '2028-01': 9999999 } },
    { id: 'u', secondaryDepartment: '未匹配部门', secondarySubject: '管理', tertiarySubject: '办公', monthlyAmounts: { '2027-01': 10000 } },
  ] } } }
const rows = [{ id: 'r', versionId: 'v', primaryDepartment: '研发', secondaryDepartment: '软件', estimatedTotal: 43, monthlyData: { '2026-12': 23, '2027-01': 20 } }]
const dataset = { projectId: 'test', source: 'mock', startDate: '2026-12-01', endDate: '2027-01-31', worklogs: [
  { id: 'a', date: '2026-12-31', person: '甲', primaryDepartment: '研发', secondaryDepartment: '软件', personDays: 2, monthWorkingDays: 20, description: '开发' },
  { id: 'b', date: '2027-01-04', person: '甲', primaryDepartment: '研发', secondaryDepartment: '软件', personDays: 3, monthWorkingDays: 25, description: '联调' },
  { id: 'c', date: '2027-01-05', person: '乙', primaryDepartment: '硬件', secondaryDepartment: '结构', personDays: 1, monthWorkingDays: 10, description: '验证' },
], expenses: [{ id: 'ae', date: '2027-01-04', primaryDepartment: '研发', secondaryDepartment: '软件', subject: '设备', amountYuan: 10000, description: '设备' }] }
const original = JSON.stringify({ source, rows, dataset })
const full = buildDashboardAnalysis('capability', source, rows, 5)
const accounting = buildAccountingAnalysis(dataset, 5)
close(full.cost, 220.4, 'planned cost includes yuan conversion, not inactive expense keys')
close(accounting.labor, 0.32, 'use each source month calendar, never fixed hours or weekday fallback')
close(accounting.cost, 2.6, 'actual labor + independent actual expenses')
assert.equal(buildAccountingAnalysis(undefined, 5), undefined)
const filter = { primary: '研发', department: '软件', startDate: '2026-12-28', endDate: '2027-01-08' }
const planned = buildDashboardAnalysis('capability', source, rows, 5, filter)
const actual = buildAccountingAnalysis(dataset, 5, filter)
close(planned.labor, 4 + 20 * 6 / 21, 'partial-month projection uses workdays in each full month')
close(planned.nonLaborYuan, 10000, 'same date proportion applied to nonlabor')
close(actual.labor, 0.22, 'actuals filter by entry date and department')
close(actual.cost, 2.1, 'actual expenses share the filter')
close(planned.departments.reduce((s, d) => s + d.selected, 0), planned.labor, 'detail/card parity')
close(planned.subjects.reduce((s, d) => s + d.amount, 0), planned.nonLaborYuan, 'subject/card parity')
for (const grain of ['month', 'week']) for (const mode of ['labor', 'cost']) {
  const trend = dashboardBusinessTrend([full, planned, planned], actual, mode, grain)
  close(trend.series[1].values.reduce((s, v) => s + (v ?? 0), 0), planned[mode], `${grain}/${mode} plan sum equals card`)
  close(trend.series[3].values.reduce((s, v) => s + (v ?? 0), 0), actual[mode], `${grain}/${mode} actual sum equals ledger`)
}
assert.equal(dashboardWeekStart('2027-01-01'), '2026-12-28', 'cross-year weeks have a unique Monday key')
assert.equal(dashboardWeekStart('2027-01-04'), '2027-01-04')
assert.equal(dashboardMonthDates('2028-02').length, 29)
assert.equal(dashboardMonthDates('2027-02').length, 28)
const beyond = buildAccountingAnalysis(dataset, 5, { startDate: '2028-01-01', endDate: '2028-01-31' })
assert.equal(beyond.months.length, 0)
assert.equal(dashboardBusinessTrend([full, undefined, undefined], beyond, 'labor', 'month').series[3].values[0], undefined, 'unknown periods never become zero actuals')
const noRecords = buildAccountingAnalysis(dataset, 5, { primary: '研发', startDate: '2026-12-01', endDate: '2026-12-02' })
assert.equal(noRecords.labor, 0, 'known covered date without records is a real zero')
assert.equal(noRecords.months.length, 1)
const weekend = buildDashboardAnalysis('capability', source, rows, 5, { startDate: '2027-01-02', endDate: '2027-01-03' })
assert.equal(weekend.labor, 0)
assert.equal(weekend.months.length, 1)
assert.equal(buildDashboardAnalysis('capability', source, rows, 5, { startDate: '2028-01-01', endDate: '2028-01-31' }).months.length, 0)
const parents = dashboardDepartmentParents([{ primaryDepartment: '研发', secondaryDepartment: '软件' }, { primaryDepartment: '其他', secondaryDepartment: '软件' }])
assert.equal(parents['软件'], UNASSIGNED_PRIMARY)
close(buildDashboardAnalysis('capability', source, rows, 5, { primary: '研发', departmentParents: parents }).nonLaborYuan, 0, 'ambiguous expense not counted in both parent departments')
close(buildDashboardAnalysis('capability', source, rows, 5, { primary: UNASSIGNED_PRIMARY, departmentParents: parents }).nonLaborYuan, 54000, 'unassigned expenses stay traceable and sum to all-department total')
const invalid = buildAccountingAnalysis({ ...dataset, worklogs: [...dataset.worklogs, { ...dataset.worklogs[0], id: 'bad', monthWorkingDays: 0 }] }, 5)
close(invalid.labor, accounting.labor, 'invalid source denominator excluded without poisoning totals')
assert.equal(invalid.issues.length, 1)
const metrics = dashboardBusinessMetrics([undefined, { ...full, cost: 379.5, labor: 75 }, { ...full, cost: 650, labor: 130 }], { ...accounting, cost: 121.7 })
close(metrics.costDelta.percent, 270.5 / 379.5 * 100, 'confirmed deviation formula')
close(metrics.execution, 121.7 / 650 * 100, 'execution cost basis')
assert.equal(metrics.laborDelta.amount, 55)
const zero = dashboardBusinessMetrics([undefined, { ...full, cost: 0 }, { ...full, cost: 0 }], accounting)
assert.equal(zero.costDelta.percent, undefined)
assert.equal(zero.execution, undefined)
assert.equal(dashboardBusinessMetrics([undefined, undefined, undefined], accounting).costDelta, undefined)
assert.equal(selectDashboardSource([{ ...source, version: { ...source.version, isActive: false } }]), undefined)
const mock = load(path.resolve('src/mock/resourceAccounting.ts'))
assert.equal(mock.resourceAccountingDataset('user-created-project'), undefined, 'only named canonical fixtures receive independent mock ledgers')
const mockData = mock.resourceAccountingDataset('1')
assert.ok(mockData.worklogs.length > 0)
assert.equal(new Set(mockData.worklogs.map(row => row.id)).size, mockData.worklogs.length)
for (const row of mockData.worklogs) assert.equal(row.monthWorkingDays, dashboardMonthDates(row.date.slice(0, 7)).filter(isDashboardWorkday).length)
const mockBefore = JSON.stringify(mockData)
buildDashboardAnalysis('capability', { ...source, version: { ...source.version, id: 'different', estimatedInvestment: 999 } }, rows, 5)
assert.equal(JSON.stringify(mock.resourceAccountingDataset('1')), mockBefore, 'version changes cannot change actual ledger')
get('exportResourceBusinessDashboard').exportResourceBusinessDashboard('测试', [full, planned, planned], actual, planned, filter, 'cost', 'week')
assert.equal(sheets.length, 9)
const sheet = name => sheets.find(item => item.sheetName === name)
assert.equal(sheet('四类投入').rows.length, 4)
close(sheet('四类投入').rows[3].cost, actual.cost, 'exported actuals match card')
close(sheet('当前趋势').rows.reduce((sum, row) => sum + (row.accounting ?? 0), 0), actual.cost, 'exported weeks match current trend')
assert.equal(sheet('工时投入明细').rows.length, 2)
assert.equal(sheet('实际非人力费用').rows[0].amountYuan, 10000)
assert.equal(sheet('当前趋势').rows[0].primaryFilter, '研发')
assert.equal(sheet('当前趋势').rows[0].range, '2026-12-28～2027-01-08')
assert.equal(JSON.stringify({ source, rows, dataset }), original, 'analytics and export never mutate source data')
const require = createRequire(import.meta.url), xlsx = require('xlsx')
let workbook
const realWriter = createTypeScriptModuleLoader(new Map([
  [require.resolve('antd'), { exports: { message: { success() {}, warning() {}, error(error) { throw new Error(error) } } } }],
  [require.resolve('xlsx'), { exports: { ...xlsx, writeFile: value => { workbook = value } } }],
]))
realWriter(path.resolve('src/utils/exportExcel.ts')).exportMultiSheet(sheets, 'dashboard-business.xlsx')
const restored = xlsx.read(xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' })
assert.equal(restored.SheetNames.length, 9)
assert.equal(xlsx.utils.sheet_to_json(restored.Sheets['工时投入明细'])[0]['来源当月工作日'], 25)
console.log('PASS business dashboard: dates/weeks, four-series reconciliation, source calendars, department attribution, zero/missing data, independent actuals, nonlabor costs and real Excel workbook')
