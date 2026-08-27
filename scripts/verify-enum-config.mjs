#!/usr/bin/env node
import assert from 'node:assert/strict'
import { getStringUnionTypeMembers, loadTypeScriptModule, projectRoot, readSource } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const expectedEnumDefinitions = [
  ['first-sale-tos', '首销tOS版本', '整机产品项目 / 技术项目', 'single'],
  ['roadmap-tos', 'tOS版本-路标', 'tOS路标', 'single'],
  ['machine-project-status', '项目状态-整机产品项目', '整机产品项目', 'single'],
  ['technical-project-status', '项目状态-技术项目', '技术项目', 'single'],
  ['tos-capability-project-status', '项目状态-tOS版本项目/能力建设项目', 'tOS版本项目 / 能力建设项目', 'single'],
  ['machine-health-status', '健康状态', '整机产品项目', 'single'],
  ['version-type', '版本类型', '整机产品项目 / tOS版本项目', 'single'],
  ['software-project-level', '软件项目等级', '整机产品项目', 'single'],
  ['product-series', '产品系列', '整机产品项目', 'single'],
  ['research-mode', '研发模式', '整机产品项目', 'single'],
  ['machine-development-mode', '开发模式-整机产品项目', '整机产品项目', 'single'],
  ['technical-development-mode', '开发模式-技术项目', '技术项目', 'single'],
  ['upgrade-strategy', '升级策略', '整机产品项目', 'single'],
  ['system-type', '系统类型', '整机产品项目', 'single'],
  ['kernel-version', 'Kernel版本', '整机产品项目', 'single'],
  ['chip-mapping', '芯片编码/芯片型号/芯片平台', '整机产品项目', 'chip-map'],
  ['memory-size', '内存大小', '整机产品项目', 'single'],
  ['project-category-mapping', '项目分类', '整机产品项目 / tOS版本项目 / 技术项目 / 能力建设项目', 'project-category-map'],
  ['build-option', '编译选项', '整机产品项目', 'single'],
  ['build-market', '编译市场', '整机产品项目', 'single'],
  ['tmg-subdomain-mapping', 'TMG及技术领域&子领域', '技术项目', 'tmg-map'],
  ['core-value', '核心价值', '技术项目', 'single'],
]
const expectedEnumTypeKeys = expectedEnumDefinitions.map(([key]) => key)
const expectedColumnsByKind = {
  single: definition => [{ key: 'value', label: definition.label }],
  'chip-map': () => [
    { key: 'chipCode', label: '芯片编码' },
    { key: 'chipModel', label: '芯片型号' },
    { key: 'chipPlatform', label: '芯片平台' },
  ],
  'project-category-map': () => [
    { key: 'ipmProjectCategory', label: 'IPM项目分类' },
    { key: 'pmsProjectCategory', label: 'PMS项目分类' },
    { key: 'pmsSecondaryCategory', label: 'PMS二级项目分类' },
  ],
  'tmg-map': () => [
    { key: 'domain', label: 'TMG及技术领域' },
    { key: 'subdomain', label: '子领域' },
  ],
}

