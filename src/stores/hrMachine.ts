import { canAccessHrProject, reconcileHrRegistry } from '@/lib/hrProjectRegistry'
import { preserveHrMonthlyEdits } from '@/lib/hrMonthlySync'
import { appendHrMockProjects, createAdditionalMachineProjects } from '@/mock/hrInvestment'
import { canCreateHrVersion, allowedHrVersionUpdates, getHrVersionSeed, getLatestHrVersion, nextHrMinorVersion } from '@/lib/hrVersionRules'
import { synchronizeHrProjects } from '@/lib/hrProjectSync'
import { getHrFormalProjectOptions } from '@/lib/hrFormalProjectSource'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  HrMachineProject,
  HrMachineVersion,
  MonthlyInvestment,
  ProjectListFilters,
  HistoryVersionFilters,
  BudgetType,
  NewProjectForm,
  MilestoneNodes,
} from '@/types/hrMachine'
import {
  DEFAULT_PROJECT_FILTERS,
  DEFAULT_HISTORY_VERSION_FILTERS,
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
      createdBy: '当前用户',
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
      createdBy: '当前用户',
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
      createdBy: '当前用户',
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
    id: `mi-${projectId}-${version.id}-source-${split.departmentId ?? idx}`,
    projectId,
    versionId: version.id,
    primaryDepartment: split.primaryDepartment,
    secondaryDepartment: split.secondaryDepartment,
    budgetType: version.budgetType,
    versionNumber: version.versionNumber,
            batch: version.batch ?? null,
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


const ADDITIONAL_PROJECTS = createAdditionalMachineProjects(getHrFormalProjectOptions('machine'))
const INITIAL_PROJECTS = [...MOCK_PROJECTS, ...ADDITIONAL_PROJECTS]

/* ── Helpers ────────────────────────────────────────────────────────── */

/** 获取指定项目+预算类型下的最新版本 */
function getLatestVersion(project: HrMachineProject, budgetType: BudgetType): HrMachineVersion | null {
  return getLatestHrVersion(project.versions, budgetType) ?? null
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

function synchronizeProjects(projects: HrMachineProject[]): HrMachineProject[] {
  return synchronizeHrProjects(projects, 'machine', (level, model, coefficient) => calcEstimatedInvestment(useHrConfigStore.getState().data.hrModel ?? [], level, model, coefficient))
}

function syncMonthlyInvestments(projects: HrMachineProject[], existingMonthly: MonthlyInvestment[]): MonthlyInvestment[] {
  const generated = synchronizeProjects(projects).flatMap(project =>
    getLatestVersions(project).flatMap(version => generateDepartmentMonthlyRecords(project.id, version)),
  )
  return preserveHrMonthlyEdits(generated, existingMonthly)
}


/* ── State / Actions interfaces ────────────────────────────────────── */

export type MachineTab = 'projectList' | 'monthlyInvestment' | 'historyVersion'

export interface HrMachineState {
  registryMigrationComplete: boolean
  projects: HrMachineProject[]
  monthlyInvestments: MonthlyInvestment[]
  selectedProjectId: string | null
  activeTab: MachineTab
  filters: ProjectListFilters
  historyVersionFilters: HistoryVersionFilters
  selectedBudgetTypes: BudgetType[]
  showNewProjectModal: boolean
  showNewVersionModal: boolean
  showMonthlyEditModal: boolean
  editingMonthlyId: string | null
  showVersionDetailModal: boolean
  editingVersionId: string | null
}

export interface HrMachineActions {
  setActiveTab: (tab: MachineTab) => void
  setSelectedProjectId: (id: string | null) => void
  setFilters: (partial: Partial<ProjectListFilters>) => void
  resetFilters: () => void
  setHistoryVersionFilters: (partial: Partial<HistoryVersionFilters>) => void
  resetHistoryVersionFilters: () => void
  setSelectedBudgetTypes: (types: BudgetType[]) => void
  setShowNewProjectModal: (show: boolean) => void
  setShowNewVersionModal: (show: boolean) => void
  setShowMonthlyEditModal: (show: boolean) => void
  setShowVersionDetailModal: (show: boolean) => void
  setEditingVersionId: (id: string | null) => void

  addProject: (form: NewProjectForm) => void
  deleteProject: (projectId: string) => void
  cancelProject: (projectId: string) => void
  restoreProject: (projectId: string) => void

  /** 绑定IPM正式项目编码 */
  bindIpmProject: (projectId: string, ipmCode: string) => void

  addVersion: (projectId: string, budgetType: BudgetType, versionMeta: { projectLevel: string; levelCoefficient: number; hrModelVersion: string }) => void
  deleteVersion: (projectId: string, versionId: string) => void

  /** 行内编辑版本数据（预估投入、里程碑、项目等级、等级系数、人力模型版本号） */
  updateVersion: (
    projectId: string,
    versionId: string,
    updates: {
      batch?: number | null
      estimatedInvestment?: number
      milestones?: Partial<MilestoneNodes>
      projectLevel?: string
      levelCoefficient?: number
      hrModelVersion?: string
    },
  ) => void

  refreshFormalProjects: () => void

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
      registryMigrationComplete: false,
      projects: synchronizeProjects(INITIAL_PROJECTS),
      monthlyInvestments: syncMonthlyInvestments(INITIAL_PROJECTS, []),
      selectedProjectId: null,
      activeTab: 'projectList',
      filters: { ...DEFAULT_PROJECT_FILTERS },
      historyVersionFilters: { ...DEFAULT_HISTORY_VERSION_FILTERS },
      selectedBudgetTypes: [...ALL_BUDGET_TYPES],
      showNewProjectModal: false,
      showNewVersionModal: false,
      showMonthlyEditModal: false,
      editingMonthlyId: null,
      showVersionDetailModal: false,
      editingVersionId: null,

      setActiveTab: (tab) => set({ activeTab: tab }),

      setSelectedProjectId: (id) => set({ selectedProjectId: id }),
      setFilters: (partial) => set((s) => ({ filters: { ...s.filters, ...partial } })),
      resetFilters: () => set({ filters: { ...DEFAULT_PROJECT_FILTERS } }),

      setHistoryVersionFilters: (partial) => set((s) => ({ historyVersionFilters: { ...s.historyVersionFilters, ...partial } })),
      resetHistoryVersionFilters: () => set({ historyVersionFilters: { ...DEFAULT_HISTORY_VERSION_FILTERS } }),

      setSelectedBudgetTypes: (types) => set({ selectedBudgetTypes: types }),

      setShowNewProjectModal: (show) => set({ showNewProjectModal: show }),
      setShowNewVersionModal: (show) => set({ showNewVersionModal: show }),
      setShowMonthlyEditModal: (show) => set({ showMonthlyEditModal: show }),
      setShowVersionDetailModal: (show) => set({ showVersionDetailModal: show }),
      setEditingVersionId: (id) => set({ editingVersionId: id }),

      addProject: () => { throw new Error('请在项目管理 → 项目配置中管理项目档案') },

      deleteProject: () => { throw new Error('请在项目管理 → 项目配置中管理项目档案') },

      cancelProject: (projectId) => set((s) => ({
        projects: s.projects.map(p =>
          p.id === projectId && canAccessHrProject(p, true) ? { ...p, status: 'cancelled' as const } : p,
        ),
      })),

      restoreProject: (projectId) => set((s) => ({
        projects: s.projects.map(p =>
          p.id === projectId && canAccessHrProject(p, true) ? { ...p, status: 'active' as const } : p,
        ),
      })),

      bindIpmProject: () => { throw new Error('请在项目管理 → 项目配置中管理项目档案') },

      addVersion: (projectId, budgetType, versionMeta) => set((s) => {
        if (!canAccessHrProject(s.projects.find(p => p.id === projectId), true)) return s
        const project = s.projects.find(p => p.id === projectId)
        if (!project || !canCreateHrVersion(project, budgetType)) return s

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
          const latest = getHrVersionSeed(p.versions, budgetType)
          const minorVersion = nextHrMinorVersion(p.versions, budgetType)

          // 里程碑：从最新版本复制，若无则空
          const milestones: MilestoneNodes = latest
            ? { ...latest.milestones }
            : emptyMilestones()

          const newVersion: HrMachineVersion = {
            id: `${projectId}-${budgetType}-v${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            projectId,
            budgetType,
            versionNumber: `V0.${minorVersion}`,
            batch: null,
            lockState: 'unlocked',
            majorVersion: 0,
            minorVersion,
            createdBy: '当前用户',
            projectLevel: versionMeta.projectLevel,
            levelCoefficient: versionMeta.levelCoefficient,
            hrModelVersion: versionMeta.hrModelVersion,
            milestones,
            estimatedInvestment,
            createdAt: new Date().toISOString(),
            lockedAt: null,
          }
          return { ...p, versions: [...p.versions, newVersion] }
        })

        return {
          projects: synchronizeProjects(newProjects),
          showNewVersionModal: false,
          monthlyInvestments: syncMonthlyInvestments(newProjects, s.monthlyInvestments),
        }
      }),

      deleteVersion: (projectId, versionId) => set((s) => {
        if (!canAccessHrProject(s.projects.find(p => p.id === projectId), true)) return s
        const newProjects = s.projects.map(p => {
          if (p.id !== projectId) return p
          const newVersions = p.versions.filter(v => v.id !== versionId)
          return { ...p, versions: newVersions }
        })
        return {
          projects: synchronizeProjects(newProjects),
          monthlyInvestments: syncMonthlyInvestments(newProjects, s.monthlyInvestments.filter(row => row.versionId !== versionId)),
        }
      }),


      updateVersion: (projectId, versionId, updates) => set((s) => {
        if (!canAccessHrProject(s.projects.find(p => p.id === projectId), true)) return s
        const configRecords = useHrConfigStore.getState().data.hrModel ?? []

        const newProjects = s.projects.map(p => {
          if (p.id !== projectId) return p
          const newVersions = p.versions.map(v => {
            if (v.id !== versionId) return v
            const permitted = allowedHrVersionUpdates(p, v, updates)
            if (Object.keys(permitted).length === 0) return v

            const updated: HrMachineVersion = {
              ...v,
              batch: permitted.batch === undefined ? v.batch : permitted.batch,
              estimatedInvestment: permitted.estimatedInvestment ?? v.estimatedInvestment,
              milestones: permitted.milestones ? { ...v.milestones, ...permitted.milestones } : v.milestones,
              projectLevel: permitted.projectLevel ?? v.projectLevel,
              levelCoefficient: permitted.levelCoefficient ?? v.levelCoefficient,
              hrModelVersion: permitted.hrModelVersion ?? v.hrModelVersion,
            }

            // 如果项目等级/等级系数/人力模型版本号发生变化，自动重算预估投入
            if (
              permitted.projectLevel !== undefined ||
              permitted.levelCoefficient !== undefined ||
              permitted.hrModelVersion !== undefined
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
          projects: synchronizeProjects(newProjects),
          monthlyInvestments: syncMonthlyInvestments(newProjects, s.monthlyInvestments),
        }
      }),

      refreshFormalProjects: () => set((s) => {
        const reconciled = reconcileHrRegistry(s.projects, s.monthlyInvestments, 'machine', s.registryMigrationComplete)
        const projects = synchronizeProjects(reconciled.projects)
        const monthlyInvestments = syncMonthlyInvestments(projects, reconciled.monthlyInvestments)
        if (s.registryMigrationComplete && JSON.stringify(projects) === JSON.stringify(s.projects) && JSON.stringify(monthlyInvestments) === JSON.stringify(s.monthlyInvestments)) return s
        return { projects, monthlyInvestments, registryMigrationComplete: true }
      }),

      updateMonthlyInvestment: (monthlyId, monthlyData) => set((s) => ({
        monthlyInvestments: s.monthlyInvestments.map(mi =>
          mi.id === monthlyId && !mi.isArchived && canAccessHrProject(s.projects.find(p => p.id === mi.projectId), true)
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
    {
      name: 'pms-hr-machine',
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as Partial<typeof current>) }
        const projects = synchronizeProjects(merged.projects)
        return { ...merged, projects, monthlyInvestments: syncMonthlyInvestments(projects, merged.monthlyInvestments) }
      },
      version: 12,
      migrate: (persistedState: unknown, fromVersion: number) => {
        const s = (persistedState ?? {}) as Record<string, unknown>
        // version 8 → 9: projectName string → string[], add historyVersionFilters
        if (fromVersion < 9) {
          const filters = (s.filters ?? {}) as Record<string, unknown>
          if (typeof filters.projectName === 'string') {
            filters.projectName = filters.projectName ? [filters.projectName] : []
          }
          s.filters = { ...DEFAULT_PROJECT_FILTERS, ...filters }
          s.historyVersionFilters = { ...DEFAULT_HISTORY_VERSION_FILTERS }
        }
        // version 9 → 10: add createdBy
        if (fromVersion < 10) {
          const projects = (s.projects ?? []) as Array<Record<string, unknown>>
          for (const p of projects) {
            const versions = (p.versions ?? []) as Array<Record<string, unknown>>
            for (const v of versions) {
              if (!('createdBy' in v)) {
                v.createdBy = '当前用户'
              }
            }
          }
        }
        // version 10 → 11: ensure levelCoefficient, projectLevel, estimatedInvestment exist
        if (fromVersion < 11) {
          const projects = (s.projects ?? []) as Array<Record<string, unknown>>
          for (const p of projects) {
            const versions = (p.versions ?? []) as Array<Record<string, unknown>>
            for (const v of versions) {
              if (v.levelCoefficient === undefined || v.levelCoefficient === null) {
                v.levelCoefficient = typeof v.levelCoefficient === 'number' ? v.levelCoefficient : 1
              }
              if (v.projectLevel === undefined || v.projectLevel === null) {
                v.projectLevel = ''
              }
              if (v.estimatedInvestment === undefined || v.estimatedInvestment === null) {
                v.estimatedInvestment = 0
              }
            }
          }
        }
        if (fromVersion < 12) {
          s.projects = appendHrMockProjects((s.projects ?? []) as HrMachineProject[], ADDITIONAL_PROJECTS)
        }
        return s as unknown as HrMachineState & HrMachineActions
      },
    },
  ),
)
