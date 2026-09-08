'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  HrCapabilityProject,
  HrCapabilityVersion,
  CapabilityDepartmentInvestment,
  CapabilityMonthlyInvestment,
  CapabilityVersionOperationLog,
  CapabilityVersionOperationType,
  BudgetType,
  CapabilityProjectListFilters,
  CapabilityHistoryVersionFilters,
} from '@/types/hrCapability'
import {
  DEFAULT_CAPABILITY_PROJECT_FILTERS,
  DEFAULT_CAPABILITY_HISTORY_VERSION_FILTERS,
  CAPABILITY_IPM_PROJECTS,
  calcCapabilityMonthlySplit,
} from '@/constants/hrCapability'

/* ── 工具函数 ────────────────────────────────────────────────────── */

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function nowISO(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function makeLog(
  operation: CapabilityVersionOperationType,
  operator: string,
  description: string,
): CapabilityVersionOperationLog {
  return {
    id: uid('log'),
    operation,
    operator,
    timestamp: nowISO(),
    description,
  }
}

function sumDepartmentInvestments(deptInvestments: CapabilityDepartmentInvestment[]): number {
  return Math.round(
    deptInvestments.reduce((sum, d) => sum + (Number(d.estimatedInvestment) || 0), 0) * 10,
  ) / 10
}

function getLatestVersion(versions: HrCapabilityVersion[]): HrCapabilityVersion | undefined {
  if (versions.length === 0) return undefined
  // 按 majorVersion 降序，再按 minorVersion 降序
  const sorted = [...versions].sort((a, b) => {
    if (b.majorVersion !== a.majorVersion) return b.majorVersion - a.majorVersion
    return b.minorVersion - a.minorVersion
  })
  return sorted[0]
}

function getLatestLockedVersion(versions: HrCapabilityVersion[]): HrCapabilityVersion | undefined {
  const locked = versions.filter((v) => v.lockState === 'locked')
  return getLatestVersion(locked)
}

/* ── Mock 数据生成 ────────────────────────────────────────────────── */

function createMockDepartmentInvestments(): CapabilityDepartmentInvestment[] {
  const departments: [string, string, number][] = [
    ['研发中心', '软件工程部', 30],
    ['研发中心', '测试与质量部', 15],
    ['产品中心', '产品管理部', 10],
    ['运营中心', '流程管理部', 8],
    ['人力资源', '培训发展部', 12],
  ]
  return departments.map(([primary, secondary, est], i) => ({
    id: `cap-di-mock-${i}`,
    primaryDepartment: primary,
    secondaryDepartment: secondary,
    estimatedInvestment: est,
  }))
}

function createMockVersion(
  projectId: string,
  budgetType: BudgetType,
  majorVersion: number,
  minorVersion: number,
  lockState: 'locked' | 'unlocked',
  startOffsetDays: number,
  durationDays: number,
  createdBy: string,
): HrCapabilityVersion {
  const departmentInvestments = createMockDepartmentInvestments()
  const estimatedInvestment = sumDepartmentInvestments(departmentInvestments)

  const startDate = new Date()
  startDate.setDate(startDate.getDate() + startOffsetDays)
  const projectStartTime = startDate.toISOString().slice(0, 10)

  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + durationDays)
  const projectEndTime = endDate.toISOString().slice(0, 10)

  const createdAt = new Date(startDate)
  createdAt.setDate(createdAt.getDate() - 7)

  const logs: CapabilityVersionOperationLog[] = [
    makeLog('created', createdBy, `创建版本，预算类型：${budgetType === 'annual' ? '年度预算' : budgetType === 'projectEstimate' ? '项目概算' : '项目预算'}`),
  ]
  if (lockState === 'locked') {
    const lockDate = new Date(createdAt)
    lockDate.setDate(lockDate.getDate() + 3)
    logs.push(makeLog('locked', createdBy, '版本锁定'))
  }

  return {
    id: uid('cap-ver'),
    projectId,
    budgetType,
    versionNumber: `V${majorVersion}.${minorVersion}`,
    lockState,
    majorVersion,
    minorVersion,
    createdBy,
    estimatedInvestment,
    projectStartTime,
    projectEndTime,
    departmentInvestments,
    createdAt: createdAt.toISOString().replace('T', ' ').slice(0, 19),
    lockedAt: lockState === 'locked' ? logs[1].timestamp : null,
    operationLogs: logs,
  }
}

