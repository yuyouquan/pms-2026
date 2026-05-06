# PMS-2026 Core Refactor: Zustand Stores + Container Components

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Break the 4720-line monolithic `page.tsx` into domain-specific Zustand stores and container components, reducing `page.tsx` to ~150 lines of routing.

**Architecture:** Create 5 Zustand stores (ui, project, plan, transfer, permission) that own all state currently in `useState` hooks. Extract 5 container components (AppShell, WorkspaceContainer, ProjectSpaceContainer, ConfigContainer, GlobalPermissionContainer) that consume stores directly. The existing extracted UI components (WorkspaceModule, PlanModule, TransferModule, PermissionModule) keep their props interface unchanged initially — containers wire store state to their props.

**Tech Stack:** Zustand 4.5.4 (already installed), React 18, Next.js 14, TypeScript 5.5

---

## File Structure

```
src/
├── stores/
│   ├── ui.ts              — activeModule, configTab, sidebar, modals, viewModes
│   ├── project.ts         — projects, selectedProject, filters, loginUser, basicInfoEdit
│   ├── plan.ts            — tasks, versions, level2Plans, milestones, columns, exports, notifications
│   ├── transfer.ts        — transferApps, checklist, reviewElements, forms, modals
│   └── permission.ts      — roles, rolePermissions, globalRoles, globalRolePerms
├── containers/
│   ├── AppShell.tsx        — top nav bar + user switcher (shared by main layout & project space)
│   ├── WorkspaceContainer.tsx  — workspace tab (projects list/cards + work tracker + todos)
│   ├── ProjectSpaceContainer.tsx — project space layout (sidebar + content routing)
│   ├── ConfigContainer.tsx     — config center (plan template + transfer template tabs)
│   └── GlobalPermissionContainer.tsx — global permission center
├── app/
│   └── page.tsx           — ~150 lines, imports containers, routes by activeModule
```

---

### Task 1: Create `src/stores/ui.ts` — UI/Navigation Store

**Files:**
- Create: `src/stores/ui.ts`

This store holds all navigation, view mode, sidebar, and modal visibility state. These are the "cross-cutting" states that multiple containers need.

- [ ] **Step 1: Create the UI store**

```typescript
// src/stores/ui.ts
import { create } from 'zustand'

interface UIState {
  // Top-level navigation
  activeModule: string
  setActiveModule: (m: string) => void

  // Workspace
  workspaceTab: 'projects' | 'workTracker'
  setWorkspaceTab: (t: 'projects' | 'workTracker') => void

  // Config center
  configTab: string
  setConfigTab: (t: string) => void
  sidebarCollapsed: boolean
  setSidebarCollapsed: (v: boolean) => void
  selectedProjectType: string
  setSelectedProjectType: (t: string) => void

  // Project space navigation
  projectSpaceModule: string
  setProjectSpaceModule: (m: string) => void

  // Edit guard
  isEditMode: boolean
  setIsEditMode: (v: boolean) => void
  showLeaveConfirm: boolean
  setShowLeaveConfirm: (v: boolean) => void
  pendingNavigation: (() => void) | null
  setPendingNavigation: (fn: (() => void) | null) => void

  // Modals
  showVersionCompare: boolean
  setShowVersionCompare: (v: boolean) => void
  showColumnModal: boolean
  setShowColumnModal: (v: boolean) => void
  showCreateLevel2Plan: boolean
  setShowCreateLevel2Plan: (v: boolean) => void
  showAddCustomType: boolean
  setShowAddCustomType: (v: boolean) => void

  // Project search dropdown (project space header)
  showProjectSearch: boolean
  setShowProjectSearch: (v: boolean) => void
  projectSearchText: string
  setProjectSearchText: (t: string) => void

  // Helpers
  navigateWithEditGuard: (action: () => void) => void
  handleConfirmLeave: () => void
  handleCancelLeave: () => void
}

export const useUIStore = create<UIState>((set, get) => ({
  activeModule: 'projects',
  setActiveModule: (m) => set({ activeModule: m }),

  workspaceTab: 'projects',
  setWorkspaceTab: (t) => set({ workspaceTab: t }),

  configTab: 'plan',
  setConfigTab: (t) => set({ configTab: t }),
  sidebarCollapsed: false,
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  selectedProjectType: '整机产品项目',
  setSelectedProjectType: (t) => set({ selectedProjectType: t }),

  projectSpaceModule: 'basic',
  setProjectSpaceModule: (m) => set({ projectSpaceModule: m }),

  isEditMode: false,
  setIsEditMode: (v) => set({ isEditMode: v }),
  showLeaveConfirm: false,
  setShowLeaveConfirm: (v) => set({ showLeaveConfirm: v }),
  pendingNavigation: null,
  setPendingNavigation: (fn) => set({ pendingNavigation: fn }),

  showVersionCompare: false,
  setShowVersionCompare: (v) => set({ showVersionCompare: v }),
  showColumnModal: false,
  setShowColumnModal: (v) => set({ showColumnModal: v }),
  showCreateLevel2Plan: false,
  setShowCreateLevel2Plan: (v) => set({ showCreateLevel2Plan: v }),
  showAddCustomType: false,
  setShowAddCustomType: (v) => set({ showAddCustomType: v }),

  showProjectSearch: false,
  setShowProjectSearch: (v) => set({ showProjectSearch: v }),
  projectSearchText: '',
  setProjectSearchText: (t) => set({ projectSearchText: t }),

  navigateWithEditGuard: (action) => {
    const { isEditMode, setPendingNavigation, setShowLeaveConfirm } = get()
    if (isEditMode) {
      setPendingNavigation(action)
      setShowLeaveConfirm(true)
    } else {
      action()
    }
  },

  handleConfirmLeave: () => {
    const { pendingNavigation } = get()
    set({ isEditMode: false, showLeaveConfirm: false, pendingNavigation: null })
    if (pendingNavigation) pendingNavigation()
  },

  handleCancelLeave: () => {
    set({ showLeaveConfirm: false, pendingNavigation: null })
  },
}))
```

- [ ] **Step 2: Verify file compiles**

Run: `npx tsc --noEmit src/stores/ui.ts 2>&1 | head -20`
Expected: No errors (or only unrelated existing errors)

- [ ] **Step 3: Commit**

```bash
git add src/stores/ui.ts
git commit -m "refactor: add Zustand UI store for navigation and modal state"
```

---

### Task 2: Create `src/stores/project.ts` — Project Store

**Files:**
- Create: `src/stores/project.ts`

Holds projects array, selected project, workspace filters, login user, and basic info edit state.

- [ ] **Step 1: Create the project store**

