import { allowedHrVersionUpdates, getHrVersionSeed, getLatestHrVersion, isLatestHrVersion, nextHrMinorVersion } from '@/lib/hrVersionRules'
import { synchronizeHrProjects } from '@/lib/hrProjectSync'
import { getHrFormalProjectOptions } from '@/lib/hrFormalProjectSource'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  HrTechnicalProject,
  HrTechnicalVersion,
  TechMonthlyInvestment,
  TechProjectListFilters,
  TechHistoryVersionFilters,
  BudgetType,
  TechNewProjectForm,
  TechNewVersionForm,
  TechMilestoneNodes,
  TechDepartmentInvestment,
  TechVersionOperationLog,
  TechVersionOperationType,
} from '@/types/hrTechnical'
import {
  DEFAULT_TECH_PROJECT_FILTERS,
  DEFAULT_TECH_HISTORY_VERSION_FILTERS,
} from '@/constants/hrTechnical'
import {
  calcTechDepartmentMonthlySplit,
  type DepartmentMonthlySplit,
} from '@/constants/hrConfig'

/* ── Mock Data ──────────────────────────────────────────────────────── */

/** 空里程碑模板 */
function emptyTechMilestones(): TechMilestoneNodes {
  return {
    planningStart: null,
    charterDCP: null,
    tdr1: null,
    pdcp: null,
    tdcpx: null,
    edcp: null,
  }
}

/** 阶段分配比例（归一化，5个阶段） */
const TECH_MOCK_PHASE_RATIOS = [0.10, 0.15, 0.15, 0.40, 0.20]

/**
 * 生成 mock 部门预估投入列表。
 */
function createMockDepartmentInvestments(
  projectId: string,
  budgetType: BudgetType,
  total: number,
): TechDepartmentInvestment[] {
  const mockDepartments = [
    { primary: '研发部', secondary: '软件部', ratio: 0.4 },
    { primary: '研发部', secondary: '硬件部', ratio: 0.3 },
    { primary: '市场部', secondary: '产品部', ratio: 0.2 },
    { primary: '质量部', secondary: '测试部', ratio: 0.1 },
  ]
  return mockDepartments.map((d, idx) => {
    const deptTotal = Math.round(total * d.ratio * 10) / 10
    const phaseValues = TECH_MOCK_PHASE_RATIOS.map(r =>
      Math.round(deptTotal * r * 10) / 10,
    )
    return {
      id: `di-mock-${projectId}-${budgetType}-${idx}`,
      primaryDepartment: d.primary,
      secondaryDepartment: d.secondary,
      estimatedInvestment: deptTotal,
      planningPhase: phaseValues[0],
      conceptPhase: phaseValues[1],
      planPhase: phaseValues[2],
      developmentPhase: phaseValues[3],
      migrationPhase: phaseValues[4],
    } as TechDepartmentInvestment
  })
}

/**
 * 从部门投入列表计算预估投入合计。
 */
function sumDepartmentInvestments(items: TechDepartmentInvestment[]): number {
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
  dateOffsets?: { planningStart: string; edcp: string },
  lockConfig?: { annual?: boolean; projectEstimate?: boolean; projectBudget?: boolean },
  extraVersions?: { budgetType: BudgetType; count: number }[],
): HrTechnicalVersion[] {
  const milestones: TechMilestoneNodes = {
    planningStart: dateOffsets?.planningStart ?? '2026-01-02',
    charterDCP: '2026-02-15',
    tdr1: '2026-04-15',
    pdcp: '2026-06-20',
    tdcpx: '2026-09-15',
    edcp: dateOffsets?.edcp ?? '2026-11-30',
  }
  const baseDate = milestones.planningStart!
  const versions: HrTechnicalVersion[] = []

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
  version: HrTechnicalVersion,
): TechMonthlyInvestment[] {
  const splits = calcTechDepartmentMonthlySplit(
    version.departmentInvestments,
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
            batch: version.batch ?? null,
    versionLockState: version.lockState,
    estimatedTotal: split.estimatedTotal,
    monthlyData: split.monthlyData,
    isEdited: false,
  }))
}