function createMockProjects(): HrCapabilityProject[] {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

  const project1: HrCapabilityProject = {
    id: 'cap-proj-001',
    name: '研发流程标准化建设',
    projectTarget: '建立统一的研发流程标准，覆盖需求、设计、开发、测试、发布全生命周期，提升研发效率20%',
    ipmProjectCode: 'IPM-CAP-001',
    ipmProjectName: '流程优化平台',
    status: 'active',
    annualBudget: 0,
    projectEstimate: 0,
    projectBudget: 0,
    projectAccounting: 60,
    versions: [
      createMockVersion('cap-proj-001', 'annual', 1, 0, 'locked', -180, 365, '张明'),
      createMockVersion('cap-proj-001', 'projectEstimate', 1, 0, 'locked', -90, 180, '李芳'),
      createMockVersion('cap-proj-001', 'projectBudget', 0, 1, 'unlocked', -60, 120, '王强'),
    ],
    createdAt: now,
  }

  const project2: HrCapabilityProject = {
    id: 'cap-proj-002',
    name: '自动化测试平台建设',
    projectTarget: '搭建自动化测试平台，实现接口、UI、性能自动化测试一体化，降低回归测试成本50%',
    ipmProjectCode: 'IPM-CAP-002',
    ipmProjectName: '工具链建设',
    status: 'active',
    annualBudget: 0,
    projectEstimate: 0,
    projectBudget: 0,
    projectAccounting: 45,
    versions: [
      createMockVersion('cap-proj-002', 'annual', 1, 0, 'locked', -150, 300, '陈静'),
      createMockVersion('cap-proj-002', 'projectEstimate', 0, 1, 'unlocked', -30, 150, '陈静'),
    ],
    createdAt: now,
  }

  const project3: HrCapabilityProject = {
    id: 'cap-proj-003',
    name: '技术人才培养体系',
    projectTarget: '构建技术人才梯队培养体系，覆盖初级到高级工程师的能力模型、课程体系和认证标准',
    ipmProjectCode: null,
    ipmProjectName: null,
    status: 'active',
    annualBudget: 0,
    projectEstimate: 0,
    projectBudget: 0,
    projectAccounting: 0,
    versions: [
      createMockVersion('cap-proj-003', 'annual', 0, 1, 'unlocked', 0, 365, '刘洋'),
    ],
    createdAt: now,
  }

  // 同步项目级预算字段
  const projects = [project1, project2, project3]
  for (const p of projects) {
    const latest = getLatestVersion(p.versions)
    if (latest) {
      if (latest.budgetType === 'annual') p.annualBudget = latest.estimatedInvestment
      if (latest.budgetType === 'projectEstimate') p.projectEstimate = latest.estimatedInvestment
      if (latest.budgetType === 'projectBudget') p.projectBudget = latest.estimatedInvestment
    }
  }

  return projects
}

/** 从最新已锁定版本生成月度投入记录 */
function generateDepartmentMonthlyRecords(
  project: HrCapabilityProject,
  version: HrCapabilityVersion,
): CapabilityMonthlyInvestment[] {
  return version.departmentInvestments.map((dept) => {
    const monthlyData = calcCapabilityMonthlySplit(
      dept.estimatedInvestment,
      version.projectStartTime,
      version.projectEndTime,
    )
    return {
      id: uid('cap-mi'),
      projectId: project.id,
      versionId: version.id,
      primaryDepartment: dept.primaryDepartment,
      secondaryDepartment: dept.secondaryDepartment,
      budgetType: version.budgetType,
      versionNumber: version.versionNumber,
      versionLockState: version.lockState,
      estimatedTotal: dept.estimatedInvestment,
      monthlyData,
      isEdited: false,
    }
  })
}

