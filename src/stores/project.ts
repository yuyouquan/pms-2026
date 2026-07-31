import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { initialProjects } from '@/data/projects'
import {
  PROJECT_TYPE_TOS_VERSION,
  isMachineProjectType,
  resolveProjectClassification,
  type PersistedProjectTypeName,
} from '@/constants/projectTypes'
import { buildMarketRowsFromMarkets, type MarketConfigRow } from '@/lib/marketRules'
import { buildTosTypeRows, type TosTypeConfigRow } from '@/lib/tosTypeRules'
import { adaptNormalProject } from '@/lib/roadmapProjectAdapter'
import { createRoadmapAuditSnapshot, diffRoadmapProjectFields } from '@/lib/roadmapAudit'
import { buildRoadmapDisplayName } from '@/lib/roadmapValidation'
import { getCurrentTosEnumValues, normalizeTosEnumReference } from '@/lib/tosEnumOptions'
import { useEnumStore } from '@/stores/enums'
import { useRoadmapStore } from '@/stores/roadmap'
import type { ProjectItem } from '@/types/app'
import type {
  RoadmapChangeAction,
  RoadmapFieldChange,
  RoadmapProjectRow,
} from '@/types/roadmap'

// Default login user (mock)
export const DEFAULT_LOGIN_USER = '张三'

// Initial project-member assignment (mock seed; runtime value lives in store state below).
export const INITIAL_PROJECT_MEMBER_MAP: Record<string, string[]> = {
  '1': ['张三', '李四', '王五', '赵六', '李白'],
  '3': ['王五', '赵六', '孙七'],
  '2': ['张三', '李四', '王五', '赵六', '孙七'],
  '6': ['赵六', '李四', '王五'],
  '4': ['孙七', '李四', '张三'],
  '5': ['周八', '王五', '李白'],
  '7': ['李白', '张三', '王五'],
  '8': ['杜甫', '李白', '张三', '李四', '王五'],
  '9': ['李四', '张三', '赵六', '孙七'],
  '10': ['孙七', '周八', '李白', '杜甫', '王五'],
  '11': ['王五', '李白', '张三', '赵六'],
}

export const kanbanColumns = [
  { title: '概念阶段', key: 'concept', color: '#1890ff' },
  { title: '计划阶段', key: 'planning', color: '#52c41a' },
  { title: '开发阶段', key: 'developing', color: '#faad14' },
  { title: '发布阶段', key: 'released', color: '#722ed1' },
]

type Project = Omit<typeof initialProjects[number], 'type'> & {
  type: PersistedProjectTypeName
  secondaryCategory?: string
  versionTypes?: string[]
  responsiblePersons?: string[]
  [key: string]: any
}
type ProjectPatch = Partial<Omit<ProjectItem, 'type' | 'secondaryCategory'>> & {
  type?: PersistedProjectTypeName
  secondaryCategory?: string
  [key: string]: any
}
type ProjectUpdate = ProjectPatch | ((project: Project) => Project)
type PersistedProjectState = { projects: Project[] }

export interface ProjectMutationOptions {
  allowedFirstSaleTosValues?: readonly string[]
}

const PROJECT_STORAGE_KEY = 'pms-projects'

const initialMarketConfigsByProjectId = initialProjects.reduce((acc, project) => {
  if (isMachineProjectType(project.type) && project.markets?.length) {
    acc[project.id] = buildMarketRowsFromMarkets(project.markets)
  }
  return acc
}, {} as Record<string, MarketConfigRow[]>)

const initialTosTypeConfigsByProjectId = initialProjects.reduce((acc, project) => {
  if (project.type === PROJECT_TYPE_TOS_VERSION) {
    const versionTypes = (project as typeof project & { versionTypes?: string[] }).versionTypes || []
    acc[project.id] = buildTosTypeRows(versionTypes, project.versionType || '')
  }
  return acc
}, {} as Record<string, TosTypeConfigRow[]>)

