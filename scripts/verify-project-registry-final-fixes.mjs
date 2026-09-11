#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'
globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = { localStorage: globalThis.localStorage }
const load = createTypeScriptModuleLoader(), get = file => load(path.resolve(file))
const { useProjectStore: registry } = get('src/stores/project.ts')
const { usePermissionStore: permissions, hasPermission, hasDerivedMachineResponsibilityRoles } = get('src/stores/permission.ts')
const { createConfiguredProject, updateConfiguredProject } = get('src/lib/projectRegistry.ts')
const { buildManualProjectSpaceUpdate, resolveManualCompletionResponsibility } = get('src/lib/manualProjectCompletion.ts')
const { replaceProjectSystemAdministrators } = get('src/lib/projectResponsibility.ts')
const hr = get('src/lib/hrProjectRegistry.ts')
const admin = '演示用户01', previousOwner = '演示用户02', nextOwner = '演示用户09'
const project = id => registry.getState().projects.find(item => item.id === id)
const save = (id, infoValues, responsiblePersons = project(id).responsiblePersons, actor = admin) => {
  const previous = project(id)
  const candidate = buildManualProjectSpaceUpdate(previous, { infoValues, responsiblePersons,
    healthStatus: previous.healthStatus, projectStatus: previous.status, projectSecondaryCategory: previous.secondaryCategory || '' })
  return registry.getState().updateProject(id, () => candidate, actor)
}
let failed = 0, passed = 0
async function check(name, run) {
  try { await run(); passed++; console.log(`PASS ${name}`) }
  catch (error) { failed++; console.error(`FAIL ${name}: ${error.stack}`) }
}
await check('manual machine UI replacement/removal revokes derived source access, preserves independent roles/grants and reload', async () => {
  const created = createConfiguredProject({projectAttribute:'budget', type:'整机产品项目', name:'责任人最终回归', responsiblePersons:[previousOwner]}, admin)
  assert.equal(created.ok, true)
  const id = created.projectId
  const scopeId = 'owner-source-visibility-formal'
  registry.setState({projects:[...registry.getState().projects,{...project('1'),id:scopeId,sourceBid:'owner-source-visibility-formal'}]})
  permissions.getState().initProjectPermissions(scopeId)
  assert.equal(updateConfiguredProject(id,{boundFormalProjectId:scopeId},admin).ok,true)
  const formalRoles = structuredClone(permissions.getState().rolesByProject['1'])
  permissions.getState().setRolesForProject(id, roles => [...roles.map(role => role.name === '测试TPM' ? {...role,members:['独立测试人']} : role), {name:'独立读者',members:['独立用户'],isFixed:false}])
  permissions.getState().setRolePermissionsForProject(id, values => ({...values, SPM:{...values.SPM,'plan:导出':false}, 独立读者:{'basicInfo:查看':true}}))
  const grants = structuredClone(permissions.getState().rolePermissionsByProject[id])
  const runUiSave = (members, actor) => {
    const infoValues = {machineSpm:members}
    const responsible = resolveManualCompletionResponsibility(project(id).type,infoValues,members,project(id).responsiblePersons,project(id).responsiblePersons)
    assert.ok(save(id,infoValues,responsible,actor))
    // Same functional updater as ProjectSpaceContainer.handleProjectInfoSubmit; runs after store synchronization.
    if (!hasDerivedMachineResponsibilityRoles(project(id))) permissions.getState().setRolesForProjectGuarded(id,actor,roles => replaceProjectSystemAdministrators(roles,responsible))
  }
  runUiSave([nextOwner], previousOwner)
  assert.deepEqual(permissions.getState().rolesByProject[id].find(role => role.name === 'SPM').members,[nextOwner])
  for (const edit of [false,true]) assert.equal(hr.canAccessHrProject({pmsProjectId:id},edit,previousOwner),false)
  assert.equal(hasPermission(nextOwner,id,'basicInfo:编辑'),true)
  registry.setState({currentLoginUser:previousOwner})
  assert.equal(hasPermission(previousOwner,scopeId,'basicInfo:查看'),true)
  assert.equal(hr.isHrVersionVisible({pmsProjectId:id},'annual',scopeId),false,'formal permission cannot reveal removed owner annual source')
  registry.setState({currentLoginUser:admin})
  assert.deepEqual(permissions.getState().rolesByProject[id].find(role => role.name === '测试TPM').members,['独立测试人'])
  assert.equal(hr.canAccessHrProject({pmsProjectId:id},false,'独立用户'),true)
  assert.deepEqual(permissions.getState().rolePermissionsByProject[id],grants)
  await registry.persist.rehydrate(); await permissions.persist.rehydrate()
  assert.equal(hr.canAccessHrProject({pmsProjectId:id},true,previousOwner),false)
  runUiSave([], nextOwner)
  for (const role of ['SPM','系统管理员']) assert.deepEqual(permissions.getState().rolesByProject[id].find(item => item.name === role).members,[])
  await registry.persist.rehydrate(); await permissions.persist.rehydrate()
  assert.equal(hr.canAccessHrProject({pmsProjectId:id},false,nextOwner),false)
  assert.deepEqual(permissions.getState().rolesByProject['1'],formalRoles)
})
await check('bound machine ordinary save and alias writes cannot override exact formal metadata; manual dates remain writable', () => {
  const id = 'mock-budget-machine-bound'
  assert.ok(project(id).boundFormalProjectId)
  for (const [key,value] of Object.entries({brand:'示例品牌C',productLine:'预算覆盖产品线',marketName:'预算覆盖市场'})) {
    assert.equal(save(id,{[key]:value}),null,`${key} ordinary modal override rejected`)
    assert.equal(registry.getState().updateProject(id,{fieldValues:{...project(id).fieldValues,[key]:value}},admin),null,`${key} fieldValues override rejected`)
  }
  assert.ok(save(id,{remark:'其他字段照常补充',str5Date:'2028-01-01',launchDate:'2028-02-01'}))
  assert.equal(project(id).str5Date,'2028-01-01')
})
await check('unbind/delete retain exact last effective three fields across canonical/basic and HR, including empty source values', async () => {
  const id = 'mock-budget-machine-bound', sourceId = project(id).boundFormalProjectId
  registry.setState({projects:registry.getState().projects.map(item => item.id === sourceId ? {...item,brand:'示例品牌B',productLine:'最新产品线',marketName:'最新市场',fieldValues:{...item.fieldValues,brand:'示例品牌B',productLine:'最新产品线',marketName:'最新市场'}} : item)})
  assert.equal(updateConfiguredProject(id,{boundFormalProjectId:null},admin).ok,true)
  for (const [key,value] of Object.entries({brand:'示例品牌B',productLine:'最新产品线',marketName:'最新市场'})) {
    assert.equal(project(id)[key],value)
    assert.equal(project(id).fieldValues?.[key],value)
    assert.equal(hr.synchronizeHrRegistryRecord({id:'hr-test',pmsProjectId:id,ipmProjectCode:null},'machine')[key],value)
  }
  await registry.persist.rehydrate()
  assert.equal(project(id).marketName,'最新市场')
  assert.ok(save(id,{marketName:'解绑后手工市场'}))
  assert.equal(updateConfiguredProject(id,{boundFormalProjectId:sourceId},admin).ok,true)
  registry.setState({projects:registry.getState().projects.map(item => item.id === sourceId ? {...item,brand:undefined,productLine:'删除前产品线',marketName:'',fieldValues:{...item.fieldValues,brand:undefined,productLine:'删除前产品线',marketName:''}} : item)})
  assert.equal(registry.getState().deleteProject(sourceId,admin),true)
  assert.equal(project(id).boundFormalProjectId,null)
  assert.deepEqual([project(id).brand,project(id).productLine,project(id).marketName],['','删除前产品线',''])
  assert.equal(project(id).str5Date,'2028-01-01')
  await registry.persist.rehydrate()
  assert.equal(project(id).productLine,'删除前产品线')
})
await check('new canonical A to B to A cycle never revives stale HR B, and unrelated manual saves work after source metadata changes', () => {
  const seed = project('mock-budget-machine-bound')
  const formal = {...seed,id:'metadata-cycle-formal',projectAttribute:'formal',boundFormalProjectId:null,brand:'来源新增品牌',productLine:'A',marketName:'A',fieldValues:{}}
  const budget = {...seed,id:'metadata-cycle-budget',projectAttribute:'budget',boundFormalProjectId:null,brand:'示例品牌A',productLine:'A',marketName:'A',fieldValues:{}}
  registry.setState({projects:[...registry.getState().projects,formal,budget]})
  assert.equal(updateConfiguredProject(budget.id,{boundFormalProjectId:formal.id},admin).ok,true)
  const changeSource = (brand, line) => registry.setState({projects:registry.getState().projects.map(item => item.id === formal.id ? {...item,brand,productLine:line,marketName:line} : item)})
  changeSource('来源新增品牌','B')
  let row = hr.synchronizeHrRegistryRecord({id:'hr-cycle',pmsProjectId:budget.id,ipmProjectCode:null},'machine')
  assert.equal(row.productLine,'B')
  const {withBoundMachineBudgetMetadata: effective} = get('src/lib/boundMachineBudgetMetadata.ts')
  assert.equal(effective(project(budget.id),registry.getState().projects).brand,'来源新增品牌')
  assert.ok(save(budget.id,{remark:'来源变化后只补备注',str5Date:'2028-03-01',launchDate:'2028-04-01'}))
  // Capture the old canonical snapshot at A, then source B, then source A, without refreshing HR between the final source change and unbinding.
  row.hrCanonicalMetadata = {brand:'示例品牌A',productLine:'A',marketName:'A'}
  changeSource('示例品牌A','A')
  assert.equal(updateConfiguredProject(budget.id,{boundFormalProjectId:null},admin).ok,true)
  row = hr.synchronizeHrRegistryRecord(row,'machine')
  assert.equal(row.productLine,'A')
  assert.equal(project(budget.id).machineBudgetMetadataAuthority,'registry-v1')
  assert.equal(project(budget.id).str5Date,'2028-03-01')
})
await check('legacy HR-only retained metadata is adopted once by exact ID, while canonical edits win and reload is idempotent', async () => {
  const seed = project('mock-budget-machine-bound')
  const legacy = {...seed,id:'legacy-metadata-budget',boundFormalProjectId:null,machineBudgetMetadataAuthority:undefined,brand:'示例品牌A',productLine:'原产品线',marketName:'用户已改市场',fieldValues:{brand:'示例品牌A',productLine:'原产品线',marketName:'用户已改市场'}}
  registry.setState({projects:[...registry.getState().projects,legacy],selectedProject:legacy})
  const retained = {id:'legacy-hr',pmsProjectId:legacy.id,ipmProjectCode:null,brand:'示例品牌B',productLine:'HR保留产品线',marketName:'HR旧市场',hrCanonicalMetadata:{brand:'示例品牌A',productLine:'原产品线',marketName:'原市场'}}
  let row = hr.synchronizeHrRegistryRecord(retained,'machine')
  assert.deepEqual([row.brand,row.productLine,row.marketName],['示例品牌B','HR保留产品线','用户已改市场'])
  assert.deepEqual([project(legacy.id).brand,project(legacy.id).productLine,registry.getState().selectedProject.marketName],[row.brand,row.productLine,row.marketName])
  assert.equal(project(legacy.id).machineBudgetMetadataAuthority,'registry-v1')
  const normalized = JSON.stringify(project(legacy.id))
  await registry.persist.rehydrate()
  row = hr.synchronizeHrRegistryRecord(retained,'machine')
  assert.equal(JSON.stringify(project(legacy.id)),normalized)
  assert.ok(save(legacy.id,{productLine:'明确修改后产品线'}))
  row = hr.synchronizeHrRegistryRecord(retained,'machine')
  assert.equal(row.productLine,'明确修改后产品线')
  // A canonical edit before the first HR refresh must also defeat the legacy heuristic.
  const explicit = {...legacy,id:'legacy-explicit-before-refresh',fieldValues:{...legacy.fieldValues}}
  registry.setState({projects:[...registry.getState().projects,explicit]})
  assert.ok(save(explicit.id,{productLine:'编辑先于HR加载'}))
  row = hr.synchronizeHrRegistryRecord({...retained,pmsProjectId:explicit.id},'machine')
  assert.equal(row.productLine,'编辑先于HR加载')
  assert.equal(row.brand,'示例品牌B','editing one field before migration must preserve other retained fields')
  const {buildProjectRegistryHistoryRows} = get('src/lib/projectManagementUi.ts')
  assert.deepEqual(buildProjectRegistryHistoryRows([{id:'internal',projectId:explicit.id,action:'update',actor:admin,timestamp:'2026-09-11',changes:[{field:'machineBudgetMetadataAuthority',before:null,after:'registry-v1'}]}],registry.getState().projects),[],'internal provenance is not user-facing history')
})
await check('configuration text has shrink containment and full label tooltip, monthly guidance distinguishes budget and formal dates', () => {
  const config=fs.readFileSync('src/components/project-management/ProjectConfiguration.tsx','utf8')
  const css=fs.readFileSync('src/styles/globals.css','utf8')
  const notice=fs.readFileSync('src/components/hr-shared/MonthlyAllocationNotice.tsx','utf8')
  assert.match(config,/pms-project-config__cell-value/)
  assert.match(config,/title=\{boundName/)
  assert.match(css,/pms-project-config__cell-value[^}]*min-width:\s*0/s)
  assert.match(notice,/预算项目（含已绑定正式项目）/)
  assert.match(notice,/开始.*结束/)
  assert.doesNotMatch(notice,/已绑定正式项目的，请完善并发布/)
})
console.log(`Final registry regressions: ${passed} passed, ${failed} failed`)
if(failed) process.exitCode=1
