import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  calculateTechnicalProjectStage,
  comparePublishedTechnicalPlanVersions,
  isTechnicalSubprojectConfigured,
  type TechnicalStagePlanVersion,
} from '@/lib/technicalProjectRules'
import { buildSubprojectTemplateTasks, buildTdtTemplateTasks, renumberTechnicalTasks, validateTechnicalPlanInstanceDepth } from '@/lib/technicalPlanRules'
import { getNextPlanRevisionVersionNo, type PlanRevisionKind } from '@/lib/planVersioning'
import type { SortableColumnSettingsValue } from '@/lib/columnSettings'
import type { TechnicalTemplateKind, TechnicalTemplateTask } from '@/types/technicalPlan'
import type { TechnicalSubproject } from '@/types/technicalProject'

export type TechnicalPlanScope =
  | { kind: 'tdt'; parentProjectId: string }
  | { kind: 'subproject'; parentProjectId: string; subprojectId: string }

export const isTechnicalPlanScope = (scope: unknown): scope is TechnicalPlanScope => {
  if (!scope || typeof scope !== 'object') return false
  const candidate = scope as Record<string, unknown>
  if (typeof candidate.parentProjectId !== 'string' || !candidate.parentProjectId.trim()) return false
  if (candidate.kind === 'tdt') return true
  return candidate.kind === 'subproject'
    && typeof candidate.subprojectId === 'string'
    && Boolean(candidate.subprojectId.trim())
}

export const getTechnicalPlanKey = (scope: TechnicalPlanScope) => {
  if (!isTechnicalPlanScope(scope)) throw new Error('Invalid technical plan scope')
  return scope.kind === 'tdt'
    ? `${scope.parentProjectId}:tdt`
    : `${scope.parentProjectId}:subproject:${scope.subprojectId}`
}

export interface TechnicalPlanVersion extends TechnicalStagePlanVersion {
  versionNo: string
  templateType: TechnicalTemplateKind
  tasks: TechnicalTemplateTask[]
}

const DEFAULT_COLUMNS: SortableColumnSettingsValue<string> = {
  order: ['id', 'taskName', 'responsible', 'predecessor', 'planStartDate', 'planEndDate', 'estimatedDays', 'actualStartDate', 'actualEndDate', 'actualDays', 'status', 'progress'],
  visible: ['id', 'taskName', 'responsible', 'predecessor', 'planStartDate', 'planEndDate', 'estimatedDays', 'actualStartDate', 'actualEndDate', 'actualDays', 'status', 'progress'],
}

export interface TechnicalPlanInstance {
  planKey: string
  templateKind: TechnicalTemplateKind
  versions: TechnicalPlanVersion[]
  currentVersionId: string
  columnSettings: SortableColumnSettingsValue<string>
  collapsedRows: string[]
}

export type TechnicalPlansByKey = Record<string, TechnicalPlanInstance>

const TDT_PHASE_DATES: Record<string, [string, string]> = {
  '1': ['2026-01-01', '2026-01-31'],
  '2': ['2026-02-01', '2026-02-28'],
  '3': ['2026-03-01', '2026-03-31'],
  '4': ['2026-04-01', '2026-06-30'],
  '5': ['2026-07-01', '2026-08-31'],
}

const buildInitialTdtTasks = () => buildTdtTemplateTasks().map(task => {
  const [planStartDate, planEndDate] = TDT_PHASE_DATES[task.parentId || task.id]
  return { ...task, planStartDate, planEndDate }
})

const buildInitialSubprojectTasks = (childIndex: number) => buildSubprojectTemplateTasks().map((task, taskIndex) => {
  const startMonth = String(taskIndex + 1).padStart(2, '0')
  const endMonth = String(taskIndex + 2).padStart(2, '0')
  const startDay = String(childIndex + 1).padStart(2, '0')
  return {
    ...task,
    planStartDate: `2026-${startMonth}-${startDay}`,
    planEndDate: `2026-${endMonth}-20`,
  }
})

