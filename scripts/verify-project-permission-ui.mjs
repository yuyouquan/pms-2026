import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
import { loadTypeScriptModule } from './lib/source-contract.mjs'
let hooks = [], cursor = 0
const element = (type, props, key) => ({ type, props: props ?? {}, key })
const react = { Fragment: 'Fragment', useRef: value => ({ current: value }), useState: initial => {
  const index = cursor++
  if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial
  return [hooks[index], next => { hooks[index] = typeof next === 'function' ? next(hooks[index]) : next }]
} }
const components = Object.fromEntries(['Alert', 'Button', 'Tag', 'Tooltip', 'Checkbox', 'Empty', 'Input'].map(name => [name, name]))
const style = { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) }
function load(file, extraModules = {}) {
  const modules = {
    ...extraModules, react, 'react/jsx-runtime': { jsx: element, jsxs: element }, antd: components,
    '@ant-design/icons': { DownOutlined: 'DownOutlined', RightOutlined: 'RightOutlined', SearchOutlined: 'SearchOutlined' },
    '@/components/permission-center/AssigneePickerModal': { __esModule: true, default: 'Picker' },
    '@/components/permission-center/PermissionCenter.module.css': style,
    '@/components/permission-center/FunctionalPermissionsTable.module.css': style,
    '@/components/permission/projectPermissionCatalog': loadTypeScriptModule(process.cwd(), 'src/components/permission/projectPermissionCatalog.ts'),
  }
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)(name => {
    assert(name in modules, `unexpected import ${name}`); return modules[name]
  }, module, module.exports)
  return module.exports.default
}
const nodes = root => !root || typeof root !== 'object' ? [] : [root, ...[root.props?.children].flat(Infinity).flatMap(nodes)]
const find = (tree, type, label) => nodes(tree).find(node => node.type === type && (!label || node.props['aria-label'] === label))
const Assignees = load('src/components/permission/ProjectRoleAssignees.tsx')
let calls = [], dirty = false, fail = false
let role = { name: '测试角色', members: ['演示用户02'], departments: ['测试部'], isFixed: false }
const props = { role, onCommit: (kind, values) => {
  calls.push({ kind, values }); return fail ? { ok: false, error: '保存失败' } : { ok: true }
}, onDirtyChange: value => { dirty = value } }
const render = extra => { cursor = 0; return Assignees({ ...props, ...extra }) }
find(render(), 'Button', '配置授权部门').props.onClick()
find(render(), 'Picker').props.onChange(['研发部'])
assert.equal(calls.length, 0, 'Selecting is only a draft')
assert(dirty)
find(render(), 'Picker').props.onCancel()
assert.equal(calls.length, 0)
assert(!dirty)
find(render(), 'Button', '配置授权部门').props.onClick()
assert.deepEqual(find(render(), 'Picker').props.values, ['测试部'], 'Cancel discards values')
find(render(), 'Picker').props.onChange(['研发部'])
fail = true
find(render(), 'Picker').props.onConfirm()
assert.equal(find(render(), 'Picker').props.error, '保存失败')
assert(dirty, 'Failure retains draft for retry')
fail = false
find(render(), 'Picker').props.onConfirm()
assert.equal(find(render(), 'Picker'), undefined)
assert.deepEqual(calls.at(-1), { kind: 'departments', values: ['研发部'] }, 'Only the edited kind is committed, avoiding lost opposite-field updates')
assert(!dirty)
assert(nodes(render()).filter(node => node.type === 'Tag').every(node => !node.props.closable), 'Confirmed values read only')
assert.equal(find(render({ memberSource: '团队同步' }), 'Button', '配置授权人员').props.disabled, true)
assert.equal(find(render({ memberSource: '团队同步' }), 'Button', '配置授权部门').props.disabled, false)
assert.equal(find(render({ disabled: true }), 'Button', '配置授权部门').props.disabled, true)

hooks = []; cursor = 0
const Functional = load('src/components/permission/ProjectFunctionalPermissions.tsx')
const changes = []
const functional = extra => { cursor = 0; return Functional({ project: { type: '整机产品项目', projectAttribute: 'formal' }, grants: { 'basicInfo:查看': true }, disabled: false, onChange: (...args) => changes.push(args), onBulkChange: (...args) => changes.push(['bulk', ...args]), ...extra }) }
let tree = functional()
assert.equal(nodes(tree).filter(node => node.type === 'th' && node.props.scope === 'col').length, 2)
assert.equal(find(tree, 'Checkbox', '基本信息：查看').props.checked, true)
find(tree, 'Checkbox', '基本信息：查看').props.onChange({ target: { checked: false } })
assert.deepEqual(changes, [['basicInfo:查看', false]], 'Checkbox emits actual permission key immediately')
find(tree, 'button', '收起基础信息功能').props.onClick()
assert.equal(find(functional(), 'Checkbox', '基本信息：查看'), undefined)
find(functional(), 'Input', '搜索项目功能').props.onChange({ target: { value: '基本信息' } })
assert(find(functional(), 'Checkbox', '基本信息：查看'), 'Search expands matching collapsed module')
assert.equal(find(functional(), 'Checkbox', '二级计划：查看'), undefined)
assert.equal(find(functional(), 'Checkbox', '转维信息：查看'), undefined, 'search hides unrelated descendants')
find(functional(), 'Checkbox', '基础信息全部权限').props.onChange({ target: { checked: true } })
assert.equal(changes.at(-1)[0], 'bulk')
assert(changes.at(-1)[1].includes('basicInfo:applyTransfer'), 'parent bulk includes descendants hidden by search')
find(functional(), 'Checkbox', '基本信息全部权限').props.onChange({ target: { checked: true } })
assert.deepEqual(changes.at(-1), ['bulk', ['basicInfo:查看', 'basicInfo:编辑'], true], 'leaf bulk affects only its own keys')
console.log('PASS project role UI: confirmation/cancel/retry/read-only/source locks and compact functional interaction')

