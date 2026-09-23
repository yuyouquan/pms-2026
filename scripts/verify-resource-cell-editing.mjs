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
let tree=render()
assert.ok(elements(tree).find(n=>n.type==='Editor'),'editable fields render inputs immediately without activation')
assert.equal(elements(tree).some(n=>n.type==='button'),false,'there is no click-to-edit trigger')
assert.equal(elements(tree).find(n=>n.type==='Editor').props.value,'软件部')
assert.equal(refs[0].current.state.editing,false,'rendering inputs does not create a dirty editing session')
tree.props.onFocusCapture(); tree=render()
let editor=elements(tree).find(n=>n.type==='Editor')
editor.props.change('硬件部')
tree.props.onBlur({relatedTarget:{}, currentTarget:{contains:()=>false}})
assert.equal(saved,'硬件部','blur persists the typed value')
tree=render(); assert.ok(elements(tree).find(n=>n.type==='Editor'),'saved input remains visible')
tree.props.onFocusCapture(); tree=render()
elements(tree).find(n=>n.type==='Editor').props.change('取消内容')
tree.props.onKeyDown({key:'Escape',preventDefault(){},stopPropagation(){}})
assert.equal(saved,'硬件部','Escape preserves saved value')
tree=render(); assert.equal(elements(tree).find(n=>n.type==='Editor').props.value,'硬件部','cancel restores the input')
const resetBefore=refs[0].current.state.revision
tree.props.onFocusCapture(); tree=render()
elements(tree).find(n=>n.type==='Editor').props.change('invalid')
tree.props.onBlur({relatedTarget:{}, currentTarget:{contains:()=>false}})
tree=render(); assert.ok(elements(tree).find(n=>n.props?.role==='alert')); assert.equal(saved,'硬件部')
assert.equal(refs[0].current.state.revision,resetBefore,'failed save retains editor and typed data')
tree.props.onKeyDown({key:'Escape',preventDefault(){},stopPropagation(){}})
assert.ok(refs[0].current.state.revision>resetBefore,'cancel resets uncontrolled date editors too')
assert.equal(elements(render(true)).some(n=>n.type==='Editor'),false,'readonly fields contain no editable controls')
saved='同步值'; tree=render()
assert.equal(elements(tree).find(n=>n.type==='Editor').props.value,'同步值','idle input follows saved data updates')
console.log('PASS always-visible fields: initial input, clean mount, blur save, Escape reset, validation and readonly')

// Keyboard blur may move to B while A retains an invalid draft. B finishing must not clear A's guard.
let activeInstance, hook = 0, isEditMode = false
const instances = { A: { id: 'A', refs: [], effects: [] }, B: { id: 'B', refs: [], effects: [] } }
const lifecycleReact = {
  useId: () => activeInstance.id,
  useReducer: () => [0, () => {}],
  useRef: value => { const i=hook++; return activeInstance.refs[i] ?? (activeInstance.refs[i]={current:value}) },
  useEffect: (run,deps) => {
    const i=hook++, previous=activeInstance.effects[i]
    if (!previous || deps.some((dep,j)=>dep!==previous.deps[j])) {
      previous?.cleanup?.(); activeInstance.effects[i]={deps,cleanup:run()}
    }
  },
}
const lifecycleModules = {...modules, react:lifecycleReact, '@/stores/ui':{useUiStore:{getState:()=>({setIsEditMode(value){isEditMode=value}})}}}
const lifecycleMod={exports:{}}
const previousDocument=globalThis.document
globalThis.document={addEventListener(){},removeEventListener(){}}
try {
  new Function('require','module','exports',code)(id=>lifecycleModules[id]??require(id),lifecycleMod,lifecycleMod.exports)
  const renderField=id=>{
    activeInstance=instances[id];hook=0
    return lifecycleMod.exports.default({label:id,value:'saved',onSave:value=>{if(value==='invalid')throw Error('invalid date')},renderEditor:(value,change)=>({type:'Editor',props:{value,change}})})
  }
  let A=renderField('A'), B=renderField('B')
  A.props.onFocusCapture(); A=renderField('A')
  assert.equal(isEditMode,false,'focusing unchanged resource input does not create an unsaved draft')
  elements(A).find(n=>n.type==='Editor').props.change('invalid'); A=renderField('A')
  A.props.onBlur({relatedTarget:{},currentTarget:{contains:()=>false}}); A=renderField('A')
  B.props.onFocusCapture(); B=renderField('B')
  B.props.onKeyDown({key:'Escape',preventDefault(){},stopPropagation(){}}); B=renderField('B')
  assert.equal(instances.A.refs[0].current.state.editing,true)
  assert.equal(instances.A.refs[0].current.state.error,'invalid date')
  assert.equal(isEditMode,true,'cancelling B preserves the guard for invalid A')
  B.props.onFocusCapture(); B=renderField('B')
  elements(B).find(n=>n.type==='Editor').props.change('valid')
  B.props.onBlur({relatedTarget:{},currentTarget:{contains:()=>false}}); B=renderField('B')
  assert.equal(isEditMode,true,'saving B also preserves the guard for invalid A')
  A.props.onKeyDown({key:'Escape',preventDefault(){},stopPropagation(){}}); renderField('A')
  assert.equal(isEditMode,false,'finishing the last field releases the guard')
  A=renderField('A'); A.props.onFocusCapture(); A=renderField('A')
  elements(A).find(n=>n.type==='Editor').props.change('valid')
  assert.equal(isEditMode,true,'changed field is guarded immediately')
  A.props.onBlur({relatedTarget:{},currentTarget:{contains:()=>false}})
  assert.equal(isEditMode,false,'successful autosave clears guard synchronously before navigation or rerender')
} finally { globalThis.document=previousDocument }
console.log('PASS multiple field sessions preserve unsaved guards until the final draft is finished')
