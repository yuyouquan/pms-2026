import { create } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { createInitialMrTemplateVersions } from '@/data/mrVersionPlanMocks'
import {
  cancelMrTemplateRevision,
  cloneMrTemplateSnapshot,
  createMrTemplateRevision,
  normalizeMrTemplateActivities,
  publishMrTemplateRevision,
  validateMrTemplateForPublish,
} from '@/lib/mrTemplateRules'
import { applyStopRelease, canonicalizeTosMrVersion, reconcileJointMachinePlans } from '@/lib/mrAggregationRules'
import { normalizeMrBusinessDate, createTosMrVersionInstance } from '@/lib/mrVersionPlanRules'
import type {
  AddTosInstanceInput,
  JointMachinePlan,
  MrActivityDateMap,
  MrActivityUpdater,
  MrMarketOverride,
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
export const MR_VERSION_PLAN_STORE_VERSION = 1
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
}

export interface MrVersionPlanActions {
  createTemplateRevision: (actor: string, permission: MrPermissionResult) => boolean
  updateTemplateActivities: (versionId: string, updater: MrActivityUpdater, permission: MrPermissionResult) => boolean
  publishTemplateRevision: (versionId: string, actor: string, permission: MrPermissionResult) => { ok: boolean; errors: string[] }
  cancelTemplateRevision: (versionId: string, permission: MrPermissionResult) => boolean
  addTosVersionInstance: (input: AddTosInstanceInput, permission: MrPermissionResult) => boolean
  updateTosDate: (projectId: string, tosVersion: string, activityId: string, value: string, actor: string, permission: MrPermissionResult) => boolean
  reconcileMachinePlans: (input: ReconcileJointInput) => ReconcileJointResult
  updateMachineTransferType: (key: string, value: MrTransferType, actor: string, permission: MrPermissionResult) => boolean
  updateMachineDate: (key: string, activityId: string, value: string, actor: string, permission: MrPermissionResult) => boolean
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
  const versions: MrTemplateVersion[] = []
  const ids = new Set<string>()
  value.forEach(candidate => {
    if (!isRecord(candidate)) return
    const id = text(candidate.id)
    const versionNo = text(candidate.versionNo)
    const status = candidate.status === '已发布' || candidate.status === '修订中' ? candidate.status : null
    const createdBy = text(candidate.createdBy)
    const createdAt = text(candidate.createdAt)
    const activities = sanitizeActivities(candidate.activities)
    if (!id || ids.has(id) || !/^V[1-9]\d*$/.test(versionNo) || !status || !createdBy || !createdAt || activities.length === 0) return
    ids.add(id)
    versions.push({
      id, versionNo, status, activities, createdBy, createdAt,
      ...(text(candidate.publishedAt) ? { publishedAt: text(candidate.publishedAt) } : {}),
    })
  })
  return versions
}

