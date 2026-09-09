'use client'

import { preserveHrMonthlyEdits } from '@/lib/hrMonthlySync'
import { appendHrMockProjects, createAdditionalCapabilityProjects } from '@/mock/hrInvestment'
import { canCreateHrVersion, allowedHrVersionUpdates, getLatestHrVersion, isLatestHrVersion, nextHrMinorVersion } from '@/lib/hrVersionRules'
import { synchronizeHrProjects } from '@/lib/hrProjectSync'
import { getHrFormalProjectOptions } from '@/lib/hrFormalProjectSource'
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
  calcCapabilityMonthlySplit,
} from '@/constants/hrCapability'

/* ── 工具函数 ────────────────────────────────────────────────────── */

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function nowISO(): string {
  return new Date().toISOString()
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



function synchronizeProjects(projects: HrCapabilityProject[]): HrCapabilityProject[] {
  return synchronizeHrProjects(projects, 'capability')
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
  const now = new Date().toISOString()

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

  const projects = [project1, project2, project3]

  return projects
}

const ADDITIONAL_PROJECTS = createAdditionalCapabilityProjects(getHrFormalProjectOptions('capability'))
const INITIAL_PROJECTS = [...createMockProjects(), ...ADDITIONAL_PROJECTS]

/** 从每个预算类型的最新版本生成部门月度投入记录。 */
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
      id: `${version.id}|${dept.id}`,
      projectId: project.id,
      versionId: version.id,
      primaryDepartment: dept.primaryDepartment,
      secondaryDepartment: dept.secondaryDepartment,
      budgetType: version.budgetType,
      versionNumber: version.versionNumber,
      batch: version.batch ?? null,
      versionLockState: version.lockState,
      estimatedTotal: dept.estimatedInvestment,
      monthlyData,
      isEdited: false,
    }
  })
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
  updateVersion: (
    projectId: string,
    versionId: string,
    updates: Partial<Pick<HrCapabilityVersion, 'projectStartTime' | 'projectEndTime' | 'batch'>>,
  ) => void
  updateVersionDepartmentInvestments: (
    projectId: string,
    versionId: string,
    deptInvestments: CapabilityDepartmentInvestment[],
  ) => void
  refreshFormalProjects: () => void
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
  for (const budgetType of ['annual', 'projectEstimate', 'projectBudget'] as const) {
    project[budgetType === 'annual' ? 'annualBudget' : budgetType] = getLatestHrVersion(project.versions, budgetType)?.estimatedInvestment ?? 0
  }
}

function syncMonthlyInvestments(projects: HrCapabilityProject[], existingMonthly: CapabilityMonthlyInvestment[]): CapabilityMonthlyInvestment[] {
  const generated = synchronizeProjects(projects).flatMap(project =>
    (['annual', 'projectEstimate', 'projectBudget'] as const).flatMap(budgetType => {
      const latest = getLatestHrVersion(project.versions, budgetType)
      return latest ? generateDepartmentMonthlyRecords(project, latest) : []
    }),
  )
  return preserveHrMonthlyEdits(generated, existingMonthly)
}


