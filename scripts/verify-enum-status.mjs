#!/usr/bin/env node
import assert from 'node:assert/strict'
import { loadTypeScriptModule, projectRoot } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const consumers = loadTypeScriptModule(root, 'src/lib/enumConsumers.ts')
const values = loadTypeScriptModule(root, 'src/lib/enumValues.ts')
const stores = loadTypeScriptModule(root, 'src/stores/enums.ts')
const rows = values.createInitialEnumRows()
rows['memory-size'] = [
  { id: 'ram-active', value: '8GB' },
  { id: 'ram-disabled', value: '4GB', enabled: false },
]
assert.deepEqual(consumers.buildEnumOptions(rows, 'memory-size'), [{ value: '8GB', label: '8GB' }], 'disabled values cannot be newly selected')
assert.deepEqual(consumers.buildEnumOptions(rows, 'memory-size', ['4GB']), [
  { value: '8GB', label: '8GB' },
  { value: '4GB', label: '4GB（已停用）', disabled: true },
], 'existing disabled snapshots remain visible without allowing a new selection')
assert.deepEqual(consumers.buildEnumOptions(rows, 'memory-size', ['2GB'], 'filter'), [
  { value: '8GB', label: '8GB' }, { value: '4GB', label: '4GB' }, { value: '2GB', label: '2GB' },
], 'filters include disabled and historical values as selectable options')
assert.deepEqual(values.filterEnumRows('memory-size', rows['memory-size'], { value: 'GB' }, 'disabled').map(row => row.id), ['ram-disabled'], 'status and keyword filters combine')
assert.deepEqual(values.filterEnumRows('memory-size', rows['memory-size'], {}, 'enabled').map(row => row.id), ['ram-active'], 'legacy rows default to enabled')

const store = stores.createEnumStore({ rowsByType: rows }, () => 'new-row')
assert.equal(store.setEnumRowEnabled('memory-size', 'ram-active', false).ok, true)
assert.equal(store.getRows('memory-size')[0].enabled, false)
assert.equal(store.updateEnumRow('memory-size', 'ram-active', { value: '12GB' }).ok, true)
assert.equal(store.getRows('memory-size')[0].enabled, false, 'editing a disabled row must not re-enable it')
assert.equal(store.addEnumRow('memory-size', { value: '12GB' }).ok, false, 'disabled rows still participate in duplicate checks')
assert.equal(store.setEnumRowEnabled('memory-size', 'missing', true).reason, 'missing')
assert.equal(store.setEnumRowEnabled('unknown', 'ram-active', true).reason, 'invalid')
assert.equal(store.setEnumRowEnabled('memory-size', 'ram-active', 'false').reason, 'invalid')
const saved = JSON.parse(JSON.stringify(stores.partializeEnumState(store.getState())))
saved.rowsByType['core-value'] = []
const reloaded = stores.createEnumStore(stores.migrateEnumState(saved, stores.ENUM_STORE_VERSION))
assert.equal(reloaded.getRows('memory-size')[0].enabled, false, 'disable survives serialization, sanitation, and refresh')
assert.deepEqual(reloaded.getRows('core-value'), [], 'status migration never restores deliberately deleted rows')
assert.equal(reloaded.setEnumRowEnabled('memory-size', 'ram-active', true).ok, true)
assert.deepEqual(consumers.getSingleEnumValues(reloaded.getState().rowsByType, 'memory-size'), ['12GB'], 're-enabling restores the renamed value')

const chip = { id: 'chip-disabled', chipCode: 'CHIP', chipModel: 'MODEL', chipPlatform: 'PLATFORM', enabled: false }
rows['chip-mapping'] = [chip]
assert.deepEqual(consumers.buildChipOptions(rows), [])
assert.equal(consumers.buildChipOptions(rows, [chip])[0].disabled, true)
assert.equal(consumers.resolveChipRow(rows, chip.id), undefined, 'inactive chip IDs cannot be committed as new selections')
rows['tmg-subdomain-mapping'] = [
  { id: 'tmg-disabled', domain: '平台', subdomain: '历史领域', enabled: false },
  { id: 'tmg-active', domain: '平台', subdomain: '新领域' },
  { id: 'tmg-only-disabled', domain: '旧平台', subdomain: '无', enabled: false },
]
assert.deepEqual(consumers.getTmgDomains(rows).map(option => option.value), ['平台'])
assert.deepEqual(consumers.getTmgSubdomainState(rows, '平台').options.map(option => option.value), ['新领域'])
assert.equal(consumers.getTmgSubdomainState(rows, '平台', '历史领域', '平台').options.at(-1).disabled, true)
assert.equal(consumers.getTmgSubdomainState(rows, '旧平台').autoValue, undefined)
const mappingReload = stores.createEnumStore({ rowsByType: rows })
assert.equal(mappingReload.getRows('chip-mapping')[0].enabled, false)
assert.equal(mappingReload.getRows('tmg-subdomain-mapping')[0].enabled, false)
const persistedStore = stores.useEnumStore
const originalStorage = persistedStore.persist.getOptions().storage
let savedEnvelope
let failWrite = false
persistedStore.persist.setOptions({ storage: {
  getItem: () => savedEnvelope,
  setItem: (_key, envelope) => {
    if (failWrite) throw new Error('storage blocked')
    savedEnvelope = JSON.parse(JSON.stringify(envelope))
  },
  removeItem: () => { savedEnvelope = undefined },
} })
try {
  persistedStore.setState({ rowsByType: rows, hasHydrated: true, hydrationError: null })
  failWrite = true
  assert.equal(persistedStore.getState().setEnumRowEnabled('memory-size', 'ram-active', false).reason, 'storage')
  assert.notEqual(persistedStore.getState().rowsByType['memory-size'][0].enabled, false, 'failed writes roll back the status in memory')
  failWrite = false
  assert.equal(persistedStore.getState().setEnumRowEnabled('memory-size', 'ram-active', false).ok, true)
  await persistedStore.persist.rehydrate()
  assert.equal(persistedStore.getState().rowsByType['memory-size'][0].enabled, false, 'real persisted store restores disabled status')
  const roadmap = loadTypeScriptModule(root, 'src/stores/roadmap.ts').useRoadmapStore
  const version = persistedStore.getState().rowsByType['roadmap-tos'][0]
  persistedStore.getState().setEnumRowEnabled('roadmap-tos', version.id, false)
  roadmap.getState().setSelectedTosVersionId(consumers.normalizeTosSnapshot(version.value))
  assert.equal(roadmap.getState().selectedTosVersionId, consumers.normalizeTosSnapshot(version.value), 'roadmap filter validation accepts disabled configured versions')
} finally {
  persistedStore.persist.setOptions({ storage: originalStorage })
}
console.log('[enum-status] PASS: status lifecycle, persistence, filtering, disabled snapshots, and linked options')
