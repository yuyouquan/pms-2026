import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'
globalThis.localStorage=createCurrentDatasetStorage(); globalThis.window={localStorage}
let captured
const cache=new Map([[path.resolve('src/utils/exportExcel.ts'),{exports:{exportTimestamp:()=> 'review',exportMultiSheet:(sheets,filename)=>{captured={sheets,filename}}}}]])
const load=createTypeScriptModuleLoader(cache), get=f=>load(path.resolve(f))
const reg=get('src/lib/hrProjectRegistry.ts')
const config=get('src/stores/hrConfig.ts').useHrConfigStore
const configBefore=structuredClone(config.getState().data)
const machine=get('src/stores/hrMachine.ts').useHrMachineStore
machine.getState().refreshFormalProjects()
const p=machine.getState().projects.find(p=>reg.canAccessHrProject(p,true)&&p.versions.some(v=>v.modelSnapshot?.length&&v.estimatedInvestment>0))
const v=p.versions.find(v=>v.modelSnapshot?.length&&v.estimatedInvestment>0)
machine.getState().setVersionLocked(p.id,v.id,true)
config.setState({data:{...config.getState().data,hrModel:[]}})
machine.getState().copyVersion(p.id,v.id)
const copy=structuredClone(machine.getState().projects.find(x=>x.id===p.id).versions.at(-1))
machine.getState().refreshFormalProjects()
await machine.persist.rehydrate()
assert.deepEqual(machine.getState().projects.find(x=>x.id===p.id).versions.find(x=>x.id===copy.id),copy,'copied model snapshot survives refresh and reload')
assert.equal(copy.estimatedInvestment,v.estimatedInvestment)
config.setState({data:configBefore})
console.log('PASS independent copied machine snapshot after model retirement + refresh + reload')
const {buildResourceMonthlyView}=get('src/components/project-resources/resourceVersionViewData.ts')
const balances=buildResourceMonthlyView([{id:'A',versionId:'v',primaryDepartment:'P',secondaryDepartment:'A',estimatedTotal:5,monthlyData:{'2026-01':10}},{id:'B',versionId:'v',primaryDepartment:'P',secondaryDepartment:'B',estimatedTotal:5,monthlyData:{'2026-01':0}}],'v')
assert.equal(balances.remainingTotal,5);assert.equal(balances.excessTotal,5)
console.log('PASS independent opposing department balances remain 5 + 5')
const source=fs.readFileSync('src/containers/AppShell.tsx','utf8')
const expression=source.match(/const autoSavedDraft = ([\s\S]*?)\n    if \(/)[1]
const evaluate=new Function('ui','plan',`return (${expression})`)
const plan={versions:[{id:'draft',status:'修订中'}],currentVersion:'draft'}
assert.equal(evaluate({activeModule:'projectSpace',projectSpaceModule:'resources'},plan),false)
assert.equal(evaluate({activeModule:'projectSpace',projectSpaceModule:'plan'},plan),true)
console.log('PASS actual user-switch predicate protects resource draft while allowing plan autosave')
const {exportResourceVersion}=get('src/components/project-resources/exportResourceVersion.ts')
for(const kind of ['Machine','Tos','Technical','Capability']){
 const store=get(`src/stores/hr${kind}.ts`)[`useHr${kind}Store`]
 store.getState().refreshFormalProjects()
 const project=store.getState().projects.find(p=>p.versions.some(v=>v.nonLaborInvestment?.items.length && (v.modelSnapshot?.length || v.departmentInvestments?.length)))
 const version=project.versions.find(v=>v.nonLaborInvestment?.items.length && (v.modelSnapshot?.length || v.departmentInvestments?.length))
 const rows=store.getState().monthlyInvestments
 const before=JSON.stringify({version,rows})
 exportResourceVersion(project.name??project.tdtName,version,rows)
 assert.equal(captured.sheets.length,5)
 assert.ok(captured.filename.includes(version.versionNumber))
 const sheet=name=>captured.sheets.find(s=>s.sheetName===name)
 const expected=rows.filter(row=>row.versionId===version.id&&!row.isArchived)
 assert.equal(sheet('月度人力投入').rows.length,expected.length)
 assert.deepEqual(sheet('月度人力投入').rows.map(r=>r.id),expected.map(r=>r.id))
 assert.ok(sheet('部门预估投入').rows.length)
 assert.ok(sheet('部门预估投入').columns.some(c=>c.title==='合计（人月）'))
 const expenses=sheet('非人力投入')
 assert.equal(expenses.rows.length,version.nonLaborInvestment.items.length)
 for(const item of version.nonLaborInvestment.items){
  const row=expenses.rows.find(r=>r.id===item.id)
  for(const [month,amount]of Object.entries(item.monthlyAmounts)){assert.equal(row[month],amount);assert.ok(expenses.columns.some(c=>c.key===month&&c.title.includes('（元）')))}
 }
 assert.equal(JSON.stringify({version,rows}),before,'export must be readonly')
 console.log(`PASS independent ${kind} workbook metadata/selected rows/expense units/immutable data`)
}
