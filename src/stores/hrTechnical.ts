import { canAccessHrProject, reconcileHrRegistry } from '@/lib/hrProjectRegistry'
import { preserveHrMonthlyEdits } from '@/lib/hrMonthlySync'
import { appendHrMockProjects, createAdditionalTechnicalProjects, createResourceTechnicalProjects, seedResourceMonthlyEdits } from '@/mock/hrInvestment'
import { canCreateHrVersion, allowedHrVersionUpdates, getHrVersionSeed, getLatestHrVersion, isLatestHrVersion, nextHrMinorVersion } from '@/lib/hrVersionRules'
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

function syncMonthlyInvestments(projects: HrTechnicalProject[], existingMonthly: TechMonthlyInvestment[]): TechMonthlyInvestment[] {
  const generated = synchronizeProjects(projects).flatMap(project =>
    getLatestVersions(project).flatMap(version => generateDepartmentMonthlyRecords(project.id, version)),
  )
  return preserveHrMonthlyEdits(generated, existingMonthly)
}


/* ── State / Actions interfaces ────────────────────────────────────── */

export type TechTab = 'projectList' | 'monthlyInvestment' | 'historyVersion'

export interface HrTechnicalState {
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


      copyVersion: (projectId, versionId) => set((s) => {
        if (!canAccessHrProject(s.projects.find(p => p.id === projectId), true)) return s
        const project = s.projects.find(p => p.id === projectId)
        if (!project) return s
        const sourceVersion = project.versions.find(v => v.id === versionId)
        if (!sourceVersion || !canCreateHrVersion(project, sourceVersion.budgetType)) return s

        const minorVersion = nextHrMinorVersion(project.versions, sourceVersion.budgetType)

        const newVersion: HrTechnicalVersion = {
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
        if (!canAccessHrProject(s.projects.find(p => p.id === projectId), true)) return s
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
        if (!canAccessHrProject(s.projects.find(p => p.id === projectId), true)) return s
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
        const reconciled = reconcileHrRegistry(s.projects, s.monthlyInvestments, 'technical', s.registryMigrationComplete)
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
      migrate: (persistedState: unknown, fromVersion: number) => {
        const s = (persistedState ?? {}) as Record<string, unknown>
        if (fromVersion < 2) {
          s.projects = appendHrMockProjects((s.projects ?? []) as HrTechnicalProject[], ADDITIONAL_PROJECTS)
        }
        return s
      },
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as Partial<typeof current>) }
        const projects = synchronizeProjects(merged.projects)
        return { ...merged, projects, monthlyInvestments: syncMonthlyInvestments(projects, merged.monthlyInvestments) }
      },
      version: 2,
    },
  ),
)
