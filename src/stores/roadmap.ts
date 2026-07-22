import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import {
  createRoadmapAuditSnapshot,
  diffRoadmapProjectFields,
  ROADMAP_AUDIT_FIELDS,
} from '@/lib/roadmapAudit'
import { compareSemanticTos } from '@/lib/roadmapSorting'
import {
  buildRoadmapDisplayName,
  isExactRoadmapDuplicate,
  normalizeLegacyRoadmapProductType,
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
  type RoadmapFilterOperator,
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

const INITIAL_TIMESTAMP = '2026-01-01T00:00:00.000Z'
const ROADMAP_STORAGE_KEY = 'pms-project-roadmap'

const KNOWN_COLUMN_KEYS = new Set<RoadmapColumnKey>(ROADMAP_COLUMNS.map(column => column.key))
const DEFAULT_VISIBLE_COLUMNS = ROADMAP_COLUMNS
  .filter(column => column.defaultVisible)
  .map(column => column.key)

const FILTER_OPERATORS = new Set<RoadmapFilterOperator>([
  'equals',
  'notEquals',
  'contains',
  'notContains',
  'isEmpty',
  'isNotEmpty',
  'before',
  'after',
])
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
  | 'visibleColumns'
  | 'sort'
>

let fallbackIdCounter = 0

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
    id: `tos-${major}-${minor}`,
    name: `tOS ${major}.${minor}`,
    major,
    minor,
    targets: [],
    createdAt: INITIAL_TIMESTAMP,
    updatedAt: INITIAL_TIMESTAMP,
  }))
}

export function createInitialRoadmapState(): RoadmapStoreState {
  return {
    plannedProjects: [],
    tosVersions: createInitialTosVersions(),
    changeLogs: [],
    viewMode: 'table',
    selectedTosVersionId: 'tos-18-0',
    brandFilter: 'all',
    productTypeFilter: 'all',
    filters: [],
    visibleColumns: [...DEFAULT_VISIBLE_COLUMNS],
    sort: { field: null, direction: null },
    selectedConflictKey: null,
  }
}

function sanitizeVisibleColumns(value: unknown): RoadmapColumnKey[] {
  if (!Array.isArray(value)) return [...DEFAULT_VISIBLE_COLUMNS]
  const visible = [...new Set(value.filter((key): key is RoadmapColumnKey => (
    typeof key === 'string' && KNOWN_COLUMN_KEYS.has(key as RoadmapColumnKey)
  )))]
  return visible.length ? visible : [DEFAULT_VISIBLE_COLUMNS[0]]
}

function sanitizeFilters(value: unknown): RoadmapFilterCondition[] {
  if (!Array.isArray(value)) return []
  const usedIds = new Set<string>()
  return value.flatMap((filter, index) => {
    if (!isRecord(filter)) return []
    if (
      typeof filter.field !== 'string'
      || !KNOWN_COLUMN_KEYS.has(filter.field as RoadmapColumnKey)
      || typeof filter.operator !== 'string'
      || !FILTER_OPERATORS.has(filter.operator as RoadmapFilterOperator)
      || typeof filter.value !== 'string'
    ) return []
    return [{
      id: claimDeterministicId(filter.id, `roadmap-filter-migrated-${index + 1}`, usedIds),
      field: filter.field as RoadmapColumnKey,
      operator: filter.operator as RoadmapFilterOperator,
      value: filter.value,
    }]
  })
}

function sanitizeSort(value: unknown): RoadmapSortState {
  if (!isRecord(value)) return { field: null, direction: null }
  const field = typeof value.field === 'string' && KNOWN_COLUMN_KEYS.has(value.field as RoadmapColumnKey)
    ? value.field as RoadmapColumnKey
    : null
  const direction = value.direction === 'ascend' || value.direction === 'descend' ? value.direction : null
  return field && direction ? { field, direction } : { field: null, direction: null }
}

