import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  EMPTY_SUBPROJECT_CONFIGURATION,
  synchronizeTechnicalSubprojects,
} from '@/lib/technicalProjectRules'
import type {
  IpmTechnicalSubproject,
  TechnicalSubproject,
  TechnicalSubprojectConfigurationPatch,
  TechnicalSubprojectDevelopmentMode,
  TechnicalSubprojectCoreValue,
  TechnicalSubprojectSyncResult,
} from '@/types/technicalProject'

export const TECHNICAL_PROJECT_STORAGE_KEY = 'pms-technical-projects'
const TECHNICAL_PROJECT_STORE_VERSION = 1

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

type ConfigurationUpdateResult = { ok: true } | { ok: false; reason: 'missing' | 'invalid' }

export interface TechnicalProjectState {
  subprojects: TechnicalSubproject[]
}

export interface TechnicalProjectActions {
  synchronizeSubprojects: (parentProjectId: string, incoming: readonly IpmTechnicalSubproject[]) => TechnicalSubprojectSyncResult
  updateConfiguration: (subprojectId: string, patch: TechnicalSubprojectConfigurationPatch) => ConfigurationUpdateResult
}

const cloneSubproject = (subproject: TechnicalSubproject): TechnicalSubproject => ({
  ...subproject,
  configuration: { ...subproject.configuration },
})

const cloneSubprojects = (subprojects: readonly TechnicalSubproject[]) => subprojects.map(cloneSubproject)

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
  return {
    getState: () => ({ subprojects: cloneSubprojects(subprojects) }),
    synchronizeSubprojects: (parentProjectId: string, incoming: readonly IpmTechnicalSubproject[]) => {
      const { result, next } = synchronizeParent(subprojects, parentProjectId, incoming)
      if (result.ok) subprojects = cloneSubprojects(next)
      return result
    },
    updateConfiguration: (subprojectId: string, patch: TechnicalSubprojectConfigurationPatch): ConfigurationUpdateResult => {
      const index = subprojects.findIndex(item => item.id === subprojectId)
      if (index < 0) return { ok: false, reason: 'missing' }
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
      return { ok: true }
    },
  }
}

export const useTechnicalProjectStore = create<TechnicalProjectState & TechnicalProjectActions>()(persist(
  (set, get) => ({
    subprojects: cloneSubprojects(INITIAL_TECHNICAL_SUBPROJECTS),
    synchronizeSubprojects: (parentProjectId, incoming) => {
      const { result, next } = synchronizeParent(get().subprojects, parentProjectId, incoming)
      if (result.ok) set({ subprojects: cloneSubprojects(next) })
      return result
    },
    updateConfiguration: (subprojectId, patch) => {
      if (!isValidConfigurationPatch(patch)) return { ok: false, reason: 'invalid' }
      const current = get().subprojects
      const index = current.findIndex(item => item.id === subprojectId)
      if (index < 0) return { ok: false, reason: 'missing' }
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
    partialize: state => ({ subprojects: state.subprojects }),
  },
))