```typescript
// src/stores/project.ts
import { create } from 'zustand'
import { initialProjects, PROJECT_TYPES } from '@/data/projects'
import { ALL_USERS } from '@/components/permission/PermissionModule'

const DEFAULT_LOGIN_USER = '张三'

// Project member visibility map (mirrors page.tsx PROJECT_MEMBER_MAP)
export const PROJECT_MEMBER_MAP: Record<string, string[]> = {
  'proj-1': ['张三', '李四', '王五', '赵六', '孙七', '李白'],
  'proj-2': ['张三', '李四', '杜甫'],
  'proj-3': ['王五', '赵六', '孙七', '周八'],
  'proj-4': ['张三', '李白', '杜甫'],
  'proj-5': ['李四', '王五', '赵六'],
  'proj-6': ['张三', '孙七', '周八'],
  'proj-7': ['赵六', '李白'],
  'proj-8': ['张三', '王五', '杜甫'],
  'proj-9': ['李四', '孙七', '周八', '李白'],
}

type ProjectItem = typeof initialProjects[0]

interface ProjectState {
  projects: ProjectItem[]
  setProjects: (fn: (prev: ProjectItem[]) => ProjectItem[]) => void

  selectedProject: ProjectItem | null
  setSelectedProject: (p: ProjectItem | null) => void

  // Login user
  currentLoginUser: string
  setCurrentLoginUser: (u: string) => void

  // Workspace filters
  projectSearchText2: string
  setProjectSearchText2: (t: string) => void
  projectStatusFilter: string
  setProjectStatusFilter: (s: string) => void
  projectTypeFilter: string
  setProjectTypeFilter: (t: string) => void
  projectListView: 'card' | 'list'
  setProjectListView: (v: 'card' | 'list') => void
  projectCardPage: number
  setProjectCardPage: (p: number) => void

  // Basic info edit
  basicInfoEditMode: boolean
  setBasicInfoEditMode: (v: boolean) => void
  editingProjectFields: Record<string, any>
  setEditingProjectFields: (fn: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)) => void

  // Market tab
  selectedMarketTab: string
  setSelectedMarketTab: (m: string) => void

  // Kanban
  kanbanDimension: 'stage' | 'type' | 'status'
  setKanbanDimension: (d: 'stage' | 'type' | 'status') => void

  // Todo
  todoFilter: 'all' | 'overdue' | 'upcoming' | 'pending' | 'completed'
  setTodoFilter: (f: 'all' | 'overdue' | 'upcoming' | 'pending' | 'completed') => void
  todoCollapsed: boolean
  setTodoCollapsed: (v: boolean) => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: initialProjects,
  setProjects: (fn) => set((s) => ({ projects: fn(s.projects) })),

  selectedProject: null,
  setSelectedProject: (p) => set({ selectedProject: p }),

  currentLoginUser: DEFAULT_LOGIN_USER,
  setCurrentLoginUser: (u) => set({ currentLoginUser: u }),

  projectSearchText2: '',
  setProjectSearchText2: (t) => set({ projectSearchText2: t }),
  projectStatusFilter: 'all',
  setProjectStatusFilter: (s) => set({ projectStatusFilter: s }),
  projectTypeFilter: 'all',
  setProjectTypeFilter: (t) => set({ projectTypeFilter: t }),
  projectListView: 'card',
  setProjectListView: (v) => set({ projectListView: v }),
  projectCardPage: 1,
  setProjectCardPage: (p) => set({ projectCardPage: p }),

  basicInfoEditMode: false,
  setBasicInfoEditMode: (v) => set({ basicInfoEditMode: v }),
  editingProjectFields: {},
  setEditingProjectFields: (fn) => set((s) => ({
    editingProjectFields: typeof fn === 'function' ? fn(s.editingProjectFields) : fn,
  })),

  selectedMarketTab: 'OP',
  setSelectedMarketTab: (m) => set({ selectedMarketTab: m }),

  kanbanDimension: 'stage',
  setKanbanDimension: (d) => set({ kanbanDimension: d }),

  todoFilter: 'all',
  setTodoFilter: (f) => set({ todoFilter: f }),
  todoCollapsed: false,
  setTodoCollapsed: (v) => set({ todoCollapsed: v }),
}))
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit src/stores/project.ts 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/stores/project.ts
git commit -m "refactor: add Zustand project store for projects, filters, and user state"
```

---

### Task 3: Create `src/stores/plan.ts` — Plan Store

**Files:**
- Create: `src/stores/plan.ts`

This is the largest store. Holds tasks, versions, level2 plans, view modes, columns, collapsed tree nodes, notification helpers, and export handlers.

- [ ] **Step 1: Create the plan store**

