#!/usr/bin/env node
import assert from 'node:assert/strict'
import { loadTypeScriptModule, projectRoot } from './lib/source-contract.mjs'
const root = projectRoot(import.meta.url)
const memory = new Map()
globalThis.localStorage = { getItem: k => memory.get(k) ?? null, setItem: (k,v) => memory.set(k,v), removeItem: k => memory.delete(k) }
const load = p => loadTypeScriptModule(root, p)
const rules = load('src/lib/hrVersionRules.ts')
const formal = load('src/lib/hrFormalProjectSource.ts')
const config = load('src/constants/hrConfig.ts')
const model = load('src/stores/hrConfig.ts').useHrConfigStore
const seed = load('src/mock/hrInvestment.ts')
let checks = 0
const failures = []
const eq = (actual, expected, label) => { checks++; try { assert.deepEqual(actual, expected, label) } catch (error) { failures.push(error.message) } }
const tenth = v => Math.round(v * 10)
const sum = values => values.reduce((total, value) => total + value, 0)
const categories = ['machine','tos','technical','capability']
const names = ['Machine','Tos','Technical','Capability']
for(let i=0;i<4;i++) {
 const category=categories[i], name=names[i]
 const store=load(`src/stores/hr${name}.ts`)[`useHr${name}Store`]
 store.getState().refreshFormalProjects()
 const original=structuredClone({projects:store.getState().projects,monthlyInvestments:store.getState().monthlyInvestments})
 const additions=original.projects.filter(p=>p.id.startsWith('hr-demo-202609-'))
 eq(additions.length,6,category+' adds six projects')
 eq(additions.reduce((count,p)=>count+p.versions.length,0),13,category+' adds thirteen versions')
 eq(additions.some(p=>p.status==='cancelled'),true,category+' covers cancelled')
 eq(additions.some(p=>p.versions.length===0),true,category+' covers no versions')
 for(const p of additions){
  if(p.ipmProjectCode)eq(!!formal.findHrFormalProject(category,p.ipmProjectCode),true,category+' binding resolves '+p.id)
  eq(new Set(p.versions.map(v=>v.id)).size,p.versions.length,category+' unique version IDs')
  for(const budget of rules.HR_BUDGET_TYPES){
   const latest=rules.getLatestHrVersion(p.versions,budget)
   eq(p[budget==='annual'?'annualBudget':budget],latest?.estimatedInvestment??0,category+' latest project totals')
   if(!latest)continue
   const monthly=original.monthlyInvestments.filter(m=>m.versionId===latest.id)
   eq(tenth(sum(monthly.map(m=>m.estimatedTotal))),tenth(latest.estimatedInvestment),category+' department total matches version '+latest.id)
   eq(monthly.every(m=>Object.values(m.monthlyData).every(v=>Number.isFinite(v)&&v>=0)),true,category+' monthly values valid')
   eq(monthly.every(m=>tenth(sum(Object.values(m.monthlyData)))<=tenth(m.estimatedTotal)),true,category+' unallocated never becomes extra monthly investment')
   if(p.id.endsWith('-3')){
    eq(monthly.some(m=>Object.keys(m.monthlyData).some(k=>k.startsWith('2026'))&&Object.keys(m.monthlyData).some(k=>k.startsWith('2027'))),true,category+' cross year monthly allocation')
    for(const m of monthly)eq(tenth(sum(Object.values(m.monthlyData))),tenth(m.estimatedTotal),category+' complete months conserve each department')
   }
  }
 }
 // Upgrade existing browsers once, preserving edited projects and user-created data.
 const options=store.persist.getOptions(), prior=structuredClone(original.projects[0]);prior.projectAccounting=123.4
 const custom={...structuredClone(prior),id:'user-created-'+category}
 const saved={...original,projects:[prior,custom],filters:store.getState().filters}
 const migrated=options.migrate(saved,options.version-1)
 eq(migrated.projects.find(p=>p.id===prior.id),prior,category+' migration preserves edits')
 eq(migrated.projects.find(p=>p.id===custom.id),custom,category+' migration preserves user additions')
 eq(migrated.projects.length,8,category+' migration appends only new seeds')
 eq(seed.appendHrMockProjects(migrated.projects,additions).length,8,category+' seed append is idempotent')
 const deleted=migrated.projects.filter(p=>p.id!==additions[0].id)
 const merged=options.merge({...migrated,projects:deleted},store.getState())
 eq(merged.projects.some(p=>p.id===additions[0].id),false,category+' deleted seed stays deleted on refresh')
 // Existing annual version, copy/new latest, edit guard, deletion fallback, manual monthly edit/reload.
 const p=structuredClone(additions[2]);store.setState({projects:[p],monthlyInvestments:[]});store.getState().refreshFormalProjects()
 const old=rules.getLatestHrVersion(p.versions,'annual')
 if(i===0)store.getState().addVersion(p.id,'annual',{projectLevel:'A',levelCoefficient:1.25,hrModelVersion:'V2026.1'})
 else store.getState().copyVersion(p.id,old.id)
 let current=store.getState().projects[0], latest=rules.getLatestHrVersion(current.versions,'annual')
 eq(latest.versionNumber,'V0.3',category+' creates sequential V0.3')
 if(i!==0)eq(latest.createdBy,'当前用户',category+' copied version records current creator')
 eq(store.getState().monthlyInvestments.every(m=>m.versionId===latest.id),true,category+' monthly only latest')
 const history=JSON.stringify(current.versions.find(v=>v.id===old.id))
 store.getState().updateVersion(p.id,old.id,i===3?{projectStartTime:'2040-01-01'}:{milestones:{...(old.milestones??{}),[i===2?'planningStart':'conceptStart']:'2040-01-01'}})
 eq(JSON.stringify(store.getState().projects[0].versions.find(v=>v.id===old.id)),history,category+' historical edit blocked')
 store.getState().deleteVersion(p.id,latest.id)
 eq(rules.getLatestHrVersion(store.getState().projects[0].versions,'annual').id,old.id,category+' deleting latest restores previous version')
 eq(store.getState().monthlyInvestments.every(m=>m.versionId===old.id),true,category+' monthly follows deletion fallback')
 const record=store.getState().monthlyInvestments.find(m=>Object.keys(m.monthlyData).length>1)
 if(record){
  const keys=Object.keys(record.monthlyData).sort(), values={...record.monthlyData};values[keys[1]]=Math.round((values[keys[1]]+values[keys[0]])*10)/10;values[keys[0]]=0
  store.getState().updateMonthlyInvestment(record.id,values)
  store.getState().refreshFormalProjects()
  eq(store.getState().monthlyInvestments.find(m=>m.id===record.id)?.monthlyData,values,category+' manual monthly allocation survives refresh')
  await store.persist.rehydrate()
  eq(store.getState().monthlyInvestments.find(m=>m.id===record.id)?.monthlyData,values,category+' manual monthly allocation survives reload')
 }
 // Two rows with the same department remain distinct after one row is manually edited.
 if(i!==0){
  current=structuredClone(store.getState().projects[0]);latest=rules.getLatestHrVersion(current.versions,'annual')
  const dept=latest.departmentInvestments[0]
  latest.departmentInvestments=[{...dept,id:'dept-first'},{...dept,id:'dept-second'}]
  latest.estimatedInvestment=round2(dept.estimatedInvestment*2)
  store.setState({projects:[current],monthlyInvestments:[]});store.getState().refreshFormalProjects()
  const rows=store.getState().monthlyInvestments
  const second=rows[1], keys=Object.keys(second.monthlyData),values={...second.monthlyData}
  values[keys[1]]=round2(values[keys[1]]+values[keys[0]]);values[keys[0]]=0
  store.getState().updateMonthlyInvestment(second.id,values);store.getState().refreshFormalProjects()
  const after=store.getState().monthlyInvestments
  eq(new Set(after.map(m=>m.id)).size,after.length,category+' repeated department rows retain unique monthly IDs')
  eq(after[0].isEdited,false,category+' editing second department row cannot overwrite first')
  eq(after[1].monthlyData,values,category+' edited duplicate row preserved')
 }
 const guarded=structuredClone(additions[2]);store.setState({projects:[guarded],monthlyInvestments:[]})
 const addGuarded=budget=>i===0?store.getState().addVersion(guarded.id,budget,{projectLevel:'A',levelCoefficient:1,hrModelVersion:'V2026.1'}):store.getState().addVersion(guarded.id,{budgetType:budget,projectStartTime:'2026-01-01',projectEndTime:'2026-03-01',departmentInvestments:guarded.versions[0].departmentInvestments})
 const initialLength=guarded.versions.length
 addGuarded('projectBudget')
 eq(store.getState().projects[0].versions.length,initialLength,category+' nonannual creation requires formal code')
 store.getState().cancelProject(guarded.id);addGuarded('annual')
 eq(store.getState().projects[0].versions.length,initialLength,category+' cancelled project rejects new version')
 if(i!==0){store.getState().copyVersion(guarded.id,guarded.versions[0].id);eq(store.getState().projects[0].versions.length,initialLength,category+' cancelled project rejects copying')}
 store.getState().restoreProject(guarded.id);addGuarded('annual')
 eq(store.getState().projects[0].versions.length,initialLength+1,category+' restored project permits new version')
 if(i!==0){
  const legacy=structuredClone(guarded);legacy.versions=legacy.versions.map(v=>({...v,budgetType:'projectBudget'}));store.setState({projects:[legacy],monthlyInvestments:[]})
  store.getState().copyVersion(legacy.id,legacy.versions[0].id)
  eq(store.getState().projects[0].versions.length,legacy.versions.length,category+' copying cannot bypass formal-code requirement')
 }
 store.setState(original)
}
// Imported/persisted legacy department indexes migrate safely, including repeated names.
const sync = load('src/lib/hrMonthlySync.ts').preserveHrMonthlyEdits
const row = (id, edited=false) => ({ id, projectId:'p', versionId:'v', primaryDepartment:'研发中心', secondaryDepartment:'软件部', estimatedTotal:10, monthlyData:edited?{'2026-01':4,'2026-02':6}:{'2026-01':5,'2026-02':5}, isEdited:edited })
const migratedRows=sync([row('source-a'),row('source-b')],[row('mi-p-v-dept0'),row('mi-p-v-dept1',true)])
eq(migratedRows.map(r=>r.id),['source-a','source-b'],'legacy monthly IDs replaced by stable source IDs')
eq(migratedRows.map(r=>r.isEdited),[false,true],'legacy duplicate edit remains scoped to its row')
const reordered=sync([row('source-b'),row('source-a')],migratedRows)
eq(reordered.map(r=>r.isEdited),[true,false],'department reorder preserves source row edits')
eq(reordered[0].monthlyData,{'2026-01':4,'2026-02':6},'department reorder keeps manual distribution')

