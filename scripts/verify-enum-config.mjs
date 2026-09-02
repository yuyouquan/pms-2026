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

assert.equal(values.formatEnumCellValue('first-sale-tos', 'value', '18.0'), 'tOS18.0', 'first-sale tOS display adds the tOS prefix')
assert.equal(values.formatEnumCellValue('first-sale-tos', 'value', ' tOS18.0 '), 'tOS18.0', 'display normalizes an existing tOS prefix exactly once')
assert.equal(values.formatEnumCellValue('roadmap-tos', 'value', 'alpha'), 'tOSalpha', 'roadmap tOS display adds the tOS prefix')
assert.equal(values.formatEnumCellValue('machine-project-status', 'value', '进行中'), '进行中', 'other single values do not gain a tOS prefix')
assert.equal(values.formatEnumCellValue('chip-mapping', 'chipModel', 'tOS9000'), 'tOS9000', 'mapping cells do not gain a tOS prefix')
assert.equal(values.normalizeEnumFieldValue('first-sale-tos', 'value', ' tOS18.0 '), '18.0', 'one literal leading tOS prefix is removed from first-sale values')
assert.equal(values.normalizeEnumFieldValue('roadmap-tos', 'value', ' tOStOS18.0 '), 'tOS18.0', 'normalization removes only one literal tOS prefix')
assert.equal(typeof values.normalizeTosValue, 'function', 'one canonical tOS body helper is exported')
assert.equal(values.normalizeTosValue(' TOSbeta '), 'TOSbeta', 'uppercase TOS is a legal body, not a display prefix')
assert.equal(values.normalizeTosValue(' tosbeta '), 'tosbeta', 'lowercase tos is a legal body, not a display prefix')
assert.equal(values.normalizeTosValue(' 技术预览 '), '技术预览', 'Unicode tOS bodies are preserved')
assert.equal(values.normalizeTosValue(' tOS 18.preview '), '18.preview', 'only the exact tOS display prefix is removed with following spaces')
assert.equal(values.formatEnumCellValue('roadmap-tos', 'value', 'TOSbeta'), 'tOSTOSbeta', 'uppercase TOS bodies receive one display prefix')
assert.equal(values.formatEnumCellValue('roadmap-tos', 'value', 'tosbeta'), 'tOStosbeta', 'lowercase tos bodies receive one display prefix')
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
assert.deepEqual(values.validateAndNormalizeEnumRow('core-value', { value: ' alpha ' }, [{ id: 'one', value: 'alpha' }], 'one'), {
  ok: true,
  row: { value: 'alpha' },
}, 'self-updates exclude the current row from duplicate detection')
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
assert.deepEqual(values.validateAndNormalizeEnumRow('tmg-subdomain-mapping', { domain: ' 平台 ', subdomain: '   ' }, []), {
  ok: false,
  reason: 'invalid',
  fieldErrors: { subdomain: '不能为空' },
}, 'mapping rows report each missing required column')
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
assert.equal(values.getEnumRowSummary('first-sale-tos', { id: 'one', value: ' tOS18.0 ' }), 'tOS18.0', 'row summaries format prefixed tOS values exactly once')
console.log('[registry-contract] passed')

