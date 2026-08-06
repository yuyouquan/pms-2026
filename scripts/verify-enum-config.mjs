#!/usr/bin/env node
import assert from 'node:assert/strict'
import { getStringUnionTypeMembers, loadTypeScriptModule, projectRoot, readSource } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
assert.deepEqual(getStringUnionTypeMembers(readSource(root, 'src/types/enums.ts'), 'EnumTypeKey').sort(), ['tos-2-part', 'tos-3-part'], 'EnumTypeKey must be exactly the two fixed tOS string literals')
const values = loadTypeScriptModule(root, 'src/lib/enumValues.ts')
const options = loadTypeScriptModule(root, 'src/lib/tosEnumOptions.ts')
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

assert.deepEqual(options.buildTosEnumOptions('tos-3-part', ['17.2.0', '19.4.1', '19.4'], ['16.3.7']), [
  { label: 'tOS17.2.0', value: '17.2.0' },
  { label: 'tOS19.4.1', value: '19.4.1' },
  { label: 'tOS16.3.7（已停用）', value: '16.3.7', disabled: true },
], 'three-part consumers keep current values in semantic ascending order and append their explicit historical orphan')
assert.deepEqual(options.buildTosEnumOptions('tos-2-part', ['17.2', '19.4', '19.4.1'], []), [
  { label: 'tOS17.2', value: '17.2' },
  { label: 'tOS19.4', value: '19.4' },
], 'two-part consumers do not inherit three-part values')
assert.equal(options.resolveCurrentTosEnumValue('tos-3-part', ' tOS19.4.1 ', ['17.2.0', '19.4.1']), '19.4.1', 'current values resolve from either labels or canonical values')
assert.equal(options.resolveCurrentTosEnumValue('tos-3-part', 'tOS16.3.7（已停用）', ['17.2.0', '19.4.1']), null, 'historical display values cannot be selected as new values')

