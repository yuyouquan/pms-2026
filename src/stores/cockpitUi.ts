import { create } from 'zustand'
import type { CockpitMode, CockpitScope } from '@/components/cockpit/cockpitData'
import type { HrProjectCategory } from '@/lib/hrFormalProjectSource'
import type { CockpitTableView } from '@/components/cockpit/cockpitTableView'
import { validDashboardDate } from '@/components/project-resources/resourceDashboardPeriods'

export interface CockpitPreferences {
  view: 'management' | 'technical'
  dates: [string, string]
  periodHistory: [string, string][]
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
  rankingMetric: 'budget' | 'actual'
}

export function createCockpitPreferences(now = new Date()): CockpitPreferences {
  const year = now.getFullYear()
  return {
    view: 'management', dates: [`${year}-01-01`, `${year}-12-31`], periodHistory: [], departments: [], mode: 'labor',
    trendTab: 'resource', grain: 'month', hiddenTrendSeries: { resource: [], category: [] }, shareTab: 'research', shareScopePreferences: {},
    overviewTab: 'category', projectCategory: 'all', projectSearch: '', overviewTables: {}, rankingMetric: 'actual',
  }
}

interface CockpitUiState {
  preferencesByActor: Record<string, CockpitPreferences>
  updatePreferences: (actor: string, patch: Partial<CockpitPreferences>) => void
  updateOverviewTable: (actor: string, table: CockpitPreferences['overviewTab'], view: CockpitTableView) => void
  focusPeriod: (actor: string, patch: Pick<CockpitPreferences, 'dates' | 'scopePreference' | 'shareScopePreferences'>) => boolean
  returnToPeriod: (actor: string) => boolean
  resetFilters: (actor: string) => void
}

/** Navigation memory only. Live resources and authorization are always recomputed; nothing is persisted to disk. */
export const useCockpitUiStore = create<CockpitUiState>((set) => ({
  preferencesByActor: {},
  updatePreferences: (actor, patch) => set(state => ({
    preferencesByActor: { ...state.preferencesByActor, [actor]: { ...(state.preferencesByActor[actor] ?? createCockpitPreferences()), ...patch, ...(patch.dates ? { periodHistory: [] } : {}) } },
  })),
  updateOverviewTable: (actor, table, view) => set(state => {
    const current = state.preferencesByActor[actor] ?? createCockpitPreferences()
    return { preferencesByActor: { ...state.preferencesByActor, [actor]: { ...current, overviewTables: { ...current.overviewTables, [table]: view } } } }
  }),
  focusPeriod: (actor, patch) => {
    let changed = false
    set(state => {
      const current = state.preferencesByActor[actor] ?? createCockpitPreferences(), [start, end] = patch.dates
      if (![...current.dates, start, end].every(validDashboardDate) || start > end || start < current.dates[0] || end > current.dates[1] || (start === current.dates[0] && end === current.dates[1])) return state
      changed = true
      return { preferencesByActor: { ...state.preferencesByActor, [actor]: {
        ...current, ...patch, dates: [start, end], shareScopePreferences: { ...patch.shareScopePreferences },
        periodHistory: [...current.periodHistory, [...current.dates] as [string, string]].slice(-8),
      } } }
    })
    return changed
  },
  returnToPeriod: actor => {
    let changed = false
    set(state => {
      const current = state.preferencesByActor[actor], previous = current?.periodHistory.at(-1)
      if (!previous) return state
      changed = true
      return { preferencesByActor: { ...state.preferencesByActor, [actor]: { ...current, dates: [...previous], periodHistory: current.periodHistory.slice(0, -1) } } }
    })
    return changed
  },
  resetFilters: actor => set(state => {
    const defaults = createCockpitPreferences()
    return { preferencesByActor: { ...state.preferencesByActor, [actor]: {
      ...(state.preferencesByActor[actor] ?? defaults), dates: defaults.dates, periodHistory: [], scopePreference: undefined,
      departments: [], shareScopePreferences: {}, projectCategory: 'all', projectSearch: '',
    } } }
  }),
}))