```typescript
// src/stores/plan.ts
import { create } from 'zustand'

// Re-export these constants so containers can import from one place
export const LEVEL2_PLAN_TYPES = ['1+N MR版本火车计划', '粉丝版本计划', '基础体验计划', 'WBS计划']
export const FIXED_LEVEL2_PLANS = [
  { id: 'plan0', name: '需求开发计划', type: '需求开发计划', fixed: true },
  { id: 'plan1', name: '在研版本火车计划', type: '在研版本火车计划', fixed: true },
]

// Column definitions (moved from page.tsx)
export const ALL_COLUMNS = [
  { key: 'id', title: '序号', default: true },
  { key: 'taskName', title: '任务名称', default: true },
  { key: 'responsible', title: '责任人', default: true },
  { key: 'predecessor', title: '前置任务', default: true },
  { key: 'planStartDate', title: '计划开始', default: true },
  { key: 'planEndDate', title: '计划完成', default: true },
  { key: 'estimatedDays', title: '预估工期', default: true },
  { key: 'actualStartDate', title: '实际开始', default: true },
  { key: 'actualEndDate', title: '实际完成', default: true },
  { key: 'actualDays', title: '实际工期', default: true },
  { key: 'status', title: '状态', default: true },
  { key: 'progress', title: '进度', default: true },
]

export const TABLE_COLUMNS = ALL_COLUMNS // alias for export usage

// Gantt-specific columns (superset)
export const GANTT_COLUMNS = [
  ...ALL_COLUMNS,
  { key: 'ganttBar', title: '甘特条', default: false },
]

export const getColumnsForView = (viewMode: string) => {
  if (viewMode === 'gantt') return GANTT_COLUMNS
  return ALL_COLUMNS
}

interface Version {
  id: string
  versionNo: string
  status: string
}

interface Level2Plan {
  id: string
  name: string
  type: string
  fixed?: boolean
}

interface PlanState {
  // Plan level & view
  planLevel: string
  setPlanLevel: (l: string) => void
  selectedPlanType: string
  setSelectedPlanType: (t: string) => void
  customTypes: string[]
  setCustomTypes: (fn: string[] | ((prev: string[]) => string[])) => void
  viewMode: 'table' | 'gantt'
  setViewMode: (m: 'table' | 'gantt') => void

  // Project space plan
  projectPlanLevel: string
  setProjectPlanLevel: (l: string) => void
  projectPlanViewMode: 'table' | 'horizontal' | 'gantt'
  setProjectPlanViewMode: (m: 'table' | 'horizontal' | 'gantt') => void
  projectPlanOverviewTab: string
  setProjectPlanOverviewTab: (t: string) => void
  planMetaCollapsed: boolean
  setPlanMetaCollapsed: (v: boolean) => void

  // Versions
  versions: Version[]
  setVersions: (v: Version[]) => void
  currentVersion: string
  setCurrentVersion: (v: string) => void

  // Tasks (L1)
  tasks: any[]
  setTasks: (t: any[] | ((prev: any[]) => any[])) => void
  searchText: string
  setSearchText: (t: string) => void

  // Level2
  level2PlanTasks: any[]
  setLevel2PlanTasks: (fn: any[] | ((prev: any[]) => any[])) => void
  level2PlanMilestones: string[]
  setLevel2PlanMilestones: (m: string[]) => void
  createdLevel2Plans: Level2Plan[]
  setCreatedLevel2Plans: (p: Level2Plan[]) => void
  activeLevel2Plan: string
  setActiveLevel2Plan: (id: string) => void
  level2PlanMeta: Record<string, any>
  setLevel2PlanMeta: (fn: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)) => void
  createFormValues: Record<string, string>
  setCreateFormValues: (fn: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void

  // Level2 plan type creation modal
  selectedLevel2PlanType: string
  setSelectedLevel2PlanType: (t: string) => void
  selectedMilestones: string[]
  setSelectedMilestones: (m: string[]) => void
  selectedMRVersion: string
  setSelectedMRVersion: (v: string) => void

  // Columns
  columnsByView: Record<string, string[]>
  setColumnsByView: (fn: (prev: Record<string, string[]>) => Record<string, string[]>) => void

  // Collapsed tree nodes
  collapsedNodes: Record<string, Set<string>>
  setCollapsedNodes: (fn: (prev: Record<string, Set<string>>) => Record<string, Set<string>>) => void

  // Published snapshots
  publishedSnapshots: Record<string, any[]>
  setPublishedSnapshots: (fn: (prev: Record<string, any[]>) => Record<string, any[]>) => void

  // Version compare
  compareVersionA: string
  setCompareVersionA: (v: string) => void
  compareVersionB: string
  setCompareVersionB: (v: string) => void
  compareResult: any[]
  setCompareResult: (r: any[]) => void
  compareShowUnchanged: boolean
  setCompareShowUnchanged: (v: boolean) => void
  compareFilterType: string
  setCompareFilterType: (t: string) => void

  // Market plan data (whole-machine projects)
  marketPlanData: Record<string, { tasks: any[]; level2Tasks: any[]; createdLevel2Plans: Level2Plan[] }>
  setMarketPlanData: (fn: (prev: Record<string, any>) => Record<string, any>) => void

  // Editing state
  ganttEditingTask: any
  setGanttEditingTask: (t: any) => void
  progressEditingTask: any
  setProgressEditingTask: (t: any) => void

  // Warnings
  parentTimeWarning: { visible: boolean; tasks: any[]; message: string }
  setParentTimeWarning: (w: { visible: boolean; tasks: any[]; message: string }) => void
  milestoneTimeWarning: { visible: boolean; violations: any[]; message: string }
  setMilestoneTimeWarning: (w: { visible: boolean; violations: any[]; message: string }) => void
  predecessorWarning: { visible: boolean; task: any; message: string }
  setPredecessorWarning: (w: { visible: boolean; task: any; message: string }) => void
}

export const usePlanStore = create<PlanState>((set) => {
  const defaultCols = ALL_COLUMNS.filter(c => c.default).map(c => c.key)

  return {
    planLevel: 'level1',
    setPlanLevel: (l) => set({ planLevel: l }),
    selectedPlanType: LEVEL2_PLAN_TYPES[0],
    setSelectedPlanType: (t) => set({ selectedPlanType: t }),
    customTypes: [],
    setCustomTypes: (fn) => set((s) => ({ customTypes: typeof fn === 'function' ? fn(s.customTypes) : fn })),
    viewMode: 'table',
    setViewMode: (m) => set({ viewMode: m }),

    projectPlanLevel: 'level1',
    setProjectPlanLevel: (l) => set({ projectPlanLevel: l }),
    projectPlanViewMode: 'table',
    setProjectPlanViewMode: (m) => set({ projectPlanViewMode: m }),
    projectPlanOverviewTab: 'overview',
    setProjectPlanOverviewTab: (t) => set({ projectPlanOverviewTab: t }),
    planMetaCollapsed: false,
    setPlanMetaCollapsed: (v) => set({ planMetaCollapsed: v }),

    versions: [], // initialized from page.tsx VERSION_DATA constant
    setVersions: (v) => set({ versions: v }),
    currentVersion: 'v3',
    setCurrentVersion: (v) => set({ currentVersion: v }),

    tasks: [], // initialized from LEVEL1_TASKS
    setTasks: (fn) => set((s) => ({ tasks: typeof fn === 'function' ? fn(s.tasks) : fn })),
    searchText: '',
    setSearchText: (t) => set({ searchText: t }),

    level2PlanTasks: [],
    setLevel2PlanTasks: (fn) => set((s) => ({ level2PlanTasks: typeof fn === 'function' ? fn(s.level2PlanTasks) : fn })),
    level2PlanMilestones: [],
    setLevel2PlanMilestones: (m) => set({ level2PlanMilestones: m }),
    createdLevel2Plans: [...FIXED_LEVEL2_PLANS],
    setCreatedLevel2Plans: (p) => set({ createdLevel2Plans: p }),
    activeLevel2Plan: 'plan0',
    setActiveLevel2Plan: (id) => set({ activeLevel2Plan: id }),
    level2PlanMeta: {},
    setLevel2PlanMeta: (fn) => set((s) => ({ level2PlanMeta: typeof fn === 'function' ? fn(s.level2PlanMeta) : fn })),
    createFormValues: {},
    setCreateFormValues: (fn) => set((s) => ({ createFormValues: typeof fn === 'function' ? fn(s.createFormValues) : fn })),

    selectedLevel2PlanType: '1+N MR版本火车计划',
    setSelectedLevel2PlanType: (t) => set({ selectedLevel2PlanType: t }),
    selectedMilestones: [],
    setSelectedMilestones: (m) => set({ selectedMilestones: m }),
    selectedMRVersion: 'FR',
    setSelectedMRVersion: (v) => set({ selectedMRVersion: v }),

    columnsByView: {
      'config-table': [...defaultCols],
      'config-gantt': [...defaultCols],
      'project-table': [...defaultCols],
      'project-gantt': [...defaultCols],
      'project-horizontal': [...defaultCols],
    },
    setColumnsByView: (fn) => set((s) => ({ columnsByView: fn(s.columnsByView) })),

    collapsedNodes: {},
    setCollapsedNodes: (fn) => set((s) => ({ collapsedNodes: fn(s.collapsedNodes) })),

    publishedSnapshots: {},
    setPublishedSnapshots: (fn) => set((s) => ({ publishedSnapshots: fn(s.publishedSnapshots) })),

    compareVersionA: 'v1',
    setCompareVersionA: (v) => set({ compareVersionA: v }),
    compareVersionB: 'v3',
    setCompareVersionB: (v) => set({ compareVersionB: v }),
    compareResult: [],
    setCompareResult: (r) => set({ compareResult: r }),
    compareShowUnchanged: false,
    setCompareShowUnchanged: (v) => set({ compareShowUnchanged: v }),
    compareFilterType: 'all',
    setCompareFilterType: (t) => set({ compareFilterType: t }),

    marketPlanData: {},
    setMarketPlanData: (fn) => set((s) => ({ marketPlanData: fn(s.marketPlanData) })),

    ganttEditingTask: null,
    setGanttEditingTask: (t) => set({ ganttEditingTask: t }),
    progressEditingTask: null,
    setProgressEditingTask: (t) => set({ progressEditingTask: t }),

    parentTimeWarning: { visible: false, tasks: [], message: '' },
    setParentTimeWarning: (w) => set({ parentTimeWarning: w }),
    milestoneTimeWarning: { visible: false, violations: [], message: '' },
    setMilestoneTimeWarning: (w) => set({ milestoneTimeWarning: w }),
    predecessorWarning: { visible: false, task: null, message: '' },
    setPredecessorWarning: (w) => set({ predecessorWarning: w }),
  }
})
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit src/stores/plan.ts 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/stores/plan.ts
git commit -m "refactor: add Zustand plan store for tasks, versions, and plan config state"
```

---

### Task 4: Create `src/stores/transfer.ts` — Transfer Store

**Files:**
- Create: `src/stores/transfer.ts`

- [ ] **Step 1: Create the transfer store**

