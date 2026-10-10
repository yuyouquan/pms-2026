import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'

const load = createTypeScriptModuleLoader()
const consumers = load(path.resolve('src/lib/enumConsumers.ts'))
const { createInitialEnumRows } = load(path.resolve('src/lib/enumValues.ts'))
const { createEnumStore } = load(path.resolve('src/stores/enums.ts'))
assert.equal(typeof consumers.orderProjectEnumOptions, 'function', 'data-derived dropdowns use the configured enum order')
const rows = createInitialEnumRows()
rows['first-sale-tos'] = [{ id: 'new', value: '17.2' }, { id: 'old', value: '16.0' }]
rows['research-mode'] = [{ id: 'b', value: 'B', enabled: false }, { id: 'a', value: 'A' }, { id: 'hidden', value: '不可见' }]
rows['chip-mapping'].reverse()
rows['tmg-subdomain-mapping'].reverse()
const options = ['历史值', 'tOS16.0', 'tOS17.2'].map(value => ({ value, label: value }))
assert.deepEqual(consumers.orderProjectEnumOptions(rows, '整机产品项目', 'firstSaleTosVersion', options).map(option => option.value),
  ['tOS17.2', 'tOS16.0', '历史值'], 'tOS prefixes normalize only for ordering; labels and stored values stay intact')
const restricted = [{ value: 'A', label: 'A' }, { value: 'B', label: 'B' }]
assert.deepEqual(consumers.orderProjectEnumOptions(rows, '整机产品项目', 'researchMode', restricted).map(option => option.value),
  ['B', 'A'], 'filters retain disabled historical values without adding inaccessible configured options')
assert.deepEqual(consumers.buildEnumOptions(rows, 'research-mode').map(option => option.value), ['A', '不可见'], 'edit dropdowns still omit disabled values')
assert.deepEqual(consumers.orderProjectEnumOptions(rows, '技术项目', 'parentProjectName', restricted), restricted, 'non-enum dropdowns keep their own order')
const chips = rows['chip-mapping'].map(row => ({ value: row.chipCode, label: row.chipCode }))
assert.deepEqual(consumers.orderProjectEnumOptions(rows, '整机产品项目', 'chipCode', [...chips].reverse()), chips)
const domains = consumers.getTmgDomains(rows)
assert.deepEqual(consumers.orderProjectEnumOptions(rows, '技术项目', 'tmg', [...domains].reverse()), domains)
const store = createEnumStore({ rowsByType: rows })
store.moveEnumRow('first-sale-tos', 'old', 'new')
assert.deepEqual(consumers.buildEnumOptions(store.getState().rowsByType, 'first-sale-tos').map(option => option.value), ['16.0', '17.2'])
assert.deepEqual(consumers.orderProjectEnumOptions(store.getState().rowsByType, '整机产品项目', 'firstSaleTosVersion', options).map(option => option.value), ['tOS16.0', 'tOS17.2', '历史值'])

const { buildRoadmapFilterFieldDefinitions } = load(path.resolve('src/lib/roadmapFilters.ts'))
const versions = ['16.0', '18.0', '17.2'].map((id, index) => ({ id, name: `tOS${id}`, major: Number(id.split('.')[0]), minor: 0, selectable: true, targets: [], createdAt: '', updatedAt: '', periodStartDate: '', periodEndDate: '' }))
assert.deepEqual(buildRoadmapFilterFieldDefinitions(versions).find(field => field.key === 'firstSaleTosVersionId').options.map(option => option.value),
  ['16.0', '18.0', '17.2'], 'roadmap dropdowns retain input enum order instead of sorting by version number')
console.log('PASS enum dropdown order: editing, filtered data, mappings, tOS labels, unknown history and live reordering')
