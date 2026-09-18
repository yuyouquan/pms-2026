import { createInlineResourceVersion, updateInlineResourceVersion, type ResourceInlineActions } from '@/lib/resourceInlineEditing'
import { seedExistingMockNonLabor } from '@/mock/nonLaborInvestment'
import { useHrConfigStore } from '@/stores/hrConfig'
import type { NonLaborInvestment } from '@/types/nonLaborInvestment'
import { cloneNonLaborInvestment, validateNonLaborInvestment } from '@/lib/nonLaborInvestment'
import { useProjectStore } from '@/stores/project'
import { canAccessHrProject, reconcileHrRegistry } from '@/lib/hrProjectRegistry'
import { preserveLockedHrMonthlyRows } from '@/lib/hrMonthlySync'
import { appendHrMockProjects, createAdditionalTechnicalProjects, createResourceTechnicalProjects, seedResourceMonthlyEdits } from '@/mock/hrInvestment'
import { changeHrVersionLifecycle, copyHrVersionSnapshot, isHrVersionEditable, canCreateHrVersion, allowedHrVersionUpdates, getHrVersionSeed, getLatestHrVersion, nextHrMinorVersion } from '@/lib/hrVersionRules'
import { normalizeHrEditedVersion, synchronizeHrProjects } from '@/lib/hrProjectSync'
import { getHrFormalProjectOptions } from '@/lib/hrFormalProjectSource'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { pmsLocalStorage } from '@/lib/mockDatasetStorage'
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
    tdr2: null,
    pdcp: null,
    tdr3x: null,
    tdcpx: null,
    tdr4: null,
    edcp: null,
  }
}

function sumDepartmentInvestments(items: TechDepartmentInvestment[]): number {
  return Math.round(items.reduce((sum, item) => sum + (Number(item.estimatedInvestment) || 0), 0) * 10) / 10
}