// Fractional machine coefficients must conserve totals across departments and months.
const dates={conceptStart:'2026-01-01',str1:'2026-02-01',str3:'2026-03-01',str4:'2026-04-01',str5:'2026-05-01',productLaunch:'2026-06-01'}
for(const coefficient of [1.25,0.15,1.333]){
 const records=model.getState().data.hrModel
 const rows=config.calcDepartmentMonthlySplit(records,'A','V2026.1',coefficient,dates)
 const phases=config.calcMachineDepartmentInvestments(records,'A','V2026.1',coefficient)
 eq(tenth(sum(phases.flatMap(r=>Object.values(r.phases)))),tenth(config.calcEstimatedInvestment(records,'A','V2026.1',coefficient)),'machine detail and export phases conserve total '+coefficient)
 for(const dept of phases)eq(tenth(sum(Object.values(dept.phases))),tenth(dept.estimatedTotal),'machine phase sum matches its department '+coefficient)
 eq(tenth(sum(rows.map(r=>r.estimatedTotal))),tenth(config.calcEstimatedInvestment(records,'A','V2026.1',coefficient)),'machine fractional coefficient reconciles '+coefficient)
 for(const row of rows)eq(tenth(sum(Object.values(row.monthlyData))),tenth(row.estimatedTotal),'machine monthly equals department '+coefficient)
}
function round2(value){return Math.round(value*10)/10}
if(failures.length){console.error(failures.join('\n\n'));throw new Error(`${failures.length}/${checks} HR audit checks failed`)}
console.log(`HR investment audit: ${checks} checks passed`)