export interface ProjectState {
  projects: Project[]
  selectedProject: Project | null
  currentLoginUser: string
  projectSearchText2: string
  projectStatusFilter: string
  projectTypeFilter: string
  projectSecondaryCategoryFilter: string
  projectListView: 'card' | 'list'
  projectCardPage: number
  basicInfoEditMode: boolean
  editingProjectFields: Record<string, any>
  selectedMarketTab: string
  marketConfigsByProjectId: Record<string, MarketConfigRow[]>
  selectedTosTypeTab: string
  tosTypeConfigsByProjectId: Record<string, TosTypeConfigRow[]>
  kanbanDimension: 'stage' | 'type' | 'status'
  todoFilter: 'all' | 'overdue' | 'upcoming' | 'pending' | 'completed'
  todoCollapsed: boolean
  projectMemberMap: Record<string, string[]>
}

export interface ProjectActions {
  setProjects: (v: Project[] | ((prev: Project[]) => Project[])) => void
  setSelectedProject: (v: Project | null) => void
  setCurrentLoginUser: (v: string) => void
  setProjectSearchText2: (v: string) => void
  setProjectStatusFilter: (v: string) => void
  setProjectTypeFilter: (v: string) => void
  setProjectSecondaryCategoryFilter: (v: string) => void
  setProjectListView: (v: 'card' | 'list') => void
  setProjectCardPage: (v: number) => void
  setBasicInfoEditMode: (v: boolean) => void
  setEditingProjectFields: (v: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)) => void
  setSelectedMarketTab: (v: string) => void
  setMarketConfigForProject: (projectId: string, rows: MarketConfigRow[]) => void
  setSelectedTosTypeTab: (v: string) => void
  setTosTypeConfigForProject: (projectId: string, rows: TosTypeConfigRow[]) => void
  setKanbanDimension: (v: 'stage' | 'type' | 'status') => void
  setTodoFilter: (v: 'all' | 'overdue' | 'upcoming' | 'pending' | 'completed') => void
  setTodoCollapsed: (v: boolean) => void
  setProjectMember: (projectId: string, members: string[]) => void
  addProject: (newProject: Project, actor?: string, options?: ProjectMutationOptions) => boolean
  updateProject: (projectId: string, update: ProjectUpdate, actor?: string, options?: ProjectMutationOptions) => Project | null
  deleteProject: (projectId: string, actor?: string) => boolean
}

function resolveAllowedFirstSaleTosValues(options?: ProjectMutationOptions): string[] {
  if (options?.allowedFirstSaleTosValues) {
    return getCurrentTosEnumValues('tos-3-part', options.allowedFirstSaleTosValues)
  }
  const enumState = useEnumStore.getState()
  if (!enumState.hasHydrated || enumState.hydrationError) return []
  return getCurrentTosEnumValues('tos-3-part', enumState.valuesByType['tos-3-part'])
}

function resolveMachineTosValue(project: Project): string {
  const preferred = project.productType === '老品'
    ? [project.currentTosVersionId, project.currentTosVersion]
    : [project.firstSaleTosVersionId, project.firstSaleTosVersion]
  const candidate = [...preferred, project.tosVersionName, project.tosVersion]
    .find(value => typeof value === 'string' && value.trim())
  return normalizeTosEnumReference(candidate)
}