assert.deepEqual(store.partializeEnumState({
  valuesByType: { 'tos-2-part': ['18.0'], 'tos-3-part': ['18.0.1'] },
  hasHydrated: true,
  hydrationError: 'not persisted',
  modalOpen: true,
  selectedType: 'tos-2-part',
  loading: true,
}), { valuesByType: { 'tos-2-part': ['18.0'], 'tos-3-part': ['18.0.1'] } }, 'persisted partial contains business values only')
assert.equal(store.useEnumStore.getState().selectedType, 'tos-2-part', 'two-part enum is the default configuration focus')
store.useEnumStore.getState().setSelectedType('tos-3-part')
assert.equal(store.useEnumStore.getState().selectedType, 'tos-3-part', 'configuration focus can be selected before navigation')
assert.deepEqual(store.partializeEnumState(store.useEnumStore.getState()), {
  valuesByType: store.useEnumStore.getState().valuesByType,
}, 'configuration focus remains non-persisted UI state')
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
const storeSource = readSource(root, 'src/stores/enums.ts')
const hookSource = readSource(root, 'src/hooks/useTosEnumOptions.ts')
const addProjectSource = readSource(root, 'src/components/workspace/AddProjectModal.tsx')
const projectSpaceSource = readSource(root, 'src/containers/ProjectSpaceContainer.tsx')
const projectStoreSource = readSource(root, 'src/stores/project.ts')
const roadmapModuleSource = readSource(root, 'src/components/roadmap/ProjectRoadmapModule.tsx')
assert.match(configUi, /key:\s*['"]enum['"][\s\S]*枚举值配置/, 'configuration center exposes the enum-value tab')
assert.match(configUi, /configTab\s*===\s*['"]enum['"][\s\S]*<EnumConfig/, 'enum tab renders EnumConfig')
assert.match(enumUi, /<Tree\b/, 'enum categories use a scalable tree control')
assert.match(enumUi, /aria-label="枚举分类树"/, 'enum tree exposes an accessible label')
assert.match(enumUi, /pms-enum-tree-node/, 'enum tree renders compact tree node content')
assert.doesNotMatch(enumUi, /pms-enum-type-item/, 'oversized enum type cards are removed')
assert.match(enumUi, /category\.types\.map[\s\S]*TOS_ENUM_REGISTRY\[type\]/, 'fixed category registry drives the visible enum type labels')
assert.match(enumUi, /ENUM_CONFIG_CATEGORIES/, 'enum configuration exposes category navigation')
assert.match(enumUi, /通用/, 'existing tOS enum types belong to the common category')
assert.match(enumUi, /人力资源管道/, 'human-resource pipeline category is available')
assert.match(enumUi, /暂无枚举类型/, 'empty enum categories expose a clear empty state')
assert.match(enumUi, /useEnumStore\(state\s*=>\s*state\.selectedType\)/, 'enum type focus is shared for cross-module navigation')
assert.match(enumUi, /useEnumStore\(state\s*=>\s*state\.setSelectedType\)/, 'enum type focus exposes one non-persisted action')
for (const copy of ['新增枚举值', '历史已保存字符串不受影响', '格式要求', '加载枚举值失败', '暂无枚举值']) {
  assert.ok(enumUi.includes(copy), `EnumConfig must include UI copy: ${copy}`)
}
assert.match(enumUi, /aria-label=\{`编辑枚举值/, 'icon-only edit action has a value-specific aria label')
assert.match(enumUi, /aria-label=\{`删除枚举值/, 'icon-only delete action has a value-specific aria label')
assert.doesNotMatch(enumUi, /添加类型|编辑类型|删除类型/, 'fixed enum types expose no type CRUD')
assert.match(enumUi, /重试/, 'hydration error UI exposes retry')
assert.match(enumUi, /重置本地配置/, 'hydration error UI exposes exact-key reset')
assert.match(enumUi, /const submit = \(\) => \{\s*if \(!tryBeginSubmit\(\)\) return/, 'same-tick repeated submit is rejected before any store write')
assert.match(enumUi, /releaseSubmission\(true\)/, 'successful submit stays guarded through the current event-loop tick')
assert.match(enumUi, /useOverlayInteraction/, 'enum modal reuses shared focus and submission behavior')
assert.match(enumUi, /setDraft\(['"]['"]\)[\s\S]{0,160}restoreEnumTriggerFocus/, 'cancel discards the enum draft and returns focus')
assert.match(storeSource, /hasHydrated/, 'hydration completion lives at the store boundary')
assert.match(storeSource, /hydrationError/, 'hydration failures live at the store boundary')
assert.match(storeSource, /onRehydrateStorage/, 'persist completion callback owns hydration completion')
assert.match(storeSource, /skipHydration:\s*true/, 'browser hydration is started explicitly after mount')
assert.match(storeSource, /export async function ensureEnumHydrated/, 'enum hydration exposes one reusable coordinator')
assert.match(storeSource, /ENUM_STORAGE_KEY/, 'the enum storage key is named for exact reset')
assert.match(hookSource, /ensureEnumHydrated/, 'shared tOS option hook owns reusable enum hydration')
assert.match(addProjectSource, /useTosEnumOptions\(['"]tos-3-part['"]/, 'whole-machine create consumes the three-part enum')
assert.doesNotMatch(addProjectSource, /useRoadmapStore|tosVersions/, 'whole-machine create no longer uses roadmap metadata as an option source')
assert.match(projectSpaceSource, /useTosEnumOptions\(['"]tos-3-part['"]/, 'whole-machine edit consumes the three-part enum')
assert.doesNotMatch(projectSpaceSource, /roadmapTosVersions|roadmapTosOptions/, 'whole-machine edit no longer uses roadmap metadata as an option source')
assert.match(roadmapModuleSource, /useTosEnumOptions\(['"]tos-2-part['"]/, 'roadmap consumes only the two-part enum adapter')
assert.match(projectStoreSource, /allowedFirstSaleTosValues/, 'project mutations accept an explicit current enum allow-list')
assert.match(projectStoreSource, /valuesByType\[['"]tos-3-part['"]\]/, 'project validation falls back only to the hydrated three-part enum')
assert.match(appShell, /styles=\{\{\s*root:/, 'user dropdown uses the Ant Design 6 popup styling API')
assert.doesNotMatch(appShell, /overlayStyle=/, 'deprecated dropdown overlayStyle is removed')
assert.match(appShell, /className="[^"]*pms-main-header[^"]*"[\s\S]*className="pms-main-header__row"/, 'main header exposes responsive layout hooks')
assert.match(appShell, /className="pms-main-header__nav-scroll"[\s\S]*className="pms-main-header__menu"/, 'main navigation has its own scroll container')
assert.match(globalStyles, /@media\s*\(max-width:\s*768px\)[\s\S]*\.pms-main-header__row[\s\S]*flex-wrap:\s*nowrap/, 'narrow header must stay on one row')
assert.match(globalStyles, /\.pms-main-header__nav-scroll[\s\S]*overflow-x:\s*auto[\s\S]*touch-action:\s*pan-x/, 'narrow navigation supports horizontal touch scrolling')
assert.match(globalStyles, /\.pms-main-header__menu[\s\S]*min-width:\s*max-content/, 'menu keeps all destinations in the scrollable track')
assert.match(globalStyles, /\.pms-main-header__user[\s\S]*flex:\s*0\s+0\s+40px/, 'narrow user switcher stays compact and fixed-width')
console.log('enum config contract passed')