const leafBulk = extra => find(functional(extra), 'Checkbox', '基本信息全部权限')
assert.equal(leafBulk().props.checked, false)
assert.equal(leafBulk().props.indeterminate, true, 'partial selection uses mixed state')
assert.equal(leafBulk({ grants: {} }).props.indeterminate, false)
assert.equal(leafBulk({ grants: { 'basicInfo:查看': true, 'basicInfo:编辑': true } }).props.checked, true)
leafBulk().props.onChange({ target: { checked: false } })
assert.deepEqual(changes.at(-1), ['bulk', ['basicInfo:查看', 'basicInfo:编辑'], false], 'unchecking clears the leaf atomically')
assert.equal(leafBulk({ disabled: true }).props.disabled, true)
assert.equal(leafBulk({ onBulkChange: undefined }).props.disabled, true)
assert.equal(nodes(functional()).some(node => node.type === 'Button' && ['全选', '取消权限'].includes(node.props.children)), false)
console.log('PASS project/template bulk checkboxes: none/mixed/all, clear, full subtree under search, readonly')

hooks = []; cursor = 0
const permissionLib = loadTypeScriptModule(process.cwd(), 'src/lib/permissionCenter.ts')
const constants = loadTypeScriptModule(process.cwd(), 'src/constants/permissionCenter.ts')
const menuTree = loadTypeScriptModule(process.cwd(), 'src/components/permission-center/menuTree.ts')
const bulkWrites = []
const Matrix = load('src/components/permission-center/FunctionalMatrix.tsx', {
  '@/constants/permissionCenter': constants,
  '@/lib/permissionCenter': permissionLib,
  '@/components/permission-center/menuTree': menuTree,
  '@/stores/project': { useProjectStore: { getState: () => ({ currentLoginUser: 'admin' }) } },
  '@/stores/permission': { usePermissionStore: { getState: () => ({ updateMenuActionsBulk: (...args) => { bulkWrites.push(args); return { ok: true } } }) } },
})
const globalRole = { id: 'test', name: 'Test', groupId: 'test', description: '', members: ['演示用户02'], departments: [] }
const globalModel = { version: 2, groups: [{ id: 'test', name: 'Test' }], roles: [globalRole], policies: [{ ...permissionLib.createEmptyMenuPolicy('test', 'project.view'), actions: ['view'] }] }
const matrix = extra => { cursor = 0; return Matrix({ model: globalModel, role: globalRole, actor: 'admin', ...extra }) }
assert.equal(find(matrix(), 'Checkbox', '项目管理全部权限').props.indeterminate, true)
assert.equal(find(matrix(), 'Checkbox', '项目管理 / 项目视图全部权限').props.indeterminate, true)
find(matrix(), 'Input', '搜索功能菜单').props.onChange({ target: { value: '项目视图' } })
find(matrix(), 'Checkbox', '项目管理全部权限').props.onChange({ target: { checked: true } })
assert.deepEqual(bulkWrites.at(-1)[2].map(menu => menu.menuId), ['project.view', 'project.config'], 'global search preserves entire parent subtree')
find(matrix(), 'Checkbox', '项目管理 / 项目视图全部权限').props.onChange({ target: { checked: false } })
assert.deepEqual(bulkWrites.at(-1)[2].map(menu => menu.menuId), ['project.view'])
assert.equal(bulkWrites.at(-1)[3], false)
const fullPolicies = ['project.view', 'project.config'].map(menuId => ({ ...permissionLib.createEmptyMenuPolicy('test', menuId), actions: constants.PERMISSION_MENUS.find(menu => menu.id === menuId).actions }))
assert.equal(find(matrix({ model: { ...globalModel, policies: fullPolicies } }), 'Checkbox', '项目管理全部权限').props.checked, true)
assert.equal(find(matrix({ model: { ...globalModel, policies: [] } }), 'Checkbox', '项目管理全部权限').props.indeterminate, false)
assert.equal(find(matrix({ person: '演示用户02', role: undefined }), 'Checkbox', '项目管理全部权限').props.disabled, true)
assert.equal(find(matrix({ person: '演示用户02', role: undefined }), 'Checkbox', '项目管理全部权限').props.indeterminate, true)
assert.equal(find(matrix({ role: { ...globalRole, id: constants.SUPER_ADMIN_ROLE_ID, builtin: 'superadmin' } }), 'Checkbox', '项目管理全部权限').props.checked, true)
assert.equal(find(matrix({ conditionDirty: true }), 'Checkbox', '项目管理全部权限').props.disabled, true)
console.log('PASS global bulk checkboxes: none/mixed/all, parent search, atomic leaf clear, effective readonly and superadmin')
