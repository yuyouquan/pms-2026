import { create } from 'zustand'
import { initialProjects } from '@/data/projects'

// Default login user (mock)
export const DEFAULT_LOGIN_USER = '张三'

// Project-member assignment (mock: which users are assigned per project in permission config)
export const PROJECT_MEMBER_MAP: Record<string, string[]> = {
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
}

// Kanban stage columns
export const kanbanColumns = [
  { title: '概念阶段', key: 'concept', color: '#1890ff' },
  { title: '计划阶段', key: 'planning', color: '#52c41a' },
  { title: '开发阶段', key: 'developing', color: '#faad14' },
  { title: '发布阶段', key: 'released', color: '#722ed1' },
]

type Project = typeof initialProjects[0]

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
  kanbanDimension: 'stage' | 'type' | 'status'

  // Todos
  todoFilter: 'all' | 'overdue' | 'upcoming' | 'pending' | 'completed'
  todoCollapsed: boolean
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
  setKanbanDimension: (v: 'stage' | 'type' | 'status') => void

  setTodoFilter: (v: 'all' | 'overdue' | 'upcoming' | 'pending' | 'completed') => void
  setTodoCollapsed: (v: boolean) => void
}

export const useProjectStore = create<ProjectState & ProjectActions>()((set) => ({
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
  kanbanDimension: 'stage',

  todoFilter: 'all',
  todoCollapsed: false,

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
  setKanbanDimension: (v) => set({ kanbanDimension: v }),

  setTodoFilter: (v) => set({ todoFilter: v }),
  setTodoCollapsed: (v) => set({ todoCollapsed: v }),
}))
