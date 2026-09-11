import { create } from 'zustand'
import { PROJECT_CATEGORY_MACHINE } from '@/constants/projectTypes'
import type { AnyFilterCondition } from '@/lib/filterConditions'

export type MainModule =
  | 'workbench'
  | 'projectManagement'
  | 'jointProjectSpace'
  | 'roadmap'
  | 'hrPipeline'
  | 'config'
  | 'projectSpace'

export type WorkbenchTab = 'todo'
export type ProjectManagementTab = 'configuration' | 'view'

export interface PlanNavigationIntent {
  source: 'todo'
  projectId: string
  currentUser: string
  planLevel: 'level1' | 'level2'
  planKey: string
  versionId: string
  market?: string
  marketKey?: string
  tosType?: string
  tosTypeKey?: string
}

export interface MrPlanNavigationIntent {
  source: 'joint-mr'
  projectId: string
  mrTosVersion: string
}

export type ProjectSpaceOrigin = {
  module: Exclude<MainModule, 'projectSpace'>
  workbenchTab?: WorkbenchTab
  projectManagementTab?: ProjectManagementTab
} | null

export interface UiState {
  // Navigation
  activeModule: MainModule
  workbenchTab: WorkbenchTab
  projectManagementTab: ProjectManagementTab
  projectConfigurationPage: number
  projectListSummaryFilters: AnyFilterCondition[]
  projectListTechnicalFilters: AnyFilterCondition[]
  projectListAboutMineOnly: boolean
  projectListTablePage: number
  projectSpaceOrigin: ProjectSpaceOrigin
  configTab: string
  configSidebarCollapsed: boolean
  projectSpaceSidebarCollapsed: boolean
  hrSidebarCollapsed: boolean
  selectedProjectType: string
  projectSpaceModule: string
  planNavigationIntent: PlanNavigationIntent | null
  mrPlanNavigationIntent: MrPlanNavigationIntent | null

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
  setProjectManagementTab: (v: ProjectManagementTab) => void
  openProjectConfiguration: () => void
  setProjectConfigurationPage: (v: number) => void
  setProjectListSummaryFilters: (v: AnyFilterCondition[] | ((previous: AnyFilterCondition[]) => AnyFilterCondition[])) => void
  setProjectListTechnicalFilters: (v: AnyFilterCondition[] | ((previous: AnyFilterCondition[]) => AnyFilterCondition[])) => void
  setProjectListAboutMineOnly: (v: boolean | ((previous: boolean) => boolean)) => void
  setProjectListTablePage: (v: number) => void
  enterProjectSpace: (origin: NonNullable<ProjectSpaceOrigin>) => void
  returnFromProjectSpace: () => void
  setConfigTab: (v: string) => void
  setConfigSidebarCollapsed: (v: boolean | ((prev: boolean) => boolean)) => void
  setProjectSpaceSidebarCollapsed: (v: boolean | ((prev: boolean) => boolean)) => void
  setHrSidebarCollapsed: (v: boolean | ((prev: boolean) => boolean)) => void
  setSelectedProjectType: (v: string) => void
  setProjectSpaceModule: (v: string) => void
  setPlanNavigationIntent: (v: PlanNavigationIntent | null) => void
  setMrPlanNavigationIntent: (v: MrPlanNavigationIntent) => void
  consumeMrPlanNavigationIntent: () => MrPlanNavigationIntent | null
  clearMrPlanNavigationIntent: () => void

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
  projectManagementTab: 'configuration',
  projectConfigurationPage: 1,
  projectListSummaryFilters: [],
  projectListTechnicalFilters: [{
    id: 'quick-technicalProjectType',
    field: 'technicalProjectType',
    operator: 'contains',
    value: ['tdt'],
  }],
  projectListAboutMineOnly: true,
  projectListTablePage: 1,
  projectSpaceOrigin: null,
  configTab: 'plan',
  configSidebarCollapsed: false,
  projectSpaceSidebarCollapsed: false,
  hrSidebarCollapsed: false,
  selectedProjectType: PROJECT_CATEGORY_MACHINE,
  projectSpaceModule: 'basic',
  planNavigationIntent: null,
  mrPlanNavigationIntent: null,

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
    const { activeModule, workbenchTab, projectManagementTab, projectSpaceOrigin } = get()
    // Compatibility for existing callers that still navigate directly. New
    // project-space entry points should call enterProjectSpace explicitly.
    if (v === 'projectSpace' && activeModule !== 'projectSpace' && !projectSpaceOrigin) {
      set({
        activeModule: v,
        projectSpaceOrigin: {
          module: activeModule,
          ...(activeModule === 'workbench' ? { workbenchTab } : {}),
          ...(activeModule === 'projectManagement' ? { projectManagementTab } : {}),
        },
      })
      return
    }
    set({ activeModule: v, ...(v !== 'projectSpace' ? { mrPlanNavigationIntent: null } : {}) })
  },
  setWorkbenchTab: (v) => set({ workbenchTab: v }),
  setProjectManagementTab: (v) => set({ projectManagementTab: v }),
  openProjectConfiguration: () => set({
    activeModule: 'projectManagement',
    projectManagementTab: 'configuration',
    mrPlanNavigationIntent: null,
  }),
  setProjectConfigurationPage: (v) => set({ projectConfigurationPage: v }),
  setProjectListSummaryFilters: (v) => set(state => ({
    projectListSummaryFilters: typeof v === 'function' ? v(state.projectListSummaryFilters) : v,
  })),
  setProjectListTechnicalFilters: (v) => set(state => ({
    projectListTechnicalFilters: typeof v === 'function' ? v(state.projectListTechnicalFilters) : v,
  })),
  setProjectListAboutMineOnly: (v) => set(state => ({
    projectListAboutMineOnly: typeof v === 'function' ? v(state.projectListAboutMineOnly) : v,
  })),
  setProjectListTablePage: (v) => set({ projectListTablePage: v }),
  enterProjectSpace: (origin) => set({
    activeModule: 'projectSpace',
    projectSpaceOrigin: origin.module === 'workbench'
      ? { module: 'workbench', workbenchTab: origin.workbenchTab ?? get().workbenchTab }
      : origin.module === 'projectManagement'
        ? { module: 'projectManagement', projectManagementTab: origin.projectManagementTab ?? get().projectManagementTab }
        : { module: origin.module },
  }),
  returnFromProjectSpace: () => {
    const projectSpaceOrigin = get().projectSpaceOrigin ?? {
      module: 'workbench' as const,
      workbenchTab: 'todo' as const,
    }
    const { module, workbenchTab, projectManagementTab } = projectSpaceOrigin
    set({
      activeModule: module,
      workbenchTab: module === 'workbench' ? (workbenchTab ?? 'todo') : get().workbenchTab,
      projectManagementTab: module === 'projectManagement'
        ? (projectManagementTab ?? get().projectManagementTab)
        : get().projectManagementTab,
      projectSpaceOrigin: null,
      mrPlanNavigationIntent: null,
    })
  },
  setConfigTab: (v) => set({ configTab: v }),
  setConfigSidebarCollapsed: (v) => set((s) => ({
    configSidebarCollapsed: typeof v === 'function' ? v(s.configSidebarCollapsed) : v,
  })),
  setProjectSpaceSidebarCollapsed: (v) => set((s) => ({
    projectSpaceSidebarCollapsed: typeof v === 'function' ? v(s.projectSpaceSidebarCollapsed) : v,
  })),
  setHrSidebarCollapsed: (v) => set((s) => ({
    hrSidebarCollapsed: typeof v === 'function' ? v(s.hrSidebarCollapsed) : v,
  })),
  setSelectedProjectType: (v) => set({ selectedProjectType: v }),
  setProjectSpaceModule: (v) => set({ projectSpaceModule: v }),
  setPlanNavigationIntent: (v) => set({ planNavigationIntent: v }),
  setMrPlanNavigationIntent: (v) => set({ mrPlanNavigationIntent: v }),
  consumeMrPlanNavigationIntent: () => {
    const intent = get().mrPlanNavigationIntent
    if (intent) set({ mrPlanNavigationIntent: null })
    return intent
  },
  clearMrPlanNavigationIntent: () => set({ mrPlanNavigationIntent: null }),

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
      set({ pendingNavigation: action, showLeaveConfirm: true })
    } else {
      action()
    }
  },

  handleConfirmLeave: () => {
    const { pendingNavigation } = get()
    if (pendingNavigation) {
      pendingNavigation()
    }
    set({ isEditMode: false, showLeaveConfirm: false, pendingNavigation: null })
  },

  handleCancelLeave: () => {
    set({ showLeaveConfirm: false, pendingNavigation: null })
  },
}))
