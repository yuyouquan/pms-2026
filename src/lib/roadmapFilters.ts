import {
  applyFilterConditions,
  getFilterOperatorsForKind,
  isValuelessFilterOperator,
  type FilterFieldDefinition,
} from '@/lib/filterConditions'
import { compareSemanticTos } from '@/lib/roadmapSorting'
import {
  normalizeColumnSettings,
  type SortableColumnDefinition,
  type SortableColumnSettingsValue,
} from '@/lib/columnSettings'
import {
  formatRoadmapTosValue,
  normalizeRoadmapTosReference,
  PRODUCT_LINES_BY_BRAND,
} from '@/lib/roadmapValidation'
import {
  ROADMAP_COLUMNS,
  type RoadmapBrand,
  type RoadmapColumnKey,
  type RoadmapFilterCondition,
  type RoadmapFilterOperator,
  type RoadmapProductType,
  type RoadmapProjectRow,
  type TosVersionConfig,
} from '@/types/roadmap'

export const ROADMAP_FILTER_DEBOUNCE_MS = 150

export const DEFAULT_ROADMAP_TABLE_VISIBLE_COLUMNS = ROADMAP_COLUMNS
  .filter(column => column.defaultVisible)
  .map(column => column.key)

export const ROADMAP_EVOLUTION_LOCKED_COLUMNS: RoadmapColumnKey[] = [
  'marketName',
  'displayName',
]

export const DEFAULT_ROADMAP_EVOLUTION_VISIBLE_COLUMNS: RoadmapColumnKey[] = ensureRoadmapLockedColumns([
  'marketName',
  'platform',
  'versionType',
  'str5Date',
  'launchDate',
], ROADMAP_EVOLUTION_LOCKED_COLUMNS)

export const DEFAULT_ROADMAP_VISIBLE_COLUMNS = DEFAULT_ROADMAP_TABLE_VISIBLE_COLUMNS
export const DEFAULT_ROADMAP_COLUMN_ORDER = ROADMAP_COLUMNS.map(column => column.key)
export const DEFAULT_ROADMAP_EVOLUTION_COLUMN_ORDER: RoadmapColumnKey[] = [
  ...DEFAULT_ROADMAP_COLUMN_ORDER.slice(0, 10),
  'developMode',
  ...DEFAULT_ROADMAP_COLUMN_ORDER.slice(10).filter(key => key !== 'developMode'),
]

export function getRoadmapSortableColumnDefinitions(
  viewMode: 'table' | 'evolution',
): SortableColumnDefinition<RoadmapColumnKey>[] {
  const defaultVisible = new Set(
    viewMode === 'table'
      ? DEFAULT_ROADMAP_TABLE_VISIBLE_COLUMNS
      : DEFAULT_ROADMAP_EVOLUTION_VISIBLE_COLUMNS,
  )
  const nonHideable = new Set(
    viewMode === 'table'
      ? ['firstSaleTosVersionId'] satisfies RoadmapColumnKey[]
      : ROADMAP_EVOLUTION_LOCKED_COLUMNS,
  )

  return ROADMAP_COLUMNS.map(column => ({
    key: column.key,
    title: column.label,
    accessibilityLabel: column.label,
    defaultVisible: defaultVisible.has(column.key),
    hideable: !nonHideable.has(column.key),
    fixed: viewMode === 'table' && column.key === 'firstSaleTosVersionId' ? 'left' : undefined,
    disabledReason: nonHideable.has(column.key) ? '该字段为当前视图必选项' : undefined,
  }))
}

export function normalizeRoadmapColumnSettings(
  viewMode: 'table' | 'evolution',
  value?: Partial<SortableColumnSettingsValue<RoadmapColumnKey>> | readonly RoadmapColumnKey[] | null,
): SortableColumnSettingsValue<RoadmapColumnKey> {
  return normalizeColumnSettings(getRoadmapSortableColumnDefinitions(viewMode), value)
}

export function ensureRoadmapLockedColumns(
  columns: readonly RoadmapColumnKey[],
  lockedColumns: readonly RoadmapColumnKey[] = [],
): RoadmapColumnKey[] {
  const requested = new Set([...columns, ...lockedColumns])
  return ROADMAP_COLUMNS.flatMap(column => requested.has(column.key) ? [column.key] : [])
}

export type RoadmapQuickFilterField = 'brand' | 'productType'
export type RoadmapQuickFilterValue = 'all' | 'custom' | RoadmapBrand | RoadmapProductType
const ROADMAP_QUICK_BRANDS = new Set<RoadmapBrand>(['TECNO', 'Infinix', 'itel'])

