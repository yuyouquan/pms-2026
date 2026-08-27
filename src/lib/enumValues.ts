import {
  ENUM_TYPE_KEYS,
  type EnumFieldErrors,
  type EnumFieldKey,
  type EnumRow,
  type EnumRowByType,
  type EnumRowDraft,
  type EnumRowDraftByType,
  type EnumRowValidationResult,
  type EnumTypeDefinition,
  type EnumTypeKey,
  type EnumValuesByType,
  type LegacyTosEnumTypeDefinition,
  type LegacyTosEnumTypeKey,
} from '@/types/enums'

export { ENUM_TYPE_KEYS }

const singleDefinition = (
  key: EnumTypeKey,
  label: string,
  scopeLabel: string,
): EnumTypeDefinition => ({
  key,
  label,
  scopeLabel,
  kind: 'single',
  columns: [{ key: 'value', label }],
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
} as const satisfies Record<EnumTypeKey, EnumTypeDefinition>

const TOS_PREFIXED_TYPES = new Set<EnumTypeKey>(['first-sale-tos', 'roadmap-tos'])
const LEGACY_TOS_ENUM_TYPE_KEYS = ['tos-2-part', 'tos-3-part'] as const satisfies readonly LegacyTosEnumTypeKey[]
const PROJECT_CATEGORIES = new Set([
  '整机产品项目',
  'tOS版本项目',
  '技术项目',
  '能力建设项目',
])

export function isEnumTypeKey(value: unknown): value is EnumTypeKey {
  return typeof value === 'string' && ENUM_TYPE_KEYS.includes(value as EnumTypeKey)
}

/** @deprecated Temporary compatibility guard for consumers migrated in later tasks. */
export function isLegacyTosEnumTypeKey(value: unknown): value is LegacyTosEnumTypeKey {
  return typeof value === 'string'
    && LEGACY_TOS_ENUM_TYPE_KEYS.includes(value as LegacyTosEnumTypeKey)
}

export function normalizeEnumFieldValue(
  type: EnumTypeKey,
  field: EnumFieldKey,
  input: string,
): string {
  const value = input.trim()
  if (field === 'value' && TOS_PREFIXED_TYPES.has(type) && value.startsWith('tOS')) {
    return value.slice(3)
  }
  return value
}

export function formatEnumCellValue(
  type: EnumTypeKey,
  field: EnumFieldKey,
  input: string,
): string {
  const value = input.trim()
  return field === 'value' && TOS_PREFIXED_TYPES.has(type) ? `tOS${value}` : value
}

const normalizedDraft = (type: EnumTypeKey, draft: EnumRowDraft): Record<string, string> => {
  const source = draft as Record<string, string>
  return Object.fromEntries(
    ENUM_DEFINITIONS[type].columns.map(column => [
      column.key,
      normalizeEnumFieldValue(type, column.key, source[column.key] ?? ''),
    ]),
  )
}

const duplicateFieldErrors = (fields: readonly EnumFieldKey[], message: string): EnumFieldErrors =>
  Object.fromEntries(fields.map(field => [field, message])) as EnumFieldErrors

export function validateAndNormalizeEnumRow<K extends EnumTypeKey>(
  type: K,
  draft: EnumRowDraftByType[K],
  existingRows: readonly EnumRowByType<K>[] = [],
  excludeId?: string,
): EnumRowValidationResult {
  const definition = ENUM_DEFINITIONS[type]
  const row = normalizedDraft(type, draft)

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
      && normalizeEnumFieldValue(type, 'value', existing.value) === row.value,
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
      && normalizeEnumFieldValue(type, 'ipmProjectCategory', existing.ipmProjectCategory) === row.ipmProjectCategory,
    )
    if (duplicate) {
      return {
        ok: false,
        reason: 'duplicate',
        fieldErrors: { ipmProjectCategory: 'IPM项目分类不能重复' },
      }
    }
  } else {
    const fields = definition.columns.map(column => column.key)
    const duplicate = comparableRows.some(existing => {
      const existingValues = existing as unknown as Record<string, string>
      return fields.every(field => normalizeEnumFieldValue(type, field, existingValues[field] ?? '') === row[field])
    })
    if (duplicate) {
      return {
        ok: false,
        reason: 'duplicate',
        fieldErrors: duplicateFieldErrors(fields, '该行已存在'),
      }
    }
  }

  return { ok: true, row: row as EnumRowDraft }
}

