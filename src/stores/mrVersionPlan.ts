import { create } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { createInitialMrVersionPlanState } from '@/data/mrVersionPlanMocks'
import {
  cancelMrTemplateRevision,
  cloneMrTemplateSnapshot,
  createMrTemplateRevision,
  normalizeMrTemplateActivities,
  publishMrTemplateRevision,
  validateMrTemplateForPublish,
} from '@/lib/mrTemplateRules'
import { applyStopRelease, canonicalizeTosMrVersion, reconcileJointMachinePlans } from '@/lib/mrAggregationRules'
import { selectCanonicalTosMrInstances } from '@/lib/mrPlanSourceAdapters'
import { normalizeMrBusinessDate, createTosMrVersionInstance } from '@/lib/mrVersionPlanRules'
import type {
  AddTosInstanceInput,
  JointMachinePlan,
  MrActivityDateMap,
  MrActivityUpdater,
  MrMarketOverride,
  MrBatchLockResult,
  MrMachineRowIdentity,
  MrMachineRowLock,
  MrPermissionResult,
  MrPlanViewMode,
  MrStopReleaseRecord,
  MrTemplateActivity,
  MrTemplateChangeLog,
  MrTemplateVersion,
  MrTransferType,
  ReconcileJointInput,
  ReconcileJointResult,
  StoreStopReleaseInput,
  TosMrVersionInstance,
} from '@/types/mrVersionPlan'

export const MR_VERSION_PLAN_STORAGE_KEY = 'pms-mr-version-plan-store'
export const MR_VERSION_PLAN_STORE_VERSION = 5
const LEGACY_LEVEL3_STORAGE_KEY = 'pms-level3-plan-store'
const TRANSFER_TYPES = new Set<MrTransferType>(['N/A', '1', '2', '3', '4', '5', '6', '7', '8'])
const TEMPLATE_ACTIONS = new Set<MrTemplateChangeLog['action']>([
  'create-revision', 'add', 'rename', 'move', 'delete', 'publish', 'cancel-revision',
])

export interface MrVersionPlanState {
  templateVersions: MrTemplateVersion[]
  currentTemplateVersionId: string
  templateHistory: MrTemplateChangeLog[]
  tosInstancesByProjectId: Record<string, TosMrVersionInstance[]>
  machinePlansByKey: Record<string, JointMachinePlan>
  marketOverridesByKey: Record<string, MrMarketOverride>
  stopReleaseRecords: MrStopReleaseRecord[]
  viewModeByScope: Record<string, MrPlanViewMode>
  machineRowLocks: Record<string, MrMachineRowLock>
}

export interface MrVersionPlanActions {
  createTemplateRevision: (actor: string, permission: MrPermissionResult) => boolean
  updateTemplateActivities: (versionId: string, updater: MrActivityUpdater, actor: string, permission: MrPermissionResult) => boolean
  publishTemplateRevision: (versionId: string, actor: string, permission: MrPermissionResult) => { ok: boolean; errors: string[] }
  cancelTemplateRevision: (versionId: string, actor: string, permission: MrPermissionResult) => boolean
  addTosVersionInstance: (input: AddTosInstanceInput, permission: MrPermissionResult) => boolean
  updateTosDate: (projectId: string, tosVersion: string, activityId: string, value: string, actor: string, permission: MrPermissionResult) => boolean
  reconcileMachinePlans: (input: Omit<ReconcileJointInput, 'tosInstances' | 'persistedPlans' | 'stopRecords'>) => ReconcileJointResult
  updateMachineTransferType: (key: string, value: MrTransferType, actor: string, permission: MrPermissionResult) => boolean
  updateMachineDate: (key: string, activityId: string, value: string, actor: string, permission: MrPermissionResult) => boolean
  lockMachineRows: (rows: readonly MrMachineRowIdentity[], actor: string, permission: MrPermissionResult) => MrBatchLockResult
  unlockMachineRows: (rows: readonly MrMachineRowIdentity[], actor: string, permission: MrPermissionResult) => MrBatchLockResult
  stopRelease: (input: StoreStopReleaseInput, permission: MrPermissionResult) => boolean
  updateMarketDate: (input: {
    projectId: string
    tosVersion: string
    market: string
    mainMarket: string
    activityId: string
    value: string
    mainValue: string
  }, actor: string, permission: MrPermissionResult) => boolean
  setViewMode: (scopeKey: string, mode: MrPlanViewMode) => void
}

export type MrVersionPlanStore = MrVersionPlanState & MrVersionPlanActions

interface StoreFactoryOptions {
  storage?: StateStorage
  initialState?: Partial<MrVersionPlanState>
  now?: () => string
  createId?: (prefix: string) => string
}

const memoryStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
}

const browserStorage: StateStorage = {
  getItem: name => typeof window === 'undefined' ? null : window.localStorage.getItem(name),
  setItem: (name, value) => { if (typeof window !== 'undefined') window.localStorage.setItem(name, value) },
  removeItem: name => { if (typeof window !== 'undefined') window.localStorage.removeItem(name) },
}

