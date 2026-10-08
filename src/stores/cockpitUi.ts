import { create } from 'zustand'
import type { CockpitMode, CockpitScope } from '@/components/cockpit/cockpitData'
import type { HrProjectCategory } from '@/lib/hrFormalProjectSource'
import type { CockpitTableView } from '@/components/cockpit/cockpitTableView'

export interface CockpitPreferences {
  view: 'management' | 'technical'
  dates: [string, string]
  scopePreference?: CockpitScope
  departments: string[]
  mode: CockpitMode
  trendTab: 'resource' | 'category'
  grain: 'month' | 'week'
  hiddenTrendSeries: Record<'resource' | 'category', string[]>
  shareTab: 'research' | 'category'
  shareScopePreferences: Partial<Record<'research' | 'category', CockpitScope>>
  overviewTab: 'category' | 'department' | 'project'
  projectCategory: 'all' | HrProjectCategory
  projectSearch: string
  overviewTables: Partial<Record<'category' | 'department' | 'project', CockpitTableView>>
}

export function createCockpitPreferences(now = new Date()): CockpitPreferences {
  const year = now.getFullYear()
  return {
    view: 'management', dates: [`${year}-01-01`, `${year}-12-31`], departments: [], mode: 'labor',
    trendTab: 'resource', grain: 'month', hiddenTrendSeries: { resource: [], category: [] }, shareTab: 'research', shareScopePreferences: {},
    overviewTab: 'category', projectCategory: 'all', projectSearch: '', overviewTables: {},
  }
}

interface CockpitUiState {
  preferencesByActor: Record<string, CockpitPreferences>
  updatePreferences: (actor: string, patch: Partial<CockpitPreferences>) => void
  updateOverviewTable: (actor: string, table: CockpitPreferences['overviewTab'], view: CockpitTableView) => void
  resetFilters: (actor: string) => void
}

/** Navigation memory only. Live resources and authorization are always recomputed; nothing is persisted to disk. */
export const useCockpitUiStore = create<CockpitUiState>((set) => ({
  preferencesByActor: {},
  updatePreferences: (actor, patch) => set(state => ({
    preferencesByActor: { ...state.preferencesByActor, [actor]: { ...(state.preferencesByActor[actor] ?? createCockpitPreferences()), ...patch } },
  })),
  updateOverviewTable: (actor, table, view) => set(state => {
    const current = state.preferencesByActor[actor] ?? createCockpitPreferences()
    return { preferencesByActor: { ...state.preferencesByActor, [actor]: { ...current, overviewTables: { ...current.overviewTables, [table]: view } } } }
  }),
  resetFilters: actor => set(state => {
    const defaults = createCockpitPreferences()
    return { preferencesByActor: { ...state.preferencesByActor, [actor]: {
      ...(state.preferencesByActor[actor] ?? defaults), dates: defaults.dates, scopePreference: undefined,
      departments: [], shareScopePreferences: {}, projectCategory: 'all', projectSearch: '',
    } } }
  }),
}))
