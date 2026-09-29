import assert from 'node:assert/strict'
import path from 'node:path'
import { loadTypeScriptModule } from './lib/typescript-module-loader.mjs'
const module = loadTypeScriptModule(path.resolve('src/stores/permission.ts'))
const { usePermissionStore: store } = module
const fresh = store.getInitialState()
const merge = store.persist.getOptions().merge
for (const payload of [{}, { globalRoles: 'bad' }, null, [], { permissionCenter: { version: 1 } }]) {
  const restored = merge(payload, fresh)
  store.setState(restored, true)
  const result = store.getState().ensurePermissionCenter()
  assert.equal(module.isGlobalAdmin('演示用户01'), false, 'malformed existing state cannot seed demo administrator')
  assert.equal(module.hasMenuPermission('演示用户04', 'project.view'), false, 'malformed state cannot seed compatibility grants')
  assert.equal(result.ok, false)
  assert.match(result.error, /权限.*损坏|无法读取/)
  assert.match(store.getState().permissionCenterError, /权限.*损坏|无法读取/)
}
store.setState(merge(undefined, fresh), true)
assert.equal(store.getState().ensurePermissionCenter().ok, true, 'genuinely absent storage still initializes')
assert.equal(module.isGlobalAdmin('演示用户01'), true)
const oldProjectOnly = { rolesByProject: {}, rolePermissionsByProject: {} }
store.setState(merge(module.migratePermissionState(oldProjectOnly, 2), fresh), true)
assert.equal(store.getState().ensurePermissionCenter().ok, true, 'recognized legacy project-only snapshot keeps first global migration')
assert.equal(module.isGlobalAdmin('演示用户01'), true)
const legacy = { globalRoles: [{ name: '管理组', members: ['演示用户02'] }], globalRolePerms: { 管理组: {} } }
store.setState(merge(legacy, fresh), true)
assert.equal(store.getState().ensurePermissionCenter().ok, true)
assert.equal(module.isGlobalAdmin('演示用户02'), false, 'recognized mock legacy global memberships refresh to explicit demo assignments')
assert.equal(module.isGlobalAdmin('演示用户01'), true)
const saved = module.partializePermissionState(store.getState())
store.setState(merge(saved, fresh), true)
assert.equal(module.isGlobalAdmin('演示用户01'), true, 'valid new model roundtrip remains authoritative')
// Exercise the actual storage envelope reader, not just migration helpers.
let raw = null
const storageMap = new Map([['pms:mock-dataset-version', '2026-09-15-v1']])
globalThis.window = { localStorage: { getItem: key => key === module.PERMISSION_STORAGE_KEY ? raw : storageMap.get(key) ?? null, setItem: (key, value) => storageMap.set(key, value), removeItem: key => storageMap.delete(key) } }
for (const envelope of [{ state: {}, version: 3 }, { state: { globalRoles: 'bad' }, version: 3 }, { other: {} }, { state: null, version: 3 }, { state: oldProjectOnly, version: 3 }, { state: oldProjectOnly, version: 4 }, { state: oldProjectOnly }]) {
  raw = JSON.stringify(envelope)
  const stored = await store.persist.getOptions().storage.getItem(module.PERMISSION_STORAGE_KEY)
  store.setState(merge(stored.state, fresh), true)
  assert.equal(store.getState().ensurePermissionCenter().ok, false)
  assert.equal(module.isGlobalAdmin('演示用户01'), false)
  const deniedRoundtrip = module.partializePermissionState(store.getState())
  store.setState(merge(deniedRoundtrip, fresh), true)
  assert.equal(store.getState().ensurePermissionCenter().ok, false, 'corruption status survives later persistence')
}
for (const version of [0, 1, 2]) {
  raw = JSON.stringify({ state: oldProjectOnly, version })
  const legacyEnvelope = await store.persist.getOptions().storage.getItem(module.PERMISSION_STORAGE_KEY)
  store.setState(merge(module.migratePermissionState(legacyEnvelope.state, legacyEnvelope.version), fresh), true)
  assert.equal(store.getState().ensurePermissionCenter().ok, true, 'known old project-only storage still migrates')
  assert.equal(module.isGlobalAdmin('演示用户01'), true)
}
raw = null
assert.equal(await store.persist.getOptions().storage.getItem(module.PERMISSION_STORAGE_KEY), null)
delete globalThis.window
console.log('Permission storage corruption: malformed envelopes fail closed; absent/legacy/valid model retain intended initialization')
