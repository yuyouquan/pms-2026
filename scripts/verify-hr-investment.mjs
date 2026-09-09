#!/usr/bin/env node
import assert from 'node:assert/strict'
import { loadTypeScriptModule, projectRoot } from './lib/source-contract.mjs'
const root = projectRoot(import.meta.url)
const memory = new Map()
globalThis.localStorage = { getItem: k => memory.get(k) ?? null, setItem: (k,v) => memory.set(k,v), removeItem: k => memory.delete(k) }
const load = p => loadTypeScriptModule(root, p)
const rules = load('src/lib/hrVersionRules.ts')
const formal = load('src/lib/hrFormalProjectSource.ts')
const { useProjectStore: projectStore } = load('src/stores/project.ts')
const { usePlanStore: planStore } = load('src/stores/plan.ts')
const { useTechnicalPlanStore: technicalPlan } = load('src/stores/technicalPlan.ts')
const { getMarketPlanVersionKey, getProjectMarketSnapshotKey } = load('src/lib/marketRules.ts')
const { getTosTypeVersionKey, getTosTypeSnapshotKey } = load('src/lib/tosTypeRules.ts')
const { getProjectLevel1MockSnapshotKey } = load('src/data/projectListPlanMocks.ts')
const types = load('src/constants/projectTypes.ts')
const categories = ['machine','tos','technical','capability']
const stores = ['Machine','Tos','Technical','Capability'].map(name => load(`src/stores/hr${name}.ts`)[`useHr${name}Store`])
const formalTypes = [types.PROJECT_CATEGORY_MACHINE,types.PROJECT_TYPE_TOS_VERSION,types.PROJECT_TYPE_TECH,types.PROJECT_TYPE_CAPABILITY]
const base = projectStore.getState().projects[0]
const formalProjects = categories.map((category,index) => ({ ...base, id: `verify-${category}`, sourceBid: `FORMAL-${category}`, projectCode: `FORMAL-${category}`, name: `正式${category}`, type: formalTypes[index], markets: ['OP','TR'], versionTypes: ['Full','Slim'], fieldValues: { softwareProjectLevel:'S' }, projectLevel:'S' }))
projectStore.setState({ projects:formalProjects, marketConfigsByProjectId:{ 'verify-machine': [{market:'OP',isMain:false},{market:'TR',isMain:true}] }, tosTypeConfigsByProjectId:{ 'verify-tos':[{type:'Full',isMain:true},{type:'Slim',isMain:false}] } })
const task = (name,date) => ({id:name,taskName:name,order:0,nodeKind:'fixed-milestone',planStartDate:date,planEndDate:date})
const milestones = ['概念启动','STR1','STR3','STR4','STR5','上市阶段','规划KO','上市迭代阶段','维护阶段','规划启动','charter DCP','TDR1','PDCP','TDCP_X','EDCP']
const publishedTasks = milestones.map((name,index) => ({...task(name, name==='概念启动'?'2026-03-01':'2027-04-01'),order:index}))
for(const name of ['上市阶段','上市迭代阶段','维护阶段']) {
 const stage=publishedTasks.find(t=>t.taskName===name)
 Object.assign(stage,{nodeKind:'stage',planStartDate:'',planEndDate:''})
 publishedTasks.push({...task(name+'业务周期','2027-04-01'),parentId:stage.id,nodeKind:'business-period',order:0})
}
const versions = [{id:'pub1',versionNo:'V1',status:'已发布'},{id:'pub2',versionNo:'V2',status:'已发布'},{id:'draft3',versionNo:'V3',status:'修订中'}]
planStore.setState({ versions,
 marketVersionsByKey:{[getMarketPlanVersionKey('verify-machine','TR')]:versions,[getMarketPlanVersionKey('verify-machine','OP')]:versions},
 tosTypeVersionsByKey:{[getTosTypeVersionKey('verify-tos','Full','level1')]:versions,[getTosTypeVersionKey('verify-tos','Slim','level1')]:versions},
 publishedSnapshots:{
 [getProjectMarketSnapshotKey('verify-machine','TR','pub2')]:publishedTasks,
 [getProjectMarketSnapshotKey('verify-machine','OP','pub2')]:[task('概念启动','2040-01-01')],
 [getProjectMarketSnapshotKey('verify-machine','TR','draft3')]:[task('概念启动','2050-01-01')],
 [getTosTypeSnapshotKey('verify-tos','Full','level1','pub2')]:publishedTasks,
 [getTosTypeSnapshotKey('verify-tos','Slim','level1','pub2')]:[task('概念启动','2040-01-01')],
 [getProjectLevel1MockSnapshotKey('verify-capability','pub2')]:publishedTasks,
 } })
