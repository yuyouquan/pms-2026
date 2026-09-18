import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
const require = createRequire(import.meta.url), load = createTypeScriptModuleLoader()
const refs = []; let refIndex = 0, saved = '软件部'
const modules = {
  react: { useEffect() {}, useId: () => 'field', useReducer: () => [0, () => {}], useRef: value => refs[refIndex++] ?? (refs[refIndex - 1] = { current: value }) },
  antd: { Button: 'Button', Tooltip: 'Tooltip' },
  '@ant-design/icons': { EditOutlined: 'EditOutlined' },
  '@/stores/ui': { useUiStore: { getState: () => ({ setIsEditMode() {} }) } },
  '@/components/project-resources/inlineFieldSession': load(path.resolve('src/components/project-resources/inlineFieldSession.ts')),
}
const mod = { exports: {} }
const code = ts.transpileModule(fs.readFileSync('src/components/project-resources/ResourceInlineField.tsx', 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText
new Function('require','module','exports',code)(id => modules[id] ?? require(id), mod, mod.exports)
const elements = node => !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(elements)]
const render = (readOnly=false) => { refIndex=0; return mod.exports.default({label:'二级部门', value:saved, readOnly, onSave:value=>{if(value==='invalid')throw Error('无效部门');saved=value},renderEditor:(value,change)=>({type:'Editor',props:{value,change}})}) }
let tree=render(), trigger=elements(tree).find(n=>n.type==='button')
assert.ok(trigger,'saved value must be wrapped by a native whole-field button')
assert.equal(trigger.props.type,'button')
assert.equal(trigger.props['aria-label'],'编辑二级部门')
assert.ok(elements(trigger).some(n=>n.props?.children==='软件部'),'the visible value itself is clickable')
assert.equal(elements(tree).some(n=>n.type==='EditOutlined'),false,'no trailing pencil')
trigger.props.onClick(); tree=render()
let editor=elements(tree).find(n=>n.type==='Editor'); assert.equal(editor.props.value,'软件部')
editor.props.change('硬件部')
tree.props.onBlur({relatedTarget:{}, currentTarget:{contains:()=>false}})
assert.equal(saved,'硬件部','blur persists the typed value')
tree=render(); elements(tree).find(n=>n.type==='button').props.onClick(); tree=render()
elements(tree).find(n=>n.type==='Editor').props.change('取消内容')
tree.props.onKeyDown({key:'Escape',preventDefault(){},stopPropagation(){}})
assert.equal(saved,'硬件部','Escape preserves saved value')
tree=render(); elements(tree).find(n=>n.type==='button').props.onClick(); tree=render()
elements(tree).find(n=>n.type==='Editor').props.change('invalid')
tree.props.onBlur({relatedTarget:{}, currentTarget:{contains:()=>false}})
tree=render(); assert.ok(elements(tree).find(n=>n.props?.role==='alert')); assert.equal(saved,'硬件部')
tree.props.onKeyDown({key:'Escape',preventDefault(){},stopPropagation(){}})
assert.equal(elements(render(true)).some(n=>n.type==='button'),false,'readonly saved cells have no edit trigger')
console.log('PASS whole-field component: value click, native keyboard trigger, blur save, Escape, validation and readonly')
