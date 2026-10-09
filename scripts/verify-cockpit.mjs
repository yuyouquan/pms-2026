import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'
globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = { localStorage }
const load = createTypeScriptModuleLoader()
const data = load(path.resolve('src/components/cockpit/cockpitData.ts'))
const { evaluateMenuPermission, createEmptyMenuPolicy, parsePermissionCenter, migrateLegacyPermissionCenter } = load(path.resolve('src/lib/permissionCenter.ts'))
const { canAccessMainModule, PERMISSION_MAIN_NAV } = load(path.resolve('src/components/permission-center/navigation.ts'))
const { buildPermissionMenuTree } = load(path.resolve('src/components/permission-center/menuTree.ts'))
const close = (a, b, label) => assert.ok(Math.abs(a - b) < 1e-6, `${label}: ${a} != ${b}`)
const project = { id: 'a', name: '测试项目', type: '能力建设项目', status: '进行中', planStartDate: '2026-01-01', fieldValues: { ipmProjectType: '部门级-技术研发' } }
const version = { id: 'budget-v1', budgetType: 'projectBudget', versionNumber: 'V1', isActive: true, estimatedInvestment: 60, projectStartTime: '2026-01-01', projectEndTime: '2026-02-28', departmentInvestments: [
  { id: 'd1', primaryDepartment: '软件工程部', secondaryDepartment: '软件项目管理部', estimatedInvestment: 30 },
  { id: 'd2', primaryDepartment: '硬件部', secondaryDepartment: '结构部', estimatedInvestment: 30 },
] }
const sources = ['annual', 'projectEstimate', 'projectBudget'].map((type, i) => ({ owner: { id: 'owner' }, version: { ...version, id: type, budgetType: type, estimatedInvestment: (i + 1) * 20 } }))
const monthly = sources.flatMap((source, i) => version.departmentInvestments.map((dept, j) => ({ ...dept, id: `${i}-${j}`, projectId: 'owner', versionId: source.version.id, estimatedTotal: (i + 1) * 10, monthlyData: { '2026-01': (i + 1) * 5, '2026-02': (i + 1) * 5 } })))
const dataset = { projectId: 'a', source: 'mock', startDate: '2026-01-01', endDate: '2026-02-28', worklogs: [
  { id: 'l1', date: '2026-01-10', person: '甲', primaryDepartment: '软件工程部', secondaryDepartment: '软件项目管理部', personDays: 10, monthWorkingDays: 20 },
  { id: 'l2', date: '2026-02-10', person: '乙', primaryDepartment: '硬件部', secondaryDepartment: '结构部', personDays: 30, monthWorkingDays: 20 },
  { id: 'l3', date: '2026-02-28', person: '甲', primaryDepartment: '软件工程部', secondaryDepartment: '软件项目管理部', personDays: 999, monthWorkingDays: 20 },
], expenses: [] }
const input = { project, category: 'capability', sources, monthly, dataset }
const dates = { startDate: '2026-01-01', endDate: '2026-02-28' }
const snapshot = JSON.stringify(input)
const facts = data.buildCockpitFacts([input], dates, 5, '2026-02-15', () => true)
assert.equal(facts.length, 2)
close(data.summarizeCockpit([...facts, { ...facts[0], cumulative: { labor: undefined, cost: undefined } }]).cumulative.labor, data.summarizeCockpit(facts).cumulative.labor, 'one incomplete project does not erase available cumulative investment')
assert.equal(data.buildCockpitFacts([input], { startDate: '2028-01-01', endDate: '2028-12-31' }, 5, '2028-12-31', () => true).length, 0, 'out-of-window projects are excluded')
const sum = data.summarizeCockpit(facts)
close(sum.budget.labor, 60, 'formal monthly totals')
close(sum.actual.labor, 2, 'actual calendar conversion and no future worklogs')
close(sum.actual.cost, 10, 'fee conversion')
close(sum.cumulative.labor, 30 + 30 * 15 / 28, 'calendar proration')
close(data.cockpitRatios(sum, 'labor').deviation, 50, 'ratio of sums')
close(data.cockpitRatios(sum, 'labor').annualExecution, 2 / 60 * 100, 'annual execution')
const software = data.filterCockpitFacts(facts, { scope: 'software', departments: [] })
assert.equal(software.length, 1)
close(data.summarizeCockpit(software).actual.labor, .5, 'department restriction')
const shares = data.cockpitShares(facts, dates, 'research')
close(shares.total, 40, 'person-day shares, not cost or person-month')
close(shares.rows.find(row => row.label === '技术研发').total, 100, 'explicit IPM research type')
assert.equal(data.cockpitResearchCategory({ ...project, fieldValues: {} }), '未归类')
const missing = data.buildCockpitFacts([{ ...input, sources: [undefined, undefined, undefined] }], dates, 5, '2026-02-15', () => true)
assert.equal(data.summarizeCockpit(missing).budget, undefined, 'missing formal budget is never invented')
assert.equal(data.cockpitRatios(data.summarizeCockpit(missing), 'labor').annualExecution, undefined)
const partial = data.buildCockpitFacts([input], { startDate: '2026-02-01', endDate: '2026-02-10' }, 5, '2026-02-15', () => true)
close(data.summarizeCockpit(partial).cumulative.labor, 30 * 10 / 28, 'cumulative respects selected start and end')
for (const grain of ['month', 'week']) {
 const trend = data.cockpitTrend(facts, dates, 'labor', 'category', grain)
 close(trend.series.flatMap(row => row.values).reduce((sum, value) => sum + (value ?? 0), 0), 2, `${grain} buckets sum to accounting`)
}
const categoryRows = data.cockpitOverview(facts, 'category', 'labor')
assert.deepEqual(categoryRows.map(row => row.name), ['整机产品项目', 'tOS项目', '技术项目', '能力建设项目'])
assert.deepEqual(data.cockpitOverview(facts, 'department', 'labor').slice(0, 8).map(row => row.name), data.SOFTWARE_DEPARTMENTS)
assert.equal(JSON.stringify(input), snapshot, 'dashboard is read only')
const model = { version: 2, groups: [{ id: 'g', name: '看板' }], roles: [{ id: 'r', groupId: 'g', name: '部门经理', members: ['演示用户02'], departments: [], description: '' }], policies: [{ ...createEmptyMenuPolicy('r', 'cockpit.resources'), actions: ['view'], data: { mode: 'conditions', conjunction: 'all', conditions: [{ id: 'c', field: 'secondaryDepartment', operator: 'eq', value: '软件项目管理部' }] } }] }
assert.ok(parsePermissionCenter(model))
assert.equal(canAccessMainModule(model, '演示用户02', 'hrPipeline'), true)
const allowed = data.buildCockpitFacts([input], dates, 5, '2026-02-15', (input, p, s) => data.canReadCockpitDepartment(model, '演示用户02', input.project, input.category, p, s))
assert.equal(allowed.length, 1, 'role data scope applied before aggregating')
close(data.summarizeCockpit(allowed).actual.labor, .5, 'hidden department absent from totals')
close(data.cockpitShares(allowed, dates, 'category').total, 10, 'full R&D ratios cannot bypass authorization')
assert.equal(data.buildCockpitFacts([input], dates, 5, '2026-02-15', (input,p,s) => data.canReadCockpitDepartment(model, 'outsider', input.project, input.category,p,s)).length, 0)
assert.equal(evaluateMenuPermission(model, '演示用户02', 'cockpit.technical'), false)
assert.equal(canAccessMainModule({ ...model, policies: [{ ...createEmptyMenuPolicy('r', 'hr.overview/manpower'), actions: ['view'] }] }, '演示用户02', 'hrPipeline'), false, 'legacy HR grants do not implicitly grant cockpit access')
assert.equal(migrateLegacyPermissionCenter([], {}).policies.some(policy => policy.menuId.startsWith('cockpit.')), false, 'legacy public grants do not include a new cockpit')
assert.equal(PERMISSION_MAIN_NAV.find(item => item.key === 'hrPipeline').label, '驾驶舱')
assert.match(JSON.stringify(buildPermissionMenuTree('驾驶舱')), /cockpit.resources/)
assert.match(JSON.stringify(buildPermissionMenuTree('驾驶舱')), /cockpit.technical/)
console.log('Cockpit: sources, dates, totals, ratios, scope, role isolation, navigation and configuration passed.')