```typescript
// src/stores/transfer.ts
import { create } from 'zustand'
import {
  MOCK_TM_USERS,
  MOCK_TRANSFER_APPLICATIONS,
  MOCK_CHECKLIST_ITEMS,
  MOCK_REVIEW_ELEMENTS,
  MOCK_BLOCK_TASKS,
  MOCK_LEGACY_TASKS,
  type TMTeamMember,
  type TransferApplication,
} from '@/mock/transfer-maintenance'

interface TransferState {
  // Current user (transfer context)
  currentUser: typeof MOCK_TM_USERS[0]
  setCurrentUser: (u: typeof MOCK_TM_USERS[0]) => void

  // Transfer view navigation
  transferView: null | 'apply' | 'detail' | 'entry' | 'review' | 'sqa-review'
  setTransferView: (v: null | 'apply' | 'detail' | 'entry' | 'review' | 'sqa-review') => void
  selectedTransferAppId: string | null
  setSelectedTransferAppId: (id: string | null) => void

  // Config view
  transferConfigView: 'home' | 'checklist' | 'review'
  setTransferConfigView: (v: 'home' | 'checklist' | 'review') => void
  tmConfigSearchText: string
  setTmConfigSearchText: (t: string) => void
  tmConfigSelectedVersion: string
  setTmConfigSelectedVersion: (v: string) => void
  tmConfigDiffOpen: boolean
  setTmConfigDiffOpen: (v: boolean) => void
  tmConfigDiffFrom: string
  setTmConfigDiffFrom: (v: string) => void
  tmConfigDiffTo: string
  setTmConfigDiffTo: (v: string) => void

  // Data
  transferApplications: TransferApplication[]
  setTransferApplications: (apps: TransferApplication[]) => void
  tmChecklistItems: any[]
  setTmChecklistItems: (items: any[]) => void
  tmReviewElements: any[]
  setTmReviewElements: (items: any[]) => void
  tmBlockTasks: any[]
  tmLegacyTasks: any[]

  // Apply form
  tmApplyDate: string
  setTmApplyDate: (d: string) => void
  tmApplyRemark: string
  setTmApplyRemark: (r: string) => void
  tmApplyTeam: { research: TMTeamMember[]; maintenance: TMTeamMember[] }
  setTmApplyTeam: (t: { research: TMTeamMember[]; maintenance: TMTeamMember[] }) => void

  // Detail/Review modals
  tmDetailModalVisible: boolean
  setTmDetailModalVisible: (v: boolean) => void
  tmDetailModalTitle: string
  setTmDetailModalTitle: (t: string) => void
  tmDetailModalContent: string
  setTmDetailModalContent: (c: string) => void

  // Close pipeline
  tmCloseModalVisible: boolean
  setTmCloseModalVisible: (v: boolean) => void
  tmCloseAppId: string | null
  setTmCloseAppId: (id: string | null) => void
  tmCloseReason: string
  setTmCloseReason: (r: string) => void

  // Entry
  tmEntryTab: 'checklist' | 'review'
  setTmEntryTab: (t: 'checklist' | 'review') => void
  tmEntryModalOpen: boolean
  setTmEntryModalOpen: (v: boolean) => void
  tmEntryModalRecord: any
  setTmEntryModalRecord: (r: any) => void
  tmEntryContent: string
  setTmEntryContent: (c: string) => void
  tmEntryActiveRole: string
  setTmEntryActiveRole: (r: string) => void

  // Review
  tmReviewTab: 'checklist' | 'review'
  setTmReviewTab: (t: 'checklist' | 'review') => void
  tmReviewModalOpen: boolean
  setTmReviewModalOpen: (v: boolean) => void
  tmReviewAction: 'pass' | 'reject'
  setTmReviewAction: (a: 'pass' | 'reject') => void
  tmReviewRecord: any
  setTmReviewRecord: (r: any) => void
  tmReviewComment: string
  setTmReviewComment: (c: string) => void
  tmReviewActiveRole: string
  setTmReviewActiveRole: (r: string) => void

  // SQA
  tmSqaComment: string
  setTmSqaComment: (c: string) => void
  tmSqaModalOpen: boolean
  setTmSqaModalOpen: (v: boolean) => void
  tmSqaAction: 'approve' | 'reject'
  setTmSqaAction: (a: 'approve' | 'reject') => void

  // Generic modal
  tmModalVisible: boolean
  setTmModalVisible: (v: boolean) => void
  tmModalTitle: string
  setTmModalTitle: (t: string) => void
  tmModalContent: string
  setTmModalContent: (c: string) => void
}

export const useTransferStore = create<TransferState>((set) => ({
  currentUser: MOCK_TM_USERS[0],
  setCurrentUser: (u) => set({ currentUser: u }),

  transferView: null,
  setTransferView: (v) => set({ transferView: v }),
  selectedTransferAppId: null,
  setSelectedTransferAppId: (id) => set({ selectedTransferAppId: id }),

  transferConfigView: 'home',
  setTransferConfigView: (v) => set({ transferConfigView: v }),
  tmConfigSearchText: '',
  setTmConfigSearchText: (t) => set({ tmConfigSearchText: t }),
  tmConfigSelectedVersion: 'v3.0',
  setTmConfigSelectedVersion: (v) => set({ tmConfigSelectedVersion: v }),
  tmConfigDiffOpen: false,
  setTmConfigDiffOpen: (v) => set({ tmConfigDiffOpen: v }),
  tmConfigDiffFrom: 'v2.0',
  setTmConfigDiffFrom: (v) => set({ tmConfigDiffFrom: v }),
  tmConfigDiffTo: 'v3.0',
  setTmConfigDiffTo: (v) => set({ tmConfigDiffTo: v }),

  transferApplications: MOCK_TRANSFER_APPLICATIONS,
  setTransferApplications: (apps) => set({ transferApplications: apps }),
  tmChecklistItems: MOCK_CHECKLIST_ITEMS,
  setTmChecklistItems: (items) => set({ tmChecklistItems: items }),
  tmReviewElements: MOCK_REVIEW_ELEMENTS,
  setTmReviewElements: (items) => set({ tmReviewElements: items }),
  tmBlockTasks: MOCK_BLOCK_TASKS,
  tmLegacyTasks: MOCK_LEGACY_TASKS,

  tmApplyDate: '',
  setTmApplyDate: (d) => set({ tmApplyDate: d }),
  tmApplyRemark: '',
  setTmApplyRemark: (r) => set({ tmApplyRemark: r }),
  tmApplyTeam: { research: [], maintenance: [] },
  setTmApplyTeam: (t) => set({ tmApplyTeam: t }),

  tmDetailModalVisible: false,
  setTmDetailModalVisible: (v) => set({ tmDetailModalVisible: v }),
  tmDetailModalTitle: '',
  setTmDetailModalTitle: (t) => set({ tmDetailModalTitle: t }),
  tmDetailModalContent: '',
  setTmDetailModalContent: (c) => set({ tmDetailModalContent: c }),

  tmCloseModalVisible: false,
  setTmCloseModalVisible: (v) => set({ tmCloseModalVisible: v }),
  tmCloseAppId: null,
  setTmCloseAppId: (id) => set({ tmCloseAppId: id }),
  tmCloseReason: '',
  setTmCloseReason: (r) => set({ tmCloseReason: r }),

  tmEntryTab: 'checklist',
  setTmEntryTab: (t) => set({ tmEntryTab: t }),
  tmEntryModalOpen: false,
  setTmEntryModalOpen: (v) => set({ tmEntryModalOpen: v }),
  tmEntryModalRecord: null,
  setTmEntryModalRecord: (r) => set({ tmEntryModalRecord: r }),
  tmEntryContent: '',
  setTmEntryContent: (c) => set({ tmEntryContent: c }),
  tmEntryActiveRole: 'all',
  setTmEntryActiveRole: (r) => set({ tmEntryActiveRole: r }),

  tmReviewTab: 'checklist',
  setTmReviewTab: (t) => set({ tmReviewTab: t }),
  tmReviewModalOpen: false,
  setTmReviewModalOpen: (v) => set({ tmReviewModalOpen: v }),
  tmReviewAction: 'pass',
  setTmReviewAction: (a) => set({ tmReviewAction: a }),
  tmReviewRecord: null,
  setTmReviewRecord: (r) => set({ tmReviewRecord: r }),
  tmReviewComment: '',
  setTmReviewComment: (c) => set({ tmReviewComment: c }),
  tmReviewActiveRole: 'all',
  setTmReviewActiveRole: (r) => set({ tmReviewActiveRole: r }),

  tmSqaComment: '',
  setTmSqaComment: (c) => set({ tmSqaComment: c }),
  tmSqaModalOpen: false,
  setTmSqaModalOpen: (v) => set({ tmSqaModalOpen: v }),
  tmSqaAction: 'approve',
  setTmSqaAction: (a) => set({ tmSqaAction: a }),

  tmModalVisible: false,
  setTmModalVisible: (v) => set({ tmModalVisible: v }),
  tmModalTitle: '',
  setTmModalTitle: (t) => set({ tmModalTitle: t }),
  tmModalContent: '',
  setTmModalContent: (c) => set({ tmModalContent: c }),
}))
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit src/stores/transfer.ts 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/stores/transfer.ts
git commit -m "refactor: add Zustand transfer store for transfer maintenance state"
```

