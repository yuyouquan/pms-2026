import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import ts from 'typescript'
import {createTypeScriptModuleLoader} from './lib/typescript-module-loader.mjs'
import {createCurrentDatasetStorage} from './lib/mock-dataset-storage.mjs'
const require=createRequire(import.meta.url), load=createTypeScriptModuleLoader()
globalThis.localStorage=createCurrentDatasetStorage(); globalThis.window={localStorage}
const plan=load(path.resolve('src/stores/plan.ts')), rules=load(path.resolve('src/lib/technicalPlanRules.ts'))
const store=plan.usePlanStore
const noop=()=>{}, ui={configTab:'plan',selectedProjectType:'整机产品项目',isEditMode:true,showColumnModal:false}
let allowed=true
const useUiStore=()=>ui; useUiStore.getState=()=>ui
const useProjectStore=()=>({currentLoginUser:'演示用户01'})
const React={useState:v=>[v,noop],useMemo:fn=>fn(),useEffect:noop}
const Antd=new Proxy({Form:Object.assign(function Form(){},{Item:'FormItem'}),Select:Object.assign(function Select(){},{Option:'Option'}),message:{success:noop,error:noop}}, {get:(t,k)=>t[k]??String(k)})
const mocks={react:React,antd:Antd,'@ant-design/icons':new Proxy({}, {get:(_,k)=>String(k)}),'@dnd-kit/core':{DndContext:'DndContext',useSensors:noop,useSensor:noop},'@dnd-kit/sortable':{SortableContext:'SortableContext'},'@/stores/ui':{useUiStore},'@/stores/plan':{...plan,usePlanStore:()=>store.getState()},'@/stores/project':{useProjectStore},'@/stores/permission':{useHasGlobalPermission:()=>()=>allowed},'@/stores/transfer':{useTransferStore:()=>({})},'@/stores/enums':{useEnumStore:fn=>fn({selectedType:'',setSelectedType:noop})},'@/components/shared/PlanHelpers':{DragHandle:'DragHandle',getTaskDepth:t=>t.parentId?1:0,hasChildren:(id,tasks)=>tasks.some(t=>t.parentId===id),filterByCollapsed:(tasks,collapsed)=>tasks.filter(t=>!collapsed.has(t.parentId)),NOTIFY_DIFF_FIELDS:[],MOCK_USER_MAP:{}}}
const source=fs.readFileSync('src/containers/ConfigContainer.tsx','utf8')
const module={exports:{}}
const output=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText
new Function('require','module','exports',output)(id=> {
 if(mocks[id])return mocks[id]
 if(id.startsWith('@/components/'))return new Proxy({__esModule:true,default:id},{get:(t,k)=>t[k]??String(k)})
 if(id.startsWith('@/'))return load(path.resolve('src',id.slice(2)+'.ts'))
 return require(id)
},module,module.exports)
const walk=node=>!node||typeof node!=='object'?[]:[node,...[node.props?.children,node.props?.content].flat(Infinity).flatMap(walk)]
const render=()=>walk(module.exports.default())
const table=all=>all.find(n=>n.type==='Table' && n.props.className?.includes('pms-table'))
const initial=[{id:'1',taskName:'阶段A'},{id:'1.1',parentId:'1',taskName:'里程碑A',intervalDays:10},{id:'2',taskName:'阶段B'},{id:'2.1',parentId:'2',taskName:'里程碑B',intervalDays:30}]
for(const [type,level,key] of [['整机产品项目','level1','整机产品项目'],['技术项目','tdt',rules.TECHNICAL_TEMPLATE_STORAGE_KEYS.tdt]]) {
 ui.selectedProjectType=type; ui.isEditMode=true
 const scope=rules.getTemplateConfigScopeKey(type,level)
 store.setState({planLevel:level,viewMode:'table',searchText:'',configTemplateTasksByType:{...store.getState().configTemplateTasksByType,[key]:structuredClone(initial)},configTemplateVersionScopes:{...store.getState().configTemplateVersionScopes,[scope]:{versions:[{id:'pub',versionNo:'V1',status:'已发布'},{id:'draft',versionNo:'V2',status:'修订中'}],currentVersion:'draft'}}})
 store.getState().setPublishedSnapshots(prev=>({...prev,[plan.getTemplateSnapshotKey(type,'pub',level)]:initial.map(t=>({...t,intervalDays:t.parentId?5:undefined}))}))
 let all=render(),t=table(all)
 assert.deepEqual(t.props.columns.filter(c=>c.key!=='action').map(c=>c.key),['id','taskName','intervalDays','intervalRatio'])
 const col=t.props.columns.find(c=>c.key==='intervalDays')
 assert.equal(col.render(null,initial[0]).type,'span','stage cannot be edited')
 col.render(null,initial[1]).props.onChange(30)
 all=render();t=table(all)
 assert.equal(t.props.columns.find(c=>c.key==='intervalRatio').render(null,initial[1]),'50.00%')
 assert.equal(all.find(n=>n.props?.['aria-label']==='模板总周期').props.children[1].props.children,60)
 store.getState().setSearchText('里程碑A');all=render()
 assert.equal(table(all).props.dataSource.length,1)
 assert.equal(all.find(n=>n.props?.['aria-label']==='模板总周期').props.children[1].props.children,60,'search never changes denominator')
 store.getState().setSearchText('')
 store.getState().setConfigTemplateCurrentVersion(scope,'pub');ui.isEditMode=false
 all=render();t=table(all)
 assert.equal(all.find(n=>n.props?.['aria-label']==='模板总周期').props.children[1].props.children,10,'published view uses its own snapshot')
 assert.equal(t.props.columns.find(c=>c.key==='intervalDays').render(null,initial[1]).type,'span')
 // Finish the draft, then create a new revision from this selected published template.
 store.getState().setConfigTemplateVersions(scope,[{id:'pub',versionNo:'V1',status:'已发布'}])
 all=render();all.find(n=>n.type==='Dropdown'&&n.props.menu?.onClick).props.menu.onClick({key:'formal'})
 assert.equal(store.getState().configTemplateTasksByType[key].find(t=>t.parentId).intervalDays,5,'new revision inherits configured interval')
 ui.isEditMode=true;allowed=false
 t=table(render())
 assert.equal(t.props.columns.find(c=>c.key==='intervalDays').render(null,initial[1]).type,'span','RBAC wins even when global edit mode was true')
 allowed=true
 // A published version without a stored snapshot must not borrow the current draft.
 store.getState().setConfigTemplateVersions(scope,[{id:'missing',versionNo:'V0',status:'已发布'}])
 store.getState().setConfigTemplateCurrentVersion(scope,'missing');ui.isEditMode=false
 all=render()
 assert.equal(table(all).props.dataSource.length,0,'missing published snapshots cannot display another version')
 all.find(n=>n.type==='Dropdown'&&n.props.menu?.onClick).props.menu.onClick({key:'formal'})
 assert.equal(store.getState().configTemplateTasksByType[key].length,0,'empty template revisions stay empty rather than receiving unrelated defaults')
 console.log(`PASS actual ${level} UI handlers: editable children, totals, search, snapshot, revision inheritance, permission`)
}
