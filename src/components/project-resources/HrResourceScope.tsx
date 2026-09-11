'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { createStore, useStore, type StoreApi, type UseBoundStore } from 'zustand'
import { useProjectStore } from '@/stores/project'
import { usePermissionStore } from '@/stores/permission'
import { selectActiveHrMonthlyRows } from '@/lib/hrMonthlySync'
import { getLatestHrVersion } from '@/lib/hrVersionRules'
import { canAccessHrProject, canEditHrInScope, isHrVersionVisible, type HrRegistryRecord } from '@/lib/hrProjectRegistry'
import { useUiStore } from '@/stores/ui'

type UiState = Record<string, unknown>
const ScopeContext = createContext<{ projectId: string; ui: StoreApi<UiState> } | null>(null)
export const useHrResourceScope = () => useContext(ScopeContext)?.projectId
export function HrResourceScope({ projectId, children }: { projectId: string; children: ReactNode }) {
  const value = useMemo(() => ({ projectId, ui: createStore<UiState>(() => ({})) }), [projectId])
  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>
}
const emptyUi = createStore<UiState>(() => ({}))
interface ViewState {
  projects: Array<HrRegistryRecord & { versions: Array<import('@/lib/hrVersionRules').HrVersionIdentity> }>
  monthlyInvestments: Array<{ isArchived?: boolean; projectId: string; versionId: string }>
}
/** Business records/actions remain in the domain store; only scoped filters and dialog state are local. */
export function createHrViewHook<T extends ViewState>(original: UseBoundStore<StoreApi<T>>) {
  function useView<U = T>(selector?: (state: T) => U): U {
    const state = original()
    const scope = useContext(ScopeContext)
    const local = useStore(scope?.ui || emptyUi)
    const registry = useProjectStore(s => s.projects)
    const actor = useProjectStore(s => s.currentLoginUser)
    const permissions = usePermissionStore()
    const merged = useMemo(() => {
      const projects = state.projects.filter(project => canAccessHrProject(project)).map(project => ({ ...project,
        versions: project.versions.filter(version => isHrVersionVisible(project, version.budgetType, scope?.projectId)),
      })).filter(project => !scope || project.pmsProjectId === scope.projectId || project.versions.length > 0)
      const visibleIds = new Set(projects.map(project => project.id))
      const visibleVersions = new Set(projects.flatMap(project => ['annual', 'projectEstimate', 'projectBudget'].map(type => getLatestHrVersion(project.versions, type)?.id)))
      const result = { ...state, projects, monthlyInvestments: selectActiveHrMonthlyRows(state.monthlyInvestments).filter(row => visibleIds.has(row.projectId) && visibleVersions.has(row.versionId)) } as T
      const view = result as unknown as UiState
      // Resource metadata is managed through the canonical configuration entry.
      view.showNewProjectModal = false
      view.setShowNewProjectModal = (open: boolean) => { if (open) useUiStore.getState().navigateWithEditGuard(() => useUiStore.getState().openProjectConfiguration(), false) }
      if (scope) {
        for (const [key, value] of Object.entries(state)) {
          if (key === 'activeTab') view[key] = 'historyVersion'
          else if (key === 'selectedProjectId') view[key] = local[key] ?? projects.find(project => project.pmsProjectId === scope.projectId)?.id ?? null
          else if (key.toLowerCase().includes('filter')) {
            if (typeof value !== 'function') view[key] = local[key] ?? Object.fromEntries(Object.entries(value as object).map(([field, v]) => [field, Array.isArray(v) ? [] : v]))
          } else if (/^(show|editing|historyVersionId|versionDetailReadOnly|selectedBudgetTypes)/.test(key)) view[key] = local[key] ?? (typeof value === 'boolean' ? false : Array.isArray(value) ? [] : null)
          if (key.startsWith('set') && typeof value === 'function' && key !== 'setShowNewProjectModal') {
            const field = key.charAt(3).toLowerCase() + key.slice(4)
            view[key] = (next: unknown) => scope.ui.setState(current => ({ [field]: field.toLowerCase().includes('filter') ? { ...(view[field] as object), ...(current[field] as object), ...(next as object) } : next }))
          }
        }
        // A linked annual row remains readonly even when the current user can edit its source elsewhere.
        for (const key of ['addVersion','copyVersion','deleteVersion','updateVersion','updateVersionDepartmentInvestments','updateDepartmentInvestments']) {
          const action = (state as unknown as UiState)[key]
          if (typeof action === 'function') view[key] = (projectId: string, ...args: unknown[]) => {
            if (canEditHrInScope(state.projects.find(project => project.id === projectId), scope.projectId)) return action(projectId, ...args)
          }
        }
      }
      return result
    }, [state, scope, local, registry, actor, permissions])
    return selector ? selector(merged) : merged as unknown as U
  }
  return Object.assign(useView, { getState: original.getState })
}