---

### Task 5: Create `src/stores/permission.ts` — Permission Store

**Files:**
- Create: `src/stores/permission.ts`

- [ ] **Step 1: Create the permission store**

```typescript
// src/stores/permission.ts
import { create } from 'zustand'
import { PERMISSION_MODULES, FIXED_ROLES, ALL_USERS } from '@/components/permission/PermissionModule'

interface PermissionState {
  // Project-level roles
  roles: { name: string; members: string[]; isFixed: boolean }[]
  setRoles: (fn: { name: string; members: string[]; isFixed: boolean }[] | ((prev: { name: string; members: string[]; isFixed: boolean }[]) => { name: string; members: string[]; isFixed: boolean }[])) => void
  rolePermissions: Record<string, Record<string, boolean>>
  setRolePermissions: (fn: Record<string, Record<string, boolean>> | ((prev: Record<string, Record<string, boolean>>) => Record<string, Record<string, boolean>>)) => void
  showAddRoleModal: boolean
  setShowAddRoleModal: (v: boolean) => void
  newRoleName: string
  setNewRoleName: (n: string) => void
  editingRoleName: string | null
  setEditingRoleName: (n: string | null) => void
  editRoleNameValue: string
  setEditRoleNameValue: (v: string) => void
  permissionActiveRole: string
  setPermissionActiveRole: (r: string) => void
  permConfigTab: 'roles' | 'perms'
  setPermConfigTab: (t: 'roles' | 'perms') => void

  // Global roles
  globalRoles: { name: string; members: string[]; isFixed?: boolean }[]
  setGlobalRoles: (fn: { name: string; members: string[]; isFixed?: boolean }[] | ((prev: { name: string; members: string[]; isFixed?: boolean }[]) => { name: string; members: string[]; isFixed?: boolean }[])) => void
  globalRolePerms: Record<string, Record<string, boolean>>
  setGlobalRolePerms: (fn: Record<string, Record<string, boolean>> | ((prev: Record<string, Record<string, boolean>>) => Record<string, Record<string, boolean>>)) => void
  globalPermTab: 'roles' | 'perms'
  setGlobalPermTab: (t: 'roles' | 'perms') => void
  showGlobalAddRole: boolean
  setShowGlobalAddRole: (v: boolean) => void
  globalNewRoleName: string
  setGlobalNewRoleName: (n: string) => void
  globalEditingRole: string | null
  setGlobalEditingRole: (r: string | null) => void
  globalEditRoleValue: string
  setGlobalEditRoleValue: (v: string) => void
  globalPermActiveRole: string
  setGlobalPermActiveRole: (r: string) => void
}

export const usePermissionStore = create<PermissionState>((set) => {
  // Build default role permissions
  const defaultPerms: Record<string, string[]> = {
    '系统管理员': PERMISSION_MODULES.flatMap(m => m.permissions.map(p => `${m.key}:${p}`)),
    '项目经理': ['basicInfo:查看', 'basicInfo:编辑', 'plan:一级计划-查看', 'plan:一级计划-编辑', 'plan:二级计划-查看', 'plan:二级计划-编辑', 'plan:导入/导出', 'resources:查看', 'tasks:查看', 'risks:查看'],
    '产品经理': ['basicInfo:查看', 'plan:一级计划-查看', 'plan:二级计划-查看', 'resources:查看', 'tasks:查看', 'risks:查看'],
    '开发代表': ['basicInfo:查看', 'plan:一级计划-查看', 'plan:二级计划-查看', 'tasks:查看'],
    '软件SE': ['basicInfo:查看', 'plan:一级计划-查看', 'plan:二级计划-查看', 'tasks:查看'],
    '设计师': ['basicInfo:查看'],
    '开发工程师': ['basicInfo:查看', 'plan:一级计划-查看', 'plan:二级计划-查看', 'tasks:查看'],
    '测试工程师': ['basicInfo:查看', 'plan:一级计划-查看', 'plan:二级计划-查看', 'tasks:查看', 'risks:查看'],
    '管理层': ['basicInfo:查看', 'plan:一级计划-查看', 'plan:二级计划-查看', 'resources:查看', 'tasks:查看', 'risks:查看'],
  }
  const initPerms: Record<string, Record<string, boolean>> = {}
  FIXED_ROLES.forEach(r => {
    initPerms[r] = {};
    (defaultPerms[r] || []).forEach(p => { initPerms[r][p] = true })
  })

  return {
    roles: [
      { name: '系统管理员', members: ['张三'], isFixed: true },
      { name: '产品经理', members: ['李四', '王五'], isFixed: true },
      { name: '项目经理', members: ['张三', '赵六'], isFixed: true },
      { name: '开发代表', members: ['王五'], isFixed: true },
      { name: '软件SE', members: ['孙七'], isFixed: true },
      { name: '设计师', members: ['周八'], isFixed: true },
      { name: '开发工程师', members: ['李白', '杜甫'], isFixed: true },
      { name: '测试工程师', members: ['赵六', '孙七'], isFixed: true },
      { name: '管理层', members: ['张三'], isFixed: true },
    ],
    setRoles: (fn) => set((s) => ({ roles: typeof fn === 'function' ? fn(s.roles) : fn })),
    rolePermissions: initPerms,
    setRolePermissions: (fn) => set((s) => ({ rolePermissions: typeof fn === 'function' ? fn(s.rolePermissions) : fn })),
    showAddRoleModal: false,
    setShowAddRoleModal: (v) => set({ showAddRoleModal: v }),
    newRoleName: '',
    setNewRoleName: (n) => set({ newRoleName: n }),
    editingRoleName: null,
    setEditingRoleName: (n) => set({ editingRoleName: n }),
    editRoleNameValue: '',
    setEditRoleNameValue: (v) => set({ editRoleNameValue: v }),
    permissionActiveRole: '系统管理员',
    setPermissionActiveRole: (r) => set({ permissionActiveRole: r }),
    permConfigTab: 'roles',
    setPermConfigTab: (t) => set({ permConfigTab: t }),

    globalRoles: [
      { name: '管理组', members: ['张三', '李白'], isFixed: true },
      { name: '编辑组', members: ['李四', '赵六', '王五'], isFixed: true },
      { name: '查看组', members: ['孙七', '周八', '杜甫'], isFixed: true },
    ],
    setGlobalRoles: (fn) => set((s) => ({ globalRoles: typeof fn === 'function' ? fn(s.globalRoles) : fn })),
    globalRolePerms: {
      '管理组': { 'roadmap:milestone:view': true, 'roadmap:mrTrain:view': true },
      '编辑组': { 'roadmap:milestone:view': true, 'roadmap:mrTrain:view': true },
      '查看组': { 'roadmap:milestone:view': true, 'roadmap:mrTrain:view': false },
    },
    setGlobalRolePerms: (fn) => set((s) => ({ globalRolePerms: typeof fn === 'function' ? fn(s.globalRolePerms) : fn })),
    globalPermTab: 'roles',
    setGlobalPermTab: (t) => set({ globalPermTab: t }),
    showGlobalAddRole: false,
    setShowGlobalAddRole: (v) => set({ showGlobalAddRole: v }),
    globalNewRoleName: '',
    setGlobalNewRoleName: (n) => set({ globalNewRoleName: n }),
    globalEditingRole: null,
    setGlobalEditingRole: (r) => set({ globalEditingRole: r }),
    globalEditRoleValue: '',
    setGlobalEditRoleValue: (v) => set({ globalEditRoleValue: v }),
    globalPermActiveRole: '管理组',
    setGlobalPermActiveRole: (r) => set({ globalPermActiveRole: r }),
  }
})
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit src/stores/permission.ts 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/stores/permission.ts
git commit -m "refactor: add Zustand permission store for roles and permission state"
```