const TDT_PLAN_PROJECT_IDS = [
  '4', '9', '20', '21',
  'mock-tech-aios-v3', 'mock-tech-perf-power', 'mock-tech-system-experience', 'mock-tech-6g-prestudy',
] as const

const SUBPROJECT_PLAN_SCOPES = [
  ['9', 'IPM-AI-001'], ['9', 'IPM-AI-002'],
  ['20', 'IPM-BASE-001'], ['20', 'IPM-BASE-002'],
  ['21', 'IPM-IMAGE-001'], ['21', 'IPM-IMAGE-002'],
  ['mock-tech-aios-v3', 'IPM-AIOS-001'], ['mock-tech-perf-power', 'IPM-POWER-001'],
  ['mock-tech-system-experience', 'IPM-UX-001'], ['mock-tech-6g-prestudy', 'IPM-6G-001'],
] as const

const createPublishedTdtPlan = (parentProjectId: string, index: number): TechnicalPlanInstance => {
  const publishedId = `tech-${parentProjectId}-v1`
  const published = {
    id: publishedId,
    versionNo: 'V1',
    templateType: 'tdt' as const,
    status: '已发布',
    publishedAt: `2026-01-${String(index + 5).padStart(2, '0')}T00:00:00Z`,
    tasks: buildInitialTdtTasks(),
  }
  return parentProjectId === '9'
    ? {
        planKey: '9:tdt', templateKind: 'tdt', currentVersionId: 'tech-9-v2-draft',
        columnSettings: { order: [...DEFAULT_COLUMNS.order], visible: [...DEFAULT_COLUMNS.visible] }, collapsedRows: [],
        versions: [published, { id: 'tech-9-v2-draft', versionNo: 'V2', templateType: 'tdt', status: '修订中', tasks: buildInitialTdtTasks() }],
      }
    : {
        planKey: `${parentProjectId}:tdt`, templateKind: 'tdt', currentVersionId: publishedId,
        columnSettings: { order: [...DEFAULT_COLUMNS.order], visible: [...DEFAULT_COLUMNS.visible] }, collapsedRows: [], versions: [published],
      }
}

const createPublishedSubprojectPlan = (parentProjectId: string, subprojectId: string, index: number): TechnicalPlanInstance => {
  const planKey = `${parentProjectId}:subproject:${subprojectId}`
  const versionId = `tech-${subprojectId.toLowerCase()}-v1`
  return {
    planKey, templateKind: 'subproject', currentVersionId: versionId,
    columnSettings: { order: [...DEFAULT_COLUMNS.order], visible: [...DEFAULT_COLUMNS.visible] }, collapsedRows: [],
    versions: [{
      id: versionId, versionNo: 'V1', templateType: 'subproject', status: '已发布',
      publishedAt: `2026-02-${String(index + 1).padStart(2, '0')}T00:00:00Z`, tasks: buildInitialSubprojectTasks(index),
    }],
  }
}

export const INITIAL_TECHNICAL_PLANS: TechnicalPlansByKey = Object.fromEntries([
  ...TDT_PLAN_PROJECT_IDS.map((parentProjectId, index) => {
    const plan = createPublishedTdtPlan(parentProjectId, index)
    return [plan.planKey, plan]
  }),
  ...SUBPROJECT_PLAN_SCOPES.map(([parentProjectId, subprojectId], index) => {
    const plan = createPublishedSubprojectPlan(parentProjectId, subprojectId, index)
    return [plan.planKey, plan]
  }),
])

const cloneNestedValue = <T,>(value: T): T => {
  if (Array.isArray(value)) return value.map(cloneNestedValue) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, cloneNestedValue(nested)]),
    ) as T
  }
  return value
}

