import {
  ENUM_TYPE_KEYS,
  type EnumFieldErrors,
  type EnumFieldKey,
  type EnumRowByType,
  type EnumRowDraftByType,
  type EnumFieldKeyByType,
  type EnumRowValidationResult,
  type EnumRowsByType,
  type EnumTypeDefinition,
  type EnumTypeKey,
} from '@/types/enums'

export { ENUM_TYPE_KEYS }

type SingleEnumTypeKey = Exclude<EnumTypeKey, 'tmg-subdomain-mapping' | 'chip-mapping' | 'project-category-mapping' | 'package-mode-mapping'>

const singleDefinition = <K extends SingleEnumTypeKey, L extends string, S extends string>(
  key: K,
  label: L,
  scopeLabel: S,
) => ({
  key,
  label,
  scopeLabel,
  kind: 'single' as const,
  columns: [{ key: 'value' as const, label }] as const,
})

export const ENUM_DEFINITIONS = {
  'first-sale-tos': singleDefinition('first-sale-tos', '首销tOS版本', '整机产品项目 / 技术项目'),
  'roadmap-tos': singleDefinition('roadmap-tos', 'tOS版本-路标', 'tOS路标'),
  'machine-project-status': singleDefinition('machine-project-status', '项目状态-整机产品项目', '整机产品项目'),
  'technical-project-status': singleDefinition('technical-project-status', '项目状态-技术项目', '技术项目'),
  'tos-capability-project-status': singleDefinition('tos-capability-project-status', '项目状态-tOS版本项目/能力建设项目', 'tOS版本项目 / 能力建设项目'),
  'machine-health-status': singleDefinition('machine-health-status', '健康状态', '整机产品项目'),
  'version-type': singleDefinition('version-type', '版本类型', '整机产品项目 / tOS版本项目'),
  'software-project-level': singleDefinition('software-project-level', '软件项目等级', '整机产品项目'),
  'product-series': singleDefinition('product-series', '产品系列', '整机产品项目'),
  'research-mode': singleDefinition('research-mode', '研发模式', '整机产品项目'),
  'machine-development-mode': singleDefinition('machine-development-mode', '开发模式-整机产品项目', '整机产品项目'),
  'technical-development-mode': singleDefinition('technical-development-mode', '开发模式-技术项目', '技术项目'),
  'upgrade-strategy': singleDefinition('upgrade-strategy', '升级策略', '整机产品项目'),
  'system-type': singleDefinition('system-type', '系统类型', '整机产品项目'),
  'kernel-version': singleDefinition('kernel-version', 'Kernel版本', '整机产品项目'),
  'chip-mapping': {
    key: 'chip-mapping',
    label: '芯片编码/芯片型号/芯片平台',
    scopeLabel: '整机产品项目',
    kind: 'chip-map',
    columns: [
      { key: 'chipCode', label: '芯片编码' },
      { key: 'chipModel', label: '芯片型号' },
      { key: 'chipPlatform', label: '芯片平台' },
    ],
  },
  'memory-size': singleDefinition('memory-size', '内存大小', '整机产品项目'),
  'project-category-mapping': {
    key: 'project-category-mapping',
    label: '项目分类',
    scopeLabel: '整机产品项目 / tOS版本项目 / 技术项目 / 能力建设项目',
    kind: 'project-category-map',
    columns: [
      { key: 'ipmProjectCategory', label: 'IPM项目分类' },
      { key: 'pmsProjectCategory', label: 'PMS项目分类' },
      { key: 'pmsSecondaryCategory', label: 'PMS二级项目分类' },
    ],
  },
  'build-option': singleDefinition('build-option', '编译选项', '整机产品项目'),
  'build-market': singleDefinition('build-market', '编译市场', '整机产品项目'),
  'tmg-subdomain-mapping': {
    key: 'tmg-subdomain-mapping',
    label: 'TMG及技术领域&子领域',
    scopeLabel: '技术项目',
    kind: 'tmg-map',
    columns: [
      { key: 'domain', label: 'TMG及技术领域' },
      { key: 'subdomain', label: '子领域' },
    ],
  },
  'core-value': singleDefinition('core-value', '核心价值', '技术项目'),
  'android-version': singleDefinition('android-version', '安卓版本', '整机产品项目'),
  'package-mode-mapping': {
    key: 'package-mode-mapping',
    label: '组包方式',
    scopeLabel: '整机产品项目',
    kind: 'package-map',
    columns: [
      { key: 'androidVersion', label: '安卓版本' },
      { key: 'chipModel', label: '芯片型号' },
      { key: 'packageMode', label: '组包方式' },
    ],
  },
} as const satisfies Record<EnumTypeKey, EnumTypeDefinition>