function createMockMonthlyInvestments(projects: HrCapabilityProject[]): CapabilityMonthlyInvestment[] {
  const records: CapabilityMonthlyInvestment[] = []
  for (const p of projects) {
    // 每种预算类型取最新已锁定版本
    const budgetTypes: BudgetType[] = ['annual', 'projectEstimate', 'projectBudget']
    for (const bt of budgetTypes) {
      const versionsOfType = p.versions.filter((v) => v.budgetType === bt)
      const latestLocked = getLatestLockedVersion(versionsOfType)
      if (latestLocked) {
        records.push(...generateDepartmentMonthlyRecords(p, latestLocked))
      }
    }
  }
  return records
}

/* ── Store 定义 ───────────────────────────────────────────────────── */

interface HrCapabilityState {
  projects: HrCapabilityProject[]
  monthlyInvestments: CapabilityMonthlyInvestment[]

  selectedProjectId: string | null
  activeTab: string

  filters: CapabilityProjectListFilters
  historyVersionFilters: CapabilityHistoryVersionFilters

  // 弹窗控制
  showNewProjectModal: boolean
  showNewVersionModal: boolean
  showVersionDetailModal: boolean
  showMonthlyEditModal: boolean
  showVersionHistoryModal: boolean
  versionDetailReadOnly: boolean

  editingVersionId: string | null
  editingMonthlyId: string | null
  historyVersionId: string | null

  // 操作
  addProject: (form: { name: string; projectTarget: string }) => void
  deleteProject: (projectId: string) => void
  cancelProject: (projectId: string) => void
  restoreProject: (projectId: string) => void
  bindIpmProject: (projectId: string, code: string, name: string) => void

  addVersion: (
    projectId: string,
    form: {
      budgetType: BudgetType
      projectStartTime: string
      projectEndTime: string
      departmentInvestments: CapabilityDepartmentInvestment[]
    },
  ) => void
  copyVersion: (projectId: string, versionId: string) => void
  deleteVersion: (projectId: string, versionId: string) => void
  lockVersion: (projectId: string, versionId: string) => void
  unlockVersion: (projectId: string, versionId: string) => void
  updateVersion: (
    projectId: string,
    versionId: string,
    updates: Partial<Pick<HrCapabilityVersion, 'projectStartTime' | 'projectEndTime'>>,
  ) => void
  updateVersionDepartmentInvestments: (
    projectId: string,
    versionId: string,
    deptInvestments: CapabilityDepartmentInvestment[],
  ) => void
  updateMonthlyInvestment: (monthlyId: string, monthlyData: Record<string, number>) => void

  getLatestVersions: (projectId: string) => HrCapabilityVersion[]
  calculateMonthlySplit: (projectId: string, versionId: string) => void

  // 弹窗 setter
  setShowNewProjectModal: (v: boolean) => void
  setShowNewVersionModal: (v: boolean) => void
  setShowVersionDetailModal: (v: boolean) => void
  setShowMonthlyEditModal: (v: boolean) => void
  setShowVersionHistoryModal: (v: boolean) => void
  setVersionDetailReadOnly: (v: boolean) => void
  setEditingVersionId: (v: string | null) => void
  setEditingMonthlyId: (v: string | null) => void
  setHistoryVersionId: (v: string | null) => void
  setSelectedProjectId: (v: string | null) => void
  setActiveTab: (v: string) => void
  setFilters: (v: Partial<CapabilityProjectListFilters>) => void
  setHistoryVersionFilters: (v: Partial<CapabilityHistoryVersionFilters>) => void
}

function syncProjectBudgetFields(project: HrCapabilityProject): void {
  const latest = getLatestVersion(project.versions)
  project.annualBudget = 0
  project.projectEstimate = 0
  project.projectBudget = 0
  if (!latest) return
  if (latest.budgetType === 'annual') project.annualBudget = latest.estimatedInvestment
  if (latest.budgetType === 'projectEstimate') project.projectEstimate = latest.estimatedInvestment
  if (latest.budgetType === 'projectBudget') project.projectBudget = latest.estimatedInvestment
}