/** Generate monthly rows from each version's department values. */
function generateDepartmentMonthlyRecords(
  projectId: string,
  version: HrTechnicalVersion,
): TechMonthlyInvestment[] {
  const splits = calcTechDepartmentMonthlySplit(
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

const ADDITIONAL_PROJECTS = createAdditionalTechnicalProjects(getHrFormalProjectOptions('technical'))
const INITIAL_PROJECTS = createResourceTechnicalProjects()

/* ── Helpers ────────────────────────────────────────────────────────── */

/** 生成操作日志 */
function makeLog(
  operation: TechVersionOperationType,
  description: string,
  operator: string = useProjectStore.getState().currentLoginUser,
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
 * 同步月度预估投入：保留所有版本的记录，汇总由消费者按激活版本筛选。
 */

function synchronizeProjects(projects: HrTechnicalProject[]): HrTechnicalProject[] {
  return synchronizeHrProjects(projects, 'technical')
}

function syncMonthlyInvestments(projects: HrTechnicalProject[], existingMonthly: TechMonthlyInvestment[]): TechMonthlyInvestment[] {
  const generated = synchronizeProjects(projects).flatMap(project =>
    project.versions.flatMap(version => generateDepartmentMonthlyRecords(project.id, version)),
  )
  return preserveLockedHrMonthlyRows(generated, existingMonthly, projects)
}


/* ── State / Actions interfaces ────────────────────────────────────── */

export type TechTab = 'projectList' | 'monthlyInvestment' | 'historyVersion'

export interface HrTechnicalState extends ResourceInlineActions {
  registryMigrationComplete: boolean
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

  setVersionLocked: (projectId: string, versionId: string, locked: boolean) => void
  setVersionActive: (projectId: string, versionId: string, active: boolean) => void
  addVersion: (projectId: string, form: TechNewVersionForm) => void
  deleteVersion: (projectId: string, versionId: string) => void
  /** 复制版本 */
  copyVersion: (projectId: string, versionId: string) => void

  /** 行内编辑版本数据 */
  updateVersion: (
    projectId: string,
    versionId: string,
    updates: {
      nonLaborInvestment?: NonLaborInvestment
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
    nonLaborInvestment?: NonLaborInvestment,
    milestones?: Partial<TechMilestoneNodes>,
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
      registryMigrationComplete: false,
      projects: synchronizeProjects(INITIAL_PROJECTS),
      monthlyInvestments: seedResourceMonthlyEdits(syncMonthlyInvestments(INITIAL_PROJECTS, [])),
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

      setVersionLocked: (projectId, versionId, locked) => set(s => ({
        projects: changeHrVersionLifecycle(s.projects, projectId, versionId, 'lock', locked),
      })),
      setVersionActive: (projectId, versionId, active) => set(s => ({
        projects: changeHrVersionLifecycle(s.projects, projectId, versionId, 'active', active),
      })),
      createVersionInline: (projectId, budgetType, scopeId) => {
        const state = get()
        const project = state.projects.find(item => item.id === projectId)
        const version = createInlineResourceVersion('technical', project, budgetType, scopeId, useHrConfigStore.getState().data) as HrTechnicalVersion
        const projects = synchronizeProjects(state.projects.map(item => item.id === projectId ? { ...item, versions: [...item.versions, version] } : item))
        set({ projects, monthlyInvestments: syncMonthlyInvestments(projects, state.monthlyInvestments) })
        return version.id
      },
      updateVersionInline: (projectId, versionId, patch, scopeId) => {
        const state = get()
        const project = state.projects.find(item => item.id === projectId)
        const updated = updateInlineResourceVersion('technical', project, project?.versions.find(item => item.id === versionId), patch, scopeId, useHrConfigStore.getState().data) as HrTechnicalVersion
        const projects = synchronizeProjects(state.projects.map(item => item.id === projectId ? { ...item, versions: item.versions.map(version => version.id === versionId ? updated : version) } : item))
        set({ projects, monthlyInvestments: syncMonthlyInvestments(projects, state.monthlyInvestments) })
      },
      copyVersion: (projectId, versionId) => set(s => copyHrVersionSnapshot(s.projects, s.monthlyInvestments, projectId, versionId, useProjectStore.getState().currentLoginUser)),

      addVersion: (projectId, form) => set((s) => {
        if (!canAccessHrProject(s.projects.find(p => p.id === projectId), true)) return s
        const project = s.projects.find(p => p.id === projectId)
        if (!project || !canCreateHrVersion(project, form.budgetType)) return s

        const newProjects = s.projects.map(p => {
          if (p.id !== projectId) return p

          const latest = getHrVersionSeed(p.versions, form.budgetType)
          const minorVersion = nextHrMinorVersion(p.versions, form.budgetType)

          const milestones: TechMilestoneNodes = { ...(latest?.milestones ?? emptyTechMilestones()), ...form.milestones }

          const newVersion: HrTechnicalVersion = {
            id: `${projectId}-${form.budgetType}-v${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            projectId,
            budgetType: form.budgetType,
            versionNumber: `V0.${minorVersion}`,
            batch: null,
            lockState: 'unlocked',
            isActive: false,
            majorVersion: 0,
            minorVersion,
            createdBy: useProjectStore.getState().currentLoginUser,
            estimatedInvestment: sumDepartmentInvestments(form.departmentInvestments),
            milestones,
            nonLaborInvestment: validateNonLaborInvestment(form.nonLaborInvestment ?? cloneNonLaborInvestment(latest?.nonLaborInvestment), useHrConfigStore.getState().data.nonLaborSubject ?? [], latest?.nonLaborInvestment, useHrConfigStore.getState().data.techModuleDept ?? []),
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
        if (!canAccessHrProject(s.projects.find(p => p.id === projectId), true)) return s
        const targetProject = s.projects.find(p => p.id === projectId)
        if (!isHrVersionEditable(targetProject, targetProject?.versions.find(v => v.id === versionId))) return s
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
        const newProjects = s.projects.map(p => {
          if (p.id !== projectId) return p
          const newVersions = p.versions.map(v => {
            if (v.id !== versionId) return v
            const permitted = allowedHrVersionUpdates(p, v, updates)
            if (Object.keys(permitted).length === 0) return v

            const updated: HrTechnicalVersion = {
              ...v,
              nonLaborInvestment: permitted.nonLaborInvestment ? validateNonLaborInvestment(permitted.nonLaborInvestment, useHrConfigStore.getState().data.nonLaborSubject ?? [], v.nonLaborInvestment, useHrConfigStore.getState().data.techModuleDept ?? []) : v.nonLaborInvestment,
              batch: permitted.batch === undefined ? v.batch : permitted.batch,
              estimatedInvestment: permitted.estimatedInvestment ?? v.estimatedInvestment,
              milestones: permitted.milestones ? { ...v.milestones, ...permitted.milestones } : v.milestones,
            }

            const logParts: string[] = []
            if (permitted.nonLaborInvestment !== undefined) logParts.push('非人力投入')
            if (permitted.estimatedInvestment !== undefined) logParts.push('预估投入')
            if (permitted.milestones !== undefined) logParts.push('里程碑节点')
            if (logParts.length > 0) {
              updated.operationLogs = [
                ...v.operationLogs,
                makeLog('edited', `修改了 ${logParts.join('、')}`),
              ]
            }

            return normalizeHrEditedVersion(updated, 'technical')
          })
          return { ...p, versions: newVersions }
        })
        return {
          projects: synchronizeProjects(newProjects),
          monthlyInvestments: syncMonthlyInvestments(newProjects, s.monthlyInvestments),
        }
      }),

      updateVersionDepartmentInvestments: (projectId, versionId, departmentInvestments, nonLaborInvestment, milestones) => set((s) => {
        if (!canAccessHrProject(s.projects.find(p => p.id === projectId), true)) return s
        const newEstimatedTotal = departmentInvestments.reduce(
          (sum, d) => sum + (Number(d.estimatedInvestment) || 0), 0,
        )
        const newProjects = s.projects.map(p => {
          if (p.id !== projectId) return p
          const newVersions = p.versions.map(v => {
            if (v.id !== versionId || !isHrVersionEditable(p, v)) return v
            const permittedMilestones = allowedHrVersionUpdates(p, v, { milestones }).milestones
            const milestonesChanged = permittedMilestones && Object.entries(permittedMilestones).some(([key, value]) => v.milestones[key as keyof TechMilestoneNodes] !== value)
            return normalizeHrEditedVersion({
              ...v,
              milestones: permittedMilestones ? { ...v.milestones, ...permittedMilestones } : v.milestones,
              nonLaborInvestment: nonLaborInvestment ? validateNonLaborInvestment(nonLaborInvestment, useHrConfigStore.getState().data.nonLaborSubject ?? [], v.nonLaborInvestment, useHrConfigStore.getState().data.techModuleDept ?? []) : v.nonLaborInvestment,
              estimatedInvestment: Math.round(newEstimatedTotal * 10) / 10,
              departmentInvestments,
              operationLogs: [
                ...v.operationLogs,
                makeLog('deptUpdated', `更新部门预估投入（共${departmentInvestments.length}条）${milestonesChanged ? '、里程碑时间' : ''}`),
              ],
            }, 'technical')
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
        const reconciled = reconcileHrRegistry(s.projects, s.monthlyInvestments, 'technical', s.registryMigrationComplete)
        const projects = synchronizeProjects(reconciled.projects)
        const monthlyInvestments = syncMonthlyInvestments(projects, reconciled.monthlyInvestments)
        if (s.registryMigrationComplete && JSON.stringify(projects) === JSON.stringify(s.projects) && JSON.stringify(monthlyInvestments) === JSON.stringify(s.monthlyInvestments)) return s
        return { projects, monthlyInvestments, registryMigrationComplete: true }
      }),

      updateMonthlyInvestment: (monthlyId, monthlyData) => set((s) => ({
        monthlyInvestments: s.monthlyInvestments.map(mi =>
          mi.id === monthlyId && !mi.isArchived && isHrVersionEditable(s.projects.find(p => p.id === mi.projectId), s.projects.find(p => p.id === mi.projectId)?.versions.find(v => v.id === mi.versionId))
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
      storage: createJSONStorage(() => pmsLocalStorage),
      name: 'pms-hr-technical',
      migrate: (persistedState: unknown, fromVersion: number) => {
        const s = (persistedState ?? {}) as Record<string, unknown>
        if (fromVersion < 2) {
          s.projects = appendHrMockProjects((s.projects ?? []) as HrTechnicalProject[], ADDITIONAL_PROJECTS)
        }
        return s
      },
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<typeof current>
        const merged = { ...current, projects: saved.projects ?? current.projects, monthlyInvestments: saved.monthlyInvestments ?? current.monthlyInvestments, registryMigrationComplete: saved.registryMigrationComplete ?? current.registryMigrationComplete }
        const projects = synchronizeProjects(seedExistingMockNonLabor(merged.projects).map((project, index) => ({ ...project, versions: project.versions.map((version, vi) => merged.projects[index].versions[vi].lockState === 'locked' ? merged.projects[index].versions[vi] : version) })))
        return { ...merged, projects, monthlyInvestments: syncMonthlyInvestments(projects, merged.monthlyInvestments) }
      },
      version: 2,
    },
  ),
)
