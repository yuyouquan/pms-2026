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
} from '@/types/hrMachine'
import {
  DEFAULT_PROJECT_FILTERS,
  IPM_PROJECTS,
} from '@/constants/hrMachine'
import { calcEstimatedInvestment, calcDepartmentMonthlySplit, type DepartmentMonthlySplit } from '@/constants/hrConfig'
import { useHrConfigStore } from '@/stores/hrConfig'

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
  versionMeta: { projectLevel: string; levelCoefficient: number; hrModelVersion: string },
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
      projectLevel: versionMeta.projectLevel,
      levelCoefficient: versionMeta.levelCoefficient,
      hrModelVersion: versionMeta.hrModelVersion,
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
      projectLevel: versionMeta.projectLevel,
      levelCoefficient: versionMeta.levelCoefficient,
      hrModelVersion: versionMeta.hrModelVersion,
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
      projectLevel: versionMeta.projectLevel,
      levelCoefficient: versionMeta.levelCoefficient,
      hrModelVersion: versionMeta.hrModelVersion,
      milestones: { ...milestones },
      estimatedInvestment: investments.projectBudget,
      createdAt: baseDate,
      lockedAt: isLocked ? '2026-01-15' : null,
    })
  }

  return versions
}

/**
 * 使用配置中心数据，按部门拆分版本月度预估投入。
 * 每个匹配的部门生成一条独立的月度记录。
 */
function generateDepartmentMonthlyRecords(
  projectId: string,
  version: HrMachineVersion,
): MonthlyInvestment[] {
  const configRecords = useHrConfigStore.getState().data.hrModel ?? []
  const splits = calcDepartmentMonthlySplit(
    configRecords,
    version.projectLevel,
    version.hrModelVersion,
    version.levelCoefficient,
    version.milestones,
  )

  return splits.map((split: DepartmentMonthlySplit, idx: number) => ({
    id: `mi-${projectId}-${version.id}-dept${idx}`,
    projectId,
    versionId: version.id,
    primaryDepartment: split.primaryDepartment,
    secondaryDepartment: split.secondaryDepartment,
    budgetType: version.budgetType,
    versionNumber: version.versionNumber,
    versionLockState: version.lockState,
    estimatedTotal: split.estimatedTotal,
    monthlyData: split.monthlyData,
    isEdited: false,
  }))
}

const MOCK_PROJECTS: HrMachineProject[] = [
  {
    id: 'mp-kp5',
    name: 'KP5',
    brand: 'TECNO',
    productLine: 'SPARK',
    projectLevel: 'S',
    levelCoefficient: 1,
    hrModelVersion: 'V2026.1',
    projectYear: '26年立项26年结项',
    ipmProjectCode: 'IPM-2026-KP5',
    ipmProjectName: 'KP5 整机项目',
    status: 'active',
    annualBudget: 100,
    projectEstimate: 100,
    projectBudget: 100,
    projectAccounting: 0,
    versions: createMockVersions(
      'mp-kp5',
      { annual: 100, projectEstimate: 100, projectBudget: 100 },
      { projectLevel: 'S', levelCoefficient: 1, hrModelVersion: 'V2026.1' },
      { conceptStart: '2026-01-15', productLaunch: '2026-11-30' },
      { annual: false, projectEstimate: false, projectBudget: false },
    ),
    createdAt: '2026-01-15',
  },
]

/**
 * 为所有项目生成月度预估投入数据。
 * 规则：每个预算类型下取最新版本，按配置中心部门拆分。
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
      // 按部门拆分，生成多条记录
      const deptRecords = generateDepartmentMonthlyRecords(project.id, version)
      investments.push(...deptRecords)
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
 * 按配置中心部门拆分，每个部门一条记录。
 * 保留用户已编辑的月度数据（通过 versionId + 部门匹配）。
 */