const MOCK_PROJECTS: HrTechnicalProject[] = [
  {
    id: 'tp-tech1',
    tdtName: '摄像头驱动平台升级',
    planningYear: '2026',
    techDomain: '影像技术',
    tmg: '影像TMG',
    techTrack: '摄像头驱动',
    subTrack: '传感器驱动',
    subTaskName: '传感器驱动优化',
    ipmProjectCode: 'IPM-TECH-001',
    ipmProjectName: '摄像头驱动平台',
    status: 'active',
    annualBudget: 0,
    projectEstimate: 0,
    projectBudget: 0,
    projectAccounting: 0,
    versions: createMockVersions(
      'tp-tech1',
      { annual: 120, projectEstimate: 120, projectBudget: 120 },
      { planningStart: '2026-01-15', edcp: '2026-11-30' },
      { annual: false, projectEstimate: false, projectBudget: false },
    ),
    createdAt: '2026-01-15',
  },
  {
    id: 'tp-tech2',
    tdtName: '显示驱动升级项目',
    planningYear: '2026',
    techDomain: '显示技术',
    tmg: '显示TMG',
    techTrack: '显示驱动',
    subTrack: 'OLED驱动',
    subTaskName: 'OLED功耗优化',
    ipmProjectCode: 'IPM-TECH-002',
    ipmProjectName: '显示驱动升级',
    status: 'active',
    annualBudget: 0,
    projectEstimate: 0,
    projectBudget: 0,
    projectAccounting: 0,
    versions: createMockVersions(
      'tp-tech2',
      { annual: 80, projectEstimate: 80, projectBudget: 80 },
      { planningStart: '2026-02-01', edcp: '2026-10-15' },
      { annual: true, projectEstimate: false, projectBudget: false },
    ),
    createdAt: '2026-02-01',
  },
  {
    id: 'tp-tech3',
    tdtName: 'AI推理框架建设',
    planningYear: '2026',
    techDomain: 'AI技术',
    tmg: 'AITMG',
    techTrack: 'AI框架',
    subTrack: '推理优化',
    subTaskName: '模型推理加速',
    ipmProjectCode: null,
    ipmProjectName: null,
    status: 'active',
    annualBudget: 0,
    projectEstimate: 0,
    projectBudget: 0,
    projectAccounting: 0,
    versions: createMockVersions(
      'tp-tech3',
      { annual: 60, projectEstimate: 60, projectBudget: 60 },
      { planningStart: '2026-03-01', edcp: '2026-09-30' },
      { annual: false, projectEstimate: false, projectBudget: false },
    ),
    createdAt: '2026-03-01',
  },
]

/**
 * 为所有项目生成月度预估投入数据。
 */


/* ── Helpers ────────────────────────────────────────────────────────── */

/** 生成操作日志 */
function makeLog(
  operation: TechVersionOperationType,
  description: string,
  operator: string = '张明',
): TechVersionOperationLog {
  return {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    operation,
    operator,
    timestamp: new Date().toLocaleString('zh-CN', { hour12: false }),
    description,
  }
}

/** 获取指定项目+预算类型下的最新版本 */
function getLatestVersion(project: HrTechnicalProject, budgetType: BudgetType): HrTechnicalVersion | null {
  return getLatestHrVersion(project.versions, budgetType) ?? null
}

/** 获取指定项目所有预算类型的最新版本 */
function getLatestVersions(project: HrTechnicalProject): HrTechnicalVersion[] {
  const result: HrTechnicalVersion[] = []
  for (const bt of ['annual', 'projectEstimate', 'projectBudget'] as BudgetType[]) {
    const latest = getLatestVersion(project, bt)
    if (latest) result.push(latest)
  }
  return result
}

/**
 * 同步月度预估投入：每个预算类型只保留最新版本的数据。
 */

function synchronizeProjects(projects: HrTechnicalProject[]): HrTechnicalProject[] {
  return synchronizeHrProjects(projects, 'technical')
}