---

### Task 6: Migrate `page.tsx` to consume stores (no structural change)

**Files:**
- Modify: `src/app/page.tsx`

This is the critical bridging step. Replace all ~126 `useState` calls in `Home()` with destructured store hooks. The render output stays identical — we're only changing where state lives.

- [ ] **Step 1: Add store imports at the top of page.tsx**

At the top of `page.tsx` (after existing imports), add:

```typescript
import { useUIStore } from '@/stores/ui'
import { useProjectStore, PROJECT_MEMBER_MAP } from '@/stores/project'
import { usePlanStore, ALL_COLUMNS, TABLE_COLUMNS, GANTT_COLUMNS, getColumnsForView, LEVEL2_PLAN_TYPES, FIXED_LEVEL2_PLANS } from '@/stores/plan'
import { useTransferStore } from '@/stores/transfer'
import { usePermissionStore } from '@/stores/permission'
```

- [ ] **Step 2: Replace useState calls with store hooks inside `Home()`**

Inside `export default function Home()`, replace the ~126 useState declarations (lines 646-920) with store destructuring:

```typescript
export default function Home() {
  // ========== Store hooks ==========
  const ui = useUIStore()
  const proj = useProjectStore()
  const plan = usePlanStore()
  const transfer = useTransferStore()
  const perm = usePermissionStore()

  // Alias frequently used values for backward compatibility
  const { activeModule, setActiveModule, configTab, setConfigTab, sidebarCollapsed, setSidebarCollapsed,
    selectedProjectType, setSelectedProjectType, projectSpaceModule, setProjectSpaceModule,
    isEditMode, setIsEditMode, showVersionCompare, setShowVersionCompare,
    showColumnModal, setShowColumnModal, showCreateLevel2Plan, setShowCreateLevel2Plan,
    showAddCustomType, setShowAddCustomType, showProjectSearch, setShowProjectSearch,
    projectSearchText, setProjectSearchText, navigateWithEditGuard,
    showLeaveConfirm, handleConfirmLeave, handleCancelLeave,
    workspaceTab, setWorkspaceTab } = ui

  const { projects, setProjects, selectedProject, setSelectedProject,
    currentLoginUser, setCurrentLoginUser, projectSearchText2, setProjectSearchText2,
    projectStatusFilter, setProjectStatusFilter, projectTypeFilter, setProjectTypeFilter,
    projectCardPage, setProjectCardPage, basicInfoEditMode, setBasicInfoEditMode,
    editingProjectFields, setEditingProjectFields, selectedMarketTab, setSelectedMarketTab,
    kanbanDimension, setKanbanDimension, todoFilter, setTodoFilter, todoCollapsed, setTodoCollapsed } = proj

  const { planLevel, setPlanLevel, selectedPlanType, setSelectedPlanType,
    customTypes, setCustomTypes, viewMode, setViewMode,
    versions, setVersions, currentVersion, setCurrentVersion,
    tasks, setTasks, searchText, setSearchText,
    level2PlanTasks, setLevel2PlanTasks, level2PlanMilestones, setLevel2PlanMilestones,
    createdLevel2Plans, setCreatedLevel2Plans, activeLevel2Plan, setActiveLevel2Plan,
    level2PlanMeta, setLevel2PlanMeta, createFormValues, setCreateFormValues,
    selectedLevel2PlanType, setSelectedLevel2PlanType, selectedMilestones, setSelectedMilestones,
    selectedMRVersion, setSelectedMRVersion, columnsByView, setColumnsByView,
    collapsedNodes, setCollapsedNodes, publishedSnapshots, setPublishedSnapshots,
    compareVersionA, setCompareVersionA, compareVersionB, setCompareVersionB,
    compareResult, setCompareResult, compareShowUnchanged, setCompareShowUnchanged,
    compareFilterType, setCompareFilterType, marketPlanData, setMarketPlanData,
    ganttEditingTask, setGanttEditingTask, progressEditingTask, setProgressEditingTask,
    parentTimeWarning, setParentTimeWarning, milestoneTimeWarning, setMilestoneTimeWarning,
    predecessorWarning, setPredecessorWarning, projectPlanLevel, setProjectPlanLevel,
    projectPlanViewMode, setProjectPlanViewMode, projectPlanOverviewTab, setProjectPlanOverviewTab,
    planMetaCollapsed, setPlanMetaCollapsed } = plan

  const { currentUser, setCurrentUser, transferView, setTransferView,
    selectedTransferAppId, setSelectedTransferAppId,
    transferConfigView, setTransferConfigView, tmConfigSearchText, setTmConfigSearchText,
    tmConfigSelectedVersion, setTmConfigSelectedVersion, tmConfigDiffOpen, setTmConfigDiffOpen,
    tmConfigDiffFrom, setTmConfigDiffFrom, tmConfigDiffTo, setTmConfigDiffTo,
    transferApplications, setTransferApplications, tmChecklistItems, setTmChecklistItems,
    tmReviewElements, setTmReviewElements, tmBlockTasks, tmLegacyTasks,
    tmApplyDate, setTmApplyDate, tmApplyRemark, setTmApplyRemark, tmApplyTeam, setTmApplyTeam,
    tmDetailModalVisible, setTmDetailModalVisible, tmDetailModalTitle, setTmDetailModalTitle,
    tmDetailModalContent, setTmDetailModalContent, tmCloseModalVisible, setTmCloseModalVisible,
    tmCloseAppId, setTmCloseAppId, tmCloseReason, setTmCloseReason,
    tmEntryTab, setTmEntryTab, tmEntryModalOpen, setTmEntryModalOpen,
    tmEntryModalRecord, setTmEntryModalRecord, tmEntryContent, setTmEntryContent,
    tmEntryActiveRole, setTmEntryActiveRole, tmReviewTab, setTmReviewTab,
    tmReviewModalOpen, setTmReviewModalOpen, tmReviewAction, setTmReviewAction,
    tmReviewRecord, setTmReviewRecord, tmReviewComment, setTmReviewComment,
    tmReviewActiveRole, setTmReviewActiveRole, tmSqaComment, setTmSqaComment,
    tmSqaModalOpen, setTmSqaModalOpen, tmSqaAction, setTmSqaAction } = transfer

  const { roles, setRoles, rolePermissions, setRolePermissions,
    showAddRoleModal, setShowAddRoleModal, newRoleName, setNewRoleName,
    editingRoleName, setEditingRoleName, editRoleNameValue, setEditRoleNameValue,
    permissionActiveRole, setPermissionActiveRole, permConfigTab, setPermConfigTab,
    globalRoles, setGlobalRoles, globalRolePerms, setGlobalRolePerms,
    globalPermTab, setGlobalPermTab, showGlobalAddRole, setShowGlobalAddRole,
    globalNewRoleName, setGlobalNewRoleName, globalEditingRole, setGlobalEditingRole,
    globalEditRoleValue, setGlobalEditRoleValue, globalPermActiveRole, setGlobalPermActiveRole } = perm

  // Keep remaining non-store state (refs, local-only state)
  const projectSearchRef = useRef<HTMLDivElement>(null)
  const lastDueCheckedProjectRef = useRef<string | null>(null)
  const projectCardPageSize = 9
  const [todos] = useState(initialTodos)
  // ... rest of component stays the same
```

- [ ] **Step 3: Remove all the old `useState` declarations (lines 646-920)**

Delete the ~275 lines of `useState` declarations that have been replaced by store hooks.

- [ ] **Step 4: Initialize store data that depends on constants defined in page.tsx**

The plan store needs `VERSION_DATA` and `LEVEL1_TASKS` which are defined in page.tsx. Add a `useEffect` at the top of `Home()` to initialize:

