import { create } from 'zustand'
import type { CompareTableRow } from '@/lib/versionCompare'

// ─── Exported constants ───────────────────────────────────────────────

/** Selectable L2 plan types (excludes the two fixed types) */
export const LEVEL2_PLAN_TYPES = ['1+N MR版本火车计划', '粉丝版本计划', '基础体验计划', 'WBS计划']

/** Fixed L2 plans that always show in the first two positions and cannot be deleted */
export const FIXED_LEVEL2_PLANS = [
  { id: 'plan0', name: '需求开发计划', type: '需求开发计划', fixed: true as const },
  { id: 'plan1', name: '在研版本火车计划', type: '在研版本火车计划', fixed: true as const },
]

export const VERSION_DATA = [
  { id: 'v1', versionNo: 'V1', status: '已发布' },
  { id: 'v2', versionNo: 'V2', status: '已发布' },
  { id: 'v3', versionNo: 'V3', status: '已发布' },
]

export const LEVEL1_TASKS = [
  { id: '1', order: 1, taskName: '概念', status: '已完成', progress: 100, responsible: '张三', predecessor: '', planStartDate: '2026-01-01', planEndDate: '2026-01-15', estimatedDays: 15, actualStartDate: '2026-01-01', actualEndDate: '2026-01-14', actualDays: 14 },
  { id: '1.1', parentId: '1', order: 1, taskName: '概念启动', status: '已完成', progress: 100, responsible: '张三', predecessor: '', planStartDate: '2026-01-01', planEndDate: '2026-01-07', estimatedDays: 7, actualStartDate: '2026-01-01', actualEndDate: '2026-01-07', actualDays: 7 },
  { id: '1.2', parentId: '1', order: 2, taskName: 'STR1', status: '已完成', progress: 100, responsible: '李四', predecessor: '1.1', planStartDate: '2026-01-08', planEndDate: '2026-01-15', estimatedDays: 8, actualStartDate: '2026-01-08', actualEndDate: '2026-01-14', actualDays: 7 },
  { id: '2', order: 2, taskName: '计划', status: '进行中', progress: 60, responsible: '王五', predecessor: '1.2', planStartDate: '2026-01-16', planEndDate: '2026-02-15', estimatedDays: 30, actualStartDate: '2026-01-16', actualEndDate: '', actualDays: 18 },
  { id: '2.1', parentId: '2', order: 1, taskName: 'STR2', status: '进行中', progress: 60, responsible: '王五', predecessor: '1.2', planStartDate: '2026-01-16', planEndDate: '2026-01-31', estimatedDays: 15, actualStartDate: '2026-01-16', actualEndDate: '', actualDays: 12 },
  { id: '2.2', parentId: '2', order: 2, taskName: 'STR3', status: '未开始', progress: 0, responsible: '赵六', predecessor: '2.1', planStartDate: '2026-02-01', planEndDate: '2026-02-15', estimatedDays: 15, actualStartDate: '', actualEndDate: '', actualDays: 0 },
  { id: '3', order: 3, taskName: '开发验证', status: '未开始', progress: 0, responsible: '', predecessor: '2.2', planStartDate: '2026-02-16', planEndDate: '2026-03-15', estimatedDays: 28, actualStartDate: '', actualEndDate: '', actualDays: 0 },
  { id: '4', order: 4, taskName: '上市保障', status: '未开始', progress: 0, responsible: '', predecessor: '3', planStartDate: '2026-03-16', planEndDate: '2026-04-15', estimatedDays: 30, actualStartDate: '', actualEndDate: '', actualDays: 0 },
]

// 配置中心模板专用：只保留结构字段，清空日期/工期/实际/状态/进度
export const LEVEL1_TEMPLATE_TASKS = LEVEL1_TASKS.map(t => ({
  ...t,
  planStartDate: '', planEndDate: '', estimatedDays: 0,
  actualStartDate: '', actualEndDate: '', actualDays: 0,
  status: '未开始', progress: 0,
}))

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

export const TABLE_COLUMNS = ALL_COLUMNS