const cloneTasks = (tasks: readonly TechnicalTemplateTask[]) => tasks.map(task => cloneNestedValue(task))
const clonePlans = (plans: TechnicalPlansByKey): TechnicalPlansByKey => Object.fromEntries(
  Object.entries(plans).map(([key, plan]) => [key, {
    ...plan,
    versions: plan.versions.map(version => ({ ...version, tasks: cloneTasks(version.tasks) })),
    columnSettings: { order: [...(plan.columnSettings?.order || DEFAULT_COLUMNS.order)], visible: [...(plan.columnSettings?.visible || DEFAULT_COLUMNS.visible)] },
    collapsedRows: [...(plan.collapsedRows || [])],
  }]),
)

export const TECHNICAL_PLAN_STORE_VERSION = 6

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

export const migrateTechnicalPlanState = (persistedState: unknown, fromVersion: number): TechnicalPlanState => {
  const source = isRecord(persistedState) && isRecord(persistedState.plansByKey)
    ? persistedState.plansByKey
    : INITIAL_TECHNICAL_PLANS
  const plansByKey: TechnicalPlansByKey = {}
  Object.entries(source).forEach(([key, candidate]) => {
    if (!isRecord(candidate) || !Array.isArray(candidate.versions)) return
    const legacySeed = fromVersion < 2
      && candidate.versions.some(version => isRecord(version) && String(version.id || '').startsWith('tech-9-v'))
    if (legacySeed && key === '9:tdt') {
      plansByKey[key] = clonePlans(INITIAL_TECHNICAL_PLANS)[key]
      return
    }
    const templateKind: TechnicalTemplateKind = candidate.templateKind === 'subproject' ? 'subproject' : 'tdt'
    const versions = candidate.versions.flatMap((version): TechnicalPlanVersion[] => {
      if (!isRecord(version) || !Array.isArray(version.tasks)) return []
      const storedTasks = version.tasks.filter(isRecord).map(task => cloneNestedValue(task)) as unknown as TechnicalTemplateTask[]
      const tasks = fromVersion < 4 ? renumberTechnicalTasks(storedTasks) : storedTasks
      try { validateTechnicalPlanInstanceDepth(templateKind, tasks, templateKind === 'tdt' ? 2 : 1) } catch { return [] }
      return [{
        id: String(version.id || ''), versionNo: String(version.versionNo || ''), templateType: templateKind,
        status: String(version.status || ''), ...(typeof version.publishedAt === 'string' ? { publishedAt: version.publishedAt } : {}), tasks,
      }]
    })
    if (!versions.length) return
    const currentVersionId = versions.some(version => version.id === candidate.currentVersionId)
      ? String(candidate.currentVersionId)
      : versions[0].id
    const columns = isRecord(candidate.columnSettings) ? candidate.columnSettings : {}
    const storedOrder = Array.isArray(columns.order) ? columns.order.map(String) : [...DEFAULT_COLUMNS.order]
    const storedVisible = Array.isArray(columns.visible) ? columns.visible.map(String) : [...DEFAULT_COLUMNS.visible]
    const actualColumnKeys = ['actualStartDate', 'actualEndDate', 'actualDays']
    const priorOrder = fromVersion < 3
      ? [...storedOrder, ...actualColumnKeys.filter(key => !storedOrder.includes(key))]
      : storedOrder
    const priorVisible = fromVersion < 3
      ? [...storedVisible, ...actualColumnKeys.filter(key => !storedVisible.includes(key))]
      : storedVisible
    const order = priorOrder.includes('id') ? priorOrder : ['id', ...priorOrder]
    const visible = priorVisible.includes('id') ? priorVisible : ['id', ...priorVisible]
    plansByKey[key] = {
      planKey: key, templateKind, versions, currentVersionId,
      columnSettings: {
        order,
        visible,
      },
      collapsedRows: fromVersion < 4 ? [] : (Array.isArray(candidate.collapsedRows) ? candidate.collapsedRows.map(String) : []),
    }
  })
  if (fromVersion === TECHNICAL_PLAN_STORE_VERSION - 1) {
    const seedPlans = clonePlans(INITIAL_TECHNICAL_PLANS)
    Object.entries(seedPlans).forEach(([key, plan]) => {
      if (!plansByKey[key]) plansByKey[key] = plan
    })
  }
  return { plansByKey }
}