function migrateTosVersions(value: unknown): TosVersionConfig[] | null {
  if (!Array.isArray(value)) return null
  const versions: TosVersionConfig[] = []
  const usedNames = new Set<string>()
  const usedIds = new Set<string>()

  for (const entry of value) {
    if (!isRecord(entry)) continue
    const fromName = typeof entry.name === 'string' ? normalizeTosVersionName(entry.name) : null
    const fromParts = Number.isSafeInteger(entry.major) && Number(entry.major) >= 0
      && Number.isSafeInteger(entry.minor) && Number(entry.minor) >= 0
      ? normalizeTosVersionName(`tOS ${Number(entry.major)}.${Number(entry.minor)}`)
      : null
    const normalized = fromName ?? fromParts
    if (!normalized || usedNames.has(normalized.name)) continue
    const requestedId = claimDeterministicId(entry.id, `tos-${normalized.major}-${normalized.minor}`, usedIds)
    usedNames.add(normalized.name)
    versions.push({
      id: requestedId,
      ...normalized,
      targets: normalizeTargets(entry.targets),
      createdAt: normalizeTimestamp(entry.createdAt),
      updatedAt: normalizeTimestamp(entry.updatedAt),
    })
  }

  if (value.length > 0 && versions.length === 0) return null
  return sortTosVersions(versions)
}

function resolveMigratedTosId(value: unknown, versions: readonly TosVersionConfig[]): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  const exact = versions.find(version => version.id === trimmed)
  if (exact) return exact.id
  const normalized = normalizeTosVersionName(trimmed)
  return normalized ? versions.find(version => version.name === normalized.name)?.id ?? null : null
}

function trimStringValue<T>(value: T): T {
  return (typeof value === 'string' ? value.trim() : value) as T
}