export const GANTT_COLUMNS = [
  { key: 'taskName', title: '任务名称', default: true },
  { key: 'predecessor', title: '前置任务', default: true },
  { key: 'planStartDate', title: '计划开始', default: true },
  { key: 'planEndDate', title: '计划完成', default: true },
  { key: 'estimatedDays', title: '计划周期', default: true },
  { key: 'progress', title: '进度', default: true },
]

export const getColumnsForView = (viewMode: string) => {
  if (viewMode === 'gantt') return GANTT_COLUMNS
  if (viewMode === 'horizontal') return [] // 横版无自定义列
  return TABLE_COLUMNS
}

/** Initial L2 plan tasks (in-line data from page.tsx) */
export const INITIAL_LEVEL2_PLAN_TASKS: any[] = [
  // 在研版本火车计划 - 三层结构 (plan1)
  { id: '1', order: 1, taskName: '16.3.030', status: '已完成', progress: 100, responsible: '张三', predecessor: '', planStartDate: '2026-01-01', planEndDate: '2026-02-01', planId: 'plan1' },
  { id: '1.1', parentId: '1', order: 1, taskName: '需求分析', status: '已完成', progress: 100, responsible: '张三', predecessor: '', planStartDate: '2026-01-01', planEndDate: '2026-01-15', planId: 'plan1' },
  { id: '1.1.1', parentId: '1.1', order: 1, taskName: 'IR需求梳理', status: '已完成', progress: 100, responsible: '张三', predecessor: '', planStartDate: '2026-01-01', planEndDate: '2026-01-07', planId: 'plan1' },
  { id: '1.1.2', parentId: '1.1', order: 2, taskName: 'SR需求拆分', status: '已完成', progress: 100, responsible: '李四', predecessor: '1.1.1', planStartDate: '2026-01-08', planEndDate: '2026-01-15', planId: 'plan1' },
  { id: '1.2', parentId: '1', order: 2, taskName: '开发集成', status: '已完成', progress: 100, responsible: '王五', predecessor: '1.1', planStartDate: '2026-01-16', planEndDate: '2026-02-01', planId: 'plan1' },
  { id: '2', order: 2, taskName: '16.3.031', status: '进行中', progress: 60, responsible: '李四', predecessor: '1', planStartDate: '2026-02-02', planEndDate: '2026-03-15', planId: 'plan1' },
  { id: '2.1', parentId: '2', order: 1, taskName: '功能开发', status: '进行中', progress: 70, responsible: '李四', predecessor: '', planStartDate: '2026-02-02', planEndDate: '2026-02-28', planId: 'plan1' },
  { id: '2.1.1', parentId: '2.1', order: 1, taskName: 'Camera模块', status: '已完成', progress: 100, responsible: '李四', predecessor: '', planStartDate: '2026-02-02', planEndDate: '2026-02-15', planId: 'plan1' },
  { id: '2.1.2', parentId: '2.1', order: 2, taskName: 'Display模块', status: '进行中', progress: 40, responsible: '赵六', predecessor: '2.1.1', planStartDate: '2026-02-16', planEndDate: '2026-02-28', planId: 'plan1' },
  { id: '2.2', parentId: '2', order: 2, taskName: '集成测试', status: '未开始', progress: 0, responsible: '王五', predecessor: '2.1', planStartDate: '2026-03-01', planEndDate: '2026-03-15', planId: 'plan1' },
  { id: '3', order: 3, taskName: '16.3.032', status: '未开始', progress: 0, responsible: '王五', predecessor: '2', planStartDate: '2026-03-16', planEndDate: '2026-05-01', planId: 'plan1' },
  // FR版本火车计划 - 三层结构 (plan2)
  { id: '1', order: 1, taskName: '版本规划', status: '已完成', progress: 100, responsible: '赵六', predecessor: '', planStartDate: '2026-01-02', planEndDate: '2026-02-02', planId: 'plan2' },
  { id: '1.1', parentId: '1', order: 1, taskName: '修改点收集', status: '已完成', progress: 100, responsible: '赵六', predecessor: '', planStartDate: '2026-01-02', planEndDate: '2026-01-20', planId: 'plan2' },
  { id: '1.1.1', parentId: '1.1', order: 1, taskName: '需求变更评审', status: '已完成', progress: 100, responsible: '赵六', predecessor: '', planStartDate: '2026-01-02', planEndDate: '2026-01-10', planId: 'plan2' },
  { id: '1.1.2', parentId: '1.1', order: 2, taskName: '修改点确认', status: '已完成', progress: 100, responsible: '孙七', predecessor: '1.1.1', planStartDate: '2026-01-11', planEndDate: '2026-01-20', planId: 'plan2' },
  { id: '1.2', parentId: '1', order: 2, taskName: '版本计划制定', status: '已完成', progress: 100, responsible: '孙七', predecessor: '1.1', planStartDate: '2026-01-21', planEndDate: '2026-02-02', planId: 'plan2' },
  { id: '2', order: 2, taskName: '版本开发', status: '进行中', progress: 50, responsible: '孙七', predecessor: '1', planStartDate: '2026-02-02', planEndDate: '2026-03-15', planId: 'plan2' },
  { id: '2.1', parentId: '2', order: 1, taskName: 'MP分支入库', status: '进行中', progress: 60, responsible: '孙七', predecessor: '', planStartDate: '2026-02-02', planEndDate: '2026-03-01', planId: 'plan2' },
  { id: '2.1.1', parentId: '2.1', order: 1, taskName: '代码合入', status: '已完成', progress: 100, responsible: '孙七', predecessor: '', planStartDate: '2026-02-02', planEndDate: '2026-02-15', planId: 'plan2' },
  { id: '2.1.2', parentId: '2.1', order: 2, taskName: '编译验证', status: '进行中', progress: 30, responsible: '周八', predecessor: '2.1.1', planStartDate: '2026-02-16', planEndDate: '2026-03-01', planId: 'plan2' },
  { id: '2.2', parentId: '2', order: 2, taskName: 'MR版本转测', status: '未开始', progress: 0, responsible: '周八', predecessor: '2.1', planStartDate: '2026-03-02', planEndDate: '2026-03-15', planId: 'plan2' },
  { id: '3', order: 3, taskName: '版本测试', status: '未开始', progress: 0, responsible: '吴九', predecessor: '2', planStartDate: '2026-03-16', planEndDate: '2026-05-01', planId: 'plan2' },
  { id: '3.1', parentId: '3', order: 1, taskName: 'MR版本测试', status: '未开始', progress: 0, responsible: '吴九', predecessor: '', planStartDate: '2026-03-16', planEndDate: '2026-05-01', planId: 'plan2' },
  { id: '3.1.1', parentId: '3.1', order: 1, taskName: '冒烟测试', status: '未开始', progress: 0, responsible: '吴九', predecessor: '', planStartDate: '2026-03-16', planEndDate: '2026-03-25', planId: 'plan2' },
  { id: '3.1.2', parentId: '3.1', order: 2, taskName: '回归测试', status: '未开始', progress: 0, responsible: '吴九', predecessor: '3.1.1', planStartDate: '2026-03-26', planEndDate: '2026-05-01', planId: 'plan2' },
  // MR版本火车计划 (plan3)
  { id: '1', order: 1, taskName: 'MR版本规划', status: '未开始', progress: 0, responsible: '周八', predecessor: '', planStartDate: '2026-03-01', planEndDate: '2026-03-15', planId: 'plan3' },
  { id: '1.1', parentId: '1', order: 1, taskName: '版本需求整理', status: '未开始', progress: 0, responsible: '周八', predecessor: '', planStartDate: '2026-03-01', planEndDate: '2026-03-10', planId: 'plan3' },
  { id: '1.2', parentId: '1', order: 2, taskName: '版本计划评审', status: '未开始', progress: 0, responsible: '周八', predecessor: '1.1', planStartDate: '2026-03-11', planEndDate: '2026-03-15', planId: 'plan3' },
  { id: '2', order: 2, taskName: 'MR版本开发', status: '未开始', progress: 0, responsible: '吴九', predecessor: '1', planStartDate: '2026-03-16', planEndDate: '2026-04-15', planId: 'plan3' },
  { id: '2.1', parentId: '2', order: 1, taskName: '功能修复', status: '未开始', progress: 0, responsible: '吴九', predecessor: '', planStartDate: '2026-03-16', planEndDate: '2026-04-01', planId: 'plan3' },
  { id: '2.2', parentId: '2', order: 2, taskName: '版本集成', status: '未开始', progress: 0, responsible: '吴九', predecessor: '2.1', planStartDate: '2026-04-02', planEndDate: '2026-04-15', planId: 'plan3' },
]