```typescript
  // Initialize plan store with page-level constants (only on first mount)
  useEffect(() => {
    if (plan.versions.length === 0) {
      plan.setVersions(VERSION_DATA)
    }
    if (plan.tasks.length === 0) {
      plan.setTasks(LEVEL1_TASKS)
    }
    if (Object.keys(plan.marketPlanData).length === 0) {
      plan.setMarketPlanData(() => ({
        'OP': { tasks: [...LEVEL1_TASKS], level2Tasks: [], createdLevel2Plans: [...FIXED_LEVEL2_PLANS] },
        'TR': { tasks: [...LEVEL1_TASKS.map(t => ({...t}))], level2Tasks: [], createdLevel2Plans: [...FIXED_LEVEL2_PLANS] },
        'RU': { tasks: [...LEVEL1_TASKS.map(t => ({...t}))], level2Tasks: [], createdLevel2Plans: [...FIXED_LEVEL2_PLANS] },
      }))
    }
    if (plan.level2PlanTasks.length === 0) {
      plan.setLevel2PlanTasks(INITIAL_LEVEL2_PLAN_TASKS) // extract the inline array to a constant
    }
    if (Object.keys(plan.level2PlanMeta).length === 0) {
      plan.setLevel2PlanMeta(() => INITIAL_LEVEL2_META) // extract the inline object to a constant
    }
    if (plan.createdLevel2Plans.length === 2) {
      plan.setCreatedLevel2Plans([
        ...FIXED_LEVEL2_PLANS,
        { id: 'plan2', name: 'FR版本火车计划', type: 'FR版本火车计划' },
        { id: 'plan3', name: 'MR1版本火车计划', type: 'MR版本火车计划' },
      ])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
```

- [ ] **Step 5: Verify build**

Run: `npm run build 2>&1 | tail -30`
Expected: Build succeeds with no new errors

- [ ] **Step 6: Verify dev server**

Run: `npm run dev` and verify the app works in browser — all modules should function identically.

- [ ] **Step 7: Commit**

```bash
git add src/app/page.tsx
git commit -m "refactor: migrate page.tsx state from useState to Zustand stores

All 126 useState hooks replaced with store hooks. No behavioral change.
Stores: ui, project, plan, transfer, permission."
```

---

### Task 7: Extract `src/containers/AppShell.tsx` — Top Navigation Bar

**Files:**
- Create: `src/containers/AppShell.tsx`
- Modify: `src/app/page.tsx`

Extract the top navigation bar (lines 3764-3846 in main layout, and 3474-3550 in project space) into a reusable `AppShell` component.

- [ ] **Step 1: Create AppShell.tsx**

Move the header JSX from the `return` statement of `Home()` into a new `AppShell` component. It reads from `useUIStore`, `useProjectStore`, and `usePermissionStore` directly.

The component renders:
- Logo + "项目管理系统" title
- Top menu (工作台, 项目路标视图, 人力资源管道, 配置中心, 权限中心)
- User switcher dropdown (right side)

For project space mode, render: back button + project name dropdown + project search.

```typescript
// src/containers/AppShell.tsx
'use client'

import { useRef, useEffect } from 'react'
import { Row, Col, Space, Menu, Tag, Avatar, Dropdown, Button, Input } from 'antd'
import { AppstoreOutlined, SwapOutlined, CheckCircleOutlined, LeftOutlined,
  ProjectOutlined, DownOutlined, SearchOutlined } from '@ant-design/icons'
import { useUIStore } from '@/stores/ui'
import { useProjectStore, PROJECT_MEMBER_MAP } from '@/stores/project'
import { usePermissionStore } from '@/stores/permission'
import { useTransferStore } from '@/stores/transfer'
import { ALL_USERS } from '@/components/permission/PermissionModule'

export default function AppShell({ mode }: { mode: 'main' | 'projectSpace' }) {
  const ui = useUIStore()
  const proj = useProjectStore()
  const perm = usePermissionStore()
  const transfer = useTransferStore()
  const projectSearchRef = useRef<HTMLDivElement>(null)

  // ... Copy the header JSX from page.tsx, consuming stores directly
  // Main mode: lines 3764-3846
  // ProjectSpace mode: lines 3474-3550
  // (Full code omitted from plan — copy verbatim from page.tsx, replacing state references)
}
```

- [ ] **Step 2: Replace header JSX in page.tsx with `<AppShell mode="main" />` and `<AppShell mode="projectSpace" />`**

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | tail -20`

- [ ] **Step 4: Commit**

```bash
git add src/containers/AppShell.tsx src/app/page.tsx
git commit -m "refactor: extract AppShell container for top navigation bar"
```

---

### Task 8: Extract `src/containers/WorkspaceContainer.tsx` — Workspace

**Files:**
- Create: `src/containers/WorkspaceContainer.tsx`
- Modify: `src/app/page.tsx`

Extract the workspace tab content (lines 3848-4118 in the `return` statement): project cards/list, work tracker, todo list, status filters, type filters, search, and pagination.

- [ ] **Step 1: Create WorkspaceContainer.tsx**

This component reads from `useProjectStore` and `useUIStore`. It renders:
- Unified toolbar (tab switch, status filters, type filters, search, view toggle)
- Project cards or list view (using existing `ProjectCard`, `KanbanBoard` components)
- Work tracker (`WorkTracker` component)
- Todo sidebar (`TodoList` component)

Move the `renderProjectCard`, `renderKanbanBoard`, `renderTodoList` functions and the workspace JSX block into this container.

- [ ] **Step 2: Replace workspace JSX in page.tsx with `<WorkspaceContainer />`**

In page.tsx `return`, replace `{activeModule === 'projects' && (...)}` block with:
```tsx
{activeModule === 'projects' && <WorkspaceContainer />}
```

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | tail -20`

- [ ] **Step 4: Commit**

```bash
git add src/containers/WorkspaceContainer.tsx src/app/page.tsx
git commit -m "refactor: extract WorkspaceContainer for project list and work tracker"
```

---

### Task 9: Extract `src/containers/ProjectSpaceContainer.tsx` — Project Space

**Files:**
- Create: `src/containers/ProjectSpaceContainer.tsx`
- Modify: `src/app/page.tsx`

This is the largest extraction. Move `renderProjectSpace()` and all its nested render functions:
- `renderProjectBasicInfo()`
- `renderProjectPlan()`
- `renderProjectPlanOverview()`
- `renderProjectOverview()`
- `renderProjectRequirements()`
- `renderProjectPlanInfo()`
- `renderHorizontalTable()`
- `renderTaskTable()`
- `renderGanttChart()`
- `renderActionButtons()`
- `renderVersionCompareResult()`
- Version compare modal, custom column modal, create L2 plan modal
- All plan helper functions: `mergePlans`, `getOverviewTasks`, `handleAddSubTask`, `handleDragEnd`, etc.

- [ ] **Step 1: Create ProjectSpaceContainer.tsx**

Move `renderProjectSpace()` and ALL render/helper functions it calls. The container reads from all 5 stores. Keep the `DHTMLXGantt`, `SortableRow`, `DragHandle`, `MiniPipeline`, `TeamMemberCard`, `ClickToEditDate` sub-components at the module top level (they can stay in page.tsx or be extracted to their own files later).

- [ ] **Step 2: Move inline sub-components to a shared file**

Create `src/components/shared/PlanHelpers.tsx` for: `DHTMLXGantt`, `SortableRow`, `DragHandle`, `MiniPipeline`, `ClickToEditDate`, `DragHandleContext`. These are used by both ProjectSpaceContainer and ConfigContainer.

- [ ] **Step 3: Replace in page.tsx**

```tsx
{activeModule === 'projectSpace' && selectedProject && <ProjectSpaceContainer />}
```

- [ ] **Step 4: Verify build**

Run: `npm run build 2>&1 | tail -20`

- [ ] **Step 5: Commit**

```bash
git add src/containers/ProjectSpaceContainer.tsx src/components/shared/PlanHelpers.tsx src/app/page.tsx
git commit -m "refactor: extract ProjectSpaceContainer for project space layout and plan views"
```

---