export const selectLatestPublishedTechnicalPlanVersion = (plansByKey: TechnicalPlansByKey, parentProjectId: string) => {
  const instance = plansByKey[getTechnicalPlanKey({ kind: 'tdt', parentProjectId })]
  if (!instance || instance.templateKind !== 'tdt') return undefined
  return instance.versions
    .filter(version => version.status === '已发布' && ['tdt', 'TDT项目计划'].includes(version.templateType))
    .sort(comparePublishedTechnicalPlanVersions)[0]
}

export const selectTechnicalProjectStage = (plansByKey: TechnicalPlansByKey, parentProjectId: string, today: string) => {
  const latestPublished = selectLatestPublishedTechnicalPlanVersion(plansByKey, parentProjectId)
  return latestPublished ? calculateTechnicalProjectStage(latestPublished.tasks, today) : '-'
}

export interface TechnicalSharePlanQuery {
  technical?: string | null
  kind?: string | null
  projectId?: string | null
  subprojectId?: string | null
}

export type ResolveTechnicalSharePlanResult =
  | { ok: true; scope: TechnicalPlanScope; version: TechnicalPlanVersion }
  | { ok: false; reason: 'invalid-query' | 'missing-published' }

/** Resolves a detached, read-only snapshot for a public technical-plan link. */
export const resolveTechnicalSharePlan = (
  plansByKey: TechnicalPlansByKey,
  query: TechnicalSharePlanQuery,
): ResolveTechnicalSharePlanResult => {
  const parentProjectId = String(query.projectId || '').trim()
  let scope: TechnicalPlanScope
  if (query.technical !== '1' || !parentProjectId) return { ok: false, reason: 'invalid-query' }
  if (query.kind === 'tdt') {
    scope = { kind: 'tdt', parentProjectId }
  } else if (query.kind === 'subproject' && typeof query.subprojectId === 'string' && query.subprojectId.trim()) {
    scope = { kind: 'subproject', parentProjectId, subprojectId: query.subprojectId.trim() }
  } else {
    return { ok: false, reason: 'invalid-query' }
  }
  const instance = plansByKey[getTechnicalPlanKey(scope)]
  if (!instance || instance.templateKind !== scope.kind) return { ok: false, reason: 'missing-published' }
  const latest = instance.versions
    .filter(version => version.status === '已发布' && version.templateType === scope.kind)
    .sort(comparePublishedTechnicalPlanVersions)[0]
  return latest
    ? { ok: true, scope, version: cloneNestedValue(latest) }
    : { ok: false, reason: 'missing-published' }
}

export interface TechnicalPlanTab {
  key: string
  label: string
  templateKind: TechnicalTemplateKind
  scope: TechnicalPlanScope
  subproject?: TechnicalSubproject
}

export const buildTechnicalPlanTabs = (
  parentProjectId: string,
  subprojects: readonly TechnicalSubproject[],
  showInactive: boolean,
): TechnicalPlanTab[] => [
  { key: getTechnicalPlanKey({ kind: 'tdt', parentProjectId }), label: 'TDT项目计划', templateKind: 'tdt', scope: { kind: 'tdt', parentProjectId } },
  ...subprojects
    .filter(item => item.parentProjectId === parentProjectId && (item.active || showInactive))
    .sort((left, right) => left.ipmOrder - right.ipmOrder || left.id.localeCompare(right.id))
    .map(subproject => ({
      key: getTechnicalPlanKey({ kind: 'subproject', parentProjectId, subprojectId: subproject.id }),
      label: `${subproject.name}计划`, templateKind: 'subproject' as const,
      scope: { kind: 'subproject' as const, parentProjectId, subprojectId: subproject.id }, subproject,
    })),
]

