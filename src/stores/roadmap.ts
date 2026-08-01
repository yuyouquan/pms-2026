import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import {
  createRoadmapAuditSnapshot,
  diffRoadmapProjectFields,
  ROADMAP_AUDIT_FIELDS,
} from '@/lib/roadmapAudit'
import {
  DEFAULT_ROADMAP_COLUMN_ORDER,
  DEFAULT_ROADMAP_EVOLUTION_COLUMN_ORDER,
  DEFAULT_ROADMAP_EVOLUTION_VISIBLE_COLUMNS,
  DEFAULT_ROADMAP_TABLE_VISIBLE_COLUMNS,
  DEFAULT_ROADMAP_VISIBLE_COLUMNS,
  ensureRoadmapLockedColumns,
  getRoadmapQuickFilterValue,
  ROADMAP_EVOLUTION_LOCKED_COLUMNS,
  normalizeRoadmapColumnSettings,
  sanitizeRoadmapFilterConditions,
  sanitizeRoadmapVisibleColumns,
  setRoadmapQuickFilter,
  setRoadmapTosVersionFilter,
} from '@/lib/roadmapFilters'
import { compareSemanticTos } from '@/lib/roadmapSorting'
import type { SortableColumnSettingsValue } from '@/lib/columnSettings'
import { normalizeMachineSecondaryCategory } from '@/constants/projectTypes'
import {
  buildRoadmapDisplayName,
  formatRoadmapTosValue,
  formatTosVersionFull,
  isExactIsoDate,
  isExactRoadmapDuplicate,
  normalizeLegacyRoadmapProductType,
  normalizeLegacyTosVersionName,
  normalizeRoadmapTosReference,
  normalizeRoadmapTosValue,
  normalizeTosVersionName,
  validatePlannedProject,
} from '@/lib/roadmapValidation'
import {
  ROADMAP_COLUMNS,
  type PlannedRoadmapProject,
  type PlannedRoadmapProjectMutationInput,
  type RoadmapBrand,
  type RoadmapChangeLog,
  type RoadmapColumnKey,
  type RoadmapDuplicateComparison,
  type RoadmapFilterCondition,
  type RoadmapMutationResult,
  type RoadmapNormalChangeInput,
  type RoadmapProductType,
  type RoadmapProjectFields,
  type RoadmapSortState,
  type RoadmapStore,
  type RoadmapStoreState,
  type RoadmapViewMode,
  type TosVersionConfig,
} from '@/types/roadmap'
import { useEnumStore } from '@/stores/enums'

const INITIAL_TIMESTAMP = '2026-01-01T00:00:00.000Z'
const ROADMAP_STORAGE_KEY = 'pms-project-roadmap'
export const ROADMAP_STORE_VERSION = 6

const KNOWN_COLUMN_KEYS = new Set<RoadmapColumnKey>(ROADMAP_COLUMNS.map(column => column.key))
const ROADMAP_BRANDS = new Set<RoadmapBrand>(['TECNO', 'Infinix', 'itel', '待定', '其他品牌'])
const ROADMAP_PRODUCT_TYPES = new Set<RoadmapProductType>(['新品', '老品'])
const ROADMAP_AUDIT_FIELD_SET = new Set<string>(ROADMAP_AUDIT_FIELDS)

type PersistedRoadmapState = Pick<
  RoadmapStoreState,
  | 'plannedProjects'
  | 'tosVersions'
  | 'changeLogs'
  | 'viewMode'
  | 'selectedTosVersionId'
  | 'brandFilter'
  | 'productTypeFilter'
  | 'filters'
  | 'columnOrder'
  | 'columnOrderByView'
  | 'visibleColumns'
  | 'visibleColumnsByView'
  | 'sort'
>

let fallbackIdCounter = 0
let roadmapStorageReadFailed = false

function nowIso(): string {
  return new Date().toISOString()
}

