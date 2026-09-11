#!/usr/bin/env node
import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'

globalThis.window = { localStorage: createCurrentDatasetStorage() }
const load = createTypeScriptModuleLoader()
const get = p => load(path.resolve(p))
const registry = get('src/lib/projectRegistry.ts')
const { useProjectStore: store, migrateProjectState, partializeProjectState, PROJECT_STORE_VERSION } = get('src/stores/project.ts')
const { usePermissionStore: permissions, hasPermission } = get('src/stores/permission.ts')
const { useEnumStore: enums } = get('src/stores/enums.ts')
enums.setState({ hasHydrated: true, hydrationError: null })
store.setState({ projects: [], registryHistory: [] })
const admin = '演示用户01', owner = '登记责任人'
let checks = 0
function check(name, fn) { fn(); checks++; console.log(`PASS ${name}`) }
const project = id => store.getState().projects.find(p => p.id === id)
const history = id => store.getState().registryHistory.filter(h => h.projectId === id)
const create = input => { const r = registry.createConfiguredProject({ responsiblePersons: [owner, '第二责任人'], ...input }, admin); assert.equal(r.ok, true, r.message); return r.projectId }
const update = (id, patch, actor = admin) => registry.updateConfiguredProject(id, patch, actor)
const manual = (type = '整机产品项目', projectAttribute = 'budget') => create({ projectAttribute, name: '新建项目', type })
let machine, tos, tech, capability, budget, roadmap
check('minimal formal registration supports all mapped categories and source-owned identity', () => {
  machine = create({ projectAttribute: 'formal', sourceBid: 'EXT-001', name: 'ignored', type: '技术项目' })
  tos = create({ projectAttribute: 'formal', sourceBid: 'EXT-003' })
  tech = create({ projectAttribute: 'formal', sourceBid: 'EXT-006' })
  capability = create({ projectAttribute: 'formal', sourceBid: 'EXT-008' })
  assert.deepEqual([machine,tos,tech,capability].map(id => project(id).type), ['整机产品项目','tOS版本项目','技术项目','能力建设项目'])
  assert.equal(project(machine).sourceBid, 'EXT-001'); assert.equal(project(machine).projectCode, 'DEMO021')
  assert.equal(project(tos).projectCode, ''); assert.equal(project(machine).createdBy, admin)
  assert.ok(project(machine).createdAt); assert.equal(project(machine).firstSaleTosVersion, undefined)
})
check('all manual categories and roadmap machine register without invented dates', () => {
  budget = manual(); roadmap = manual('整机产品项目', 'roadmap')
  for (const type of ['tOS版本项目','技术项目','能力建设项目']) manual(type)
  assert.equal(project(budget).planStartDate, ''); assert.equal(project(roadmap).sourceBid, undefined)
})
check('responsible people receive type roles plus isolated system administrator access', () => {
  for (const [id, role] of [[machine,'SPM'],[tos,'版本项目经理'],[tech,'技术项目负责人'],[capability,'系统管理员']]) {
    const roles = permissions.getState().rolesByProject[id]
    assert.deepEqual(roles.find(r => r.name === role).members, [owner,'第二责任人'])
    assert.deepEqual(roles.find(r => r.name === '系统管理员').members, [owner,'第二责任人'])
    assert.equal(hasPermission(owner, id, 'basicInfo:编辑'), true)
    assert.equal(hasPermission('演示用户03', id, 'basicInfo:编辑'), false)
  }
})
check('invalid attributes, roadmap categories, missing people/source/mapping and duplicate sources fail without history', () => {
  const before = store.getState().registryHistory.length
  for (const input of [
    { projectAttribute:'other', name:'x', type:'技术项目' },
    { projectAttribute:'roadmap',name:'x',type:'技术项目' },
    { projectAttribute:'budget',name:' ',type:'技术项目' },
    { projectAttribute:'budget',name:'x',type:'产品项目' },
    { projectAttribute:'formal',sourceBid:'missing' },
    { projectAttribute:'formal',sourceBid:'EXT-001' },
    { projectAttribute:'budget',name:'x',type:'技术项目',responsiblePersons:[] },
  ]) assert.equal(registry.createConfiguredProject({responsiblePersons:[owner],...input},admin).ok,false)
  const rows = enums.getState().rowsByType
  enums.setState({ rowsByType:{...rows,'project-category-mapping':[]} })
  assert.match(registry.createConfiguredProject({projectAttribute:'formal',sourceBid:'EXT-002',responsiblePersons:[owner]},admin).message,/映射/)
  enums.setState({rowsByType:rows}); assert.equal(store.getState().registryHistory.length,before)
})
check('trimmed codes are unique across all attributes; blank allowed; formal source fields readonly', () => {
  assert.equal(update(budget,{projectCode:' DEMO021 '}).ok,false)
  assert.equal(update(budget,{projectCode:' B-001 '}).ok,true); assert.equal(project(budget).projectCode,'B-001')
  assert.equal(update(roadmap,{projectCode:'B-001'}).ok,false)
  assert.equal(update(machine,{name:'fake'}).ok,false); assert.equal(update(machine,{projectCode:'fake'}).ok,false)
  assert.equal(update(budget,{projectCode:' '}).ok,true); assert.equal(project(budget).projectCode,'')
})
check('binding validates type and per-attribute uniqueness, supports rebind/unbind and no-op skips audit', () => {
  assert.equal(update(budget,{boundFormalProjectId:tos}).ok,false)
  assert.equal(update(budget,{boundFormalProjectId:machine}).ok,true)
  assert.equal(update(roadmap,{boundFormalProjectId:machine}).ok,true)
  const second = manual(); assert.equal(update(second,{boundFormalProjectId:machine}).ok,false)
  const count=history(budget).length; assert.equal(update(budget,{boundFormalProjectId:machine}).ok,true); assert.equal(history(budget).length,count)
  const otherFormal = create({projectAttribute:'formal',sourceBid:'EXT-002'})
  assert.equal(update(budget,{boundFormalProjectId:otherFormal}).ok,true)
  assert.equal(history(budget)[0].action,'rebind')
  assert.equal(update(budget,{boundFormalProjectId:null}).ok,true)
  assert.equal(update(second,{boundFormalProjectId:machine}).ok,true)
  assert.equal(update(machine,{boundFormalProjectId:tos}).ok,false)
  assert.equal(update(budget,{boundFormalProjectId:second}).ok,false)
})
check('configuration services and direct store entry enforce permissions and identity checks', () => {
  assert.equal(update(budget,{name:'no'},owner).ok,false)
  assert.equal(registry.deleteConfiguredProject(budget,owner).ok,false)
  assert.equal(registry.createConfiguredProject({projectAttribute:'budget',name:'x',type:'技术项目',responsiblePersons:[owner]},owner).ok,false)
  assert.equal(store.getState().updateProject(tech,{name:'fake'},owner),null)
  assert.equal(store.getState().updateProject(budget,{name:'no'},'unknown'),null)
  assert.equal(store.getState().deleteProject(budget,'unknown'),false)
  assert.equal(store.getState().updateProject(tech,{projectDescription:'bypass'},admin,{registryOperation:'update'}),null)
  assert.equal(store.getState().addProject({...project(tech),id:'forged',name:'forged',sourceBid:'missing'},admin,{registryOperation:'create'}),false)
  assert.equal(store.getState().addProject({...project(budget),id:'empty-people',responsiblePersons:[]},admin,{registryOperation:'create'}),false)
})
check('space mutations append immutable before/after audit; invalid detailed machine update stays rejected', () => {
  const before = history(tech).length
  assert.ok(store.getState().updateProject(tech,{projectDescription:'补充空间资料'},owner))
  assert.equal(history(tech).length,before+1)
  const entry=history(tech)[0]; assert.equal(entry.actor,owner); assert.equal(entry.after.projectDescription,'补充空间资料'); assert.ok(entry.timestamp)
  assert.equal(store.getState().updateProject(machine,{remark:'incomplete'},owner),null)
  assert.ok(store.getState().updateProject(tech,p => { p.projectDescription='再补充'; return p },owner))
  assert.equal(entry.after.projectDescription,'补充空间资料')
  assert.equal(history(tech)[0].before.projectDescription,'补充空间资料')
  assert.equal(store.getState().syncTosTeamPermissionMembersGuarded(tos,owner,'版本项目经理',[owner]),true)
  assert.equal(history(tos)[0].actor,owner)
})
check('deletion detaches linked records, keeps histories and deletion snapshots', () => {
  assert.equal(registry.deleteConfiguredProject(machine,admin).ok,true)
  assert.equal(project(machine),undefined); assert.equal(project(roadmap).boundFormalProjectId,null)
  assert.equal(history(machine)[0].action,'delete'); assert.equal(history(machine)[0].before.sourceBid,'EXT-001')
  assert.equal(history(roadmap)[0].action,'unbind')
})
check('migration keeps legacy fields, defaults formal, preserves deletion and audit across serialization', () => {
  const state = partializeProjectState(store.getState())
  const restored = migrateProjectState(JSON.parse(JSON.stringify(state)), PROJECT_STORE_VERSION-1)
  assert.equal(restored.projects.length,state.projects.length); assert.deepEqual(restored.registryHistory,state.registryHistory)
  const legacy = {...project(tech), projectAttribute:undefined, customPreserved:{value:42}}
  const migrated=migrateProjectState({projects:[legacy],projectListView:'card'},9)
  assert.equal(migrated.projects.length,1); assert.equal(migrated.projects[0].projectAttribute,'formal'); assert.deepEqual(migrated.projects[0].customPreserved,{value:42})
  assert.deepEqual(migrateProjectState({projects:[],registryHistory:state.registryHistory},9).projects,[])
})
check('actual persistence reload retains registry identities, roles and audit snapshots', () => {
  const again = createTypeScriptModuleLoader()
  const reloaded = again(path.resolve('src/stores/project.ts')).useProjectStore.getState()
  assert.equal(reloaded.projects.length,store.getState().projects.length)
  assert.equal(reloaded.projects.find(p => p.id === machine),undefined)
  assert.deepEqual(reloaded.registryHistory,store.getState().registryHistory)
  const roles = again(path.resolve('src/stores/permission.ts')).usePermissionStore.getState().rolesByProject[budget]
  assert.deepEqual(roles.find(r => r.name === '系统管理员').members,[owner,'第二责任人'])
})
console.log(`Project registry verification passed (${checks} behavioral groups).`)