/** Initial L2 plan metadata (form info saved at creation time) */
export const INITIAL_LEVEL2_PLAN_META: Record<string, any> = {
  plan2: {
    planType: '1+N MR版本火车计划', planName: 'FR版本火车计划', mrVersion: 'FR',
    productLine: 'NOTE', marketName: 'OP', projectName: 'X6877-D8400_H991',
    chipVendor: 'MTK', tosVersion: '16.3.050', branch: '16.3.050_main',
    isMada: '否', madaMarket: '', spm: '李白', tpm: '王五', contact: '孙七',
    projectVersion: 'V1.0.0', transferType: '1',
  },
  plan3: {
    planType: '1+N MR版本火车计划', planName: 'MR1版本火车计划', mrVersion: 'MR1',
    productLine: 'NOTE', marketName: 'OP', projectName: 'X6877-D8400_H991',
    chipVendor: 'MTK', tosVersion: '16.3.051', branch: '16.3.050_MR1',
    isMada: '是', madaMarket: 'EU', spm: '张三', tpm: '赵六', contact: '周八',
    projectVersion: 'V1.1.0', transferType: '2',
  },
}

// ─── Helper to compute default columns ──────────────────────────────
const defaultCols = ALL_COLUMNS.filter(c => c.default).map(c => c.key)

