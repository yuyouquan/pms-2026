import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'
globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = { localStorage }
const load = createTypeScriptModuleLoader(), get = file => load(path.resolve(file))
const mod = get('src/stores/permission.ts'), store = mod.usePermissionStore
const { PERMISSION_USER_DEPARTMENTS } = get('src/constants/permissionCenter.ts')
const { canEnterProjectSpace } = get('src/lib/projectListFilters.ts')
const user = '演示用户09', dept = PERMISSION_USER_DEPARTMENTS[user][0], admin = '演示用户01'
const state = () => store.getState()
store.setState({ rolesByProject: { scoped: [{ name: 'Team', members: [], departments: [dept], isFixed: false }], other: [] }, rolePermissionsByProject: { scoped: { Team: { 'basicInfo:编辑': true, 'projectPermission:manageRoles': true } }, other: {} } })
assert.equal(mod.hasPermission(user, 'scoped', 'basicInfo:编辑'), true, 'department inherits project grants')
assert.equal(mod.hasPermission(user, 'other', 'basicInfo:编辑'), false)
assert.equal(mod.hasGlobalPermission(user, 'permissionCenter:manageRoles'), false)
assert.equal(canEnterProjectSpace('scoped', user, state().rolesByProject, false), true)
assert.equal(state().createProjectRole(user, 'other', { name: 'No', groupName: 'G' }).ok, false)
assert.equal(state().updateProjectRole(user, 'scoped', 'Team', { name: ' Renamed ', groupName: ' G ', description: ' D ' }).ok, true)
assert.equal(mod.hasPermission(user, 'scoped', 'projectPermission:manageRoles'), true, 'own role rename preserves authority atomically')
assert.equal(state().rolePermissionsByProject.scoped.Team, undefined)
for (const name of ['__proto__', 'constructor', 'prototype', ' __PROTO__ ']) {
  const beforeRoles = state().rolesByProject
  const beforeGrants = state().rolePermissionsByProject
  const beforeStorage = localStorage.getItem(mod.PERMISSION_STORAGE_KEY)
  assert.equal(state().createProjectRole(user, 'scoped', { name, groupName: 'G' }).ok, false, `reserved create rejected: ${name}`)
  assert.equal(state().updateProjectRole(user, 'scoped', 'Renamed', { name, groupName: 'G' }).ok, false, `reserved rename rejected: ${name}`)
  assert.equal(state().rolesByProject, beforeRoles, 'rejected actions preserve roles reference')
  assert.equal(state().rolePermissionsByProject, beforeGrants, 'rejected actions preserve grants reference')
  assert.equal(localStorage.getItem(mod.PERMISSION_STORAGE_KEY), beforeStorage, 'rejection does not persist')
  await store.persist.rehydrate()
  assert.equal(mod.hasPermission(user, 'scoped', 'projectPermission:manageRoles'), true, 'rejected own-role rename retains authority after reload')
  assert.ok(state().rolesByProject.scoped.some(role => role.name === 'Renamed'))
}

assert.equal(state().createProjectRole(user, 'scoped', { name: 'renamed', groupName: 'G' }).ok, false)
assert.equal(state().createProjectRole(user, 'scoped', { name: 'New', groupName: ' ' }).ok, false)
assert.equal(state().createProjectRole(user, 'scoped', { name: 'New', groupName: 'G' }).ok, true)
assert.equal(state().setProjectRoleDepartments(user, 'scoped', 'New', ['fake']).ok, false)
assert.equal(state().setProjectRoleDepartments(user, 'scoped', 'New', [null]).ok, false)
const snapshot = JSON.stringify(state().rolesByProject)
const originalSet = localStorage.setItem
localStorage.setItem = () => { throw Error('quota') }
assert.equal(state().updateProjectRole(user, 'scoped', 'Renamed', { name: 'Failed', groupName: 'G' }).ok, false)
assert.equal(JSON.stringify(state().rolesByProject), snapshot)
localStorage.setItem = originalSet
const project = { id: 'scoped', type: '技术项目', technicalLead: admin }
state().ensureProjectPermissions([project])
assert.equal(state().setProjectRoleDepartments(admin, 'scoped', '技术项目负责人', [dept]).ok, true)
state().syncProjectTeamPermissionMembers({ ...project, technicalLead: '演示用户02' })
assert.deepEqual(state().rolesByProject.scoped.find(r => r.name === '技术项目负责人').departments, [dept])
assert.deepEqual(state().rolesByProject.scoped.find(r => r.name === '技术项目负责人').members, ['演示用户02'])
assert.equal(state().updateProjectRole(admin, 'scoped', '技术项目负责人', { name: 'Oops', groupName: 'G' }).ok, false)
assert.equal(state().deleteProjectRole(admin, 'scoped', '技术项目负责人').ok, false)
await store.persist.rehydrate()
assert.deepEqual(state().rolesByProject.scoped.find(r => r.name === 'Renamed').departments, [dept])
assert.equal(state().rolesByProject.scoped.find(r => r.name === 'Renamed').description, 'D')
assert.equal(state().setProjectRoleDepartments(admin, 'scoped', 'Renamed', []).ok, true)
assert.equal(state().setProjectRoleDepartments(admin, 'scoped', '技术项目负责人', []).ok, true)
assert.equal(mod.hasPermission(user, 'scoped', 'basicInfo:编辑'), false, 'revocation removes inherited access')
assert.equal(canEnterProjectSpace('scoped', user, state().rolesByProject, false), false)
assert.equal(state().deleteProjectRole(admin, 'scoped', 'Renamed').ok, true)
assert.equal(state().rolePermissionsByProject.scoped.Renamed, undefined)
const { roleAppliesToUser } = get('src/lib/projectRoleMembership.ts')
assert.equal(roleAppliesToUser({ members: [], departments: [dept] }, 'unknown'), false)
assert.equal(roleAppliesToUser({ members: ['legacy-user'] }, 'legacy-user'), true, 'explicit historical membership remains supported')
assert.equal(roleAppliesToUser({ members: [], departments: 'bad' }, user), false)
const migrated = mod.migratePermissionState({ rolesByProject: { x: [{ name: ' Old ', members: [], isFixed: false }, { name: 'Bad', members: [], departments: [null, {}, 'fake', dept, dept], groupName: ' G ', description: ' D ' }] }, rolePermissionsByProject: {} }, 1)
assert.equal('departments' in migrated.rolesByProject.x[0], false, 'legacy optional fields remain absent')
assert.deepEqual(migrated.rolesByProject.x[1].departments, [dept])
const machine = { id: 'department-machine', type: '整机产品项目', createdBy: admin, responsiblePersons: [admin] }
state().ensureProjectPermissions([machine])
assert.equal(state().setProjectRoleDepartments(admin, machine.id, 'SPM', [dept]).ok, true)
state().syncProjectTeamPermissionMembers(machine)
state().ensureProjectPermissions([machine])
assert.deepEqual(state().rolesByProject[machine.id].find(r => r.name === 'SPM').departments, [dept])
assert.deepEqual(state().rolesByProject[machine.id].find(r => r.name === 'SPM').members, [admin], 'department grants do not expand named SPM responsibility')
console.log('project role departments behavioral contract passed')