export function getRoadmapFilterOperators(
  field: string,
  kind: FilterFieldDefinition['kind'],
) {
  const operators = getFilterOperatorsForKind(kind)
  return field === 'firstSaleTosVersionId'
    ? operators.filter(operator => operator.value === 'equals')
    : operators
}

export function getRoadmapQuickFilterValue(
  filters: readonly RoadmapFilterCondition[],
  field: 'brand',
): 'all' | 'custom' | RoadmapBrand
export function getRoadmapQuickFilterValue(
  filters: readonly RoadmapFilterCondition[],
  field: 'productType',
): 'all' | 'custom' | RoadmapProductType
export function getRoadmapQuickFilterValue(
  filters: readonly RoadmapFilterCondition[],
  field: RoadmapQuickFilterField,
): RoadmapQuickFilterValue {
  const condition = filters.find(candidate => candidate.field === field)
  if (!condition) return 'all'
  if (condition.operator !== 'equals' || !Array.isArray(condition.value) || condition.value.length !== 1) return 'custom'
  const [value] = condition.value
  if (field === 'brand' && !ROADMAP_QUICK_BRANDS.has(value as RoadmapBrand)) return 'custom'
  return value as RoadmapQuickFilterValue
}

export function setRoadmapQuickFilter(
  filters: readonly RoadmapFilterCondition[],
  field: RoadmapQuickFilterField,
  value: Exclude<RoadmapQuickFilterValue, 'custom'>,
): RoadmapFilterCondition[] {
  if (value === 'all') return filters.filter(condition => condition.field !== field)
  const existing = filters.find(condition => condition.field === field)
  const replacement: RoadmapFilterCondition = {
    id: existing?.id ?? `roadmap-quick-${field}`,
    field,
    operator: 'equals',
    value: [value],
  }
  if (!existing) return [...filters, replacement]
  return filters.map(condition => condition.field === field ? replacement : condition)
}

export function setRoadmapTosVersionFilter(
  filters: readonly RoadmapFilterCondition[],
  versionId: string | null,
): RoadmapFilterCondition[] {
  if (!versionId) return filters.filter(condition => condition.field !== 'firstSaleTosVersionId')
  const existing = filters.find(condition => condition.field === 'firstSaleTosVersionId')
  const replacement: RoadmapFilterCondition = {
    id: existing?.id ?? 'roadmap-quick-firstSaleTosVersionId',
    field: 'firstSaleTosVersionId',
    operator: 'equals',
    value: [versionId],
  }
  if (!existing) return [...filters, replacement]
  return filters.map(condition => condition.field === 'firstSaleTosVersionId' ? replacement : condition)
}

const option = (value: string) => ({ label: value, value })

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function claimFilterId(preferred: unknown, index: number, usedIds: Set<string>): string {
  const base = typeof preferred === 'string' && preferred.trim()
    ? preferred.trim()
    : `roadmap-filter-migrated-${index + 1}`
  let candidate = base
  let suffix = 2
  while (usedIds.has(candidate)) {
    candidate = `${base}-${suffix}`
    suffix += 1
  }
  usedIds.add(candidate)
  return candidate
}

function isStrictCalendarDate(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 1 || month < 1 || month > 12 || day < 1) return false
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return day <= daysInMonth[month - 1]
}

export function buildRoadmapFilterFieldDefinitions(
  versions: readonly TosVersionConfig[],
  savedTosVersionValues: readonly string[] = [],
  configurableOptions: Readonly<{
    startRam?: readonly { label: string; value: string; disabled?: boolean }[]
    versionType?: readonly { label: string; value: string; disabled?: boolean }[]
    developMode?: readonly { label: string; value: string; disabled?: boolean }[]
  }> = {},
): FilterFieldDefinition[] {
  const productLines = [...new Set(Object.values(PRODUCT_LINES_BY_BRAND).flat())]
  const selectableVersions = [...versions]
    .filter(version => version.selectable !== false)
    .sort((left, right) => compareSemanticTos(right, left))
  const selectableIds = new Set(selectableVersions.map(version => version.id))
  const savedOrphanOptions = [...new Set(savedTosVersionValues
    .map(value => normalizeRoadmapTosReference(value, versions))
    .filter(Boolean))]
    .filter(value => !selectableIds.has(value))
    .sort((left, right) => compareSemanticTos(right, left))
    .map(value => ({
      label: `${formatRoadmapTosValue(value)}（已停用）`,
      value,
      disabled: true,
    }))
  return [
    {
      key: 'firstSaleTosVersionId',
      label: 'tOS版本',
      kind: 'enum',
      options: [
        ...savedOrphanOptions,
        ...selectableVersions.map(version => ({ label: version.name, value: version.id })),
      ],
    },
    { key: 'brand', label: '品牌', kind: 'enum', options: ['TECNO', 'Infinix', 'itel', '待定', '其他品牌'].map(option) },
    { key: 'productLine', label: '产品线', kind: 'enum', options: productLines.map(option) },
    { key: 'productSeries', label: '产品系列', kind: 'text' },
    { key: 'marketName', label: '市场名', kind: 'text' },
    { key: 'displayName', label: '项目名', kind: 'text' },
    { key: 'productType', label: '产品类型', kind: 'enum', options: ['新品', '老品'].map(option) },
    { key: 'platform', label: '平台', kind: 'text' },
    { key: 'startRam', label: '起步RAM', kind: 'enum', options: [...(configurableOptions.startRam ?? [])] },
    { key: 'versionType', label: '版本类型', kind: 'enum', options: [...(configurableOptions.versionType ?? [])] },
    { key: 'str5Date', label: 'STR5时间', kind: 'date' },
    { key: 'launchDate', label: '上市时间', kind: 'date' },
    { key: 'developMode', label: '开发模式', kind: 'enum', options: [...(configurableOptions.developMode ?? [])] },
    { key: 'remark', label: '备注', kind: 'text' },
  ]
}

