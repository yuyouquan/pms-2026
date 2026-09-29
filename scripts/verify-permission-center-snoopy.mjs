import assert from 'node:assert/strict'
import path from 'node:path'
import { loadTypeScriptModule } from './lib/typescript-module-loader.mjs'
const load = file => loadTypeScriptModule(path.resolve(file))
const { createPermissionCenterSeed } = load('src/lib/permissionCenterSeed.ts')
const lib = load('src/lib/permissionCenter.ts')
const constants = load('src/constants/permissionCenter.ts')
const permissions = load('src/stores/permission.ts')
const seed = createPermissionCenterSeed()
assert(constants.PERMISSION_USERS.includes('SnoopyYu'), 'SnoopyYu is selectable in the mock user directory')
assert(lib.isPermissionCenterAdmin(seed, 'SnoopyYu'), 'Fresh mock seed grants SnoopyYu system superadmin')
for (const menu of constants.PERMISSION_MENUS) for (const action of menu.actions) assert(lib.evaluateMenuPermission(seed, 'SnoopyYu', menu.id, action))
const old = { ...seed, roles: seed.roles.map(role => ({ ...role, members: role.members.filter(user => user !== 'SnoopyYu') })) }
const existing = { permissionCenter: old, rolesByProject: { custom: [{ name: 'Custom', isFixed: false, members: ['演示用户04'] }] }, rolePermissionsByProject: { custom: { Custom: { 'basicInfo:编辑': false } } } }
const migrated = permissions.migratePermissionState(existing, 4)
assert(lib.isPermissionCenterAdmin(migrated.permissionCenter, 'SnoopyYu'), 'Existing v4 cache receives the requested mock administrator once')
assert.deepEqual(migrated.rolesByProject, existing.rolesByProject)
assert.deepEqual(migrated.permissionCenter.policies, old.policies)
assert.deepEqual(migrated.permissionCenter.roles.filter(role => role.id !== constants.SUPER_ADMIN_ROLE_ID), old.roles.filter(role => role.id !== constants.SUPER_ADMIN_ROLE_ID))
const revoked = { ...migrated, permissionCenter: old }
assert.equal(lib.isPermissionCenterAdmin(permissions.migratePermissionState(revoked, permissions.PERMISSION_STORAGE_VERSION).permissionCenter, 'SnoopyYu'), false, 'Later explicit removal must survive reload')
for (const broken of [{ ...old, roles: [] }, { ...old, roles: old.roles.map(role => ({ ...role, members: ['unknown-user'] })) }]) {
  assert.equal(lib.isPermissionCenterAdmin(permissions.migratePermissionState({ permissionCenter: broken }, 4).permissionCenter, 'SnoopyYu'), false, 'Invalid caches never recreate superadmin authority')
}
permissions.usePermissionStore.setState({ permissionCenter: migrated.permissionCenter })
assert(permissions.isGlobalAdmin('SnoopyYu'))
assert(permissions.hasPermission('SnoopyYu', 'basicInfo:编辑', 'custom'))
console.log('PASS SnoopyYu mock directory, system-wide grants, additive one-time migration, preserved custom grants, revocation and corrupt cache boundary')

// Exercise real Zustand v4 -> v5 hydration and persisted removal across module reloads.
const saved = new Map([['pms:mock-dataset-version', '2026-09-15-v1'], [permissions.PERMISSION_STORAGE_KEY, JSON.stringify({ version: 4, state: existing })]])
globalThis.window = { localStorage: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) } }
const fresh = () => loadTypeScriptModule(path.resolve('src/stores/permission.ts'), new Map())
const first = fresh()
assert(first.isGlobalAdmin('SnoopyYu'))
assert.equal(JSON.parse(saved.get(permissions.PERMISSION_STORAGE_KEY)).version, permissions.PERMISSION_STORAGE_VERSION)
assert.deepEqual(first.usePermissionStore.getState().rolesByProject.custom, existing.rolesByProject.custom)
assert.equal(first.usePermissionStore.getState().setSuperAdminMembers('演示用户01', ['演示用户01', '演示用户07']).ok, true)
assert.equal(fresh().isGlobalAdmin('SnoopyYu'), false, 'Real reload must retain an explicit post-upgrade revocation')
delete globalThis.window
console.log('PASS actual v4 hydration, serialized v5 upgrade and persisted SnoopyYu revocation after reload')