### Task 10: Extract `src/containers/ConfigContainer.tsx` — Config Center

**Files:**
- Create: `src/containers/ConfigContainer.tsx`
- Modify: `src/app/page.tsx`

Move the config center JSX block (lines 4143-4300+): plan template config with sidebar + transfer template config tab.

- [ ] **Step 1: Create ConfigContainer.tsx**

Reads from `useUIStore`, `usePlanStore`, `useTransferStore`. Renders:
- Config tab (计划模板配置 / 转维材料模板配置)
- Plan template sidebar (project types) + content area
- Transfer config (`TransferConfig` component)

- [ ] **Step 2: Replace in page.tsx**

```tsx
{activeModule === 'config' && <ConfigContainer />}
```

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | tail -20`

- [ ] **Step 4: Commit**

```bash
git add src/containers/ConfigContainer.tsx src/app/page.tsx
git commit -m "refactor: extract ConfigContainer for configuration center"
```

---

### Task 11: Extract `src/containers/GlobalPermissionContainer.tsx`

**Files:**
- Create: `src/containers/GlobalPermissionContainer.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create GlobalPermissionContainer.tsx**

Simple wrapper that reads from `usePermissionStore` and renders `GlobalPermissionConfig` with store props.

```typescript
'use client'

import { GlobalPermissionConfig } from '@/components/permission/PermissionModule'
import { usePermissionStore } from '@/stores/permission'

export default function GlobalPermissionContainer() {
  const perm = usePermissionStore()
  return (
    <GlobalPermissionConfig
      globalRoles={perm.globalRoles}
      setGlobalRoles={perm.setGlobalRoles}
      globalRolePerms={perm.globalRolePerms}
      setGlobalRolePerms={perm.setGlobalRolePerms}
      globalPermTab={perm.globalPermTab}
      setGlobalPermTab={perm.setGlobalPermTab}
      showGlobalAddRole={perm.showGlobalAddRole}
      setShowGlobalAddRole={perm.setShowGlobalAddRole}
      globalNewRoleName={perm.globalNewRoleName}
      setGlobalNewRoleName={perm.setGlobalNewRoleName}
      globalEditingRole={perm.globalEditingRole}
      setGlobalEditingRole={perm.setGlobalEditingRole}
      globalEditRoleValue={perm.globalEditRoleValue}
      setGlobalEditRoleValue={perm.setGlobalEditRoleValue}
      globalPermActiveRole={perm.globalPermActiveRole}
      setGlobalPermActiveRole={perm.setGlobalPermActiveRole}
    />
  )
}
```

- [ ] **Step 2: Replace in page.tsx**

```tsx
{activeModule === 'globalPermission' && <GlobalPermissionContainer />}
```

- [ ] **Step 3: Verify build and commit**

```bash
git add src/containers/GlobalPermissionContainer.tsx src/app/page.tsx
git commit -m "refactor: extract GlobalPermissionContainer"
```

---

### Task 12: Slim down `page.tsx` to routing shell

**Files:**
- Modify: `src/app/page.tsx`

After all containers are extracted, page.tsx should contain only:
1. Imports
2. The `Home()` component with store initialization `useEffect`
3. A simple `return` routing by `activeModule`
4. The leave-confirm modal (shared across all modules)

- [ ] **Step 1: Remove dead code from page.tsx**

Delete all render functions that have been moved to containers. Delete helper functions that are no longer referenced. Delete unused imports.

- [ ] **Step 2: Final page.tsx structure**

```typescript
'use client'

import { useEffect } from 'react'
import { ConfigProvider, Modal, Space, Button } from 'antd'
import { ExclamationCircleOutlined } from '@ant-design/icons'
import { useUIStore } from '@/stores/ui'
import { useProjectStore } from '@/stores/project'
import { usePlanStore, FIXED_LEVEL2_PLANS } from '@/stores/plan'
import AppShell from '@/containers/AppShell'
import WorkspaceContainer from '@/containers/WorkspaceContainer'
import ProjectSpaceContainer from '@/containers/ProjectSpaceContainer'
import ConfigContainer from '@/containers/ConfigContainer'
import GlobalPermissionContainer from '@/containers/GlobalPermissionContainer'
import RoadmapView from '@/components/roadmap/RoadmapView'
import { Card, Empty } from 'antd'

// Page-level constants (VERSION_DATA, LEVEL1_TASKS, initialTodos, etc.)
// ... keep these here or move to src/data/

const globalStyles = `` // minimal

export default function Home() {
  const { activeModule, showLeaveConfirm, handleConfirmLeave, handleCancelLeave } = useUIStore()
  const { selectedProject, projects } = useProjectStore()
  const plan = usePlanStore()

  // Initialize plan store on first mount
  useEffect(() => {
    if (plan.versions.length === 0) plan.setVersions(VERSION_DATA)
    if (plan.tasks.length === 0) plan.setTasks(LEVEL1_TASKS)
    // ... other initializations
  }, [])

  return (
    <ConfigProvider autoInsertSpaceInButton={false}>
      <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
      <div style={{ minHeight: '100vh', background: '#f5f6fa' }}>
        {activeModule === 'projectSpace' && selectedProject ? (
          <ProjectSpaceContainer />
        ) : (
          <>
            <AppShell mode="main" />
            <div style={{ padding: 24 }}>
              {activeModule === 'projects' && <WorkspaceContainer />}
              {activeModule === 'roadmap' && <RoadmapView projects={projects} ... />}
              {activeModule === 'hrPipeline' && (
                <Card style={{ borderRadius: 8, textAlign: 'center', padding: '80px 0' }}>
                  <Empty description="人力资源管道模块开发中..." />
                </Card>
              )}
              {activeModule === 'config' && <ConfigContainer />}
              {activeModule === 'globalPermission' && <GlobalPermissionContainer />}
            </div>
          </>
        )}
      </div>
      {/* Leave confirmation modal */}
      <Modal
        className="pms-modal"
        title={<Space><ExclamationCircleOutlined style={{ color: '#faad14', fontSize: 18 }} /><span>离开确认</span></Space>}
        open={showLeaveConfirm}
        onCancel={handleCancelLeave}
        footer={[
          <Button key="cancel" onClick={handleCancelLeave}>取消</Button>,
          <Button key="confirm" type="primary" danger onClick={handleConfirmLeave}>确认离开</Button>,
        ]}
        width={420}
      >
        <div style={{ padding: '12px 0', fontSize: 14, color: '#4b5563' }}>
          您还未提交现有编辑内容，是否要离开该界面？
        </div>
      </Modal>
    </ConfigProvider>
  )
}
```

- [ ] **Step 3: Verify line count**

Run: `wc -l src/app/page.tsx`
Expected: ~150 lines (down from 4720)

- [ ] **Step 4: Verify full build**

Run: `npm run build 2>&1 | tail -30`
Expected: Build succeeds

- [ ] **Step 5: Final commit**

```bash
git add src/app/page.tsx
git commit -m "refactor: slim page.tsx to ~150-line routing shell

Extracted all rendering logic to container components.
All state managed via Zustand stores.
page.tsx: 4720 → ~150 lines."
```

---

### Task 13: Verify everything works end-to-end

**Files:** None (verification only)

- [ ] **Step 1: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | tail -30`
Expected: No new errors

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Manual smoke test**

Start dev server and verify:
1. Workspace: project cards render, filters work, card/list/kanban views switch
2. Work tracker tab works
3. Project space: click a project card → sidebar + basic info renders
4. Plan tab: L1/L2 plans, version select, table/gantt/horizontal views
5. Config center: plan template + transfer template tabs work
6. Permission center: role management works
7. Roadmap: renders correctly
8. User switch: dropdown works, visibility filters apply
9. Edit guard: edit mode → navigate away → confirmation modal appears

- [ ] **Step 4: Commit verification note**

```bash
git commit --allow-empty -m "verify: end-to-end smoke test passed after core refactoring"
```
