#!/usr/bin/env node
import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'

globalThis.window = { localStorage: createCurrentDatasetStorage() }
const load = createTypeScriptModuleLoader()
const get = file => load(path.resolve(file))
const { useProjectStore: store, migrateProjectState, partializeProjectState, PROJECT_STORE_VERSION } = get('src/stores/project.ts')
const { useRoadmapStore: roadmap, mergeRoadmapPersistedState, createInitialRoadmapMockState } = get('src/stores/roadmap.ts')
const { useEnumStore: enums } = get('src/stores/enums.ts')
const { hasPermission } = get('src/stores/permission.ts')
const registry = get('src/lib/projectRegistry.ts')
const migration = get('src/lib/roadmapRegistryMigration.ts')
const adapter = get('src/lib/roadmapProjectAdapter.ts')
const { mergeProjectInfoValues } = get('src/lib/projectInfoValues.ts')
const { getProjectInfoModalSubmitValues } = get('src/lib/projectInfoRules.ts')
const admin = '演示用户01', owner = '演示用户02', stranger = '演示用户08'
enums.setState(state => ({ hasHydrated: true, hydrationError: null, rowsByType: { ...state.rowsByType, 'chip-mapping': [{ id:'registry-test-chip', chipCode:'DEMOCHIP001', chipModel:'DEMO SOC', chipPlatform:'示例平台A' }] } }))
store.setState({ projects: [], registryHistory: [], migratedRoadmapIds: [] })
let checks = 0
const check = (name, fn) => { fn(); checks++; console.log(`PASS ${name}`) }
const record = id => store.getState().projects.find(p => p.id === id)
const create = (projectAttribute, type, name) => {
  const result = registry.createConfiguredProject({ projectAttribute, type, name, responsiblePersons: [owner] }, admin)
  assert.equal(result.ok, true, result.message); return result.projectId
}
check('legacy migration preserves IDs, every original field, timestamps and all logs; repeats are no-ops', () => {
  const legacy = createInitialRoadmapMockState()
  roadmap.setState(legacy)
  const logs = JSON.stringify(roadmap.getState().changeLogs)
  const result = migration.migrateLegacyRoadmapRegistry()
  assert.deepEqual(result.importedIds, legacy.plannedProjects.map(p => p.id))
  const id = result.importedIds[0]
  assert.deepEqual(record(id).legacyRoadmapSnapshot, legacy.plannedProjects[0])
  for (const key of ['id','createdAt','createdBy','str5Estimated','launchEstimated','str5Date','launchDate']) assert.equal(record(id)[key], legacy.plannedProjects[0][key])
  assert.equal(JSON.stringify(roadmap.getState().changeLogs), logs)
  const snapshot = JSON.stringify(partializeProjectState(store.getState()))
  assert.deepEqual(migration.migrateLegacyRoadmapRegistry().importedIds, [])
  assert.equal(JSON.stringify(partializeProjectState(store.getState())), snapshot)
  assert.equal(hasPermission(owner, id, 'basicInfo:编辑'), true)
  assert.equal(hasPermission(stranger, id, 'basicInfo:编辑'), false)
})
check('deleted canonical migration stays deleted after actual reload and legacy seed replay', () => {
  const id = store.getState().migratedRoadmapIds[0]
  assert.equal(registry.deleteConfiguredProject(id, admin).ok, true)
  const fresh = createTypeScriptModuleLoader()
  const reloadedStore = fresh(path.resolve('src/stores/project.ts')).useProjectStore
  const reloadedRoadmap = fresh(path.resolve('src/stores/roadmap.ts')).useRoadmapStore
  reloadedRoadmap.setState(createInitialRoadmapMockState())
  fresh(path.resolve('src/lib/roadmapRegistryMigration.ts')).migrateLegacyRoadmapRegistry()
  assert.ok(reloadedStore.getState().migratedRoadmapIds.includes(id))
  assert.ok(!reloadedStore.getState().projects.some(p => p.id === id))
  const normalized = migrateProjectState(partializeProjectState(store.getState()), PROJECT_STORE_VERSION)
  assert.ok(normalized.migratedRoadmapIds.includes(id))
  const persisted = mergeRoadmapPersistedState({ ...createInitialRoadmapMockState(), plannedProjects: [], changeLogs: [] }, roadmap.getState())
  assert.deepEqual(persisted.plannedProjects, []); assert.deepEqual(persisted.changeLogs, [])
})
check('ID collision is surfaced without overwriting or marking the retained legacy record', () => {
  const legacy = createInitialRoadmapMockState().plannedProjects[0]
  store.setState({ projects: [{ ...migration.migrateLegacyRoadmapProject(legacy), projectAttribute: 'budget' }], migratedRoadmapIds: [] })
  roadmap.setState({ plannedProjects: [legacy] })
  assert.match(migration.migrateLegacyRoadmapRegistry().conflicts[0], /ID 冲突/)
  assert.equal(record(legacy.id).projectAttribute, 'budget'); assert.deepEqual(store.getState().migratedRoadmapIds, [])
  store.setState({ projects: [], migratedRoadmapIds: [] })
})
let manualId
check('minimal roadmap create appears immediately with canonical name and no invented timeline values', () => {
  manualId = create('roadmap', '整机产品项目', '最小路标项目')
  const row = adapter.adaptRegistryRoadmapProject(record(manualId))
  assert.equal(row.id, manualId); assert.equal(row.displayName, '最小路标项目')
  for (const key of ['projectCode','androidVersion','firstSaleTosVersionId','str5Date','launchDate','brand','productType']) assert.equal(row[key], '')
  assert.equal(adapter.adaptNormalProject(record(manualId), []), null)
  assert.equal(adapter.canPositionRoadmapRow(row), false)
})
check('space partial completion preserves identity and permissions, and projects saved form fields immediately', () => {
  const before = record(manualId)
  assert.equal(store.getState().updateProject(manualId, { remark: '无权修改' }, stranger), null)
  assert.ok(store.getState().updateProject(manualId, { remark: '允许分批补录' }, owner))
  const source = record(manualId)
  const values = getProjectInfoModalSubmitValues(source.type, { productType: '老品', androidVersion: 'Android 17', firstSaleTosVersion: '17.2.0', chipCode: 'DEMOCHIP001', startingRam: '8GB', versionType: 'Full', developmentMode: 'ODC' })
  const merged = mergeProjectInfoValues(source, values)
  const update = { ...merged, androidVersion: values.androidVersion, startRam: values.startingRam,
    developMode: values.developmentMode, firstSaleTosVersionId: values.firstSaleTosVersion,
    brand: '示例品牌A', str5Date: '2027-01-01', launchDate: '2027-02-01', str5Estimated: true, launchEstimated: true }
  assert.equal(get('src/lib/manualProjectCompletion.ts').validateManualProjectCompletion(update, source, enums.getState().rowsByType), null)
  assert.ok(store.getState().updateProject(manualId, update, owner), 'partial manual old product must not require a formal new-product family')
  const row = adapter.adaptRegistryRoadmapProject(record(manualId))
  assert.equal(row.androidVersion, 'Android 17'); assert.equal(row.chipCode, 'DEMOCHIP001'); assert.equal(row.startRam, '8GB'); assert.equal(row.str5Date, '2027-01-01'); assert.equal(row.str5Estimated, true); assert.equal(adapter.canPositionRoadmapRow(row), true)
  for (const key of ['name','type','projectCode','sourceBid','projectAttribute','boundFormalProjectId','createdAt','createdBy']) assert.equal(record(manualId)[key], before[key])
  assert.ok(store.getState().registryHistory.some(h => h.projectId === manualId && h.actor === owner && h.action === 'update'))
  assert.ok(roadmap.getState().changeLogs.some(h => h.projectId === manualId && h.source === 'planned' && h.actor === owner && h.action === 'update'))
  for (const patch of [{name:'绕过配置'}, {projectCode:'HACK'}, {type:'技术项目'}, {sourceBid:'EXT-001'}, {str5Date:'2027-02-30'}, {productType:'未知'}, {fieldValues:{chipCode:'UNKNOWN'}}]) assert.equal(store.getState().updateProject(manualId, patch, owner), null)
})
check('budget projects of all types accept partial space edits and never leak to roadmap projections', () => {
  for (const type of ['整机产品项目','tOS版本项目','技术项目','能力建设项目']) {
    const id = create('budget', type, `预算 ${type}`)
    assert.ok(store.getState().updateProject(id, { projectDescription: '分批补录' }, owner))
    assert.equal(adapter.adaptNormalProject(record(id), []), null)
    assert.equal(adapter.adaptRegistryRoadmapProject(record(id)), null)
    if (type === '技术项目') assert.equal(store.getState().updateProject(id, {fieldValues:{...record(id).fieldValues,projectYear:'wrong'}},owner),null)
  }
  const rows = adapter.mergeRoadmapProjects(store.getState().projects, createInitialRoadmapMockState().plannedProjects, [])
  assert.deepEqual(rows.map(row => row.id), [manualId])
})
check('actual manual form patch preserves responsibility and roles across all categories; history only reports changed business fields', () => {
  const completion = get('src/lib/manualProjectCompletion.ts')
  const { buildProjectInfoValues } = get('src/lib/projectInfoValues.ts')
  const { getProjectInfoFields } = get('src/constants/projectInfoSchema.ts')
  const { buildProjectRegistryHistoryRows } = get('src/lib/projectManagementUi.ts')
  for (const type of ['整机产品项目','tOS版本项目','技术项目','能力建设项目']) {
    const id = create(type === '整机产品项目' ? 'roadmap' : 'budget', type, `仅补录 ${type}`)
    const previous = record(id)
    const initial = buildProjectInfoValues(previous, getProjectInfoFields(type).map(f => f.key))
    const changed = completion.changedManualInfoValues({ ...initial, currentTosVersion: initial.currentTosVersion ?? '', machineOther: initial.machineOther ?? [],
      ...(type === '整机产品项目' ? {str5Date:'2027-04-16',remark:'只改日期备注'} : {projectDescription:'只改说明'}) }, initial)
    const responsibility = completion.resolveManualCompletionResponsibility(type, changed, [owner], [owner], previous.responsiblePersons)
    assert.deepEqual(responsibility, [owner])
    const patch = completion.buildManualProjectSpaceUpdate(previous, {infoValues:changed, responsiblePersons:responsibility, healthStatus:'正常',projectStatus:previous.status,projectSecondaryCategory:previous.secondaryCategory || ''})
    assert.deepEqual(patch.responsiblePersons,[owner]); assert.equal(patch.leader,owner)
    assert.equal(patch.projectCode,previous.projectCode); assert.equal(patch.sourceBid,previous.sourceBid)
    assert.ok(store.getState().updateProject(id,patch,owner)); assert.equal(hasPermission(owner,id,'basicInfo:编辑'),true)
    assert.deepEqual(record(id).responsiblePersons,[owner]); assert.equal(record(id).leader,owner)
    const entries = store.getState().registryHistory.filter(h=>h.projectId===id && h.action==='update')
    const displayed = buildProjectRegistryHistoryRows(entries, store.getState().projects)
    if (type === '整机产品项目') {
      assert.deepEqual(displayed.map(r=>r.field).sort(),['STR5时间','备注'])
      assert.ok(!displayed.some(r=>r.before===r.after))
    }
    registry.deleteConfiguredProject(id,admin)
  }
  assert.deepEqual(completion.resolveManualCompletionResponsibility('整机产品项目',{machineSpm:['演示用户03']},[owner],[owner],[owner]),['演示用户03'])
  assert.deepEqual(completion.resolveManualCompletionResponsibility('能力建设项目',{},['演示用户03'],[owner],[owner]),['演示用户03'])
})
check('single tOS team-role edits and explicit clearing preserve every untouched role and permission', () => {
  const completion = get('src/lib/manualProjectCompletion.ts')
  const { usePermissionStore: permissions } = get('src/stores/permission.ts')
  const id = create('budget', 'tOS版本项目', 'tOS团队增量补录')
  const baseline = { versionProjectManager:[owner], se:['演示用户03'], sqa:['演示用户04'] }
  assert.ok(store.getState().updateProject(id,{fieldValues:{...record(id).fieldValues,tosTeamRoles:baseline}},owner))
  const permissionSnapshot = JSON.parse(JSON.stringify(permissions.getState().rolePermissionsByProject[id]))
  const roleMembers = name => permissions.getState().rolesByProject[id].find(role=>role.name===name)?.members
  const submit = infoValues => {
    const current = record(id)
    const patch = completion.buildManualProjectSpaceUpdate(current,{infoValues,responsiblePersons:current.responsiblePersons,healthStatus:'正常',projectStatus:current.status,projectSecondaryCategory:current.secondaryCategory || ''})
    assert.ok(store.getState().updateProject(id,patch,owner))
    assert.equal(store.getState().syncTosTeamPermissionMembers(id),true)
  }
  for (const changedMembers of [['演示用户05'], []]) {
    submit({tosSe:changedMembers})
    assert.deepEqual(record(id).fieldValues.tosTeamRoles,{...baseline,se:changedMembers})
    assert.deepEqual(roleMembers('版本项目经理'),[owner]); assert.deepEqual(roleMembers('SQA'),['演示用户04'])
    assert.deepEqual(roleMembers('SE'),changedMembers)
    assert.deepEqual(record(id).responsiblePersons,[owner]); assert.equal(record(id).leader,owner)
    assert.equal(hasPermission(owner,id,'basicInfo:编辑'),true)
    assert.deepEqual(permissions.getState().rolePermissionsByProject[id],permissionSnapshot)
  }
  submit({tosVersion:'tOS手动快照'})
  assert.deepEqual(record(id).fieldValues.tosTeamRoles,{...baseline,se:[]})
  assert.deepEqual(roleMembers('版本项目经理'),[owner]); assert.deepEqual(roleMembers('SQA'),['演示用户04'])
  registry.deleteConfiguredProject(id,admin)
})
check('binding/unbinding and formal deletion preserve roadmap data and ID while canonical deletion removes projection', () => {
  const result = registry.createConfiguredProject({projectAttribute:'formal',sourceBid:'EXT-001',responsiblePersons:[owner]},admin)
  assert.equal(result.ok,true)
  assert.equal(registry.updateConfiguredProject(manualId,{boundFormalProjectId:result.projectId},admin).ok,true)
  assert.equal(registry.updateConfiguredProject(manualId,{boundFormalProjectId:null},admin).ok,true)
  assert.equal(record(manualId).str5Date,'2027-01-01')
  registry.updateConfiguredProject(manualId,{boundFormalProjectId:result.projectId},admin)
  assert.equal(registry.deleteConfiguredProject(result.projectId,admin).ok,true)
  assert.equal(record(manualId).boundFormalProjectId,null)
  assert.equal(registry.deleteConfiguredProject(manualId,owner).ok,false)
  assert.equal(registry.deleteConfiguredProject(manualId,admin).ok,true)
  assert.deepEqual(adapter.mergeRoadmapProjects(store.getState().projects,[],[]),[])
})
check('retired roadmap CRUD cannot bypass registry permission, source or history boundaries', () => {
  const previous = JSON.stringify(roadmap.getState().plannedProjects)
  for (const actor of [admin,owner,stranger]) {
    assert.equal(roadmap.getState().createPlannedProject({actor}).ok,false)
    assert.equal(roadmap.getState().updatePlannedProject('any',{actor}).ok,false)
    assert.equal(roadmap.getState().deletePlannedProject('any',actor).ok,false)
  }
  assert.equal(JSON.stringify(roadmap.getState().plannedProjects),previous)
})
console.log(`Roadmap registry verification passed (${checks} behavioral groups).`)
