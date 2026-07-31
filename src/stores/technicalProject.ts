import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  cloneTechnicalSubproject,
  EMPTY_SUBPROJECT_CONFIGURATION,
  synchronizeTechnicalSubprojects,
} from '@/lib/technicalProjectRules'
import type {
  IpmTechnicalSubproject,
  TechnicalSubproject,
  TechnicalSubprojectConfiguration,
  TechnicalSubprojectConfigurationPatch,
  TechnicalSubprojectDevelopmentMode,
  TechnicalSubprojectCoreValue,
  TechnicalSubprojectSyncResult,
} from '@/types/technicalProject'

export const TECHNICAL_PROJECT_STORAGE_KEY = 'pms-technical-projects'
export const TECHNICAL_PROJECT_STORE_VERSION = 2

export const TECHNICAL_CORE_VALUES: readonly Exclude<TechnicalSubprojectCoreValue, ''>[] = [
  '追赶', '人无我有', '人有我有',
]

export const TECHNICAL_DEVELOPMENT_MODES: readonly Exclude<TechnicalSubprojectDevelopmentMode, ''>[] = [
  '自研', '谷歌合作', 'SoC合作', '高校合作',
]

export const INITIAL_TECHNICAL_SUBPROJECTS: TechnicalSubproject[] = [
  {
    id: 'IPM-AI-001', parentProjectId: '9', name: 'AI推理引擎子项目', active: true, ipmOrder: 1,
    configuration: { coreValue: '追赶', developmentMode: '自研', firstTosVersion: '16.0', firstMachineProjectId: '1' },
  },
  {
    id: 'IPM-AI-002', parentProjectId: '9', name: '多模态子项目', active: true, ipmOrder: 2,
    configuration: { ...EMPTY_SUBPROJECT_CONFIGURATION },
  },
  {
    id: 'IPM-AI-003', parentProjectId: '9', name: '端侧训练子项目', active: false, ipmOrder: 3,
    configuration: { coreValue: '人无我有', developmentMode: '高校合作', firstTosVersion: '', firstMachineProjectId: '' },
  },
]

type ConfigurationUpdateResult = { ok: true } | { ok: false; reason: 'missing' | 'inactive' | 'invalid' }

export interface TechnicalProjectState {
  subprojects: TechnicalSubproject[]
}

export interface TechnicalProjectActions {
  synchronizeSubprojects: (parentProjectId: string, incoming: readonly IpmTechnicalSubproject[]) => TechnicalSubprojectSyncResult
  updateConfiguration: (subprojectId: string, patch: TechnicalSubprojectConfigurationPatch) => ConfigurationUpdateResult
}

export type PersistedTechnicalProjectState = Pick<TechnicalProjectState, 'subprojects'>

const cloneSubprojects = (subprojects: readonly TechnicalSubproject[]) => subprojects.map(cloneTechnicalSubproject)

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const sanitizeString = (value: unknown) => typeof value === 'string' ? value.trim() : ''

const sanitizeConfiguration = (value: unknown): TechnicalSubprojectConfiguration => {
  const source = isRecord(value) ? value : {}
  const coreValue = TECHNICAL_CORE_VALUES.includes(source.coreValue as Exclude<TechnicalSubprojectCoreValue, ''>)
    ? source.coreValue as Exclude<TechnicalSubprojectCoreValue, ''>
    : ''
  const developmentMode = TECHNICAL_DEVELOPMENT_MODES.includes(source.developmentMode as Exclude<TechnicalSubprojectDevelopmentMode, ''>)
    ? source.developmentMode as Exclude<TechnicalSubprojectDevelopmentMode, ''>
    : ''
  return {
    coreValue,
    developmentMode,
    firstTosVersion: sanitizeString(source.firstTosVersion),
    firstMachineProjectId: sanitizeString(source.firstMachineProjectId),
  }
}

export function sanitizeTechnicalSubprojects(value: unknown): TechnicalSubproject[] | null {
  if (!Array.isArray(value)) return null
  const seenIds = new Set<string>()
  const sanitized: TechnicalSubproject[] = []
  value.forEach((candidate, index) => {
    if (!isRecord(candidate)) return
    const id = sanitizeString(candidate.id)
    const parentProjectId = sanitizeString(candidate.parentProjectId)
    const name = sanitizeString(candidate.name)
    if (!id || !parentProjectId || !name || seenIds.has(id)) return
    seenIds.add(id)
    const rawOrder = candidate.ipmOrder
    const ipmOrder = typeof rawOrder === 'number' && Number.isInteger(rawOrder) && rawOrder >= 0
      ? rawOrder
      : index + 1
    const legacyConfiguration = candidate.configuration ?? candidate.config
    const item: TechnicalSubproject = {
      id,
      parentProjectId,
      name,
      active: typeof candidate.active === 'boolean' ? candidate.active : true,
      ipmOrder,
      configuration: sanitizeConfiguration(legacyConfiguration),
    }
    const planInstanceId = sanitizeString(candidate.planInstanceId)
    if (planInstanceId) item.planInstanceId = planInstanceId
    if (isRecord(candidate.planReferences)) {
      item.planReferences = cloneTechnicalSubproject({
        ...item,
        planReferences: candidate.planReferences,
      }).planReferences
    }
    sanitized.push(item)
  })
  return sanitized.sort((left, right) => (
    left.parentProjectId.localeCompare(right.parentProjectId)
    || left.ipmOrder - right.ipmOrder
    || left.id.localeCompare(right.id)
  ))
}

