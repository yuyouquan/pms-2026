import { preserveHrMonthlyEdits } from '@/lib/hrMonthlySync'
import { appendHrMockProjects, createAdditionalTosProjects } from '@/mock/hrInvestment'
import { canCreateHrVersion, allowedHrVersionUpdates, getHrVersionSeed, getLatestHrVersion, isLatestHrVersion, nextHrMinorVersion } from '@/lib/hrVersionRules'
import { synchronizeHrProjects } from '@/lib/hrProjectSync'
import { getHrFormalProjectOptions } from '@/lib/hrFormalProjectSource'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  HrTosProject,
  HrTosVersion,
  TosMonthlyInvestment,
  TosProjectListFilters,
  TosHistoryVersionFilters,
  BudgetType,
  TosNewProjectForm,
  TosNewVersionForm,
  TosMilestoneNodes,
  TosDepartmentInvestment,
  TosVersionOperationLog,
  TosVersionOperationType,
} from '@/types/hrTos'
import {
  DEFAULT_TOS_PROJECT_FILTERS,
  DEFAULT_TOS_HISTORY_VERSION_FILTERS,
} from '@/constants/hrTos'
import {
  calcTosDepartmentMonthlySplit,
  type DepartmentMonthlySplit,
} from '@/constants/hrConfig'

/* ── Mock Data ──────────────────────────────────────────────────────── */

/** 空里程碑模板 */
function emptyTosMilestones(): TosMilestoneNodes {
  return {
    planningKO: null,
    conceptStart: null,
    str1: null,
    str3: null,
    str5: null,
    marketIteration: null,
    maintenanceEnd: null,
  }
}

/** 阶段分配比例（归一化） */
const TOS_MOCK_PHASE_RATIOS = [0.15, 0.15, 0.2, 0.25, 0.15, 0.1]

/**
 * 生成 mock 部门预估投入列表。
 * 不依赖配置中心，直接按比例分配到各部门各阶段。
 */
function createMockDepartmentInvestments(
  projectId: string,
  budgetType: BudgetType,
  total: number,
): TosDepartmentInvestment[] {
  const mockDepartments = [
    { primary: '研发部', secondary: '软件部', ratio: 0.4 },
    { primary: '研发部', secondary: '硬件部', ratio: 0.3 },
    { primary: '市场部', secondary: '产品部', ratio: 0.2 },
    { primary: '质量部', secondary: '测试部', ratio: 0.1 },
  ]
  return mockDepartments.map((d, idx) => {
    const deptTotal = Math.round(total * d.ratio * 10) / 10
    const phaseValues = TOS_MOCK_PHASE_RATIOS.map(r =>
      Math.round(deptTotal * r * 10) / 10,
    )
    return {
      id: `di-mock-${projectId}-${budgetType}-${idx}`,
      primaryDepartment: d.primary,
      secondaryDepartment: d.secondary,
      estimatedInvestment: deptTotal,
      planningPhase: phaseValues[0],
      conceptPhase: phaseValues[1],
      planningPhase2: phaseValues[2],
      developmentValidationPhase: phaseValues[3],
      marketIterationPhase: phaseValues[4],
      maintenancePhase: phaseValues[5],
    } as TosDepartmentInvestment
  })
}

/**
 * 从部门投入列表计算预估投入合计（各阶段之和）。
 */
function sumDepartmentInvestments(items: TosDepartmentInvestment[]): number {
  return Math.round(
    items.reduce((sum, d) => sum + (Number(d.estimatedInvestment) || 0), 0) * 10,
  ) / 10
}

/**
 * 为指定项目创建 mock 版本数据。
 */
