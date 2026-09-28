import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const source = readFileSync('src/components/permission-center/RoleAssignees.tsx', 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText

const hooks = []
let cursor = 0
const react = {
  useId: () => { const index = cursor++; return hooks[index] ??= 'test-id' },
  useState: initial => {
    const index = cursor++
    if (!(index in hooks)) hooks[index] = initial
    return [hooks[index], value => { hooks[index] = typeof value === 'function' ? value(hooks[index]) : value }]
  },
  useRef: initial => { const index = cursor++; return hooks[index] ??= { current: initial } },
}
const element = (type, props, key) => ({ type, props: props ?? {}, key })
let mutationCalls = 0
let failWrite = false
let lastAssignment
let liveRole
const dirtyChanges = []
const store = { usePermissionStore: { getState: () => ({
  permissionCenter: { roles: [liveRole] },
  setCenterRoleAssignees: (actor, id, assignment) => {
    mutationCalls++
    lastAssignment = assignment
    if (failWrite) return { ok: false, error: '模拟存储失败' }
    liveRole = { ...liveRole, members: assignment.users, departments: assignment.departments }
    return { ok: true }
  },
  setSuperAdminMembers: () => { throw new Error('unexpected superadmin mutation') },
}) } }
const modules = {
  react,
  'react/jsx-runtime': { jsx: element, jsxs: element },
  antd: { Alert: 'Alert', Button: 'Button', Tag: 'Tag', Select: 'Select' },
  '@/components/permission-center/AssigneePickerModal': { default: 'AssigneePickerModal', __esModule: true },
  '@ant-design/icons': { CheckCircleOutlined: 'CheckCircleOutlined' },
  '@/constants/permissionCenter': {
    PERMISSION_DEPARTMENTS: ['部门A'], PERMISSION_USERS: ['人员A', '人员B'],
    PERMISSION_USER_DEPARTMENTS: { 人员A: ['部门A'] }, SUPER_ADMIN_ROLE_ID: 'builtin:superadmin',
  },
  '@/lib/permissionCenter': { isPermissionCenterAdmin: () => true },
  '@/stores/permission': store,
  '@/components/permission-center/PermissionCenter.module.css': { default: new Proxy({}, { get: (_, key) => String(key) }) },
}
const loaded = { exports: {} }
new Function('require', 'module', 'exports', compiled)((name) => {
  if (!(name in modules)) throw new Error('Unexpected import: ' + name)
  return modules[name]
}, loaded, loaded.exports)
const RoleAssignees = loaded.exports.default
const role = { id: 'custom:role', name: '测试角色', members: ['人员A'], departments: [], groupId: 'group', description: '' }
liveRole = role
const props = { actor: '人员A', model: { roles: [role] }, conditionDirty: false, onDirtyChange: dirty => dirtyChanges.push(dirty) }
function render(dirty) {
  cursor = 0
  return RoleAssignees({ ...props, role: liveRole, conditionDirty: dirty })
}
function find(node, predicate) {
  if (!node || typeof node !== 'object') return undefined
  if (predicate(node)) return node
  const children = [node.props?.children, node.props?.action].flat(Infinity)
  for (const child of children) {
    const found = find(child, predicate)
    if (found) return found
  }
}

const config = (tree, name) => find(tree, node => node.type === 'Button' && node.props['aria-label'] === name)
const modal = tree => find(tree, node => node.type === 'AssigneePickerModal')
let tree = render(false)
assert.equal(find(tree, node => node.type === 'Select'), undefined, 'Main view must have no editable assignment selectors')
assert(config(tree, '配置授权人员'), 'People are configured through an explicit button')
config(tree, '配置授权人员').props.onClick()
assert.deepEqual(modal(render(false)).props.values, ['人员A'])
modal(render(false)).props.onChange(['人员A', '人员B'])
assert.equal(mutationCalls, 0, 'Selecting people only changes modal draft')
assert.equal(dirtyChanges.at(-1), true)
modal(render(false)).props.onCancel()
assert.equal(modal(render(false)), undefined)
assert.equal(mutationCalls, 0, 'Cancel must not mutate authorization')
assert.equal(dirtyChanges.at(-1), false)
config(render(false), '配置授权人员').props.onClick()
assert.deepEqual(modal(render(false)).props.values, ['人员A'], 'Cancelled draft is discarded on reopen')
modal(render(false)).props.onChange(['人员B'])
liveRole = { ...liveRole, departments: ['部门A'] }
modal(render(false)).props.onConfirm()
assert.equal(mutationCalls, 1)
assert.deepEqual(lastAssignment, { users: ['人员B'], departments: ['部门A'] }, 'Confirm preserves latest opposite field')
assert.equal(modal(render(false)), undefined, 'Success closes the modal')
assert.equal(dirtyChanges.at(-1), false)
assert.equal(find(render(false), node => node.type === 'Tag' && node.props.closable), undefined, 'Confirmed tags are read-only')

config(render(false), '配置授权部门').props.onClick()
assert.deepEqual(modal(render(false)).props.values, ['部门A'])
modal(render(false)).props.onChange([])
failWrite = true
modal(render(false)).props.onConfirm()
assert.equal(mutationCalls, 2)
assert(modal(render(false)).props.error.includes('模拟存储失败'))
assert.deepEqual(modal(render(false)).props.values, [], 'Failed confirm preserves draft for retry')
const retainedConfirm = modal(render(false)).props.onConfirm
render(true)
retainedConfirm()
assert.equal(mutationCalls, 2, 'Retained confirm cannot bypass a new incomplete data condition')
assert(modal(render(true)).props.error.includes('请先完成筛选条件'))
failWrite = false
modal(render(false)).props.onConfirm()
assert.equal(mutationCalls, 3)
assert.deepEqual(lastAssignment, { users: ['人员B'], departments: [] })
assert.equal(modal(render(false)), undefined)
console.log('PASS modal-only assignment drafts, cancellation, atomic confirm, latest field preservation, error retry, draft guard and read-only result')