console.log('[registry-contract] verifying 22-type flat enum registry')
const values = loadTypeScriptModule(root, 'src/lib/enumValues.ts')
assert.deepEqual(values.ENUM_TYPE_KEYS, expectedEnumTypeKeys, 'enum type keys are exported in the exact approved order')
assert.deepEqual(Object.keys(values.ENUM_DEFINITIONS), expectedEnumTypeKeys, 'registry preserves the exact approved key order')
assert.deepEqual(
  Object.values(values.ENUM_DEFINITIONS).map(({ key, label, scopeLabel, kind }) => [key, label, scopeLabel, kind]),
  expectedEnumDefinitions,
  'registry labels, scope labels, and kinds are exact',
)
assert.deepEqual(
  Object.values(values.ENUM_DEFINITIONS).reduce((counts, definition) => {
    counts[definition.kind] = (counts[definition.kind] ?? 0) + 1
    return counts
  }, {}),
  { single: 19, 'chip-map': 1, 'project-category-map': 1, 'tmg-map': 1 },
  'registry has exactly 19 single types and one of each mapping kind',
)
for (const definition of Object.values(values.ENUM_DEFINITIONS)) {
  assert.deepEqual(definition.columns, expectedColumnsByKind[definition.kind](definition), `${definition.key} exposes the exact columns for ${definition.kind}`)
}
assert.equal(values.isEnumTypeKey('core-value'), true, 'registered enum keys are recognized')
assert.equal(values.isEnumTypeKey('tos-2-part'), false, 'legacy tOS keys are absent from the flat registry guard')
assert.equal(values.isEnumTypeKey('unknown'), false, 'unknown enum keys are rejected')
assert.equal(values.isLegacyTosEnumTypeKey('tos-2-part'), true, 'the separately named compatibility guard recognizes legacy tOS keys')
assert.equal(values.isLegacyTosEnumTypeKey('first-sale-tos'), false, 'the legacy guard does not claim flat registry keys')