function syncMonthlyInvestments(
  projects: HrTechnicalProject[],
  existingMonthly: TechMonthlyInvestment[],
): TechMonthlyInvestment[] {
  projects = synchronizeProjects(projects)
  const result: TechMonthlyInvestment[] = []

  const existingMap = new Map<string, TechMonthlyInvestment>()
  for (const m of existingMonthly) {
    const key = `${m.versionId}|${m.primaryDepartment}|${m.secondaryDepartment}`
    existingMap.set(key, m)
  }

  for (const project of projects) {
    const latestVersions = getLatestVersions(project)
    for (const version of latestVersions) {
      const deptRecords = generateDepartmentMonthlyRecords(project.id, version)
      for (const record of deptRecords) {
        const key = `${record.versionId}|${record.primaryDepartment}|${record.secondaryDepartment}`
        const existing = existingMap.get(key)
        if (existing?.isEdited && existing.estimatedTotal === record.estimatedTotal
          && Object.keys(existing.monthlyData).sort().join() === Object.keys(record.monthlyData).sort().join()) {
          result.push({
            ...existing,
            versionLockState: version.lockState,
            versionNumber: version.versionNumber,
            batch: version.batch ?? null,
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

export type TechTab = 'projectList' | 'monthlyInvestment' | 'historyVersion'

export interface HrTechnicalState {
  projects: HrTechnicalProject[]
  monthlyInvestments: TechMonthlyInvestment[]
  selectedProjectId: string | null
  activeTab: TechTab
  filters: TechProjectListFilters
  historyVersionFilters: TechHistoryVersionFilters
  selectedBudgetTypes: BudgetType[]
  showNewProjectModal: boolean
  showNewVersionModal: boolean
  showMonthlyEditModal: boolean
  showVersionDetailModal: boolean
  /** 版本详情弹窗是否只读（详情模式） */
  versionDetailReadOnly: boolean
  /** 版本历史弹窗 */
  showVersionHistoryModal: boolean
  editingMonthlyId: string | null
  editingVersionId: string | null
  /** 版本历史弹窗正在查看的版本ID */
  editingHistoryVersionId: string | null
}

export interface HrTechnicalActions {
  setActiveTab: (tab: TechTab) => void
  setSelectedProjectId: (id: string | null) => void
  setFilters: (partial: Partial<TechProjectListFilters>) => void
  resetFilters: () => void
  setHistoryVersionFilters: (partial: Partial<TechHistoryVersionFilters>) => void
  resetHistoryVersionFilters: () => void
  setSelectedBudgetTypes: (types: BudgetType[]) => void
  setShowNewProjectModal: (show: boolean) => void
  setShowNewVersionModal: (show: boolean) => void
  setShowMonthlyEditModal: (show: boolean) => void
  setShowVersionDetailModal: (show: boolean) => void
  /** 设置版本详情弹窗只读模式 */
  setVersionDetailReadOnly: (readOnly: boolean) => void
  setShowVersionHistoryModal: (show: boolean) => void
  setEditingMonthlyId: (id: string | null) => void
  setEditingVersionId: (id: string | null) => void
  setEditingHistoryVersionId: (id: string | null) => void

  addProject: (form: TechNewProjectForm) => void
  deleteProject: (projectId: string) => void
  cancelProject: (projectId: string) => void
  restoreProject: (projectId: string) => void

  /** 绑定IPM正式项目编码 */
  bindIpmProject: (projectId: string, ipmCode: string) => void

  addVersion: (projectId: string, form: TechNewVersionForm) => void
  deleteVersion: (projectId: string, versionId: string) => void
  /** 复制版本 */
  copyVersion: (projectId: string, versionId: string) => void

  /** 行内编辑版本数据 */
  updateVersion: (
    projectId: string,
    versionId: string,
    updates: {
      batch?: number | null
      estimatedInvestment?: number
      milestones?: Partial<TechMilestoneNodes>
    },
  ) => void

  /** 更新版本详情中的部门预估投入列表 */
  updateVersionDepartmentInvestments: (
    projectId: string,
    versionId: string,
    departmentInvestments: TechDepartmentInvestment[],
  ) => void

  refreshFormalProjects: () => void

  updateMonthlyInvestment: (monthlyId: string, monthlyData: Record<string, number>) => void

  /** 获取指定项目所有预算类型的最新版本 */
  getLatestVersions: (projectId: string) => HrTechnicalVersion[]

  /** 计算指定版本的部门拆分月度数据 */
  calculateMonthlySplit: (version: HrTechnicalVersion) => DepartmentMonthlySplit[]
}

/* ── Store ─────────────────────────────────────────────────────────── */

const ALL_BUDGET_TYPES: BudgetType[] = ['annual', 'projectEstimate', 'projectBudget']

export const useHrTechnicalStore = create<HrTechnicalState & HrTechnicalActions>()(
  persist(
    (set, get) => ({
      projects: synchronizeProjects(MOCK_PROJECTS),
      monthlyInvestments: syncMonthlyInvestments(MOCK_PROJECTS, []),
      selectedProjectId: null,
      activeTab: 'projectList',
      filters: { ...DEFAULT_TECH_PROJECT_FILTERS },
      historyVersionFilters: { ...DEFAULT_TECH_HISTORY_VERSION_FILTERS },
      selectedBudgetTypes: [...ALL_BUDGET_TYPES],
      showNewProjectModal: false,
      showNewVersionModal: false,
      showMonthlyEditModal: false,
      showVersionDetailModal: false,
      versionDetailReadOnly: false,
      showVersionHistoryModal: false,
      editingMonthlyId: null,
      editingVersionId: null,
      editingHistoryVersionId: null,

      setActiveTab: (tab) => set({ activeTab: tab }),

      setSelectedProjectId: (id) => set({ selectedProjectId: id }),
      setFilters: (partial) => set((s) => ({ filters: { ...s.filters, ...partial } })),
      resetFilters: () => set({ filters: { ...DEFAULT_TECH_PROJECT_FILTERS } }),

      setHistoryVersionFilters: (partial) => set((s) => ({ historyVersionFilters: { ...s.historyVersionFilters, ...partial } })),
      resetHistoryVersionFilters: () => set({ historyVersionFilters: { ...DEFAULT_TECH_HISTORY_VERSION_FILTERS } }),

      setSelectedBudgetTypes: (types) => set({ selectedBudgetTypes: types }),

      setShowNewProjectModal: (show) => set({ showNewProjectModal: show }),
      setShowNewVersionModal: (show) => set({ showNewVersionModal: show }),
      setShowMonthlyEditModal: (show) => set({ showMonthlyEditModal: show }),
      setShowVersionDetailModal: (show) => set({ showVersionDetailModal: show }),
      setVersionDetailReadOnly: (readOnly) => set({ versionDetailReadOnly: readOnly }),
      setShowVersionHistoryModal: (show) => set({ showVersionHistoryModal: show }),
      setEditingMonthlyId: (id) => set({ editingMonthlyId: id }),
      setEditingVersionId: (id) => set({ editingVersionId: id }),
      setEditingHistoryVersionId: (id) => set({ editingHistoryVersionId: id }),

      addProject: (form) => set((s) => {
        const newProject: HrTechnicalProject = {
          id: `tp-${Date.now()}`,
          tdtName: form.tdtName,
          planningYear: form.planningYear,
          techDomain: form.techDomain,
          tmg: form.tmg,
          techTrack: form.techTrack,
          subTrack: form.subTrack,
          subTaskName: form.subTaskName,
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
        const ipmProject = getHrFormalProjectOptions('technical').find(p => p.code === ipmCode)
        if (!ipmProject) return s
        const newProjects = synchronizeProjects(s.projects.map(p => p.id === projectId
          ? { ...p, ipmProjectCode: ipmProject.code, ipmProjectName: ipmProject.name } : p))
        return { projects: newProjects, monthlyInvestments: syncMonthlyInvestments(newProjects, s.monthlyInvestments) }
      }),

      addVersion: (projectId, form) => set((s) => {
        const project = s.projects.find(p => p.id === projectId)
        if (!project) return s

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

          const milestones: TechMilestoneNodes = latest
            ? { ...latest.milestones }
            : emptyTechMilestones()

          const newVersion: HrTechnicalVersion = {
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
        if (!sourceVersion) return s

        const minorVersion = nextHrMinorVersion(project.versions, sourceVersion.budgetType)

        const newVersion: HrTechnicalVersion = {
          ...sourceVersion,
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

            const updated: HrTechnicalVersion = {
              ...v,
              batch: permitted.batch === undefined ? v.batch : permitted.batch,
              estimatedInvestment: permitted.estimatedInvestment ?? v.estimatedInvestment,
              milestones: permitted.milestones ? { ...v.milestones, ...permitted.milestones } : v.milestones,
            }

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
        return calcTechDepartmentMonthlySplit(
          version.departmentInvestments,
          version.milestones,
        )
      },
    }),
    {
      name: 'pms-hr-technical',
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as Partial<typeof current>) }
        const projects = synchronizeProjects(merged.projects)
        return { ...merged, projects, monthlyInvestments: syncMonthlyInvestments(projects, merged.monthlyInvestments) }
      },
      version: 1,
    },
  ),
)
