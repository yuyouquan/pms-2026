#!/usr/bin/env node
import assert from 'node:assert/strict'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage, MOCK_DATASET_VERSION } from './lib/mock-dataset-storage.mjs'
globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = { localStorage }
const load = createTypeScriptModuleLoader()
const { useProjectStore: registry, migrateProjectState } = load('src/stores/project.ts')
const { usePermissionStore: permission, hasPermission } = load('src/stores/permission.ts')
const { usePlanStore: plan } = load('src/stores/plan.ts')
const source = load('src/lib/hrFormalProjectSource.ts')
const access = load('src/lib/hrProjectRegistry.ts')
const rules = load('src/lib/hrVersionRules.ts')
const adapter = load('src/lib/roadmapProjectAdapter.ts')
const { RESOURCE_FORMAL_IDS, RESOURCE_BUDGET_IDS, RESOURCE_REGISTRY_PROJECTS } = load('src/mock/projectRegistry.ts')
const types = ['整机产品项目','tOS版本项目','技术项目','能力建设项目']
const names = ['Machine','Tos','Technical','Capability']
const categories = names.map(name=>name.toLowerCase())
const stores = names.map(name=>load(`src/stores/hr${name}.ts`)[`useHr${name}Store`])
const record = (store,id)=>store.getState().projects.find(project=>project.pmsProjectId===id)
const date = (category,version)=>category==='capability' ? [version.projectStartTime,version.projectEndTime] : version.milestones
let checks=0
const check=(label,fn)=>{fn();checks++;console.log('PASS '+label)}
for(const store of stores) store.getState().refreshFormalProjects()
check('fresh registry has deterministic provenance, four types, three attributes and valid single-source ownership',()=>{
 assert.equal(MOCK_DATASET_VERSION,'2026-09-08-v1')
 const projects=registry.getState().projects
 assert.equal(new Set(projects.map(p=>p.id)).size,projects.length)
 for(const p of projects){assert.ok(p.createdBy&&p.createdAt&&p.responsiblePersons.length);assert.ok(types.includes(p.type));assert.ok(['formal','budget','roadmap'].includes(p.projectAttribute))}
 for(const type of types)for(const attr of ['formal','budget'])assert.ok(projects.some(p=>p.type===type&&p.projectAttribute===attr))
 assert.ok(projects.filter(p=>p.projectAttribute==='roadmap').every(p=>p.type===types[0]))
 const bindings=projects.filter(p=>p.boundFormalProjectId)
 assert.equal(new Set(bindings.map(p=>p.projectAttribute+':'+p.boundFormalProjectId)).size,bindings.length)
 for(const p of bindings){const f=projects.find(f=>f.id===p.boundFormalProjectId);assert.equal(f.projectAttribute,'formal');assert.equal(f.type,p.type)}
 for(const store of stores)for(const p of store.getState().projects){assert.ok(p.pmsProjectId);assert.ok(!p.migrationIssue);assert.ok(!p.legacyHrSnapshot)}
})
for(let i=0;i<4;i++)check(`${categories[i]}: published own dates, annual history, unique counts, manual monthly split and source references`,()=>{
 const cat=categories[i],store=stores[i],f=record(store,RESOURCE_FORMAL_IDS[cat]),b=record(store,RESOURCE_BUDGET_IDS[cat])
 const formalSource=source.resolveHrFormalSource(cat,null,f.pmsProjectId)
 assert.ok(formalSource.planVersion,cat+' has an own published L1')
 assert.ok(Object.values(cat==='capability'?[formalSource.projectStartTime,formalSource.projectEndTime]:formalSource.milestones).some(Boolean))
 assert.equal(f.versions.length,3);assert.equal(b.versions.length,2)
 assert.deepEqual(b.versions.map(v=>v.versionNumber),['V0.1','V0.2'])
 for(const v of f.versions){assert.notEqual(v.budgetType,'annual');assert.deepEqual(date(cat,v),cat==='capability'?[formalSource.projectStartTime,formalSource.projectEndTime]:formalSource.milestones)}
 assert.notDeepEqual(date(cat,b.versions[0]),date(cat,b.versions[1]),'annual history has different dates')
 const all=store.getState().projects.flatMap(p=>p.versions)
 assert.equal(all.length,7);assert.equal(new Set(all.map(v=>v.id)).size,7)
 const visible=store.getState().projects.flatMap(p=>p.versions.filter(v=>access.isHrVersionVisible(p,v.budgetType,f.pmsProjectId)))
 assert.equal(visible.length,5)
 assert.equal(visible.find(v=>v.id===b.versions[0].id),b.versions[0],'association reuses source object')
 assert.equal(access.canEditHrInScope(b,f.pmsProjectId),false)
 const monthly=store.getState().monthlyInvestments.filter(row=>row.versionId===b.versions[1].id)
 assert.ok(monthly.some(row=>row.isEdited),'source demonstrates persisted manual monthly allocation')
 const latest=store.getState().projects.flatMap(p=>rules.HR_BUDGET_TYPES.flatMap(type=>rules.getLatestHrVersion(p.versions,type)||[]))
 assert.equal(latest.length,4);assert.equal(Math.round(latest.reduce((n,v)=>n+v.estimatedInvestment,0)*10)/10,[425,444.6,328.5,192.6][i])
 console.log('SCENARIO',cat,JSON.stringify({formal:f.name,budget:b.name,latestVersionCount:latest.length,latestTotal:Math.round(latest.reduce((n,v)=>n+v.estimatedInvestment,0)*10)/10,annual:b.versions.map(v=>({id:v.id,total:v.estimatedInvestment,dates:date(cat,v)})),manualRow:monthly.find(row=>row.isEdited)}))
})
check('source owner09 controls annual visibility; formal viewer02 cannot inherit a grant',()=>{
 const b=record(stores[0],RESOURCE_BUDGET_IDS.machine),f=record(stores[0],'1')
 permission.getState().ensureProjectPermissions(registry.getState().projects)
 assert.equal(hasPermission('演示用户02','1','basicInfo:查看'),true)
 for(const actor of ['演示用户01','演示用户09'])assert.equal(access.canAccessHrProject(b,true,actor),true)
 assert.equal(access.canAccessHrProject(b,false,'演示用户02'),false)
 registry.setState({currentLoginUser:'演示用户02'});assert.equal(access.isHrVersionVisible(b,'annual',f.pmsProjectId),false)
 registry.setState({currentLoginUser:'演示用户01'})
})
check('roadmap stays listed with absent dates; completed sample no longer creates a fresh collision',()=>{
 const migration=load('src/lib/roadmapRegistryMigration.ts').migrateLegacyRoadmapRegistry()
 assert.deepEqual(migration.conflicts,[])
 const roadmap=load('src/stores/roadmap.ts').useRoadmapStore.getState()
 const rows=adapter.mergeRoadmapProjects(registry.getState().projects,roadmap.plannedProjects,roadmap.tosVersions)
 const partial=rows.find(p=>p.id==='mock-roadmap-incomplete')
 assert.ok(partial);assert.equal(adapter.canPositionRoadmapRow(partial),false)
 assert.ok(rows.some(row=>row.projectCode==='DEMOR001'&&adapter.canPositionRoadmapRow(row)))
 assert.equal(adapter.deriveRoadmapPlanningConflicts(rows.filter(r=>r.source==='normal'),rows.filter(r=>r.source==='planned')).length,0)
})
check('bound incomplete source allows annual creation; unbound incomplete requires its own metadata',()=>{
 const store=stores[0],bound=record(store,'mock-budget-machine-incomplete-bound'),unbound=record(store,'mock-budget-machine-incomplete-unbound')
 const meta={projectLevel:'S',levelCoefficient:1,hrModelVersion:'V2026.1',metadata:{brand:'',productLine:'',marketName:''},milestones:{conceptStart:'2027-01-10'}}
 assert.equal(bound.versions.length,0);assert.equal(unbound.versions.length,0)
 assert.ok(['brand','productLine','marketName'].every(key=>bound[key]===''))
 const previous=JSON.stringify(registry.getState().projects)
 store.getState().addVersion(bound.id,'annual',meta)
 assert.equal(record(store,bound.pmsProjectId).versions.length,1)
 assert.equal(JSON.stringify(registry.getState().projects),previous)
 assert.throws(()=>store.getState().addVersion(unbound.id,'annual',meta),/品牌|产品线|市场/)
 assert.equal(record(store,unbound.pmsProjectId).versions.length,0)
})
check('own published formal snapshot update changes latest only, leaves annual dates and monthly manual edits intact',()=>{
 const store=stores[0],f=record(store,'1'),b=record(store,RESOURCE_BUDGET_IDS.machine)
 const annual=structuredClone(b.versions),history=structuredClone(f.versions[0])
 const monthly=structuredClone(store.getState().monthlyInvestments.filter(row=>row.projectId===b.id))
 const key='project::1::OP::level1::v3'
 assert.ok(plan.getState().publishedSnapshots[key])
 plan.setState({publishedSnapshots:{...plan.getState().publishedSnapshots,[key]:plan.getState().publishedSnapshots[key].map(task=>task.taskName==='概念启动'?{...task,planEndDate:'2026-01-20'}:task)}})
 store.getState().refreshFormalProjects()
 assert.equal(rules.getLatestHrVersion(record(store,'1').versions,'projectEstimate').milestones.conceptStart,'2026-01-20')
 assert.deepEqual(record(store,'1').versions[0],history)
 assert.deepEqual(record(store,b.pmsProjectId).versions,annual)
 assert.deepEqual(store.getState().monthlyInvestments.filter(row=>row.projectId===b.id),monthly)
})
check('new manual tOS and capability status is active immediately and remains active on reload',()=>{
 const service=load('src/lib/projectRegistry.ts'),status=load('src/lib/projectStatus.ts')
 for(const type of ['tOS版本项目','能力建设项目']){
  const result=service.createConfiguredProject({projectAttribute:'budget',name:`示例状态校验-${type}`,type,responsiblePersons:['演示用户01']},'演示用户01')
  assert.equal(result.ok,true)
  const p=registry.getState().projects.find(p=>p.id===result.projectId)
  assert.equal(p.status,'在研');assert.ok(status.getActiveProjectStatuses(type).includes(p.status))
  assert.equal(migrateProjectState({projects:[p]},10).projects[0].status,p.status)
 }
 for(const store of stores)store.getState().refreshFormalProjects()
})
// Actual reload, using a fresh module graph against the same current-dataset browser storage.
const beforeReload=stores.map(store=>structuredClone({projects:store.getState().projects,monthlyInvestments:store.getState().monthlyInvestments}))
const beforeRegistry=structuredClone(registry.getState().projects)
const customRole={name:'样例只读协作',members:['演示用户02'],isFixed:false}
permission.setState({rolesByProject:{...permission.getState().rolesByProject,[RESOURCE_BUDGET_IDS.machine]:[...permission.getState().rolesByProject[RESOURCE_BUDGET_IDS.machine],customRole]},rolePermissionsByProject:{...permission.getState().rolePermissionsByProject,[RESOURCE_BUDGET_IDS.machine]:{...permission.getState().rolePermissionsByProject[RESOURCE_BUDGET_IDS.machine],[customRole.name]:{'basicInfo:查看':true,'basicInfo:编辑':false}}}})
const reload=createTypeScriptModuleLoader()
for(let i=0;i<4;i++){
 const store=reload(`src/stores/hr${names[i]}.ts`)[`useHr${names[i]}Store`]
 await store.persist.rehydrate();store.getState().refreshFormalProjects()
 assert.deepEqual(store.getState().projects,beforeReload[i].projects)
 assert.deepEqual(store.getState().monthlyInvestments,beforeReload[i].monthlyInvestments)
}
assert.deepEqual(JSON.parse(JSON.stringify(reload('src/stores/project.ts').useProjectStore.getState().projects)),JSON.parse(JSON.stringify(beforeRegistry)))
assert.ok(reload('src/stores/permission.ts').usePermissionStore.getState().rolesByProject[RESOURCE_BUDGET_IDS.machine].some(r=>r.name===customRole.name))
assert.equal(reload('src/stores/permission.ts').hasPermission('演示用户02',RESOURCE_BUDGET_IDS.machine,'basicInfo:查看'),true)
assert.equal(reload('src/stores/permission.ts').hasPermission('演示用户02',RESOURCE_BUDGET_IDS.machine,'basicInfo:编辑'),false)
console.log('PASS fresh module reload preserves all versions, manual dates, monthly edits and custom grants');checks++
check('old registry migration never backfills fresh scenarios; current stored deletions are preserved',()=>{
 const legacy=structuredClone(beforeRegistry.find(p=>p.id==='1'));delete legacy.createdBy;delete legacy.createdAt;delete legacy.projectAttribute
 const old=migrateProjectState({projects:[legacy]},8)
 assert.ok(!old.projects.some(p=>RESOURCE_REGISTRY_PROJECTS.some(seed=>seed.id===p.id)))
 const current=migrateProjectState({projects:[legacy],registryHistory:[]},10)
 assert.equal(current.projects.length,1)
 for(const name of names){const state=load(`src/stores/hr${name}.ts`)[`useHr${name}Store`].getState();const stored=structuredClone(state.projects[0]);stored.versions=[];const merged=load(`src/stores/hr${name}.ts`)[`useHr${name}Store`].persist.getOptions().merge({projects:[stored],monthlyInvestments:[],registryMigrationComplete:true},state);assert.deepEqual(merged.projects[0].versions,[])}
})
console.log(`Project resource fixtures: ${checks} behavioral groups passed`)
