'use client'

import { canAccessHrProject, reconcileHrRegistry } from '@/lib/hrProjectRegistry'

import { preserveHrMonthlyEdits } from '@/lib/hrMonthlySync'
import { appendHrMockProjects, createAdditionalCapabilityProjects, createResourceCapabilityProjects, seedResourceMonthlyEdits } from '@/mock/hrInvestment'
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

const ADDITIONAL_PROJECTS = createAdditionalCapabilityProjects(getHrFormalProjectOptions('capability'))
const INITIAL_PROJECTS = createResourceCapabilityProjects()

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
  registryMigrationComplete: boolean
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
      registryMigrationComplete: false,
      projects: synchronizeProjects(INITIAL_PROJECTS),
      monthlyInvestments: seedResourceMonthlyEdits(syncMonthlyInvestments(INITIAL_PROJECTS, [])),

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

      addProject: () => { throw new Error('请在项目管理 → 项目配置中管理项目档案') },

      deleteProject: () => { throw new Error('请在项目管理 → 项目配置中管理项目档案') },

      cancelProject: (projectId) => {
        if (!canAccessHrProject(get().projects.find(p => p.id === projectId), true)) return
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId && canAccessHrProject(p, true) ? { ...p, status: 'cancelled' as const } : p,
          ),
        }))
      },

      restoreProject: (projectId) => {
        if (!canAccessHrProject(get().projects.find(p => p.id === projectId), true)) return
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId && canAccessHrProject(p, true) ? { ...p, status: 'active' as const } : p,
          ),
        }))
      },

      bindIpmProject: () => { throw new Error('请在项目管理 → 项目配置中管理项目档案') },

      addVersion: (projectId, form) => {
        if (!canAccessHrProject(get().projects.find(p => p.id === projectId), true)) return
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
        if (!canAccessHrProject(get().projects.find(p => p.id === projectId), true)) return
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
        if (!canAccessHrProject(get().projects.find(p => p.id === projectId), true)) return
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
        if (!canAccessHrProject(get().projects.find(p => p.id === projectId), true)) return
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
        if (!canAccessHrProject(get().projects.find(p => p.id === projectId), true)) return
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
        const reconciled = reconcileHrRegistry(current.projects, current.monthlyInvestments, 'capability', current.registryMigrationComplete)
        const projects = synchronizeProjects(reconciled.projects)
        const monthlyInvestments = syncMonthlyInvestments(projects, reconciled.monthlyInvestments)
        if (!current.registryMigrationComplete || JSON.stringify(projects) !== JSON.stringify(current.projects) || JSON.stringify(monthlyInvestments) !== JSON.stringify(current.monthlyInvestments)) set({ projects, monthlyInvestments, registryMigrationComplete: true })
      },

      updateMonthlyInvestment: (monthlyId, monthlyData) => {
        set((state) => ({
          monthlyInvestments: state.monthlyInvestments.map((mi) =>
            mi.id === monthlyId && !mi.isArchived && canAccessHrProject(state.projects.find(p => p.id === mi.projectId), true)
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
        if (!canAccessHrProject(get().projects.find(p => p.id === projectId), true)) return
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