function createCollisionResistantId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return `${prefix}-${uuid}`
  fallbackIdCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${fallbackIdCounter.toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isValidIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function normalizeTimestamp(value: unknown): string {
  return isValidIsoTimestamp(value) ? new Date(value).toISOString() : INITIAL_TIMESTAMP
}

function normalizeTargets(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.flatMap(target => {
    if (typeof target !== 'string') return []
    const trimmed = target.trim()
    return trimmed ? [trimmed] : []
  })
}

function normalizeTosPeriod(
  periodStartDate: unknown,
  periodEndDate: unknown,
): { periodStartDate: string; periodEndDate: string } {
  return {
    periodStartDate: typeof periodStartDate === 'string' ? periodStartDate.trim() : '',
    periodEndDate: typeof periodEndDate === 'string' ? periodEndDate.trim() : '',
  }
}

function validateTosPeriod(
  periodStartDate: string,
  periodEndDate: string,
): Record<string, string> {
  if (!periodStartDate && !periodEndDate) return {}
  if (!periodStartDate || !periodEndDate) {
    return {
      [periodStartDate ? 'periodEndDate' : 'periodStartDate']: '项目周期开始和结束日期需同时填写',
    }
  }
  const errors: Record<string, string> = {}
  if (!isExactIsoDate(periodStartDate)) errors.periodStartDate = '日期格式必须为 YYYY-MM-DD'
  if (!isExactIsoDate(periodEndDate)) errors.periodEndDate = '日期格式必须为 YYYY-MM-DD'
  if (!Object.keys(errors).length && periodStartDate > periodEndDate) {
    errors.periodEndDate = '项目周期开始时间不能晚于结束时间'
  }
  return errors
}

function claimDeterministicId(preferred: unknown, fallback: string, usedIds: Set<string>): string {
  const base = typeof preferred === 'string' && preferred.trim() ? preferred.trim() : fallback
  let candidate = base
  let suffix = 2
  while (usedIds.has(candidate)) {
    candidate = `${base}-${suffix}`
    suffix += 1
  }
  usedIds.add(candidate)
  return candidate
}

function sortTosVersions(versions: readonly TosVersionConfig[]): TosVersionConfig[] {
  return [...versions].sort((left, right) => compareSemanticTos(right, left))
}

function repairSelectedTosVersionId(
  selectedTosVersionId: string | null | undefined,
  tosVersions: readonly TosVersionConfig[],
): string | null {
  if (!selectedTosVersionId) return null
  return tosVersions.some(version => version.id === selectedTosVersionId)
    ? selectedTosVersionId
    : null
}

export function createInitialTosVersions(): TosVersionConfig[] {
  return [
    [18, 0],
    [17, 2],
    [17, 1],
    [17, 0],
    [16, 3],
    [16, 2],
    [16, 1],
  ].map(([major, minor]) => ({
    id: `${major}.${minor}`,
    name: `tOS${major}.${minor}`,
    major,
    minor,
    periodStartDate: '',
    periodEndDate: '',
    targets: [],
    createdAt: INITIAL_TIMESTAMP,
    updatedAt: INITIAL_TIMESTAMP,
  }))
}

export function createInitialPlannedProjects(
  tosVersions: readonly TosVersionConfig[] = createInitialTosVersions(),
): PlannedRoadmapProject[] {
  const firstSaleVersion = tosVersions.find(version => version.id === '16.3')
    ?? tosVersions.find(version => version.major === 16 && version.minor === 3)
    ?? tosVersions[0]
  if (!firstSaleVersion) return []
  return [{
    id: 'planned-mock-x6877-android16-new',
    status: '待规划',
    machineProjectType: '整机-手机',
    projectCode: 'X6877',
    displayName: 'X6877',
    androidVersion: 'Android 16',
    firstSaleTosVersionId: firstSaleVersion.id,
    brand: 'Infinix',
    productLine: 'NOTE',
    productSeries: 'NOTE 60',
    marketName: 'NOTE 60 Pro',
    productType: '新品',
    platform: 'MT6877',
    startRam: '8GB',
    versionType: 'Full',
    str5Date: '2026-10-15',
    str5Estimated: true,
    launchDate: '2026-11-20',
    launchEstimated: true,
    developMode: 'ODC',
    remark: '待规划样例：用于确认与已存在普通项目的重复冲突处理。',
    createdAt: '2026-07-21T02:15:00.000Z',
    createdBy: '李四',
    updatedAt: '2026-07-22T09:30:00.000Z',
    updatedBy: '张三',
  }]
}

export function createInitialRoadmapChangeLogs(
  tosVersions: readonly TosVersionConfig[] = createInitialTosVersions(),
  plannedProjects: readonly PlannedRoadmapProject[] = createInitialPlannedProjects(tosVersions),
): RoadmapChangeLog[] {
  const planned = plannedProjects.find(project => project.id === 'planned-mock-x6877-android16-new')
  if (!planned) return []
  const plannedTosVersionName = tosVersions.find(version => version.id === planned.firstSaleTosVersionId)?.name
    ?? planned.firstSaleTosVersionId
  const normalAfterVersion = tosVersions.find(version => version.id === '16.3') ?? tosVersions[0]
  const normalBeforeVersion = tosVersions.find(version => version.id === '16.2') ?? normalAfterVersion
  if (!normalAfterVersion || !normalBeforeVersion) return []

  const normalBefore: RoadmapProjectFields = {
    machineProjectType: '整机-手机',
    projectCode: 'X6877',
    displayName: buildRoadmapDisplayName('X6877', 'Android 16', '新品'),
    androidVersion: 'Android 16',
    firstSaleTosVersionId: normalBeforeVersion.id,
    brand: 'TECNO',
    productLine: 'NOTE',
    productSeries: 'CAMON 50',
    marketName: 'NOTE 50',
    productType: '新品',
    platform: 'MT6877',
    startRam: '8GB',
    versionType: 'Full',
    str5Date: '2026-05-15',
    str5Estimated: false,
    launchDate: '2026-06-15',
    launchEstimated: false,
    developMode: 'ODC',
    remark: '重点验证海外市场首销版本交付。',
  }
  const normalAfter: RoadmapProjectFields = {
    ...normalBefore,
    firstSaleTosVersionId: normalAfterVersion.id,
    marketName: 'NOTE 50 Pro',
    remark: '重点验证 tOS 16.3 全量版本交付。',
  }
  const plannedBefore: RoadmapProjectFields = {
    ...planned,
    brand: '待定',
    productLine: '待定',
    productSeries: '待定',
    marketName: 'X6877',
  }

  return [
    {
      id: 'roadmap-log-mock-planned-update-x6877',
      projectId: planned.id,
      projectDisplayName: buildRoadmapDisplayName(planned.projectCode, planned.androidVersion, planned.productType),
      source: 'planned',
      action: 'update',
      actor: '张三',
      occurredAt: '2026-07-22T09:30:00.000Z',
      tosVersionName: plannedTosVersionName,
      changes: diffRoadmapProjectFields(plannedBefore, planned, tosVersions),
    },
    {
      id: 'roadmap-log-mock-normal-update-x6877',
      projectId: '1',
      projectDisplayName: buildRoadmapDisplayName(normalAfter.projectCode, normalAfter.androidVersion, normalAfter.productType),
      source: 'normal',
      action: 'update',
      actor: '张三',
      occurredAt: '2026-07-22T08:45:00.000Z',
      tosVersionName: normalAfterVersion.name,
      changes: diffRoadmapProjectFields(normalBefore, normalAfter, tosVersions),
    },
    {
      id: 'roadmap-log-mock-planned-create-x6877',
      projectId: planned.id,
      projectDisplayName: buildRoadmapDisplayName(planned.projectCode, planned.androidVersion, planned.productType),
      source: 'planned',
      action: 'create',
      actor: '李四',
      occurredAt: '2026-07-21T02:15:00.000Z',
      tosVersionName: plannedTosVersionName,
      changes: [],
      snapshot: createRoadmapAuditSnapshot(plannedBefore, tosVersions),
    },
    {
      id: 'roadmap-log-mock-normal-create-x6877',
      projectId: '1',
      projectDisplayName: buildRoadmapDisplayName(normalBefore.projectCode, normalBefore.androidVersion, normalBefore.productType),
      source: 'normal',
      action: 'create',
      actor: '李四',
      occurredAt: '2026-07-20T06:20:00.000Z',
      tosVersionName: normalBeforeVersion.name,
      changes: [],
      snapshot: createRoadmapAuditSnapshot(normalBefore, tosVersions),
    },
  ]
}

export function createInitialRoadmapState(): RoadmapStoreState {
  return {
    plannedProjects: [],
    tosVersions: createInitialTosVersions(),
    changeLogs: [],
    viewMode: 'table',
    selectedTosVersionId: null,
    brandFilter: 'all',
    productTypeFilter: 'all',
    filters: [],
    columnOrder: [...DEFAULT_ROADMAP_COLUMN_ORDER],
    columnOrderByView: {
      table: [...DEFAULT_ROADMAP_COLUMN_ORDER],
      evolution: [...DEFAULT_ROADMAP_EVOLUTION_COLUMN_ORDER],
    },
    visibleColumns: [...DEFAULT_ROADMAP_VISIBLE_COLUMNS],
    visibleColumnsByView: {
      table: [...DEFAULT_ROADMAP_TABLE_VISIBLE_COLUMNS],
      evolution: [...DEFAULT_ROADMAP_EVOLUTION_VISIBLE_COLUMNS],
    },
    sort: { field: null, direction: null },
    selectedConflictKey: null,
  }
}

export function createInitialRoadmapMockState(
  tosVersions: TosVersionConfig[] = createInitialTosVersions(),
): RoadmapStoreState {
  const plannedProjects = createInitialPlannedProjects(tosVersions)
  return {
    plannedProjects,
    tosVersions,
    changeLogs: createInitialRoadmapChangeLogs(tosVersions, plannedProjects),
    viewMode: 'table',
    selectedTosVersionId: null,
    brandFilter: 'all',
    productTypeFilter: 'all',
    filters: [],
    columnOrder: [...DEFAULT_ROADMAP_COLUMN_ORDER],
    columnOrderByView: {
      table: [...DEFAULT_ROADMAP_COLUMN_ORDER],
      evolution: [...DEFAULT_ROADMAP_EVOLUTION_COLUMN_ORDER],
    },
    visibleColumns: [...DEFAULT_ROADMAP_VISIBLE_COLUMNS],
    visibleColumnsByView: {
      table: [...DEFAULT_ROADMAP_TABLE_VISIBLE_COLUMNS],
      evolution: [...DEFAULT_ROADMAP_EVOLUTION_VISIBLE_COLUMNS],
    },
    sort: { field: null, direction: null },
    selectedConflictKey: null,
  }
}

function sanitizeSort(value: unknown): RoadmapSortState {
  if (!isRecord(value)) return { field: null, direction: null }
  const field = typeof value.field === 'string' && KNOWN_COLUMN_KEYS.has(value.field as RoadmapColumnKey)
    ? value.field as RoadmapColumnKey
    : null
  const direction = value.direction === 'ascend' || value.direction === 'descend' ? value.direction : null
  return field && direction ? { field, direction } : { field: null, direction: null }
}

function preserveKnownColumnOrder(value: unknown): RoadmapColumnKey[] | undefined {
  if (!Array.isArray(value)) return undefined
  const seen = new Set<RoadmapColumnKey>()
  const order: RoadmapColumnKey[] = []
  for (const candidate of value) {
    if (
      typeof candidate !== 'string'
      || !KNOWN_COLUMN_KEYS.has(candidate as RoadmapColumnKey)
      || seen.has(candidate as RoadmapColumnKey)
    ) continue
    const key = candidate as RoadmapColumnKey
    seen.add(key)
    order.push(key)
  }
  return order
}

function migrateTosVersions(value: unknown): TosVersionConfig[] | null {
  if (!Array.isArray(value)) return null
  const versionsByKey = new Map<string, TosVersionConfig>()

  for (const entry of value) {
    if (!isRecord(entry)) continue
    const fromName = typeof entry.name === 'string' ? normalizeLegacyTosVersionName(entry.name) : null
    const fromParts = Number.isSafeInteger(entry.major) && Number(entry.major) >= 0
      && Number.isSafeInteger(entry.minor) && Number(entry.minor) >= 0
      ? normalizeTosVersionName(`tOS ${Number(entry.major)}.${Number(entry.minor)}`)
      : null
    const parsed = fromName ?? fromParts
    if (!parsed) continue
    const period = normalizeTosPeriod(entry.periodStartDate, entry.periodEndDate)
    const migratedPeriod = Object.keys(validateTosPeriod(period.periodStartDate, period.periodEndDate)).length
      ? { periodStartDate: '', periodEndDate: '' }
      : period
    const candidate: TosVersionConfig = {
      id: `${parsed.major}.${parsed.minor}`,
      ...parsed,
      name: `tOS${parsed.major}.${parsed.minor}`,
      ...migratedPeriod,
      targets: normalizeTargets(entry.targets),
      createdAt: normalizeTimestamp(entry.createdAt),
      updatedAt: normalizeTimestamp(entry.updatedAt),
    }
    const key = `${parsed.major}.${parsed.minor}`
    const existing = versionsByKey.get(key)
    if (!existing || Date.parse(candidate.updatedAt) >= Date.parse(existing.updatedAt)) {
      versionsByKey.set(key, candidate)
    }
  }

  const versions = [...versionsByKey.values()]
  if (value.length > 0 && versions.length === 0) return null
  return sortTosVersions(versions)
}

function resolveMigratedTosId(value: unknown, versions: readonly TosVersionConfig[]): string | null {
  const normalized = normalizeRoadmapTosReference(value, versions)
  const parsed = normalizeTosVersionName(normalized)
  return parsed ? `${parsed.major}.${parsed.minor}` : null
}

function trimStringValue<T>(value: T): T {
  return (typeof value === 'string' ? value.trim() : value) as T
}

function normalizeProjectInput(input: PlannedRoadmapProjectMutationInput): PlannedRoadmapProjectMutationInput {
  return {
    ...input,
    firstSaleTosVersionId: normalizeRoadmapTosReference(input.firstSaleTosVersionId),
    projectCode: trimStringValue(input.projectCode),
    productLine: trimStringValue(input.productLine),
    productSeries: trimStringValue(input.productSeries),
    marketName: trimStringValue(input.marketName),
    platform: trimStringValue(input.platform),
    str5Date: trimStringValue(input.str5Date),
    str5Estimated: input.str5Estimated === true,
    launchDate: trimStringValue(input.launchDate),
    launchEstimated: input.launchEstimated === true,
    remark: trimStringValue(input.remark) ?? '',
    actor: trimStringValue(input.actor),
  }
}

function toProjectFields(input: PlannedRoadmapProjectMutationInput): RoadmapProjectFields {
  return {
    machineProjectType: input.machineProjectType,
    projectCode: input.projectCode,
    displayName: buildRoadmapDisplayName(input.projectCode, input.androidVersion, input.productType),
    androidVersion: input.androidVersion,
    firstSaleTosVersionId: input.firstSaleTosVersionId,
    brand: input.brand,
    productLine: input.productLine,
    productSeries: input.productSeries,
    marketName: input.marketName,
    productType: input.productType,
    platform: input.platform,
    startRam: input.startRam,
    versionType: input.versionType,
    str5Date: input.str5Date,
    str5Estimated: input.str5Estimated === true,
    launchDate: input.launchDate,
    launchEstimated: input.launchEstimated === true,
    developMode: input.developMode,
    remark: input.remark ?? '',
  }
}

function migratePlannedProjects(value: unknown, versions: readonly TosVersionConfig[]): PlannedRoadmapProject[] | null {
  if (!Array.isArray(value)) return null
  const projects: PlannedRoadmapProject[] = []
  const usedIds = new Set<string>()

  for (const [index, entry] of value.entries()) {
    if (!isRecord(entry)) continue
    const productType = normalizeLegacyRoadmapProductType(entry.productType)
    const tosReference = entry.firstSaleTosVersionId ?? entry.tosVersion
    const tosVersionId = normalizeRoadmapTosReference(tosReference, versions)
    const machineProjectType = normalizeMachineSecondaryCategory(
      typeof entry.machineProjectType === 'string' ? entry.machineProjectType : null,
    )
    if (!productType || !tosVersionId || !machineProjectType) continue

    const migratedInput = {
      ...entry,
      machineProjectType,
      productType,
      firstSaleTosVersionId: tosVersionId,
      remark: typeof entry.remark === 'string' ? entry.remark : '',
      actor: typeof entry.updatedBy === 'string' ? entry.updatedBy : '系统',
    } as PlannedRoadmapProjectMutationInput
    // Historical persisted rows may legitimately share the same business key.
    // Migration validates row shape and references but only repairs identity collisions.
    const errors = validatePlannedProject(migratedInput, [], undefined, new Set([tosVersionId]))
    if (Object.keys(errors).length) continue
    const normalizedInput = normalizeProjectInput(migratedInput)
    const fields = toProjectFields(normalizedInput)
    projects.push({
      ...fields,
      id: claimDeterministicId(entry.id, `planned-migrated-${index + 1}`, usedIds),
      status: '待规划',
      createdAt: normalizeTimestamp(entry.createdAt),
      createdBy: typeof entry.createdBy === 'string' && entry.createdBy.trim() ? entry.createdBy.trim() : '系统',
      updatedAt: normalizeTimestamp(entry.updatedAt),
      updatedBy: typeof entry.updatedBy === 'string' && entry.updatedBy.trim() ? entry.updatedBy.trim() : '系统',
    })
  }

  return projects
}

function isValidChangeLog(value: unknown): value is RoadmapChangeLog {
  if (!isRecord(value)) return false
  if (
    typeof value.id !== 'string'
    || typeof value.projectId !== 'string'
    || typeof value.projectDisplayName !== 'string'
    || (value.source !== 'normal' && value.source !== 'planned')
    || (value.action !== 'create' && value.action !== 'update' && value.action !== 'delete')
    || typeof value.actor !== 'string'
    || !isValidIsoTimestamp(value.occurredAt)
    || typeof value.tosVersionName !== 'string'
    || !Array.isArray(value.changes)
  ) return false
  const hasValidChanges = value.changes.every(change => (
    isRecord(change)
    && typeof change.field === 'string'
    && ROADMAP_AUDIT_FIELD_SET.has(change.field)
    && typeof change.before === 'string'
    && typeof change.after === 'string'
  ))
  if (!hasValidChanges || (value.action === 'update' && value.changes.length === 0)) return false

  const snapshotEntries = isRecord(value.snapshot) ? Object.entries(value.snapshot) : []
  const hasValidSnapshot = snapshotEntries.length > 0 && snapshotEntries.every(([field, fieldValue]) => (
    ROADMAP_AUDIT_FIELD_SET.has(field) && typeof fieldValue === 'string'
  ))
  if ((value.action === 'create' || value.action === 'delete') && !hasValidSnapshot) return false
  return value.snapshot === undefined || hasValidSnapshot
}

function migrateChangeLogs(value: unknown): RoadmapChangeLog[] | null {
  if (!Array.isArray(value)) return null
  const logs: RoadmapChangeLog[] = []
  const usedIds = new Set<string>()
  for (const [index, entry] of value.entries()) {
    if (!isRecord(entry)) continue
    const fallbackId = `roadmap-log-migrated-${index + 1}`
    const candidate = {
      ...entry,
      id: typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : fallbackId,
    }
    if (!isValidChangeLog(candidate)) continue
    logs.push({
      ...candidate,
      id: claimDeterministicId(candidate.id, fallbackId, usedIds),
    })
  }
  return logs
}

function normalizeRoadmapState(persistedState: unknown, fromVersion: number | null): RoadmapStoreState {
  const initial = createInitialRoadmapState()
  if (!isRecord(persistedState)) return initial
  const roadmapKeys = ['plannedProjects', 'tosVersions', 'changeLogs', 'viewMode', 'selectedTosVersionId']
  if (!roadmapKeys.some(key => key in persistedState)) return initial
  if (
    ('plannedProjects' in persistedState && !Array.isArray(persistedState.plannedProjects))
    || ('tosVersions' in persistedState && !Array.isArray(persistedState.tosVersions))
    || ('changeLogs' in persistedState && !Array.isArray(persistedState.changeLogs))
  ) return initial

  const tosVersions = 'tosVersions' in persistedState
    ? migrateTosVersions(persistedState.tosVersions)
    : createInitialTosVersions()
  if (!tosVersions) return initial
  const plannedProjects = 'plannedProjects' in persistedState
    ? migratePlannedProjects(persistedState.plannedProjects, tosVersions)
    : []
  const changeLogs = 'changeLogs' in persistedState ? migrateChangeLogs(persistedState.changeLogs) : []
  if (!plannedProjects || !changeLogs) return initial

  const persistedSelectedTosVersionId = resolveMigratedTosId(
    persistedState.selectedTosVersionId,
    tosVersions,
  )
  const viewMode = persistedState.viewMode === 'evolution' ? 'evolution' : 'table'
  let filters = sanitizeRoadmapFilterConditions(persistedState.filters, tosVersions)
  const tosCondition = filters.find(condition => condition.field === 'firstSaleTosVersionId')
  const tosValues = tosCondition && Array.isArray(tosCondition.value) ? tosCondition.value : null
  const selectedTosVersionId = tosValues
    ? tosValues.length === 1 ? tosValues[0] : null
    : persistedSelectedTosVersionId
  if (!tosCondition && viewMode === 'table' && selectedTosVersionId) {
    filters = sanitizeRoadmapFilterConditions(
      setRoadmapTosVersionFilter(filters, selectedTosVersionId),
      tosVersions,
    )
  }
  const legacyBrand = ROADMAP_BRANDS.has(persistedState.brandFilter as RoadmapBrand)
    ? persistedState.brandFilter as RoadmapBrand
    : null
  const legacyProductType = ROADMAP_PRODUCT_TYPES.has(persistedState.productTypeFilter as RoadmapProductType)
    ? persistedState.productTypeFilter as RoadmapProductType
    : null
  if (legacyBrand && !filters.some(condition => condition.field === 'brand')) {
    filters = setRoadmapQuickFilter(filters, 'brand', legacyBrand)
  }
  if (legacyProductType && !filters.some(condition => condition.field === 'productType')) {
    filters = setRoadmapQuickFilter(filters, 'productType', legacyProductType)
  }
  const migratedBrand = getRoadmapQuickFilterValue(filters, 'brand')
  const migratedProductType = getRoadmapQuickFilterValue(filters, 'productType')
  const persistedColumnsByView = isRecord(persistedState.visibleColumnsByView)
    ? persistedState.visibleColumnsByView
    : null
  const hasPersistedTableColumns = Array.isArray(persistedColumnsByView?.table)
  const hasPersistedEvolutionColumns = Array.isArray(persistedColumnsByView?.evolution)
  const legacyVisibleColumns = sanitizeRoadmapVisibleColumns(persistedState.visibleColumns)
  const tableVisibleColumns = hasPersistedTableColumns
    ? sanitizeRoadmapVisibleColumns(
      persistedColumnsByView?.table,
      DEFAULT_ROADMAP_TABLE_VISIBLE_COLUMNS,
    )
    : legacyVisibleColumns
  const migratedEvolutionVisibleColumns = hasPersistedEvolutionColumns
    ? sanitizeRoadmapVisibleColumns(
      persistedColumnsByView?.evolution,
      DEFAULT_ROADMAP_EVOLUTION_VISIBLE_COLUMNS,
    )
    : JSON.stringify(legacyVisibleColumns) === JSON.stringify(DEFAULT_ROADMAP_TABLE_VISIBLE_COLUMNS)
      ? [...DEFAULT_ROADMAP_EVOLUTION_VISIBLE_COLUMNS]
      : legacyVisibleColumns
  let evolutionVisibleColumns = ensureRoadmapLockedColumns(
    migratedEvolutionVisibleColumns,
    ROADMAP_EVOLUTION_LOCKED_COLUMNS,
  )
  if (fromVersion !== null && fromVersion < 4) {
    evolutionVisibleColumns = [...DEFAULT_ROADMAP_EVOLUTION_VISIBLE_COLUMNS]
  } else if (fromVersion !== null && fromVersion < 5 && !evolutionVisibleColumns.includes('developMode')) {
    evolutionVisibleColumns = ensureRoadmapLockedColumns(
      [...evolutionVisibleColumns, 'developMode'],
      ROADMAP_EVOLUTION_LOCKED_COLUMNS,
    )
  }
  const visibleColumnsByView = {
    table: normalizeRoadmapColumnSettings('table', {
      order: [],
      visible: tableVisibleColumns,
    }).visible,
    evolution: normalizeRoadmapColumnSettings('evolution', {
      order: [],
      visible: evolutionVisibleColumns,
    }).visible,
  }
  const persistedOrderByView = isRecord(persistedState.columnOrderByView)
    ? persistedState.columnOrderByView
    : null
  const legacyColumnOrder = preserveKnownColumnOrder(persistedState.columnOrder)
  const legacyVisibleColumnOrder = preserveKnownColumnOrder(persistedState.visibleColumns)
  const tableLegacyVisibleOrder = hasPersistedTableColumns
    ? preserveKnownColumnOrder(persistedColumnsByView?.table)
    : legacyVisibleColumnOrder
  const evolutionLegacyVisibleOrder = hasPersistedEvolutionColumns
    ? preserveKnownColumnOrder(persistedColumnsByView?.evolution)
    : legacyVisibleColumnOrder
  const tableSettings = normalizeRoadmapColumnSettings('table', {
    order: Array.isArray(persistedOrderByView?.table)
      ? persistedOrderByView.table as RoadmapColumnKey[]
      : viewMode === 'table' && legacyColumnOrder
        ? legacyColumnOrder
        : tableLegacyVisibleOrder,
    visible: visibleColumnsByView.table,
  })
  const persistedEvolutionOrder = Array.isArray(persistedOrderByView?.evolution)
    ? persistedOrderByView.evolution as RoadmapColumnKey[]
    : viewMode === 'evolution' && legacyColumnOrder
      ? legacyColumnOrder
      : evolutionLegacyVisibleOrder
  const preservedEvolutionOrder = preserveKnownColumnOrder(persistedEvolutionOrder)
    ?? [...DEFAULT_ROADMAP_EVOLUTION_COLUMN_ORDER]
  const completeEvolutionOrder = normalizeRoadmapColumnSettings('evolution', {
    order: preservedEvolutionOrder,
    visible: evolutionVisibleColumns,
  }).order
  const upgradedEvolutionOrder: RoadmapColumnKey[] = completeEvolutionOrder.filter(key => key !== 'developMode')
  upgradedEvolutionOrder.splice(
    Math.max(upgradedEvolutionOrder.indexOf('versionType') + 1, 0),
    0,
    'developMode',
  )
  const evolutionSettings = normalizeRoadmapColumnSettings('evolution', {
    order: fromVersion !== null && fromVersion < 5
      ? upgradedEvolutionOrder
      : Array.isArray(persistedOrderByView?.evolution)
      ? persistedOrderByView.evolution as RoadmapColumnKey[]
      : viewMode === 'evolution' && legacyColumnOrder
        ? legacyColumnOrder
        : evolutionLegacyVisibleOrder,
    visible: visibleColumnsByView.evolution,
  })
  const columnOrderByView = {
    table: tableSettings.order,
    evolution: evolutionSettings.order,
  }

  return {
    plannedProjects,
    tosVersions,
    changeLogs,
    viewMode,
    selectedTosVersionId,
    brandFilter: ROADMAP_BRANDS.has(migratedBrand as RoadmapBrand) ? migratedBrand as RoadmapBrand : 'all',
    productTypeFilter: ROADMAP_PRODUCT_TYPES.has(migratedProductType as RoadmapProductType)
      ? migratedProductType as RoadmapProductType
      : 'all',
    filters,
    columnOrder: columnOrderByView[viewMode],
    columnOrderByView,
    visibleColumns: visibleColumnsByView[viewMode],
    visibleColumnsByView,
    sort: sanitizeSort(persistedState.sort),
    selectedConflictKey: null,
  }
}

export function migrateRoadmapState(persistedState: unknown, fromVersion: number): RoadmapStoreState {
  return normalizeRoadmapState(persistedState, fromVersion)
}

export function sanitizeRoadmapCurrentState(persistedState: unknown): RoadmapStoreState {
  return normalizeRoadmapState(persistedState, null)
}

export function partializeRoadmapState(state: RoadmapStore): PersistedRoadmapState {
  return {
    plannedProjects: state.plannedProjects,
    tosVersions: state.tosVersions,
    changeLogs: state.changeLogs,
    viewMode: state.viewMode,
    selectedTosVersionId: state.selectedTosVersionId,
    brandFilter: state.brandFilter,
    productTypeFilter: state.productTypeFilter,
    filters: state.filters,
    columnOrder: state.columnOrder,
    columnOrderByView: state.columnOrderByView,
    visibleColumns: state.visibleColumns,
    visibleColumnsByView: state.visibleColumnsByView,
    sort: state.sort,
  }
}

export function mergeRoadmapPersistedState(
  persistedState: unknown,
  currentState: RoadmapStore,
): RoadmapStore {
  const migrated = sanitizeRoadmapCurrentState(persistedState)
  if (persistedState === null || persistedState === undefined) {
    return roadmapStorageReadFailed ? { ...currentState, ...migrated } : currentState
  }
  const mock = createInitialRoadmapMockState(migrated.tosVersions)
  const mockLogIds = new Set(mock.changeLogs.map(log => log.id))
  const changeLogs = [
    ...mock.changeLogs,
    ...migrated.changeLogs.filter(log => !mockLogIds.has(log.id)),
  ].sort((left, right) => (
    Date.parse(right.occurredAt) - Date.parse(left.occurredAt) || left.id.localeCompare(right.id)
  ))

  const plannedSeed = mock.plannedProjects[0]
  if (!plannedSeed) {
    return {
      ...currentState,
      ...migrated,
      changeLogs,
    }
  }
  const seedWasDeleted = migrated.changeLogs.some(log => (
    log.source === 'planned'
    && log.action === 'delete'
    && log.projectId === plannedSeed.id
  ))
  const canResolveSeedTos = migrated.tosVersions.some(version => version.id === plannedSeed.firstSaleTosVersionId)
  const projectsWithoutSeed = migrated.plannedProjects.filter(project => project.id !== plannedSeed.id)
  const hasEquivalentPlannedProject = isExactRoadmapDuplicate(plannedSeed, projectsWithoutSeed)
  const plannedProjects = seedWasDeleted
    ? projectsWithoutSeed
    : canResolveSeedTos && !hasEquivalentPlannedProject
      ? [plannedSeed, ...projectsWithoutSeed]
      : projectsWithoutSeed

  return {
    ...currentState,
    ...migrated,
    plannedProjects,
    changeLogs,
  }
}

const safeRoadmapStorage: StateStorage = {
  getItem(name) {
    if (typeof window === 'undefined') return null
    try {
      const stored = window.localStorage.getItem(name)
      if (stored !== null) JSON.parse(stored)
      roadmapStorageReadFailed = false
      return stored
    } catch (error) {
      roadmapStorageReadFailed = true
      console.error(`Failed to read ${ROADMAP_STORAGE_KEY}; using initial roadmap state.`, error)
      return null
    }
  },
  setItem(name, value) {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(name, value)
    } catch (error) {
      console.error(`Failed to persist ${ROADMAP_STORAGE_KEY}.`, error)
    }
  },
  removeItem(name) {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.removeItem(name)
    } catch (error) {
      console.error(`Failed to remove ${ROADMAP_STORAGE_KEY}.`, error)
    }
  },
}

