import { create } from 'zustand'
import { PROJECT_TYPES } from '@/data/projects'

export interface UiState {
  // Navigation
  activeModule: string
  workspaceTab: 'projects' | 'workTracker'
  configTab: string
  sidebarCollapsed: boolean
  selectedProjectType: string
  projectSpaceModule: string

  // Edit guard
  isEditMode: boolean
  showLeaveConfirm: boolean
  pendingNavigation: (() => void) | null

  // Modals & overlays
  showVersionCompare: boolean
  showColumnModal: boolean
  showCreateLevel2Plan: boolean
  showAddCustomType: boolean
  showProjectSearch: boolean
  projectSearchText: string
}

export interface UiActions {
  setActiveModule: (v: string) => void
  setWorkspaceTab: (v: 'projects' | 'workTracker') => void
  setConfigTab: (v: string) => void
  setSidebarCollapsed: (v: boolean | ((prev: boolean) => boolean)) => void
  setSelectedProjectType: (v: string) => void
  setProjectSpaceModule: (v: string) => void

  setIsEditMode: (v: boolean) => void
  setShowLeaveConfirm: (v: boolean) => void
  setPendingNavigation: (v: (() => void) | null) => void

  setShowVersionCompare: (v: boolean) => void
  setShowColumnModal: (v: boolean) => void
  setShowCreateLevel2Plan: (v: boolean) => void
  setShowAddCustomType: (v: boolean) => void
  setShowProjectSearch: (v: boolean) => void
  setProjectSearchText: (v: string) => void

  // Convenience methods
  navigateWithEditGuard: (action: () => void) => void
  handleConfirmLeave: () => void
  handleCancelLeave: () => void
}

export const useUiStore = create<UiState & UiActions>()((set, get) => ({
  // Navigation
  activeModule: 'projects',
  workspaceTab: 'projects',
  configTab: 'plan',
  sidebarCollapsed: false,
  selectedProjectType: PROJECT_TYPES[0], // '整机产品项目'
  projectSpaceModule: 'basic',

  // Edit guard
  isEditMode: false,
  showLeaveConfirm: false,
  pendingNavigation: null,

  // Modals & overlays
  showVersionCompare: false,
  showColumnModal: false,
  showCreateLevel2Plan: false,
  showAddCustomType: false,
  showProjectSearch: false,
  projectSearchText: '',

  // Setters
  setActiveModule: (v) => set({ activeModule: v }),
  setWorkspaceTab: (v) => set({ workspaceTab: v }),
  setConfigTab: (v) => set({ configTab: v }),
  setSidebarCollapsed: (v) => set((s) => ({ sidebarCollapsed: typeof v === 'function' ? v(s.sidebarCollapsed) : v })),
  setSelectedProjectType: (v) => set({ selectedProjectType: v }),
  setProjectSpaceModule: (v) => set({ projectSpaceModule: v }),

  setIsEditMode: (v) => set({ isEditMode: v }),
  setShowLeaveConfirm: (v) => set({ showLeaveConfirm: v }),
  setPendingNavigation: (v) => set({ pendingNavigation: v }),

  setShowVersionCompare: (v) => set({ showVersionCompare: v }),
  setShowColumnModal: (v) => set({ showColumnModal: v }),
  setShowCreateLevel2Plan: (v) => set({ showCreateLevel2Plan: v }),
  setShowAddCustomType: (v) => set({ showAddCustomType: v }),
  setShowProjectSearch: (v) => set({ showProjectSearch: v }),
  setProjectSearchText: (v) => set({ projectSearchText: v }),

  // Convenience methods
  navigateWithEditGuard: (action) => {
    const { isEditMode } = get()
    // NOTE: isCurrentDraft check will be added when integrating with plan store
    if (isEditMode) {
      set({ pendingNavigation: () => action, showLeaveConfirm: true })
    } else {
      action()
    }
  },

  handleConfirmLeave: () => {
    const { pendingNavigation } = get()
    set({ isEditMode: false, showLeaveConfirm: false })
    if (pendingNavigation) {
      pendingNavigation()
      set({ pendingNavigation: null })
    }
  },

  handleCancelLeave: () => {
    set({ showLeaveConfirm: false, pendingNavigation: null })
  },
}))