export function migrateTechnicalProjectState(
  persistedState: unknown,
  _fromVersion: number,
): PersistedTechnicalProjectState {
  const source = isRecord(persistedState) ? persistedState.subprojects : undefined
  const sanitized = sanitizeTechnicalSubprojects(source)
  return { subprojects: sanitized ?? cloneSubprojects(INITIAL_TECHNICAL_SUBPROJECTS) }
}

export function mergeTechnicalProjectState(
  persistedState: unknown,
  currentState: TechnicalProjectState & TechnicalProjectActions,
): TechnicalProjectState & TechnicalProjectActions {
  return {
    ...currentState,
    ...migrateTechnicalProjectState(persistedState, TECHNICAL_PROJECT_STORE_VERSION),
  }
}

const isValidConfigurationPatch = (patch: TechnicalSubprojectConfigurationPatch) => (
  (patch.coreValue === undefined || patch.coreValue === '' || TECHNICAL_CORE_VALUES.includes(patch.coreValue))
  && (patch.developmentMode === undefined || patch.developmentMode === '' || TECHNICAL_DEVELOPMENT_MODES.includes(patch.developmentMode))
  && (patch.firstTosVersion === undefined || typeof patch.firstTosVersion === 'string')
  && (patch.firstMachineProjectId === undefined || typeof patch.firstMachineProjectId === 'string')
)

const synchronizeParent = (
  allSubprojects: readonly TechnicalSubproject[],
  parentProjectId: string,
  incoming: readonly IpmTechnicalSubproject[],
) => {
  const invalidResult = (reason: 'duplicate-id' | 'invalid-payload') => ({
    result: { ok: false as const, reason, items: allSubprojects },
    next: allSubprojects,
  })
  if (!parentProjectId.trim()) return invalidResult('invalid-payload')
  const allIds = allSubprojects.map(item => item.id)
  if (new Set(allIds).size !== allIds.length) return invalidResult('duplicate-id')
  const otherParentIds = new Set(
    allSubprojects
      .filter(item => item.parentProjectId !== parentProjectId)
      .map(item => item.id),
  )
  if (incoming.some(item => otherParentIds.has(String(item.id || '').trim()))) {
    return invalidResult('duplicate-id')
  }
  const scoped = allSubprojects.filter(item => item.parentProjectId === parentProjectId)
  const result = synchronizeTechnicalSubprojects(scoped, incoming, parentProjectId)
  if (!result.ok) return { result, next: allSubprojects }
  const untouched = allSubprojects.filter(item => item.parentProjectId !== parentProjectId)
  return {
    result,
    next: [...untouched, ...result.items].sort((left, right) => (
      left.parentProjectId.localeCompare(right.parentProjectId)
      || left.ipmOrder - right.ipmOrder
      || left.id.localeCompare(right.id)
    )),
  }
}

export function createTechnicalProjectStore(initial: Partial<TechnicalProjectState> = {}) {
  let subprojects = cloneSubprojects(initial.subprojects ?? INITIAL_TECHNICAL_SUBPROJECTS)
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach(listener => listener())
  return {
    getState: () => ({ subprojects: cloneSubprojects(subprojects) }),
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    synchronizeSubprojects: (parentProjectId: string, incoming: readonly IpmTechnicalSubproject[]) => {
      const { result, next } = synchronizeParent(subprojects, parentProjectId, incoming)
      if (result.ok) {
        subprojects = cloneSubprojects(next)
        notify()
      }
      return result
    },
    updateConfiguration: (subprojectId: string, patch: TechnicalSubprojectConfigurationPatch): ConfigurationUpdateResult => {
      const index = subprojects.findIndex(item => item.id === subprojectId)
      if (index < 0) return { ok: false, reason: 'missing' }
      if (!subprojects[index].active) return { ok: false, reason: 'inactive' }
      if (!isValidConfigurationPatch(patch)) return { ok: false, reason: 'invalid' }
      const next = cloneSubprojects(subprojects)
      next[index] = {
        ...next[index],
        configuration: {
          ...EMPTY_SUBPROJECT_CONFIGURATION,
          ...next[index].configuration,
          ...patch,
        },
      }
      subprojects = next
      notify()
      return { ok: true }
    },
  }
}

export const useTechnicalProjectStore = create<TechnicalProjectState & TechnicalProjectActions>()(persist<
  TechnicalProjectState & TechnicalProjectActions,
  [],
  [],
  PersistedTechnicalProjectState
>(
  (set, get) => ({
    subprojects: cloneSubprojects(INITIAL_TECHNICAL_SUBPROJECTS),
    synchronizeSubprojects: (parentProjectId, incoming) => {
      const { result, next } = synchronizeParent(get().subprojects, parentProjectId, incoming)
      if (result.ok) set({ subprojects: cloneSubprojects(next) })
      return result
    },
    updateConfiguration: (subprojectId, patch) => {
      const current = get().subprojects
      const index = current.findIndex(item => item.id === subprojectId)
      if (index < 0) return { ok: false, reason: 'missing' }
      if (!current[index].active) return { ok: false, reason: 'inactive' }
      if (!isValidConfigurationPatch(patch)) return { ok: false, reason: 'invalid' }
      const next = cloneSubprojects(current)
      next[index] = {
        ...next[index],
        configuration: {
          ...EMPTY_SUBPROJECT_CONFIGURATION,
          ...next[index].configuration,
          ...patch,
        },
      }
      set({ subprojects: next })
      return { ok: true }
    },
  }),
  {
    name: TECHNICAL_PROJECT_STORAGE_KEY,
    version: TECHNICAL_PROJECT_STORE_VERSION,
    storage: createJSONStorage(() => localStorage),
    migrate: migrateTechnicalProjectState,
    merge: mergeTechnicalProjectState,
    partialize: state => ({ subprojects: state.subprojects }),
  },
))
