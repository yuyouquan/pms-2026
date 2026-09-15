#!/usr/bin/env node
import assert from 'node:assert/strict'
import { loadTypeScriptModule, projectRoot } from './lib/source-contract.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'

globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = { localStorage: globalThis.localStorage }
const root = projectRoot(import.meta.url)
const { useHrConfigStore: store } = loadTypeScriptModule(root, 'src/stores/hrConfig.ts')
const { CONFIG_MODULES } = loadTypeScriptModule(root, 'src/constants/hrConfig.ts')
const initial = store.getState().data
assert.deepEqual(Object.keys(initial).sort(), CONFIG_MODULES.map(module => module.key).sort(), 'configuration data contains only persisted module records')
assert.ok(Object.values(initial).every(Array.isArray), 'every configuration module contains records')
assert.deepEqual(structuredClone(initial), JSON.parse(JSON.stringify(initial)), 'configuration snapshots and persisted JSON retain identical data')
store.getState().setEditingId('serialization-review')
assert.deepEqual(JSON.parse(localStorage.getItem('pms-hr-config')).state.data, initial, 'browser storage retains every configuration module')
await store.persist.rehydrate()
assert.deepEqual(store.getState().data, initial, 'configuration data remains identical after persistence and rehydration')
console.log('PASS HR configuration contains serializable module records and survives persistence unchanged')