technicalPlan.setState({plansByKey:{'verify-technical:tdt': {planKey:'verify-technical:tdt',templateKind:'tdt',versions:versions.map(v=>({...v,templateType:'tdt',tasks: v.status==='已发布'?publishedTasks:[task('规划启动','2050-01-01')]}))}}})
const dept = {id:'one',primaryDepartment:'研发中心',secondaryDepartment:'软件部',estimatedInvestment:12,planningPhase:2,conceptPhase:2,planningPhase2:2,developmentValidationPhase:2,marketIterationPhase:2,maintenancePhase:2,planPhase:2,developmentPhase:3,migrationPhase:3}
let assertions = 0
const eq = (actual,expected,message) => { assert.deepEqual(actual,expected,message); assertions++ }
for(let index=0;index<stores.length;index++) {
 const store=stores[index], category=categories[index]
 const template=store.getState().projects[0]
 const project={...template,id:`hr-${category}`,versions:[],ipmProjectCode:null,ipmProjectName:null}
 store.setState({projects:[project],monthlyInvestments:[]})
 const add = budgetType => index===0 ? store.getState().addVersion(project.id,budgetType,{projectLevel:'S',levelCoefficient:1,hrModelVersion:'V2026.1'}) : store.getState().addVersion(project.id,{budgetType,departmentInvestments:[dept,{...dept,id:'two',secondaryDepartment:'测试部'}],projectStartTime:'2026-03-01',projectEndTime:'2027-04-01'})
 add('annual')
 const first=store.getState().projects[0].versions[0]
 eq(first.versionNumber,'V0.1',category+' first version')
 add('annual')
 let current=store.getState().projects[0]
 eq(current.versions.map(v=>v.versionNumber),['V0.1','V0.2'],category+' sequential version')
 assert.notEqual(current.versions[0].id,current.versions[1].id,category+' IDs unique');assertions++
 const historical=JSON.stringify(current.versions[0].milestones ?? [current.versions[0].projectStartTime,current.versions[0].projectEndTime])
 store.getState().updateVersion(project.id,first.id,index===3?{projectStartTime:'2044-01-01',batch:20}:{milestones:index===2?{planningStart:'2044-01-01'}:{conceptStart:'2044-01-01'},batch:20})
 current=store.getState().projects[0]
 eq(JSON.stringify(current.versions[0].milestones ?? [current.versions[0].projectStartTime,current.versions[0].projectEndTime]),historical,category+' history dates guarded')
 eq(current.versions[0].batch,20,category+' historical batch editable')
 store.getState().updateVersion(project.id,first.id,{batch:21})
 eq(store.getState().projects[0].versions[0].batch,20,category+' invalid batch rejected')
 store.getState().bindIpmProject(project.id,`FORMAL-${category}`,`正式${category}`)
 add('projectEstimate');add('projectBudget')
 current=store.getState().projects[0]
 eq(current.versions.filter(v=>v.budgetType!=='annual').map(v=>v.versionNumber),['V0.1','V0.1'],category+' independent budgets')
 const latest=current.versions.find(v=>v.budgetType==='annual'&&v.minorVersion===2)
 eq(JSON.stringify(current.versions[0].milestones ?? [current.versions[0].projectStartTime,current.versions[0].projectEndTime]),historical,category+' binding preserves historical snapshot')
 eq(index===3?latest.projectStartTime:index===2?latest.milestones.planningStart:latest.milestones.conceptStart,index===2?'2027-04-01':'2026-03-01',category+' uses latest published main plan')
 store.getState().updateVersion(project.id,latest.id,index===3?{projectStartTime:'2044-01-01',batch:3}:{milestones:index===2?{planningStart:'2044-01-01'}:{conceptStart:'2044-01-01'},projectLevel:'C',batch:3})
 current=store.getState().projects[0]
 const now=current.versions.find(v=>v.id===latest.id)
 eq(index===3?now.projectStartTime:index===2?now.milestones.planningStart:now.milestones.conceptStart,index===2?'2027-04-01':'2026-03-01',category+' bound dates guarded')
 eq(now.batch,3,category+' latest batch editable')
 if(index===0){
  eq(now.projectLevel,'S','bound machine level');eq(current.projectYear,'26年立项27年结项','machine year derived')
  eq(store.getState().monthlyInvestments.length,9,'machine all model departments and budgets monthly')
  eq(store.getState().monthlyInvestments.filter(r=>r.versionId===latest.id).map(r=>r.batch),[3,3,3],'machine batch synchronized to all monthly departments')
  for(const row of store.getState().monthlyInvestments) eq(Math.round(Object.values(row.monthlyData).reduce((a,b)=>a+b,0)*10),Math.round(row.estimatedTotal*10),'machine monthly exact rounding')
}
 if(index!==0){
  eq(store.getState().monthlyInvestments.length,6,category+' every department and budget monthly');
  eq(store.getState().monthlyInvestments.filter(r=>r.versionId===latest.id).map(r=>r.batch),[3,3],category+' batch synchronized to monthly');
  const before=JSON.stringify(current.versions[0].departmentInvestments)
  store.getState().updateVersionDepartmentInvestments(project.id,first.id,[])
  eq(JSON.stringify(store.getState().projects[0].versions[0].departmentInvestments),before,category+' history investment protected')
 }
 const snapshot=JSON.stringify(store.getState().projects)
 store.getState().refreshFormalProjects()
 eq(JSON.stringify(store.getState().projects),snapshot,category+' refresh idempotent')
}
eq(rules.getMachineProjectYear({versions:[{createdAt:'2026-09-09T01:00:00Z',milestones:{conceptStart:'2025-01-01',str5:'2026-01-01'}},{createdAt:'2026-09-09T02:00:00Z',milestones:{conceptStart:'2027-01-01',str5:'2028-01-01'}}]}),'27年立项28年结项','year chooses full newest timestamp')
eq(rules.formatHrBatch(20),'第20批','batch label')
eq(formal.resolveHrFormalSource('tos','FORMAL-tos').milestones.marketIteration,'2027-04-01','tOS stage start derives from published child business period')
eq(formal.resolveHrFormalSource('tos','FORMAL-tos').milestones.maintenanceEnd,'2027-04-01','tOS maintenance end derives from published child business period')
const configMath=load('src/constants/hrConfig.ts')
const partialDepartment={...dept,estimatedInvestment:60,planningPhase:10,conceptPhase:10,planningPhase2:10,developmentValidationPhase:10,marketIterationPhase:10,maintenancePhase:10}
const partialTos=configMath.calcTosDepartmentMonthlySplit([partialDepartment],{planningKO:null,conceptStart:'2026-01-01',str1:'2026-01-31',str3:null,str5:null,marketIteration:null,maintenanceEnd:null})[0]
eq(partialTos.monthlyData,{'2026-01':10},'missing phases are not pushed into the last known month')
eq(partialTos.estimatedTotal,60,'unallocated investment remains part of estimated total')
const partialTech=configMath.calcTechDepartmentMonthlySplit([{...dept,estimatedInvestment:50,planningPhase:10,conceptPhase:10,planPhase:10,developmentPhase:10,migrationPhase:10}],{planningStart:'2026-01-01',charterDCP:'2026-01-31',tdr1:null,pdcp:null,tdcpx:null,edcp:null})[0]
eq(partialTech.monthlyData,{'2026-01':10},'technical missing phases remain unallocated')
const invertedTech=configMath.calcTechDepartmentMonthlySplit([{...dept,estimatedInvestment:24,planningPhase:2.4,conceptPhase:21.6,planPhase:0,developmentPhase:0,migrationPhase:0}],{planningStart:'2026-03-01',charterDCP:'2026-02-15',tdr1:'2026-03-10',pdcp:null,tdcpx:null,edcp:null})[0]
eq(Math.round(Object.values(invertedTech.monthlyData).reduce((sum,v)=>sum+v,0)*10),216,'inverted phases excluded from allocated amount and rounding target')
eq(invertedTech.estimatedTotal,24,'inverted phase investment remains unallocated')
// Model edits must keep the project, version and monthly total consistent even before binding.
const { useHrConfigStore: modelStore } = load('src/stores/hrConfig.ts')
const machineBeforeModelCheck = structuredClone(stores[0].getState().projects)
const monthlyBeforeModelCheck = structuredClone(stores[0].getState().monthlyInvestments)
const modelBefore = structuredClone(modelStore.getState().data)
const unbound = structuredClone(machineBeforeModelCheck[0])
unbound.ipmProjectCode = null
unbound.ipmProjectName = null
stores[0].setState({projects:[unbound],monthlyInvestments:[]})
stores[0].getState().refreshFormalProjects()
const unboundVersionBefore = stores[0].getState().projects[0].versions.find(v=>v.budgetType==='annual'&&v.minorVersion===2)
const historicalBeforeModel = JSON.stringify(stores[0].getState().projects[0].versions[0])
let changedModel = false
modelStore.setState({data:{...modelBefore,hrModel:modelBefore.hrModel.map(record=>{
 if(!changedModel && record.projectLevel==='S' && record.modelVersion==='V2026.1') { changedModel=true; return {...record,conceptPhase:Number(record.conceptPhase)+10} }
 return record
})}})
stores[0].getState().refreshFormalProjects()
const unboundAfter=stores[0].getState().projects[0]
const unboundLatest=unboundAfter.versions.find(v=>v.id===unboundVersionBefore.id)
eq(unboundLatest.estimatedInvestment,unboundVersionBefore.estimatedInvestment+10,'unbound latest version follows model edit')
eq(unboundAfter.annualBudget,unboundLatest.estimatedInvestment,'unbound project total follows model edit')
eq(stores[0].getState().monthlyInvestments.filter(r=>r.versionId===unboundLatest.id).reduce((sum,r)=>sum+r.estimatedTotal,0),unboundLatest.estimatedInvestment,'unbound monthly total follows model edit')
eq(JSON.stringify(unboundAfter.versions[0]),historicalBeforeModel,'model edit retains historical version snapshot')
modelStore.setState({data:modelBefore})
stores[0].setState({projects:machineBeforeModelCheck,monthlyInvestments:monthlyBeforeModelCheck})
// Publishing a new plan updates only the latest HR version of each budget type.
const machineStore = stores[0]
const firstHistory = JSON.stringify(machineStore.getState().projects[0].versions[0])
const updatedTasks = publishedTasks.map(t=>({...t,planStartDate:'2029-05-01',planEndDate:'2029-05-01'}))
planStore.setState({ publishedSnapshots:{ ...planStore.getState().publishedSnapshots, [getProjectMarketSnapshotKey('verify-machine','TR','pub2')]:updatedTasks } })
projectStore.setState({projects:projectStore.getState().projects.map(p=>p.id==='verify-machine'?{...p,fieldValues:{softwareProjectLevel:'A'}}:p)})
machineStore.getState().refreshFormalProjects()
eq(JSON.stringify(machineStore.getState().projects[0].versions[0]),firstHistory,'plan updates preserve complete historical snapshot')
eq(machineStore.getState().projects[0].versions.filter(v=>v.minorVersion===2||v.budgetType!=='annual').map(v=>v.milestones.conceptStart),['2029-05-01','2029-05-01','2029-05-01'],'all latest budget versions follow publication')
eq(machineStore.getState().projects[0].projectYear,'29年立项29年结项','machine year follows newest created version after publication')
const legacy = rules.normalizeHrVersionSequence([
 {id:'old-a',budgetType:'annual',minorVersion:0,majorVersion:1,versionNumber:'V1.0',createdAt:'2026-01-01',milestones:{conceptStart:'2025-01-01'}},
 {id:'old-b',budgetType:'annual',minorVersion:1,majorVersion:0,versionNumber:'V0.1',createdAt:'2026-02-01',batch:5},
 {id:'old-c',budgetType:'projectEstimate',minorVersion:0,majorVersion:1,versionNumber:'V1.0',createdAt:'2026-01-01'},
])
eq(legacy.map(v=>v.versionNumber),['V0.1','V0.2','V0.1'],'legacy lock numbers migrate per budget chronology')
eq(legacy[0].milestones.conceptStart,'2025-01-01','migration preserves historical dates')
eq(legacy[1].batch,5,'migration preserves batch')
const rounding = load('src/lib/hrMonthlyRounding.ts')
const rounded=rounding.roundHrMonthlyAllocation({'2026-01':1/3,'2026-02':1/3,'2026-03':1/3},1)
eq(Object.values(rounded).reduce((sum,v)=>Math.round((sum+v)*10)/10,0),1,'monthly rounding retains exact estimated total')
const capCalc=load('src/constants/hrCapability.ts')
const capMonths=capCalc.calcCapabilityMonthlySplit(34,'2026-01-01','2026-12-31')
eq(Math.round(Object.values(capMonths).reduce((sum,v)=>sum+v,0)*10),340,'capability full year allocation balanced')
// Persisted edits retain all departments and batches after rehydration.
const cap=stores[3]
const originalRecord=cap.getState().monthlyInvestments[0]
cap.getState().updateMonthlyInvestment(originalRecord.id,originalRecord.monthlyData)
const saved=JSON.parse(memory.get('pms-hr-capability'))
cap.setState({monthlyInvestments:[]})
memory.set('pms-hr-capability',JSON.stringify(saved))
await cap.persist.rehydrate()
eq(cap.getState().monthlyInvestments.length,6,'rehydration retains every department and budget')
eq(cap.getState().monthlyInvestments.find(r=>r.id===originalRecord.id).isEdited,true,'rehydration retains matching manual monthly edits')
eq(cap.getState().projects[0].versions[0].batch,20,'historical batch survives rehydration')
console.log(`HR investment rules: ${assertions} assertions passed`)
