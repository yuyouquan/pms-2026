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
assert.equal(values.formatEnumCellValue('first-sale-tos', 'value', ' tOS18.0 '), 'tOS18.0', 'display normalizes an existing tOS prefix exactly once')
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
  'machine-project-status': ['待立项', '在研', '上市', '转维', 'EOS', '暂停', '已取消', '规划中'],
  'technical-project-status': ['待立项', '在研', '上市', 'EOS', '暂停', '已取消', '规划中', '已迁移'],
  'tos-capability-project-status': ['在研', '已完成', '暂停', '已取消'],
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

const compatibilityFixture = enumStore.createEnumStore({ rowsByType: values.createInitialEnumRows() }, () => 'legacy-user-id')
assert.equal(compatibilityFixture.getState().selectedType, 'first-sale-tos', 'flat first-sale tOS is the default selected type')
compatibilityFixture.setSelectedType('core-value')
assert.equal(compatibilityFixture.getState().selectedType, 'core-value', 'selected type changes without entering persisted state')
assert.deepEqual(compatibilityFixture.getState().valuesByType, {
  'tos-2-part': ['16.0', '17.2'],
  'tos-3-part': ['16.0.1', '16.0.2', '17.2.0', '16.0', '17.2'],
}, 'deprecated valuesByType derives from flat row state')
assert.deepEqual(compatibilityFixture.addEnumValue('tos-2-part', '15.0'), { ok: true }, 'legacy add action remains operational')
assert.deepEqual(compatibilityFixture.getValues('tos-2-part'), ['15.0', '16.0', '17.2'], 'legacy value reads remain derived and semantically ordered')
assert.deepEqual(compatibilityFixture.addEnumValue('tos-2-part', '15.0'), { ok: false, reason: 'duplicate' }, 'legacy add still rejects duplicates')
assert.deepEqual(compatibilityFixture.addEnumValue('tos-2-part', '15.0.1'), { ok: false, reason: 'invalid' }, 'legacy add still enforces its version format')
assert.deepEqual(rowValues(compatibilityFixture.getState().rowsByType, 'roadmap-tos'), ['15.0', '16.0', '17.2'], 'legacy two-part writes update roadmap rows rather than a second source')
assert.deepEqual(compatibilityFixture.updateEnumValue('tos-2-part', '15.0', '18.0'), { ok: true }, 'legacy update action remains operational')
assert.deepEqual(compatibilityFixture.updateEnumValue('tos-2-part', '18.0', '18.0'), { ok: true }, 'legacy unchanged update excludes itself from duplicate detection')
assert.deepEqual(compatibilityFixture.updateEnumValue('tos-2-part', '18.0', '17.2'), { ok: false, reason: 'duplicate' }, 'legacy update rejects another configured value')
assert.deepEqual(compatibilityFixture.updateEnumValue('tos-2-part', 'missing', '19.0'), { ok: false, reason: 'missing' }, 'legacy update reports a missing source value')
assert.deepEqual(compatibilityFixture.deleteEnumValue('tos-2-part', '18.0'), { ok: true }, 'legacy delete action remains operational')
assert.deepEqual(compatibilityFixture.deleteEnumValue('tos-2-part', '18.0'), { ok: false, reason: 'missing' }, 'legacy delete reports an already missing value')
assert.deepEqual(rowValues(compatibilityFixture.getState().rowsByType, 'roadmap-tos'), ['16.0', '17.2'], 'legacy delete is reflected in flat rows')

const partialized = enumStore.partializeEnumState(compatibilityFixture.getState())
assert.deepEqual(Object.keys(partialized), ['rowsByType'], 'only rowsByType is persisted')
assert.notEqual(partialized.rowsByType, compatibilityFixture.getState().rowsByType, 'persisted rows are deep-cloned')
partialized.rowsByType['roadmap-tos'][0].value = 'mutated-copy'
assert.equal(compatibilityFixture.getRows('roadmap-tos')[0].value, '16.0', 'mutating a persistence snapshot cannot mutate store memory')
const assertOfficialLegacyProjection = message => {
  const state = enumStore.useEnumStore.getState()
  assert.deepEqual(state.valuesByType, {
    'tos-2-part': rowValues(state.rowsByType, 'roadmap-tos'),
    'tos-3-part': rowValues(state.rowsByType, 'first-sale-tos'),
  }, message)
}
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
  assertOfficialLegacyProjection('legacy bridge equals the flat-row projection after hydration')

  assert.deepEqual(enumStore.useEnumStore.getState().addEnumRow('roadmap-tos', { value: 'bridge-added' }), { ok: true }, 'official row add succeeds before bridge projection check')
  assertOfficialLegacyProjection('legacy bridge equals the flat-row projection after add')
  const bridgeRow = enumStore.useEnumStore.getState().rowsByType['roadmap-tos'].find(row => row.value === 'bridge-added')
  assert.ok(bridgeRow, 'official add exposes the created row ID')
  assert.deepEqual(enumStore.useEnumStore.getState().updateEnumRow('roadmap-tos', bridgeRow.id, { value: 'bridge-updated' }), { ok: true }, 'official row update succeeds before bridge projection check')
  assertOfficialLegacyProjection('legacy bridge equals the flat-row projection after update')
  assert.deepEqual(enumStore.useEnumStore.getState().deleteEnumRow('roadmap-tos', bridgeRow.id), { ok: true }, 'official row delete succeeds before bridge projection check')
  assertOfficialLegacyProjection('legacy bridge equals the flat-row projection after delete')

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
  assertOfficialLegacyProjection('legacy bridge equals the flat-row projection after reset')

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
  assertOfficialLegacyProjection('legacy bridge equals the flat-row projection after same-turn hydrate/reset')

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
  assertOfficialLegacyProjection('legacy bridge equals the flat-row projection after delayed hydrate/reset')
} finally {
  enumStore.useEnumStore.persist.setOptions({ storage: officialPersistStorage })
  if (previousWindow === undefined) delete globalThis.window
  else globalThis.window = previousWindow
}
console.log('[store-contract] passed')

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