// ─── Store types ────────────────────────────────────────────────────

type Level2Plan = { id: string; name: string; type: string; fixed?: boolean }

export interface PlanState {
  // Config-center plan
  planLevel: string
  selectedPlanType: string
  customTypes: string[]
  viewMode: 'table' | 'gantt'

  // Project-space plan
  projectPlanLevel: string
  projectPlanViewMode: 'table' | 'horizontal' | 'gantt'
  projectPlanOverviewTab: string
  planMetaCollapsed: boolean

  // Versions
  versions: typeof VERSION_DATA
  currentVersion: string

  // Tasks
  tasks: any[]
  searchText: string

  // Level 2
  level2PlanTasks: any[]
  level2PlanMilestones: string[]
  createdLevel2Plans: Level2Plan[]
  activeLevel2Plan: string
  level2PlanMeta: Record<string, any>
  createFormValues: Record<string, string>
  selectedLevel2PlanType: string
  selectedMilestones: string[]
  selectedMRVersion: string

  // Columns per view
  columnsByView: Record<string, string[]>

  // Collapsed tree nodes per scope
  collapsedNodes: Record<string, Set<string>>

  // Published snapshots
  publishedSnapshots: Record<string, any[]>

  // Version compare
  compareVersionA: string
  compareVersionB: string
  compareResult: CompareTableRow[]
  compareShowUnchanged: boolean
  compareFilterType: string

  // Market plan data (whole-machine projects)
  marketPlanData: Record<string, { tasks: any[]; level2Tasks: any[]; createdLevel2Plans: Level2Plan[] }>

  // Editing helpers
  ganttEditingTask: any
  progressEditingTask: any

  // Time-constraint warnings
  parentTimeWarning: { visible: boolean; tasks: any[]; message: string }
  milestoneTimeWarning: { visible: boolean; violations: any[]; message: string }
  predecessorWarning: { visible: boolean; task: any; message: string }
}

export interface PlanActions {
  setPlanLevel: (v: string) => void
  setSelectedPlanType: (v: string) => void
  setCustomTypes: (v: string[] | ((prev: string[]) => string[])) => void
  setViewMode: (v: 'table' | 'gantt') => void

  setProjectPlanLevel: (v: string) => void
  setProjectPlanViewMode: (v: 'table' | 'horizontal' | 'gantt') => void
  setProjectPlanOverviewTab: (v: string) => void
  setPlanMetaCollapsed: (v: boolean) => void

  setVersions: (v: typeof VERSION_DATA | ((prev: typeof VERSION_DATA) => typeof VERSION_DATA)) => void
  setCurrentVersion: (v: string) => void

  setTasks: (v: any[] | ((prev: any[]) => any[])) => void
  setSearchText: (v: string) => void