console.log('[seed-contract] verifying exact deterministic initial rows')
const expectedSingleSeeds = {
  'first-sale-tos': ['16.0.1', '16.0.2', '17.2.0', '16.0', '17.2'],
  'roadmap-tos': ['16.0', '17.2'],
  'machine-project-status': ['待立项', '在研', '上市', 'EOS', '转维', '已取消', '已暂停'],
  'technical-project-status': ['进行中', '已完成', '暂停', '已取消'],
  'tos-capability-project-status': ['在研', '已完成'],
  'machine-health-status': ['正常', '关注', '风险'],
  'version-type': ['Full', 'Slim', 'PAD', 'GO'],
  'software-project-level': ['S', 'A', 'B', 'C', 'D'],
  'product-series': [],
  'research-mode': [],
  'machine-development-mode': ['自研', '联合开发', 'ODC', '外研', 'ITD-ODC', 'ODM', '纯外研', 'JDM'],
  'technical-development-mode': ['自研', '谷歌合作', 'SoC合作', '高校合作'],
  'upgrade-strategy': ['不维护', 'EWP维护', '维1', '维2', 'EWP维护+tOS升级', '维1+tOS升级', '维2+tOS升级', '升1维2', '升2维3', '升3维5'],
  'system-type': ['32bit', '64bit', '64only'],
  'kernel-version': ['5.10', '5.15', '6.1', '6.6'],
  'chip-mapping': [],
  'memory-size': ['2GB', '3GB', '4GB', '6GB', '8GB', '12GB', '16GB'],
  'build-option': ['ko2_sl303', 'ko2', 'a681l_sm386', 'lj8k_h781', 'lj8_h781', 'lj7_h782', 'x1103b'],
  'build-market': ['op', 'tr'],
  'core-value': ['追赶', '人无我有', '人有我有'],
}
const expectedTmgSeeds = [
  ['基础架构TMG', '无'], ['性能TMG', '无'], ['DFX TMG', '无'], ['UX TMG', '无'],
  ['系统应用', 'AIOS'], ['系统应用', '应用'], ['系统应用', '图形'], ['系统应用', '内核'], ['系统应用', '多媒体'],
  ['底软通信', '器件'], ['底软通信', '蜂窝'], ['底软通信', '短距'], ['底软通信', '功耗'],
  ['集成维护', '三方体验'], ['集成维护', 'GMS'], ['其他', '安全'], ['其他', 'AIOT'],
]
const machineProjectCategorySeeds = [
  ['整机产品-基线IPD', '整机-手机'],
  ['整机产品-模块化IPD', '整机-手机'],
  ['整机产品-非IPD', '整机-手机'],
  ['手机整机产品-大版本升级', '整机-手机'],
  ['其他-平板--整机产品项目', '整机-平板'],
  ['其他-笔电/移动互联及其他--整机产品项目', '整机-笔电'],
  ['其他-笔电', '整机-笔电'],
  ['移动互联及其他--整机产品项目', '整机-笔电'],
  ['其他-功能机', '整机-功能机'],
  ['其他-AIOT', '整机-AIOT扩品类'],
  ['基线项目', '整机-基线项目'],
  ['N+1项目', '整机-N+1项目'],
  ['预研类项目', '整机-预研项目'],
]
const technicalProjectCategorySeeds = [
  '研发级-基础研究-重点项目', '研发级-基础研究-非重点项目', '部门级-基础研究',
  '研发级-技术研发-重点项目', '研发级-技术研发-非重点项目', '部门级-技术研发', '技术项目前置工作',
]
const capabilityProjectCategorySeeds = ['部门级能力建设', '公司级/研发级能力建设', '公司级能力建设', '研发级能力建设']
const expectedProjectCategorySeeds = [
  ...machineProjectCategorySeeds.map(([ipmProjectCategory, pmsSecondaryCategory]) => ({ ipmProjectCategory, pmsProjectCategory: '整机产品项目', pmsSecondaryCategory })),
  { ipmProjectCategory: '软件产品项目', pmsProjectCategory: 'tOS版本项目', pmsSecondaryCategory: '' },
  ...technicalProjectCategorySeeds.map(ipmProjectCategory => ({ ipmProjectCategory, pmsProjectCategory: '技术项目', pmsSecondaryCategory: '' })),
  ...capabilityProjectCategorySeeds.map(ipmProjectCategory => ({ ipmProjectCategory, pmsProjectCategory: '能力建设项目', pmsSecondaryCategory: '' })),
]
const initialRows = values.createInitialEnumRows()
assert.deepEqual(Object.keys(initialRows), expectedEnumTypeKeys, 'initial rows contain arrays for all 22 keys in registry order')
for (const type of expectedEnumTypeKeys) {
  assert.ok(Array.isArray(initialRows[type]), `${type} seed is an array`)
  initialRows[type].forEach((row, index) => assert.equal(row.id, `seed-${type}-${index + 1}`, `${type} seed IDs are deterministic`))
}
for (const [type, expectedValues] of Object.entries(expectedSingleSeeds)) {
  assert.deepEqual(initialRows[type].map(row => row.value), expectedValues, `${type} has exact seed values and order`)
}
assert.deepEqual(initialRows['tmg-subdomain-mapping'].map(({ domain, subdomain }) => [domain, subdomain]), expectedTmgSeeds, 'TMG seed has the exact 17 mappings and order')
assert.deepEqual(initialRows['project-category-mapping'].map(({ id, ...row }) => row), expectedProjectCategorySeeds, 'project category seed has the exact 25 mappings and order')
console.log('[seed-contract] passed')

