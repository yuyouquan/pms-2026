'use client'

import { createInlineResourceVersion, updateInlineResourceVersion, type ResourceInlineActions } from '@/lib/resourceInlineEditing'

import { seedExistingMockNonLabor } from '@/mock/nonLaborInvestment'
import { useHrConfigStore } from '@/stores/hrConfig'
import type { NonLaborInvestment } from '@/types/nonLaborInvestment'
import { cloneNonLaborInvestment, validateNonLaborInvestment } from '@/lib/nonLaborInvestment'

import { useProjectStore } from '@/stores/project'
import { canAccessHrProject, reconcileHrRegistry } from '@/lib/hrProjectRegistry'

import { preserveLockedHrMonthlyRows } from '@/lib/hrMonthlySync'
import { appendHrMockProjects, createAdditionalCapabilityProjects, createResourceCapabilityProjects, seedResourceMonthlyEdits } from '@/mock/hrInvestment'
import { changeHrVersionLifecycle, copyHrVersionSnapshot, getActiveHrVersion, isHrVersionEditable, canCreateHrVersion, getHrVersionSeed, allowedHrVersionUpdates, getLatestHrVersion, nextHrMinorVersion } from '@/lib/hrVersionRules'
import { normalizeHrEditedVersion, synchronizeHrProjects } from '@/lib/hrProjectSync'
import { getHrFormalProjectOptions } from '@/lib/hrFormalProjectSource'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { pmsLocalStorage } from '@/lib/mockDatasetStorage'
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

interface HrCapabilityState extends ResourceInlineActions {
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

