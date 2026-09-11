#!/usr/bin/env node
import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'
globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = { localStorage: globalThis.localStorage }
const load = createTypeScriptModuleLoader(), get = p => load(path.resolve(p))
const { useProjectStore: registry } = get('src/stores/project.ts')
const { usePermissionStore: permission } = get('src/stores/permission.ts')
const helpers = get('src/lib/hrProjectRegistry.ts')
const rules = get('src/lib/hrVersionRules.ts')
const { usePlanStore: plan } = get('src/stores/plan.ts')
const { getProjectLevel1MockSnapshotKey } = get('src/data/projectListPlanMocks.ts')
const { getProjectMarketSnapshotKey, getMarketPlanVersionKey } = get('src/lib/marketRules.ts')
const { getTosTypeVersionKey, getTosTypeSnapshotKey } = get('src/lib/tosTypeRules.ts')
const { useTechnicalPlanStore: technicalPlan } = get('src/stores/technicalPlan.ts')
const { resolveHrFormalSource } = get('src/lib/hrFormalProjectSource.ts')
const names = ['Machine','Tos','Technical','Capability'], categories = names.map(name=>name.toLowerCase())
const stores = names.map(name => get(`src/stores/hr${name}.ts`)[`useHr${name}Store`])
const types = ['整机产品项目','tOS版本项目','技术项目','能力建设项目']
const base = registry.getState().projects[0]
const formal = categories.map((category,i)=>({...base,id:`formal-${category}`,name:`正式${category}`,type:types[i],sourceBid:`source-${category}`,projectCode:'DUPLICATE-CODE',projectAttribute:'formal',fieldValues:{softwareProjectLevel:'S'},markets:['OP'],versionTypes:['Full']}))
const budget = formal.map(project=>({...project,id:`budget-${project.id}`,sourceBid:undefined,projectCode:'',projectAttribute:'budget',name:`预算${project.name}`,boundFormalProjectId:project.id,brand:'旧品牌',productLine:'旧产品线',marketName:'旧市场'}))
registry.setState({projects:[...formal,...budget],registryHistory:[],currentLoginUser:'演示用户01',marketConfigsByProjectId:{'formal-machine':[{market:'OP',isMain:true}]},tosTypeConfigsByProjectId:{'formal-tos':[{type:'Full',isMain:true}]}})
let checks=0
const check=(name,fn)=>{fn();checks++;console.log('PASS '+name)}
const saved = stores.map(store=>structuredClone({projects:store.getState().projects,monthlyInvestments:store.getState().monthlyInvestments}))
const versions=[{id:'pub',versionNo:'V1',status:'已发布'}]
const task=(taskName,date)=>({id:taskName,taskName,nodeKind:'fixed-milestone',planStartDate:date,planEndDate:date,order:0})
const tasks=['概念启动','STR1','STR3','STR4','STR5','规划KO','规划启动','Charter DCP','TDR1','PDCP','TDCP-X','EDCP'].map(name=>task(name,'2030-02-01'))
plan.setState({versions,marketVersionsByKey:{[getMarketPlanVersionKey('formal-machine','OP')]:versions},tosTypeVersionsByKey:{[getTosTypeVersionKey('formal-tos','Full','level1')]:versions},publishedSnapshots:{
 [getProjectMarketSnapshotKey('formal-machine','OP','pub')]:tasks,[getTosTypeSnapshotKey('formal-tos','Full','level1','pub')]:tasks,[getProjectLevel1MockSnapshotKey('formal-capability','pub')]:tasks}})