function syncMonthlyInvestments(
  projects: HrMachineProject[],
  existingMonthly: MonthlyInvestment[],
): MonthlyInvestment[] {
  const result: MonthlyInvestment[] = []

  // 构建已有数据的查找表：key = versionId + primaryDept + secondaryDept
  const existingMap = new Map<string, MonthlyInvestment>()
  for (const m of existingMonthly) {
    const key = `${m.versionId}|${m.primaryDepartment}|${m.secondaryDepartment}`
    existingMap.set(key, m)
  }

  for (const project of projects) {
    const latestVersions = getLatestVersions(project)
    for (const version of latestVersions) {
      // 生成该版本的部门拆分记录
      const deptRecords = generateDepartmentMonthlyRecords(project.id, version)
      for (const record of deptRecords) {
        const key = `${record.versionId}|${record.primaryDepartment}|${record.secondaryDepartment}`
        const existing = existingMap.get(key)
        if (existing && existing.isEdited) {
          // 保留用户已编辑的月度数据，但更新锁定状态和版本号
          result.push({
            ...existing,
            versionLockState: version.lockState,
            versionNumber: version.versionNumber,
          })
        } else {
          result.push(record)
        }
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

  addVersion: (projectId: string, budgetType: BudgetType, versionMeta: { projectLevel: string; levelCoefficient: number; hrModelVersion: string }) => void
  deleteVersion: (projectId: string, versionId: string) => void
  lockVersion: (projectId: string, versionId: string) => void

  /** 行内编辑版本数据（预估投入、里程碑、项目等级、等级系数、人力模型版本号） */
  updateVersion: (
    projectId: string,
    versionId: string,
    updates: {
      estimatedInvestment?: number
      milestones?: Partial<MilestoneNodes>
      projectLevel?: string
      levelCoefficient?: number
      hrModelVersion?: string
    },
  ) => void

  updateMonthlyInvestment: (monthlyId: string, monthlyData: Record<string, number>) => void
  setEditingMonthlyId: (id: string | null) => void

  /** 获取指定项目所有预算类型的最新版本 */
  getLatestVersions: (projectId: string) => HrMachineVersion[]

  /** 计算指定版本的部门拆分月度数据 */
  calculateMonthlySplit: (version: HrMachineVersion) => DepartmentMonthlySplit[]
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
          projectLevel: '',
          levelCoefficient: 0,
          hrModelVersion: '',
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

      addVersion: (projectId, budgetType, versionMeta) => set((s) => {
        const project = s.projects.find(p => p.id === projectId)
        if (!project) return s

        // IPM 校验：项目概算和项目预算需要绑定 IPM 编码
        if (
          (budgetType === 'projectEstimate' || budgetType === 'projectBudget') &&
          !project.ipmProjectCode
        ) {
          return s
        }

        // 从配置中心获取人力模型数据，计算预估投入
        const configRecords = useHrConfigStore.getState().data.hrModel ?? []
        const estimatedInvestment = calcEstimatedInvestment(
          configRecords,
          versionMeta.projectLevel,
          versionMeta.hrModelVersion,
          versionMeta.levelCoefficient,
        )

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
            projectLevel: versionMeta.projectLevel,
            levelCoefficient: versionMeta.levelCoefficient,
            hrModelVersion: versionMeta.hrModelVersion,
            milestones,
            estimatedInvestment,
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
        const configRecords = useHrConfigStore.getState().data.hrModel ?? []

        const newProjects = s.projects.map(p => {
          if (p.id !== projectId) return p
          const newVersions = p.versions.map(v => {
            if (v.id !== versionId) return v

            const updated: HrMachineVersion = {
              ...v,
              estimatedInvestment: updates.estimatedInvestment ?? v.estimatedInvestment,
              milestones: updates.milestones ? { ...v.milestones, ...updates.milestones } : v.milestones,
              projectLevel: updates.projectLevel ?? v.projectLevel,
              levelCoefficient: updates.levelCoefficient ?? v.levelCoefficient,
              hrModelVersion: updates.hrModelVersion ?? v.hrModelVersion,
            }

            // 如果项目等级/等级系数/人力模型版本号发生变化，自动重算预估投入
            if (
              updates.projectLevel !== undefined ||
              updates.levelCoefficient !== undefined ||
              updates.hrModelVersion !== undefined
            ) {
              updated.estimatedInvestment = calcEstimatedInvestment(
                configRecords,
                updated.projectLevel,
                updated.hrModelVersion,
                updated.levelCoefficient,
              )
            }

            return updated
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
        const configRecords = useHrConfigStore.getState().data.hrModel ?? []
        return calcDepartmentMonthlySplit(
          configRecords,
          version.projectLevel,
          version.hrModelVersion,
          version.levelCoefficient,
          version.milestones,
        )
      },
    }),
    { name: 'pms-hr-machine', version: 8 },
  ),
)