function mutationFailure(errors: Record<string, string>): RoadmapMutationResult {
  return { ok: false, reason: 'invalid', errors }
}

function currentTosEnumValues(): string[] {
  return useEnumStore.getState().valuesByType['tos-2-part']
    .map(normalizeRoadmapTosValue)
    .filter(Boolean)
}

function currentTosEnumVersions(): TosVersionConfig[] {
  return currentTosEnumValues().map(value => {
    const [major, minor] = value.split('.').map(Number)
    return {
      id: value,
      name: formatRoadmapTosValue(value),
      major,
      minor,
      periodStartDate: '',
      periodEndDate: '',
      targets: [],
      createdAt: INITIAL_TIMESTAMP,
      updatedAt: INITIAL_TIMESTAMP,
    }
  })
}

function isDuplicate(
  fields: RoadmapProjectFields,
  plannedProjects: readonly PlannedRoadmapProject[],
  excludedId: string | undefined,
  comparison: RoadmapDuplicateComparison | undefined,
): boolean {
  const comparisonRows = (comparison?.allRows ?? []).filter(row => !(
    excludedId && row.source === 'planned' && row.id === excludedId
  ))
  if (isExactRoadmapDuplicate(fields, plannedProjects, excludedId)) return true
  if (isExactRoadmapDuplicate(fields, comparisonRows)) return true
  return false
}