function isValidMachineProjectMutation(
  project: Project,
  options?: ProjectMutationOptions,
  previousProject?: Project,
): boolean {
  if (!adaptNormalProject(project as unknown as ProjectItem, [])) return false
  const tosValue = resolveMachineTosValue(project)
  if (!tosValue) return false
  const previousTosValue = previousProject ? resolveMachineTosValue(previousProject) : ''
  if (previousTosValue && tosValue === previousTosValue) return true
  return resolveAllowedFirstSaleTosValues(options).includes(tosValue)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function migrateProjectState(persistedState: unknown, _version: number): PersistedProjectState {
  if (!isRecord(persistedState) || !Array.isArray(persistedState.projects)) {
    return { projects: initialProjects as Project[] }
  }

  const seenIds = new Set<string>()
  const projects = persistedState.projects.flatMap(value => {
    if (!isRecord(value)) return []
    const id = typeof value.id === 'string' ? value.id.trim() : ''
    const name = typeof value.name === 'string' ? value.name.trim() : ''
    const rawType = typeof value.type === 'string' ? value.type.trim() : ''
    const rawSecondaryCategory = typeof value.secondaryCategory === 'string'
      ? value.secondaryCategory.trim()
      : ''
    const classification = resolveProjectClassification(rawType, rawSecondaryCategory)
    const type = classification.projectCategory
    if (!id || !name || !type || seenIds.has(id)) return []
    seenIds.add(id)
    return [{
      ...value,
      id,
      name,
      type,
      secondaryCategory: classification.secondaryCategory,
    } as Project]
  })

  if (persistedState.projects.length > 0 && projects.length === 0) {
    return { projects: initialProjects as Project[] }
  }
  return { projects }
}

export function partializeProjectState(state: ProjectState & ProjectActions): PersistedProjectState {
  return { projects: state.projects }
}

const safeProjectStorage: StateStorage = {
  getItem(name) {
    if (typeof window === 'undefined') return null
    try {
      const stored = window.localStorage.getItem(name)
      if (stored !== null) JSON.parse(stored)
      return stored
    } catch (error) {
      console.error(`Failed to read ${PROJECT_STORAGE_KEY}; using initial project state.`, error)
      return null
    }
  },
  setItem(name, value) {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(name, value)
    } catch (error) {
      console.error(`Failed to persist ${PROJECT_STORAGE_KEY}.`, error)
    }
  },
  removeItem(name) {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.removeItem(name)
    } catch (error) {
      console.error(`Failed to remove ${PROJECT_STORAGE_KEY}.`, error)
    }
  },
}

function recordNormalProjectAudit(
  action: RoadmapChangeAction,
  before: Project | null,
  after: Project | null,
  actor: string,
): void {
  const roadmapState = useRoadmapStore.getState()
  const beforeRow = before ? adaptNormalProject(before as unknown as ProjectItem, []) : null
  const afterRow = after ? adaptNormalProject(after as unknown as ProjectItem, []) : null

  let auditRow: RoadmapProjectRow | null = null
  if (action === 'create') auditRow = afterRow
  if (action === 'delete') auditRow = beforeRow
  if (action === 'update') {
    if (!beforeRow || !afterRow) return
    const changes = diffRoadmapProjectFields(beforeRow, afterRow, [])
    if (!changes.length) return
    roadmapState.recordNormalProjectChange({
      projectId: afterRow.id,
      projectDisplayName: buildRoadmapDisplayName(
        afterRow.projectCode,
        afterRow.androidVersion,
        afterRow.productType,
      ),
      action,
      actor,
      tosVersionName: `tOS${afterRow.firstSaleTosVersionId}`,
      changes: changes as [RoadmapFieldChange, ...RoadmapFieldChange[]],
    })
    return
  }

  if (!auditRow) return
  roadmapState.recordNormalProjectChange({
    projectId: auditRow.id,
    projectDisplayName: buildRoadmapDisplayName(
      auditRow.projectCode,
      auditRow.androidVersion,
      auditRow.productType,
    ),
    action,
    actor,
    tosVersionName: `tOS${auditRow.firstSaleTosVersionId}`,
    changes: [],
    snapshot: createRoadmapAuditSnapshot(auditRow, []),
  })
}

