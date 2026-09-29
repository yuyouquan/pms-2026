import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
import { loadTypeScriptModule } from './lib/source-contract.mjs'
let hooks = [], cursor = 0
const element = (type, props, key) => ({ type, props: props ?? {}, key })
const react = { Fragment: 'Fragment', useState: initial => {
  const index = cursor++
  if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial
  return [hooks[index], next => { hooks[index] = typeof next === 'function' ? next(hooks[index]) : next }]
} }
const components = Object.fromEntries(['Button', 'Tag', 'Checkbox', 'Empty', 'Input'].map(name => [name, name]))
const style = { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) }
function load(file) {
  const modules = {
    react, 'react/jsx-runtime': { jsx: element, jsxs: element }, antd: components,
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

hooks = []; cursor = 0
const Functional = load('src/components/permission/ProjectFunctionalPermissions.tsx')
const changes = []
const functional = extra => { cursor = 0; return Functional({ project: { type: '整机产品项目', projectAttribute: 'formal' }, grants: { 'basicInfo:查看': true }, disabled: false, onChange: (...args) => changes.push(args), ...extra }) }
let tree = functional()
assert.equal(nodes(tree).filter(node => node.type === 'th' && node.props.scope === 'col').length, 2)
assert.equal(find(tree, 'Checkbox', '基本信息：查看').props.checked, true)
find(tree, 'Checkbox', '基本信息：查看').props.onChange({ target: { checked: false } })
assert.deepEqual(changes, [['basicInfo:查看', false]], 'Checkbox emits actual permission key immediately')
find(tree, 'button', '收起基础信息功能').props.onClick()
assert.equal(find(functional(), 'Checkbox', '基本信息：查看'), undefined)
find(functional(), 'Input', '搜索项目功能').props.onChange({ target: { value: '基础信息' } })
assert(find(functional(), 'Checkbox', '基本信息：查看'), 'Search expands matching collapsed module')
assert.equal(find(functional(), 'Checkbox', '二级计划：查看'), undefined)
console.log('PASS project role UI: confirmation/cancel/retry/read-only/source locks and compact functional interaction')