const TOS_PREFIXED_TYPES = new Set<EnumTypeKey>(['first-sale-tos', 'roadmap-tos'])
const PROJECT_CATEGORIES = new Set([
  '整机产品项目',
  'tOS版本项目',
  '技术项目',
  '能力建设项目',
])

export function isEnumTypeKey(value: unknown): value is EnumTypeKey {
  return typeof value === 'string' && ENUM_TYPE_KEYS.includes(value as EnumTypeKey)
}

/**
 * Persist the tOS body while treating only the exact display prefix `tOS` as
 * decoration. Bodies such as `TOSbeta` and `tosbeta` are business values and
 * must not be rewritten.
 */
export function normalizeTosValue(input: unknown): string {
  if (typeof input !== 'string') return ''
  const value = input.trim().replace(/（已停用）$/, '').trim()
  const legacyId = /^tos-(\d+)-(\d+)(?:-(\d+))?$/i.exec(value)
  if (legacyId) return legacyId.slice(1).filter(Boolean).join('.')
  return value.startsWith('tOS') ? value.slice(3).trim() : value
}

export function normalizeEnumFieldValue<K extends EnumTypeKey>(
  type: K,
  field: EnumFieldKeyByType<K>,
  input: string,
): string {
  const value = input.trim()
  if (field === 'value' && TOS_PREFIXED_TYPES.has(type)) return normalizeTosValue(value)
  return value
}

export function formatEnumCellValue<K extends EnumTypeKey>(
  type: K,
  field: EnumFieldKeyByType<K>,
  input: string,
): string {
  const value = normalizeEnumFieldValue(type, field, input)
  return field === 'value' && TOS_PREFIXED_TYPES.has(type) ? `tOS${value}` : value
}

const normalizedDraft = <K extends EnumTypeKey>(
  type: K,
  draft: EnumRowDraftByType[K],
): EnumRowDraftByType[K] => {
  const source = draft as Record<string, string>
  return Object.fromEntries(
    ENUM_DEFINITIONS[type].columns.map(column => [
      column.key,
      normalizeEnumFieldValue(type, column.key as EnumFieldKeyByType<K>, source[column.key] ?? ''),
    ]),
  ) as EnumRowDraftByType[K]
}

const duplicateFieldErrors = (fields: readonly EnumFieldKey[], message: string): EnumFieldErrors =>
  Object.fromEntries(fields.map(field => [field, message])) as EnumFieldErrors

export function validateAndNormalizeEnumRow<K extends EnumTypeKey>(
  type: K,
  draft: EnumRowDraftByType[K],
  existingRows: readonly EnumRowByType<K>[] = [],
  excludeId?: string,
): EnumRowValidationResult<K> {
  const definition = ENUM_DEFINITIONS[type]
  const row = normalizedDraft(type, draft) as Record<string, string>

  if (definition.kind === 'project-category-map' && row.pmsProjectCategory !== '整机产品项目') {
    row.pmsSecondaryCategory = ''
  }

  const fieldErrors: EnumFieldErrors = {}
  for (const { key } of definition.columns) {
    if (key === 'pmsSecondaryCategory') continue
    if (!row[key]) fieldErrors[key] = '不能为空'
  }

  if (definition.kind === 'project-category-map') {
    if (row.pmsProjectCategory && !PROJECT_CATEGORIES.has(row.pmsProjectCategory)) {
      fieldErrors.pmsProjectCategory = '请选择有效的PMS项目分类'
    }
    if (row.pmsProjectCategory === '整机产品项目' && !row.pmsSecondaryCategory) {
      fieldErrors.pmsSecondaryCategory = '不能为空'
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, reason: 'invalid', fieldErrors }
  }

  const comparableRows = existingRows.filter(existing => existing.id !== excludeId)
  if (definition.kind === 'single') {
    const duplicate = comparableRows.some(existing =>
      'value' in existing
      && normalizeEnumFieldValue(type, 'value' as EnumFieldKeyByType<K>, existing.value) === row.value,
    )
    if (duplicate) {
      return {
        ok: false,
        reason: 'duplicate',
        fieldErrors: { value: '枚举值不能重复' },
      }
    }
  } else if (definition.kind === 'project-category-map') {
    const duplicate = comparableRows.some(existing =>
      'ipmProjectCategory' in existing
      && normalizeEnumFieldValue(type, 'ipmProjectCategory' as EnumFieldKeyByType<K>, existing.ipmProjectCategory) === row.ipmProjectCategory,
    )
    if (duplicate) {
      return {
        ok: false,
        reason: 'duplicate',
        fieldErrors: { ipmProjectCategory: 'IPM项目分类不能重复' },
      }
    }
  } else if (definition.kind === 'package-map') {
    const duplicate = comparableRows.some(existing => (
      'androidVersion' in existing
      && 'chipModel' in existing
      && normalizeEnumFieldValue(type, 'androidVersion' as EnumFieldKeyByType<K>, existing.androidVersion) === row.androidVersion
      && normalizeEnumFieldValue(type, 'chipModel' as EnumFieldKeyByType<K>, existing.chipModel) === row.chipModel
    ))
    if (duplicate) {
      return {
        ok: false,
        reason: 'duplicate',
        fieldErrors: {
          androidVersion: '该组合已存在',
          chipModel: '该组合已存在',
        },
      }
    }
  } else {
    const fields = definition.columns.map(column => column.key)
    const duplicate = comparableRows.some(existing => {
      const existingValues = existing as unknown as Record<string, string>
      return fields.every(field => normalizeEnumFieldValue(type, field as EnumFieldKeyByType<K>, existingValues[field] ?? '') === row[field])
    })
    if (duplicate) {
      return {
        ok: false,
        reason: 'duplicate',
        fieldErrors: duplicateFieldErrors(fields, '该行已存在'),
      }
    }
  }

  return { ok: true, row: row as EnumRowDraftByType[K] }
}

