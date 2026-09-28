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
const store = { usePermissionStore: { getState: () => ({
  setCenterRoleAssignees: () => {
    mutationCalls++
    return mutationCalls === 1 ? { ok: false, error: '模拟存储失败' } : { ok: true }
  },
  setSuperAdminMembers: () => { throw new Error('unexpected superadmin mutation') },
}) } }
const modules = {
  react,
  'react/jsx-runtime': { jsx: element, jsxs: element },
  antd: { Alert: 'Alert', Button: 'Button', Select: 'Select' },
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
const props = { actor: '人员A', model: { roles: [role] }, role, conditionDirty: false }
function render(dirty) {
  cursor = 0
  return RoleAssignees({ ...props, conditionDirty: dirty })
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

let tree = render(false)
const userSelector = find(tree, node => node.type === 'Select' && node.props['aria-label'] === '授权人员')
assert(userSelector, 'actual personnel selector must render')
userSelector.props.onChange(['人员A', '人员B'])
assert.equal(mutationCalls, 1, 'initial assignment write attempted once')

tree = render(false)
assert(find(tree, node => node.type === 'Alert')?.props.message.includes('模拟存储失败'), 'storage error must remain visible')
tree = render(true)
const retryDuringDraft = find(tree, node => node.type === 'Alert').props.action
assert.equal(retryDuringDraft.props.disabled, true, 'retry affordance is disabled while condition is incomplete')
retryDuringDraft.props.onClick()
assert.equal(mutationCalls, 1, 'even a retained retry callback cannot write during incomplete condition')
assert(find(render(true), node => node.type === 'Alert')?.props.message.includes('请先完成筛选条件'), 'guard explains why retry was rejected')

tree = render(false)
const retryAfterDraft = find(tree, node => node.type === 'Alert').props.action
assert.equal(retryAfterDraft.props.disabled, false)
retryAfterDraft.props.onClick()
assert.equal(mutationCalls, 2, 'retry writes once after condition is resolved or discarded')
assert.equal(find(render(false), node => node.type === 'Alert'), undefined, 'successful retry clears the error')
console.log('PASS assignment retry honors current condition draft and resumes after resolution')