function createMockVersions(
  projectId: string,
  investments: { annual: number; projectEstimate: number; projectBudget: number },
  dateOffsets?: { planningKO: string; marketIteration: string; maintenanceEnd: string },
  lockConfig?: { annual?: boolean; projectEstimate?: boolean; projectBudget?: boolean },
  extraVersions?: { budgetType: BudgetType; count: number }[],
): HrTosVersion[] {
  const milestones: TosMilestoneNodes = {
    planningKO: dateOffsets?.planningKO ?? '2026-01-02',
    conceptStart: '2026-02-15',
    str1: '2026-04-15',
    str3: '2026-06-20',
    str5: '2026-09-15',
    marketIteration: dateOffsets?.marketIteration ?? '2026-11-30',
    maintenanceEnd: dateOffsets?.maintenanceEnd ?? '2027-02-28',
  }
  const baseDate = milestones.planningKO!
  const versions: HrTosVersion[] = []

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
      estimatedInvestment: investments.annual,
      milestones: { ...milestones },
      departmentInvestments: createMockDepartmentInvestments(
        projectId,
        'annual',
        investments.annual,
      ),
      createdAt: baseDate,
      lockedAt: isLocked ? '2026-01-10' : null,
      operationLogs: [
        makeLog('created', `创建年度预算版本 V0.${i}`),
        ...(isLocked ? [makeLog('locked', '版本锁定')] : []),
      ],
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
      estimatedInvestment: investments.projectEstimate,
      milestones: { ...milestones },
      departmentInvestments: createMockDepartmentInvestments(
        projectId,
        'projectEstimate',
        investments.projectEstimate,
      ),
      createdAt: baseDate,
      lockedAt: isLocked ? '2026-01-12' : null,
      operationLogs: [
        makeLog('created', `创建项目概算版本 V0.${i}`),
        ...(isLocked ? [makeLog('locked', '版本锁定')] : []),
      ],
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
      estimatedInvestment: investments.projectBudget,
      milestones: { ...milestones },
      departmentInvestments: createMockDepartmentInvestments(
        projectId,
        'projectBudget',
        investments.projectBudget,
      ),
      createdAt: baseDate,
      lockedAt: isLocked ? '2026-01-15' : null,
      operationLogs: [
        makeLog('created', `创建项目预算版本 V0.${i}`),
        ...(isLocked ? [makeLog('locked', '版本锁定')] : []),
      ],
    })
  }

  return versions
}

/**
 * 使用配置中心数据，按部门拆分版本月度预估投入。
 */
