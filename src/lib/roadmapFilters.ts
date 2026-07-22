import {
  applyFilterConditions,
  getFilterOperatorsForKind,
  isValuelessFilterOperator,
  type FilterFieldDefinition,
} from '@/lib/filterConditions'
import { compareSemanticTos } from '@/lib/roadmapSorting'
import { normalizeTosVersionName, PRODUCT_LINES_BY_BRAND } from '@/lib/roadmapValidation'
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

export const DEFAULT_ROADMAP_VISIBLE_COLUMNS = ROADMAP_COLUMNS
  .filter(column => column.defaultVisible)
  .map(column => column.key)

export type RoadmapQuickFilterField = 'brand' | 'productType'
export type RoadmapQuickFilterValue = 'all' | 'custom' | RoadmapBrand | RoadmapProductType

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
  return condition.operator === 'equals' && condition.value
    ? condition.value as RoadmapQuickFilterValue
    : 'custom'
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
    value,
  }
  if (!existing) return [...filters, replacement]
  return filters.map(condition => condition.field === field ? replacement : condition)
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
): FilterFieldDefinition[] {
  const productLines = [...new Set(Object.values(PRODUCT_LINES_BY_BRAND).flat())]
  return [
    {
      key: 'firstSaleTosVersionId',
      label: 'tOS版本',
      kind: 'enum',
      options: [...versions]
        .sort((left, right) => compareSemanticTos(right, left))
        .map(version => ({ label: version.name, value: version.id })),
    },
    { key: 'brand', label: '品牌', kind: 'enum', options: ['TECNO', 'Infinix', 'itel', '待定', '其他品牌'].map(option) },
    { key: 'productLine', label: '产品线', kind: 'enum', options: productLines.map(option) },
    { key: 'productSeries', label: '产品系列', kind: 'text' },
    { key: 'marketName', label: '市场名', kind: 'text' },
    { key: 'displayName', label: '项目名', kind: 'text' },
    { key: 'productType', label: '产品类型', kind: 'enum', options: ['新品', '老品'].map(option) },
    { key: 'platform', label: '平台', kind: 'text' },
    { key: 'startRam', label: '起步RAM', kind: 'enum', options: ['2GB', '3GB', '4GB', '6GB', '8GB', '12GB', '16GB'].map(option) },
    { key: 'versionType', label: '版本类型', kind: 'enum', options: ['Full', 'Slim', 'Go'].map(option) },
    { key: 'str5Date', label: 'STR5时间', kind: 'date' },
    { key: 'launchDate', label: '上市时间', kind: 'date' },
    { key: 'developMode', label: '开发模式', kind: 'enum', options: ['自研', 'ODC', 'ITD-ODC', 'ODM', '纯外研'].map(option) },
    { key: 'remark', label: '备注', kind: 'text' },
  ]
}

function normalizeEnumFilterValue(
  field: string,
  rawValue: string,
  definition: FilterFieldDefinition,
  versions: readonly TosVersionConfig[],
): string | null {
  const exact = definition.options?.find(candidate => candidate.value === rawValue)
  if (exact) return exact.value
  if (field !== 'firstSaleTosVersionId') return null
  const normalized = normalizeTosVersionName(rawValue)
  if (!normalized) return null
  return versions.find(version => (
    version.major === normalized.major && version.minor === normalized.minor
  ))?.id ?? null
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
    if (!getFilterOperatorsForKind(definition.kind).some(optionDefinition => optionDefinition.value === operator)) return

    let normalizedValue = ''
    if (!isValuelessFilterOperator(operator)) {
      if (typeof candidate.value !== 'string' || !candidate.value.trim()) return
      const trimmedValue = candidate.value.trim()
      if (definition.kind === 'date') {
        if (!isStrictCalendarDate(trimmedValue)) return
        normalizedValue = trimmedValue
      } else if (definition.kind === 'enum') {
        const enumValue = normalizeEnumFilterValue(candidate.field, trimmedValue, definition, versions)
        if (!enumValue) return
        normalizedValue = enumValue
      } else {
        normalizedValue = trimmedValue
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

export function sanitizeRoadmapVisibleColumns(value: unknown): RoadmapColumnKey[] {
  if (!Array.isArray(value)) return [...DEFAULT_ROADMAP_VISIBLE_COLUMNS]
  const requested = new Set(value.filter((key): key is string => typeof key === 'string'))
  const approved = ROADMAP_COLUMNS.flatMap(column => requested.has(column.key) ? [column.key] : [])
  return approved.length ? approved : [ROADMAP_COLUMNS[0].key]
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
  return applyFilterConditions(quickFilteredRows, filters, fieldDefinitions)
}

function sameFilter(left: RoadmapFilterCondition, right: RoadmapFilterCondition): boolean {
  return left.id === right.id
    && left.field === right.field
    && left.operator === right.operator
    && left.value === right.value
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
