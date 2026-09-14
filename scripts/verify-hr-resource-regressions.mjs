#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'
globalThis.localStorage=createCurrentDatasetStorage();globalThis.window={localStorage:globalThis.localStorage}
const load=createTypeScriptModuleLoader(),get=p=>load(path.resolve(p))
const {useProjectStore:registry}=get('src/stores/project.ts')
const helpers=get('src/lib/hrProjectRegistry.ts'),monthlyHelpers=get('src/lib/hrMonthlySync.ts')
const active=rows=>monthlyHelpers.selectActiveHrMonthlyRows ? monthlyHelpers.selectActiveHrMonthlyRows(rows) : rows
const base=registry.getState().projects[0]
const types={Capability:'能力建设项目',Tos:'tOS版本项目',Technical:'技术项目',Machine:'整机产品项目'}
registry.setState({projects:Object.entries(types).map(([name,type])=>({...base,id:`review-${name}`,type,projectAttribute:'budget',createdBy:'演示用户01',responsiblePersons:['演示用户01']})),registryHistory:[],currentLoginUser:'演示用户01'})
const department=id=>({id,primaryDepartment:'研发中心',secondaryDepartment:id==='d1'?'部门一':'部门二',estimatedInvestment:12,planningPhase:12,conceptPhase:0,planningPhase2:0,developmentValidationPhase:0,marketIterationPhase:0,maintenancePhase:0,planPhase:0,developmentPhase:0,migrationPhase:0})
let checks=0
for(const name of ['Capability','Tos','Technical','Machine']){
 const store=get(`src/stores/hr${name}.ts`)[`useHr${name}Store`]
 store.setState({projects:[],monthlyInvestments:[],registryMigrationComplete:true});store.getState().refreshFormalProjects()
 const project=store.getState().projects.find(p=>p.pmsProjectId===`review-${name}`)
 const d1=department('d1'),d2=department('d2')
 let model,modelData,modelRows
 if(name==='Machine'){
  model=get('src/stores/hrConfig.ts').useHrConfigStore;modelData=structuredClone(model.getState().data)
  const row=modelData.hrModel[0]
  modelRows=[d1,d2].map(d=>({...row,id:d.id,primaryDepartment:d.primaryDepartment,secondaryDepartment:d.secondaryDepartment,projectLevel:'S',modelVersion:'REVIEW',enabled:true,conceptPhase:12,planningPhase:0,developmentPhase:0,validationPhase:0,launchPhase:0,lifecycle:0}))
  model.setState({data:{...modelData,hrModel:modelRows}})
  store.getState().addVersion(project.id,'annual',{projectLevel:'S',levelCoefficient:1,hrModelVersion:'REVIEW'})
 }else store.getState().addVersion(project.id,{budgetType:'annual',departmentInvestments:[d1,d2],projectStartTime:'2028-01-01',projectEndTime:'2028-12-01'})
 const version=()=>store.getState().projects.find(p=>p.id===project.id).versions[0]
 const rows=()=>store.getState().monthlyInvestments.filter(r=>r.versionId===version().id)
 const change=departments=>{
  if(name==='Machine')model.setState({data:{...modelData,hrModel:departments.map(d=>({...modelRows.find(r=>r.id===d.id)??modelRows[1],id:d.id}))}})
  else store.getState().updateVersionDepartmentInvestments(project.id,version().id,departments)
  store.getState().refreshFormalProjects()
 }
 assert.equal(version().estimatedInvestment,24,`${name} fixture total`)
 const second=rows().find(r=>r.secondaryDepartment==='部门二'),manual={'2028-01':7.3,'2028-02':4.7}
 store.getState().updateMonthlyInvestment(second.id,manual)
 change([d1])
 assert.equal(version().estimatedInvestment,12)
 assert.equal(active(rows()).reduce((n,r)=>n+r.estimatedTotal,0),12,`${name} removed department must not count in active monthly total`)
 const archived=rows().find(r=>r.id===second.id)
 assert.equal(archived.isArchived,true);assert.equal(archived.isEdited,true);assert.deepEqual(archived.monthlyData,manual)
 store.getState().updateMonthlyInvestment(second.id,{'2028-01':99})
 assert.deepEqual(rows().find(r=>r.id===second.id).monthlyData,manual,`${name} archived monthly rows reject stale editor writes`)
 await store.persist.rehydrate();store.getState().refreshFormalProjects()
 assert.equal(active(rows()).length,1,`${name} archive stays hidden after reload`)
 change([d1,{...d2,id:'replacement'}])
 const replacement=active(rows()).find(r=>r.secondaryDepartment==='部门二')
 assert.notEqual(replacement.id,second.id);assert.equal(replacement.isEdited,false,`${name} same-name replacement must not inherit another source's edits`)
 assert.deepEqual(rows().find(r=>r.id===second.id).monthlyData,manual)
 change([d1,d2])
 const restored=active(rows()).find(r=>r.id===second.id)
 assert.ok(restored,`${name} readding same source restores original monthly ID`)
 assert.deepEqual(restored.monthlyData,manual);assert.equal(restored.isEdited,true)
 assert.equal(active(rows()).reduce((n,r)=>n+r.estimatedTotal,0),version().estimatedInvestment)
 assert.equal(active(rows()).length,2);assert.equal(rows().find(r=>r.id===replacement.id).isArchived,true)
 if(model)model.setState({data:modelData})
 checks++;console.log(`PASS ${name}: removal, archive/reload, same-name replacement, same-ID readdition and active totals`)
}
const oldMonthly={id:'mi-old-v-source-dept',projectId:'new-annual-owner',versionId:'v',primaryDepartment:'研发',secondaryDepartment:'软件',estimatedTotal:12,monthlyData:{'2028-01':7.3,'2028-02':4.7},isEdited:true}
const remapped=monthlyHelpers.preserveHrMonthlyEdits([{...oldMonthly,id:'mi-new-v-source-dept',isEdited:false,monthlyData:{'2028-01':12}}],[oldMonthly])
assert.equal(active(remapped).length,1);assert.equal(active(remapped)[0].id,oldMonthly.id);assert.deepEqual(active(remapped)[0].monthlyData,oldMonthly.monthlyData)
checks++;console.log('PASS legacy HR project-prefix remapping preserves active monthly source identity/manual values')
const scoped=[{id:'own-hr',pmsProjectId:'own-pms'},{id:'source-hr',pmsProjectId:'source-pms'}]
assert.equal(helpers.resolveHrNewVersionProjectId(scoped,'source-hr','own-pms'),'own-hr')
assert.equal(helpers.resolveHrNewVersionProjectId(scoped,'source-hr'),'source-hr')
assert.equal(helpers.resolveHrNewVersionProjectId(scoped,'source-hr','missing'),'')
const capability=fs.readFileSync('src/components/hr-capability/NewVersionModal.tsx','utf8')
assert.match(capability,/setLocalProjectId\(resolveHrNewVersionProjectId\(projects, selectedProjectId, scopeId\)\)/)
checks++;console.log('PASS associated annual source selection resets capability creation to owning scope; cross-project selection retained')
const own=registry.getState().projects.find(p=>p.id==='review-Machine')
registry.setState({projects:[...registry.getState().projects,{...own,id:'formal-machine-options',projectAttribute:'formal'}]})
assert.deepEqual(helpers.getHrAllowedBudgetTypes({pmsProjectId:'formal-machine-options'}),['projectEstimate','projectBudget'])
assert.deepEqual(helpers.getHrAllowedBudgetTypes({pmsProjectId:own.id}),['annual'])
const machine=fs.readFileSync('src/components/hr-machine/NewVersionModal.tsx','utf8')
assert.match(machine,/BUDGET_TYPES\.filter\(type => getHrAllowedBudgetTypes\(project\)\.includes\(type.value\)\)/)
checks++;console.log('PASS machine dropdown consumes attribute-specific options before rendering')
console.log(`HR resource review regressions passed (${checks} groups).`)