console.log('[store-contract] verifying v2 migration, row CRUD, compatibility, and persistence boundaries')
const enumStore = loadTypeScriptModule(root, 'src/stores/enums.ts')
const storeSource = readSource(root, 'src/stores/enums.ts')
const rowValues = (rowsByType, type) => rowsByType[type].map(row => row.value)
const migratedV1 = enumStore.migrateEnumState({
  valuesByType: {
    'tos-2-part': [' 16.0 ', '17.2', '16.0'],
    'tos-3-part': ['16.0.1', ' tOS17.2.0 ', '16.0.1'],
  },
}, 1)
assert.deepEqual(rowValues(migratedV1.rowsByType, 'roadmap-tos'), ['16.0', '17.2'], 'v1 two-part values migrate to roadmap tOS in first-appearance order')
assert.deepEqual(rowValues(migratedV1.rowsByType, 'first-sale-tos'), ['16.0.1', '17.2.0', '16.0', '17.2'], 'v1 first-sale tOS combines three-part values then unseen two-part values')
assert.deepEqual(migratedV1.rowsByType['first-sale-tos'].map(row => row.id), [
  'migrated-first-sale-tos-1', 'migrated-first-sale-tos-2', 'migrated-first-sale-tos-3', 'migrated-first-sale-tos-4',
], 'legacy migrations assign deterministic row IDs')
const arbitraryLegacyStrings = enumStore.migrateEnumState({ valuesByType: {
  'tos-2-part': [' alpha ', 'tOSbeta', 'alpha'],
  'tos-3-part': ['rc', ' tOSpreview '],
} }, 1)
assert.deepEqual(rowValues(arbitraryLegacyStrings.rowsByType, 'roadmap-tos'), ['alpha', 'beta'], 'legacy migration accepts any normalized nonempty two-part strings')
assert.deepEqual(rowValues(arbitraryLegacyStrings.rowsByType, 'first-sale-tos'), ['rc', 'preview', 'alpha', 'beta'], 'legacy migration strips one literal tOS prefix and preserves arbitrary strings in first-appearance order')
const invalidLegacy = enumStore.migrateEnumState({ valuesByType: {
  'tos-2-part': ['', '   ', 17],
  'tos-3-part': { unsafe: true },
} }, 1)
assert.deepEqual(rowValues(invalidLegacy.rowsByType, 'roadmap-tos'), expectedSingleSeeds['roadmap-tos'], 'unusable legacy two-part data falls back to roadmap seeds')
assert.deepEqual(rowValues(invalidLegacy.rowsByType, 'first-sale-tos'), expectedSingleSeeds['first-sale-tos'], 'unusable legacy three-part data falls back to first-sale seeds')
assert.deepEqual(rowValues(invalidLegacy.rowsByType, 'machine-project-status'), expectedSingleSeeds['machine-project-status'], 'legacy migration seeds unrelated flat types')
const partiallyValidLegacy = enumStore.migrateEnumState({ valuesByType: {
  'tos-2-part': [null, '18.0', '', '18.0'],
  'tos-3-part': [{}, '18.0.1'],
} }, 1)
assert.deepEqual(rowValues(partiallyValidLegacy.rowsByType, 'roadmap-tos'), ['18.0'], 'legacy migration filters blank, non-string, and duplicate values when safe values remain')
assert.deepEqual(rowValues(partiallyValidLegacy.rowsByType, 'first-sale-tos'), ['18.0.1', '18.0'], 'legacy migration preserves first appearance after filtering malformed values')
const independentlyRecoverableLegacy = enumStore.migrateEnumState({ valuesByType: {
  'tos-2-part': { unsafe: true },
  'tos-3-part': ['19.0.1'],
} }, 1)
assert.deepEqual(rowValues(independentlyRecoverableLegacy.rowsByType, 'roadmap-tos'), expectedSingleSeeds['roadmap-tos'], 'an unsafe legacy two-part type falls back independently')
assert.deepEqual(rowValues(independentlyRecoverableLegacy.rowsByType, 'first-sale-tos'), ['19.0.1'], 'safe three-part data is preserved when only the old two-part type is unusable')
const twoPartOnlyLegacy = enumStore.migrateEnumState({ valuesByType: {
  'tos-2-part': ['candidate'],
  'tos-3-part': [null, '   '],
} }, 1)
assert.deepEqual(rowValues(twoPartOnlyLegacy.rowsByType, 'roadmap-tos'), ['candidate'], 'safe two-part data is preserved when the old three-part type is unusable')
assert.deepEqual(rowValues(twoPartOnlyLegacy.rowsByType, 'first-sale-tos'), ['candidate'], 'safe two-part values still contribute to first-sale when no three-part value is usable')
const explicitlyEmptyLegacy = enumStore.migrateEnumState({ valuesByType: {
  'tos-2-part': [],
  'tos-3-part': [],
} }, 1)
assert.deepEqual(rowValues(explicitlyEmptyLegacy.rowsByType, 'roadmap-tos'), [], 'an explicitly empty legacy two-part array remains empty')
assert.deepEqual(rowValues(explicitlyEmptyLegacy.rowsByType, 'first-sale-tos'), [], 'two explicitly empty legacy arrays keep first-sale empty')
const malformedTwoPartEmptyThreePart = enumStore.migrateEnumState({ valuesByType: {
  'tos-2-part': [null, '   '],
  'tos-3-part': [],
} }, 1)
assert.deepEqual(rowValues(malformedTwoPartEmptyThreePart.rowsByType, 'roadmap-tos'), expectedSingleSeeds['roadmap-tos'], 'a malformed legacy two-part array still falls back for roadmap')
assert.deepEqual(rowValues(malformedTwoPartEmptyThreePart.rowsByType, 'first-sale-tos'), [], 'an explicitly empty three-part array keeps first-sale empty when two-part is malformed')
const emptyTwoPartMalformedThreePart = enumStore.migrateEnumState({ valuesByType: {
  'tos-2-part': [],
  'tos-3-part': { unsafe: true },
} }, 1)
assert.deepEqual(rowValues(emptyTwoPartMalformedThreePart.rowsByType, 'roadmap-tos'), [], 'an explicitly empty two-part array remains empty when three-part is malformed')
assert.deepEqual(rowValues(emptyTwoPartMalformedThreePart.rowsByType, 'first-sale-tos'), [], 'an explicitly empty two-part array keeps first-sale empty when three-part is malformed')
assert.deepEqual(enumStore.migrateEnumState({ valuesByType: {
  'tos-2-part': ['18.0'], 'tos-3-part': ['18.0.1'],
} }, 0), enumStore.migrateEnumState({ valuesByType: {
  'tos-2-part': ['18.0'], 'tos-3-part': ['18.0.1'],
} }, 1), 'persisted versions 0 and 1 share the explicit legacy migration path')

const migratedV2 = enumStore.migrateEnumState({ rowsByType: {
  'core-value': [
    { id: 'keep-me', value: ' 自定义 ' },
    { value: '另一个' },
    { id: 'blank', value: '   ' },
    { id: 'duplicate', value: '自定义' },
  ],
  'product-series': [],
  'tmg-subdomain-mapping': [{ id: 'broken', domain: '平台', subdomain: '' }],
} }, 2)
assert.deepEqual(migratedV2.rowsByType['core-value'], [
  { id: 'keep-me', value: '自定义' },
  { id: 'migrated-core-value-2', value: '另一个' },
], 'v2 sanitation preserves valid IDs, fills missing IDs deterministically, and drops malformed or duplicate rows')
assert.deepEqual(migratedV2.rowsByType['product-series'], [], 'an explicitly empty valid v2 array stays empty')
assert.deepEqual(migratedV2.rowsByType['tmg-subdomain-mapping'], initialRows['tmg-subdomain-mapping'], 'a wholly unusable v2 type falls back to that type seed')
assert.deepEqual(migratedV2.rowsByType['roadmap-tos'], initialRows['roadmap-tos'], 'missing v2 types fall back to their seeds')
const collisionSafeV2 = enumStore.migrateEnumState({ rowsByType: {
  'product-series': [
    { id: 'migrated-product-series-2', value: '已有ID' },
    { value: '缺少ID' },
  ],
} }, 2)
assert.deepEqual(collisionSafeV2.rowsByType['product-series'].map(row => row.id), [
  'migrated-product-series-2', 'migrated-product-series-3',
], 'generated migration IDs deterministically avoid a preserved-ID collision')
const reverseCollisionSafeV2 = enumStore.migrateEnumState({ rowsByType: {
  'product-series': [
    { value: '先出现但缺少ID' },
    { id: 'migrated-product-series-1', value: '后出现且已有ID' },
  ],
} }, 2)
assert.deepEqual(reverseCollisionSafeV2.rowsByType['product-series'].map(row => row.id), [
  'migrated-product-series-2', 'migrated-product-series-1',
], 'missing-ID generation reserves later valid incoming IDs before assigning deterministic IDs')