function failSafeStorage(storage: StateStorage): StateStorage {
  return {
    getItem: name => {
      try {
        const result = storage.getItem(name)
        return result instanceof Promise ? result.catch(() => null) : result
      } catch {
        return null
      }
    },
    setItem: (name, value) => {
      try {
        const result = storage.setItem(name, value)
        return result instanceof Promise ? result.catch(() => undefined) : result
      } catch {
        return undefined
      }
    },
    removeItem: name => {
      try {
        const result = storage.removeItem(name)
        return result instanceof Promise ? result.catch(() => undefined) : result
      } catch {
        return undefined
      }
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function canonicalDate(value: unknown): string {
  if (typeof value !== 'string') return ''
  const normalized = normalizeMrBusinessDate(value)
  return normalized === value ? normalized : ''
}

function sanitizeDates(value: unknown, allowedIds?: ReadonlySet<string>): MrActivityDateMap {
  if (!isRecord(value)) return {}
  const dates: MrActivityDateMap = {}
  Object.keys(value).sort().forEach(key => {
    if (!key.trim() || (allowedIds && !allowedIds.has(key))) return
    const date = canonicalDate(value[key])
    if (date) dates[key] = date
  })
  return dates
}

function sanitizeActivities(value: unknown): MrTemplateActivity[] {
  if (!Array.isArray(value)) return []
  const rows: MrTemplateActivity[] = []
  const ids = new Set<string>()
  value.forEach(candidate => {
    if (!isRecord(candidate)) return
    const id = text(candidate.id)
    const activityName = text(candidate.activityName)
    if (!id || !activityName || ids.has(id)) return
    ids.add(id)
    rows.push({
      id,
      parentId: candidate.parentId === null ? null : text(candidate.parentId),
      order: Number.isFinite(candidate.order) ? Number(candidate.order) : rows.length,
      activityName,
      ...(candidate.source === 'custom' || candidate.source === 'template' ? { source: candidate.source } : {}),
    })
  })
  const parentIds = new Set(rows.filter(row => row.parentId === null).map(row => row.id))
  const twoLevelRows = rows.filter(row => row.parentId === null || (!!row.parentId && parentIds.has(row.parentId)))
  try {
    return normalizeMrTemplateActivities(twoLevelRows)
  } catch {
    return []
  }
}

function cloneTemplateVersion(version: MrTemplateVersion): MrTemplateVersion {
  return { ...version, activities: cloneMrTemplateSnapshot(version.activities) }
}

function sanitizeTemplateVersions(value: unknown): MrTemplateVersion[] {
  if (!Array.isArray(value)) return []
  const candidates: Array<{ version: MrTemplateVersion; number: number; index: number }> = []
  const ids = new Set<string>()
  const versionNumbers = new Set<number>()
  value.forEach((candidate, index) => {
    if (!isRecord(candidate)) return
    const id = text(candidate.id)
    const versionNo = text(candidate.versionNo)
    const status = candidate.status === '已发布' || candidate.status === '修订中' ? candidate.status : null
    const createdBy = text(candidate.createdBy)
    const createdAt = text(candidate.createdAt)
    const activities = sanitizeActivities(candidate.activities)
    const match = /^V([1-9]\d*)$/.exec(versionNo)
    const versionNumber = match ? Number(match[1]) : Number.NaN
    if (!id || ids.has(id) || !Number.isSafeInteger(versionNumber) || versionNumber <= 0 || versionNumbers.has(versionNumber) || !status || !createdBy || !createdAt || activities.length === 0) return
    ids.add(id)
    versionNumbers.add(versionNumber)
    candidates.push({
      index,
      number: versionNumber,
      version: {
        id, versionNo, status, activities, createdBy, createdAt,
        ...(text(candidate.publishedAt) ? { publishedAt: text(candidate.publishedAt) } : {}),
      },
    })
  })
  const published = candidates.filter(candidate => candidate.version.status === '已发布')
    .sort((left, right) => left.number - right.number || left.index - right.index)
  if (published.length === 0) return []
  const latestPublishedNumber = published.at(-1)!.number
  const draft = candidates.filter(candidate => candidate.version.status === '修订中')
    .filter(candidate => candidate.number > latestPublishedNumber)
    .sort((left, right) => right.number - left.number || left.index - right.index)[0]
  return [...published.map(candidate => candidate.version), ...(draft ? [draft.version] : [])]
}

function sanitizeTemplateHistory(value: unknown): MrTemplateChangeLog[] {
  if (!Array.isArray(value)) return []
  const ids = new Set<string>()
  return value.flatMap(candidate => {
    if (!isRecord(candidate)) return []
    const id = text(candidate.id)
    const versionId = text(candidate.versionId)
    const action = candidate.action as MrTemplateChangeLog['action']
    const actor = text(candidate.actor)
    const occurredAt = text(candidate.occurredAt)
    if (!id || ids.has(id) || !versionId || !TEMPLATE_ACTIONS.has(action) || !actor || !occurredAt) return []
    ids.add(id)
    return [{
      id, versionId, action, actor, occurredAt,
      ...(text(candidate.activityId) ? { activityId: text(candidate.activityId) } : {}),
      ...(text(candidate.activityName) ? { activityName: text(candidate.activityName) } : {}),
      ...(typeof candidate.before === 'string' ? { before: candidate.before } : {}),
      ...(typeof candidate.after === 'string' ? { after: candidate.after } : {}),
    }]
  })
}

function sanitizeTosInstances(value: unknown): Record<string, TosMrVersionInstance[]> {
  if (!isRecord(value)) return {}
  const result: Record<string, TosMrVersionInstance[]> = {}
  Object.keys(value).sort().forEach(sourceProjectId => {
    const projectId = sourceProjectId.trim()
    const candidates = value[sourceProjectId]
    if (!projectId || !Array.isArray(candidates)) return
    const instances: TosMrVersionInstance[] = []
    const versions = new Set<string>()
    candidates.forEach(candidate => {
      if (!isRecord(candidate) || text(candidate.projectId) !== projectId) return
      const tosVersion = canonicalizeTosMrVersion(text(candidate.tosVersion))
      const templateVersionId = text(candidate.templateVersionId)
      const createdBy = text(candidate.createdBy)
      const createdAt = text(candidate.createdAt)
      const updatedBy = text(candidate.updatedBy)
      const updatedAt = text(candidate.updatedAt)
      const activities = sanitizeActivities(candidate.activities)
      if (!tosVersion || versions.has(tosVersion) || !templateVersionId || !createdBy || !createdAt || !updatedBy || !updatedAt || activities.length === 0) return
      versions.add(tosVersion)
      const childIds = new Set(activities.filter(activity => activity.parentId !== null).map(activity => activity.id))
      instances.push({ projectId, tosVersion, templateVersionId, activities, dates: sanitizeDates(candidate.dates, childIds), createdBy, createdAt, updatedBy, updatedAt })
    })
    if (instances.length) result[projectId] = instances
  })
  return result
}

function buildTosChildIds(instancesByProjectId: Readonly<Record<string, TosMrVersionInstance[]>>): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>()
  Object.values(instancesByProjectId).flat().forEach(instance => {
    result.set(`${instance.projectId}::${instance.tosVersion}`, new Set(
      instance.activities.filter(activity => activity.parentId !== null).map(activity => activity.id),
    ))
  })
  return result
}

function sanitizeMachinePlans(
  value: unknown,
  tosChildIds: ReadonlyMap<string, ReadonlySet<string>>,
): Record<string, JointMachinePlan> {
  if (!isRecord(value)) return {}
  const result: Record<string, JointMachinePlan> = {}
  Object.keys(value).sort().forEach(sourceKey => {
    const candidate = value[sourceKey]
    if (!sourceKey.trim() || !isRecord(candidate)) return
    const projectId = text(candidate.projectId)
    const tosProjectId = text(candidate.tosProjectId)
    const tosVersion = canonicalizeTosMrVersion(text(candidate.tosVersion))
    const transferType = candidate.transferType as MrTransferType
    const updatedBy = text(candidate.updatedBy)
    const updatedAt = text(candidate.updatedAt)
    const childIds = tosVersion ? tosChildIds.get(`${tosProjectId}::${tosVersion}`) : undefined
    if (!projectId || !tosProjectId || !tosVersion || !childIds || !TRANSFER_TYPES.has(transferType) || !updatedBy || !updatedAt) return
    const key = `${projectId}::${tosVersion}`
    if (!result[key]) result[key] = { projectId, tosProjectId, tosVersion, transferType, dates: transferType === 'N/A' ? {} : sanitizeDates(candidate.dates, childIds), updatedBy, updatedAt }
  })
  return result
}

function sanitizeMarketOverrides(
  value: unknown,
  plans: Readonly<Record<string, JointMachinePlan>>,
  tosChildIds: ReadonlyMap<string, ReadonlySet<string>>,
): Record<string, MrMarketOverride> {
  if (!isRecord(value)) return {}
  const result: Record<string, MrMarketOverride> = {}
  Object.keys(value).sort().forEach(sourceKey => {
    const candidate = value[sourceKey]
    if (!sourceKey.trim() || !isRecord(candidate)) return
    const projectId = text(candidate.projectId)
    const tosVersion = canonicalizeTosMrVersion(text(candidate.tosVersion))
    const market = text(candidate.market)
    const mainMarket = text(candidate.mainMarket)
    if (!projectId || !tosVersion || !market || !mainMarket || market === mainMarket) return
    const planKey = `${projectId}::${tosVersion}`
    const plan = plans[planKey]
    if (!plan) return
    const childIds = tosChildIds.get(`${plan.tosProjectId}::${plan.tosVersion}`)
    if (!childIds) return
    const dates = sanitizeDates(candidate.dates, childIds)
    if (Object.keys(dates).length === 0) return
    result[`${planKey}::${market}`] = { projectId, tosVersion, market, mainMarket, dates }
  })
  return result
}

function sanitizeStopRecords(value: unknown): MrStopReleaseRecord[] {
  if (!Array.isArray(value)) return []
  const ids = new Set<string>()
  const projectIds = new Set<string>()
  return value.flatMap(candidate => {
    if (!isRecord(candidate)) return []
    const id = text(candidate.id)
    const projectId = text(candidate.projectId)
    const projectName = text(candidate.projectName)
    const stopDate = canonicalDate(candidate.stopDate)
    const operator = text(candidate.operator)
    const operatedAt = text(candidate.operatedAt)
    if (!id || ids.has(id) || !projectId || projectIds.has(projectId) || !projectName || !stopDate || !operator || !operatedAt) return []
    ids.add(id)
    projectIds.add(projectId)
    return [{ id, projectId, projectName, stopDate, operator, operatedAt }]
  })
}

function sanitizeViewModes(value: unknown): Record<string, MrPlanViewMode> {
  if (!isRecord(value)) return {}
  const result: Record<string, MrPlanViewMode> = {}
  Object.keys(value).sort().forEach(sourceKey => {
    const key = sourceKey.trim()
    const mode = value[sourceKey]
    if (key && (mode === 'vertical' || mode === 'horizontal')) result[key] = mode
  })
  return result
}

export function makeMrMachineRowLockKey(row: Pick<MrMachineRowIdentity, 'projectId' | 'tosProjectId' | 'tosVersion'>): string {
  const projectId = text(row.projectId)
  const tosProjectId = text(row.tosProjectId)
  const tosVersion = canonicalizeTosMrVersion(text(row.tosVersion))
  return projectId && tosProjectId && tosVersion ? `${projectId}::${tosProjectId}::${tosVersion}` : ''
}

function sanitizeMachineRowLocks(
  value: unknown,
  plans: Readonly<Record<string, JointMachinePlan>>,
): Record<string, MrMachineRowLock> {
  if (!isRecord(value)) return {}
  const result: Record<string, MrMachineRowLock> = {}
  Object.values(value).forEach(candidate => {
    if (!isRecord(candidate)) return
    const projectId = text(candidate.projectId)
    const tosProjectId = text(candidate.tosProjectId)
    const tosVersion = canonicalizeTosMrVersion(text(candidate.tosVersion))
    const lockedBy = text(candidate.lockedBy)
    const lockedAt = text(candidate.lockedAt)
    const key = makeMrMachineRowLockKey({ projectId, tosProjectId, tosVersion: tosVersion ?? '' })
    const plan = plans[`${projectId}::${tosVersion}`]
    if (!key || !lockedBy || !lockedAt || !plan || plan.tosProjectId !== tosProjectId || result[key]) return
    result[key] = { key, projectId, tosProjectId, tosVersion: tosVersion!, lockedBy, lockedAt }
  })
  return result
}

function initialMrVersionPlanState(): MrVersionPlanState {
  return createInitialMrVersionPlanState()
}

function mergeTosInstancesByStableKey(
  standard: Readonly<Record<string, TosMrVersionInstance[]>>,
  persisted: Readonly<Record<string, TosMrVersionInstance[]>>,
): Record<string, TosMrVersionInstance[]> {
  return Object.fromEntries(
    [...new Set([...Object.keys(standard), ...Object.keys(persisted)])].map(projectId => {
      const byVersion = new Map<string, TosMrVersionInstance>()
      for (const instance of [...(standard[projectId] ?? []), ...(persisted[projectId] ?? [])]) {
        byVersion.set(instance.tosVersion, {
          ...instance,
          activities: cloneMrTemplateSnapshot(instance.activities),
          dates: { ...instance.dates },
        })
      }
      return [projectId, [...byVersion.values()]]
    }),
  )
}

export function migrateMrVersionPlanState(persistedState: unknown, _fromVersion: number): MrVersionPlanState {
  const fallback = initialMrVersionPlanState()
  if (!isRecord(persistedState)) return fallback
  const shouldMergeStandardSeeds = _fromVersion >= 1 && _fromVersion < MR_VERSION_PLAN_STORE_VERSION
  const templateVersions = sanitizeTemplateVersions(persistedState.templateVersions)
  const safeTemplateVersions = templateVersions.length ? templateVersions : fallback.templateVersions
  const draft = safeTemplateVersions.find(version => version.status === '修订中')
  const latestPublished = safeTemplateVersions.filter(version => version.status === '已发布').at(-1)!
  const persistedCurrentId = text(persistedState.currentTemplateVersionId)
  const currentTemplateVersionId = safeTemplateVersions.some(version => version.id === persistedCurrentId)
    ? persistedCurrentId
    : draft?.id ?? latestPublished.id
  const sanitizedTosInstances = sanitizeTosInstances(persistedState.tosInstancesByProjectId)
  const tosInstancesByProjectId = shouldMergeStandardSeeds
    ? mergeTosInstancesByStableKey(fallback.tosInstancesByProjectId, sanitizedTosInstances)
    : sanitizedTosInstances
  const tosChildIds = buildTosChildIds(tosInstancesByProjectId)
  const machinePlansByKey = sanitizeMachinePlans(persistedState.machinePlansByKey, tosChildIds)
  const migrated: MrVersionPlanState = {
    templateVersions: safeTemplateVersions.map(cloneTemplateVersion),
    currentTemplateVersionId,
    templateHistory: sanitizeTemplateHistory(persistedState.templateHistory),
    tosInstancesByProjectId,
    machinePlansByKey,
    marketOverridesByKey: sanitizeMarketOverrides(persistedState.marketOverridesByKey, machinePlansByKey, tosChildIds),
    stopReleaseRecords: sanitizeStopRecords(persistedState.stopReleaseRecords),
    viewModeByScope: sanitizeViewModes(persistedState.viewModeByScope),
    machineRowLocks: sanitizeMachineRowLocks(persistedState.machineRowLocks, machinePlansByKey),
  }
  if (!shouldMergeStandardSeeds) return migrated

  const mergedTosInstancesByProjectId = tosInstancesByProjectId
  const mergedStopRecords = [...new Map([
    ...fallback.stopReleaseRecords.map(record => [record.projectId, record] as const),
    ...migrated.stopReleaseRecords.map(record => [record.projectId, record] as const),
  ]).values()]
  const mergedPlansBeforeStops = {
    ...cloneMachinePlans(fallback.machinePlansByKey),
    ...cloneMachinePlans(migrated.machinePlansByKey),
  }
  const stopped = mergedStopRecords.reduce((state, record) => applyStopRelease({
    persistedPlans: state.persistedPlans,
    tosInstances: Object.values(mergedTosInstancesByProjectId).flat(),
    stopRecords: state.stopRecords,
    record,
  }), {
    persistedPlans: mergedPlansBeforeStops,
    stopRecords: [] as MrStopReleaseRecord[],
    removedPlanKeys: [] as string[],
  })
  const mergedMarketOverrides = Object.fromEntries(Object.entries({
    ...fallback.marketOverridesByKey,
    ...migrated.marketOverridesByKey,
  }).filter(([, override]) => Boolean(stopped.persistedPlans[`${override.projectId}::${override.tosVersion}`])))
  const mergedMachineRowLocks = {
    ...sanitizeMachineRowLocks(fallback.machineRowLocks, stopped.persistedPlans),
    ...sanitizeMachineRowLocks(migrated.machineRowLocks, stopped.persistedPlans),
  }

  return {
    ...migrated,
    tosInstancesByProjectId: mergedTosInstancesByProjectId,
    machinePlansByKey: stopped.persistedPlans,
    marketOverridesByKey: mergedMarketOverrides,
    stopReleaseRecords: stopped.stopRecords,
    machineRowLocks: mergedMachineRowLocks,
  }
}

export function partializeMrVersionPlanState(state: MrVersionPlanStore): MrVersionPlanState {
  return migrateMrVersionPlanState({
    templateVersions: state.templateVersions,
    currentTemplateVersionId: state.currentTemplateVersionId,
    templateHistory: state.templateHistory,
    tosInstancesByProjectId: state.tosInstancesByProjectId,
    machinePlansByKey: state.machinePlansByKey,
    marketOverridesByKey: state.marketOverridesByKey,
    stopReleaseRecords: state.stopReleaseRecords,
    viewModeByScope: state.viewModeByScope,
    machineRowLocks: state.machineRowLocks,
  }, MR_VERSION_PLAN_STORE_VERSION)
}

function canAccessProject(permission: MrPermissionResult, capability: boolean, projectId: string, scope: 'tos' | 'machine'): boolean {
  if (!capability) return false
  if (permission.canEditTemplate) return true
  const ids = scope === 'tos' ? permission.tosProjectIds : permission.machineProjectIds
  return Array.isArray(ids) && ids.map(text).includes(projectId)
}

function canManageLock(permission: MrPermissionResult, tosProjectId: string): boolean {
  return permission.canEditTemplate === true
    || (permission.canManageMachineLocks === true && permission.tosProjectIds?.map(text).includes(tosProjectId) === true)
}

function canEditMachinePlan(state: MrVersionPlanState, plan: JointMachinePlan, permission: MrPermissionResult): boolean {
  const lockKey = makeMrMachineRowLockKey(plan)
  if (lockKey && state.machineRowLocks[lockKey]) return canManageLock(permission, plan.tosProjectId)
  return canAccessProject(permission, permission.canEditMachine, plan.projectId, 'machine')
    || canManageLock(permission, plan.tosProjectId)
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function cloneMachinePlans(plans: Readonly<Record<string, JointMachinePlan>>): Record<string, JointMachinePlan> {
  return Object.fromEntries(Object.entries(plans).map(([key, plan]) => [key, { ...plan, dates: { ...plan.dates } }]))
}

function hasChildActivity(state: MrVersionPlanState, plan: JointMachinePlan, activityId: string): boolean {
  const version = canonicalizeTosMrVersion(plan.tosVersion)
  if (!version) return false
  const instance = (state.tosInstancesByProjectId[plan.tosProjectId] ?? [])
    .find(item => canonicalizeTosMrVersion(item.tosVersion) === version)
  return !!instance?.activities.some(activity => activity.id === activityId && activity.parentId !== null)
}

function latestPublishedTemplate(versions: readonly MrTemplateVersion[]): MrTemplateVersion | undefined {
  return versions.filter(version => version.status === '已发布').sort((left, right) => {
    const leftNumber = Number(left.versionNo.slice(1))
    const rightNumber = Number(right.versionNo.slice(1))
    return rightNumber - leftNumber
  })[0]
}

function createStoreCreator(options: StoreFactoryOptions = {}) {
  const storage = options.storage ?? browserStorage
  const clock = options.now ?? (() => new Date().toISOString())
  const idFactory = options.createId ?? (prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`)
  const seeded = migrateMrVersionPlanState({ ...initialMrVersionPlanState(), ...options.initialState }, MR_VERSION_PLAN_STORE_VERSION)
  const allocateLogIds = (history: readonly MrTemplateChangeLog[], count: number): string[] => {
    const used = new Set(history.map(item => item.id))
    return Array.from({ length: count }, () => {
      const base = text(idFactory('mr-template-log')) || 'mr-template-log'
      let candidate = base
      let suffix = 2
      while (used.has(candidate)) candidate = `${base}-${suffix++}`
      used.add(candidate)
      return candidate
    })
  }

  return persist<MrVersionPlanStore, [], [], MrVersionPlanState>((set, get) => ({
    ...seeded,
    createTemplateRevision: (actor, permission) => {
      const normalizedActor = text(actor)
      if (!permission.canEditTemplate || !normalizedActor) return false
      try {
        const now = clock()
        const versions = createMrTemplateRevision(get().templateVersions, normalizedActor, now)
        const draft = versions.find(version => version.status === '修订中')!
        set(state => ({
          templateVersions: versions,
          currentTemplateVersionId: draft.id,
          templateHistory: [...state.templateHistory, {
            id: allocateLogIds(state.templateHistory, 1)[0], versionId: draft.id, action: 'create-revision', actor: normalizedActor, occurredAt: now,
          }],
        }))
        return true
      } catch {
        return false
      }
    },
    updateTemplateActivities: (versionId, updater, actor, permission) => {
      const normalizedActor = text(actor)
      if (!permission.canEditTemplate || !normalizedActor) return false
      const draft = get().templateVersions.find(version => version.id === versionId && version.status === '修订中')
      if (!draft) return false
      try {
        const previous = cloneMrTemplateSnapshot(draft.activities)
        const candidate = typeof updater === 'function' ? updater(cloneMrTemplateSnapshot(previous)) : updater
        const next = normalizeMrTemplateActivities(candidate.map(activity => ({ ...activity, activityName: activity.activityName.trim() })))
        if (sameJson(previous, next)) return true
        const previousById = new Map(previous.map(activity => [activity.id, activity]))
        const nextById = new Map(next.map(activity => [activity.id, activity]))
        const changes: Array<Pick<MrTemplateChangeLog, 'action' | 'activityId' | 'activityName' | 'before' | 'after'>> = []
        previous.forEach(activity => {
          const replacement = nextById.get(activity.id)
          if (!replacement) changes.push({ action: 'delete', activityId: activity.id, activityName: activity.activityName, before: activity.activityName })
          else if (replacement.activityName !== activity.activityName) changes.push({ action: 'rename', activityId: activity.id, activityName: replacement.activityName, before: activity.activityName, after: replacement.activityName })
          else if (replacement.order !== activity.order || replacement.parentId !== activity.parentId) changes.push({ action: 'move', activityId: activity.id, activityName: replacement.activityName })
        })
        next.forEach(activity => { if (!previousById.has(activity.id)) changes.push({ action: 'add', activityId: activity.id, activityName: activity.activityName, after: activity.activityName }) })
        const now = clock()
        set(state => {
          const logIds = allocateLogIds(state.templateHistory, changes.length)
          return {
            templateVersions: state.templateVersions.map(version => version.id === versionId ? { ...version, activities: cloneMrTemplateSnapshot(next) } : cloneTemplateVersion(version)),
            templateHistory: [...state.templateHistory, ...changes.map((change, index) => ({
              id: logIds[index], versionId, actor: normalizedActor, occurredAt: now, ...change,
            }))],
          }
        })
        return true
      } catch {
        return false
      }
    },
    publishTemplateRevision: (versionId, actor, permission) => {
      if (!permission.canEditTemplate) return { ok: false, errors: ['无权发布模板修订'] }
      const draft = get().templateVersions.find(version => version.id === versionId)
      if (!draft || draft.status !== '修订中') return { ok: false, errors: ['修订版本不存在'] }
      const errors = validateMrTemplateForPublish(draft.activities)
      if (errors.length) return { ok: false, errors }
      try {
        const normalizedActor = text(actor)
        if (!normalizedActor) return { ok: false, errors: ['操作人不能为空'] }
        const now = clock()
        const versions = publishMrTemplateRevision(get().templateVersions, versionId, normalizedActor, now)
        set(state => ({
          templateVersions: versions,
          currentTemplateVersionId: versionId,
          templateHistory: [...state.templateHistory, {
            id: allocateLogIds(state.templateHistory, 1)[0], versionId, action: 'publish', actor: normalizedActor, occurredAt: now,
          }],
        }))
        return { ok: true, errors: [] }
      } catch (error) {
        return { ok: false, errors: [error instanceof Error ? error.message : '发布失败'] }
      }
    },
    cancelTemplateRevision: (versionId, actor, permission) => {
      const normalizedActor = text(actor)
      if (!permission.canEditTemplate || !normalizedActor) return false
      const draft = get().templateVersions.find(version => version.id === versionId && version.status === '修订中')
      if (!draft) return false
      try {
        const now = clock()
        const versions = cancelMrTemplateRevision(get().templateVersions, versionId)
        const published = latestPublishedTemplate(versions)
        set(state => ({
          templateVersions: versions,
          currentTemplateVersionId: published?.id ?? '',
          templateHistory: [...state.templateHistory, {
            id: allocateLogIds(state.templateHistory, 1)[0], versionId, action: 'cancel-revision', actor: normalizedActor, occurredAt: now,
          }],
        }))
        return true
      } catch {
        return false
      }
    },
    addTosVersionInstance: (input, permission) => {
      const projectId = text(input.projectId)
      const tosVersion = canonicalizeTosMrVersion(text(input.tosVersion))
      if (!projectId || !tosVersion || !canAccessProject(permission, permission.canEditTos, projectId, 'tos')) return false
      if ((get().tosInstancesByProjectId[projectId] ?? []).some(instance => canonicalizeTosMrVersion(instance.tosVersion) === tosVersion)) return false
      const templateVersion = latestPublishedTemplate(get().templateVersions)
      if (!templateVersion) return false
      try {
        const instance = createTosMrVersionInstance({ ...input, projectId, tosVersion, templateVersion })
        set(state => ({
          tosInstancesByProjectId: {
            ...state.tosInstancesByProjectId,
            [projectId]: [...(state.tosInstancesByProjectId[projectId] ?? []).map(item => ({ ...item, activities: cloneMrTemplateSnapshot(item.activities), dates: { ...item.dates } })), instance],
          },
        }))
        return true
      } catch {
        return false
      }
    },
    updateTosDate: (projectIdInput, tosVersionInput, activityIdInput, value, actor, permission) => {
      const projectId = text(projectIdInput)
      const tosVersion = canonicalizeTosMrVersion(text(tosVersionInput))
      const activityId = text(activityIdInput)
      const normalizedActor = text(actor)
      if (!projectId || !tosVersion || !activityId || !normalizedActor || !canAccessProject(permission, permission.canEditTos, projectId, 'tos')) return false
      if (value !== '' && canonicalDate(value) !== value) return false
      const instances = get().tosInstancesByProjectId[projectId] ?? []
      const instance = instances.find(item => canonicalizeTosMrVersion(item.tosVersion) === tosVersion)
      const activity = instance?.activities.find(item => item.id === activityId)
      if (!instance || !activity || activity.parentId === null) return false
      const now = clock()
      set(state => ({
        tosInstancesByProjectId: {
          ...state.tosInstancesByProjectId,
          [projectId]: instances.map(item => item === instance ? {
            ...item, dates: { ...item.dates, [activityId]: value }, updatedBy: normalizedActor, updatedAt: now,
          } : { ...item, activities: cloneMrTemplateSnapshot(item.activities), dates: { ...item.dates } }),
        },
      }))
      return true
    },
    reconcileMachinePlans: input => {
      const state = get()
      const tosInstances = selectCanonicalTosMrInstances(state.tosInstancesByProjectId)
      const result = reconcileJointMachinePlans({
        ...input,
        tosInstances,
        persistedPlans: state.machinePlansByKey,
        stopRecords: state.stopReleaseRecords,
      })
      const machinePlansByKey = cloneMachinePlans(result.persistedPlans)
      const retainedPlanKeys = new Set(Object.keys(result.persistedPlans))
      const marketOverridesByKey = Object.fromEntries(Object.entries(state.marketOverridesByKey)
        .filter(([, override]) => retainedPlanKeys.has(`${override.projectId}::${override.tosVersion}`))
        .map(([key, override]) => [key, { ...override, dates: { ...override.dates } }]))
      const machineRowLocks = sanitizeMachineRowLocks(state.machineRowLocks, machinePlansByKey)
      if (!sameJson(state.machinePlansByKey, result.persistedPlans) || !sameJson(state.marketOverridesByKey, marketOverridesByKey) || !sameJson(state.machineRowLocks, machineRowLocks)) {
        set({ machinePlansByKey, marketOverridesByKey, machineRowLocks })
      }
      return result
    },
    updateMachineTransferType: (keyInput, value, actor, permission) => {
      const key = text(keyInput)
      const plan = get().machinePlansByKey[key]
      const normalizedActor = text(actor)
      if (!plan || !TRANSFER_TYPES.has(value) || !normalizedActor || !canEditMachinePlan(get(), plan, permission)) return false
      const now = clock()
      set(state => ({ machinePlansByKey: {
        ...state.machinePlansByKey,
        [key]: { ...plan, transferType: value, dates: value === 'N/A' ? {} : { ...plan.dates }, updatedBy: normalizedActor, updatedAt: now },
      } }))
      return true
    },
    updateMachineDate: (keyInput, activityIdInput, value, actor, permission) => {
      const key = text(keyInput)
      const activityId = text(activityIdInput)
      const plan = get().machinePlansByKey[key]
      const normalizedActor = text(actor)
      if (!plan || plan.transferType === 'N/A' || !activityId || !normalizedActor || !canEditMachinePlan(get(), plan, permission)) return false
      if (!hasChildActivity(get(), plan, activityId)) return false
      if (value !== '' && canonicalDate(value) !== value) return false
      const now = clock()
      set(state => ({ machinePlansByKey: {
        ...state.machinePlansByKey,
        [key]: { ...plan, dates: { ...plan.dates, [activityId]: value }, updatedBy: normalizedActor, updatedAt: now },
      } }))
      return true
    },
    lockMachineRows: (rows, actor, permission) => {
      const normalizedActor = text(actor)
      if (!normalizedActor) return { processed: 0, skipped: rows.length }
      const now = clock()
      let processed = 0
      let skipped = 0
      set(state => {
        const machineRowLocks = { ...state.machineRowLocks }
        rows.forEach(row => {
          const projectId = text(row.projectId)
          const tosProjectId = text(row.tosProjectId)
          const tosVersion = canonicalizeTosMrVersion(text(row.tosVersion))
          const plan = state.machinePlansByKey[`${projectId}::${tosVersion}`]
          const key = makeMrMachineRowLockKey({ projectId, tosProjectId, tosVersion: tosVersion ?? '' })
          if (!key || !plan || plan.tosProjectId !== tosProjectId || !canManageLock(permission, tosProjectId)) {
            skipped += 1
            return
          }
          processed += 1
          if (!machineRowLocks[key]) machineRowLocks[key] = { key, projectId, tosProjectId, tosVersion: tosVersion!, lockedBy: normalizedActor, lockedAt: now }
        })
        return { machineRowLocks }
      })
      return { processed, skipped }
    },
    unlockMachineRows: (rows, actor, permission) => {
      const normalizedActor = text(actor)
      if (!normalizedActor) return { processed: 0, skipped: rows.length }
      let processed = 0
      let skipped = 0
      set(state => {
        const machineRowLocks = { ...state.machineRowLocks }
        rows.forEach(row => {
          const projectId = text(row.projectId)
          const tosProjectId = text(row.tosProjectId)
          const tosVersion = canonicalizeTosMrVersion(text(row.tosVersion))
          const plan = state.machinePlansByKey[`${projectId}::${tosVersion}`]
          const key = makeMrMachineRowLockKey({ projectId, tosProjectId, tosVersion: tosVersion ?? '' })
          if (!key || !plan || plan.tosProjectId !== tosProjectId || !canManageLock(permission, tosProjectId)) {
            skipped += 1
            return
          }
          processed += 1
          delete machineRowLocks[key]
        })
        return { machineRowLocks }
      })
      return { processed, skipped }
    },
    stopRelease: (input, permission) => {
      const projectId = text(input.projectId)
      if (!projectId || !canAccessProject(permission, permission.canStopRelease, projectId, 'machine')) return false
      const state = get()
      if (state.stopReleaseRecords.some(record => record.projectId === projectId)) return false
      if (!Object.values(state.machinePlansByKey).some(plan => plan.projectId === projectId)) return false
      try {
        const result = applyStopRelease({
          persistedPlans: state.machinePlansByKey,
          tosInstances: Object.values(state.tosInstancesByProjectId).flat(),
          stopRecords: state.stopReleaseRecords,
          record: { ...input },
        })
        if (result.stopRecords.length === state.stopReleaseRecords.length) return false
        const removed = new Set(result.removedPlanKeys)
        const marketOverridesByKey = Object.fromEntries(Object.entries(state.marketOverridesByKey)
          .filter(([, override]) => !removed.has(`${override.projectId}::${override.tosVersion}`))
          .map(([key, override]) => [key, { ...override, dates: { ...override.dates } }]))
        set({ machinePlansByKey: result.persistedPlans, stopReleaseRecords: result.stopRecords, marketOverridesByKey })
        return true
      } catch {
        return false
      }
    },
    updateMarketDate: (input, actor, permission) => {
      const projectId = text(input.projectId)
      const tosVersion = canonicalizeTosMrVersion(text(input.tosVersion))
      const market = text(input.market)
      const mainMarket = text(input.mainMarket)
      const activityId = text(input.activityId)
      const normalizedActor = text(actor)
      if (!projectId || !tosVersion || !market || !mainMarket || market === mainMarket || !activityId || !normalizedActor) return false
      if (!canAccessProject(permission, permission.canEditMarket, projectId, 'machine')) return false
      if (input.value !== '' && canonicalDate(input.value) !== input.value) return false
      const planKey = `${projectId}::${tosVersion}`
      const plan = get().machinePlansByKey[planKey]
      if (!plan || !hasChildActivity(get(), plan, activityId)) return false
      if (input.value !== '' && !canonicalDate(plan.dates[activityId])) return false
      const key = `${planKey}::${market}`
      if (input.value === '' && !get().marketOverridesByKey[key]?.dates[activityId]) return false
      set(state => {
        const previous = state.marketOverridesByKey[key]
        const dates = { ...(previous?.dates ?? {}) }
        if (input.value) dates[activityId] = input.value
        else delete dates[activityId]
        if (Object.keys(dates).length === 0) {
          const marketOverridesByKey = { ...state.marketOverridesByKey }
          delete marketOverridesByKey[key]
          return { marketOverridesByKey }
        }
        return { marketOverridesByKey: {
          ...state.marketOverridesByKey,
          [key]: { projectId, tosVersion, market, mainMarket, dates },
        } }
      })
      return true
    },
    setViewMode: (scopeKeyInput, mode) => {
      const scopeKey = text(scopeKeyInput)
      if (!scopeKey || (mode !== 'vertical' && mode !== 'horizontal')) return
      if (get().viewModeByScope[scopeKey] === mode) return
      set(state => ({ viewModeByScope: { ...state.viewModeByScope, [scopeKey]: mode } }))
    },
  }), {
    name: MR_VERSION_PLAN_STORAGE_KEY,
    version: MR_VERSION_PLAN_STORE_VERSION,
    storage: createJSONStorage(() => failSafeStorage(storage)),
    skipHydration: true,
    migrate: migrateMrVersionPlanState,
    merge: (persistedState, currentState) => persistedState == null
      ? currentState
      : { ...currentState, ...migrateMrVersionPlanState(persistedState, MR_VERSION_PLAN_STORE_VERSION) },
    partialize: partializeMrVersionPlanState,
  })
}

export function createMrVersionPlanStore(options: StoreFactoryOptions = {}) {
  return createStore<MrVersionPlanStore>()(createStoreCreator(options))
}

export const useMrVersionPlanStore = create<MrVersionPlanStore>()(createStoreCreator({
  storage: typeof window === 'undefined' ? memoryStorage : browserStorage,
}))

export async function rehydrateMrVersionPlanStore(
  store: Pick<ReturnType<typeof createMrVersionPlanStore>, 'persist'> = useMrVersionPlanStore,
): Promise<void> {
  try {
    await store.persist.rehydrate()
  } catch {
    // Corrupt or inaccessible browser storage must not block the MR plan surface.
  }
  try {
    if (typeof window !== 'undefined') await Promise.resolve(window.localStorage.removeItem(LEGACY_LEVEL3_STORAGE_KEY))
  } catch {
    // Legacy cleanup is best effort when storage is unavailable.
  }
}