function normalizeEnumFilterValue(
  field: string,
  rawValue: string,
  definition: FilterFieldDefinition,
  versions: readonly TosVersionConfig[],
): string | null {
  if (field === 'firstSaleTosVersionId') {
    const normalized = normalizeRoadmapTosReference(rawValue, versions)
    return normalized || null
  }
  if (field === 'startRam' || field === 'versionType' || field === 'developMode') {
    return rawValue.trim() || null
  }
  return definition.options?.find(candidate => candidate.value === rawValue)?.value ?? null
}

export function sanitizeRoadmapFilterConditions(
  value: unknown,
  versions: readonly TosVersionConfig[],
): RoadmapFilterCondition[] {
  if (!Array.isArray(value)) return []
  const definitions = buildRoadmapFilterFieldDefinitions(versions)
  const definitionsByKey = new Map(definitions.map(definition => [definition.key, definition]))
  const usedFields = new Set<string>()
  const usedIds = new Set<string>()
  const sanitized: RoadmapFilterCondition[] = []

  value.forEach((candidate, index) => {
    if (!isRecord(candidate) || typeof candidate.field !== 'string' || usedFields.has(candidate.field)) return
    const definition = definitionsByKey.get(candidate.field)
    if (!definition || typeof candidate.operator !== 'string') return
    const operator = candidate.operator as RoadmapFilterOperator
    if (!getRoadmapFilterOperators(candidate.field, definition.kind)
      .some(optionDefinition => optionDefinition.value === operator)) return

    let normalizedValue: string | string[] = definition.kind === 'enum' ? [] : ''
    if (!isValuelessFilterOperator(operator)) {
      if (definition.kind === 'enum') {
        const rawValues = Array.isArray(candidate.value) ? candidate.value : [candidate.value]
        const enumValues = rawValues.flatMap(rawValue => {
          if (typeof rawValue !== 'string' || !rawValue.trim()) return []
          const enumValue = normalizeEnumFilterValue(candidate.field as string, rawValue.trim(), definition, versions)
          return enumValue ? [enumValue] : []
        })
        normalizedValue = [...new Set(enumValues)]
        if (!normalizedValue.length) return
      } else {
        if (typeof candidate.value !== 'string' || !candidate.value.trim()) return
        const trimmedValue = candidate.value.trim()
        if (definition.kind === 'date') {
          if (!isStrictCalendarDate(trimmedValue)) return
          normalizedValue = trimmedValue
        } else {
          normalizedValue = trimmedValue
        }
      }
    }

    usedFields.add(candidate.field)
    sanitized.push({
      id: claimFilterId(candidate.id, index, usedIds),
      field: candidate.field as RoadmapColumnKey,
      operator,
      value: normalizedValue,
    })
  })

  return sanitized
}

export function sanitizeRoadmapVisibleColumns(
  value: unknown,
  fallback: readonly RoadmapColumnKey[] = DEFAULT_ROADMAP_TABLE_VISIBLE_COLUMNS,
): RoadmapColumnKey[] {
  if (!Array.isArray(value)) return [...fallback]
  const requested = new Set(value.filter((key): key is string => typeof key === 'string'))
  const approved = ROADMAP_COLUMNS.flatMap(column => requested.has(column.key) ? [column.key] : [])
  return approved.length ? approved : [fallback[0] ?? ROADMAP_COLUMNS[0].key]
}

