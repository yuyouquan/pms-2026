#!/usr/bin/env node
import assert from 'node:assert/strict'
import { createTypeScriptModuleLoader, resolveTypeScriptModule } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'
globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = { localStorage }
const load = createTypeScriptModuleLoader()
const { useProjectStore: registry } = load('src/stores/project.ts')
const { usePermissionStore: permissions } = load('src/stores/permission.ts')
const { createConfiguredProject, updateConfiguredProject } = load('src/lib/projectRegistry.ts')
const { buildProjectInfoValues, getProjectInfoValue } = load('src/lib/projectInfoValues.ts')
const { getProjectInfoFields } = load('src/constants/projectInfoSchema.ts')
const { normalizeTechnicalProjectValues, synchronizeTechnicalProjectRecord } = load('src/lib/technicalProjectRules.ts')
const { buildManualProjectSpaceUpdate, resolveManualCompletionResponsibility } = load('src/lib/manualProjectCompletion.ts')
const { reconcileHrRegistry, legacyHrBudgetId } = load('src/lib/hrProjectRegistry.ts')
const admin = '演示用户01', owners = ['演示用户02', '演示用户09']
const project = id => registry.getState().projects.find(row => row.id === id)
let passed = 0, failed = 0
async function check(label, run) {
  try { await run(); passed++; console.log('PASS ' + label) }
  catch (error) { failed++; console.error('FAIL ' + label + '\n' + error.stack) }
}
await check('minimal creation prefills every responsible person in machine, roadmap and technical editors', () => {
  for (const [attribute, type, field, role] of [
    ['budget', '整机产品项目', 'machineSpm', 'SPM'], ['roadmap', '整机产品项目', 'machineSpm', 'SPM'],
    ['budget', '技术项目', 'technicalLead', '技术项目负责人'],
  ]) for (const members of [[owners[0]], owners]) {
    const result = createConfiguredProject({projectAttribute:attribute, type, name:`复审-${type}-${members.length}`, responsiblePersons:members}, admin)
    assert.equal(result.ok, true)
    const p = project(result.projectId), fields = getProjectInfoFields(type)
    assert.equal(fields.find(row => row.key === field).inputType, 'people')
    assert.deepEqual(buildProjectInfoValues(p, fields.map(row => row.key))[field], members)
    for (const name of [role, '系统管理员']) assert.deepEqual(permissions.getState().rolesByProject[p.id].find(row => row.name === name).members, members)
  }
})
await check('legacy owner fields hydrate without reviving cleared or replaced canonical values', () => {
  const p = {id:'compat',name:'compat',type:'整机产品项目',spm:owners.join('、'),fieldValues:{spm:owners}}
  assert.deepEqual(getProjectInfoValue(p,'machineSpm'),owners)
  assert.deepEqual(getProjectInfoValue({...p,fieldValues:{...p.fieldValues,machineTeamRoles:{spm:[owners[1]]}}},'machineSpm'),[owners[1]])
  for (const canonical of [[],[owners[1]]]) assert.deepEqual(getProjectInfoValue({...p,fieldValues:{...p.fieldValues,machineSpm:canonical}},'machineSpm'),canonical)
  assert.deepEqual(getProjectInfoValue({...p,fieldValues:{}},'machineSpm'),owners)
  assert.deepEqual(getProjectInfoValue({...p,type:'技术项目',technicalLead:owners[0],fieldValues:{}},'technicalLead'),[owners[0]])
})
await check('technical multi-owner edit survives normalization, manual/formal save, role sync and reload', async () => {
  const result = createConfiguredProject({projectAttribute:'budget',type:'技术项目',name:'复审-多人保存',responsiblePersons:owners},admin)
  assert.equal(result.ok,true)
  const previous = project(result.projectId)
  const values = normalizeTechnicalProjectValues({...buildProjectInfoValues(previous,['technicalLead']),projectValue:'只补充业务信息'})
  assert.deepEqual(values.technicalLead,owners)
  const formal = synchronizeTechnicalProjectRecord({...previous,projectAttribute:'formal'},values)
  assert.deepEqual(formal.responsiblePersons,owners)
  assert.equal(formal.technicalLead,owners.join('、'))
  assert.deepEqual(buildProjectInfoValues(formal,['technicalLead']).technicalLead,owners)
  const changed = {...values,technicalLead:[owners[1]]}
  const responsiblePersons = resolveManualCompletionResponsibility(previous.type,changed,owners,owners,owners)
  const saved = buildManualProjectSpaceUpdate(previous,{infoValues:changed,responsiblePersons,healthStatus:previous.healthStatus,projectStatus:previous.status,projectSecondaryCategory:previous.secondaryCategory || ''})
  assert.equal(saved.technicalLead,owners[1])
  assert.ok(registry.getState().updateProject(previous.id,()=>saved,admin))
  for (const role of ['技术项目负责人','系统管理员']) assert.deepEqual(permissions.getState().rolesByProject[previous.id].find(row=>row.name===role).members,[owners[1]])
  await registry.persist.rehydrate(); await permissions.persist.rehydrate()
  assert.deepEqual(buildProjectInfoValues(project(previous.id),['technicalLead']).technicalLead,[owners[1]])
  assert.deepEqual(normalizeTechnicalProjectValues({technicalLead:owners[0]}).technicalLead,[owners[0]])
  assert.deepEqual(normalizeTechnicalProjectValues({technicalLead:[]}).technicalLead,[])
})
await check('actual technical form renders both owners as multi-select while other team fields stay single', () => {
  const React=load(resolveTypeScriptModule('react'))
  const {renderToStaticMarkup}=load(resolveTypeScriptModule('react-dom/server'))
  const {Form}=load(resolveTypeScriptModule('antd'))
  const Fields=load('src/components/technical-project/TechnicalProjectCreateFields.tsx').default
  function Harness(){
    const [form]=Form.useForm()
    return React.createElement(Form,{form,initialValues:{technicalLead:owners}},React.createElement(Fields,{form,
      fields:getProjectInfoFields('技术项目').filter(field=>field.group==='team'),existingProjects:[],validateRequiredOnCreate:false,
      groups:[{key:'team',label:'团队人员'}],activeGroups:['team'],onActiveGroupsChange:()=>{},
    }))
  }
  const html=renderToStaticMarkup(React.createElement(Harness))
  const leader=html.split('data-project-create-field="technicalLead"')[1]?.split('data-project-create-field="technicalProjectManager"')[0]
  assert.match(leader,/ant-select-multiple/)
  for(const owner of owners)assert.ok(leader.includes(owner))
  const manager=html.split('data-project-create-field="technicalProjectManager"')[1]?.split('data-project-create-field="testRepresentative"')[0]
  assert.match(manager,/ant-select-single/)
})
await check('each technical owner may maintain L1; a display join is never treated as one account', () => {
  const {canMaintainLevel1Plan}=load('src/lib/level1PlanRules.ts')
  const {getTechnicalLevel1MaintainerUsers}=load('src/lib/projectSpaceLevel1Rules.ts')
  const role=[{name:'技术项目负责人',members:owners}]
  const legacy={id:'legacy-lead',name:'legacy-lead',type:'技术项目'}
  assert.deepEqual(getTechnicalLevel1MaintainerUsers(legacy,role),owners)
  assert.deepEqual(getTechnicalLevel1MaintainerUsers({...legacy,technicalLead:owners[0],fieldValues:{technicalLead:[owners[1]]}},role),[owners[1]])
  assert.deepEqual(getTechnicalLevel1MaintainerUsers({...legacy,technicalLead:owners[0],fieldValues:{technicalLead:[]}},role),[])
  for(const technicalLead of [owners,owners.join('、')])for(const currentUser of owners){
    assert.equal(canMaintainLevel1Plan({projectType:'技术项目',currentUser,technicalLead,spmUsers:[],globalAdmins:[]}),true)
  }
  assert.equal(canMaintainLevel1Plan({projectType:'技术项目',currentUser:'演示用户08',technicalLead:owners,spmUsers:['演示用户08'],globalAdmins:[]}),false)
  assert.equal(canMaintainLevel1Plan({projectType:'技术项目',currentUser:owners[0],technicalLead:[],spmUsers:[],globalAdmins:[]}),false)
})
await check('new HR versions and edit/copy logs record the acting user without rewriting original creators', async () => {
  for (const [index, category] of ['Machine','Tos','Technical','Capability'].entries()) {
    registry.setState({currentLoginUser:admin})
    const created=createConfiguredProject({projectAttribute:'budget',type:['整机产品项目','tOS版本项目','技术项目','能力建设项目'][index],name:`复审投入记录-${category}`,responsiblePersons:[owners[0]]},admin)
    assert.equal(created.ok,true)
    const store=load(`src/stores/hr${category}.ts`)[`useHr${category}Store`]
    store.getState().refreshFormalProjects()
    const record=store.getState().projects.find(p=>p.pmsProjectId===created.projectId)
    const seed=store.getState().projects.find(p=>p.pmsProjectId===`mock-budget-${category.toLowerCase()}-bound`).versions[0]
    registry.setState({currentLoginUser:owners[0]})
    if(index===0)store.getState().addVersion(record.id,'annual',{projectLevel:'S',levelCoefficient:1,hrModelVersion:'V2026.1',milestones:seed.milestones})
    else store.getState().addVersion(record.id,{budgetType:'annual',departmentInvestments:structuredClone(seed.departmentInvestments),milestones:seed.milestones,projectStartTime:'2027-01-01',projectEndTime:'2027-12-01'})
    const versions=()=>store.getState().projects.find(p=>p.id===record.id).versions
    assert.equal(versions().length,1)
    assert.equal(versions()[0].createdBy,owners[0])
    if(index!==0){
      assert.ok(versions()[0].operationLogs.every(log=>log.operator===owners[0]))
      const original=structuredClone(versions()[0])
      registry.setState({currentLoginUser:admin})
      store.getState().copyVersion(record.id,original.id)
      const copy=versions()[1]
      assert.equal(copy.createdBy,admin)
      assert.ok(copy.operationLogs.every(log=>log.operator===admin))
      assert.equal(versions()[0].createdBy,owners[0])
      assert.deepEqual(versions()[0].operationLogs.slice(0,original.operationLogs.length),original.operationLogs)
      assert.ok(versions()[0].operationLogs.slice(original.operationLogs.length).every(log=>log.operator===admin))
      registry.setState({currentLoginUser:owners[0]})
      store.getState().updateVersion(record.id,copy.id,index===3?{projectEndTime:'2028-01-01'}:{milestones:{...copy.milestones,...(index===1?{planningKO:'2026-01-01'}:{planningStart:'2026-01-01'})}})
      assert.equal(versions()[1].operationLogs.at(-1).operator,owners[0])
      const updateDepartments=store.getState().updateVersionDepartmentInvestments || store.getState().updateDepartmentInvestments
      updateDepartments(record.id,copy.id,structuredClone(copy.departmentInvestments))
      assert.equal(versions()[1].operationLogs.at(-1).operator,owners[0])
    }
    // Persistence uses JSON; undefined optional fields are intentionally omitted.
    const before=JSON.parse(JSON.stringify(versions()))
    await store.persist.rehydrate()
    assert.deepEqual(versions(),before)
  }
  registry.setState({currentLoginUser:admin})
})

