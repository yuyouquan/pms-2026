import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'

globalThis.window = { localStorage: createCurrentDatasetStorage() }
const load = createTypeScriptModuleLoader()
const get = p => load(path.resolve(p))
const registry = get('src/lib/projectRegistry.ts')
const { useProjectStore: store, partializeProjectState, migrateProjectState, PROJECT_STORE_VERSION } = get('src/stores/project.ts')
const { usePermissionStore: permissions, hasPermission } = get('src/stores/permission.ts')
get('src/stores/enums.ts').useEnumStore.setState({ hasHydrated: true, hydrationError: null })
const types = ['整机产品项目', 'tOS版本项目', '技术项目', '能力建设项目']
const scopes = [
  ...types.map((type, index) => ({ projectAttribute: 'formal', type, sourceBid: ['EXT-001','EXT-003','EXT-006','EXT-008'][index] })),
  ...types.map(type => ({ projectAttribute: 'budget', type, name: '权限预算' })),
  { projectAttribute: 'roadmap', type: types[0], name: '权限路标' },
]
const grants = {
  '乔永峰': [0], '徐如秀（大圆）': [0], '孙仁海': [1], '游进': [1,3,4,5,6,7],
  '邓伟俊': [2], '陈佩玲': [2], '王健（Jim）': [8], '演示用户01': scopes.map((_, i) => i), '演示用户02': [],
}
const owners = ['演示用户04', '演示用户05']
let checks = 0
function check(name, fn) { fn(); checks++; console.log(`PASS ${name}`) }
const reset = () => store.setState({ projects: [], registryHistory: [] })
const create = (scope, actor) => registry.createConfiguredProject({ ...scope, responsiblePersons: [...owners, ' 演示用户04 '] }, actor)

check('named managers and administrator follow the full attribute/type matrix', () => {
  for (const [actor, allowed] of Object.entries(grants)) for (const [index, scope] of scopes.entries()) {
    reset()
    const result = create(scope, actor)
    assert.equal(result.ok, allowed.includes(index), `${actor} / ${scope.projectAttribute} / ${scope.type}: ${result.message}`)
    assert.equal(store.getState().projects.length, result.ok ? 1 : 0)
    assert.equal(store.getState().registryHistory.length, result.ok ? 1 : 0)
  }
})

check('registry editing follows the same scope while delete remains administrator-only', () => {
  for (const [actor, allowed] of Object.entries(grants)) for (const [index, scope] of scopes.entries()) {
    reset()
    const { projectId } = create(scope, '演示用户01')
    const saved = store.getState().projects[0]
    const patch = scope.projectAttribute === 'formal' ? { name: saved.name } : { name: '已修改' }
    assert.equal(registry.updateConfiguredProject(projectId, patch, actor).ok, allowed.includes(index), `${actor} edits ${index}`)
    assert.equal(Boolean(store.getState().updateProject(projectId, patch, actor, { registryOperation: 'update' })), allowed.includes(index), `${actor} direct edits ${index}`)
    if (actor !== '演示用户01') assert.equal(registry.deleteConfiguredProject(projectId, actor).ok, false)
  }
})

check('source mapping and direct store authorization cannot bypass the matrix', () => {
  reset()
  assert.equal(create({ ...scopes[0], type: '技术项目' }, '邓伟俊').ok, false)
  assert.equal(create({ ...scopes[0], type: '技术项目' }, '乔永峰').ok, true)
  const project = store.getState().projects[0]
  reset()
  assert.equal(store.getState().addProject({ ...project, createdBy: '邓伟俊' }, '邓伟俊', { registryOperation: 'create' }), false)
  assert.equal(store.getState().addProject(project, '乔永峰', { registryOperation: 'create' }), true)
})

check('creation choices expose only authorized attributes and types; legacy types resolve without name substring grants', () => {
  const policy = get('src/lib/projectRegistryPermissions.ts')
  assert.deepEqual(policy.getCreatableProjectAttributes('乔永峰', false), ['formal'])
  assert.deepEqual(policy.getCreatableProjectAttributes('游进', false), ['formal', 'budget'])
  assert.deepEqual(policy.getCreatableProjectAttributes('王健（Jim）', false), ['roadmap'])
  assert.deepEqual(policy.getCreatableProjectTypes('游进', 'formal', false), ['tOS版本项目', '能力建设项目'])
  assert.equal(policy.canEditProjectRegistry('乔永峰', { type: '整机-手机' }, false), true)
  assert.equal(policy.canAccessProjectRegistry('乔永峰访客', false), false)
  assert.equal(policy.canAccessProjectRegistry('', true), false)
  assert.equal(policy.canConfigureProjectScope('演示用户01', 'unknown', '技术项目', true), false)
})

check('selected people receive type roles and space administrator; operator gains no space editing', () => {
  for (const [index, role] of ['SPM','版本项目经理','技术项目负责人','系统管理员'].entries()) {
    reset()
    const actor = ['乔永峰','孙仁海','邓伟俊','游进'][index]
    const { projectId } = create(scopes[index], actor)
    const roles = permissions.getState().rolesByProject[projectId]
    assert.deepEqual(roles.find(r => r.name === role).members, owners)
    assert.deepEqual(roles.find(r => r.name === '系统管理员').members, owners)
    assert.equal(hasPermission(actor, projectId, 'basicInfo:编辑'), false)
    for (const owner of owners) assert.equal(hasPermission(owner, projectId, 'basicInfo:编辑'), true)
    assert.equal(store.getState().updateProject(projectId, { projectDescription: '越权' }, actor), null)
  }
})

check('creation persists simulated recipient/message snapshots; edits and failures never resend', () => {
  for (const [index, scope] of scopes.entries()) {
    reset()
    const result = create(scope, '演示用户01')
    assert.equal(result.ok, true)
    const entry = store.getState().registryHistory[0]
    const notice = entry.notification
    if (index === 3) { assert.equal(notice, undefined); continue }
    assert.equal(notice.status, 'simulated')
    assert.deepEqual(notice.recipients, index < 3 ? owners : index < 8 ? ['游进'] : ['王健（Jim）'])
    assert.match(notice.body, /补全/)
    assert.ok(notice.body.includes(entry.after.name))
    assert.ok(notice.subject.includes('项目'))
    const original = JSON.stringify(notice)
    registry.updateConfiguredProject(result.projectId, { name: entry.after.name }, '演示用户01')
    assert.equal(store.getState().registryHistory.filter(item => item.notification).length, 1)
    assert.equal(create(scope, '无权限用户').ok, false)
    assert.equal(store.getState().registryHistory.filter(item => item.notification).length, 1)
    const restored = migrateProjectState(JSON.parse(JSON.stringify(partializeProjectState(store.getState()))), PROJECT_STORE_VERSION)
    assert.equal(JSON.stringify(restored.registryHistory.find(item => item.id === entry.id).notification), original)
  }
})
console.log(`project creation rules: ${checks} groups passed`)
