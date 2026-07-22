import { create } from 'zustand'
import { initialProjects } from '@/data/projects'
import { isMachineProjectType } from '@/constants/projectTypes'
import { buildMarketRowsFromMarkets, type MarketConfigRow } from '@/lib/marketRules'
import { adaptNormalProject } from '@/lib/roadmapProjectAdapter'
import { createRoadmapAuditSnapshot, diffRoadmapProjectFields } from '@/lib/roadmapAudit'
import { useRoadmapStore } from '@/stores/roadmap'
import type { ProjectItem } from '@/types/app'
import type { RoadmapChangeAction, RoadmapFieldChange, RoadmapProjectRow, TosVersionConfig } from '@/types/roadmap'

// Default login user (mock)
export const DEFAULT_LOGIN_USER = '张三'

// Initial project-member assignment (mock seed; runtime value lives in store state below).
export const INITIAL_PROJECT_MEMBER_MAP: Record<string, string[]> = {
  '1': ['张三', '李四', '王五', '赵六', '李白'],         // X6877
  '3': ['王五', '赵六', '孙七'],                         // X6855
  '2': ['张三', '李四', '王五', '赵六', '孙七'],         // tOS16.0
  '6': ['赵六', '李四', '王五'],                         // tOS17.1
  '4': ['孙七', '李四', '张三'],                         // X6876_H786
  '5': ['周八', '王五', '李白'],                         // X6873_H972
  '7': ['李白', '张三', '王五'],                         // X6890 CAMON
  '8': ['杜甫', '李白', '张三', '李四', '王五'],         // tOS18.0
  '9': ['李四', '张三', '赵六', '孙七'],                 // AI-Engine-V2
  '10': ['孙七', '周八', '李白', '杜甫', '王五'],        // DevOps-Platform
  '11': ['王五', '李白', '张三', '赵六'],                // HiOS-Launcher
}

// Kanban stage columns
export const kanbanColumns = [
  { title: '概念阶段', key: 'concept', color: '#1890ff' },
  { title: '计划阶段', key: 'planning', color: '#52c41a' },
  { title: '开发阶段', key: 'developing', color: '#faad14' },
  { title: '发布阶段', key: 'released', color: '#722ed1' },
]

type Project = typeof initialProjects[number]
type ProjectPatch = Partial<Omit<ProjectItem, 'type'>> & { type?: string; [key: string]: any }

const initialMarketConfigsByProjectId = initialProjects.reduce((acc, project) => {
  if (isMachineProjectType(project.type) && project.markets?.length) {
    acc[project.id] = buildMarketRowsFromMarkets(project.markets)
  }
  return acc
}, {} as Record<string, MarketConfigRow[]>)

export interface ProjectState {
  projects: Project[]
  selectedProject: Project | null
  currentLoginUser: string

  // Workspace filters
  projectSearchText2: string
  projectStatusFilter: string
  projectTypeFilter: string
  projectListView: 'card' | 'list'
  projectCardPage: number

  // Basic info editing
  basicInfoEditMode: boolean
  editingProjectFields: Record<string, any>

  // Market & kanban
  selectedMarketTab: string
  marketConfigsByProjectId: Record<string, MarketConfigRow[]>
  kanbanDimension: 'stage' | 'type' | 'status'

  // Todos
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
  setProjectListView: (v: 'card' | 'list') => void
  setProjectCardPage: (v: number) => void

  setBasicInfoEditMode: (v: boolean) => void
  setEditingProjectFields: (v: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)) => void

  setSelectedMarketTab: (v: string) => void
  setMarketConfigForProject: (projectId: string, rows: MarketConfigRow[]) => void
  setKanbanDimension: (v: 'stage' | 'type' | 'status') => void

  setTodoFilter: (v: 'all' | 'overdue' | 'upcoming' | 'pending' | 'completed') => void
  setTodoCollapsed: (v: boolean) => void

  setProjectMember: (projectId: string, members: string[]) => void
  addProject: (newProject: Project, actor?: string) => boolean
  updateProject: (projectId: string, patch: ProjectPatch, actor?: string) => Project | null
  deleteProject: (projectId: string, actor?: string) => boolean
}

function resolveTosVersionName(versions: readonly TosVersionConfig[], versionId: string): string {
  return versions.find(version => version.id === versionId)?.name ?? versionId
}

