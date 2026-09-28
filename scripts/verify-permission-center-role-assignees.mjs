import assert from 'node:assert/strict'
import path from 'node:path'
import { loadTypeScriptModule } from './lib/typescript-module-loader.mjs'
const load = file => loadTypeScriptModule(path.resolve(file))
const lib = load('src/lib/permissionCenter.ts')
const module = load('src/stores/permission.ts')
const { usePermissionStore: store } = module
const constants = load('src/constants/permissionCenter.ts')
const admin = '演示用户01', reader = '演示用户02', departmentUser = '演示用户04'
const role = { id: 'assigned', groupId: 'g', name: 'Assigned', description: '', members: [reader], departments: ['示例测试组'] }
const cleanPolicy = (roleId, menuId, actions) => {
  const { users, departments, ...policy } = lib.createEmptyMenuPolicy(roleId, menuId)
  return { ...policy, actions }
}
const center = { version: 2, groups: [{ id: 'g', name: 'G' }], roles: [
  { id: constants.SUPER_ADMIN_ROLE_ID, groupId: 'g', name: '系统超级管理员', description: '', members: [admin], departments: [], builtin: 'superadmin' }, role,
], policies: [cleanPolicy(role.id, 'project.view', ['view', 'export']), cleanPolicy(role.id, 'roadmap.table', ['view'])] }
for (const user of [reader, departmentUser]) for (const menu of ['project.view', 'roadmap.table']) {
  assert.equal(lib.evaluateMenuPermission(center, user, menu), true, 'Role assignees must apply across every menu without menu-level lists')
}
assert.equal(lib.isRoleAssignedToUser(role, reader), true)
assert.equal(lib.isRoleAssignedToUser(role, departmentUser), true)
assert.equal(lib.isRoleAssignedToUser(role, 'invented'), false)
assert.deepEqual(lib.getAssignedPermissionUsers({ ...center, roles: [...center.roles, { ...role, id: 'no-policy', members: ['演示用户08'], departments: [] }] }).sort(), [admin, reader, departmentUser, '演示用户05', '演示用户06', '演示用户08'].sort())
assert.equal(lib.evaluateMenuPermission({ ...center, roles: center.roles.map(r => ({ ...r, members: [], departments: [] })), policies: center.policies.map(p => ({ ...p, users: [reader], departments: ['示例测试组'] })) }, reader, 'project.view'), false, 'Stale menu-level personnel cannot restore revoked role membership')
store.setState({ permissionCenter: center, permissionCenterError: undefined })
assert.equal(store.getState().setCenterRoleAssignees(reader, role.id, { users: [], departments: [] }).ok, false)
const original = store.getState().permissionCenter
for (const assignees of [{ users: ['invented'], departments: [] }, { users: [], departments: ['invented'] }]) {
  assert.equal(store.getState().setCenterRoleAssignees(admin, role.id, assignees).ok, false)
  assert.equal(store.getState().permissionCenter, original, 'Invalid assignment cannot partially mutate personnel')
}
assert.equal(store.getState().setCenterRoleAssignees(admin, role.id, { users: [], departments: [] }).ok, true)
for (const user of [reader, departmentUser]) for (const menu of ['project.view', 'roadmap.table']) assert.equal(module.hasMenuPermission(user, menu), false)
assert.equal(store.getState().setCenterRoleAssignees(admin, role.id, { users: [reader, reader], departments: ['示例测试组', '示例测试组'] }).ok, true)
assert.deepEqual(store.getState().permissionCenter.roles.find(r => r.id === role.id), role)
assert.equal(store.getState().setCenterRoleAssignees(admin, constants.SUPER_ADMIN_ROLE_ID, { users: [], departments: [] }).ok, false)
assert.equal(store.getState().setCenterRoleAssignees(admin, constants.SUPER_ADMIN_ROLE_ID, { users: [admin], departments: ['示例测试组'] }).ok, false)
const union = { ...center, roles: [...center.roles, { ...role, id: 'second', members: [reader], departments: [] }], policies: [...center.policies, cleanPolicy('second', 'roadmap.table', ['view', 'export'])] }
assert.equal(lib.evaluateMenuPermission(union, reader, 'roadmap.table', 'export'), true)
assert.equal(lib.evaluateMenuPermission({ ...union, roles: union.roles.filter(r => r.id !== 'second') }, reader, 'roadmap.table', 'export'), false)
assert.equal(lib.evaluateMenuPermission({ ...center, version: 1 }, reader, 'project.view'), false, 'Runtime only accepts the v2 model')
assert.equal(lib.evaluateMenuPermission({ ...center, policies: [{ ...center.policies[0], roleId: 'missing' }] }, reader, 'project.view'), false)
const old = { version: 1, groups: center.groups, roles: center.roles.map(({ departments, ...r }) => r), policies: center.policies.map(p => ({ ...p, users: [reader], departments: [] })) }
const projectSlot = { custom: [{ name: 'Custom', members: [reader], isFixed: false }] }
const migrated = module.migratePermissionState({ permissionCenter: old, rolesByProject: projectSlot, rolePermissionsByProject: { custom: { Custom: { 'basicInfo:编辑': false } } } }, 3)
assert.equal(migrated.permissionCenter.version, 2)
assert.deepEqual(migrated.rolesByProject, projectSlot)
assert.equal(migrated.rolePermissionsByProject.custom.Custom['basicInfo:编辑'], false)
assert.deepEqual(migrated.permissionCenter.groups.map(g => g.name), ['管理组', 'tOS路标组', '项目组'])
assert.deepEqual(migrated.permissionCenter.roles.find(r => r.builtin === 'superadmin').members, ['演示用户01', '演示用户07'])
assert.equal(migrated.permissionCenter.roles.some(r => /compat|legacy/.test(r.id)), false)
assert(migrated.permissionCenter.policies.every(p => lib.validateMenuPolicy(p).ok && !('users' in p) && !('departments' in p)))
assert.deepEqual(module.migratePermissionState({ ...migrated, permissionCenter: center }, module.PERMISSION_STORAGE_VERSION).permissionCenter, center, 'V2 customized model must not reset')
for (const invalid of [{ ...old, roles: [null] }, { ...old, policies: [{ ...old.policies[0], data: null }] }, { ...old, roles: old.roles.map(r => ({ ...r, members: ['invented'] })) }, { ...old, groups: [] }]) {
  const denied = module.migratePermissionState({ permissionCenter: invalid }, 3)
  assert(denied.permissionCenterError, 'Corrupt old snapshots must not seed superadmin')
  assert.equal(lib.isPermissionCenterAdmin(denied.permissionCenter, admin), false)
}
for (const version of [3, 4]) assert(module.migratePermissionState({ rolesByProject: {}, rolePermissionsByProject: {} }, version).permissionCenterError, 'Project-only initialization boundary remains before envelope v3')
console.log('Role membership across menus, atomic assignment, revocation/union, seed refresh, v2 preservation and fail-closed migration passed')
// Valid outer arrays cannot turn a semantically broken old grant into seed authority.
for (const policy of [
  { ...old.policies[0], data: { mode: 'conditions', conjunction: 'all', conditions: [{ id: 'missing-value', field: 'progress', operator: 'gt' }] } },
  { ...old.policies[0], columns: { mode: 'selected', fields: ['unknown-column'] } },
]) assert(module.migratePermissionState({ permissionCenter: { ...old, policies: [policy] } }, 3).permissionCenterError)