function syncMonthlyInvestments(
  projects: HrCapabilityProject[],
  existingMonthly: CapabilityMonthlyInvestment[],
): CapabilityMonthlyInvestment[] {
  const records: CapabilityMonthlyInvestment[] = []
  for (const p of projects) {
    const budgetTypes: BudgetType[] = ['annual', 'projectEstimate', 'projectBudget']
    for (const bt of budgetTypes) {
      const versionsOfType = p.versions.filter((v) => v.budgetType === bt)
      const latestLocked = getLatestLockedVersion(versionsOfType)
      if (latestLocked) {
        // 保留已手动编辑的记录
        const existing = existingMonthly.find(
          (mi) => mi.projectId === p.id && mi.versionId === latestLocked.id,
        )
        if (existing) {
          records.push(existing)
        } else {
          records.push(...generateDepartmentMonthlyRecords(p, latestLocked))
        }
      }
    }
  }
  return records
}

export const useHrCapabilityStore = create<HrCapabilityState>()(
  persist(
    (set, get) => ({
      projects: createMockProjects(),
      monthlyInvestments: [],

      selectedProjectId: null,
      activeTab: 'projectList',

      filters: { ...DEFAULT_CAPABILITY_PROJECT_FILTERS },
      historyVersionFilters: { ...DEFAULT_CAPABILITY_HISTORY_VERSION_FILTERS },

      showNewProjectModal: false,
      showNewVersionModal: false,
      showVersionDetailModal: false,
      showMonthlyEditModal: false,
      showVersionHistoryModal: false,
      versionDetailReadOnly: false,

      editingVersionId: null,
      editingMonthlyId: null,
      historyVersionId: null,

      addProject: (form) => {
        const now = nowISO()
        const newProject: HrCapabilityProject = {
          id: uid('cap-proj'),
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
          createdAt: now,
        }
        set((state) => ({ projects: [...state.projects, newProject] }))
      },

      deleteProject: (projectId) => {
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== projectId),
          monthlyInvestments: state.monthlyInvestments.filter((mi) => mi.projectId !== projectId),
        }))
      },

      cancelProject: (projectId) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, status: 'cancelled' as const } : p,
          ),
        }))
      },

      restoreProject: (projectId) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, status: 'active' as const } : p,
          ),
        }))
      },

      bindIpmProject: (projectId, code, name) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? { ...p, ipmProjectCode: code, ipmProjectName: name }
              : p,
          ),
        }))
      },

      addVersion: (projectId, form) => {
        const project = get().projects.find((p) => p.id === projectId)
        if (!project) return

        const estimatedInvestment = sumDepartmentInvestments(form.departmentInvestments)
        const majorVersion = 0
        const minorVersion = project.versions.length + 1
        const operator = '当前用户'

        const newVersion: HrCapabilityVersion = {
          id: uid('cap-ver'),
          projectId,
          budgetType: form.budgetType,
          versionNumber: `V${majorVersion}.${minorVersion}`,
          lockState: 'unlocked',
          majorVersion,
          minorVersion,
          createdBy: operator,
          estimatedInvestment,
          projectStartTime: form.projectStartTime,
          projectEndTime: form.projectEndTime,
          departmentInvestments: form.departmentInvestments,
          createdAt: nowISO(),
          lockedAt: null,
          operationLogs: [
            makeLog('created', operator, `创建版本，预算类型：${form.budgetType}`),
          ],
        }

        const updatedProjects = get().projects.map((p) => {
          if (p.id !== projectId) return p
          const updated = { ...p, versions: [...p.versions, newVersion] }
          syncProjectBudgetFields(updated)
          return updated
        })

        set({ projects: updatedProjects })
      },

      copyVersion: (projectId, versionId) => {
        const project = get().projects.find((p) => p.id === projectId)
        if (!project) return
        const source = project.versions.find((v) => v.id === versionId)
        if (!source) return

        const minorVersion = project.versions.length + 1
        const operator = '当前用户'

        const newVersion: HrCapabilityVersion = {
          ...source,
          id: uid('cap-ver'),
          versionNumber: `V0.${minorVersion}`,
          lockState: 'unlocked',
          majorVersion: 0,
          minorVersion,
          createdAt: nowISO(),
          lockedAt: null,
          operationLogs: [
            makeLog('copied', operator, `从版本 ${source.versionNumber} 复制`),
            makeLog('created', operator, `创建版本（复制来源：${source.versionNumber}）`),
          ],
          departmentInvestments: source.departmentInvestments.map((d) => ({
            ...d,
            id: uid('cap-di'),
          })),
        }

        const updatedProjects = get().projects.map((p) => {
          if (p.id !== projectId) return p
          const updated = { ...p, versions: [...p.versions, newVersion] }
          syncProjectBudgetFields(updated)
          return updated
        })

        set({ projects: updatedProjects })
      },

      deleteVersion: (projectId, versionId) => {
        const updatedProjects = get().projects.map((p) => {
          if (p.id !== projectId) return p
          const updated = {
            ...p,
            versions: p.versions.filter((v) => v.id !== versionId),
          }
          syncProjectBudgetFields(updated)
          return updated
        })

        const updatedMonthly = get().monthlyInvestments.filter(
          (mi) => mi.versionId !== versionId,
        )

        set({ projects: updatedProjects, monthlyInvestments: updatedMonthly })
      },

      lockVersion: (projectId, versionId) => {
        const project = get().projects.find((p) => p.id === projectId)
        if (!project) return
        const version = project.versions.find((v) => v.id === versionId)
        if (!version || version.lockState === 'locked') return

        const operator = '当前用户'
        const newMajor = version.majorVersion + 1
        const newMinor = 0

        const updatedProjects = get().projects.map((p) => {
          if (p.id !== projectId) return p
          const updated = {
            ...p,
            versions: p.versions.map((v) =>
              v.id === versionId
                ? {
                    ...v,
                    lockState: 'locked' as const,
                    majorVersion: newMajor,
                    minorVersion: newMinor,
                    versionNumber: `V${newMajor}.${newMinor}`,
                    lockedAt: nowISO(),
                    operationLogs: [
                      ...v.operationLogs,
                      makeLog('locked', operator, `版本锁定，版本号升级为 V${newMajor}.${newMinor}`),
                    ],
                  }
                : v,
            ),
          }
          syncProjectBudgetFields(updated)
          return updated
        })

        // 同步月度投入
        const updatedMonthly = syncMonthlyInvestments(updatedProjects, get().monthlyInvestments)

        set({ projects: updatedProjects, monthlyInvestments: updatedMonthly })
      },

      unlockVersion: (projectId, versionId) => {
        const project = get().projects.find((p) => p.id === projectId)
        if (!project) return
        const version = project.versions.find((v) => v.id === versionId)
        if (!version || version.lockState !== 'locked') return

        const operator = '当前用户'

        const updatedProjects = get().projects.map((p) => {
          if (p.id !== projectId) return p
          const updated = {
            ...p,
            versions: p.versions.map((v) =>
              v.id === versionId
                ? {
                    ...v,
                    lockState: 'unlocked' as const,
                    majorVersion: 0,
                    minorVersion: v.minorVersion > 0 ? v.minorVersion : 1,
                    versionNumber: `V0.${v.minorVersion > 0 ? v.minorVersion : 1}`,
                    lockedAt: null,
                    operationLogs: [
                      ...v.operationLogs,
                      makeLog('unlocked', operator, '版本解锁'),
                    ],
                  }
                : v,
            ),
          }
          syncProjectBudgetFields(updated)
          return updated
        })

        // 同步月度投入
        const updatedMonthly = syncMonthlyInvestments(updatedProjects, get().monthlyInvestments)

        set({ projects: updatedProjects, monthlyInvestments: updatedMonthly })
      },

      updateVersion: (projectId, versionId, updates) => {
        const operator = '当前用户'
        const updatedProjects = get().projects.map((p) => {
          if (p.id !== projectId) return p
          return {
            ...p,
            versions: p.versions.map((v) =>
              v.id === versionId
                ? {
                    ...v,
                    ...updates,
                    operationLogs: [
                      ...v.operationLogs,
                      makeLog('edited', operator, '编辑版本信息'),
                    ],
                  }
                : v,
            ),
          }
        })
        set({ projects: updatedProjects })
      },

      updateVersionDepartmentInvestments: (projectId, versionId, deptInvestments) => {
        const operator = '当前用户'
        const newEstimated = sumDepartmentInvestments(deptInvestments)

        const updatedProjects = get().projects.map((p) => {
          if (p.id !== projectId) return p
          const updated = {
            ...p,
            versions: p.versions.map((v) =>
              v.id === versionId
                ? {
                    ...v,
                    departmentInvestments: deptInvestments,
                    estimatedInvestment: newEstimated,
                    operationLogs: [
                      ...v.operationLogs,
                      makeLog('deptUpdated', operator, `部门预估投入更新，合计：${newEstimated}`),
                    ],
                  }
                : v,
            ),
          }
          syncProjectBudgetFields(updated)
          return updated
        })

        set({ projects: updatedProjects })
      },

      updateMonthlyInvestment: (monthlyId, monthlyData) => {
        set((state) => ({
          monthlyInvestments: state.monthlyInvestments.map((mi) =>
            mi.id === monthlyId
              ? { ...mi, monthlyData, isEdited: true }
              : mi,
          ),
        }))
      },

      getLatestVersions: (projectId) => {
        const project = get().projects.find((p) => p.id === projectId)
        if (!project) return []
        const byBudgetType: Record<string, HrCapabilityVersion> = {}
        for (const v of project.versions) {
          const key = v.budgetType
          if (!byBudgetType[key]) {
            byBudgetType[key] = v
            continue
          }
          const existing = byBudgetType[key]
          if (
            v.majorVersion > existing.majorVersion ||
            (v.majorVersion === existing.majorVersion && v.minorVersion > existing.minorVersion)
          ) {
            byBudgetType[key] = v
          }
        }
        return Object.values(byBudgetType)
      },

      calculateMonthlySplit: (projectId, versionId) => {
        const project = get().projects.find((p) => p.id === projectId)
        if (!project) return
        const version = project.versions.find((v) => v.id === versionId)
        if (!version || version.lockState !== 'locked') return

        const newRecords = generateDepartmentMonthlyRecords(project, version)
        const otherRecords = get().monthlyInvestments.filter(
          (mi) => mi.versionId !== versionId,
        )
        set({ monthlyInvestments: [...otherRecords, ...newRecords] })
      },

      setShowNewProjectModal: (v) => set({ showNewProjectModal: v }),
      setShowNewVersionModal: (v) => set({ showNewVersionModal: v }),
      setShowVersionDetailModal: (v) => set({ showVersionDetailModal: v }),
      setShowMonthlyEditModal: (v) => set({ showMonthlyEditModal: v }),
      setShowVersionHistoryModal: (v) => set({ showVersionHistoryModal: v }),
      setVersionDetailReadOnly: (v) => set({ versionDetailReadOnly: v }),
      setEditingVersionId: (v) => set({ editingVersionId: v }),
      setEditingMonthlyId: (v) => set({ editingMonthlyId: v }),
      setHistoryVersionId: (v) => set({ historyVersionId: v }),
      setSelectedProjectId: (v) => set({ selectedProjectId: v }),
      setActiveTab: (v) => set({ activeTab: v }),
      setFilters: (v) => set((state) => ({ filters: { ...state.filters, ...v } })),
      setHistoryVersionFilters: (v) =>
        set((state) => ({ historyVersionFilters: { ...state.historyVersionFilters, ...v } })),
    }),
    {
      name: 'pms-hr-capability',
      version: 1,
      onRehydrateStorage: () => (state) => {
        if (state && state.projects.length > 0 && state.monthlyInvestments.length === 0) {
          state.monthlyInvestments = createMockMonthlyInvestments(state.projects)
        }
      },
    },
  ),
)

// 初始化月度投入数据
if (typeof window !== 'undefined') {
  const state = useHrCapabilityStore.getState()
  if (state.monthlyInvestments.length === 0 && state.projects.length > 0) {
    state.monthlyInvestments = createMockMonthlyInvestments(state.projects)
  }
}
