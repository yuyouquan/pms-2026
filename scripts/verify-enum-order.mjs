import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'

const load = createTypeScriptModuleLoader()
const enums = load(path.resolve('src/stores/enums.ts'))
const { createInitialEnumRows, filterEnumRows } = load(path.resolve('src/lib/enumValues.ts'))
const seeds = createInitialEnumRows()
const fixture = enums.createEnumStore({ rowsByType: seeds })
assert.equal(typeof fixture.moveEnumRow, 'function', 'enum rows support moving by stable IDs')

for (const [type, rows] of Object.entries(seeds)) {
  if (rows.length < 2) continue
  const first = rows[0], last = rows.at(-1)
  assert.deepEqual(fixture.moveEnumRow(type, first.id, last.id), { ok: true })
  assert.deepEqual(fixture.getRows(type), [...rows.slice(1), first], `${type}: downward drag preserves every mapping field and status`)
  assert.deepEqual(fixture.moveEnumRow(type, first.id, rows[1].id), { ok: true })
  assert.deepEqual(fixture.getRows(type), rows, `${type}: move-to-top restores the complete order`)
  const before = fixture.getState()
  assert.deepEqual(fixture.moveEnumRow(type, first.id, 'deleted-target'), { ok: false, reason: 'missing' })
  assert.deepEqual(fixture.moveEnumRow(type, 'deleted-source', first.id), { ok: false, reason: 'missing' })
  assert.deepEqual(fixture.moveEnumRow(type, first.id, first.id), { ok: true })
  assert.deepEqual(fixture.getState(), before, 'stale rows and no-op drops cannot damage the order')
}
assert.deepEqual(fixture.getState().rowsByType, seeds, 'reordering never alters other enum types')
assert.deepEqual(fixture.moveEnumRow('unknown', 'a', 'b'), { ok: false, reason: 'invalid' })

const filteredFixture = enums.createEnumStore({ rowsByType: { ...seeds, 'product-series': [
  { id: 'a', value: '显示 A' }, { id: 'hidden', value: '隐藏', enabled: false }, { id: 'b', value: '显示 B' },
] } })
const matches = filterEnumRows('product-series', filteredFixture.getRows('product-series'), { value: '显示' })
assert.deepEqual(matches.map(row => row.id), ['a', 'b'])
filteredFixture.moveEnumRow('product-series', matches[1].id, matches[0].id)
assert.deepEqual(filteredFixture.getRows('product-series'), [
  { id: 'b', value: '显示 B' }, { id: 'a', value: '显示 A' }, { id: 'hidden', value: '隐藏', enabled: false },
], 'filtered reordering keeps hidden and disabled rows intact')
assert.deepEqual(enums.createEnumStore(enums.partializeEnumState(filteredFixture.getState())).getState().rowsByType,
  filteredFixture.getState().rowsByType, 'saved order survives normalization and reopening')

const originalWindow = globalThis.window
const storageModule = load(path.resolve('src/lib/mockDatasetStorage.ts'))
const stored = new Map([[storageModule.MOCK_DATASET_VERSION_STORAGE_KEY, storageModule.MOCK_DATASET_VERSION]])
let failWrites = false, writes = 0
try {
  globalThis.window = { localStorage: {
    getItem: key => stored.get(key) ?? null,
    setItem: (key, value) => { if (failWrites) throw new Error('storage blocked'); writes += 1; stored.set(key, value) },
    removeItem: key => stored.delete(key),
  } }
  const store = enums.useEnumStore
  await store.getState().hydrateEnumStore()
  const rows = store.getState().rowsByType['chip-mapping']
  assert.deepEqual(store.getState().moveEnumRow('chip-mapping', rows.at(-1).id, rows[0].id), { ok: true })
  const reordered = store.getState().rowsByType
  assert.equal(reordered['chip-mapping'][0].id, rows.at(-1).id)
  const durable = stored.get(enums.ENUM_STORAGE_KEY)
  assert.deepEqual(JSON.parse(durable).state.rowsByType, reordered, 'production action persists the reordered mappings')
  await store.getState().hydrateEnumStore()
  assert.deepEqual(store.getState().rowsByType, reordered, 'production hydration preserves order')
  const writesBefore = writes
  store.getState().moveEnumRow('chip-mapping', rows.at(-1).id, rows.at(-1).id)
  assert.equal(writes, writesBefore, 'dropping in place does not write to storage')
  failWrites = true
  assert.deepEqual(store.getState().moveEnumRow('chip-mapping', rows[0].id, rows.at(-1).id), { ok: false, reason: 'storage' })
  assert.deepEqual(store.getState().rowsByType, reordered, 'failed writes roll back the visible order')
  assert.equal(stored.get(enums.ENUM_STORAGE_KEY), durable, 'failed writes retain the last durable order')
} finally {
  if (originalWindow === undefined) delete globalThis.window
  else globalThis.window = originalWindow
}
console.log('PASS enum order: all types, both directions, move-to-top, filtered rows, stale IDs, persistence and failure rollback')