function normalizeProjectInput(input: PlannedRoadmapProjectMutationInput): PlannedRoadmapProjectMutationInput {
  return {
    ...input,
    projectCode: trimStringValue(input.projectCode),
    productLine: trimStringValue(input.productLine),
    productSeries: trimStringValue(input.productSeries),
    marketName: trimStringValue(input.marketName),
    platform: trimStringValue(input.platform),
    str5Date: trimStringValue(input.str5Date),
    launchDate: trimStringValue(input.launchDate),
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
    launchDate: input.launchDate,
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
    const tosVersionId = resolveMigratedTosId(tosReference, versions)
    if (!productType || !tosVersionId) continue

    const migratedInput = {
      ...entry,
      productType,
      firstSaleTosVersionId: tosVersionId,
      remark: typeof entry.remark === 'string' ? entry.remark : '',
      actor: typeof entry.updatedBy === 'string' ? entry.updatedBy : '系统',
    } as PlannedRoadmapProjectMutationInput
    const errors = validatePlannedProject(migratedInput, projects, undefined, versions)
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

export function migrateRoadmapState(persistedState: unknown, fromVersion: number): RoadmapStoreState {
  void fromVersion
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

  const selectedTosVersionId = tosVersions.length === 0 || persistedState.selectedTosVersionId === null
    ? null
    : resolveMigratedTosId(persistedState.selectedTosVersionId, tosVersions) ?? tosVersions[0].id

  return {
    plannedProjects,
    tosVersions,
    changeLogs,
    viewMode: persistedState.viewMode === 'evolution' ? 'evolution' : 'table',
    selectedTosVersionId,
    brandFilter: persistedState.brandFilter === 'all' || ROADMAP_BRANDS.has(persistedState.brandFilter as RoadmapBrand)
      ? persistedState.brandFilter as 'all' | RoadmapBrand
      : 'all',
    productTypeFilter: persistedState.productTypeFilter === 'all' || ROADMAP_PRODUCT_TYPES.has(persistedState.productTypeFilter as RoadmapProductType)
      ? persistedState.productTypeFilter as 'all' | RoadmapProductType
      : 'all',
    filters: sanitizeFilters(persistedState.filters),
    visibleColumns: sanitizeVisibleColumns(persistedState.visibleColumns),
    sort: sanitizeSort(persistedState.sort),
    selectedConflictKey: null,
  }
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
    visibleColumns: state.visibleColumns,
    sort: state.sort,
  }
}

const safeRoadmapStorage: StateStorage = {
  getItem(name) {
    if (typeof window === 'undefined') return null
    try {
      const stored = window.localStorage.getItem(name)
      if (stored !== null) JSON.parse(stored)
      return stored
    } catch (error) {
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
  return versions.find(version => version.id === id)?.name ?? id
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
    projectDisplayName: project.displayName,
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
      ...createInitialRoadmapState(),
      setViewMode: (viewMode: RoadmapViewMode) => {
        if (viewMode === 'table' || viewMode === 'evolution') set({ viewMode })
      },
      setSelectedTosVersionId: (id: string | null) => {
        if (id === null || get().tosVersions.some(version => version.id === id)) set({ selectedTosVersionId: id })
      },
      setBrandFilter: (brand: 'all' | RoadmapBrand) => {
        if (brand === 'all' || ROADMAP_BRANDS.has(brand)) set({ brandFilter: brand })
      },
      setProductTypeFilter: (productType: 'all' | RoadmapProductType) => {
        if (productType === 'all' || ROADMAP_PRODUCT_TYPES.has(productType)) set({ productTypeFilter: productType })
      },
      setFilters: filters => set({ filters: sanitizeFilters(filters) }),
      setVisibleColumns: columns => set({ visibleColumns: sanitizeVisibleColumns(columns) }),
      setSort: sort => set({ sort: sanitizeSort(sort) }),
      setSelectedConflictKey: selectedConflictKey => set({ selectedConflictKey }),
      createPlannedProject: (rawInput, comparison) => {
        const input = normalizeProjectInput(rawInput)
        const errors = validatePlannedProject(input, [], undefined, get().tosVersions)
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
        const errors = validatePlannedProject(input, [], undefined, get().tosVersions)
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
          projectDisplayName: updated.displayName,
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
      createTosVersion: input => {
        const normalized = normalizeTosVersionName(input.name)
        if (!normalized) return mutationFailure({ name: 'tOS 版本格式无效' })
        if (get().tosVersions.some(version => version.name === normalized.name)) return { ok: false, reason: 'duplicate' }
        const occurredAt = nowIso()
        const version: TosVersionConfig = {
          id: deriveAvailableTosId(normalized.major, normalized.minor, get().tosVersions),
          ...normalized,
          targets: [],
          createdAt: occurredAt,
          updatedAt: occurredAt,
        }
        set(state => {
          const tosVersions = sortTosVersions([...state.tosVersions, version])
          const selectedTosVersionId = state.tosVersions.length === 0
            ? version.id
            : state.selectedTosVersionId === null || state.tosVersions.some(item => item.id === state.selectedTosVersionId)
              ? state.selectedTosVersionId
              : tosVersions[0].id
          return { tosVersions, selectedTosVersionId }
        })
        return { ok: true }
      },
      renameTosVersion: (id, input) => {
        const existing = get().tosVersions.find(version => version.id === id)
        if (!existing) return { ok: false, reason: 'not-found' }
        const normalized = normalizeTosVersionName(input.name)
        if (!normalized) return mutationFailure({ name: 'tOS 版本格式无效' })
        if (get().tosVersions.some(version => version.id !== id && version.name === normalized.name)) return { ok: false, reason: 'duplicate' }
        const updated = { ...existing, ...normalized, updatedAt: nowIso() }
        set(state => ({
          tosVersions: sortTosVersions(state.tosVersions.map(version => version.id === id ? updated : version)),
        }))
        return { ok: true }
      },
      deleteTosVersion: (id, normalReferenceCount) => {
        if (!get().tosVersions.some(version => version.id === id)) return { ok: false, reason: 'not-found' }
        const externalCount = Number.isFinite(normalReferenceCount) ? Math.max(0, Math.trunc(normalReferenceCount)) : 0
        const plannedCount = get().plannedProjects.filter(project => project.firstSaleTosVersionId === id).length
        const referenceCount = plannedCount + externalCount
        if (referenceCount > 0) return { ok: false, reason: 'referenced', referenceCount }
        const tosVersions = sortTosVersions(get().tosVersions.filter(version => version.id !== id))
        set(state => ({
          tosVersions,
          selectedTosVersionId: tosVersions.length === 0
            ? null
            : state.selectedTosVersionId === null
              ? null
              : tosVersions.some(version => version.id === state.selectedTosVersionId)
                ? state.selectedTosVersionId
                : tosVersions[0].id,
        }))
        return { ok: true }
      },
      setTosTargets: (id, targets) => {
        if (!get().tosVersions.some(version => version.id === id)) return { ok: false, reason: 'not-found' }
        const normalizedTargets = normalizeTargets(targets)
        const occurredAt = nowIso()
        set(state => ({
          tosVersions: state.tosVersions.map(version => version.id === id
            ? { ...version, targets: normalizedTargets, updatedAt: occurredAt }
            : version),
        }))
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
      version: 1,
      storage: createJSONStorage(() => safeRoadmapStorage),
      migrate: migrateRoadmapState,
      partialize: partializeRoadmapState,
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...migrateRoadmapState(persistedState, 1),
      }),
    },
  ),
)