function recordNormalProjectAudit(
  action: RoadmapChangeAction,
  before: Project | null,
  after: Project | null,
  actor: string,
): void {
  const roadmapState = useRoadmapStore.getState()
  const versions = roadmapState.tosVersions
  const beforeRow = before ? adaptNormalProject(before as ProjectItem, versions) : null
  const afterRow = after ? adaptNormalProject(after as ProjectItem, versions) : null

  let auditRow: RoadmapProjectRow | null = null
  if (action === 'create') auditRow = afterRow
  if (action === 'delete') auditRow = beforeRow
  if (action === 'update') {
    if (!beforeRow || !afterRow) return
    const changes = diffRoadmapProjectFields(beforeRow, afterRow, versions)
    if (!changes.length) return
    roadmapState.recordNormalProjectChange({
      projectId: afterRow.id,
      projectDisplayName: afterRow.displayName,
      action,
      actor,
      tosVersionName: resolveTosVersionName(versions, afterRow.firstSaleTosVersionId),
      changes: changes as [RoadmapFieldChange, ...RoadmapFieldChange[]],
    })
    return
  }

  if (!auditRow) return
  roadmapState.recordNormalProjectChange({
    projectId: auditRow.id,
    projectDisplayName: auditRow.displayName,
    action,
    actor,
    tosVersionName: resolveTosVersionName(versions, auditRow.firstSaleTosVersionId),
    changes: [],
    snapshot: createRoadmapAuditSnapshot(auditRow, versions),
  })
}

export const useProjectStore = create<ProjectState & ProjectActions>()((set, get) => ({
  projects: initialProjects,
  selectedProject: null,
  currentLoginUser: DEFAULT_LOGIN_USER,

  projectSearchText2: '',
  projectStatusFilter: 'all',
  projectTypeFilter: 'all',
  projectListView: 'card',
  projectCardPage: 1,

  basicInfoEditMode: false,
  editingProjectFields: {},

  selectedMarketTab: 'OP',
  marketConfigsByProjectId: initialMarketConfigsByProjectId,
  kanbanDimension: 'stage',

  todoFilter: 'all',
  todoCollapsed: false,

  projectMemberMap: { ...INITIAL_PROJECT_MEMBER_MAP },

  // Setters
  setProjects: (v) => set((s) => ({ projects: typeof v === 'function' ? v(s.projects) : v })),
  setSelectedProject: (v) => set({ selectedProject: v }),
  setCurrentLoginUser: (v) => set({ currentLoginUser: v }),

  setProjectSearchText2: (v) => set({ projectSearchText2: v }),
  setProjectStatusFilter: (v) => set({ projectStatusFilter: v }),
  setProjectTypeFilter: (v) => set({ projectTypeFilter: v }),
  setProjectListView: (v) => set({ projectListView: v }),
  setProjectCardPage: (v) => set({ projectCardPage: v }),

  setBasicInfoEditMode: (v) => set({ basicInfoEditMode: v }),
  setEditingProjectFields: (v) => set((s) => ({ editingProjectFields: typeof v === 'function' ? v(s.editingProjectFields) : v })),

  setSelectedMarketTab: (v) => set({ selectedMarketTab: v }),
  setMarketConfigForProject: (projectId, rows) => set((s) => ({
    marketConfigsByProjectId: { ...s.marketConfigsByProjectId, [projectId]: rows },
  })),
  setKanbanDimension: (v) => set({ kanbanDimension: v }),

  setTodoFilter: (v) => set({ todoFilter: v }),
  setTodoCollapsed: (v) => set({ todoCollapsed: v }),

  setProjectMember: (projectId, members) => set((s) => ({
    projectMemberMap: { ...s.projectMemberMap, [projectId]: members },
  })),
  addProject: (newProject, actor) => {
    const versions = useRoadmapStore.getState().tosVersions
    if (isMachineProjectType(newProject.type) && !adaptNormalProject(newProject as ProjectItem, versions)) {
      return false
    }
    set((state) => ({ projects: [...state.projects, newProject] }))
    recordNormalProjectAudit('create', null, newProject, actor?.trim() || get().currentLoginUser.trim() || '系统')
    return true
  },
  updateProject: (projectId, patch, actor) => {
    const existing = get().projects.find(project => project.id === projectId)
    if (!existing) return null
    const updated = { ...existing, ...patch } as Project
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
}))