export function getEnumRowSummary<K extends EnumTypeKey>(type: K, row: EnumRowByType<K>): string {
  const values = row as unknown as Record<string, string>
  return ENUM_DEFINITIONS[type].columns
    .map(column => formatEnumCellValue(
      type,
      column.key as EnumFieldKeyByType<K>,
      values[column.key] ?? '',
    ))
    .join(' / ')
}

const seededRows = <K extends EnumTypeKey>(
  type: K,
  drafts: readonly EnumRowDraftByType[K][],
): EnumRowByType<K>[] => drafts.map((draft, index) => ({
  id: `seed-${type}-${index + 1}`,
  ...draft,
}) as EnumRowByType<K>)

const singleSeedRows = <K extends SingleEnumTypeKey>(type: K, enumValues: readonly string[]) =>
  seededRows(type, enumValues.map(value => ({ value })) as EnumRowDraftByType[K][])

export function createInitialEnumRows(): EnumRowsByType {
  return {
    'first-sale-tos': singleSeedRows('first-sale-tos', ['16.0.1', '16.0.2', '17.2.0', '16.0', '17.2']),
    'roadmap-tos': singleSeedRows('roadmap-tos', ['16.0', '17.2']),
    'machine-project-status': singleSeedRows('machine-project-status', ['待立项', '在研', '上市', 'EOS', '转维', '已取消', '已暂停']),
    'technical-project-status': singleSeedRows('technical-project-status', ['进行中', '已完成', '暂停', '已取消']),
    'tos-capability-project-status': singleSeedRows('tos-capability-project-status', ['在研', '已完成']),
    'machine-health-status': singleSeedRows('machine-health-status', ['正常', '关注', '风险']),
    'version-type': singleSeedRows('version-type', ['Full', 'Slim', 'PAD', 'GO']),
    'software-project-level': singleSeedRows('software-project-level', ['S', 'A', 'B', 'C', 'D']),
    'product-series': [],
    'research-mode': [],
    'machine-development-mode': singleSeedRows('machine-development-mode', ['自研', '联合开发', 'ODC', '外研', 'ITD-ODC', 'ODM', '纯外研', 'JDM']),
    'technical-development-mode': singleSeedRows('technical-development-mode', ['自研', '谷歌合作', 'SoC合作', '高校合作']),
    'upgrade-strategy': singleSeedRows('upgrade-strategy', ['不维护', 'EWP维护', '维1', '维2', 'EWP维护+tOS升级', '维1+tOS升级', '维2+tOS升级', '升1维2', '升2维3', '升3维5']),
    'system-type': singleSeedRows('system-type', ['32bit', '64bit', '64only']),
    'kernel-version': singleSeedRows('kernel-version', ['5.10', '5.15', '6.1', '6.6']),
    'chip-mapping': [],
    'memory-size': singleSeedRows('memory-size', ['2GB', '3GB', '4GB', '6GB', '8GB', '12GB', '16GB']),
    'project-category-mapping': seededRows('project-category-mapping', [
      { ipmProjectCategory: '整机产品-基线IPD', pmsProjectCategory: '整机产品项目', pmsSecondaryCategory: '整机-手机' },
      { ipmProjectCategory: '整机产品-模块化IPD', pmsProjectCategory: '整机产品项目', pmsSecondaryCategory: '整机-手机' },
      { ipmProjectCategory: '整机产品-非IPD', pmsProjectCategory: '整机产品项目', pmsSecondaryCategory: '整机-手机' },
      { ipmProjectCategory: '手机整机产品-大版本升级', pmsProjectCategory: '整机产品项目', pmsSecondaryCategory: '整机-手机' },
      { ipmProjectCategory: '其他-平板--整机产品项目', pmsProjectCategory: '整机产品项目', pmsSecondaryCategory: '整机-平板' },
      { ipmProjectCategory: '其他-笔电/移动互联及其他--整机产品项目', pmsProjectCategory: '整机产品项目', pmsSecondaryCategory: '整机-笔电' },
      { ipmProjectCategory: '其他-笔电', pmsProjectCategory: '整机产品项目', pmsSecondaryCategory: '整机-笔电' },
      { ipmProjectCategory: '移动互联及其他--整机产品项目', pmsProjectCategory: '整机产品项目', pmsSecondaryCategory: '整机-笔电' },
      { ipmProjectCategory: '其他-功能机', pmsProjectCategory: '整机产品项目', pmsSecondaryCategory: '整机-功能机' },
      { ipmProjectCategory: '其他-AIOT', pmsProjectCategory: '整机产品项目', pmsSecondaryCategory: '整机-AIOT扩品类' },
      { ipmProjectCategory: '基线项目', pmsProjectCategory: '整机产品项目', pmsSecondaryCategory: '整机-基线项目' },
      { ipmProjectCategory: 'N+1项目', pmsProjectCategory: '整机产品项目', pmsSecondaryCategory: '整机-N+1项目' },
      { ipmProjectCategory: '预研类项目', pmsProjectCategory: '整机产品项目', pmsSecondaryCategory: '整机-预研项目' },
      { ipmProjectCategory: '软件产品项目', pmsProjectCategory: 'tOS版本项目', pmsSecondaryCategory: '' },
      { ipmProjectCategory: '研发级-基础研究-重点项目', pmsProjectCategory: '技术项目', pmsSecondaryCategory: '' },
      { ipmProjectCategory: '研发级-基础研究-非重点项目', pmsProjectCategory: '技术项目', pmsSecondaryCategory: '' },
      { ipmProjectCategory: '部门级-基础研究', pmsProjectCategory: '技术项目', pmsSecondaryCategory: '' },
      { ipmProjectCategory: '研发级-技术研发-重点项目', pmsProjectCategory: '技术项目', pmsSecondaryCategory: '' },
      { ipmProjectCategory: '研发级-技术研发-非重点项目', pmsProjectCategory: '技术项目', pmsSecondaryCategory: '' },
      { ipmProjectCategory: '部门级-技术研发', pmsProjectCategory: '技术项目', pmsSecondaryCategory: '' },
      { ipmProjectCategory: '技术项目前置工作', pmsProjectCategory: '技术项目', pmsSecondaryCategory: '' },
      { ipmProjectCategory: '部门级能力建设', pmsProjectCategory: '能力建设项目', pmsSecondaryCategory: '' },
      { ipmProjectCategory: '公司级/研发级能力建设', pmsProjectCategory: '能力建设项目', pmsSecondaryCategory: '' },
      { ipmProjectCategory: '公司级能力建设', pmsProjectCategory: '能力建设项目', pmsSecondaryCategory: '' },
      { ipmProjectCategory: '研发级能力建设', pmsProjectCategory: '能力建设项目', pmsSecondaryCategory: '' },
    ]),
    'build-option': singleSeedRows('build-option', ['ko2_sl303', 'ko2', 'a681l_sm386', 'lj8k_h781', 'lj8_h781', 'lj7_h782', 'x1103b']),
    'build-market': singleSeedRows('build-market', ['op', 'tr']),
    'tmg-subdomain-mapping': seededRows('tmg-subdomain-mapping', [
      { domain: '基础架构TMG', subdomain: '无' },
      { domain: '性能TMG', subdomain: '无' },
      { domain: 'DFX TMG', subdomain: '无' },
      { domain: 'UX TMG', subdomain: '无' },
      { domain: '系统应用', subdomain: 'AIOS' },
      { domain: '系统应用', subdomain: '应用' },
      { domain: '系统应用', subdomain: '图形' },
      { domain: '系统应用', subdomain: '内核' },
      { domain: '系统应用', subdomain: '多媒体' },
      { domain: '底软通信', subdomain: '器件' },
      { domain: '底软通信', subdomain: '蜂窝' },
      { domain: '底软通信', subdomain: '短距' },
      { domain: '底软通信', subdomain: '功耗' },
      { domain: '集成维护', subdomain: '三方体验' },
      { domain: '集成维护', subdomain: 'GMS' },
      { domain: '其他', subdomain: '安全' },
      { domain: '其他', subdomain: 'AIOT' },
    ]),
    'core-value': singleSeedRows('core-value', ['追赶', '人无我有', '人有我有']),
    'android-version': [],
    'package-mode-mapping': [],
  }
}
