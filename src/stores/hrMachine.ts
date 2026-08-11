import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  HrMachineProject,
  HrMachineVersion,
  MonthlyInvestment,
  ProjectListFilters,
  BudgetType,
  NewProjectForm,
  MilestoneNodes,
  VersionLockState,
} from '@/types/hrMachine'
import {
  DEFAULT_PROJECT_FILTERS,
  BUDGET_TYPE_LABELS,
  PHASE_SPLIT_RULES,
  calcPhaseDuration,
  IPM_PROJECTS,
} from '@/constants/hrMachine'

/* ── Mock Data ──────────────────────────────────────────────────────── */

/** 空里程碑模板 */
function emptyMilestones(): MilestoneNodes {
  return {
    conceptStart: null,
    str1: null,
    str3: null,
    str4: null,
    str5: null,
    productLaunch: null,
  }
}

/**
 * 为指定项目创建 mock 版本数据。
 * 版本号统一 V0.X，锁定不改版本号。
 */
function createMockVersions(
  projectId: string,
  investments: { annual: number; projectEstimate: number; projectBudget: number },
  dateOffsets?: { conceptStart: string; productLaunch: string },
  lockConfig?: { annual?: boolean; projectEstimate?: boolean; projectBudget?: boolean },
  extraVersions?: { budgetType: BudgetType; count: number }[],
): HrMachineVersion[] {
  const milestones: MilestoneNodes = {
    conceptStart: dateOffsets?.conceptStart ?? '2026-01-02',
    str1: '2026-03-15',
    str3: '2026-05-20',
    str4: '2026-07-10',
    str5: '2026-09-15',
    productLaunch: dateOffsets?.productLaunch ?? '2026-11-09',
  }
  const baseDate = milestones.conceptStart!
  const versions: HrMachineVersion[] = []

  // 年度预算
  const annualExtra = extraVersions?.find(v => v.budgetType === 'annual')?.count ?? 0
  for (let i = 1; i <= 1 + annualExtra; i++) {
    const isLocked = i === 1 + annualExtra ? (lockConfig?.annual ?? false) : true
    versions.push({
      id: `${projectId}-annual-v0${i}`,
      projectId,
      budgetType: 'annual',
      versionNumber: `V0.${i}`,
      lockState: isLocked ? 'locked' : 'unlocked',
      majorVersion: 0,
      minorVersion: i,
      milestones: { ...milestones },
      estimatedInvestment: investments.annual,
      createdAt: baseDate,
      lockedAt: isLocked ? '2026-01-10' : null,
    })
  }

  // 项目概算
  const estimateExtra = extraVersions?.find(v => v.budgetType === 'projectEstimate')?.count ?? 0
  for (let i = 1; i <= 1 + estimateExtra; i++) {
    const isLocked = i === 1 + estimateExtra ? (lockConfig?.projectEstimate ?? false) : true
    versions.push({
      id: `${projectId}-estimate-v0${i}`,
      projectId,
      budgetType: 'projectEstimate',
      versionNumber: `V0.${i}`,
      lockState: isLocked ? 'locked' : 'unlocked',
      majorVersion: 0,
      minorVersion: i,
      milestones: { ...milestones },
      estimatedInvestment: investments.projectEstimate,
      createdAt: baseDate,
      lockedAt: isLocked ? '2026-01-12' : null,
    })
  }

  // 项目预算
  const budgetExtra = extraVersions?.find(v => v.budgetType === 'projectBudget')?.count ?? 0
  for (let i = 1; i <= 1 + budgetExtra; i++) {
    const isLocked = i === 1 + budgetExtra ? (lockConfig?.projectBudget ?? false) : true
    versions.push({
      id: `${projectId}-budget-v0${i}`,
      projectId,
      budgetType: 'projectBudget',
      versionNumber: `V0.${i}`,
      lockState: isLocked ? 'locked' : 'unlocked',
      majorVersion: 0,
      minorVersion: i,
      milestones: { ...milestones },
      estimatedInvestment: investments.projectBudget,
      createdAt: baseDate,
      lockedAt: isLocked ? '2026-01-15' : null,
    })
  }

  return versions
}

