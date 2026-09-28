import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'
const loader = createTypeScriptModuleLoader()
const load = file => loader(path.resolve(file))
globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = { localStorage }
const lib = load('src/lib/permissionCenter.ts')
const { usePermissionStore: store, PERMISSION_STORAGE_KEY } = load('src/stores/permission.ts')
assert.equal(store.getState().ensurePermissionCenter().ok, true)
const data = { mode: 'all', conjunction: 'all', conditions: [{ id: 'condition:draft', field: '', operator: 'eq', value: '' }] }
const roleId = 'roadmap-reader-A', menuId = 'roadmap.table', reader = '演示用户04'
assert.equal(store.getState().updateMenuPolicy('演示用户01', roleId, menuId, { data }).ok, true)
assert.equal(lib.evaluateMenuPermission(store.getState().permissionCenter, reader, menuId), true)
const serialized = JSON.parse(localStorage.getItem(PERMISSION_STORAGE_KEY))
const reloaded = createTypeScriptModuleLoader()(path.resolve('src/stores/permission.ts'))
assert.equal(reloaded.hasMenuPermission(reader, menuId), true, 'Saving all-data with a discarded incomplete filter draft must preserve access after actual reload')
const savedPolicy = serialized.state.permissionCenter.policies.find(policy => policy.roleId === roleId && policy.menuId === menuId)
assert.deepEqual(savedPolicy.data.conditions, [], 'Inactive condition drafts are discarded when saving all-data')
// Read previously saved snapshots with dormant drafts using the same semantics as write.
const oldV2 = { ...store.getState().permissionCenter, policies: [{ ...savedPolicy, data }] }
const parsed = lib.parsePermissionCenter(oldV2)
assert.equal(lib.evaluateMenuPermission(parsed, reader, menuId), true)
assert.deepEqual(parsed.policies[0].data.conditions, [])
const active = { ...savedPolicy, data: { ...data, mode: 'conditions' } }
assert.equal(lib.validateMenuPolicy(active).ok, false)
assert.equal(lib.parsePermissionCenter({ ...oldV2, policies: [active] }).policies.length, 0)
const asV1 = policy => ({ version: 1, groups: oldV2.groups, roles: oldV2.roles.map(({ departments, ...role }) => role), policies: [{ ...policy, users: [reader], departments: [] }] })
assert.equal(lib.isValidLegacyPermissionCenter(asV1(active)), false, 'Incomplete active v1 conditions still fail closed before seed reset')
assert.equal(lib.isValidLegacyPermissionCenter(asV1(savedPolicy)), true)
const dormantV1 = asV1({ ...savedPolicy, data })
assert.equal(lib.isValidLegacyPermissionCenter(dormantV1), true, 'Inactive v1 drafts are valid snapshots, not corrupt active conditions')
localStorage.setItem(PERMISSION_STORAGE_KEY, JSON.stringify({ version: 3, state: { permissionCenter: dormantV1 } }))
const legacyReload = createTypeScriptModuleLoader()(path.resolve('src/stores/permission.ts'))
assert.equal(legacyReload.usePermissionStore.getState().ensurePermissionCenter().ok, true)
assert.equal(legacyReload.usePermissionStore.getState().permissionCenter.version, 2)
assert.equal(legacyReload.isGlobalAdmin('演示用户01'), true, 'Valid old all-data snapshots refresh instead of locking out their administrators')
delete globalThis.window
delete globalThis.localStorage
console.log('Inactive condition drafts canonicalize on save/read; actual reload preserves grants; active v1/v2 incomplete conditions deny')