export type CreateRevisionResult = { ok: true; versionId: string } | { ok: false; reason: 'draft-exists' | 'inactive' | 'incomplete-configuration' | 'max-depth' }
export type ClonePublishedVersionResult = { ok: true; versionId: string } | { ok: false; reason: 'missing-instance' | 'missing-source' | 'draft-exists' | 'inactive' | 'incomplete-configuration' }
export type RevisionMutationResult = { ok: true } | { ok: false; reason: 'missing-instance' | 'missing-draft' | 'max-depth' }

export interface CreateRevisionInput {
  scope: TechnicalPlanScope
  templateKind: TechnicalTemplateKind
  maxDepth?: number
  templateTasks: readonly TechnicalTemplateTask[]
  revisionKind?: PlanRevisionKind
  subproject?: TechnicalSubproject
}

export interface ClonePublishedVersionInput {
  scope: TechnicalPlanScope
  sourceVersionId: string
  subproject?: TechnicalSubproject
}

export interface TechnicalPlanState { plansByKey: TechnicalPlansByKey }
export interface TechnicalPlanActions {
  createRevision: (input: CreateRevisionInput) => CreateRevisionResult
  clonePublishedVersion: (input: ClonePublishedVersionInput) => ClonePublishedVersionResult
  publishRevision: (scope: TechnicalPlanScope, publishedAt?: string) => RevisionMutationResult
  cancelRevision: (scope: TechnicalPlanScope) => RevisionMutationResult
  updateCurrentTasks: (scope: TechnicalPlanScope, tasks: readonly TechnicalTemplateTask[], maxDepth?: number) => RevisionMutationResult
  setCurrentVersion: (scope: TechnicalPlanScope, versionId: string) => boolean
  setColumns: (scope: TechnicalPlanScope, columns: SortableColumnSettingsValue<string>) => void
  setCollapsed: (scope: TechnicalPlanScope, rowIds: readonly string[]) => void
}

const createRevisionInState = (state: TechnicalPlanState, input: CreateRevisionInput): { state: TechnicalPlanState; result: CreateRevisionResult } => {
  if (input.scope.kind === 'subproject') {
    if (!input.subproject?.active) return { state, result: { ok: false, reason: 'inactive' } }
    if (!isTechnicalSubprojectConfigured(input.subproject)) return { state, result: { ok: false, reason: 'incomplete-configuration' } }
  }
  try {
    validateTechnicalPlanInstanceDepth(input.templateKind, input.templateTasks, input.maxDepth ?? (input.templateKind === 'tdt' ? 2 : 1))
  } catch {
    return { state, result: { ok: false, reason: 'max-depth' } }
  }
  const key = getTechnicalPlanKey(input.scope)
  const current = state.plansByKey[key]
  if (current?.versions.some(version => version.status === '修订中')) return { state, result: { ok: false, reason: 'draft-exists' } }
  const versionNo = getNextPlanRevisionVersionNo([...(current?.versions || [])], input.revisionKind || 'formal')
  const versionId = `${versionNo}-draft`
  const instance: TechnicalPlanInstance = current
    ? { ...current, versions: [...current.versions, { id: versionId, versionNo, templateType: input.templateKind, status: '修订中', tasks: cloneTasks(input.templateTasks) }], currentVersionId: versionId }
    : { planKey: key, templateKind: input.templateKind, versions: [{ id: versionId, versionNo, templateType: input.templateKind, status: '修订中', tasks: cloneTasks(input.templateTasks) }], currentVersionId: versionId, columnSettings: { order: [...DEFAULT_COLUMNS.order], visible: [...DEFAULT_COLUMNS.visible] }, collapsedRows: [] }
  return { state: { plansByKey: { ...state.plansByKey, [key]: instance } }, result: { ok: true, versionId } }
}