export const useHrCapabilityStore = create<HrCapabilityState>()(
  persist(
    (set, get) => ({
      projects: synchronizeProjects(INITIAL_PROJECTS),
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

      bindIpmProject: (projectId, code) => {
        const option = getHrFormalProjectOptions('capability').find(project => project.code === code)
        if (!option) return
        const projects = synchronizeProjects(get().projects.map(project => project.id === projectId
          ? { ...project, ipmProjectCode: option.code, ipmProjectName: option.name } : project))
        set({ projects, monthlyInvestments: syncMonthlyInvestments(projects, get().monthlyInvestments) })
      },

      addVersion: (projectId, form) => {
        const project = get().projects.find((p) => p.id === projectId)
        if (!project || !canCreateHrVersion(project, form.budgetType)) return

        const estimatedInvestment = sumDepartmentInvestments(form.departmentInvestments)
        const majorVersion = 0
        const minorVersion = nextHrMinorVersion(project.versions, form.budgetType)
        const operator = '当前用户'

        const newVersion: HrCapabilityVersion = {
          id: uid('cap-ver'),
          projectId,
          budgetType: form.budgetType,
          versionNumber: `V${majorVersion}.${minorVersion}`,
          batch: null,
          lockState: 'unlocked',
          majorVersion,
          minorVersion,
          createdBy: operator,
          estimatedInvestment,
          projectStartTime: form.projectStartTime,
          projectEndTime: form.projectEndTime,
          departmentInvestments: form.departmentInvestments.map(department => ({ ...department })),
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

        set({ projects: synchronizeProjects(updatedProjects), monthlyInvestments: syncMonthlyInvestments(updatedProjects, get().monthlyInvestments) })
      },

      copyVersion: (projectId, versionId) => {
        const project = get().projects.find((p) => p.id === projectId)
        if (!project) return
        const source = project.versions.find((v) => v.id === versionId)
        if (!source || !canCreateHrVersion(project, source.budgetType)) return

        const minorVersion = nextHrMinorVersion(project.versions, source.budgetType)
        const operator = '当前用户'

        const newVersion: HrCapabilityVersion = {
          ...source,
          createdBy: '当前用户',
          id: uid('cap-ver'),
          versionNumber: `V0.${minorVersion}`,
          batch: null,
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

        set({ projects: synchronizeProjects(updatedProjects), monthlyInvestments: syncMonthlyInvestments(updatedProjects, get().monthlyInvestments) })
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

        set({ projects: synchronizeProjects(updatedProjects), monthlyInvestments: syncMonthlyInvestments(updatedProjects, updatedMonthly) })
      },


      updateVersion: (projectId, versionId, updates) => {
        const projects = synchronizeProjects(get().projects.map(project => {
          if (project.id !== projectId) return project
          return { ...project, versions: project.versions.map(version => {
            if (version.id !== versionId) return version
            const permitted = allowedHrVersionUpdates(project, version, updates)
            if (Object.keys(permitted).length === 0) return version
            return { ...version, ...permitted, operationLogs: [...version.operationLogs, makeLog('edited', '当前用户', permitted.batch !== undefined ? '更新批次' : '编辑版本信息')] }
          }) }
        }))
        set({ projects, monthlyInvestments: syncMonthlyInvestments(projects, get().monthlyInvestments) })
      },

      updateVersionDepartmentInvestments: (projectId, versionId, departmentInvestments) => {
        const projects = synchronizeProjects(get().projects.map(project => {
          if (project.id !== projectId) return project
          return { ...project, versions: project.versions.map(version => version.id === versionId && isLatestHrVersion(project, version)
            ? { ...version, departmentInvestments, estimatedInvestment: sumDepartmentInvestments(departmentInvestments), operationLogs: [...version.operationLogs, makeLog('deptUpdated', '当前用户', '更新部门预估投入')] }
            : version) }
        }))
        set({ projects, monthlyInvestments: syncMonthlyInvestments(projects, get().monthlyInvestments) })
      },

      refreshFormalProjects: () => {
        const current = get()
        const projects = synchronizeProjects(current.projects)
        const monthlyInvestments = syncMonthlyInvestments(projects, current.monthlyInvestments)
        if (JSON.stringify(projects) !== JSON.stringify(current.projects) || JSON.stringify(monthlyInvestments) !== JSON.stringify(current.monthlyInvestments)) set({ projects, monthlyInvestments })
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
        const project = get().projects.find(project => project.id === projectId)
        if (!project) return []
        return ['annual', 'projectEstimate', 'projectBudget'].flatMap(type => {
          const latest = getLatestHrVersion(project.versions, type)
          return latest ? [latest] : []
        })
      },

      calculateMonthlySplit: (projectId, versionId) => {
        const project = get().projects.find((p) => p.id === projectId)
        if (!project) return
        const version = project.versions.find((v) => v.id === versionId)
        if (!version || !isLatestHrVersion(project, version)) return

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
      version: 2,
      migrate: (persistedState: unknown, fromVersion: number) => {
        const s = (persistedState ?? {}) as Record<string, unknown>
        if (fromVersion < 2) {
          s.projects = appendHrMockProjects((s.projects ?? []) as HrCapabilityProject[], ADDITIONAL_PROJECTS)
        }
        return s
      },
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as Partial<typeof current>) }
        const projects = synchronizeProjects(merged.projects)
        return { ...merged, projects, monthlyInvestments: syncMonthlyInvestments(projects, merged.monthlyInvestments) }
      },
      onRehydrateStorage: () => (state) => {
        if (state && state.projects.length > 0 && state.monthlyInvestments.length === 0) {
          state.monthlyInvestments = syncMonthlyInvestments(state.projects, [])
        }
      },
    },
  ),
)

// 初始化月度投入数据
if (typeof window !== 'undefined') {
  const state = useHrCapabilityStore.getState()
  if (state.monthlyInvestments.length === 0 && state.projects.length > 0) {
    state.monthlyInvestments = syncMonthlyInvestments(state.projects, [])
  }
}