function generateDepartmentMonthlyRecords(
  projectId: string,
  version: HrTosVersion,
): TosMonthlyInvestment[] {
  const splits = calcTosDepartmentMonthlySplit(
    version.departmentInvestments,
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

const MOCK_PROJECTS: HrTosProject[] = [
  {
    id: 'tp-tos1',
    name: 'tOS-平台架构升级',
    projectTarget: '构建高性能、可扩展的tOS平台架构，支持多产品线复用',
    ipmProjectCode: 'IPM-TOS-001',
    ipmProjectName: 'tOS-平台V1.0',
    status: 'active',
    annualBudget: 0,
    projectEstimate: 0,
    projectBudget: 0,
    projectAccounting: 0,
    versions: createMockVersions(
      'tp-tos1',
      { annual: 120, projectEstimate: 120, projectBudget: 120 },
      { planningKO: '2026-01-15', marketIteration: '2026-11-30', maintenanceEnd: '2027-02-28' },
      { annual: false, projectEstimate: false, projectBudget: false },
    ),
    createdAt: '2026-01-15',
  },
  {
    id: 'tp-tos2',
    name: 'tOS-组件库建设',
    projectTarget: '建设统一组件库，提升研发效率和复用率',
    ipmProjectCode: 'IPM-TOS-003',
    ipmProjectName: 'tOS-组件库',
    status: 'active',
    annualBudget: 0,
    projectEstimate: 0,
    projectBudget: 0,
    projectAccounting: 0,
    versions: createMockVersions(
      'tp-tos2',
      { annual: 80, projectEstimate: 80, projectBudget: 80 },
      { planningKO: '2026-02-01', marketIteration: '2026-10-15', maintenanceEnd: '2027-01-15' },
      { annual: true, projectEstimate: false, projectBudget: false },
    ),
    createdAt: '2026-02-01',
  },
  {
    id: 'tp-tos3',
    name: 'tOS-安全加固',
    projectTarget: '提升系统安全防护能力，满足合规要求',
    ipmProjectCode: null,
    ipmProjectName: null,
    status: 'active',
    annualBudget: 0,
    projectEstimate: 0,
    projectBudget: 0,
    projectAccounting: 0,
    versions: createMockVersions(
      'tp-tos3',
      { annual: 60, projectEstimate: 60, projectBudget: 60 },
      { planningKO: '2026-03-01', marketIteration: '2026-09-30', maintenanceEnd: '2026-12-31' },
      { annual: false, projectEstimate: false, projectBudget: false },
    ),
    createdAt: '2026-03-01',
  },
]

/**
 * 为所有项目生成月度预估投入数据。
 */


const ADDITIONAL_PROJECTS = createAdditionalTosProjects(getHrFormalProjectOptions('tos'))
const INITIAL_PROJECTS = [...MOCK_PROJECTS, ...ADDITIONAL_PROJECTS]

/* ── Helpers ────────────────────────────────────────────────────────── */

/** 生成操作日志 */
function makeLog(
  operation: TosVersionOperationType,
  description: string,
  operator: string = '张明',
): TosVersionOperationLog {
  return {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    operation,
    operator,
    timestamp: new Date().toLocaleString('zh-CN', { hour12: false }),
    description,
  }
}

/** 获取指定项目+预算类型下的最新版本 */
function getLatestVersion(project: HrTosProject, budgetType: BudgetType): HrTosVersion | null {
  return getLatestHrVersion(project.versions, budgetType) ?? null
}

/** 获取指定项目所有预算类型的最新版本 */
function getLatestVersions(project: HrTosProject): HrTosVersion[] {
  const result: HrTosVersion[] = []
  for (const bt of ['annual', 'projectEstimate', 'projectBudget'] as BudgetType[]) {
    const latest = getLatestVersion(project, bt)
    if (latest) result.push(latest)
  }
  return result
}

/**
 * 同步月度预估投入：每个预算类型只保留最新版本的数据。
 */

function synchronizeProjects(projects: HrTosProject[]): HrTosProject[] {
  return synchronizeHrProjects(projects, 'tos')
}

function syncMonthlyInvestments(projects: HrTosProject[], existingMonthly: TosMonthlyInvestment[]): TosMonthlyInvestment[] {
  const generated = synchronizeProjects(projects).flatMap(project =>
    getLatestVersions(project).flatMap(version => generateDepartmentMonthlyRecords(project.id, version)),
  )
  return preserveHrMonthlyEdits(generated, existingMonthly)
}


/* ── State / Actions interfaces ────────────────────────────────────── */

export type TosTab = 'projectList' | 'monthlyInvestment' | 'historyVersion'

export interface HrTosState {
  projects: HrTosProject[]
  monthlyInvestments: TosMonthlyInvestment[]
  selectedProjectId: string | null
  activeTab: TosTab
  filters: TosProjectListFilters
  historyVersionFilters: TosHistoryVersionFilters
  selectedBudgetTypes: BudgetType[]
  showNewProjectModal: boolean
  showNewVersionModal: boolean
  showMonthlyEditModal: boolean
  showVersionDetailModal: boolean
  /** 版本详情弹窗是否只读（详情模式） */
  versionDetailReadOnly: boolean
  editingMonthlyId: string | null
  editingVersionId: string | null
}

export interface HrTosActions {
  setActiveTab: (tab: TosTab) => void
  setSelectedProjectId: (id: string | null) => void
  setFilters: (partial: Partial<TosProjectListFilters>) => void
  resetFilters: () => void
  setHistoryVersionFilters: (partial: Partial<TosHistoryVersionFilters>) => void
  resetHistoryVersionFilters: () => void
  setSelectedBudgetTypes: (types: BudgetType[]) => void
  setShowNewProjectModal: (show: boolean) => void
  setShowNewVersionModal: (show: boolean) => void
  setShowMonthlyEditModal: (show: boolean) => void
  setShowVersionDetailModal: (show: boolean) => void
  /** 设置版本详情弹窗只读模式 */
  setVersionDetailReadOnly: (readOnly: boolean) => void
  setEditingMonthlyId: (id: string | null) => void
  setEditingVersionId: (id: string | null) => void

  addProject: (form: TosNewProjectForm) => void
  deleteProject: (projectId: string) => void
  cancelProject: (projectId: string) => void
  restoreProject: (projectId: string) => void

  /** 绑定IPM正式项目编码 */
  bindIpmProject: (projectId: string, ipmCode: string) => void

  addVersion: (projectId: string, form: TosNewVersionForm) => void
  deleteVersion: (projectId: string, versionId: string) => void
  /** 复制版本（直接新增一个同预算类型的版本，继承数据） */
  copyVersion: (projectId: string, versionId: string) => void

  /** 行内编辑版本数据 */
  updateVersion: (
    projectId: string,
    versionId: string,
    updates: {
      batch?: number | null
      estimatedInvestment?: number
      milestones?: Partial<TosMilestoneNodes>
    },
  ) => void

  /** 更新版本详情中的部门预估投入列表 */
  updateVersionDepartmentInvestments: (
    projectId: string,
    versionId: string,
    departmentInvestments: TosDepartmentInvestment[],
  ) => void

  refreshFormalProjects: () => void

  updateMonthlyInvestment: (monthlyId: string, monthlyData: Record<string, number>) => void

  /** 获取指定项目所有预算类型的最新版本 */
  getLatestVersions: (projectId: string) => HrTosVersion[]

  /** 计算指定版本的部门拆分月度数据 */
  calculateMonthlySplit: (version: HrTosVersion) => DepartmentMonthlySplit[]
}

/* ── Store ─────────────────────────────────────────────────────────── */

const ALL_BUDGET_TYPES: BudgetType[] = ['annual', 'projectEstimate', 'projectBudget']

export const useHrTosStore = create<HrTosState & HrTosActions>()(
  persist(
    (set, get) => ({
      projects: synchronizeProjects(INITIAL_PROJECTS),
      monthlyInvestments: syncMonthlyInvestments(INITIAL_PROJECTS, []),
      selectedProjectId: null,
      activeTab: 'projectList',
      filters: { ...DEFAULT_TOS_PROJECT_FILTERS },
      historyVersionFilters: { ...DEFAULT_TOS_HISTORY_VERSION_FILTERS },
      selectedBudgetTypes: [...ALL_BUDGET_TYPES],
      showNewProjectModal: false,
      showNewVersionModal: false,
      showMonthlyEditModal: false,
      showVersionDetailModal: false,
      versionDetailReadOnly: false,
      editingMonthlyId: null,
      editingVersionId: null,

      setActiveTab: (tab) => set({ activeTab: tab }),

      setSelectedProjectId: (id) => set({ selectedProjectId: id }),
      setFilters: (partial) => set((s) => ({ filters: { ...s.filters, ...partial } })),
      resetFilters: () => set({ filters: { ...DEFAULT_TOS_PROJECT_FILTERS } }),

      setHistoryVersionFilters: (partial) => set((s) => ({ historyVersionFilters: { ...s.historyVersionFilters, ...partial } })),
      resetHistoryVersionFilters: () => set({ historyVersionFilters: { ...DEFAULT_TOS_HISTORY_VERSION_FILTERS } }),

      setSelectedBudgetTypes: (types) => set({ selectedBudgetTypes: types }),

      setShowNewProjectModal: (show) => set({ showNewProjectModal: show }),
      setShowNewVersionModal: (show) => set({ showNewVersionModal: show }),
      setShowMonthlyEditModal: (show) => set({ showMonthlyEditModal: show }),
      setShowVersionDetailModal: (show) => set({ showVersionDetailModal: show }),
      setVersionDetailReadOnly: (readOnly) => set({ versionDetailReadOnly: readOnly }),
      setEditingMonthlyId: (id) => set({ editingMonthlyId: id }),
      setEditingVersionId: (id) => set({ editingVersionId: id }),

      addProject: (form) => set((s) => {
        const newProject: HrTosProject = {
          id: `tp-${Date.now()}`,
          name: form.name,
          projectTarget: form.projectTarget,
          ipmProjectCode: null,
          ipmProjectName: null,
          status: 'active',
          annualBudget: 0,
          projectEstimate: 0,
          projectBudget: 0,
          projectAccounting: 0,
          versions: [],
          createdAt: new Date().toISOString(),
        }
        const newProjects = [...s.projects, newProject]
        return {
          projects: synchronizeProjects(newProjects),
          showNewProjectModal: false,
          monthlyInvestments: syncMonthlyInvestments(newProjects, s.monthlyInvestments),
        }
      }),

      deleteProject: (projectId) => set((s) => {
        const newProjects = s.projects.filter(p => p.id !== projectId)
        return {
          projects: synchronizeProjects(newProjects),
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
        const ipmProject = getHrFormalProjectOptions('tos').find(p => p.code === ipmCode)
        if (!ipmProject) return s
        const newProjects = synchronizeProjects(s.projects.map(p => p.id === projectId
          ? { ...p, ipmProjectCode: ipmProject.code, ipmProjectName: ipmProject.name } : p))
        return { projects: newProjects, monthlyInvestments: syncMonthlyInvestments(newProjects, s.monthlyInvestments) }
      }),

      addVersion: (projectId, form) => set((s) => {
        const project = s.projects.find(p => p.id === projectId)
        if (!project || !canCreateHrVersion(project, form.budgetType)) return s

        // IPM 校验
        if (
          (form.budgetType === 'projectEstimate' || form.budgetType === 'projectBudget') &&
          !project.ipmProjectCode
        ) {
          return s
        }

        const newProjects = s.projects.map(p => {
          if (p.id !== projectId) return p

          const latest = getHrVersionSeed(p.versions, form.budgetType)
          const minorVersion = nextHrMinorVersion(p.versions, form.budgetType)

          const milestones: TosMilestoneNodes = latest
            ? { ...latest.milestones }
            : emptyTosMilestones()

          const newVersion: HrTosVersion = {
            id: `${projectId}-${form.budgetType}-v${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            projectId,
            budgetType: form.budgetType,
            versionNumber: `V0.${minorVersion}`,
            batch: null,
            lockState: 'unlocked',
            majorVersion: 0,
            minorVersion,
            createdBy: '当前用户',
            estimatedInvestment: sumDepartmentInvestments(form.departmentInvestments),
            milestones,
            departmentInvestments: form.departmentInvestments.map(department => ({ ...department })),
            createdAt: new Date().toISOString(),
            lockedAt: null,
            operationLogs: [
              makeLog('created', `创建${form.budgetType === 'annual' ? '年度预算' : form.budgetType === 'projectEstimate' ? '项目概算' : '项目预算'}版本 V0.${minorVersion}`),
            ],
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
        const newProjects = s.projects.map(p => {
          if (p.id !== projectId) return p
          const newVersions = p.versions.filter(v => v.id !== versionId)
          return { ...p, versions: newVersions }
        })
        return {
          projects: synchronizeProjects(newProjects),
          monthlyInvestments: syncMonthlyInvestments(newProjects, s.monthlyInvestments),
        }
      }),


      copyVersion: (projectId, versionId) => set((s) => {
        const project = s.projects.find(p => p.id === projectId)
        if (!project) return s
        const sourceVersion = project.versions.find(v => v.id === versionId)
        if (!sourceVersion || !canCreateHrVersion(project, sourceVersion.budgetType)) return s

        const minorVersion = nextHrMinorVersion(project.versions, sourceVersion.budgetType)

        const newVersion: HrTosVersion = {
          ...sourceVersion,
          createdBy: '当前用户',
          id: `${projectId}-${sourceVersion.budgetType}-v${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          versionNumber: `V0.${minorVersion}`,
            batch: null,
          lockState: 'unlocked',
          majorVersion: 0,
          minorVersion,
          lockedAt: null,
          createdAt: new Date().toISOString(),
          milestones: { ...sourceVersion.milestones },
          departmentInvestments: sourceVersion.departmentInvestments.map(d => ({ ...d })),
          operationLogs: [
            makeLog('created', `从版本 ${sourceVersion.versionNumber} 复制创建 V0.${minorVersion}`),
            makeLog('copied', `复制自 ${sourceVersion.versionNumber}`),
          ],
        }

        const newProjects = s.projects.map(p => {
          if (p.id !== projectId) return p
          // 给被复制的源版本添加一条日志
          const newVersions = p.versions.map(v => {
            if (v.id === versionId) {
              return {
                ...v,
                operationLogs: [
                  ...v.operationLogs,
                  makeLog('copied', `版本 ${v.versionNumber} 被复制为 V0.${minorVersion}`),
                ],
              }
            }
            return v
          })
          return { ...p, versions: [...newVersions, newVersion] }
        })

        return {
          projects: synchronizeProjects(newProjects),
          monthlyInvestments: syncMonthlyInvestments(newProjects, s.monthlyInvestments),
        }
      }),

      updateVersion: (projectId, versionId, updates) => set((s) => {
        const newProjects = s.projects.map(p => {
          if (p.id !== projectId) return p
          const newVersions = p.versions.map(v => {
            if (v.id !== versionId) return v
            const permitted = allowedHrVersionUpdates(p, v, updates)
            if (Object.keys(permitted).length === 0) return v

            const updated: HrTosVersion = {
              ...v,
              batch: permitted.batch === undefined ? v.batch : permitted.batch,
              estimatedInvestment: permitted.estimatedInvestment ?? v.estimatedInvestment,
              milestones: permitted.milestones ? { ...v.milestones, ...permitted.milestones } : v.milestones,
            }

            // 添加编辑日志
            const logParts: string[] = []
            if (permitted.estimatedInvestment !== undefined) logParts.push('预估投入')
            if (permitted.milestones !== undefined) logParts.push('里程碑节点')
            if (logParts.length > 0) {
              updated.operationLogs = [
                ...v.operationLogs,
                makeLog('edited', `修改了 ${logParts.join('、')}`),
              ]
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

      updateVersionDepartmentInvestments: (projectId, versionId, departmentInvestments) => set((s) => {
        // 计算所有部门预估投入合计
        const newEstimatedTotal = departmentInvestments.reduce(
          (sum, d) => sum + (Number(d.estimatedInvestment) || 0), 0,
        )
        const newProjects = s.projects.map(p => {
          if (p.id !== projectId) return p
          const newVersions = p.versions.map(v => {
            if (v.id !== versionId || !isLatestHrVersion(p, v)) return v
            return {
              ...v,
              estimatedInvestment: Math.round(newEstimatedTotal * 10) / 10,
              departmentInvestments,
              operationLogs: [
                ...v.operationLogs,
                makeLog('deptUpdated', `更新部门预估投入（共${departmentInvestments.length}条）`),
              ],
            }
          })
          return { ...p, versions: newVersions }
        })
        return {
          projects: synchronizeProjects(newProjects),
          showVersionDetailModal: false,
          versionDetailReadOnly: false,
          editingVersionId: null,
          monthlyInvestments: syncMonthlyInvestments(newProjects, s.monthlyInvestments),
        }
      }),

      refreshFormalProjects: () => set((s) => {
        const projects = synchronizeProjects(s.projects)
        const monthlyInvestments = syncMonthlyInvestments(projects, s.monthlyInvestments)
        if (JSON.stringify(projects) === JSON.stringify(s.projects) && JSON.stringify(monthlyInvestments) === JSON.stringify(s.monthlyInvestments)) return s
        return { projects, monthlyInvestments }
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

      getLatestVersions: (projectId) => {
        const project = get().projects.find(p => p.id === projectId)
        if (!project) return []
        return getLatestVersions(project)
      },

      calculateMonthlySplit: (version) => {
        return calcTosDepartmentMonthlySplit(
          version.departmentInvestments,
          version.milestones,
        )
      },
    }),
    {
      name: 'pms-hr-tos',
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as Partial<typeof current>) }
        const projects = synchronizeProjects(merged.projects)
        return { ...merged, projects, monthlyInvestments: syncMonthlyInvestments(projects, merged.monthlyInvestments) }
      },
      version: 5,
      migrate: (persistedState: unknown, fromVersion: number) => {
        const s = (persistedState ?? {}) as Record<string, unknown>
        // version 2 → 3: projectName string → string[], add historyVersionFilters
        if (fromVersion < 3) {
          const filters = (s.filters ?? {}) as Record<string, unknown>
          if (typeof filters.projectName === 'string') {
            filters.projectName = filters.projectName ? [filters.projectName] : []
          }
          s.filters = { ...DEFAULT_TOS_PROJECT_FILTERS, ...filters }
          s.historyVersionFilters = { ...DEFAULT_TOS_HISTORY_VERSION_FILTERS }
        }
        // version 3 → 4: remove hrModelVersion, add createdBy
        if (fromVersion < 4) {
          const projects = (s.projects ?? []) as Array<Record<string, unknown>>
          for (const p of projects) {
            const versions = (p.versions ?? []) as Array<Record<string, unknown>>
            for (const v of versions) {
              if (!('createdBy' in v)) {
                v.createdBy = '当前用户'
              }
              delete v.hrModelVersion
            }
          }
        }
        if (fromVersion < 5) {
          s.projects = appendHrMockProjects((s.projects ?? []) as HrTosProject[], ADDITIONAL_PROJECTS)
        }
        return s as unknown as HrTosState & HrTosActions
      },
    },
  ),
)