// Real persistence envelope: first refresh is serialized, and custom v2 edits survive a new module/browser load.
const storageMap = new Map([['pms:mock-dataset-version', '2026-09-15-v1'], [module.PERMISSION_STORAGE_KEY, JSON.stringify({ version: 3, state: { permissionCenter: old, rolesByProject: projectSlot, rolePermissionsByProject: {} } })]])
let failWrite = false
globalThis.window = { localStorage: { getItem: key => storageMap.get(key) ?? null, setItem: (key, value) => { if (failWrite) throw new Error('quota'); storageMap.set(key, value) }, removeItem: key => storageMap.delete(key) } }
const freshModule = () => loadTypeScriptModule(path.resolve('src/stores/permission.ts'), new Map())
const first = freshModule()
assert.equal(first.usePermissionStore.getState().permissionCenter.version, 2)
const savedSeed = JSON.parse(storageMap.get(module.PERMISSION_STORAGE_KEY))
assert.equal(savedSeed.version, module.PERMISSION_STORAGE_VERSION)
assert.equal(savedSeed.state.permissionCenter.version, 2)
assert.deepEqual(first.usePermissionStore.getState().rolesByProject.custom, projectSlot.custom)
assert.equal(first.usePermissionStore.getState().setCenterRoleAssignees(admin, 'roadmap-manager', { users: ['演示用户08'], departments: ['示例测试组'] }).ok, true)
const afterAssignment = first.usePermissionStore.getState().permissionCenter
failWrite = true
assert.equal(first.usePermissionStore.getState().setCenterRoleAssignees(admin, 'roadmap-manager', { users: [], departments: [] }).ok, false)
assert.equal(first.usePermissionStore.getState().permissionCenter, afterAssignment, 'Failed persisted assignee change retains entire original model')
failWrite = false
const second = freshModule()
assert.deepEqual(second.usePermissionStore.getState().permissionCenter, afterAssignment, 'New browser module must retain custom v2 personnel, departments and policies')
assert.equal(second.hasMenuPermission('演示用户08', 'roadmap.table', 'edit'), true)
assert.equal(second.hasMenuPermission('演示用户04', 'roadmap.evolution', 'edit'), true)
delete globalThis.window
console.log('Strict old-policy validation, actual envelope refresh, reload and atomic storage failure passed')
const dynamicOld = { ...old, policies: [{ ...old.policies[0], data: { mode: 'conditions', conjunction: 'all', conditions: [{ id: 'dynamic', field: 'templateTask::custom::gate', operator: 'gte', value: '2026-09-28' }] } }] }
assert.equal(lib.isValidLegacyPermissionCenter(dynamicOld), true, 'Complete dynamic conditions survive recognition before registry registration')
const corruptEnvelope = { version: 3, state: { permissionCenter: { ...old, policies: [{ ...old.policies[0], data: { mode: 'conditions', conjunction: 'all', conditions: [{ id: 'bad', field: 'name', operator: 'eq' }] } }] } } }
globalThis.window = { localStorage: { getItem: key => key === module.PERMISSION_STORAGE_KEY ? JSON.stringify(corruptEnvelope) : storageMap.get(key) ?? null, setItem: (key, value) => storageMap.set(key, value), removeItem: key => storageMap.delete(key) } }
const corruptRead = await store.persist.getOptions().storage.getItem(module.PERMISSION_STORAGE_KEY)
const deniedRead = store.persist.getOptions().merge(corruptRead.state, store.getInitialState())
assert(deniedRead.permissionCenterError, 'Actual storage reader rejects incomplete v1 conditions before reset')
assert.equal(lib.isPermissionCenterAdmin(deniedRead.permissionCenter, admin), false)
delete globalThis.window