technicalPlan.setState({plansByKey:{'formal-technical:tdt':{planKey:'formal-technical:tdt',templateKind:'tdt',versions:[{...versions[0],templateType:'tdt',tasks}]}}})
const dept={id:'d1',primaryDepartment:'研发中心',secondaryDepartment:'软件部',estimatedInvestment:12,planningPhase:2,conceptPhase:2,planningPhase2:2,developmentValidationPhase:2,marketIterationPhase:2,maintenancePhase:2,planPhase:2,developmentPhase:3,migrationPhase:3}
const getRecord=(store,id)=>store.getState().projects.find(row=>row.pmsProjectId===id)
const createVersion=(i,id,type)=>i===0?stores[i].getState().addVersion(id,type,{projectLevel:'S',levelCoefficient:1,hrModelVersion:'V2026.1'}):stores[i].getState().addVersion(id,{budgetType:type,departmentInvestments:[dept],projectStartTime:'2028-01-01',projectEndTime:'2028-12-01'})
for(let i=0;i<4;i++){
 const store=stores[i],category=categories[i]
 check(`${category}: configured records, attribute budget restrictions, source date ownership, readonly histories and last deletion`,()=>{
  store.setState({projects:[],monthlyInvestments:[],registryMigrationComplete:true});store.getState().refreshFormalProjects()
  let f=getRecord(store,formal[i].id),b=getRecord(store,budget[i].id)
  assert.ok(f&&b);assert.equal(f.versions.length,0)
  createVersion(i,f.id,'annual');createVersion(i,b.id,'projectBudget');assert.equal(getRecord(store,f.pmsProjectId).versions.length,0);assert.equal(getRecord(store,b.pmsProjectId).versions.length,0)
  createVersion(i,b.id,'annual');createVersion(i,f.id,'projectEstimate');createVersion(i,f.id,'projectBudget')
  f=getRecord(store,f.pmsProjectId);b=getRecord(store,b.pmsProjectId)
  assert.equal(f.versions.length,2);assert.equal(b.versions.length,1)
  const dateKey=i===2?'planningStart':'conceptStart'
  const dateOf=v=>i===3?v.projectStartTime:v.milestones[dateKey]
  const patch=i===3?{projectStartTime:'2028-01-01',projectEndTime:'2028-12-01'}:{milestones:{...b.versions[0].milestones,[dateKey]:'2028-01-01'}}
  store.getState().updateVersion(b.id,b.versions[0].id,patch);store.getState().updateVersion(f.id,f.versions[0].id,patch)
  assert.equal(dateOf(getRecord(store,f.pmsProjectId).versions[0]),'2030-02-01')
  assert.equal(dateOf(getRecord(store,b.pmsProjectId).versions[0]),'2028-01-01')
  const originalAnnual=structuredClone(getRecord(store,b.pmsProjectId).versions[0])
  createVersion(i,b.id,'annual');store.getState().updateVersion(b.id,originalAnnual.id,patch)
  assert.deepEqual(getRecord(store,b.pmsProjectId).versions[0],originalAnnual)
  assert.equal(helpers.isHrVersionVisible(b,'annual',f.pmsProjectId),true);assert.equal(helpers.canEditHrInScope(b,f.pmsProjectId),false)
  registry.setState({projects:registry.getState().projects.map(p=>p.id===b.pmsProjectId?{...p,boundFormalProjectId:null}:p)})
  store.getState().refreshFormalProjects();assert.equal(helpers.isHrVersionVisible(getRecord(store,b.pmsProjectId),'annual',f.pmsProjectId),false)
  assert.equal(dateOf(getRecord(store,b.pmsProjectId).versions[0]),'2028-01-01')
  const monthly=store.getState().monthlyInvestments.find(row=>row.versionId===getRecord(store,b.pmsProjectId).versions[1].id)
  assert.ok(monthly);store.getState().updateMonthlyInvestment(monthly.id,{'2028-01':7.3});store.getState().refreshFormalProjects()
  assert.deepEqual(store.getState().monthlyInvestments.find(row=>row.id===monthly.id).monthlyData,{'2028-01':7.3})
  const before=JSON.stringify(store.getState().projects);registry.setState({currentLoginUser:'无权限用户'})
  store.getState().deleteVersion(f.id,f.versions[0].id);createVersion(i,b.id,'annual');store.getState().updateMonthlyInvestment(monthly.id,{'2028-01':99})
  assert.equal(JSON.stringify(store.getState().projects),before);assert.equal(store.getState().monthlyInvestments.find(row=>row.id===monthly.id).monthlyData['2028-01'],7.3)
  assert.equal(helpers.canAccessHrProject(b),false);registry.setState({currentLoginUser:'演示用户01'})
  for(const version of getRecord(store,b.pmsProjectId).versions)store.getState().deleteVersion(b.id,version.id)
  assert.equal(getRecord(store,b.pmsProjectId).versions.length,0);assert.ok(registry.getState().projects.some(p=>p.id===b.pmsProjectId))
  assert.throws(()=>store.getState().bindIpmProject(b.id,'fake'),/项目配置/);assert.throws(()=>store.getState().deleteProject(b.id),/项目配置/)
 })
}
check('duplicate display codes never select another formal plan; absent own plan remains empty',()=>{
 const other={...formal[0],id:'other-machine',sourceBid:'other-source'};registry.setState({projects:[...registry.getState().projects,other]})
 assert.equal(resolveHrFormalSource('machine','DUPLICATE-CODE',other.id).milestones.conceptStart,null)
 assert.equal(resolveHrFormalSource('machine','DUPLICATE-CODE',formal[0].id).milestones.conceptStart,'2030-02-01')
})
check('bound machine metadata follows canonical values; unbinding retains last values',()=>{
 const store=stores[0];registry.setState({projects:registry.getState().projects.map(p=>p.id===formal[0].id?{...p,brand:'示例品牌A',productLine:'示例系列A',marketName:'市场A'}:p.id===budget[0].id?{...p,boundFormalProjectId:formal[0].id}:p)})
 store.getState().refreshFormalProjects();assert.equal(getRecord(store,budget[0].id).brand,'示例品牌A')
 registry.setState({projects:registry.getState().projects.map(p=>p.id===budget[0].id?{...p,boundFormalProjectId:null}:p)})
 store.getState().refreshFormalProjects();assert.equal(getRecord(store,budget[0].id).brand,'示例品牌A')
})
check('legacy split preserves all IDs, dates, monthly edits/logs; unresolved are admin visible; repeat/deletion replay cannot resurrect',()=>{
 // This is an explicit pre-registry fixture, independent of canonical fresh defaults.
 const source={...saved[3].projects[0],pmsProjectId:undefined},v=source.versions[0]
 const legacy=[{...source,id:'unique',ipmProjectCode:formal[3].sourceBid,versions:[{...v,id:'legacy-a',projectId:'unique',budgetType:'annual'},{...v,id:'legacy-b',projectId:'unique',budgetType:'projectBudget'}]},
 {...source,id:'unknown',ipmProjectCode:'UNKNOWN',versions:[{...v,id:'unknown-v',projectId:'unknown',budgetType:'projectBudget'}]}]
 const monthly=[{id:'manual-old',projectId:'unique',versionId:'legacy-a',monthlyData:{'2026-01':9.9},isEdited:true}]
 const migrated=helpers.reconcileHrRegistry(legacy,monthly,'capability',false)
 assert.deepEqual(migrated.projects.flatMap(p=>p.versions.map(v=>v.id)).sort(),['legacy-a','legacy-b','unknown-v'].sort())
 for(const old of legacy.flatMap(p=>p.versions)){const current=migrated.projects.flatMap(p=>p.versions).find(v=>v.id===old.id);assert.deepEqual({...current,projectId:old.projectId},old)}
 assert.deepEqual({...migrated.monthlyInvestments[0],projectId:'unique'},monthly[0]);assert.equal(migrated.projects.find(p=>p.id==='unique').pmsProjectId,formal[3].id)
 const unknown=migrated.projects.find(p=>p.id==='unknown');assert.ok(unknown.migrationIssue);assert.equal(helpers.canAccessHrProject(unknown),true);assert.equal(helpers.canAccessHrProject(unknown,true),false)
 const again=helpers.reconcileHrRegistry(migrated.projects,migrated.monthlyInvestments,'capability',true);assert.deepEqual(again,migrated)
 const id=helpers.legacyHrBudgetId('capability','unique')
 registry.setState({projects:registry.getState().projects.filter(p=>p.id!==id),registryHistory:[{projectId:id,action:'delete'}]})
 helpers.reconcileHrRegistry(legacy,monthly,'capability',false)
 assert.equal(registry.getState().projects.some(p=>p.id===id),false)
})
check('explicit duplicate legacy ownership claims retain both originals without guessing a formal binding',()=>{
 const source={...saved[3].projects[0],pmsProjectId:undefined},version=source.versions[0]
 const legacy=['a','b'].map(suffix=>({...source,id:`duplicate-claim-${suffix}`,ipmProjectCode:formal[3].sourceBid,
   versions:['annual','projectBudget'].map(type=>({...version,id:`duplicate-${suffix}-${type}`,projectId:`duplicate-claim-${suffix}`,budgetType:type}))}))
 const monthly=legacy.map((row,index)=>({id:`duplicate-month-${index}`,projectId:row.id,versionId:row.versions[0].id,monthlyData:{'2026-01':index+1.5},isEdited:true}))
 const migrated=helpers.reconcileHrRegistry(legacy,monthly,'capability',false)
 for(const old of legacy){
  const unresolved=migrated.projects.find(row=>row.id===old.id)
  assert.equal(unresolved.pmsProjectId,undefined);assert.match(unresolved.migrationIssue,/不唯一/)
  assert.deepEqual(unresolved.legacyHrSnapshot,JSON.parse(JSON.stringify(old)))
  const canonical=registry.getState().projects.find(row=>row.id===helpers.legacyHrBudgetId('capability',old.id))
  assert.equal(canonical.boundFormalProjectId,null)
  for(const version of old.versions){const retained=migrated.projects.flatMap(row=>row.versions).find(row=>row.id===version.id);assert.deepEqual({...retained,projectId:version.projectId},version)}
 }
 assert.deepEqual(migrated.monthlyInvestments.map(row=>row.monthlyData),monthly.map(row=>row.monthlyData))
 assert.deepEqual(helpers.reconcileHrRegistry(migrated.projects,migrated.monthlyInvestments,'capability',true),migrated)
})
check('formal-only access never grants source visibility; roadmap rejects all budget types',()=>{
 const owner='正式项目专属成员'
 permission.getState().ensureProjectPermissions([{...formal[0],createdBy:'演示用户01',responsiblePersons:[owner]}])
 registry.setState({projects:registry.getState().projects.map(p=>p.id===budget[0].id?{...p,boundFormalProjectId:formal[0].id}:p)})
 const b=getRecord(stores[0],budget[0].id)
 assert.equal(helpers.canAccessHrProject({pmsProjectId:formal[0].id},false,owner),true)
 assert.equal(helpers.canAccessHrProject(b,false,owner),false)
 registry.setState({currentLoginUser:owner});assert.equal(helpers.isHrVersionVisible(b,'annual',formal[0].id),false)
 registry.setState({currentLoginUser:'演示用户01',projects:[...registry.getState().projects,{...formal[0],id:'roadmap-reject',projectAttribute:'roadmap'}]})
 for(const type of rules.HR_BUDGET_TYPES)assert.equal(rules.canCreateHrVersion({status:'active',pmsProjectId:'roadmap-reject',ipmProjectCode:'anything'},type),false)
})
check('temporary missing registry snapshot preserves joined HR versions/monthly until canonical hydration returns',()=>{
 const store=stores[0],before=structuredClone({projects:store.getState().projects,monthlyInvestments:store.getState().monthlyInvestments})
 const canonical=registry.getState().projects
 registry.setState({projects:[]});store.getState().refreshFormalProjects()
 assert.deepEqual(store.getState().projects.flatMap(p=>p.versions.map(v=>v.id)),before.projects.flatMap(p=>p.versions.map(v=>v.id)))
 assert.deepEqual(store.getState().monthlyInvestments.map(r=>[r.id,r.monthlyData,r.isEdited]),before.monthlyInvestments.map(r=>[r.id,r.monthlyData,r.isEdited]))
 assert.equal(helpers.canAccessHrProject(store.getState().projects.find(p=>p.pmsProjectId)),false)
 registry.setState({projects:canonical});store.getState().refreshFormalProjects()
 assert.deepEqual(store.getState().projects.flatMap(p=>p.versions.map(v=>v.id)),before.projects.flatMap(p=>p.versions.map(v=>v.id)))
})
check('project year reads each row version concept and STR5',()=>{
 const a={createdAt:'2026',milestones:{conceptStart:'2024-01-01',str5:'2025-12-01',productLaunch:'2030-01-01'}}
 assert.equal(rules.getMachineProjectYear({versions:[a]}),'24年立项25年结项')
})
const registryService=get('src/lib/projectRegistry.ts')
const sourceId=budget[0].id, targetId=formal[0].id
assert.equal(registryService.deleteConfiguredProject(targetId,'演示用户01').ok,true)
stores[0].getState().refreshFormalProjects()
assert.ok(getRecord(stores[0],sourceId));assert.equal(registry.getState().projects.find(p=>p.id===sourceId).boundFormalProjectId,null)
assert.equal(registryService.deleteConfiguredProject(sourceId,'演示用户01').ok,true)
stores[0].getState().refreshFormalProjects()
await registry.persist.rehydrate();await stores[0].persist.rehydrate();stores[0].getState().refreshFormalProjects()
assert.equal(getRecord(stores[0],sourceId),undefined);assert.equal(stores[0].getState().registryMigrationComplete,true)
checks++;console.log('PASS canonical deletion survives persisted registry/HR reload; formal deletion retains source budget')
console.log(`HR project registry verification passed (${checks} behavioral groups).`)
