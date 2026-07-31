#!/usr/bin/env node
import assert from 'node:assert/strict'
import { getStringUnionTypeMembers, loadTypeScriptModule, projectRoot, readSource } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
assert.deepEqual(getStringUnionTypeMembers(readSource(root, 'src/types/enums.ts'), 'EnumTypeKey').sort(), ['tos-2-part', 'tos-3-part'], 'EnumTypeKey must be exactly the two fixed tOS string literals')
const values = loadTypeScriptModule(root, 'src/lib/enumValues.ts')
const store = loadTypeScriptModule(root, 'src/stores/enums.ts')
assert.deepEqual(Object.keys(values.TOS_ENUM_REGISTRY).sort(), ['tos-2-part', 'tos-3-part'], 'only two tOS enum registries are registered')
assert.deepEqual(values.TOS_ENUM_REGISTRY, {
  'tos-2-part': { key: 'tos-2-part', label: 'tOS版本（2位）', initialValues: ['16.0', '17.2'] },
  'tos-3-part': { key: 'tos-3-part', label: 'tOS版本（3位）', initialValues: ['16.0.1', '16.0.2', '17.2.0'] },
}, 'labels and initial values are fixed and exact')
assert.equal(values.normalizeEnumValue(' 17.10.0 '), '17.10.0', 'normalization trims input')
assert.equal(values.normalizeEnumValue(' tOS17.10.0 '), '17.10.0', 'normalization removes a valid leading tOS prefix')
assert.equal(values.normalizeEnumValue(' tOS17.a.0 '), 'tOS17.a.0', 'normalization does not remove tOS from malformed input')
assert.throws(() => values.validateEnumValue('tos-3-part', '17.a.0'), /format/i, 'format validation rejects nonnumeric versions')
assert.doesNotThrow(() => values.validateEnumValue('tos-2-part', '17.10'), 'two-part values are accepted only by the two-part category')
assert.throws(() => values.validateEnumValue('tos-2-part', '17.10.0'), /format/i, 'two-part category rejects three-part values')
assert.throws(() => values.validateEnumValue('tos-3-part', '17.10'), /format/i, 'three-part category rejects two-part values')
for (const invalidValue of ['', '-1.0', '.17.0', '17.0.', 'tOS 17.0']) {
  assert.throws(() => values.validateEnumValue('tos-2-part', invalidValue), /format/i, `rejects invalid two-part input: ${invalidValue}`)
}
assert.deepEqual(values.sortEnumValues(['17.10.0', '17.2.0', '17.2.0', '16.10.2']), ['16.10.2', '17.2.0', '17.2.0', '17.10.0'], 'version values sort stably by numeric segments in natural ascending order')
assert.equal(typeof store.createEnumStore, 'function', 'missing enum store fixture factory')
assert.deepEqual(store.createEnumStore().getState().valuesByType, {
  'tos-2-part': ['16.0', '17.2'],
  'tos-3-part': ['16.0.1', '16.0.2', '17.2.0'],
}, 'store starts with the exact fixed values')
const enums = store.createEnumStore({ valuesByType: { 'tos-3-part': ['17.2.0'] } })
assert.deepEqual(enums.addEnumValue('tos-3-part', ' 17.10.0 '), { ok: true }, 'store adds a trimmed value')
assert.deepEqual(enums.addEnumValue('tos-3-part', 'tOS17.3.0'), { ok: true }, 'store accepts a normalizable tOS prefix')
assert.deepEqual(enums.getValues('tos-3-part'), ['17.2.0', '17.3.0', '17.10.0'], 'store keeps semantic order')
assert.deepEqual(enums.addEnumValue('tos-3-part', '17.10.0'), { ok: false, reason: 'duplicate' }, 'store rejects duplicate values')
assert.deepEqual(enums.addEnumValue('tos-3-part', '17.10'), { ok: false, reason: 'invalid' }, 'store rejects the other category format')
assert.deepEqual(enums.updateEnumValue('tos-3-part', '17.3.0', ' 17.4.0 '), { ok: true }, 'store updates and trims a value')
assert.deepEqual(enums.updateEnumValue('tos-3-part', '17.4.0', '17.10.0'), { ok: false, reason: 'duplicate' }, 'update excludes itself but rejects another value')
assert.deepEqual(enums.updateEnumValue('tos-3-part', '17.4.0', '17.4.0'), { ok: true }, 'unchanged update excludes itself from duplicate detection')
assert.deepEqual(enums.updateEnumValue('tos-3-part', 'missing', '17.5.0'), { ok: false, reason: 'missing' }, 'update reports a missing source value')
const selectedString = enums.getValues('tos-3-part')[0]
const businessRecord = { tosVersion: selectedString }
const readBusinessValue = record => record.tosVersion
assert.deepEqual(enums.deleteEnumValue('tos-3-part', '17.2.0'), { ok: true }, 'store deletes configured option')
assert.deepEqual(enums.deleteEnumValue('tos-3-part', '17.2.0'), { ok: false, reason: 'missing' }, 'delete reports an already missing value')
assert.equal(readBusinessValue(businessRecord), '17.2.0', 'independent business snapshot keeps its selected string after deletion')
assert.equal(enums.getValues('tos-3-part').includes('17.2.0'), false, 'deleted option is gone from configuration')