const mutableInitial = values.createInitialEnumRows()
mutableInitial['product-series'] = []
const generatedIds = ['user-1', 'user-2']
const fixture = enumStore.createEnumStore({ rowsByType: mutableInitial }, () => generatedIds.shift() ?? 'unexpected-id')
assert.deepEqual(fixture.addEnumRow('product-series', { value: '系列B' }), { ok: true }, 'row add succeeds')
assert.deepEqual(fixture.addEnumRow('product-series', { value: '系列A' }), { ok: true }, 'row add appends rather than sorting')
assert.deepEqual(fixture.getRows('product-series'), [
  { id: 'user-1', value: '系列B' }, { id: 'user-2', value: '系列A' },
], 'injected ID factory is deterministic and additions preserve insertion order')
assert.deepEqual(fixture.updateEnumRow('product-series', 'user-1', { value: '系列C' }), { ok: true }, 'row update succeeds by ID')
assert.deepEqual(fixture.getRows('product-series'), [
  { id: 'user-1', value: '系列C' }, { id: 'user-2', value: '系列A' },
], 'row update preserves position and ID')
assert.deepEqual(fixture.updateEnumRow('product-series', 'user-1', { value: '系列A' }), {
  ok: false, reason: 'duplicate', fieldErrors: { value: '枚举值不能重复' },
}, 'row update validates duplicates while excluding its own ID')
assert.deepEqual(fixture.addEnumRow('product-series', { value: '   ' }), {
  ok: false, reason: 'invalid', fieldErrors: { value: '不能为空' },
}, 'row add returns field validation errors')
assert.deepEqual(fixture.updateEnumRow('product-series', 'missing', { value: '系列D' }), { ok: false, reason: 'missing' }, 'row update reports a missing ID')
assert.deepEqual(fixture.deleteEnumRow('product-series', 'missing'), { ok: false, reason: 'missing' }, 'row delete reports a missing ID')
assert.deepEqual(fixture.deleteEnumRow('product-series', 'user-1'), { ok: true }, 'row delete succeeds by exact ID')
assert.deepEqual(fixture.getRows('product-series'), [{ id: 'user-2', value: '系列A' }], 'row deletion removes only the requested ID')
fixture.resetLocalConfig()
assert.deepEqual(fixture.getRows('product-series'), [], 'reset restores exact seeds')

const compatibilityFixture = enumStore.createEnumStore({ rowsByType: values.createInitialEnumRows() }, () => 'flat-user-id')
assert.equal(compatibilityFixture.getState().selectedType, 'first-sale-tos', 'flat first-sale tOS is the default selected type')
compatibilityFixture.setSelectedType('core-value')
assert.equal(compatibilityFixture.getState().selectedType, 'core-value', 'selected type changes without entering persisted state')

