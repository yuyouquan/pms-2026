import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
const require = createRequire(import.meta.url)
let state, cursor
const modules = {
  react: { useState: initial => { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value }] } },
  antd: Object.fromEntries(['Button', 'Empty', 'Input', 'Modal', 'Pagination', 'Select', 'Tag'].map(name => [name, name])),
  '@ant-design/icons': new Proxy({}, { get: (_, key) => String(key) }),
}
const module = { exports: {} }
const output = ts.transpileModule(fs.readFileSync('src/components/project-resources/ResourceOperationLogDialog.tsx', 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText
new Function('require', 'module', 'exports', output)(id => modules[id] ?? require(id), module, module.exports)
function renderer(component, props) {
  const values = []
  return () => { state = values; cursor = 0; return component(props) }
}
function elements(node) { return node && typeof node === 'object' ? [node, ...[node.props?.children].flat(Infinity).flatMap(elements)] : [] }
function text(node) { return node == null ? '' : typeof node !== 'object' ? String(node) : [node.props?.children].flat(Infinity).map(text).join('') }
const logs = Array.from({ length: 12 }, (_, index) => ({ id: `log-${index}`, versionId: index < 6 ? 'a' : 'b', versionNumber: index < 6 ? 'V0.1' : 'V0.2',
  action: '修改版本', operator: index === 2 ? '测试操作人' : '演示用户01', timestamp: `2026-09-${String(index + 1).padStart(2, '0')}T08:30:00Z`,
  changes: [{ field: '预估投入', before: '0', after: String(index + 1) }], budgetType: 'annual' }))
const original = JSON.stringify(logs)
const render = renderer(module.exports.default, { logs, budgetLabel: '年度预算', onCancel() {} })
const entries = tree => elements(tree).filter(node => node.type?.name === 'LogEntry')
let tree = render()
assert.equal(entries(tree).length, 10)
assert.equal(entries(tree)[0].props.log.id, 'log-11', 'latest operations first')
elements(tree).find(node => node.type === 'Pagination').props.onChange(2)
tree = render()
assert.equal(entries(tree).length, 2)
elements(tree).find(node => node.type === 'Input').props.onChange({ target: { value: '测试操作人' } })
tree = render()
assert.equal(entries(tree).length, 1, 'search resets pagination and filters operator')
assert.equal(entries(tree)[0].props.log.id, 'log-2')
elements(tree).find(node => node.type === 'Input').props.onChange({ target: { value: '不存在的字段' } })
tree = render()
assert.equal(entries(tree).length, 0)
elements(tree).find(node => node.type === 'Button' && text(node) === '重置筛选').props.onClick()
tree = render()
assert.equal(entries(tree).length, 10)
elements(tree).find(node => node.type === 'Select').props.onChange('a')
assert.equal(entries(render()).length, 6)
const scoped = renderer(module.exports.default, { logs, versionId: 'b', onCancel() {} })
assert.ok(entries(scoped()).every(node => node.props.log.versionId === 'b'), 'version-level entry opens its own history')
const entryType = entries(render())[0].type
const longLog = { ...logs[0], changes: [{ field: '金额', before: '0', after: '' }, ...Array.from({ length: 5 }, (_, i) => ({ field: `字段${i}`, before: '长文本'.repeat(20), after: `新值${i}` }))] }
const renderEntry = renderer(entryType, { log: longLog })
let detail = renderEntry()
assert.equal(elements(detail).filter(node => node.type === 'tbody')[0].props.children.length, 3)
assert.ok(text(detail).includes('0未填写'), 'zero is not treated as missing')
elements(detail).find(node => node.type === 'Button').props.onClick()
detail = renderEntry()
assert.equal(elements(detail).filter(node => node.type === 'tbody')[0].props.children.length, 6, 'expansion exposes all original field values')
assert.equal(JSON.stringify(logs), original, 'viewing/filtering audit never mutates history')
console.log('PASS audit dialog: scope, chronological paging, search/reset, expanded detail, zero/empty values, readonly history')