export function getEnumRowSummary(type: EnumTypeKey, row: EnumRow): string {
  const values = row as unknown as Record<string, string>
  return ENUM_DEFINITIONS[type].columns
    .map(column => formatEnumCellValue(
      type,
      column.key,
      normalizeEnumFieldValue(type, column.key, values[column.key] ?? ''),
    ))
    .join(' / ')
}

/** @deprecated Temporary compatibility registry for consumers migrated in later tasks. */
export const TOS_ENUM_REGISTRY: Record<LegacyTosEnumTypeKey, LegacyTosEnumTypeDefinition> = {
  'tos-2-part': {
    key: 'tos-2-part',
    label: 'tOS版本（2位）',
    initialValues: ['16.0', '17.2'],
  },
  'tos-3-part': {
    key: 'tos-3-part',
    label: 'tOS版本（3位）',
    initialValues: ['16.0.1', '16.0.2', '17.2.0'],
  },
}

/** @deprecated Temporary compatibility keys for consumers migrated in later tasks. */
export const TOS_ENUM_TYPE_KEYS = Object.freeze([
  ...LEGACY_TOS_ENUM_TYPE_KEYS,
])

const FORMAT_BY_TYPE: Record<LegacyTosEnumTypeKey, RegExp> = {
  'tos-2-part': /^\d+\.\d+$/,
  'tos-3-part': /^\d+\.\d+\.\d+$/,
}

/** @deprecated Use normalizeEnumFieldValue with a flat registry key. */
export function normalizeEnumValue(value: string): string {
  const trimmed = value.trim()
  const prefixed = /^tOS(\d+\.\d+(?:\.\d+)?)$/.exec(trimmed)
  return prefixed ? prefixed[1] : trimmed
}

/** @deprecated Use validateAndNormalizeEnumRow with a flat registry key. */
export function validateEnumValue(type: LegacyTosEnumTypeKey, input: string): string {
  const value = normalizeEnumValue(input)
  if (!FORMAT_BY_TYPE[type]?.test(value)) {
    throw new Error(`Invalid ${type} format`)
  }
  return value
}

/** @deprecated Use validateAndNormalizeEnumRow with a flat registry key. */
export function isValidEnumValue(type: LegacyTosEnumTypeKey, input: unknown): input is string {
  if (typeof input !== 'string') return false
  try {
    validateEnumValue(type, input)
    return true
  } catch {
    return false
  }
}

export function sortEnumValues(input: readonly string[]): string[] {
  const compareNumericSegment = (left: string, right: string) => {
    const normalizedLeft = left.replace(/^0+(?=\d)/, '')
    const normalizedRight = right.replace(/^0+(?=\d)/, '')
    if (normalizedLeft.length !== normalizedRight.length) {
      return normalizedLeft.length - normalizedRight.length
    }
    if (normalizedLeft < normalizedRight) return -1
    if (normalizedLeft > normalizedRight) return 1
    return 0
  }

  return input
    .map((value, index) => ({ value, index, segments: value.split('.') }))
    .sort((left, right) => {
      const segmentCount = Math.max(left.segments.length, right.segments.length)
      for (let index = 0; index < segmentCount; index += 1) {
        if (left.segments[index] === undefined) return -1
        if (right.segments[index] === undefined) return 1
        const segmentComparison = compareNumericSegment(left.segments[index], right.segments[index])
        if (segmentComparison !== 0) return segmentComparison
      }
      return left.index - right.index
    })
    .map(item => item.value)
}

export function createInitialEnumValues(): EnumValuesByType {
  return {
    'tos-2-part': [...TOS_ENUM_REGISTRY['tos-2-part'].initialValues],
    'tos-3-part': [...TOS_ENUM_REGISTRY['tos-3-part'].initialValues],
  }
}