function versionName(versions: readonly TosVersionConfig[], id: string): string {
  return versions.find(version => version.id === id)?.name ?? formatRoadmapTosValue(id)
}

function createPlannedChangeLog(
  action: 'create' | 'delete',
  project: PlannedRoadmapProject,
  actor: string,
  occurredAt: string,
  versions: readonly TosVersionConfig[],
): RoadmapChangeLog {
  return {
    id: createCollisionResistantId('roadmap-log'),
    projectId: project.id,
    projectDisplayName: buildRoadmapDisplayName(project.projectCode, project.androidVersion, project.productType),
    source: 'planned',
    action,
    actor,
    occurredAt,
    tosVersionName: versionName(versions, project.firstSaleTosVersionId),
    changes: [],
    snapshot: createRoadmapAuditSnapshot(project, versions),
  }
}

function deriveAvailableTosId(major: number, minor: number, versions: readonly TosVersionConfig[]): string {
  const base = `tos-${major}-${minor}`
  if (!versions.some(version => version.id === base)) return base
  return `${base}-${createCollisionResistantId('version').split('-').at(-1)}`
}

function createUniqueRuntimeId(prefix: string, existingIds: ReadonlySet<string>): string {
  const id = createCollisionResistantId(prefix)
  return claimDeterministicId(id, id, new Set(existingIds))
}

