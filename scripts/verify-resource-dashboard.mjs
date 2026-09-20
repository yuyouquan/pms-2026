import assert from 'node:assert/strict'
import path from 'node:path'
import { createRequire } from 'node:module'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'
globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = { localStorage }
let exported
const load = createTypeScriptModuleLoader(new Map([[path.resolve('src/utils/exportExcel.ts'), { exports: { exportTimestamp: () => 'test', exportMultiSheet: sheets => { exported = sheets } } }]]))
const get = file => load(path.resolve(file))
const { buildDashboardAnalysis, selectDashboardSource, dashboardSources, dashboardDelta, dashboardTrendSeries } = get('src/components/project-resources/resourceDashboardData.ts')
const version = { id: 'version-a', versionNumber: 'V评审-A', budgetType: 'projectBudget', estimatedInvestment: 20, isActive: true,
  projectStartTime: '2026-12-01', projectEndTime: '2027-01-31',
  departmentInvestments: [{ id: 'a', primaryDepartment: '研发', secondaryDepartment: '产品部', estimatedInvestment: 10 }, { id: 'b', primaryDepartment: '研发', secondaryDepartment: '软件部', estimatedInvestment: 10 }],
  nonLaborInvestment: { startMonth: '2026-12', endMonth: '2027-01', items: [
    { id: 'expense-a', secondaryDepartment: '产品部', tertiaryDepartment: '产品', secondarySubject: '差旅', tertiarySubject: '机票', monthlyAmounts: { '2025-01': 999999, '2026-12': 10000, '2027-01': 20000 } },
    { id: 'expense-b', secondaryDepartment: '软件部', tertiaryDepartment: '开发', secondarySubject: '设备', tertiarySubject: '电脑', monthlyAmounts: { '2027-01': 30000 } },
  ] },
}
const source = { owner: { id: 'project-a', name: '测试项目' }, version }
const rows = [
  { id: 'a', versionId: version.id, primaryDepartment: '研发', secondaryDepartment: '产品部', estimatedTotal: 10, monthlyData: { '2026-12': 2, '2027-01': 10 } },
  { id: 'b', versionId: version.id, primaryDepartment: '研发', secondaryDepartment: '软件部', estimatedTotal: 10, monthlyData: { '2026-12': 3, '2027-01': 5 } },
  { id: 'archived', versionId: version.id, isArchived: true, primaryDepartment: '其他', secondaryDepartment: '历史', estimatedTotal: 999, monthlyData: { '2027-01': 999 } },
  { id: 'other-version', versionId: 'other', primaryDepartment: '其他', secondaryDepartment: '其他', estimatedTotal: 999, monthlyData: { '2027-01': 999 } },
]
const before = JSON.stringify({ source, rows })
const full = buildDashboardAnalysis('capability', source, rows, 5)
assert.equal(full.labor, 20)
assert.equal(full.cost, 106, '20*5 + 60000/10000, without hidden historical expense')
assert.equal(full.nonLaborYuan, 60000)
assert.equal(full.average, 10)
assert.deepEqual(full.peak, { month: '2027-01', value: 15 })
assert.equal(full.deficit, 2)
assert.equal(full.excess, 2)
assert.equal(full.issues.filter(item => item.key.startsWith('balance-')).length, 2, 'opposing department deviations remain visible')
assert.equal(full.stages.reduce((sum, item) => sum + item.amount, 0), full.labor)
const year = buildDashboardAnalysis('capability', source, rows, 5, { year: '2027' })
assert.equal(year.labor, 15)
assert.equal(year.cost, 80)
assert.equal(year.average, 15)
assert.equal(year.target, 20, 'full-cycle target is independent of the year filter')
assert.equal(year.subjects.reduce((sum, item) => sum + item.amount, 0), 50000)
const filtered = buildDashboardAnalysis('capability', source, rows, 5, { year: '2027', department: '产品部' })
assert.equal(filtered.labor, 10)
assert.equal(filtered.target, 10)
assert.equal(filtered.cost, 52)
assert.equal(filtered.subjects.length, 1)
assert.equal(filtered.departments.length, 1)
assert.equal(filtered.departments[0].share, 100)
assert.equal(buildDashboardAnalysis('capability', source, rows, 0).cost, 6, 'configured zero rate is valid')
const missingYear = buildDashboardAnalysis('capability', source, rows, 5, { year: '2030' })
assert.equal(missingYear.months.length, 0, 'no implied zero series outside its period')
assert.equal(missingYear.subjects.length, 0)
assert.equal(JSON.stringify({ source, rows }), before, 'all analytics are readonly')
const duplicateSource = structuredClone(source)
duplicateSource.version.departmentInvestments[1].secondaryDepartment = '产品部'
const duplicateRows = rows.slice(0, 2).map(row => ({ ...row, secondaryDepartment: '产品部' }))
const duplicate = buildDashboardAnalysis('capability', duplicateSource, duplicateRows, 5)
assert.equal(duplicate.departments.length, 1)
assert.equal(duplicate.departments[0].delta, 0)
assert.equal(duplicate.deficit, 2, 'same-name source rows cannot cancel each other')
assert.equal(duplicate.excess, 2)
assert.equal(duplicate.issues.filter(item => item.key.startsWith('balance-')).length, 2)
const partialDuplicate = buildDashboardAnalysis('capability', duplicateSource, [{ ...duplicateRows[0], monthlyData: { '2026-12': 10 } }], 5)
assert.equal(partialDuplicate.deficit, 10, 'missing one same-name source row must not disappear behind an existing row')
assert.ok(partialDuplicate.issues.some(item => item.key.startsWith('balance-missing-')))
assert.equal(buildDashboardAnalysis('capability', source, [], 5).deficit, 20, 'upper targets without monthly rows remain visible')
assert.ok(buildDashboardAnalysis('capability', { ...source, version: { ...version, departmentInvestments: [] } }, [], 5).issues.some(item => item.key === 'missing-detail'), 'legacy total-only versions cannot be described as balanced')
const technical = { ...source, version: { ...version, milestones: { planningStart: '2026-12-01', charterDCP: '2027-01-31', tdcpx: '2027-01-31', edcp: null },
  departmentInvestments: [{ ...version.departmentInvestments[0], planningPhase: 10 }, { ...version.departmentInvestments[1], migrationPhase: 10 }] } }