  setLevel2PlanTasks: (v: any[] | ((prev: any[]) => any[])) => void
  setLevel2PlanMilestones: (v: string[] | ((prev: string[]) => string[])) => void
  setCreatedLevel2Plans: (v: Level2Plan[] | ((prev: Level2Plan[]) => Level2Plan[])) => void
  setActiveLevel2Plan: (v: string) => void
  setLevel2PlanMeta: (v: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)) => void
  setCreateFormValues: (v: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void
  setSelectedLevel2PlanType: (v: string) => void
  setSelectedMilestones: (v: string[] | ((prev: string[]) => string[])) => void
  setSelectedMRVersion: (v: string) => void

  setColumnsByView: (v: Record<string, string[]> | ((prev: Record<string, string[]>) => Record<string, string[]>)) => void
  setCollapsedNodes: (v: Record<string, Set<string>> | ((prev: Record<string, Set<string>>) => Record<string, Set<string>>)) => void

  setPublishedSnapshots: (v: Record<string, any[]> | ((prev: Record<string, any[]>) => Record<string, any[]>)) => void

  setCompareVersionA: (v: string) => void
  setCompareVersionB: (v: string) => void
  setCompareResult: (v: CompareTableRow[]) => void
  setCompareShowUnchanged: (v: boolean) => void
  setCompareFilterType: (v: string) => void

  setMarketPlanData: (v: Record<string, { tasks: any[]; level2Tasks: any[]; createdLevel2Plans: Level2Plan[] }> | ((prev: Record<string, { tasks: any[]; level2Tasks: any[]; createdLevel2Plans: Level2Plan[] }>) => Record<string, { tasks: any[]; level2Tasks: any[]; createdLevel2Plans: Level2Plan[] }>)) => void

  setGanttEditingTask: (v: any) => void
  setProgressEditingTask: (v: any) => void

  setParentTimeWarning: (v: { visible: boolean; tasks: any[]; message: string }) => void
  setMilestoneTimeWarning: (v: { visible: boolean; violations: any[]; message: string }) => void
  setPredecessorWarning: (v: { visible: boolean; task: any; message: string }) => void
}