function createMockMonthlyData(
  startDate: string,
  endDate: string,
  totalInvestment: number,
): Record<string, number> {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
  const dailyRate = totalInvestment / totalDays

  const result: Record<string, number> = {}
  const current = new Date(start)
  while (current <= end) {
    const monthStart = new Date(current.getFullYear(), current.getMonth(), 1)
    const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0)
    const periodStart = current < monthStart ? monthStart : current
    const periodEnd = end < monthEnd ? end : monthEnd
    const daysInPeriod = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`
    result[key] = Math.round(dailyRate * daysInPeriod * 10) / 10

    current.setMonth(current.getMonth() + 1)
    current.setDate(1)
  }
  return result
}

const MOCK_PROJECTS: HrMachineProject[] = [
  {
    id: 'mp-001',
    name: 'CO9m-X6895',
    brand: 'TECNO',
    productLine: 'CAMON',
    projectLevel: 'S',
    levelCoefficient: 1,
    hrModelVersion: 'V2026.1',
    projectYear: '25年立项26年结项',
    ipmProjectCode: 'IPM-2025-001',
    ipmProjectName: 'CO9m-X6895 整机项目',
    status: 'active',
    annualBudget: 120,
    projectEstimate: 115,
    projectBudget: 110,
    projectAccounting: 80,
    versions: createMockVersions('mp-001', { annual: 120, projectEstimate: 115, projectBudget: 110 }),
    createdAt: '2026-01-02',
  },
  {
    id: 'mp-002',
    name: 'NOTE40-Pro',
    brand: 'Infinix',
    productLine: 'NOTE',
    projectLevel: 'A',
    levelCoefficient: 0.8,
    hrModelVersion: 'V2026.1',
    projectYear: '26年立项26年结项',
    ipmProjectCode: 'IPM-2025-002',
    ipmProjectName: 'NOTE40-Pro 整机项目',
    status: 'active',
    annualBudget: 96,
    projectEstimate: 92,
    projectBudget: 88,
    projectAccounting: 45,
    versions: createMockVersions('mp-002', { annual: 96, projectEstimate: 92, projectBudget: 88 }, { conceptStart: '2026-02-01', productLaunch: '2026-12-15' }, { annual: false, projectEstimate: true, projectBudget: true }),
    createdAt: '2026-02-01',
  },
  {
    id: 'mp-003',
    name: 'SPARK30-Lite',
    brand: 'TECNO',
    productLine: 'SPARK',
    projectLevel: 'B',
    levelCoefficient: 0.6,
    hrModelVersion: 'V2025.4',
    projectYear: '25年立项26年结项',
    ipmProjectCode: null,
    ipmProjectName: null,
    status: 'cancelled',
    annualBudget: 72,
    projectEstimate: 69,
    projectBudget: 66,
    projectAccounting: 30,
    versions: createMockVersions('mp-003', { annual: 72, projectEstimate: 69, projectBudget: 66 }, { conceptStart: '2026-01-15', productLaunch: '2026-10-30' }, { annual: true, projectEstimate: false, projectBudget: false }),
    createdAt: '2026-01-15',
  },
  {
    id: 'mp-004',
    name: 'GT30-Ultra',
    brand: 'Infinix',
    productLine: 'GT',
    projectLevel: 'S',
    levelCoefficient: 1.2,
    hrModelVersion: 'V2026.2',
    projectYear: '26年立项27年结项',
    ipmProjectCode: 'IPM-2026-001',
    ipmProjectName: 'GT30-Ultra 整机项目',
    status: 'active',
    annualBudget: 144,
    projectEstimate: 138,
    projectBudget: 132,
    projectAccounting: 95,
    versions: createMockVersions('mp-004', { annual: 144, projectEstimate: 138, projectBudget: 132 }, { conceptStart: '2026-01-10', productLaunch: '2026-11-20' }, { annual: true, projectEstimate: true, projectBudget: true }, [{ budgetType: 'annual', count: 2 }]),
    createdAt: '2026-01-10',
  },
  {
    id: 'mp-005',
    name: 'HOT50-Play',
    brand: 'itel',
    productLine: 'HOT',
    projectLevel: 'C',
    levelCoefficient: 0.4,
    hrModelVersion: 'V2025.4',
    projectYear: '26年立项26年结项',
    ipmProjectCode: null,
    ipmProjectName: null,
    status: 'active',
    annualBudget: 48,
    projectEstimate: 46,
    projectBudget: 44,
    projectAccounting: 20,
    versions: createMockVersions('mp-005', { annual: 48, projectEstimate: 46, projectBudget: 44 }, { conceptStart: '2026-03-01', productLaunch: '2026-12-20' }, { annual: false, projectEstimate: false, projectBudget: false }),
    createdAt: '2026-03-01',
  },
]

/**
 * 为所有项目生成月度预估投入数据。
 * 规则：每个预算类型下取最新版本（无论是否锁定），做数据拆分。
 */
function createMockMonthlyInvestments(projects: HrMachineProject[]): MonthlyInvestment[] {
  const investments: MonthlyInvestment[] = []
  for (const project of projects) {
    // 按预算类型分组，取最新版本
    const typeMap = new Map<BudgetType, HrMachineVersion>()
    for (const v of project.versions) {
      const existing = typeMap.get(v.budgetType)
      if (!existing || v.minorVersion > existing.minorVersion) {
        typeMap.set(v.budgetType, v)
      }
    }
    for (const [, version] of typeMap) {
      const monthlyData = createMockMonthlyData(
        version.milestones.conceptStart || '2026-01-01',
        version.milestones.productLaunch || '2026-11-30',
        version.estimatedInvestment,
      )
      investments.push({
        id: `mi-${project.id}-${version.id}`,
        projectId: project.id,
        versionId: version.id,
        primaryDepartment: '研发中心',
        secondaryDepartment: '产品部',
        budgetType: version.budgetType,
        versionNumber: version.versionNumber,
        versionLockState: version.lockState,
        estimatedTotal: version.estimatedInvestment,
        monthlyData,
        isEdited: false,
      })
    }
  }
  return investments
}

/* ── Helpers ────────────────────────────────────────────────────────── */

/** 获取指定项目+预算类型下的最新版本 */
function getLatestVersion(project: HrMachineProject, budgetType: BudgetType): HrMachineVersion | null {
  const versions = project.versions
    .filter(v => v.budgetType === budgetType)
    .sort((a, b) => b.minorVersion - a.minorVersion)
  return versions[0] ?? null
}

/** 获取指定项目所有预算类型的最新版本 */
function getLatestVersions(project: HrMachineProject): HrMachineVersion[] {
  const result: HrMachineVersion[] = []
  for (const bt of ['annual', 'projectEstimate', 'projectBudget'] as BudgetType[]) {
    const latest = getLatestVersion(project, bt)
    if (latest) result.push(latest)
  }
  return result
}

/**
 * 同步月度预估投入：每个预算类型只保留最新版本的数据。
 * 保留用户已编辑的月度数据（通过 versionId 匹配）。
 */
function syncMonthlyInvestments(
  projects: HrMachineProject[],
  existingMonthly: MonthlyInvestment[],
): MonthlyInvestment[] {
  const result: MonthlyInvestment[] = []
  const existingMap = new Map(existingMonthly.map(m => [m.versionId, m]))

  for (const project of projects) {
    const latestVersions = getLatestVersions(project)
    for (const version of latestVersions) {
      const existing = existingMap.get(version.id)
      if (existing) {
        // 保留已有数据，但更新锁定状态和版本号
        result.push({
          ...existing,
          versionLockState: version.lockState,
          versionNumber: version.versionNumber,
        })
      } else {
        // 新建月度数据
        const monthlyData = createMockMonthlyData(
          version.milestones.conceptStart || '2026-01-01',
          version.milestones.productLaunch || '2026-11-30',
          version.estimatedInvestment,
        )
        result.push({
          id: `mi-${project.id}-${version.id}`,
          projectId: project.id,
          versionId: version.id,
          primaryDepartment: '研发中心',
          secondaryDepartment: '产品部',
          budgetType: version.budgetType,
          versionNumber: version.versionNumber,
          versionLockState: version.lockState,
          estimatedTotal: version.estimatedInvestment,
          monthlyData,
          isEdited: false,
        })
      }
    }
  }
  return result
}

/* ── State / Actions interfaces ────────────────────────────────────── */

export type MachineTab = 'projectList' | 'monthlyInvestment'

export interface HrMachineState {
  projects: HrMachineProject[]
  monthlyInvestments: MonthlyInvestment[]
  selectedProjectId: string | null
  activeTab: MachineTab
  filters: ProjectListFilters
  selectedBudgetTypes: BudgetType[]
  showNewProjectModal: boolean
  showNewVersionModal: boolean
  showMonthlyEditModal: boolean
  editingMonthlyId: string | null
}

export interface HrMachineActions {
  setActiveTab: (tab: MachineTab) => void
  setSelectedProjectId: (id: string | null) => void
  setFilters: (partial: Partial<ProjectListFilters>) => void
  resetFilters: () => void
  setSelectedBudgetTypes: (types: BudgetType[]) => void
  setShowNewProjectModal: (show: boolean) => void
  setShowNewVersionModal: (show: boolean) => void
  setShowMonthlyEditModal: (show: boolean) => void

  addProject: (form: NewProjectForm) => void
  deleteProject: (projectId: string) => void
  cancelProject: (projectId: string) => void
  restoreProject: (projectId: string) => void

  /** 绑定IPM正式项目编码 */
  bindIpmProject: (projectId: string, ipmCode: string) => void

  addVersion: (projectId: string, budgetType: BudgetType) => void
  deleteVersion: (projectId: string, versionId: string) => void
  lockVersion: (projectId: string, versionId: string) => void

  /** 行内编辑版本数据（预估投入、里程碑） */
  updateVersion: (
    projectId: string,
    versionId: string,
    updates: { estimatedInvestment?: number; milestones?: Partial<MilestoneNodes> },
  ) => void

  updateMonthlyInvestment: (monthlyId: string, monthlyData: Record<string, number>) => void
  setEditingMonthlyId: (id: string | null) => void

  /** 获取指定项目所有预算类型的最新版本 */
  getLatestVersions: (projectId: string) => HrMachineVersion[]

  /** 计算月度拆分 */
  calculateMonthlySplit: (version: HrMachineVersion) => Record<string, number>
}

/* ── Store ─────────────────────────────────────────────────────────── */

const ALL_BUDGET_TYPES: BudgetType[] = ['annual', 'projectEstimate', 'projectBudget']

export const useHrMachineStore = create<HrMachineState & HrMachineActions>()(
  persist(
    (set, get) => ({
      projects: MOCK_PROJECTS,
      monthlyInvestments: createMockMonthlyInvestments(MOCK_PROJECTS),
      selectedProjectId: null,
      activeTab: 'projectList',
      filters: { ...DEFAULT_PROJECT_FILTERS },
      selectedBudgetTypes: [...ALL_BUDGET_TYPES],
      showNewProjectModal: false,
      showNewVersionModal: false,
      showMonthlyEditModal: false,
      editingMonthlyId: null,

      setActiveTab: (tab) => set({ activeTab: tab }),

      setSelectedProjectId: (id) => set({ selectedProjectId: id }),
      setFilters: (partial) => set((s) => ({ filters: { ...s.filters, ...partial } })),
      resetFilters: () => set({ filters: { ...DEFAULT_PROJECT_FILTERS } }),

      setSelectedBudgetTypes: (types) => set({ selectedBudgetTypes: types }),

      setShowNewProjectModal: (show) => set({ showNewProjectModal: show }),
      setShowNewVersionModal: (show) => set({ showNewVersionModal: show }),
      setShowMonthlyEditModal: (show) => set({ showMonthlyEditModal: show }),

      addProject: (form) => set((s) => {
        const newProject: HrMachineProject = {
          id: `mp-${Date.now()}`,
          name: form.name,
          brand: form.brand,
          productLine: form.productLine,
          projectLevel: form.projectLevel,
          levelCoefficient: form.levelCoefficient,
          hrModelVersion: form.hrModelVersion,
          projectYear: form.projectYear,
          ipmProjectCode: null,
          ipmProjectName: null,
          status: 'active',
          annualBudget: 0,
          projectEstimate: 0,
          projectBudget: 0,
          projectAccounting: 0,
          versions: [],
          createdAt: new Date().toISOString().split('T')[0],
        }
        const newProjects = [...s.projects, newProject]
        return {
          projects: newProjects,
          showNewProjectModal: false,
          monthlyInvestments: syncMonthlyInvestments(newProjects, s.monthlyInvestments),
        }
      }),

      deleteProject: (projectId) => set((s) => {
        const newProjects = s.projects.filter(p => p.id !== projectId)
        return {
          projects: newProjects,
          selectedProjectId: null,
          monthlyInvestments: syncMonthlyInvestments(newProjects, s.monthlyInvestments),
        }
      }),

      cancelProject: (projectId) => set((s) => ({
        projects: s.projects.map(p =>
          p.id === projectId ? { ...p, status: 'cancelled' as const } : p,
        ),
      })),

      restoreProject: (projectId) => set((s) => ({
        projects: s.projects.map(p =>
          p.id === projectId ? { ...p, status: 'active' as const } : p,
        ),
      })),

      bindIpmProject: (projectId, ipmCode) => set((s) => {
        const ipmProject = IPM_PROJECTS.find(p => p.code === ipmCode)
        if (!ipmProject) return s
        return {
          projects: s.projects.map(p =>
            p.id === projectId
              ? { ...p, ipmProjectCode: ipmProject.code, ipmProjectName: ipmProject.name }
              : p,
          ),
        }
      }),

      addVersion: (projectId, budgetType) => set((s) => {
        const project = s.projects.find(p => p.id === projectId)
        if (!project) return s

        // IPM 校验：项目概算和项目预算需要绑定 IPM 编码
        if (
          (budgetType === 'projectEstimate' || budgetType === 'projectBudget') &&
          !project.ipmProjectCode
        ) {
          return s
        }

        const newProjects = s.projects.map(p => {
          if (p.id !== projectId) return p

          // 找到同预算类型下的最新版本
          const latest = getLatestVersion(p, budgetType)
          const minorVersion = latest ? latest.minorVersion + 1 : 1

          // 里程碑：从最新版本复制，若无则空
          const milestones: MilestoneNodes = latest
            ? { ...latest.milestones }
            : emptyMilestones()

          const newVersion: HrMachineVersion = {
            id: `${projectId}-${budgetType}-v${Date.now()}`,
            projectId,
            budgetType,
            versionNumber: `V0.${minorVersion}`,
            lockState: 'unlocked',
            majorVersion: 0,
            minorVersion,
            milestones,
            estimatedInvestment: latest?.estimatedInvestment ?? 0,
            createdAt: new Date().toISOString().split('T')[0],
            lockedAt: null,
          }
          return { ...p, versions: [...p.versions, newVersion] }
        })

        return {
          projects: newProjects,
          showNewVersionModal: false,
          monthlyInvestments: syncMonthlyInvestments(newProjects, s.monthlyInvestments),
        }
      }),

      deleteVersion: (projectId, versionId) => set((s) => {
        const newProjects = s.projects.map(p => {
          if (p.id !== projectId) return p
          const newVersions = p.versions.filter(v => v.id !== versionId)
          return { ...p, versions: newVersions }
        })
        return {
          projects: newProjects,
          monthlyInvestments: syncMonthlyInvestments(newProjects, s.monthlyInvestments),
        }
      }),

      lockVersion: (projectId, versionId) => set((s) => {
        const newProjects = s.projects.map(p => {
          if (p.id !== projectId) return p
          const newVersions = p.versions.map(v => {
            if (v.id === versionId) {
              return {
                ...v,
                lockState: 'locked' as const,
                lockedAt: new Date().toISOString().split('T')[0],
              }
            }
            return v
          })
          return { ...p, versions: newVersions }
        })
        return {
          projects: newProjects,
          monthlyInvestments: syncMonthlyInvestments(newProjects, s.monthlyInvestments),
        }
      }),

      updateVersion: (projectId, versionId, updates) => set((s) => {
        const newProjects = s.projects.map(p => {
          if (p.id !== projectId) return p
          const newVersions = p.versions.map(v => {
            if (v.id !== versionId) return v
            return {
              ...v,
              estimatedInvestment: updates.estimatedInvestment ?? v.estimatedInvestment,
              milestones: updates.milestones ? { ...v.milestones, ...updates.milestones } : v.milestones,
            }
          })
          return { ...p, versions: newVersions }
        })
        return {
          projects: newProjects,
          monthlyInvestments: syncMonthlyInvestments(newProjects, s.monthlyInvestments),
        }
      }),

      updateMonthlyInvestment: (monthlyId, monthlyData) => set((s) => ({
        monthlyInvestments: s.monthlyInvestments.map(mi =>
          mi.id === monthlyId
            ? { ...mi, monthlyData, isEdited: true }
            : mi,
        ),
        showMonthlyEditModal: false,
        editingMonthlyId: null,
      })),

      setEditingMonthlyId: (id) => set({ editingMonthlyId: id }),

      getLatestVersions: (projectId) => {
        const project = get().projects.find(p => p.id === projectId)
        if (!project) return []
        return getLatestVersions(project)
      },

      calculateMonthlySplit: (version) => {
        const result: Record<string, number> = {}
        for (const rule of PHASE_SPLIT_RULES) {
          const startVal = version.milestones[rule.startField as keyof MilestoneNodes]
          const endVal = version.milestones[rule.endField as keyof MilestoneNodes]
          if (!startVal || !endVal) continue
          const duration = calcPhaseDuration(startVal, endVal)
          if (duration <= 0) continue
          const phaseInvestment = version.estimatedInvestment / PHASE_SPLIT_RULES.length
          const dailyRate = phaseInvestment / duration
          const start = new Date(startVal)
          const end = new Date(endVal)
          const current = new Date(start)
          while (current <= end) {
            const monthStart = new Date(current.getFullYear(), current.getMonth(), 1)
            const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0)
            const periodStart = current < monthStart ? monthStart : current
            const periodEnd = end < monthEnd ? end : monthEnd
            const daysInPeriod = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
            const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`
            result[key] = (result[key] || 0) + Math.round(dailyRate * daysInPeriod * 10) / 10
            current.setMonth(current.getMonth() + 1)
            current.setDate(1)
          }
        }
        return result
      },
    }),
    { name: 'pms-hr-machine', version: 4 },
  ),
)