assert.ok(buildDashboardAnalysis('technical', technical, rows, 5).issues.some(item => item.key === 'dates'))
assert.ok(!buildDashboardAnalysis('technical', technical, rows, 5, { department: '产品部' }).issues.some(item => item.key === 'dates'), 'filtered department does not inherit another department missing-date warning')
const trend = dashboardTrendSeries([undefined, undefined, full], 'cost', true)
assert.deepEqual(trend.series[2].values, [26, 106])
const separated = { ...full, months: ['2027-03'], monthly: [{ month: '2027-03', labor: 1, cost: 5 }] }
const gap = dashboardTrendSeries([full, separated, undefined], 'labor', false)
assert.deepEqual(gap.months, ['2026-12', '2027-01', '2027-02', '2027-03'])
assert.equal(gap.series[0].values[2], undefined, 'calendar gaps are preserved as missing, not zero')

const draft = { ...source, version: { ...version, id: 'draft', isActive: false } }
assert.equal(selectDashboardSource([draft]), undefined, 'draft is not an automatic fallback')
assert.equal(selectDashboardSource([source, draft]), source)
assert.equal(selectDashboardSource([source, draft], 'draft'), draft)
assert.equal(selectDashboardSource([source, draft], 'deleted'), undefined, 'deleted explicit version cannot silently become another version')
assert.equal(selectDashboardSource([source, { ...source, version: { ...version, id: 'another-official' } }]), undefined, 'ambiguous official selection is not summed')
assert.equal(dashboardDelta(undefined, 5), undefined)
assert.deepEqual(dashboardDelta(10, 0), { amount: 10, percent: undefined })
assert.deepEqual(dashboardDelta(80, 100), { amount: -20, percent: -20 })
get('src/components/project-resources/exportResourceDashboard.ts').exportResourceDashboard('测试项目', [undefined, undefined, filtered], filtered, '2027', '产品部')
assert.equal(exported.length, 7)
const sheet = name => exported.find(item => item.sheetName === name)
assert.equal(sheet('预算对比').rows[0].version, '未纳入')
assert.equal(sheet('预算对比').rows[2].cost, 52)
assert.equal(sheet('月度对比').rows.length, 1)
assert.equal(sheet('月度对比').rows[0].month, '2027-01')
assert.equal(sheet('非人力科目').rows[0].amount, 20000)
assert.equal(sheet('部门结构').rows[0].secondary, '产品部')
assert.equal(JSON.stringify({ source, rows }), before, 'export never changes source data')
get('src/components/project-resources/exportResourceDashboard.ts').exportResourceDashboard('测试项目', [undefined, undefined, full], full, 'all', 'all', 'cost', true)
assert.deepEqual(sheet('当前趋势').rows.map(row => row.projectBudget), trend.series[2].values, 'export matches the current cumulative chart')
assert.equal(sheet('当前趋势').rows[1].scope, '所选期间累计')
assert.equal(sheet('当前趋势').rows[1].unit, '万元')
get('src/components/project-resources/exportResourceDashboard.ts').exportResourceDashboard('测试项目', [undefined, undefined, missingYear], missingYear, '2030', 'all')
assert.equal(sheet('预算对比').rows[2].cost, undefined)
assert.equal(sheet('部门结构').rows[0].selected, undefined)
assert.equal(sheet('阶段结构').rows.length, 0)
assert.equal(sheet('非人力科目').rows.length, 0)
const require = createRequire(import.meta.url), xlsx = require('xlsx')
let workbook
const workbookLoader = createTypeScriptModuleLoader(new Map([
  [require.resolve('antd'), { exports: { message: { success() {}, warning() {}, error(error) { throw new Error(error) } } } }],
  [require.resolve('xlsx'), { exports: { ...xlsx, writeFile: value => { workbook = value } } }],
]))
workbookLoader(path.resolve('src/utils/exportExcel.ts')).exportMultiSheet(exported, 'dashboard-test.xlsx')
const restored = xlsx.read(xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' })
assert.equal(restored.SheetNames.length, 7)
assert.equal(xlsx.utils.sheet_to_json(restored.Sheets['预算对比'])[2]['所选期间费用合计（万元）'], '—', 'missing-year semantics survive the real workbook writer')
console.log('PASS dashboard calculations: year/department scope, unit conversion, no-data semantics, deviations, stage reconciliation and export')

const projectStore = get('src/stores/project.ts').useProjectStore
const registry = get('src/lib/hrProjectRegistry.ts')
for (const kind of ['Machine', 'Tos', 'Technical', 'Capability']) {
  const store = get(`src/stores/hr${kind}.ts`)[`useHr${kind}Store`]
  store.getState().refreshFormalProjects()
  const projects = store.getState().projects
  const owner = projects.find(item => item.pmsProjectId && item.versions.some(v => v.budgetType === 'projectEstimate') && registry.canAccessHrProject(item))
  assert.ok(owner, `${kind}: formal source fixture`)
  const estimates = dashboardSources(projects, owner.pmsProjectId, 'projectEstimate')
  assert.ok(estimates.length)
  assert.ok(estimates.every(item => item.owner.pmsProjectId === owner.pmsProjectId), 'unrelated projects never leak into analysis')
  const annual = dashboardSources(projects, owner.pmsProjectId, 'annual')
  assert.ok(annual.every(item => item.owner.pmsProjectId === owner.pmsProjectId || registry.getHrRegistryProject(item.owner)?.boundFormalProjectId === owner.pmsProjectId))
  const bound = projects.find(item => item.versions.some(v => v.budgetType === 'annual') && registry.getHrRegistryProject(item)?.boundFormalProjectId && registry.canAccessHrProject(item))
  assert.ok(bound, `${kind}: bound annual budget fixture exists`)
  const targetId = registry.getHrRegistryProject(bound).boundFormalProjectId
  assert.ok(dashboardSources(projects, targetId, 'annual').some(item => item.owner.id === bound.id), `${kind}: linked annual budget is included`)
  const old = projectStore.getState().currentLoginUser
  projectStore.getState().setCurrentLoginUser('无权限看板测试用户')
  assert.deepEqual(dashboardSources(projects, owner.pmsProjectId, 'annual'), [])
  assert.deepEqual(dashboardSources(projects, owner.pmsProjectId, 'projectEstimate'), [])
  projectStore.getState().setCurrentLoginUser(old)
  const selected = selectDashboardSource(estimates) ?? estimates[0]
  const dataBefore = JSON.stringify(store.getState())
  const analysis = buildDashboardAnalysis(kind.toLowerCase(), selected, store.getState().monthlyInvestments, 5)
  assert.ok(Number.isFinite(analysis.cost))
  assert.equal(JSON.stringify(store.getState()), dataBefore)
  console.log(`PASS ${kind}: real sources, project binding, permissions and readonly analysis`)
}