export const useProjectStore = create<ProjectState & ProjectActions>()(persist(
  (set, get) => ({
    projects: initialProjects as Project[],
    selectedProject: null,
    currentLoginUser: DEFAULT_LOGIN_USER,
    projectSearchText2: '',
    projectStatusFilter: 'all',
    projectTypeFilter: 'all',
    projectSecondaryCategoryFilter: 'all',
    projectListView: 'card',
    projectCardPage: 1,
    basicInfoEditMode: false,
    editingProjectFields: {},
    selectedMarketTab: 'OP',
    marketConfigsByProjectId: initialMarketConfigsByProjectId,
    selectedTosTypeTab: 'Full',
    tosTypeConfigsByProjectId: initialTosTypeConfigsByProjectId,
    kanbanDimension: 'stage',
    todoFilter: 'all',
    todoCollapsed: false,
    projectMemberMap: { ...INITIAL_PROJECT_MEMBER_MAP },

    setProjects: (v) => set(state => ({ projects: typeof v === 'function' ? v(state.projects) : v })),
    setSelectedProject: (v) => set({ selectedProject: v }),
    setCurrentLoginUser: (v) => set({ currentLoginUser: v }),
    setProjectSearchText2: (v) => set({ projectSearchText2: v }),
    setProjectStatusFilter: (v) => set({ projectStatusFilter: v }),
    setProjectTypeFilter: (v) => set({ projectTypeFilter: v }),
    setProjectSecondaryCategoryFilter: (v) => set({ projectSecondaryCategoryFilter: v }),
    setProjectListView: (v) => set({ projectListView: v }),
    setProjectCardPage: (v) => set({ projectCardPage: v }),
    setBasicInfoEditMode: (v) => set({ basicInfoEditMode: v }),
    setEditingProjectFields: (v) => set(state => ({
      editingProjectFields: typeof v === 'function' ? v(state.editingProjectFields) : v,
    })),
    setSelectedMarketTab: (v) => set({ selectedMarketTab: v }),
    setMarketConfigForProject: (projectId, rows) => set(state => ({
      marketConfigsByProjectId: { ...state.marketConfigsByProjectId, [projectId]: rows },
    })),
    setSelectedTosTypeTab: (v) => set({ selectedTosTypeTab: v }),
    setTosTypeConfigForProject: (projectId, rows) => set(state => ({
      tosTypeConfigsByProjectId: { ...state.tosTypeConfigsByProjectId, [projectId]: rows },
    })),
    setKanbanDimension: (v) => set({ kanbanDimension: v }),
    setTodoFilter: (v) => set({ todoFilter: v }),
    setTodoCollapsed: (v) => set({ todoCollapsed: v }),
    setProjectMember: (projectId, members) => set(state => ({
      projectMemberMap: { ...state.projectMemberMap, [projectId]: members },
    })),
    addProject: (newProject, actor, options) => {
      if (isMachineProjectType(newProject.type) && !isValidMachineProjectMutation(newProject, options)) {
        return false
      }
      set(state => ({ projects: [...state.projects, newProject] }))
      recordNormalProjectAudit('create', null, newProject, actor?.trim() || get().currentLoginUser.trim() || '系统')
      return true
    },
    updateProject: (projectId, update, actor, options) => {
      const existing = get().projects.find(project => project.id === projectId)
      if (!existing) return null
      const updated = typeof update === 'function'
        ? update(existing)
        : { ...existing, ...update } as Project
      if (isMachineProjectType(updated.type) && !isValidMachineProjectMutation(updated, options, existing)) {
        return null
      }
      set(state => ({
        projects: state.projects.map(project => project.id === projectId ? updated : project),
        selectedProject: state.selectedProject?.id === projectId ? updated : state.selectedProject,
      }))
      recordNormalProjectAudit('update', existing, updated, actor?.trim() || get().currentLoginUser.trim() || '系统')
      return updated
    },
    deleteProject: (projectId, actor) => {
      const existing = get().projects.find(project => project.id === projectId)
      if (!existing) return false
      set(state => ({
        projects: state.projects.filter(project => project.id !== projectId),
        selectedProject: state.selectedProject?.id === projectId ? null : state.selectedProject,
      }))
      recordNormalProjectAudit('delete', existing, null, actor?.trim() || get().currentLoginUser.trim() || '系统')
      return true
    },
  }),
  {
    name: PROJECT_STORAGE_KEY,
    version: 3,
    storage: createJSONStorage(() => safeProjectStorage),
    migrate: migrateProjectState,
    partialize: partializeProjectState,
    merge: (persistedState, currentState) => ({
      ...currentState,
      ...migrateProjectState(persistedState, 3),
    }),
  },
))