assert.equal(values.formatEnumCellValue('first-sale-tos', 'value', '18.0'), 'tOS18.0', 'first-sale tOS display adds the tOS prefix')
assert.equal(values.formatEnumCellValue('roadmap-tos', 'value', 'alpha'), 'tOSalpha', 'roadmap tOS display adds the tOS prefix')
assert.equal(values.formatEnumCellValue('machine-project-status', 'value', '进行中'), '进行中', 'other single values do not gain a tOS prefix')
assert.equal(values.formatEnumCellValue('chip-mapping', 'chipModel', 'tOS9000'), 'tOS9000', 'mapping cells do not gain a tOS prefix')
assert.equal(values.normalizeEnumFieldValue('first-sale-tos', 'value', ' tOS18.0 '), '18.0', 'one literal leading tOS prefix is removed from first-sale values')
assert.equal(values.normalizeEnumFieldValue('roadmap-tos', 'value', ' tOStOS18.0 '), 'tOS18.0', 'normalization removes only one literal tOS prefix')
assert.equal(values.normalizeEnumFieldValue('machine-project-status', 'value', ' tOS18.0 '), 'tOS18.0', 'non-tOS types only trim strings')
assert.deepEqual(values.validateAndNormalizeEnumRow('first-sale-tos', { value: ' alpha ' }, []), { ok: true, row: { value: 'alpha' } }, 'arbitrary nonempty single strings are valid')
assert.deepEqual(values.validateAndNormalizeEnumRow('roadmap-tos', { value: '   ' }, []), {
  ok: false,
  reason: 'invalid',
  fieldErrors: { value: '不能为空' },
}, 'whitespace-only values are invalid')
assert.deepEqual(values.validateAndNormalizeEnumRow('core-value', { value: 'Alpha' }, [{ id: 'one', value: 'alpha' }]), { ok: true, row: { value: 'Alpha' } }, 'single duplicate checks are case-sensitive')
assert.deepEqual(values.validateAndNormalizeEnumRow('core-value', { value: ' alpha ' }, [{ id: 'one', value: 'alpha' }]), {
  ok: false,
  reason: 'duplicate',
  fieldErrors: { value: '枚举值不能重复' },
}, 'single rows reject an exact normalized duplicate')
assert.deepEqual(values.validateAndNormalizeEnumRow('chip-mapping', { chipCode: 'C1', chipModel: 'M2', chipPlatform: 'P1' }, [{ id: 'one', chipCode: 'C1', chipModel: 'M1', chipPlatform: 'P1' }]), {
  ok: true,
  row: { chipCode: 'C1', chipModel: 'M2', chipPlatform: 'P1' },
}, 'chip codes may repeat when another field differs')
assert.deepEqual(values.validateAndNormalizeEnumRow('chip-mapping', { chipCode: ' C1 ', chipModel: ' M1 ', chipPlatform: ' P1 ' }, [{ id: 'one', chipCode: 'C1', chipModel: 'M1', chipPlatform: 'P1' }]), {
  ok: false,
  reason: 'duplicate',
  fieldErrors: { chipCode: '该行已存在', chipModel: '该行已存在', chipPlatform: '该行已存在' },
}, 'chip mappings reject only a fully identical normalized row')
assert.deepEqual(values.validateAndNormalizeEnumRow('tmg-subdomain-mapping', { domain: '平台', subdomain: '安全' }, [{ id: 'one', domain: '平台', subdomain: '性能' }]), {
  ok: true,
  row: { domain: '平台', subdomain: '安全' },
}, 'TMG mappings may repeat a domain when the subdomain differs')
assert.deepEqual(values.validateAndNormalizeEnumRow('tmg-subdomain-mapping', { domain: ' 平台 ', subdomain: ' 性能 ' }, [{ id: 'one', domain: '平台', subdomain: '性能' }]), {
  ok: false,
  reason: 'duplicate',
  fieldErrors: { domain: '该行已存在', subdomain: '该行已存在' },
}, 'TMG mappings reject a fully identical normalized row')
assert.deepEqual(values.validateAndNormalizeEnumRow('project-category-mapping', {
  ipmProjectCategory: ' 技术平台 ',
  pmsProjectCategory: ' 技术项目 ',
  pmsSecondaryCategory: ' should be removed ',
}, []), {
  ok: true,
  row: { ipmProjectCategory: '技术平台', pmsProjectCategory: '技术项目', pmsSecondaryCategory: '' },
}, 'non-machine project categories force the secondary category to empty')
assert.deepEqual(values.validateAndNormalizeEnumRow('project-category-mapping', {
  ipmProjectCategory: '整机-A',
  pmsProjectCategory: '整机产品项目',
  pmsSecondaryCategory: '   ',
}, []), {
  ok: false,
  reason: 'invalid',
  fieldErrors: { pmsSecondaryCategory: '不能为空' },
}, 'machine project categories require a secondary category')
assert.deepEqual(values.validateAndNormalizeEnumRow('project-category-mapping', {
  ipmProjectCategory: '技术平台',
  pmsProjectCategory: '未知项目',
  pmsSecondaryCategory: '',
}, []), {
  ok: false,
  reason: 'invalid',
  fieldErrors: { pmsProjectCategory: '请选择有效的PMS项目分类' },
}, 'PMS project category is constrained to the four approved values')
assert.deepEqual(values.validateAndNormalizeEnumRow('project-category-mapping', {
  ipmProjectCategory: ' 技术平台 ',
  pmsProjectCategory: '能力建设项目',
  pmsSecondaryCategory: '',
}, [{ id: 'one', ipmProjectCategory: '技术平台', pmsProjectCategory: '技术项目', pmsSecondaryCategory: '' }]), {
  ok: false,
  reason: 'duplicate',
  fieldErrors: { ipmProjectCategory: 'IPM项目分类不能重复' },
}, 'IPM project category names are unique across mappings')
assert.equal(values.getEnumRowSummary('chip-mapping', { id: 'one', chipCode: ' C1 ', chipModel: ' M1 ', chipPlatform: ' P1 ' }), 'C1 / M1 / P1', 'row summaries use normalized field values')
console.log('[registry-contract] passed')

console.log('[legacy-consumers] verifying pre-migration helpers and UI source contracts')
assert.deepEqual(getStringUnionTypeMembers(readSource(root, 'src/types/enums.ts'), 'LegacyTosEnumTypeKey').sort(), ['tos-2-part', 'tos-3-part'], 'temporary compatibility keeps the two legacy tOS string literals isolated from EnumTypeKey')
const options = loadTypeScriptModule(root, 'src/lib/tosEnumOptions.ts')
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
assert.match(configUi, /value:\s*['"]enum['"][\s\S]*label:\s*['"]枚举值配置['"]/, 'configuration center exposes the enum-value capsule option')
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