const partialized = enumStore.partializeEnumState(compatibilityFixture.getState())
assert.deepEqual(Object.keys(partialized), ['rowsByType'], 'only rowsByType is persisted')
assert.notEqual(partialized.rowsByType, compatibilityFixture.getState().rowsByType, 'persisted rows are deep-cloned')
partialized.rowsByType['roadmap-tos'][0].value = 'mutated-copy'
assert.equal(compatibilityFixture.getRows('roadmap-tos')[0].value, '16.0', 'mutating a persistence snapshot cannot mutate store memory')
assert.equal(enumStore.useEnumStore.persist.getOptions().version, 2, 'persist middleware exposes version 2 through its runtime options')
const previousWindow = globalThis.window
const officialPersistStorage = enumStore.useEnumStore.persist.getOptions().storage
try {
  let readFailure = null
  let shouldFailWrite = false
  let storedValue = null
  const removedKeys = []
  globalThis.window = {
    localStorage: {
      getItem: () => {
        if (readFailure) throw readFailure
        return storedValue
      },
      setItem: (_name, value) => {
        if (shouldFailWrite) throw new Error('storage blocked')
        storedValue = value
      },
      removeItem: name => {
        removedKeys.push(name)
        storedValue = null
      },
    },
  }
  const syncGetResult = officialPersistStorage.getItem(enumStore.ENUM_STORAGE_KEY)
  const syncSetResult = officialPersistStorage.setItem(enumStore.ENUM_STORAGE_KEY, {
    state: enumStore.partializeEnumState(enumStore.useEnumStore.getState()),
    version: 2,
  })
  const syncRemoveResult = officialPersistStorage.removeItem(enumStore.ENUM_STORAGE_KEY)
  assert.equal(syncGetResult instanceof Promise, false, 'official localStorage adapter reads synchronously')
  assert.equal(syncSetResult instanceof Promise, false, 'official localStorage adapter writes synchronously')
  assert.equal(syncRemoveResult instanceof Promise, false, 'official localStorage adapter removes synchronously')
  removedKeys.length = 0

  readFailure = new Error('unexpected persistence failure')
  const failedHydration = await enumStore.useEnumStore.getState().hydrateEnumStore()
  assert.equal(failedHydration, false, 'a synchronous storage read failure resolves hydration as false')
  assert.equal(enumStore.useEnumStore.getState().hasHydrated, true, 'failed hydration still reaches a completed state')
  assert.equal(enumStore.useEnumStore.getState().hydrationError, '本地枚举配置加载失败，请重试或重置本地配置。', 'unexpected hydration failures use the generic recovery message')

  readFailure = null
  const successfulRetry = await enumStore.useEnumStore.getState().hydrateEnumStore()
  assert.equal(successfulRetry, true, 'hydration can be retried successfully after storage recovers')
  assert.equal(enumStore.useEnumStore.getState().hydrationError, null, 'successful retry clears the prior hydration error')

  assert.deepEqual(enumStore.useEnumStore.getState().addEnumRow('roadmap-tos', { value: 'bridge-added' }), { ok: true }, 'official row add succeeds before bridge projection check')
  const bridgeRow = enumStore.useEnumStore.getState().rowsByType['roadmap-tos'].find(row => row.value === 'bridge-added')
  assert.ok(bridgeRow, 'official add exposes the created row ID')
  assert.deepEqual(enumStore.useEnumStore.getState().updateEnumRow('roadmap-tos', bridgeRow.id, { value: 'bridge-updated' }), { ok: true }, 'official row update succeeds before bridge projection check')
  assert.deepEqual(enumStore.useEnumStore.getState().deleteEnumRow('roadmap-tos', bridgeRow.id), { ok: true }, 'official row delete succeeds before bridge projection check')

  shouldFailWrite = true
  const beforeWriteFailure = enumStore.useEnumStore.getState().rowsByType['product-series']
  const failedWrite = enumStore.useEnumStore.getState().addEnumRow('product-series', { value: '不会留在内存' })
  assert.deepEqual(failedWrite, { ok: false, reason: 'storage' }, 'a synchronous persistence failure is reported by the action')
  assert.deepEqual(enumStore.useEnumStore.getState().rowsByType['product-series'], beforeWriteFailure, 'a failed persistence write rolls memory back')
  assert.equal(enumStore.useEnumStore.getState().hydrationError, '本地枚举存储不可用，请检查浏览器权限后重试。', 'a failed persistence write retains the recovery message')

  shouldFailWrite = false
  readFailure = new Error('storage blocked')
  assert.equal(await enumStore.useEnumStore.getState().hydrateEnumStore(), false, 'a later hydration failure can enter the reset recovery path')
  readFailure = null
  const resetSucceeded = await enumStore.useEnumStore.getState().resetLocalConfig()
  assert.equal(resetSucceeded, true, 'reset recovers after a failed hydration once storage is available')
  assert.deepEqual(removedKeys, [enumStore.ENUM_STORAGE_KEY], 'reset removes only the exact enum storage key')
  assert.deepEqual(enumStore.useEnumStore.getState().rowsByType, values.createInitialEnumRows(), 'reset restores all exact seed rows')
  assert.equal(enumStore.useEnumStore.getState().hydrationError, null, 'successful reset clears the recovery error')

  let immediateReadCount = 0
  let immediateSavedValue = null
  enumStore.useEnumStore.persist.setOptions({
    storage: {
      getItem: () => {
        immediateReadCount += 1
        return immediateSavedValue
      },
      setItem: (_name, value) => { immediateSavedValue = value },
      removeItem: () => { immediateSavedValue = null },
    },
  })
  const sameTurnHydrate = enumStore.useEnumStore.getState().hydrateEnumStore()
  const sameTurnReset = enumStore.useEnumStore.getState().resetLocalConfig()
  assert.deepEqual(await Promise.all([sameTurnHydrate, sameTurnReset]), [true, true], 'same-turn hydrate and reset both complete successfully')
  assert.equal(immediateReadCount, 2, 'same-turn reset starts its own post-reset hydration')
  assert.deepEqual(enumStore.useEnumStore.getState().rowsByType, values.createInitialEnumRows(), 'same-turn hydrate/reset finishes on seeds')
  assert.equal(enumStore.useEnumStore.getState().hasHydrated, true, 'same-turn hydrate/reset never finishes with hydration incomplete')
  assert.equal(enumStore.useEnumStore.getState().hydrationError, null, 'same-turn hydrate/reset finishes without an error')

  const staleRows = values.createInitialEnumRows()
  staleRows['product-series'] = [{ id: 'stale-row', value: 'stale-value' }]
  let releaseDelayedHydration
  let delayedReadCount = 0
  let delayedSavedValue = null
  enumStore.useEnumStore.persist.setOptions({
    storage: {
      getItem: () => {
        delayedReadCount += 1
        if (delayedReadCount === 1) {
          return new Promise(resolve => { releaseDelayedHydration = resolve })
        }
        return delayedSavedValue
      },
      setItem: (_name, value) => { delayedSavedValue = value },
      removeItem: () => { delayedSavedValue = null },
    },
  })
  const delayedHydrate = enumStore.useEnumStore.getState().hydrateEnumStore()
  const resetDuringHydrate = enumStore.useEnumStore.getState().resetLocalConfig()
  releaseDelayedHydration({ state: { rowsByType: staleRows }, version: 2 })
  assert.deepEqual(await Promise.all([delayedHydrate, resetDuringHydrate]), [true, true], 'delayed hydration and reset both complete successfully')
  assert.equal(delayedReadCount, 2, 'reset waits for a delayed hydration and then starts a distinct post-reset hydration')
  assert.deepEqual(enumStore.useEnumStore.getState().rowsByType, values.createInitialEnumRows(), 'stale delayed hydration cannot overwrite reset seeds')
  assert.equal(enumStore.useEnumStore.getState().hasHydrated, true, 'delayed hydrate/reset finishes with hydration complete')
  assert.equal(enumStore.useEnumStore.getState().hydrationError, null, 'delayed hydrate/reset finishes without an error')

  const freshPersistedRows = values.createInitialEnumRows()
  freshPersistedRows['product-series'] = [{ id: 'persisted-custom-series', value: '持久化自定义系列' }]
  freshPersistedRows['version-type'] = []
  let releaseFreshSessionHydration
  let freshSessionReadCount = 0
  enumStore.useEnumStore.persist.setOptions({
    storage: {
      getItem: () => {
        freshSessionReadCount += 1
        return new Promise(resolve => { releaseFreshSessionHydration = resolve })
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    },
  })
  enumStore.useEnumStore.setState({ hasHydrated: false, hydrationError: null })
  const firstFreshSessionHydration = enumStore.ensureEnumHydrated()
  const duplicateFreshSessionHydration = enumStore.ensureEnumHydrated()
  assert.equal(enumStore.useEnumStore.getState().hasHydrated, false, 'fresh session remains gated while persisted enum loading is delayed')
  assert.notDeepEqual(
    enumStore.useEnumStore.getState().rowsByType['product-series'],
    freshPersistedRows['product-series'],
    'seed memory is observably stale until delayed persisted rows arrive',
  )
  releaseFreshSessionHydration({ state: { rowsByType: freshPersistedRows }, version: 2 })
  assert.deepEqual(
    await Promise.all([firstFreshSessionHydration, duplicateFreshSessionHydration]),
    [true, true],
    'all relevant consumers observe successful completion of the shared hydration',
  )
  assert.equal(freshSessionReadCount, 1, 'concurrent form hydration requests deduplicate to one persisted read')
  assert.deepEqual(
    enumStore.useEnumStore.getState().rowsByType['product-series'],
    freshPersistedRows['product-series'],
    'fresh-session custom persisted rows replace seeds before forms can become ready',
  )
  assert.deepEqual(
    enumStore.useEnumStore.getState().rowsByType['version-type'],
    [],
    'fresh-session persisted empty configuration replaces seeded options before forms can become ready',
  )
} finally {
  enumStore.useEnumStore.persist.setOptions({ storage: officialPersistStorage })
  if (previousWindow === undefined) delete globalThis.window
  else globalThis.window = previousWindow
}
console.log('[store-contract] passed')

console.log('[flat-consumers] verifying UI source contracts')
const enumUi = readSource(root, 'src/components/config/EnumConfig.tsx')
const configUi = readSource(root, 'src/containers/ConfigContainer.tsx')
const appShell = readSource(root, 'src/containers/AppShell.tsx')
const globalStyles = readSource(root, 'src/styles/globals.css')
const hookSource = readSource(root, 'src/hooks/useEnumOptions.ts')
const addProjectSource = readSource(root, 'src/components/workspace/AddProjectModal.tsx')
const projectSpaceSource = readSource(root, 'src/containers/ProjectSpaceContainer.tsx')
const projectStoreSource = readSource(root, 'src/stores/project.ts')
const roadmapModuleSource = readSource(root, 'src/components/roadmap/ProjectRoadmapModule.tsx')
assert.match(configUi, /value:\s*['"]enum['"][\s\S]*label:\s*['"]枚举值配置['"]/, 'configuration center exposes the enum-value capsule option')
assert.match(configUi, /configTab\s*===\s*['"]enum['"][\s\S]*<EnumConfig/, 'enum tab renders EnumConfig')
assert.match(configUi, /<EnumConfig[\s\S]*currentLoginUser=\{currentLoginUser\}/, 'configuration center passes the current login user into EnumConfig')
assert.match(enumUi, /ENUM_TYPE_KEYS/, 'flat registry order drives the enum type list')
assert.match(enumUi, /ENUM_DEFINITIONS/, 'registry definitions drive labels, scopes, kinds, and dynamic columns')
assert.match(enumUi, /rowsByType/, 'the UI reads the v2 row registry')
assert.match(enumUi, /addEnumRow/, 'the UI adds complete dynamic rows')
assert.match(enumUi, /updateEnumRow/, 'the UI updates rows by stable ID')
assert.match(enumUi, /deleteEnumRow/, 'the UI deletes rows by stable ID')
assert.match(enumUi, /配置项（22）/, 'flat left panel exposes the exact approved title')
assert.match(enumUi, /ENUM_TYPE_KEYS\.filter[\s\S]*definition\.label[\s\S]*(?:includes|indexOf)/, 'search matches Chinese registry labels while filtering the ordered key list')
assert.match(enumUi, /rowsByType\[type\]\.length/, 'each flat type item displays its current row count')
assert.match(enumUi, /pms-enum-type-item--active/, 'the selected flat type item exposes the active class')
assert.doesNotMatch(enumUi, /\bTree\b|<Tree\b/, 'the obsolete Ant Design Tree is removed')
assert.doesNotMatch(enumUi, /ENUM_CONFIG_CATEGORIES|EnumConfigCategoryKey|通用|人力资源管道|pms-enum-category|pms-enum-tree/, 'category constants, copy, and tree/category classes are removed')
assert.doesNotMatch(globalStyles, /pms-enum-(?:category|tree)/, 'obsolete enum category and tree styles are removed')
assert.match(globalStyles, /\.pms-enum-type-item--active[\s\S]*box-shadow:\s*inset\s+3px\s+0\s+0/, 'flat active item keeps the purple left accent')
assert.match(globalStyles, /@media\s*\(max-width:\s*900px\)[\s\S]*\.pms-enum-workspace-shell\s*>\s*\.pms-config-workspace[\s\S]*grid-template-columns:\s*1fr/, 'enum list stacks above the table at the approved narrow breakpoint')
assert.match(globalStyles, /@media\s*\(max-width:\s*900px\)[\s\S]*\.pms-enum-sidebar[\s\S]*max-height:\s*280px[\s\S]*overflow-y:\s*auto/, 'stacked enum list keeps a bounded internal scroll region')
assert.doesNotMatch(globalStyles, /\.pms-enum-workspace-shell\s*,[\s\S]{0,160}height:\s*100%/, 'enum wrapper no longer adds a full parent height below the configuration header')
assert.match(globalStyles, /\.pms-enum-workspace-shell\s*\{[\s\S]{0,260}height:\s*calc\(100dvh\s*-\s*217px\)[\s\S]{0,180}overflow:\s*hidden/, 'desktop enum wrapper uses the same bounded viewport calculation as ConfigWorkspaceShell')
assert.match(globalStyles, /@media\s*\(max-width:\s*900px\)[\s\S]*grid-template-rows:\s*minmax\([^;]+\)\s+minmax\(0,\s*1fr\)[\s\S]*height:\s*100%[\s\S]*overflow:\s*hidden/, '761-900 stacked layout remains bounded with a scrollable right-hand remainder')
assert.match(enumUi, /useEnumStore\(state\s*=>\s*state\.selectedType\)/, 'enum type focus is shared for cross-module navigation')
assert.match(enumUi, /useEnumStore\(state\s*=>\s*state\.setSelectedType\)/, 'enum type focus exposes one non-persisted action')
assert.match(enumUi, /title:\s*['"]序号['"][\s\S]*render:\s*\([^)]*,\s*[^)]*,\s*index\)\s*=>\s*index\s*\+\s*1/, 'the first table column renders a one-based sequence number')
assert.match(enumUi, /selectedDefinition\.columns\.map/, 'business columns are generated from the selected registry definition')
assert.match(enumUi, /formatEnumCellValue/, 'table cells use the central formatter so tOS has one display prefix')
assert.match(enumUi, /canEditEnums[\s\S]*title:\s*['"]操作['"]/, 'the action column is appended only for users with enum-edit permission')
assert.match(enumUi, /const hasGlobalPermission\s*=\s*useHasGlobalPermission\(currentLoginUser\)/, 'EnumConfig resolves global permissions for the current user')
assert.match(enumUi, /hasGlobalPermission\(['"]configCenter:enumEdit['"]\)/, 'enum mutations use the dedicated enum-edit permission')
for (const copy of ['新增枚举值', '加载枚举值失败', '暂无配置值', '单字段', '两列映射', '三列映射', '芯片编码', '芯片型号', '芯片平台', 'IPM项目分类', 'PMS项目分类', 'PMS二级项目分类', 'TMG及技术领域', '子领域']) {
  assert.ok(enumUi.includes(copy), `EnumConfig must include UI copy: ${copy}`)
}
for (const projectCategory of ['整机产品项目', 'tOS版本项目', '技术项目', '能力建设项目']) {
  assert.ok(enumUi.includes(projectCategory), `project category select includes exact option: ${projectCategory}`)
}
assert.match(enumUi, /pmsProjectCategory[\s\S]*setDraft[\s\S]*pmsSecondaryCategory:\s*value\s*===\s*['"]整机产品项目['"]\s*\?[^:]+:\s*['"]['"]/, 'switching PMS category immediately clears the secondary category')
assert.match(enumUi, /fieldItem\(['"]pmsSecondaryCategory['"][\s\S]{0,160}draft\.pmsProjectCategory\s*!==\s*['"]整机产品项目['"]\)/, 'secondary category is disabled outside whole-machine projects')
assert.match(enumUi, /getEnumRowSummary\(deleteType,\s*row/, 'delete confirmation includes the central row summary for its captured type')
assert.match(enumUi, /const \[editorType,\s*setEditorType\]\s*=\s*useState<EnumTypeKey\s*\|\s*null>/, 'the editor captures an immutable enum type while its modal is open')
assert.equal((enumUi.match(/setEditorType\(selectedType\)/g) ?? []).length, 2, 'both add and edit opening capture the currently selected type')
assert.match(enumUi, /editorDefinition\s*=\s*editorType\s*\?\s*ENUM_DEFINITIONS\[editorType\]/, 'modal definition and schema come from the captured editor type')
assert.match(enumUi, /const storeDraft\s*=\s*Object\.fromEntries\([\s\S]{0,180}editorDefinition\.columns\.map/, 'draft normalization uses the captured editor definition columns')
assert.match(enumUi, /const renderDraftFields[\s\S]{0,180}if \(!editorDefinition\) return null[\s\S]{0,180}editorDefinition\.kind/, 'dynamic modal fields render from the captured editor definition')
assert.match(enumUi, /title=\{editorDefinition[\s\S]{0,180}editorDefinition\.label/, 'modal title uses the captured editor definition label')
assert.match(enumUi, /addEnumRow\(editorType,/, 'add targets the captured editor type')
assert.match(enumUi, /updateEnumRow\(editorType,/, 'update targets the captured editor type and stable row ID')
assert.doesNotMatch(enumUi, /(?:addEnumRow|updateEnumRow)\(selectedType,/, 'modal mutations never retarget to a later live selection')
assert.match(enumUi, /setEditorType\(null\)/, 'closing the editor clears its captured type')
assert.match(enumUi, /const deleteType\s*=\s*selectedType[\s\S]{0,900}deleteEnumRow\(deleteType,\s*row\.id\)/, 'delete confirmation captures its own type before the asynchronous confirmation')
assert.match(enumUi, /const canEditRef\s*=\s*useRef\(canEditEnums\)/, 'mutation-time permission state is retained in a live ref')
assert.match(enumUi, /canEditRef\.current\s*=\s*canEditEnums/, 'the live permission ref is synchronized on every render')
assert.match(enumUi, /if \(!canEditRef\.current\)[\s\S]{0,500}(?:addEnumRow|updateEnumRow)\(editorType,/, 'submit re-checks live permission immediately before its row mutation')
assert.match(enumUi, /onOk:\s*\(\)\s*=>\s*\{[\s\S]{0,300}if \(!canEditRef\.current\)[\s\S]{0,500}deleteEnumRow\(deleteType,/, 'static delete confirmation re-checks the live permission ref at confirmation time')
assert.match(enumUi, /useEffect\(\(\)\s*=>\s*\{[\s\S]{0,400}!canEditEnums[\s\S]{0,400}setEditorType\(null\)/, 'permission revocation closes an active editor and clears its captured type')
assert.match(enumUi, /无权限/, 'revoked mutation attempts expose a clear permission message')
assert.match(enumUi, /const editorTriggerRef\s*=\s*useRef<HTMLElement\s*\|\s*null>/, 'editor focus restoration retains the actual opening element')
assert.doesNotMatch(enumUi, /querySelector<HTMLElement>\(`\[data-testid="enum-edit-\$\{editingRowId/, 'persisted row IDs are never interpolated into querySelector')
assert.match(enumUi, /CSS\.escape[\s\S]{0,300}catch/, 'selector fallback escapes trusted keys and contains selector failures')
assert.match(enumUi, /保存枚举值失败/, 'storage write errors use save-specific copy')
assert.match(enumUi, /hydrationError\s*&&\s*!storageWriteContext/, 'load recovery is not shown for a known save rollback error')
assert.match(enumUi, /data-testid="enum-add-button"/, 'add action exposes its stable test ID')
assert.match(enumUi, /data-testid=\{`enum-type-\$\{type\}`\}/, 'type items expose stable registry-key test IDs')
assert.match(enumUi, /['"]data-testid['"]:\s*`enum-row-\$\{row\.id\}`/, 'table rows expose stable row-ID test IDs')
assert.match(enumUi, /data-testid=\{`enum-edit-\$\{row\.id\}`\}/, 'edit actions expose stable row-ID test IDs')
assert.match(enumUi, /data-testid=\{`enum-delete-\$\{row\.id\}`\}/, 'delete actions expose stable row-ID test IDs')
for (const stableType of ['enum-type-first-sale-tos', 'enum-type-chip-mapping', 'enum-type-project-category-mapping', 'enum-type-tmg-subdomain-mapping']) {
  assert.ok(`enum-type-${expectedEnumTypeKeys.find(key => `enum-type-${key}` === stableType)}` === stableType, `stable type ID is registry backed: ${stableType}`)
}
assert.match(enumUi, /aria-label=\{`编辑[^`]*\$\{[^}]+\}`\}/, 'edit action has a row-specific accessible label')
assert.match(enumUi, /aria-label=\{`删除[^`]*\$\{[^}]+\}`\}/, 'delete action has a row-specific accessible label')
assert.doesNotMatch(enumUi, /添加类型|编辑类型|删除类型/, 'fixed enum types expose no type CRUD')
assert.match(enumUi, /重试/, 'hydration error UI exposes retry')
assert.match(enumUi, /重置本地配置/, 'hydration error UI exposes exact-key reset')
assert.match(enumUi, /const submit = \(\) => \{\s*if \(!tryBeginSubmit\(\)\) return/, 'same-tick repeated submit is rejected before any store write')
assert.match(enumUi, /releaseSubmission\(true\)/, 'successful submit stays guarded through the current event-loop tick')
assert.match(enumUi, /useOverlayInteraction/, 'enum modal reuses shared focus and submission behavior')
assert.match(enumUi, /const closeModal[\s\S]{0,180}clearModal\(\)[\s\S]{0,180}restoreEnumTriggerFocus\(\)/, 'cancel discards the dynamic enum draft and returns focus')
assert.match(storeSource, /hasHydrated/, 'hydration completion lives at the store boundary')
assert.match(storeSource, /hydrationError/, 'hydration failures live at the store boundary')
assert.match(storeSource, /onRehydrateStorage/, 'persist completion callback owns hydration completion')
assert.match(storeSource, /skipHydration:\s*true/, 'browser hydration is started explicitly after mount')
assert.match(storeSource, /export async function ensureEnumHydrated/, 'enum hydration exposes one reusable coordinator')
assert.match(storeSource, /ENUM_STORAGE_KEY/, 'the enum storage key is named for exact reset')
assert.match(hookSource, /ensureEnumHydrated/, 'shared enum option hooks own reusable enum hydration')
assert.match(addProjectSource, /useEnumStore\(state\s*=>\s*state\.rowsByType\)/, 'whole-machine create reads the unified row registry')
assert.match(addProjectSource, /getSingleEnumValues\(rowsByType,\s*['"]first-sale-tos['"]\)/, 'whole-machine create consumes first-sale tOS rows without the legacy adapter')
assert.doesNotMatch(addProjectSource, /useRoadmapStore|tosVersions/, 'whole-machine create no longer uses roadmap metadata as an option source')
assert.match(projectSpaceSource, /useSingleEnumOptions\(['"]first-sale-tos['"]/, 'whole-machine edit consumes first-sale tOS rows')
assert.doesNotMatch(projectSpaceSource, /roadmapTosVersions|roadmapTosOptions/, 'whole-machine edit no longer uses roadmap metadata as an option source')
assert.match(roadmapModuleSource, /useSingleEnumOptions\(['"]roadmap-tos['"]/, 'roadmap consumes roadmap-tOS rows directly')
assert.match(projectStoreSource, /allowedFirstSaleTosValues/, 'project mutations accept an explicit current enum allow-list')
assert.match(projectStoreSource, /rowsByType\[['"]first-sale-tos['"]\]/, 'project validation falls back only to hydrated first-sale tOS rows')
assert.match(appShell, /styles=\{\{\s*root:/, 'user dropdown uses the Ant Design 6 popup styling API')
assert.doesNotMatch(appShell, /overlayStyle=/, 'deprecated dropdown overlayStyle is removed')
assert.match(appShell, /className="[^"]*pms-main-header[^"]*"[\s\S]*className="pms-main-header__row"/, 'main header exposes responsive layout hooks')
assert.match(appShell, /className="pms-main-header__nav-scroll"[\s\S]*className="pms-main-header__menu"/, 'main navigation has its own scroll container')
assert.match(globalStyles, /@media\s*\(max-width:\s*768px\)[\s\S]*\.pms-main-header__row[\s\S]*flex-wrap:\s*nowrap/, 'narrow header must stay on one row')
assert.match(globalStyles, /\.pms-main-header__nav-scroll[\s\S]*overflow-x:\s*auto[\s\S]*touch-action:\s*pan-x/, 'narrow navigation supports horizontal touch scrolling')
assert.match(globalStyles, /\.pms-main-header__menu[\s\S]*min-width:\s*max-content/, 'menu keeps all destinations in the scrollable track')
assert.match(globalStyles, /\.pms-main-header__user[\s\S]*flex:\s*0\s+0\s+40px/, 'narrow user switcher stays compact and fixed-width')
console.log('enum config contract passed')
