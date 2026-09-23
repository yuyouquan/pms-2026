import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'

const storage = createCurrentDatasetStorage()
const writes = []
const originalSet = storage.setItem.bind(storage)
storage.setItem = (key, value) => { writes.push(key); originalSet(key, value) }
globalThis.localStorage = storage
globalThis.window = { localStorage: storage }
const load = createTypeScriptModuleLoader()
const { usePlanStore: store } = load(path.resolve('src/stores/plan.ts'))
writes.length = 0
const current = store.getState().publishedSnapshots
store.getState().setPublishedSnapshots(previous => previous)
store.getState().setPublishedSnapshots(current)
assert.deepEqual(writes, [], 'unchanged snapshot initialization must not persist tab-local version selections back to other tabs')
store.getState().setPublishedSnapshots(previous => ({ ...previous, 'qa-new-snapshot': [] }))
assert.deepEqual(writes, ['pms-plan-store'], 'actual snapshot change is still persisted once')
assert.deepEqual(JSON.parse(storage.getItem('pms-plan-store')).state.publishedSnapshots['qa-new-snapshot'], [])
console.log('PASS snapshot initializer skips persisted no-op writes and persists real changes')
process.exit(0)
