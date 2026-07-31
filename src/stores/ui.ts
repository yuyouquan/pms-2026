import { create } from 'zustand'
import { PROJECT_CATEGORY_MACHINE } from '@/constants/projectTypes'

export type MainModule =
  | 'workbench'
  | 'projectList'
  | 'roadmap'
  | 'hrPipeline'
  | 'config'
  | 'projectSpace'

export type WorkbenchTab = 'todo' | 'workTracker'

export type ProjectSpaceOrigin = {
  module: Exclude<MainModule, 'projectSpace'>
  workbenchTab?: WorkbenchTab
} | null

export interface UiState {
  // Navigation
  activeModule: MainModule
  workbenchTab: WorkbenchTab
  projectSpaceOrigin: ProjectSpaceOrigin
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
  setActiveModule: (v: MainModule) => void
  setWorkbenchTab: (v: WorkbenchTab) => void
  enterProjectSpace: (origin: NonNullable<ProjectSpaceOrigin>) => void
  returnFromProjectSpace: () => void
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
  navigateWithEditGuard: (action: () => void, isCurrentDraft: boolean) => void
  handleConfirmLeave: () => void
  handleCancelLeave: () => void
}

export const useUiStore = create<UiState & UiActions>()((set, get) => ({
  // Navigation
  activeModule: 'workbench',
  workbenchTab: 'todo',
  projectSpaceOrigin: null,
  configTab: 'plan',
  sidebarCollapsed: false,
  selectedProjectType: PROJECT_CATEGORY_MACHINE,
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
  setActiveModule: (v) => {
    const { activeModule, workbenchTab, projectSpaceOrigin } = get()
    // Compatibility for existing callers that still navigate directly. New
    // project-space entry points should call enterProjectSpace explicitly.
    if (v === 'projectSpace' && activeModule !== 'projectSpace' && !projectSpaceOrigin) {
      set({
        activeModule: v,
        projectSpaceOrigin: {
          module: activeModule,
          ...(activeModule === 'workbench' ? { workbenchTab } : {}),
        },
      })
      return
    }
    set({ activeModule: v })
  },
  setWorkbenchTab: (v) => set({ workbenchTab: v }),
  enterProjectSpace: (origin) => set({
    activeModule: 'projectSpace',
    projectSpaceOrigin: origin.module === 'workbench'
      ? { module: 'workbench', workbenchTab: origin.workbenchTab ?? get().workbenchTab }
      : { module: origin.module },
  }),
  returnFromProjectSpace: () => {
    const projectSpaceOrigin = get().projectSpaceOrigin ?? {
      module: 'workbench' as const,
      workbenchTab: 'todo' as const,
    }
    const { module, workbenchTab } = projectSpaceOrigin
    set({
      activeModule: module,
      workbenchTab: module === 'workbench' ? (workbenchTab ?? 'todo') : get().workbenchTab,
      projectSpaceOrigin: null,
    })
  },
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
  navigateWithEditGuard: (action, isCurrentDraft) => {
    const { isEditMode } = get()
    if (isEditMode && !isCurrentDraft) {
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
