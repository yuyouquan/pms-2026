import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  calculateTechnicalProjectStage,
  comparePublishedTechnicalPlanVersions,
  isTechnicalSubprojectConfigured,
  type TechnicalStagePlanVersion,
} from '@/lib/technicalProjectRules'
import { buildTdtTemplateTasks, validateTechnicalPlanInstanceDepth } from '@/lib/technicalPlanRules'
import type { SortableColumnSettingsValue } from '@/lib/columnSettings'
import type { TechnicalTemplateKind, TechnicalTemplateTask } from '@/types/technicalPlan'
import type { TechnicalSubproject } from '@/types/technicalProject'

export type TechnicalPlanScope =
  | { kind: 'tdt'; parentProjectId: string }
  | { kind: 'subproject'; parentProjectId: string; subprojectId: string }

export const getTechnicalPlanKey = (scope: TechnicalPlanScope) => scope.kind === 'tdt'
  ? `${scope.parentProjectId}:tdt`
  : `${scope.parentProjectId}:subproject:${scope.subprojectId}`

export interface TechnicalPlanVersion extends TechnicalStagePlanVersion {
  versionNo: string
  templateType: TechnicalTemplateKind
  tasks: TechnicalTemplateTask[]
}

const DEFAULT_COLUMNS: SortableColumnSettingsValue<string> = {
  order: ['taskName', 'responsible', 'predecessor', 'planStartDate', 'planEndDate', 'estimatedDays', 'status', 'progress'],
  visible: ['taskName', 'responsible', 'predecessor', 'planStartDate', 'planEndDate', 'estimatedDays', 'status', 'progress'],
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
  'tdt-1': ['2026-01-01', '2026-01-31'],
  'tdt-2': ['2026-02-01', '2026-02-28'],
  'tdt-3': ['2026-03-01', '2026-03-31'],
  'tdt-4': ['2026-04-01', '2026-06-30'],
  'tdt-5': ['2026-07-01', '2026-08-31'],
}

const buildInitialTdtTasks = () => buildTdtTemplateTasks().map(task => {
  const [planStartDate, planEndDate] = TDT_PHASE_DATES[task.parentId || task.id]
  return { ...task, planStartDate, planEndDate }
})

export const INITIAL_TECHNICAL_PLANS: TechnicalPlansByKey = {
  '9:tdt': {
    planKey: '9:tdt', templateKind: 'tdt', currentVersionId: 'tech-9-v2-draft',
    columnSettings: { order: [...DEFAULT_COLUMNS.order], visible: [...DEFAULT_COLUMNS.visible] }, collapsedRows: [],
    versions: [
      { id: 'tech-9-v1', versionNo: 'V1', templateType: 'tdt', status: '已发布', publishedAt: '2026-01-05T00:00:00Z', tasks: buildInitialTdtTasks() },
      { id: 'tech-9-v2-draft', versionNo: 'V2', templateType: 'tdt', status: '修订中', tasks: buildInitialTdtTasks() },
    ],
  },
}

const cloneTasks = (tasks: readonly TechnicalTemplateTask[]) => tasks.map(task => ({ ...task }))
const clonePlans = (plans: TechnicalPlansByKey): TechnicalPlansByKey => Object.fromEntries(
  Object.entries(plans).map(([key, plan]) => [key, {
    ...plan,
    versions: plan.versions.map(version => ({ ...version, tasks: cloneTasks(version.tasks) })),
    columnSettings: { order: [...(plan.columnSettings?.order || DEFAULT_COLUMNS.order)], visible: [...(plan.columnSettings?.visible || DEFAULT_COLUMNS.visible)] },
    collapsedRows: [...(plan.collapsedRows || [])],
  }]),
)

export const TECHNICAL_PLAN_STORE_VERSION = 2

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