const clonePublishedVersionInState = (
  state: TechnicalPlanState,
  input: ClonePublishedVersionInput,
): { state: TechnicalPlanState; result: ClonePublishedVersionResult } => {
  if (!isTechnicalPlanScope(input.scope)) return { state, result: { ok: false, reason: 'missing-instance' } }
  if (input.scope.kind === 'subproject') {
    if (
      !input.subproject
      || input.subproject.id !== input.scope.subprojectId
      || input.subproject.parentProjectId !== input.scope.parentProjectId
    ) return { state, result: { ok: false, reason: 'incomplete-configuration' } }
    if (!input.subproject.active) return { state, result: { ok: false, reason: 'inactive' } }
    if (!isTechnicalSubprojectConfigured(input.subproject)) {
      return { state, result: { ok: false, reason: 'incomplete-configuration' } }
    }
  }
  const key = getTechnicalPlanKey(input.scope)
  const instance = state.plansByKey[key]
  if (!instance || instance.templateKind !== input.scope.kind) {
    return { state, result: { ok: false, reason: 'missing-instance' } }
  }
  if (instance.versions.some(version => version.status === '修订中')) {
    return { state, result: { ok: false, reason: 'draft-exists' } }
  }
  const source = instance.versions.find(version => (
    version.id === input.sourceVersionId
    && version.status === '已发布'
    && version.templateType === input.scope.kind
    && version.templateType === instance.templateKind
  ))
  if (!source) return { state, result: { ok: false, reason: 'missing-source' } }
  const versionNo = getNextPlanRevisionVersionNo([...instance.versions], 'formal')
  const versionId = `${versionNo}-draft`
  const draft: TechnicalPlanVersion = {
    id: versionId,
    versionNo,
    templateType: instance.templateKind,
    status: '修订中',
    tasks: cloneTasks(source.tasks),
  }
  return {
    state: {
      plansByKey: {
        ...state.plansByKey,
        [key]: {
          ...instance,
          versions: [...instance.versions, draft],
          currentVersionId: versionId,
        },
      },
    },
    result: { ok: true, versionId },
  }
}

const mutateDraft = (state: TechnicalPlanState, scope: TechnicalPlanScope, mutation: 'publish' | 'cancel' | 'tasks', payload?: string | readonly TechnicalTemplateTask[], maxDepth?: number) => {
  const key = getTechnicalPlanKey(scope)
  const instance = state.plansByKey[key]
  if (!instance) return { state, result: { ok: false as const, reason: 'missing-instance' as const } }
  const draft = instance.versions.find(version => version.status === '修订中')
  if (!draft) return { state, result: { ok: false as const, reason: 'missing-draft' as const } }
  if (mutation === 'tasks') {
    try {
      validateTechnicalPlanInstanceDepth(instance.templateKind, payload as readonly TechnicalTemplateTask[], maxDepth ?? (instance.templateKind === 'tdt' ? 2 : 1))
    } catch {
      return { state, result: { ok: false as const, reason: 'max-depth' as const } }
    }
  }
  let versions: TechnicalPlanVersion[]
  if (mutation === 'cancel') versions = instance.versions.filter(version => version.id !== draft.id)
  else versions = instance.versions.map(version => version.id !== draft.id ? version : mutation === 'publish'
    ? { ...version, status: '已发布', publishedAt: String(payload || new Date().toISOString()) }
    : { ...version, tasks: cloneTasks(payload as readonly TechnicalTemplateTask[]) })
  const currentVersionId = mutation === 'cancel'
    ? (versions.filter(version => version.status === '已发布').sort(comparePublishedTechnicalPlanVersions)[0]?.id || '')
    : draft.id
  return { state: { plansByKey: { ...state.plansByKey, [key]: { ...instance, versions, currentVersionId } } }, result: { ok: true as const } }
}

