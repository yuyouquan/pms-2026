import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const noop = () => {}
const actions = ['view', 'createVersion', 'lockVersion', 'setOfficialVersion', 'deleteVersion', 'export', 'laborEdit', 'nonLaborEdit']
let actor = 'owner', granted = new Set(actions), defer = false, pending, exports = [], mutations = [], warnings = []
let current, budgetType = 'projectBudget', hookCursor = 0, hooks = []
const project = { id: 'scope', name: '资源权限验证', projectAttribute: 'formal', type: '能力建设项目' }
const canResourceAction = (record, action, scope = record?.pmsProjectId) => !!record && actor === 'owner' && granted.has('view') && granted.has(action)
  && (record.pmsProjectId === scope || record.pmsProjectId === 'linked' && scope === 'scope' && ['view', 'export'].includes(action))
const isHrVersionEditable = (record, version, action) => !!version && version.lockState !== 'locked'
  && (action ? canResourceAction(record, action) : ['createVersion', 'laborEdit', 'nonLaborEdit'].some(key => canResourceAction(record, key)))
const table = Object.assign(() => null, { Summary: { Row: 'SummaryRow', Cell: 'SummaryCell' } })
const stateStore = { getState: () => current }
const registry = Object.assign(selector => selector?.({ currentLoginUser: actor, projects: [project] }), { getState: () => ({ currentLoginUser: actor, projects: [project] }) })
const config = Object.assign(selector => selector({ data: { hrModel: [], feeRate: [{ value: 5 }] } }), { getState: () => ({ data: { feeRate: [{ value: 5 }] } }) })
const imports = {
  react: { useEffect: noop, useRef: value => ({ current: value }), useState: initial => { const index = hookCursor++; return [index in hooks ? hooks[index] : typeof initial === 'function' ? initial() : initial, value => { hooks[index] = value }] } },
  antd: new Proxy({ App: { useApp: () => ({ message: { success: noop, warning: value => warnings.push(value) } }) }, Table: table, DatePicker: { RangePicker: 'RangePicker' } }, { get: (target, key) => target[key] ?? String(key) }),
  '@ant-design/icons': new Proxy({}, { get: (_, key) => String(key) }),
  xlsx: { read: () => ({ SheetNames: ['sheet'], Sheets: { sheet: {} } }), utils: { sheet_to_json: () => [['一级部门', '二级部门', '预估投入'], ['A', 'B', 15]] } },
  '@/stores/project': { useProjectStore: registry },
  '@/stores/permission': { usePermissionStore: noop, useHasPermission: () => key => actor === 'owner' && granted.has(key.replace('resource:', '')) },
  '@/stores/ui': { useUiStore: { getState: () => ({ navigateWithEditGuard: callback => { if (defer) pending = callback; else callback() } }) } },
  '@/stores/plan': { usePlanStore: () => ({}) },
  '@/stores/technicalPlan': { useTechnicalPlanStore: () => ({}) },
  '@/lib/budgetMilestoneScheduling': { resolveBudgetScheduleDisplay: () => ({}) },
  '@/components/project-resources/resourceDashboardStages': { dashboardStageDefinition: () => ({ labels: [], periods: [] }) },
  '@/components/project-resources/cumulativeLaborData': { buildCumulativeLabor: () => undefined },
  '@/stores/hrConfig': { useHrConfigStore: config },
  '@/lib/hrProjectRegistry': { canResourceAction, getHrAllowedBudgetTypes: () => ['annual', 'projectEstimate', 'projectBudget'], isHrVersionVisible: (record, type, scope) => canResourceAction(record, 'view', scope) && (record.pmsProjectId === scope || type === 'annual'), isHrFormalRecord: () => false, getHrRegistryProject: () => project },
  '@/lib/hrVersionRules': { isHrVersionEditable, canCreateHrVersion: record => canResourceAction(record, 'createVersion') },
  '@/types/projectRegistry': { getProjectAttribute: value => value.projectAttribute },
  '@/lib/hrFormalProjectSource': { matchesHrCategory: () => false, resolveHrFormalSource: () => ({ milestones: {} }) },
  '@/components/project-resources/resourceVersionAdapter': { resourceStore: () => stateStore, useResourceStore: () => current, resourceProjectName: value => value.name },
  '@/components/project-resources/resourceVersionViewData': { chooseResourceVersion: versions => versions[0], RESOURCE_TABS: [{ key: 'dashboard', label: '资源概览' }] },
  '@/components/project-resources/ResourceVersionDialogs': { ResourceVersionCreateDialog: 'CreateDialog', ResourceOperationLogDialog: 'LogDialog' },
  '@/components/project-resources/exportResourceVersion': { exportResourceVersion: (...args) => exports.push(args) },
  '@/lib/resourceAllocation': { resolveMachineDepartmentInvestments: version => version.modelSnapshot?.departmentInvestments ?? [] },
  '@/mock/resourceAccounting': { resourceAccountingDataset: () => undefined },
  '@/components/project-resources/resourceAccounting': { buildAccountingAnalysis: () => undefined, dashboardDepartmentParents: () => ({}), UNASSIGNED_PRIMARY: '未归属一级部门' },
  '@/components/project-resources/resourceDashboardBusiness': { dashboardBusinessTrend: () => ({ periods: [], series: [] }) },
  '@/components/project-resources/exportResourceBusinessDashboard': { exportResourceBusinessDashboard: (...args) => exports.push(args) },
  '@/components/project-resources/exportResourceDashboard': { exportResourceDashboard: (...args) => exports.push(args) },
  '@/components/project-resources/ResourceInlineField': { __esModule: true, default: 'InlineField' },
  '@/components/project-resources/NonLaborInvestmentSection': { __esModule: true, default: 'NonLabor', NonLaborInvestmentRange: 'Range' },
  '@/components/project-resources/BudgetMilestoneSchedule': { __esModule: true, default: 'Schedule' },
  '@/components/project-resources/inlineFieldSession': { inlineDateInputHandlers: () => ({}) },
  '@/components/project-resources/useInlineImportSession': { useInlineImportSession: () => ({ capture: check => check }) },
  '@/lib/resourceInlineEditing': { canEditResourceMilestone: () => true, resourceMilestoneFields: { capability: [{ key: 'projectStartTime', label: '开始日期' }] }, resolveMachineDepartmentInvestments: value => value.modelSnapshot?.departmentInvestments ?? [], resolveMachinePhaseFields: () => [] },
  '@/lib/resourceRatios': { getResourceRatioFields: () => [], getResourcePhaseRatios: () => ({}) },
  '@/lib/nonLaborInvestment': { cloneNonLaborInvestment: value => value ?? { items: [] } },
  '@/constants/hrConfig': { getConfigProjectLevels: () => [], getConfigModelVersions: () => [] },
  '@/hooks/useHrDepartmentOptions': { useHrDepartmentOptions: () => ({ primaryOptions: [], getSecondaryOptions: () => [] }) },
  '@/components/project-resources/HrReadonlyField': { HrReadonlyField: 'Readonly' },
  '@/lib/roadmapValidation': { PRODUCT_LINES_BY_BRAND: {} },
  '@/constants/hrMachine': { BUDGET_TYPE_LABELS: { annual: '年度预算', projectBudget: '项目预算' }, formatPersonMonth: String },
  '@/utils/exportExcel': { exportSheet: noop },
  '@/components/project-resources/HrResourceScope': { HrResourceScope: 'Scope' },
  '@/components/shared/ProjectSpaceTabs': { ProjectSpaceTabs: 'Navigation' },
  '@/components/project-resources/ResourceDashboardCharts': { DashboardCostMix: 'CostMix', DashboardStageBars: 'Stages', DashboardTrend: 'Trend' },
  '@/components/project-resources/resourceDashboardData': {
    DASHBOARD_BUDGETS: [{ key: 'projectBudget', label: '项目预算' }], dashboardDelta: () => undefined,
    dashboardSources: (records, scope, type) => records.filter(record => canResourceAction(record, 'view', scope)).flatMap(owner => owner.versions.filter(version => version.budgetType === type).map(version => ({ owner, version }))),
    selectDashboardSource: sources => { const official = sources.filter(source => source.version.isActive); return official.length === 1 ? official[0] : undefined },
    buildDashboardAnalysis: (_category, source, rows, rate) => ({ source, rows, rate, years: [], months: [], allMonths: [], issues: [], departments: [], subjects: [], deficit: 0, excess: 0, target: 0 }),
  },
  ...Object.fromEntries(['ResourceCumulativeLabor', 'ResourceDashboardMetrics', 'ResourceBusinessTrend', 'ResourceAccountingDetails', 'ResourceDashboardDetails', 'HrSourceLink', 'ResourceVersionViews', 'ResourceInlineDetail', 'ResourceVersionWorkspace', 'ProjectResourceDashboard'].map(name => [`@/components/project-resources/${name}`, { __esModule: true, default: name }])),
}
function compile(name) {
  const module = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(`src/components/project-resources/${name}.tsx`, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText
  new Function('require', 'module', 'exports', code)(id => imports[id] ?? require(id), module, module.exports)
  return module.exports.default
}
const Workspace = compile('ResourceVersionWorkspace'), Detail = compile('ResourceInlineDetail'), Dashboard = compile('ProjectResourceDashboard'), Root = compile('ProjectResources')
function elements(node) {
  return [node, ...[node?.props?.children, node?.props?.headerContent, node?.props?.tabBarExtraContent, ...(node?.props?.items ?? []).map(item => item.children)].flat(Infinity)
    .filter(child => child && typeof child === 'object' && child.type).flatMap(elements)]
}
function reset() {
  actor = 'owner'; granted = new Set(actions); hooks = []; budgetType = 'projectBudget'; defer = false; pending = undefined; exports = []; mutations = []; warnings = []
  const version = { id: 'v1', budgetType: 'projectBudget', minorVersion: 1, versionNumber: 'V0.1', lockState: 'unlocked', isActive: true, createdAt: '2026-09-21', projectStartTime: '2026-01-01', departmentInvestments: [{ id: 'd1', primaryDepartment: 'A', secondaryDepartment: 'B', estimatedInvestment: 10 }], estimatedInvestment: 10 }
  current = { projects: [{ id: 'record', pmsProjectId: 'scope', name: project.name, status: 'active', versions: [version] }], monthlyInvestments: [], refreshFormalProjects: noop,
    setVersionLocked: (...args) => mutations.push(['lock', ...args]), setVersionActive: (...args) => mutations.push(['official', ...args]), deleteVersion: (...args) => mutations.push(['delete', ...args]), updateVersionInline: (...args) => mutations.push(['inline', ...args]),
    createResourceVersion: (...args) => { mutations.push(['create', ...args]); return 'new' }, updateResourceMonthlyInvestment: noop }
}
const renderWorkspace = () => { hookCursor = 0; return elements(Workspace({ project, category: 'capability', budgetType })) }
const button = (tree, label) => tree.find(node => node.type === 'Button' && (node.props['aria-label'] === label || node.props.children === label))
const detailProps = tree => tree.find(node => node.type === 'ResourceInlineDetail').props
const renderDetail = flags => { hookCursor = 0; return elements(Detail({ category: 'capability', project: current.projects[0], version: current.projects[0].versions[0], scopeId: project.id, laborReadOnly: true, nonLaborReadOnly: true, setupReadOnly: true, ...flags })) }
reset()
for (const action of actions.filter(action => action !== 'view')) {
  granted = new Set(['view', action])
  const tree = renderWorkspace(), props = detailProps(tree)
  assert.equal(props.laborReadOnly, action !== 'laborEdit')
  assert.equal(props.nonLaborReadOnly, action !== 'nonLaborEdit')
  assert.equal(props.setupReadOnly, action !== 'createVersion')
  assert.equal(tree.find(node => node.type === 'ResourceVersionViews').props.readOnly, action !== 'laborEdit')
  for (const [permission, label] of Object.entries({ createVersion: '新建版本', lockVersion: '锁定', setOfficialVersion: '取消设置为正式版本', deleteVersion: '删除', export: '导出版本' })) assert.equal(!!button(tree, label), action === permission, `${action}: ${label}`)
  assert.ok(button(tree, '版本操作日志'))
}
for (const source of ['locked', 'linked']) {
  reset()
  if (source === 'locked') current.projects[0].versions[0].lockState = 'locked'
  else { current.projects[0].pmsProjectId = 'linked'; current.projects[0].versions[0].budgetType = budgetType = 'annual' }
  const tree = renderWorkspace(), props = detailProps(tree)
  assert.ok(props.laborReadOnly && props.nonLaborReadOnly && props.setupReadOnly, source)
  assert.ok(!button(tree, '删除'))
  assert.equal(!!button(tree, '解锁'), source === 'locked')
  assert.equal(!!button(tree, '取消设置为正式版本'), source === 'locked')
  assert.ok(button(tree, '导出版本'))
}
for (const change of ['revoke', 'switch']) {
  reset(); defer = true
  button(renderWorkspace(), '导出版本').props.onClick()
  assert.equal(exports.length, 0)
  if (change === 'revoke') granted.delete('export'); else actor = 'other'
  pending()
  assert.equal(exports.length, 0, `${change}: deferred export denied`)
  assert.ok(warnings.length)
}
reset(); defer = true
button(renderWorkspace(), '导出版本').props.onClick()
current.projects[0].versions[0] = { ...current.projects[0].versions[0], estimatedInvestment: 88 }
current.monthlyInvestments = [{ id: 'latest-monthly' }]
pending()
assert.equal(exports[0][1].estimatedInvestment, 88)
assert.equal(exports[0][2], current.monthlyInvestments)
reset()
const deleteConfirm = renderWorkspace().find(node => node.type === 'Popconfirm').props.onConfirm
current.projects[0].versions[0].lockState = 'locked'
deleteConfirm()
assert.equal(mutations.length, 0, 'a pending delete cannot remove a newly locked version')
reset(); defer = true
button(renderWorkspace(), '取消设置为正式版本').props.onClick()
granted.delete('setOfficialVersion'); pending()
assert.equal(mutations.length, 0, 'pending activation confirmation rechecks its own permission')
reset(); defer = true
button(renderWorkspace(), '查看操作日志').props.onClick()
granted.delete('view'); pending()
assert.equal(hooks[1], undefined, 'pending log dialog rechecks resource view')
console.log('PASS workspace independent actions, logs, monthly labor, locked/linked readonly, deferred revocation and fresh export data')

reset()
let detail = renderDetail({ laborReadOnly: false })
assert.ok(detail.find(node => node.type === 'Upload'))
assert.equal(detail.find(node => node.type === 'NonLabor').props.readOnly, true)
assert.equal(detail.find(node => node.type === 'InlineField' && node.props.label === '开始日期').props.readOnly, true)
const laborTable = detail.find(node => node.type === table)
assert.equal(laborTable.props.columns[2].render(null, current.projects[0].versions[0].departmentInvestments[0]).props.readOnly, false)
detail = renderDetail({ nonLaborReadOnly: false })
assert.ok(!detail.find(node => node.type === 'Upload'))
const expense = detail.find(node => node.type === 'NonLabor')
granted.delete('laborEdit')
assert.equal(expense.props.canImport(), true, 'expense import does not depend on labor permission')
granted.delete('nonLaborEdit')
assert.equal(expense.props.canImport(), false, 'expense confirmation rechecks expense permission')
for (const change of ['revoke', 'switch']) {
  reset(); detail = renderDetail({ laborReadOnly: false })
  let resolve
  const promise = detail.find(node => node.type === 'Upload').props.beforeUpload({ arrayBuffer: () => new Promise(done => { resolve = done }) })
  if (change === 'revoke') granted.delete('laborEdit'); else actor = 'other'
  resolve(new ArrayBuffer(0)); await promise
  assert.equal(mutations.length, 0, `${change}: pending labor import denied`)
}
reset(); detail = renderDetail({ laborReadOnly: false })
await detail.find(node => node.type === 'Upload').props.beforeUpload({ arrayBuffer: async () => new ArrayBuffer(0) })
assert.equal(mutations.length, 1, 'authorized labor import remains usable')
reset()
current.projects[0].brand = 'TECNO'
Object.assign(current.projects[0].versions[0], { hrModelVersion: 'Model1', projectLevel: 'A', levelCoefficient: 1, modelSnapshot: { departmentInvestments: current.projects[0].versions[0].departmentInvestments } })
hookCursor = 0
const machineProps = { category: 'machine', project: current.projects[0], version: current.projects[0].versions[0], scopeId: project.id, laborReadOnly: false, nonLaborReadOnly: false, setupReadOnly: true }
const machine = elements(Detail(machineProps))
assert.ok(!machine.find(node => node.type === 'Upload'), 'machine department model cannot be imported through labor permission')
assert.equal(machine.find(node => node.type === 'Schedule').props.readOnly, true)
assert.ok(machine.filter(node => node.type === 'InlineField').every(node => node.props.readOnly), 'machine metadata/model remain setup-controlled')
imports['@/lib/hrProjectRegistry'].isHrFormalRecord = () => true
const formalMachine = elements(Detail({ ...machineProps, setupReadOnly: false }))
for (const label of ['品牌', '产品线', '市场名', '项目等级']) assert.equal(formalMachine.find(node => node.type === 'InlineField' && node.props.label === label).props.readOnly, true, `${label} retains formal source readonly`)
assert.equal(formalMachine.find(node => node.type === 'InlineField' && node.props.label === '人力模型版本号').props.readOnly, false)
imports['@/lib/hrProjectRegistry'].isHrFormalRecord = () => false
console.log('PASS detail labor/nonlabor/setup field separation and independent async import revalidation')

const renderDashboard = () => { hookCursor = 0; hooks = []; return elements(Dashboard({ project, category: 'capability', onOpenVersion: noop })) }
for (const change of ['revoke', 'switch', 'unlink', 'official']) {
  reset()
  const callback = button(renderDashboard(), '导出分析').props.onClick
  if (change === 'revoke') granted.delete('export')
  else if (change === 'switch') actor = 'other'
  else if (change === 'official') current.projects[0].versions = [{ ...current.projects[0].versions[0], isActive: false }]
  else current.projects[0].pmsProjectId = 'other'
  callback()
  assert.equal(exports.length, 0, `${change}: stale dashboard export denied`)
}
reset()
const exportDashboard = button(renderDashboard(), '导出分析').props.onClick
current.monthlyInvestments = [{ id: 'latest' }]
exportDashboard()
assert.equal(exports[0][1][0].rows, current.monthlyInvestments)
granted.delete('export')
assert.ok(!button(renderDashboard(), '导出分析'))
reset(); granted = new Set(['view'])
let navigation = Root({ project }); hookCursor = 0; hooks = []
assert.equal(navigation.type(navigation.props).type, 'Scope', 'resource:view alone grants root resource view')
granted.clear(); hookCursor = 0; hooks = []
assert.equal(navigation.type(navigation.props).type, 'Empty')
reset()
current.projects = []
imports['@/mock/resourceAccounting'].resourceAccountingDataset = () => ({ projectId: project.id, worklogs: [], expenses: [] })
imports['@/components/project-resources/resourceAccounting'].buildAccountingAnalysis = () => ({ months: ['2026-01'], worklogs: [], expenses: [], dataset: { startDate: '2026-01-01', endDate: '2026-01-31' } })
let actualOnlyButton = button(renderDashboard(), '导出分析')
assert.equal(actualOnlyButton.props.disabled, false, 'independent accounting can export when no budget source exists')
actualOnlyButton.props.onClick()
assert.equal(exports.length, 1)
granted.delete('export')
actualOnlyButton.props.onClick()
assert.equal(exports.length, 1, 'actual-only export still rechecks permission at execution')
console.log('PASS dashboard export execution authorization, source availability, fresh data and resource:view root gate')