export function applyRoadmapFilters(
  rows: readonly RoadmapProjectRow[],
  brandFilter: 'all' | RoadmapBrand,
  productTypeFilter: 'all' | RoadmapProductType,
  filters: readonly RoadmapFilterCondition[],
  fieldDefinitions: readonly FilterFieldDefinition[],
): RoadmapProjectRow[] {
  const quickFilteredRows = rows.filter(row => (
    (brandFilter === 'all' || row.brand === brandFilter)
    && (productTypeFilter === 'all' || row.productType === productTypeFilter)
  ))
  const definitionsByKey = new Map(fieldDefinitions.map(definition => [definition.key, definition]))
  return quickFilteredRows.filter(row => filters.every(condition => {
    const definition = definitionsByKey.get(condition.field)
    if (!definition) return true
    if (definition.kind !== 'enum') {
      if (Array.isArray(condition.value)) return false
      return applyFilterConditions(
        [row],
        [{ ...condition, value: condition.value }],
        fieldDefinitions,
      ).length === 1
    }

    const actualRaw = row[condition.field]
    const actual = String(actualRaw ?? '').trim().toLowerCase()
    if (condition.operator === 'isEmpty') return actual === ''
    if (condition.operator === 'isNotEmpty') return actual !== ''
    if (!Array.isArray(condition.value) || condition.value.length === 0) return true
    const expected = condition.value.map(value => value.trim().toLowerCase())
    if (condition.operator === 'equals') return expected.some(value => value === actual)
    if (condition.operator === 'notEquals') return expected.every(value => value !== actual)
    return false
  }))
}

function sameFilter(left: RoadmapFilterCondition, right: RoadmapFilterCondition): boolean {
  return left.id === right.id
    && left.field === right.field
    && left.operator === right.operator
    && JSON.stringify(left.value) === JSON.stringify(right.value)
}

export function getRoadmapSelectedTosVersionIds(
  filters: readonly RoadmapFilterCondition[],
): string[] {
  const condition = filters.find(candidate => (
    candidate.field === 'firstSaleTosVersionId' && candidate.operator === 'equals'
  ))
  return Array.isArray(condition?.value) ? [...condition.value] : []
}

export interface RoadmapTextFilterTransition {
  immediate: RoadmapFilterCondition[]
  pending: RoadmapFilterCondition[]
}

export function transitionRoadmapTextFilters(
  previousEffective: readonly RoadmapFilterCondition[],
  nextConfigured: readonly RoadmapFilterCondition[],
): RoadmapTextFilterTransition {
  const immediate = nextConfigured.filter(next => previousEffective.some(previous => sameFilter(previous, next)))
  const pending = nextConfigured.filter(next => !immediate.some(current => sameFilter(current, next)))
  return { immediate: [...immediate], pending: [...pending] }
}

export interface RoadmapFilterTimerScheduler {
  setTimeout: (callback: () => void, delay: number) => unknown
  clearTimeout: (handle: unknown) => void
}

export interface RoadmapTextFilterDebouncer {
  update: (nextConfigured: readonly RoadmapFilterCondition[]) => void
  dispose: () => void
  getEffective: () => readonly RoadmapFilterCondition[]
}

const defaultScheduler: RoadmapFilterTimerScheduler = {
  setTimeout: (callback, delay) => globalThis.setTimeout(callback, delay),
  clearTimeout: handle => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
}

export function createRoadmapTextFilterDebouncer(
  initialEffective: readonly RoadmapFilterCondition[],
  publish: (effective: RoadmapFilterCondition[]) => void,
  scheduler: RoadmapFilterTimerScheduler = defaultScheduler,
): RoadmapTextFilterDebouncer {
  let effective = [...initialEffective]
  let pendingHandle: unknown = null

  const cancelPending = () => {
    if (pendingHandle === null) return
    scheduler.clearTimeout(pendingHandle)
    pendingHandle = null
  }

  return {
    update(nextConfigured) {
      cancelPending()
      const next = [...nextConfigured]
      const transition = transitionRoadmapTextFilters(effective, next)
      effective = transition.immediate
      publish([...effective])
      if (!transition.pending.length) return
      const handle = scheduler.setTimeout(() => {
        scheduler.clearTimeout(handle)
        if (pendingHandle !== handle) return
        pendingHandle = null
        effective = next
        publish([...effective])
      }, ROADMAP_FILTER_DEBOUNCE_MS)
      pendingHandle = handle
    },
    dispose() {
      cancelPending()
    },
    getEffective() {
      return [...effective]
    },
  }
}