export function createTechnicalPlanStore(initial: Partial<TechnicalPlanState> = {}) {
  let state: TechnicalPlanState = { plansByKey: clonePlans(initial.plansByKey ?? INITIAL_TECHNICAL_PLANS) }
  const update = (next: TechnicalPlanState) => { state = next }
  return {
    getState: () => ({ plansByKey: clonePlans(state.plansByKey) }),
    createRevision: (input: CreateRevisionInput) => { const output = createRevisionInState(state, input); update(output.state); return output.result },
    clonePublishedVersion: (input: ClonePublishedVersionInput) => { const output = clonePublishedVersionInState(state, input); update(output.state); return output.result },
    publishRevision: (scope: TechnicalPlanScope, at?: string) => { const output = mutateDraft(state, scope, 'publish', at); update(output.state); return output.result },
    cancelRevision: (scope: TechnicalPlanScope) => { const output = mutateDraft(state, scope, 'cancel'); update(output.state); return output.result },
    updateCurrentTasks: (scope: TechnicalPlanScope, tasks: readonly TechnicalTemplateTask[], maxDepth?: number) => { const output = mutateDraft(state, scope, 'tasks', tasks, maxDepth); update(output.state); return output.result },
    setColumns: (scope: TechnicalPlanScope, columns: SortableColumnSettingsValue<string>) => { const key = getTechnicalPlanKey(scope); const item = state.plansByKey[key]; if (item) update({ plansByKey: { ...state.plansByKey, [key]: { ...item, columnSettings: { order: [...columns.order], visible: [...columns.visible] } } } }) },
    setCollapsed: (scope: TechnicalPlanScope, ids: readonly string[]) => { const key = getTechnicalPlanKey(scope); const item = state.plansByKey[key]; if (item) update({ plansByKey: { ...state.plansByKey, [key]: { ...item, collapsedRows: [...ids] } } }) },
  }
}

const zustandActions = (set: (value: Partial<TechnicalPlanState> | ((state: TechnicalPlanState) => Partial<TechnicalPlanState>)) => void, get: () => TechnicalPlanState): TechnicalPlanActions => ({
  createRevision: input => { const output = createRevisionInState(get(), input); set(output.state); return output.result },
  clonePublishedVersion: input => { const output = clonePublishedVersionInState(get(), input); set(output.state); return output.result },
  publishRevision: (scope, at) => { const output = mutateDraft(get(), scope, 'publish', at); set(output.state); return output.result },
  cancelRevision: scope => { const output = mutateDraft(get(), scope, 'cancel'); set(output.state); return output.result },
  updateCurrentTasks: (scope, tasks, maxDepth) => { const output = mutateDraft(get(), scope, 'tasks', tasks, maxDepth); set(output.state); return output.result },
  setCurrentVersion: (scope, versionId) => { const key = getTechnicalPlanKey(scope); const item = get().plansByKey[key]; if (!item?.versions.some(version => version.id === versionId)) return false; set({ plansByKey: { ...get().plansByKey, [key]: { ...item, currentVersionId: versionId } } }); return true },
  setColumns: (scope, columns) => { const key = getTechnicalPlanKey(scope); const item = get().plansByKey[key]; if (item) set({ plansByKey: { ...get().plansByKey, [key]: { ...item, columnSettings: { order: [...columns.order], visible: [...columns.visible] } } } }) },
  setCollapsed: (scope, ids) => { const key = getTechnicalPlanKey(scope); const item = get().plansByKey[key]; if (item) set({ plansByKey: { ...get().plansByKey, [key]: { ...item, collapsedRows: [...ids] } } }) },
})

export const useTechnicalPlanStore = create<TechnicalPlanState & TechnicalPlanActions>()(persist(
  (set, get) => ({ plansByKey: clonePlans(INITIAL_TECHNICAL_PLANS), ...zustandActions(set, get) }),
  {
    name: 'pms-technical-plans',
    version: TECHNICAL_PLAN_STORE_VERSION,
    storage: createJSONStorage(() => localStorage),
    migrate: migrateTechnicalPlanState,
    merge: (persisted, current) => ({ ...current, ...migrateTechnicalPlanState(persisted, TECHNICAL_PLAN_STORE_VERSION) }),
    partialize: state => ({ plansByKey: state.plansByKey }),
  },
))