assert.deepEqual(store.partializeEnumState({
  valuesByType: { 'tos-2-part': ['18.0'], 'tos-3-part': ['18.0.1'] },
  modalOpen: true,
  selectedType: 'tos-2-part',
  loading: true,
}), { valuesByType: { 'tos-2-part': ['18.0'], 'tos-3-part': ['18.0.1'] } }, 'persisted partial contains business values only')
assert.deepEqual(store.migrateEnumState({
  valuesByType: {
    'tos-2-part': [' 18.10 ', 'bad', '18.2', '18.2'],
    'tos-3-part': ['tOS18.10.1', '18.2', '18.3.0'],
    unknown: ['1.0'],
  },
  modalOpen: true,
}, 0), {
  valuesByType: {
    'tos-2-part': ['18.2', '18.10'],
    'tos-3-part': ['18.3.0', '18.10.1'],
  },
}, 'migration drops unknown state and invalid values while normalizing, deduplicating, sorting, and preserving valid user values')
assert.deepEqual(store.migrateEnumState({ valuesByType: { 'tos-2-part': [] } }, 0), {
  valuesByType: {
    'tos-2-part': [],
    'tos-3-part': ['16.0.1', '16.0.2', '17.2.0'],
  },
}, 'migration preserves an intentionally empty category and heals a missing category')

const enumUi = readSource(root, 'src/components/config/EnumConfig.tsx')
const configUi = readSource(root, 'src/containers/ConfigContainer.tsx')
const appShell = readSource(root, 'src/containers/AppShell.tsx')
const globalStyles = readSource(root, 'src/styles/globals.css')
assert.match(configUi, /key:\s*['"]enum['"][\s\S]*枚举值配置/, 'configuration center exposes the enum-value tab')
assert.match(configUi, /configTab\s*===\s*['"]enum['"][\s\S]*<EnumConfig/, 'enum tab renders EnumConfig')
assert.match(enumUi, /TOS_ENUM_TYPE_KEYS\.map[\s\S]*TOS_ENUM_REGISTRY\[type\]/, 'fixed registry drives the two visible enum type labels')
for (const copy of ['新增枚举值', '历史已保存字符串不受影响', '格式要求', '加载枚举值失败', '暂无枚举值']) {
  assert.ok(enumUi.includes(copy), `EnumConfig must include UI copy: ${copy}`)
}
assert.match(enumUi, /aria-label=["']编辑/, 'icon-only edit action has an aria label')
assert.match(enumUi, /aria-label=["']删除/, 'icon-only delete action has an aria label')
assert.doesNotMatch(enumUi, /添加类型|编辑类型|删除类型/, 'fixed enum types expose no type CRUD')
assert.match(appShell, /className="pms-main-header"[\s\S]*className="pms-main-header__row"/, 'main header exposes responsive layout hooks')
assert.match(appShell, /className="pms-main-header__nav-scroll"[\s\S]*className="pms-main-header__menu"/, 'main navigation has its own scroll container')
assert.match(globalStyles, /@media\s*\(max-width:\s*768px\)[\s\S]*\.pms-main-header__row[\s\S]*flex-wrap:\s*nowrap/, 'narrow header must stay on one row')
assert.match(globalStyles, /\.pms-main-header__nav-scroll[\s\S]*overflow-x:\s*auto[\s\S]*touch-action:\s*pan-x/, 'narrow navigation supports horizontal touch scrolling')
assert.match(globalStyles, /\.pms-main-header__menu[\s\S]*min-width:\s*max-content/, 'menu keeps all destinations in the scrollable track')
assert.match(globalStyles, /\.pms-main-header__user[\s\S]*flex:\s*0\s+0\s+40px/, 'narrow user switcher stays compact and fixed-width')
console.log('enum config contract passed')