const formalSeed = structuredClone(project('1'))
const formal = code => ({...formalSeed,id:`formal-${code}`,sourceBid:code,projectCode:code})
const old = (id, code) => ({id,name:`旧年度-${id}`,ipmProjectCode:code,createdBy:admin,createdAt:'2026-01-01',status:'active',versions:[{id:`${id}-v1`,projectId:id,budgetType:'annual',milestones:{conceptStart:'2027-01-01'},locked:true,batch:'旧批次'}]})
const reset = projects => registry.setState({projects,registryHistory:[]})
const annual = (result,id) => result.projects.find(row=>row.pmsProjectId===legacyHrBudgetId('machine',id))
await check('annual-only unknown, duplicate claims and occupied binding warn; ordinary independent annual does not', () => {
  for (const scenario of ['unknown','duplicate','occupied','independent']) {
    const source = formal(scenario), rows = scenario==='duplicate' ? [old('a',scenario),old('b',scenario)] : [old('a',scenario==='independent'?null:scenario)]
    reset(scenario==='unknown'||scenario==='independent' ? [] : [source,...(scenario==='occupied'?[{...source,id:'existing-budget',projectAttribute:'budget',boundFormalProjectId:source.id}]:[])])
    const monthly = rows.map(row=>({projectId:row.id,versionId:row.versions[0].id,monthlyData:{'2027-01':0,'2027-02':12},isEdited:true}))
    const result = reconcileHrRegistry(rows,monthly,'machine',false)
    for (const row of rows) {
      const migrated = annual(result,row.id)
      assert.equal(Boolean(migrated.migrationIssue),scenario!=='independent',scenario)
      assert.deepEqual(migrated.legacyHrSnapshot,row)
      assert.deepEqual(migrated.versions,row.versions.map(v=>({...v,projectId:migrated.id})))
    }
    assert.deepEqual(result.monthlyInvestments,monthly.map(row=>({...row,projectId:`${row.projectId}:annual`})))
    assert.deepEqual(reconcileHrRegistry(result.projects,result.monthlyInvestments,'machine',true),result)
  }
})
await check('already migrated conflicts are diagnosed without rebinding; explicit bind/unbind and source deletion resolve warnings', () => {
  const source = formal('resolve'), legacy = old('retained','resolve')
  reset([])
  let result = reconcileHrRegistry([legacy],[],'machine',false)
  let row = annual(result,legacy.id)
  // Reproduce the previously shipped annual migration: snapshot retained, diagnostic absent.
  delete row.migrationIssue; delete row.annualBindingMigrationIssue
  result = reconcileHrRegistry(result.projects,[],'machine',true)
  row = annual(result,legacy.id)
  assert.ok(row.migrationIssue)
  registry.setState({projects:[...registry.getState().projects,source]})
  assert.equal(updateConfiguredProject(row.pmsProjectId,{name:'改名不会处理关联'},admin).ok,true)
  // Ambiguity remains until the user chooses a binding, even after the source reappears.
  result = reconcileHrRegistry(result.projects,[],'machine',true)
  assert.ok(annual(result,legacy.id).migrationIssue)
  assert.equal(project(row.pmsProjectId).boundFormalProjectId,null)
  assert.equal(updateConfiguredProject(row.pmsProjectId,{boundFormalProjectId:source.id},admin).ok,true)
  result = reconcileHrRegistry(result.projects,[],'machine',true)
  assert.equal(annual(result,legacy.id).migrationIssue,undefined)
  assert.equal(updateConfiguredProject(row.pmsProjectId,{boundFormalProjectId:null},admin).ok,true)
  assert.equal(annual(reconcileHrRegistry(result.projects,[],'machine',true),legacy.id).migrationIssue,undefined)
  reset([source])
  result = reconcileHrRegistry([legacy],[],'machine',false)
  assert.equal(annual(result,legacy.id).migrationIssue,undefined)
  assert.equal(registry.getState().deleteProject(source.id,admin),true)
  result = reconcileHrRegistry(result.projects,[],'machine',true)
  assert.equal(annual(result,legacy.id).migrationIssue,undefined)
  assert.equal(annual(result,legacy.id).versions[0].id,legacy.versions[0].id)
})
await check('annual and nonannual snapshots claim once; diagnostics preserve unrelated warnings and ignore non-exact legacy IDs', () => {
  const source=formal('split'), legacy=old('split','split')
  legacy.versions.push({...legacy.versions[0],id:'split-estimate',budgetType:'projectEstimate'})
  reset([source])
  let result=reconcileHrRegistry([legacy],[],'machine',false)
  assert.equal(project(annual(result,'split').pmsProjectId).boundFormalProjectId,source.id)
  assert.deepEqual(reconcileHrRegistry(result.projects,result.monthlyInvestments,'machine',true),result)
  reset([])
  result=reconcileHrRegistry([old('unrelated','UNKNOWN')],[],'machine',false)
  const row=annual(result,'unrelated');row.migrationIssue='外部人工核对提示'
  assert.equal(annual(reconcileHrRegistry(result.projects,[],'machine',true),'unrelated').migrationIssue,'外部人工核对提示')
  const other={...row,pmsProjectId:'not-a-legacy-import',migrationIssue:undefined,annualBindingMigrationIssue:undefined}
  assert.equal(reconcileHrRegistry([other],[],'machine',true).projects[0].migrationIssue,undefined)
})
console.log(`Project management reaudit: ${passed} passed, ${failed} failed`)
if (failed) process.exitCode=1
