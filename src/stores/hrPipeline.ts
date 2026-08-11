import { create } from 'zustand'
import {
  HR_SIDEBAR_NAV,
  HR_DEFAULT_ACTIVE_LEAF,
  type HrSidebarGroupKey,
} from '@/constants/hrPipeline'

/* ── State / Actions interfaces ────────────────────────────────────── */

export interface HrPipelineState {
  /** Currently selected leaf item key (e.g. 'overview/manpower') */
  activeLeaf: string
  /** Set of expanded group keys in the sidebar tree */
  expandedGroups: Set<HrSidebarGroupKey>
}

export interface HrPipelineActions {
  setActiveLeaf: (key: string) => void
  /** Toggle a parent group's expanded state */
  toggleGroup: (groupKey: HrSidebarGroupKey) => void
  /** Expand a specific group */
  expandGroup: (groupKey: HrSidebarGroupKey) => void
  /** Collapse a specific group */
  collapseGroup: (groupKey: HrSidebarGroupKey) => void
  /** Expand all groups */
  expandAllGroups: () => void
  /** Collapse all groups */
  collapseAllGroups: () => void
  /** Reset to defaults — called when entering module */
  resetToDefaults: () => void
}

/* ── Defaults ──────────────────────────────────────────────────────── */

const ALL_GROUP_KEYS = HR_SIDEBAR_NAV.map(g => g.key)
const DEFAULT_EXPANDED = new Set<HrSidebarGroupKey>(ALL_GROUP_KEYS)

/* ── Store ─────────────────────────────────────────────────────────── */

export const useHrPipelineStore = create<HrPipelineState & HrPipelineActions>()((set, get) => ({
  activeLeaf: HR_DEFAULT_ACTIVE_LEAF,
  expandedGroups: new Set(DEFAULT_EXPANDED),

  setActiveLeaf: (key) => set({ activeLeaf: key }),

  toggleGroup: (groupKey) => {
    const next = new Set(get().expandedGroups)
    if (next.has(groupKey)) {
      next.delete(groupKey)
    } else {
      next.add(groupKey)
    }
    set({ expandedGroups: next })
  },

  expandGroup: (groupKey) => {
    const next = new Set(get().expandedGroups)
    next.add(groupKey)
    set({ expandedGroups: next })
  },

  collapseGroup: (groupKey) => {
    const next = new Set(get().expandedGroups)
    next.delete(groupKey)
    set({ expandedGroups: next })
  },

  expandAllGroups: () => set({ expandedGroups: new Set(ALL_GROUP_KEYS) }),
  collapseAllGroups: () => set({ expandedGroups: new Set() }),

  resetToDefaults: () => set({
    activeLeaf: HR_DEFAULT_ACTIVE_LEAF,
    expandedGroups: new Set(DEFAULT_EXPANDED),
  }),
}))