function sanitizeTemplateHistory(value: unknown): MrTemplateChangeLog[] {
  if (!Array.isArray(value)) return []
  return value.flatMap(candidate => {
    if (!isRecord(candidate)) return []
    const id = text(candidate.id)
    const versionId = text(candidate.versionId)
    const action = candidate.action as MrTemplateChangeLog['action']
    const actor = text(candidate.actor)
    const occurredAt = text(candidate.occurredAt)
    if (!id || !versionId || !TEMPLATE_ACTIONS.has(action) || !actor || !occurredAt) return []
    return [{
      id, versionId, action, actor, occurredAt,
      ...(text(candidate.activityId) ? { activityId: text(candidate.activityId) } : {}),
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

function sanitizeMachinePlans(value: unknown): Record<string, JointMachinePlan> {
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
    if (!projectId || !tosProjectId || !tosVersion || !TRANSFER_TYPES.has(transferType) || !updatedBy || !updatedAt) return
    const key = `${projectId}::${tosVersion}`
    if (!result[key]) result[key] = { projectId, tosProjectId, tosVersion, transferType, dates: transferType === 'N/A' ? {} : sanitizeDates(candidate.dates), updatedBy, updatedAt }
  })
  return result
}

function sanitizeMarketOverrides(value: unknown, planKeys: ReadonlySet<string>): Record<string, MrMarketOverride> {
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
    if (!planKeys.has(planKey)) return
    const dates = sanitizeDates(candidate.dates)
    result[`${planKey}::${market}`] = { projectId, tosVersion, market, mainMarket, dates }
  })
  return result
}

function sanitizeStopRecords(value: unknown): MrStopReleaseRecord[] {
  if (!Array.isArray(value)) return []
  const ids = new Set<string>()
  return value.flatMap(candidate => {
    if (!isRecord(candidate)) return []
    const id = text(candidate.id)
    const projectId = text(candidate.projectId)
    const projectName = text(candidate.projectName)
    const stopDate = canonicalDate(candidate.stopDate)
    const operator = text(candidate.operator)
    const operatedAt = text(candidate.operatedAt)
    if (!id || ids.has(id) || !projectId || !projectName || !stopDate || !operator || !operatedAt) return []
    ids.add(id)
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

function initialMrVersionPlanState(): MrVersionPlanState {
  const templateVersions = createInitialMrTemplateVersions()
  return {
    templateVersions,
    currentTemplateVersionId: templateVersions[0].id,
    templateHistory: [],
    tosInstancesByProjectId: {},
    machinePlansByKey: {},
    marketOverridesByKey: {},
    stopReleaseRecords: [],
    viewModeByScope: {},
  }
}

export function migrateMrVersionPlanState(persistedState: unknown, _fromVersion: number): MrVersionPlanState {
  const fallback = initialMrVersionPlanState()
  if (!isRecord(persistedState)) return fallback
  const templateVersions = sanitizeTemplateVersions(persistedState.templateVersions)
  const safeTemplateVersions = templateVersions.length ? templateVersions : fallback.templateVersions
  const versionIds = new Set(safeTemplateVersions.map(version => version.id))
  const requestedCurrentId = text(persistedState.currentTemplateVersionId)
  const currentTemplateVersionId = versionIds.has(requestedCurrentId) ? requestedCurrentId : safeTemplateVersions.at(-1)!.id
  const machinePlansByKey = sanitizeMachinePlans(persistedState.machinePlansByKey)
  return {
    templateVersions: safeTemplateVersions.map(cloneTemplateVersion),
    currentTemplateVersionId,
    templateHistory: sanitizeTemplateHistory(persistedState.templateHistory),
    tosInstancesByProjectId: sanitizeTosInstances(persistedState.tosInstancesByProjectId),
    machinePlansByKey,
    marketOverridesByKey: sanitizeMarketOverrides(persistedState.marketOverridesByKey, new Set(Object.keys(machinePlansByKey))),
    stopReleaseRecords: sanitizeStopRecords(persistedState.stopReleaseRecords),
    viewModeByScope: sanitizeViewModes(persistedState.viewModeByScope),
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
  }, MR_VERSION_PLAN_STORE_VERSION)
}

function canAccessProject(permission: MrPermissionResult, capability: boolean, projectId: string, scope: 'tos' | 'machine'): boolean {
  if (!capability) return false
  if (permission.canEditTemplate) return true
  const ids = scope === 'tos' ? permission.tosProjectIds : permission.machineProjectIds
  return Array.isArray(ids) && ids.map(text).includes(projectId)
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
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
            id: idFactory('mr-template-log'), versionId: draft.id, action: 'create-revision', actor: normalizedActor, occurredAt: now,
          }],
        }))
        return true
      } catch {
        return false
      }
    },
    updateTemplateActivities: (versionId, updater, permission) => {
      if (!permission.canEditTemplate) return false
      const draft = get().templateVersions.find(version => version.id === versionId && version.status === '修订中')
      if (!draft) return false
      try {
        const previous = cloneMrTemplateSnapshot(draft.activities)
        const candidate = typeof updater === 'function' ? updater(cloneMrTemplateSnapshot(previous)) : updater
        const next = normalizeMrTemplateActivities(candidate.map(activity => ({ ...activity, activityName: activity.activityName.trim() })))
        if (sameJson(previous, next)) return true
        const previousById = new Map(previous.map(activity => [activity.id, activity]))
        const nextById = new Map(next.map(activity => [activity.id, activity]))
        const changes: Array<Pick<MrTemplateChangeLog, 'action' | 'activityId' | 'before' | 'after'>> = []
        previous.forEach(activity => {
          const replacement = nextById.get(activity.id)
          if (!replacement) changes.push({ action: 'delete', activityId: activity.id, before: activity.activityName })
          else if (replacement.activityName !== activity.activityName) changes.push({ action: 'rename', activityId: activity.id, before: activity.activityName, after: replacement.activityName })
          else if (replacement.order !== activity.order || replacement.parentId !== activity.parentId) changes.push({ action: 'move', activityId: activity.id })
        })
        next.forEach(activity => { if (!previousById.has(activity.id)) changes.push({ action: 'add', activityId: activity.id, after: activity.activityName }) })
        const now = clock()
        set(state => ({
          templateVersions: state.templateVersions.map(version => version.id === versionId ? { ...version, activities: cloneMrTemplateSnapshot(next) } : cloneTemplateVersion(version)),
          templateHistory: [...state.templateHistory, ...changes.map(change => ({
            id: idFactory('mr-template-log'), versionId, actor: draft.createdBy, occurredAt: now, ...change,
          }))],
        }))
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
            id: idFactory('mr-template-log'), versionId, action: 'publish', actor: normalizedActor, occurredAt: now,
          }],
        }))
        return { ok: true, errors: [] }
      } catch (error) {
        return { ok: false, errors: [error instanceof Error ? error.message : '发布失败'] }
      }
    },
    cancelTemplateRevision: (versionId, permission) => {
      if (!permission.canEditTemplate) return false
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
            id: idFactory('mr-template-log'), versionId, action: 'cancel-revision', actor: draft.createdBy, occurredAt: now,
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
      const tosInstances = Object.values(state.tosInstancesByProjectId).flat()
      const result = reconcileJointMachinePlans({
        ...input,
        tosInstances,
        persistedPlans: state.machinePlansByKey,
        stopRecords: state.stopReleaseRecords,
      })
      const retainedPlanKeys = new Set(Object.keys(result.persistedPlans))
      const marketOverridesByKey = Object.fromEntries(Object.entries(state.marketOverridesByKey)
        .filter(([, override]) => retainedPlanKeys.has(`${override.projectId}::${override.tosVersion}`))
        .map(([key, override]) => [key, { ...override, dates: { ...override.dates } }]))
      if (!sameJson(state.machinePlansByKey, result.persistedPlans) || !sameJson(state.marketOverridesByKey, marketOverridesByKey)) {
        set({ machinePlansByKey: result.persistedPlans, marketOverridesByKey })
      }
      return result
    },
    updateMachineTransferType: (keyInput, value, actor, permission) => {
      const key = text(keyInput)
      const plan = get().machinePlansByKey[key]
      const normalizedActor = text(actor)
      if (!plan || !TRANSFER_TYPES.has(value) || !normalizedActor || !canAccessProject(permission, permission.canEditMachine, plan.projectId, 'machine')) return false
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
      if (!plan || plan.transferType === 'N/A' || !activityId || !normalizedActor || !canAccessProject(permission, permission.canEditMachine, plan.projectId, 'machine')) return false
      if (!hasChildActivity(get(), plan, activityId)) return false
      if (value !== '' && canonicalDate(value) !== value) return false
      const now = clock()
      set(state => ({ machinePlansByKey: {
        ...state.machinePlansByKey,
        [key]: { ...plan, dates: { ...plan.dates, [activityId]: value }, updatedBy: normalizedActor, updatedAt: now },
      } }))
      return true
    },
    stopRelease: (input, permission) => {
      const projectId = text(input.projectId)
      if (!projectId || !canAccessProject(permission, permission.canStopRelease, projectId, 'machine')) return false
      const state = get()
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
      if (input.value !== '' && !canonicalDate(input.mainValue)) return false
      const planKey = `${projectId}::${tosVersion}`
      const plan = get().machinePlansByKey[planKey]
      if (!plan || !hasChildActivity(get(), plan, activityId)) return false
      const key = `${planKey}::${market}`
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
    storage: createJSONStorage(() => storage),
    migrate: migrateMrVersionPlanState,
    merge: (persistedState, currentState) => persistedState == null
      ? currentState
      : { ...currentState, ...migrateMrVersionPlanState(persistedState, MR_VERSION_PLAN_STORE_VERSION) },
    partialize: partializeMrVersionPlanState,
    onRehydrateStorage: () => () => {
      if (typeof window !== 'undefined') window.localStorage.removeItem(LEGACY_LEVEL3_STORAGE_KEY)
    },
  })
}

export function createMrVersionPlanStore(options: StoreFactoryOptions = {}) {
  return createStore<MrVersionPlanStore>()(createStoreCreator(options))
}

export const useMrVersionPlanStore = create<MrVersionPlanStore>()(createStoreCreator({
  storage: typeof window === 'undefined' ? memoryStorage : browserStorage,
}))