export const usePlanStore = create<PlanState & PlanActions>()((set) => ({
  // Config-center plan
  planLevel: 'level1',
  selectedPlanType: LEVEL2_PLAN_TYPES[0],
  customTypes: [],
  viewMode: 'table',

  // Project-space plan
  projectPlanLevel: 'level1',
  projectPlanViewMode: 'table',
  projectPlanOverviewTab: 'overview',
  planMetaCollapsed: false,

  // Versions
  versions: [...VERSION_DATA],
  currentVersion: 'v3',

  // Tasks
  tasks: [...LEVEL1_TASKS],
  searchText: '',

  // Level 2
  level2PlanTasks: [...INITIAL_LEVEL2_PLAN_TASKS],
  level2PlanMilestones: [],
  createdLevel2Plans: [
    ...FIXED_LEVEL2_PLANS,
    { id: 'plan2', name: 'FR版本火车计划', type: 'FR版本火车计划' },
    { id: 'plan3', name: 'MR1版本火车计划', type: 'MR版本火车计划' },
  ],
  activeLevel2Plan: 'plan0',
  level2PlanMeta: { ...INITIAL_LEVEL2_PLAN_META },
  createFormValues: {},
  selectedLevel2PlanType: '1+N MR版本火车计划',
  selectedMilestones: [],
  selectedMRVersion: 'FR',

  // Columns per view
  columnsByView: {
    'config-table': [...defaultCols],
    'config-gantt': [...defaultCols],
    'project-table': [...defaultCols],
    'project-gantt': [...defaultCols],
    'project-horizontal': [...defaultCols],
  },

  // Collapsed tree nodes
  collapsedNodes: {},

  // Published snapshots
  publishedSnapshots: {},

  // Version compare
  compareVersionA: 'v1',
  compareVersionB: 'v3',
  compareResult: [],
  compareShowUnchanged: false,
  compareFilterType: 'all',

  // Market plan data
  marketPlanData: {
    'OP': { tasks: [...LEVEL1_TASKS], level2Tasks: [], createdLevel2Plans: [...FIXED_LEVEL2_PLANS] },
    'TR': { tasks: [...LEVEL1_TASKS.map(t => ({ ...t }))], level2Tasks: [], createdLevel2Plans: [...FIXED_LEVEL2_PLANS] },
    'RU': { tasks: [...LEVEL1_TASKS.map(t => ({ ...t }))], level2Tasks: [], createdLevel2Plans: [...FIXED_LEVEL2_PLANS] },
  },

  // Editing helpers
  ganttEditingTask: null,
  progressEditingTask: null,

  // Warnings
  parentTimeWarning: { visible: false, tasks: [], message: '' },
  milestoneTimeWarning: { visible: false, violations: [], message: '' },
  predecessorWarning: { visible: false, task: null, message: '' },

  // ─── Setters ─────────────────────────────────────────────────────
  setPlanLevel: (v) => set({ planLevel: v }),
  setSelectedPlanType: (v) => set({ selectedPlanType: v }),
  setCustomTypes: (v) => set((s) => ({ customTypes: typeof v === 'function' ? v(s.customTypes) : v })),
  setViewMode: (v) => set({ viewMode: v }),

  setProjectPlanLevel: (v) => set({ projectPlanLevel: v }),
  setProjectPlanViewMode: (v) => set({ projectPlanViewMode: v }),
  setProjectPlanOverviewTab: (v) => set({ projectPlanOverviewTab: v }),
  setPlanMetaCollapsed: (v) => set({ planMetaCollapsed: v }),

  setVersions: (v) => set((s) => ({ versions: typeof v === 'function' ? v(s.versions) : v })),
  setCurrentVersion: (v) => set({ currentVersion: v }),

  setTasks: (v) => set((s) => ({ tasks: typeof v === 'function' ? v(s.tasks) : v })),
  setSearchText: (v) => set({ searchText: v }),

  setLevel2PlanTasks: (v) => set((s) => ({ level2PlanTasks: typeof v === 'function' ? v(s.level2PlanTasks) : v })),
  setLevel2PlanMilestones: (v) => set((s) => ({ level2PlanMilestones: typeof v === 'function' ? v(s.level2PlanMilestones) : v })),
  setCreatedLevel2Plans: (v) => set((s) => ({ createdLevel2Plans: typeof v === 'function' ? v(s.createdLevel2Plans) : v })),
  setActiveLevel2Plan: (v) => set({ activeLevel2Plan: v }),
  setLevel2PlanMeta: (v) => set((s) => ({ level2PlanMeta: typeof v === 'function' ? v(s.level2PlanMeta) : v })),
  setCreateFormValues: (v) => set((s) => ({ createFormValues: typeof v === 'function' ? v(s.createFormValues) : v })),
  setSelectedLevel2PlanType: (v) => set({ selectedLevel2PlanType: v }),
  setSelectedMilestones: (v) => set((s) => ({ selectedMilestones: typeof v === 'function' ? v(s.selectedMilestones) : v })),
  setSelectedMRVersion: (v) => set({ selectedMRVersion: v }),

  setColumnsByView: (v) => set((s) => ({ columnsByView: typeof v === 'function' ? v(s.columnsByView) : v })),
  setCollapsedNodes: (v) => set((s) => ({ collapsedNodes: typeof v === 'function' ? v(s.collapsedNodes) : v })),

  setPublishedSnapshots: (v) => set((s) => ({ publishedSnapshots: typeof v === 'function' ? v(s.publishedSnapshots) : v })),

  setCompareVersionA: (v) => set({ compareVersionA: v }),
  setCompareVersionB: (v) => set({ compareVersionB: v }),
  setCompareResult: (v) => set({ compareResult: v }),
  setCompareShowUnchanged: (v) => set({ compareShowUnchanged: v }),
  setCompareFilterType: (v) => set({ compareFilterType: v }),

  setMarketPlanData: (v) => set((s) => ({ marketPlanData: typeof v === 'function' ? v(s.marketPlanData) : v })),

  setGanttEditingTask: (v) => set({ ganttEditingTask: v }),
  setProgressEditingTask: (v) => set({ progressEditingTask: v }),

  setParentTimeWarning: (v) => set({ parentTimeWarning: v }),
  setMilestoneTimeWarning: (v) => set({ milestoneTimeWarning: v }),
  setPredecessorWarning: (v) => set({ predecessorWarning: v }),
}))