export const migrateTechnicalPlanState = (persistedState: unknown, fromVersion: number): TechnicalPlanState => {
  const source = isRecord(persistedState) && isRecord(persistedState.plansByKey)
    ? persistedState.plansByKey
    : INITIAL_TECHNICAL_PLANS
  const plansByKey: TechnicalPlansByKey = {}
  Object.entries(source).forEach(([key, candidate]) => {
    if (!isRecord(candidate) || !Array.isArray(candidate.versions)) return
    const legacySeed = fromVersion < TECHNICAL_PLAN_STORE_VERSION
      && candidate.versions.some(version => isRecord(version) && String(version.id || '').startsWith('tech-9-v'))
    if (legacySeed && key === '9:tdt') {
      plansByKey[key] = clonePlans(INITIAL_TECHNICAL_PLANS)[key]
      return
    }
    const templateKind: TechnicalTemplateKind = candidate.templateKind === 'subproject' ? 'subproject' : 'tdt'
    const versions = candidate.versions.flatMap((version): TechnicalPlanVersion[] => {
      if (!isRecord(version) || !Array.isArray(version.tasks)) return []
      const tasks = version.tasks.filter(isRecord).map(task => ({ ...task })) as unknown as TechnicalTemplateTask[]
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
    plansByKey[key] = {
      planKey: key, templateKind, versions, currentVersionId,
      columnSettings: {
        order: Array.isArray(columns.order) ? columns.order.map(String) : [...DEFAULT_COLUMNS.order],
        visible: Array.isArray(columns.visible) ? columns.visible.map(String) : [...DEFAULT_COLUMNS.visible],
      },
      collapsedRows: Array.isArray(candidate.collapsedRows) ? candidate.collapsedRows.map(String) : [],
    }
  })
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
export type RevisionMutationResult = { ok: true } | { ok: false; reason: 'missing-instance' | 'missing-draft' | 'max-depth' }

export interface CreateRevisionInput {
  scope: TechnicalPlanScope
  templateKind: TechnicalTemplateKind
  maxDepth?: number
  templateTasks: readonly TechnicalTemplateTask[]
  subproject?: TechnicalSubproject
}

export interface TechnicalPlanState { plansByKey: TechnicalPlansByKey }
export interface TechnicalPlanActions {
  createRevision: (input: CreateRevisionInput) => CreateRevisionResult
  publishRevision: (scope: TechnicalPlanScope, publishedAt?: string) => RevisionMutationResult
  cancelRevision: (scope: TechnicalPlanScope) => RevisionMutationResult
  updateCurrentTasks: (scope: TechnicalPlanScope, tasks: readonly TechnicalTemplateTask[], maxDepth?: number) => RevisionMutationResult
  setCurrentVersion: (scope: TechnicalPlanScope, versionId: string) => boolean
  setColumns: (scope: TechnicalPlanScope, columns: SortableColumnSettingsValue<string>) => void
  setCollapsed: (scope: TechnicalPlanScope, rowIds: readonly string[]) => void
}

const nextVersionNo = (versions: readonly TechnicalPlanVersion[]) => {
  const max = versions.reduce((value, version) => Math.max(value, Number.parseInt(version.versionNo.replace(/\D/g, ''), 10) || 0), 0)
  return `V${max + 1}`
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
  const versionNo = nextVersionNo(current?.versions || [])
  const versionId = `${versionNo}-draft`
  const instance: TechnicalPlanInstance = current
    ? { ...current, versions: [...current.versions, { id: versionId, versionNo, templateType: input.templateKind, status: '修订中', tasks: cloneTasks(input.templateTasks) }], currentVersionId: versionId }
    : { planKey: key, templateKind: input.templateKind, versions: [{ id: versionId, versionNo, templateType: input.templateKind, status: '修订中', tasks: cloneTasks(input.templateTasks) }], currentVersionId: versionId, columnSettings: { order: [...DEFAULT_COLUMNS.order], visible: [...DEFAULT_COLUMNS.visible] }, collapsedRows: [] }
  return { state: { plansByKey: { ...state.plansByKey, [key]: instance } }, result: { ok: true, versionId } }
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
    publishRevision: (scope: TechnicalPlanScope, at?: string) => { const output = mutateDraft(state, scope, 'publish', at); update(output.state); return output.result },
    cancelRevision: (scope: TechnicalPlanScope) => { const output = mutateDraft(state, scope, 'cancel'); update(output.state); return output.result },
    updateCurrentTasks: (scope: TechnicalPlanScope, tasks: readonly TechnicalTemplateTask[], maxDepth?: number) => { const output = mutateDraft(state, scope, 'tasks', tasks, maxDepth); update(output.state); return output.result },
    setColumns: (scope: TechnicalPlanScope, columns: SortableColumnSettingsValue<string>) => { const key = getTechnicalPlanKey(scope); const item = state.plansByKey[key]; if (item) update({ plansByKey: { ...state.plansByKey, [key]: { ...item, columnSettings: { order: [...columns.order], visible: [...columns.visible] } } } }) },
    setCollapsed: (scope: TechnicalPlanScope, ids: readonly string[]) => { const key = getTechnicalPlanKey(scope); const item = state.plansByKey[key]; if (item) update({ plansByKey: { ...state.plansByKey, [key]: { ...item, collapsedRows: [...ids] } } }) },
  }
}

const zustandActions = (set: (value: Partial<TechnicalPlanState> | ((state: TechnicalPlanState) => Partial<TechnicalPlanState>)) => void, get: () => TechnicalPlanState): TechnicalPlanActions => ({
  createRevision: input => { const output = createRevisionInState(get(), input); set(output.state); return output.result },
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