  setVersionLocked: (projectId: string, versionId: string, locked: boolean) => void
  setVersionActive: (projectId: string, versionId: string, active: boolean) => void
  addVersion: (
    projectId: string,
    form: {
      nonLaborInvestment?: NonLaborInvestment
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
    updates: Partial<Pick<HrCapabilityVersion, 'projectStartTime' | 'projectEndTime' | 'batch' | 'nonLaborInvestment'>>,
  ) => void
  updateVersionDepartmentInvestments: (
    projectId: string,
    versionId: string,
    deptInvestments: CapabilityDepartmentInvestment[],
    nonLaborInvestment?: NonLaborInvestment,
    dates?: { projectStartTime: string; projectEndTime: string },
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
    project[budgetType === 'annual' ? 'annualBudget' : budgetType] = getActiveHrVersion(project.versions, budgetType)?.estimatedInvestment ?? 0
  }
}

function syncMonthlyInvestments(projects: HrCapabilityProject[], existingMonthly: CapabilityMonthlyInvestment[]): CapabilityMonthlyInvestment[] {
  const generated = synchronizeProjects(projects).flatMap(project =>
    project.versions.flatMap(version => generateDepartmentMonthlyRecords(project, version)),
  )
  return preserveLockedHrMonthlyRows(generated, existingMonthly, projects)
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

      setVersionLocked: (projectId, versionId, locked) => set(s => ({
        projects: changeHrVersionLifecycle(s.projects, projectId, versionId, 'lock', locked),
      })),
      setVersionActive: (projectId, versionId, active) => set(s => ({
        projects: changeHrVersionLifecycle(s.projects, projectId, versionId, 'active', active),
      })),
      createVersionInline: (projectId, budgetType, scopeId) => {
        const state = get()
        const project = state.projects.find(item => item.id === projectId)
        const version = createInlineResourceVersion('capability', project, budgetType, scopeId, useHrConfigStore.getState().data) as HrCapabilityVersion
        const projects = synchronizeProjects(state.projects.map(item => item.id === projectId ? { ...item, versions: [...item.versions, version] } : item))
        set({ projects, monthlyInvestments: syncMonthlyInvestments(projects, state.monthlyInvestments) })
        return version.id
      },
      updateVersionInline: (projectId, versionId, patch, scopeId) => {
        const state = get()
        const project = state.projects.find(item => item.id === projectId)
        const updated = updateInlineResourceVersion('capability', project, project?.versions.find(item => item.id === versionId), patch, scopeId, useHrConfigStore.getState().data) as HrCapabilityVersion
        const projects = synchronizeProjects(state.projects.map(item => item.id === projectId ? { ...item, versions: item.versions.map(version => version.id === versionId ? updated : version) } : item))
        set({ projects, monthlyInvestments: syncMonthlyInvestments(projects, state.monthlyInvestments) })
      },
      copyVersion: (projectId, versionId) => set(s => copyHrVersionSnapshot(s.projects, s.monthlyInvestments, projectId, versionId, useProjectStore.getState().currentLoginUser)),

      addVersion: (projectId, form) => {
        if (!canAccessHrProject(get().projects.find(p => p.id === projectId), true)) return
        const project = get().projects.find((p) => p.id === projectId)
        if (!project || !canCreateHrVersion(project, form.budgetType)) return

        const estimatedInvestment = sumDepartmentInvestments(form.departmentInvestments)
        const majorVersion = 0
        const minorVersion = nextHrMinorVersion(project.versions, form.budgetType)
        const operator = useProjectStore.getState().currentLoginUser

        const newVersion: HrCapabilityVersion = {
          id: uid('cap-ver'),
          projectId,
          budgetType: form.budgetType,
          versionNumber: `V${majorVersion}.${minorVersion}`,
          batch: null,
          lockState: 'unlocked',
          isActive: false,
          majorVersion,
          minorVersion,
          createdBy: operator,
          estimatedInvestment,
          projectStartTime: form.projectStartTime,
          projectEndTime: form.projectEndTime,
          nonLaborInvestment: validateNonLaborInvestment(form.nonLaborInvestment ?? cloneNonLaborInvestment(getHrVersionSeed(project.versions, form.budgetType)?.nonLaborInvestment), useHrConfigStore.getState().data.nonLaborSubject ?? [], getHrVersionSeed(project.versions, form.budgetType)?.nonLaborInvestment, useHrConfigStore.getState().data.techModuleDept ?? []),
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


      deleteVersion: (projectId, versionId) => {
        if (!canAccessHrProject(get().projects.find(p => p.id === projectId), true)) return
        const targetProject = get().projects.find(p => p.id === projectId)
        if (!isHrVersionEditable(targetProject, targetProject?.versions.find(v => v.id === versionId))) return
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
            if (permitted.nonLaborInvestment) permitted.nonLaborInvestment = validateNonLaborInvestment(permitted.nonLaborInvestment, useHrConfigStore.getState().data.nonLaborSubject ?? [], version.nonLaborInvestment, useHrConfigStore.getState().data.techModuleDept ?? [])
            return normalizeHrEditedVersion({ ...version, ...permitted, operationLogs: [...version.operationLogs, makeLog('edited', useProjectStore.getState().currentLoginUser, permitted.batch !== undefined ? '更新批次' : '编辑版本信息')] }, 'capability')
          }) }
        }))
        set({ projects, monthlyInvestments: syncMonthlyInvestments(projects, get().monthlyInvestments) })
      },

      updateVersionDepartmentInvestments: (projectId, versionId, departmentInvestments, nonLaborInvestment, dates) => {
        if (dates && (!dates.projectStartTime || !dates.projectEndTime || dates.projectStartTime > dates.projectEndTime)) return
        if (!canAccessHrProject(get().projects.find(p => p.id === projectId), true)) return
        const projects = synchronizeProjects(get().projects.map(project => {
          if (project.id !== projectId) return project
          return { ...project, versions: project.versions.map(version => version.id === versionId && isHrVersionEditable(project, version)
            ? normalizeHrEditedVersion({ ...version, ...allowedHrVersionUpdates(project, version, dates ?? {}), nonLaborInvestment: nonLaborInvestment ? validateNonLaborInvestment(nonLaborInvestment, useHrConfigStore.getState().data.nonLaborSubject ?? [], version.nonLaborInvestment, useHrConfigStore.getState().data.techModuleDept ?? []) : version.nonLaborInvestment, departmentInvestments, estimatedInvestment: sumDepartmentInvestments(departmentInvestments), operationLogs: [...version.operationLogs, makeLog('deptUpdated', useProjectStore.getState().currentLoginUser, '更新部门预估投入')] }, 'capability')
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
            mi.id === monthlyId && !mi.isArchived && isHrVersionEditable(state.projects.find(p => p.id === mi.projectId), state.projects.find(p => p.id === mi.projectId)?.versions.find(v => v.id === mi.versionId))
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
        if (!version || !isHrVersionEditable(project, version)) return

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
      storage: createJSONStorage(() => pmsLocalStorage),
      name: 'pms-hr-capability',
      partialize: state => ({ projects: state.projects, monthlyInvestments: state.monthlyInvestments, registryMigrationComplete: state.registryMigrationComplete }),
      version: 2,
      migrate: (persistedState: unknown, fromVersion: number) => {
        const s = (persistedState ?? {}) as Record<string, unknown>
        if (fromVersion < 2) {
          s.projects = appendHrMockProjects((s.projects ?? []) as HrCapabilityProject[], ADDITIONAL_PROJECTS)
        }
        return s
      },
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<typeof current>
        const merged = { ...current, projects: saved.projects ?? current.projects, monthlyInvestments: saved.monthlyInvestments ?? current.monthlyInvestments, registryMigrationComplete: saved.registryMigrationComplete ?? current.registryMigrationComplete }
        const projects = synchronizeProjects(seedExistingMockNonLabor(merged.projects).map((project, index) => ({ ...project, versions: project.versions.map((version, vi) => merged.projects[index].versions[vi].lockState === 'locked' ? merged.projects[index].versions[vi] : version) })))
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