export const useRoadmapStore = create<RoadmapStore>()(
  persist(
    (set, get) => ({
      ...createInitialRoadmapMockState(),
      setViewMode: (viewMode: RoadmapViewMode) => {
        if (viewMode === 'table' || viewMode === 'evolution') set(state => ({
          viewMode,
          columnOrder: state.columnOrderByView[viewMode],
          visibleColumns: state.visibleColumnsByView[viewMode],
        }))
      },
      setSelectedTosVersionId: (id: string | null) => {
        const selectableVersions = currentTosEnumVersions()
        if (id === null || selectableVersions.some(version => version.id === id)) {
          set(state => {
            const selectedTosVersionId = repairSelectedTosVersionId(id, selectableVersions)
            return {
              selectedTosVersionId,
              filters: sanitizeRoadmapFilterConditions(
                setRoadmapTosVersionFilter(state.filters, selectedTosVersionId),
                selectableVersions,
              ),
            }
          })
        }
      },
      setBrandFilter: (brand: 'all' | RoadmapBrand) => {
        if (brand === 'all' || ROADMAP_BRANDS.has(brand)) set(state => ({
          brandFilter: brand,
          filters: sanitizeRoadmapFilterConditions(
            setRoadmapQuickFilter(state.filters, 'brand', brand),
            currentTosEnumVersions(),
          ),
        }))
      },
      setProductTypeFilter: (productType: 'all' | RoadmapProductType) => {
        if (productType === 'all' || ROADMAP_PRODUCT_TYPES.has(productType)) set(state => ({
          productTypeFilter: productType,
          filters: sanitizeRoadmapFilterConditions(
            setRoadmapQuickFilter(state.filters, 'productType', productType),
            currentTosEnumVersions(),
          ),
        }))
      },
      setFilters: filters => set(state => {
        const selectableVersions = currentTosEnumVersions()
        const sanitized = sanitizeRoadmapFilterConditions(filters, selectableVersions)
        const tosCondition = sanitized.find(condition => condition.field === 'firstSaleTosVersionId')
        const selectedTosVersionId = tosCondition?.operator === 'equals'
          && Array.isArray(tosCondition.value)
          && tosCondition.value.length === 1
          ? tosCondition.value[0]
          : null
        const brand = getRoadmapQuickFilterValue(sanitized, 'brand')
        const productType = getRoadmapQuickFilterValue(sanitized, 'productType')
        return {
          filters: sanitized,
          selectedTosVersionId,
          brandFilter: ROADMAP_BRANDS.has(brand as RoadmapBrand) ? brand as RoadmapBrand : 'all',
          productTypeFilter: ROADMAP_PRODUCT_TYPES.has(productType as RoadmapProductType)
            ? productType as RoadmapProductType
            : 'all',
        }
      }),
      setColumnSettings: (value: SortableColumnSettingsValue<RoadmapColumnKey>) => set(state => {
        const settings = normalizeRoadmapColumnSettings(state.viewMode, value)
        return {
          columnOrder: settings.order,
          columnOrderByView: {
            ...state.columnOrderByView,
            [state.viewMode]: settings.order,
          },
          visibleColumns: settings.visible,
          visibleColumnsByView: {
            ...state.visibleColumnsByView,
            [state.viewMode]: settings.visible,
          },
        }
      }),
      setVisibleColumns: columns => set(state => {
        const settings = normalizeRoadmapColumnSettings(state.viewMode, {
          order: state.columnOrder,
          visible: columns,
        })
        return {
          columnOrder: settings.order,
          columnOrderByView: {
            ...state.columnOrderByView,
            [state.viewMode]: settings.order,
          },
          visibleColumns: settings.visible,
          visibleColumnsByView: {
            ...state.visibleColumnsByView,
            [state.viewMode]: settings.visible,
          },
        }
      }),
      setSort: sort => set({ sort: sanitizeSort(sort) }),
      setSelectedConflictKey: selectedConflictKey => set({ selectedConflictKey }),
      createPlannedProject: (rawInput, comparison) => {
        const input = normalizeProjectInput(rawInput)
        const errors = validatePlannedProject(input, [], undefined, new Set(currentTosEnumValues()))
        if (!input.actor) errors.actor = '操作人不能为空'
        if (Object.keys(errors).length) return mutationFailure(errors)
        const fields = toProjectFields(input)
        if (isDuplicate(fields, get().plannedProjects, undefined, comparison)) return { ok: false, reason: 'duplicate' }

        const occurredAt = nowIso()
        const project: PlannedRoadmapProject = {
          ...fields,
          id: createCollisionResistantId('planned'),
          status: '待规划',
          createdAt: occurredAt,
          createdBy: input.actor,
          updatedAt: occurredAt,
          updatedBy: input.actor,
        }
        const log = createPlannedChangeLog('create', project, input.actor, occurredAt, get().tosVersions)
        set(state => ({
          plannedProjects: [project, ...state.plannedProjects],
          changeLogs: [log, ...state.changeLogs],
        }))
        return { ok: true }
      },
      updatePlannedProject: (id, rawInput, comparison) => {
        const existing = get().plannedProjects.find(project => project.id === id)
        if (!existing) return { ok: false, reason: 'not-found' }
        const input = normalizeProjectInput(rawInput)
        const allowedTosValues = new Set(currentTosEnumValues())
        allowedTosValues.add(existing.firstSaleTosVersionId)
        const errors = validatePlannedProject(input, [], undefined, allowedTosValues)
        if (!input.actor) errors.actor = '操作人不能为空'
        if (Object.keys(errors).length) return mutationFailure(errors)
        const fields = toProjectFields(input)
        if (isDuplicate(fields, get().plannedProjects, id, comparison)) return { ok: false, reason: 'duplicate' }

        const occurredAt = nowIso()
        const updated: PlannedRoadmapProject = {
          ...existing,
          ...fields,
          createdAt: existing.createdAt,
          createdBy: existing.createdBy,
          updatedAt: occurredAt,
          updatedBy: input.actor,
        }
        const versions = get().tosVersions
        const changes = diffRoadmapProjectFields(existing, updated, versions)
        const log: RoadmapChangeLog | null = changes.length ? {
          id: createCollisionResistantId('roadmap-log'),
          projectId: updated.id,
          projectDisplayName: buildRoadmapDisplayName(updated.projectCode, updated.androidVersion, updated.productType),
          source: 'planned',
          action: 'update',
          actor: input.actor,
          occurredAt,
          tosVersionName: versionName(versions, updated.firstSaleTosVersionId),
          changes,
        } : null
        set(state => ({
          plannedProjects: state.plannedProjects.map(project => project.id === id ? updated : project),
          changeLogs: log ? [log, ...state.changeLogs] : state.changeLogs,
        }))
        return { ok: true }
      },
      deletePlannedProject: (id, actor) => {
        const existing = get().plannedProjects.find(project => project.id === id)
        if (!existing) return { ok: false, reason: 'not-found' }
        const normalizedActor = actor.trim()
        if (!normalizedActor) return mutationFailure({ actor: '操作人不能为空' })
        const occurredAt = nowIso()
        const log = createPlannedChangeLog('delete', existing, normalizedActor, occurredAt, get().tosVersions)
        set(state => ({
          plannedProjects: state.plannedProjects.filter(project => project.id !== id),
          changeLogs: [log, ...state.changeLogs],
        }))
        return { ok: true }
      },
      setTosTargets: (id, targets) => {
        const normalizedId = normalizeRoadmapTosReference(id, get().tosVersions)
        const existing = get().tosVersions.find(version => version.id === normalizedId)
        if (!existing && !currentTosEnumValues().includes(normalizedId)) return { ok: false, reason: 'not-found' }
        const normalizedTargets = normalizeTargets(targets)
        const occurredAt = nowIso()
        set(state => {
          if (existing) return {
            tosVersions: state.tosVersions.map(version => version.id === normalizedId
              ? { ...version, targets: normalizedTargets, updatedAt: occurredAt }
              : version),
          }
          const [major, minor] = normalizedId.split('.').map(Number)
          return {
            tosVersions: sortTosVersions([...state.tosVersions, {
              id: normalizedId,
              name: formatRoadmapTosValue(normalizedId),
              major,
              minor,
              periodStartDate: '',
              periodEndDate: '',
              targets: normalizedTargets,
              createdAt: occurredAt,
              updatedAt: occurredAt,
            }]),
          }
        })
        return { ok: true }
      },
      recordNormalProjectChange: (input: RoadmapNormalChangeInput) => {
        const existingIds = new Set(get().changeLogs.map(log => log.id))
        const requestedId = typeof input.id === 'string' ? input.id.trim() : ''
        const id = requestedId && !existingIds.has(requestedId)
          ? requestedId
          : createUniqueRuntimeId('roadmap-log', existingIds)
        const log: RoadmapChangeLog = {
          ...input,
          id,
          source: 'normal',
          occurredAt: input.occurredAt && isValidIsoTimestamp(input.occurredAt) ? input.occurredAt : nowIso(),
          changes: input.changes ?? [],
        } as RoadmapChangeLog
        if (!isValidChangeLog(log)) return mutationFailure({ changeLog: '变更记录格式无效' })
        set(state => ({ changeLogs: [log, ...state.changeLogs] }))
        return { ok: true }
      },
    }),
    {
      name: 'pms-project-roadmap',
      version: ROADMAP_STORE_VERSION,
      storage: createJSONStorage(() => safeRoadmapStorage),
      migrate: migrateRoadmapState,
      partialize: partializeRoadmapState,
      merge: mergeRoadmapPersistedState,
    },
  ),
)
