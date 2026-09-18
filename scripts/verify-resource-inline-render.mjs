import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
const require = createRequire(import.meta.url)
let selected, serial = 1
const version = id => ({ id, versionNumber: `V0.${id}`, budgetType: 'projectEstimate', minorVersion: Number(id), lockState: 'unlocked', isActive: false, estimatedInvestment: 10, createdAt: '2026-01-01' })
const owner = { id: 'resource', pmsProjectId: 'p', versions: [version('1')] }
const store = { projects: [owner], monthlyInvestments: [], createVersionInline: () => { const id = String(++serial); owner.versions.push(version(id)); return id } }
const ui = { navigateWithEditGuard: fn => fn() }
const noop = () => {}
const modules = {
  react: { useEffect: noop, useState: () => [selected, value => { selected = value }] },
  antd: { App: { useApp: () => ({ message: { success: noop, warning: noop } }) }, Alert: 'Alert', Button: 'Button', Empty: 'Empty', Popconfirm: 'Popconfirm', Select: 'Select', Space: 'Space', Tabs: 'Tabs', Tag: 'Tag', Tooltip: 'Tooltip' },
  '@ant-design/icons': new Proxy({}, { get: (_, key) => String(key) }),
  '@/stores/project': { useProjectStore: noop }, '@/stores/permission': { usePermissionStore: noop }, '@/stores/ui': { useUiStore: { getState: () => ui } },
  '@/lib/hrVersionRules': { canCreateHrVersion: () => true, getActiveHrVersion: () => undefined, HR_BATCH_OPTIONS: [], isHrVersionEditable: () => true, formatHrBatch: String },
  '@/lib/hrProjectRegistry': { canEditHrInScope: () => true, getHrAllowedBudgetTypes: () => ['projectEstimate'], isHrVersionVisible: () => true },
  '@/types/projectRegistry': { getProjectAttribute: () => 'formal' },
  '@/constants/hrMachine': { BUDGET_TYPE_LABELS: { projectEstimate: '项目概算' }, formatPersonMonth: String },
  '@/components/project-resources/resourceVersionViewData': { chooseResourceVersion: (versions, id) => versions.find(v => v.id === id) ?? versions[0] },
  '@/components/project-resources/resourceVersionAdapter': { resourceStore: () => ({ getState: () => store }), useResourceStore: () => store, resourceProjectName: () => 'Project' },
  '@/components/project-resources/HrSourceLink': { default: 'SourceLink' },
  '@/components/project-resources/ResourceVersionViews': { default: 'Monthly' },
  '@/components/project-resources/ResourceInlineDetail': { default: 'Detail' },
  '@/components/project-resources/ResourceInlineField': { default: 'Field' },
  '@/components/project-resources/exportResourceVersion': { exportResourceVersion: noop },
}
for (const value of Object.values(modules)) if (value && Object.hasOwn(value, 'default')) value.__esModule = true
const module = { exports: {} }
const output = ts.transpileModule(fs.readFileSync('src/components/project-resources/ResourceVersionWorkspace.tsx', 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText
new Function('require', 'module', 'exports', output)(id => modules[id] ?? require(id), module, module.exports)
const render = () => module.exports.default({ project: { id: 'p' }, category: 'technical', budgetType: 'projectEstimate' })
function children(node) { return [node?.props?.children].flat(Infinity).filter(value => value && typeof value === 'object') }
function elements(node) { return [node, ...children(node).flatMap(elements)] }
function validate(tree) {
  for (const node of elements(tree)) {
    const keys = children(node).map(child => child.key).filter(key => key != null)
    assert.equal(new Set(keys).size, keys.length, 'siblings must have distinct keys across detail and monthly views')
  }
  const all = elements(tree)
  assert.equal(all.filter(node => node.type === 'Detail').length, 1)
  assert.equal(all.filter(node => node.type === 'Monthly').length, 1)
  assert.equal(all.find(node => node.type === 'Detail').props.version.id, selected ?? '1')
  return all
}
let all = validate(render())
for (let i = 0; i < 3; i++) {
  all.find(node => node.type === 'Button' && node.props.children === '新建版本').props.onClick()
  all = validate(render())
  assert.equal(owner.versions.length, i + 2)
}
all.find(node => node.type === 'Tabs').props.onChange('1')
validate(render())
console.log('PASS actual workspace element tree: create/select renders one detail and one monthly view with distinct sibling identities')

owner.versions[0].isActive = true
owner.versions[0].lockState = 'locked'
const tabs = elements(render()).find(node => node.type === 'Tabs').props.items
const activeTab = tabs.find(tab => tab.key === '1')
const activeNodes = elements(activeTab.label)
assert.ok(activeNodes.some(node => node.type === 'CheckCircleOutlined' && node.props['aria-label'] === '已激活'))
assert.ok(activeNodes.some(node => node.type === 'LockOutlined' && node.props['aria-label'] === '已锁定'))
assert.equal(activeNodes.some(node => node.type === 'Tag'),false,'statuses are icons rather than text badges')
const inactiveNodes = elements(tabs.find(tab => tab.key !== '1').label)
assert.equal(inactiveNodes.some(node => node.type === 'CheckCircleOutlined'),false,'inactive versions have no activation marker')
assert.ok(inactiveNodes.some(node => node.type === 'UnlockOutlined' && node.props['aria-label'] === '未锁定'))
assert.equal(inactiveNodes.some(node => node.props?.children === '未激活'),false)
assert.ok(activeNodes.some(node => node.type === 'Tooltip' && node.props.title === '已激活'))
assert.ok(inactiveNodes.some(node => node.type === 'Tooltip' && node.props.title === '未锁定'))
console.log('PASS actual version tabs: active-only icon, lock/unlock icons and accessible tooltip labels')
