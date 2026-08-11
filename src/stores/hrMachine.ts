import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  HrMachineProject,
  HrMachineVersion,
  MonthlyInvestment,
  ProjectListFilters,
  BudgetType,
  MachineBrand,
  MachineProductLine,
  NewProjectForm,
  MilestoneNodes,
} from '@/types/hrMachine'
import {
  DEFAULT_PROJECT_FILTERS,
  generateVersionNumber,
  BUDGET_TYPE_LABELS,
  PHASE_SPLIT_RULES,
  calcPhaseDuration,
  PROJECT_LEVELS,
  HR_MODEL_VERSIONS,
} from '@/constants/hrMachine'

/* ── Mock Data ──────────────────────────────────────────────────────── */

function createMockVersions(
  projectId: string,
  investments: { annual: number; projectEstimate: number; projectBudget: number },
  dateOffsets?: { conceptStart: string; productLaunch: string },
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
  return [
    // 年度预算：V0.1 草稿
    {
      id: `${projectId}-v01`,
      projectId,
      budgetType: 'annual',
      versionNumber: 'V0.1',
      lockState: 'unlocked',
      majorVersion: 0,
      minorVersion: 1,
      milestones,
      estimatedInvestment: investments.annual,
      createdAt: baseDate,
      lockedAt: null,
    },
    // 项目概算：V1.0 已锁定
    {
      id: `${projectId}-v02`,
      projectId,
      budgetType: 'projectEstimate',
      versionNumber: 'V1.0',
      lockState: 'locked',
      majorVersion: 1,
      minorVersion: 0,
      milestones,
      estimatedInvestment: investments.projectEstimate,
      createdAt: baseDate,
      lockedAt: '2026-01-10',
    },
    // 项目预算：V1.0 已锁定
    {
      id: `${projectId}-v03`,
      projectId,
      budgetType: 'projectBudget',
      versionNumber: 'V1.0',
      lockState: 'locked',
      majorVersion: 1,
      minorVersion: 0,
      milestones,
      estimatedInvestment: investments.projectBudget,
      createdAt: baseDate,
      lockedAt: '2026-01-12',
    },
  ]
}

function createMockMonthlyData(
  startDate: string,
  endDate: string,
  totalInvestment: number,
): Record<string, number> {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
  const dailyRate = totalInvestment / totalDays

  const result: Record<string, number> = {}
  const current = new Date(start)
  while (current <= end) {
    // Count days in current month
    const monthStart = new Date(current.getFullYear(), current.getMonth(), 1)
    const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0)
    const periodStart = current < monthStart ? monthStart : current
    const periodEnd = end < monthEnd ? end : monthEnd
    const daysInPeriod = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`
    result[key] = Math.round(dailyRate * daysInPeriod * 10) / 10

    // Move to next month
    current.setMonth(current.getMonth() + 1)
    current.setDate(1)
  }
  return result
}

const MOCK_PROJECTS: HrMachineProject[] = [
  {
    id: 'mp-001',
    name: 'CO9m-X6895',
    brand: 'TECNO',
    productLine: 'CAMON',
    projectLevel: 'S',
    levelCoefficient: 1,
    hrModelVersion: 'V2026.1',
    status: 'active',
    annualBudget: 120,
    projectEstimate: 115,
    projectBudget: 110,
    projectAccounting: 80,
    versions: createMockVersions('mp-001', { annual: 120, projectEstimate: 115, projectBudget: 110 }),
    createdAt: '2026-01-02',
  },
  {
    id: 'mp-002',
    name: 'NOTE40-Pro',
    brand: 'Infinix',
    productLine: 'NOTE',
    projectLevel: 'A',
    levelCoefficient: 0.8,
    hrModelVersion: 'V2026.1',
    status: 'active',
    annualBudget: 96,
    projectEstimate: 92,
    projectBudget: 88,
    projectAccounting: 45,
    versions: createMockVersions('mp-002', { annual: 96, projectEstimate: 92, projectBudget: 88 }, { conceptStart: '2026-02-01', productLaunch: '2026-12-15' }),
    createdAt: '2026-02-01',
  },
  {
    id: 'mp-003',
    name: 'SPARK30-Lite',
    brand: 'TECNO',
    productLine: 'SPARK',
    projectLevel: 'B',
    levelCoefficient: 0.6,
    hrModelVersion: 'V2025.4',
    status: 'cancelled',
    annualBudget: 72,
    projectEstimate: 69,
    projectBudget: 66,
    projectAccounting: 30,
    versions: createMockVersions('mp-003', { annual: 72, projectEstimate: 69, projectBudget: 66 }, { conceptStart: '2026-01-15', productLaunch: '2026-10-30' }),
    createdAt: '2026-01-15',
  },
  {
    id: 'mp-004',
    name: 'GT30-Ultra',
    brand: 'Infinix',
    productLine: 'GT',
    projectLevel: 'S',
    levelCoefficient: 1.2,
    hrModelVersion: 'V2026.2',
    status: 'active',
    annualBudget: 144,
    projectEstimate: 138,
    projectBudget: 132,
    projectAccounting: 95,
    versions: createMockVersions('mp-004', { annual: 144, projectEstimate: 138, projectBudget: 132 }, { conceptStart: '2026-01-10', productLaunch: '2026-11-20' }),
    createdAt: '2026-01-10',
  },
  {
    id: 'mp-005',
    name: 'HOT50-Play',
    brand: 'itel',
    productLine: 'HOT',
    projectLevel: 'C',
    levelCoefficient: 0.4,
    hrModelVersion: 'V2025.4',
    status: 'active',
    annualBudget: 48,
    projectEstimate: 46,
    projectBudget: 44,
    projectAccounting: 20,
    versions: createMockVersions('mp-005', { annual: 48, projectEstimate: 46, projectBudget: 44 }, { conceptStart: '2026-03-01', productLaunch: '2026-12-20' }),
    createdAt: '2026-03-01',
  },
]

function createMockMonthlyInvestments(): MonthlyInvestment[] {
  const investments: MonthlyInvestment[] = []
  for (const project of MOCK_PROJECTS) {
    const lockedVersions = project.versions.filter(v => v.lockState === 'locked')
    if (lockedVersions.length === 0) continue
    // Use first locked version per budget type
    const seenTypes = new Set<BudgetType>()
    for (const version of lockedVersions) {
      if (seenTypes.has(version.budgetType)) continue
      seenTypes.add(version.budgetType)
      const monthlyData = createMockMonthlyData(
        version.milestones.conceptStart || '2026-01-01',
        version.milestones.productLaunch || '2026-11-30',
        version.estimatedInvestment,
      )
      investments.push({
        id: `mi-${project.id}-${version.id}`,
        projectId: project.id,
        versionId: version.id,
        primaryDepartment: '研发中心',
        secondaryDepartment: '产品部',
        budgetType: version.budgetType,
        versionNumber: version.versionNumber,
        estimatedTotal: version.estimatedInvestment,
        monthlyData,
        isEdited: false,
      })
    }
  }
  return investments
}

/* ── State / Actions interfaces ────────────────────────────────────── */

export type MachineTab = 'projectList' | 'monthlyInvestment'

export interface HrMachineState {
  /** All machine projects */
  projects: HrMachineProject[]
  /** Monthly investments */
  monthlyInvestments: MonthlyInvestment[]
  /** Currently selected project (for detail view) */
  selectedProjectId: string | null
  /** Active top-level tab */
  activeTab: MachineTab
  /** Project list filters */
  filters: ProjectListFilters
  /** Budget type filter for single project space */
  selectedBudgetTypes: BudgetType[]
  /** Modal visibility */
  showNewProjectModal: boolean
  showNewVersionModal: boolean
  showMonthlyEditModal: boolean
  /** Currently editing monthly investment id */
  editingMonthlyId: string | null
}

export interface HrMachineActions {
  /** Tab switching */
  setActiveTab: (tab: MachineTab) => void

  /** Project list operations */
  setSelectedProjectId: (id: string | null) => void
  setFilters: (partial: Partial<ProjectListFilters>) => void
  resetFilters: () => void

  /** Budget type selection */
  setSelectedBudgetTypes: (types: BudgetType[]) => void

  /** Modal controls */
  setShowNewProjectModal: (show: boolean) => void
  setShowNewVersionModal: (show: boolean) => void
  setShowMonthlyEditModal: (show: boolean) => void

  /** CRUD */
  addProject: (form: NewProjectForm) => void
  deleteProject: (projectId: string) => void
  cancelProject: (projectId: string) => void
  restoreProject: (projectId: string) => void

  addVersion: (projectId: string, budgetType: BudgetType) => void
  deleteVersion: (projectId: string, versionId: string) => void
  lockVersion: (projectId: string, versionId: string) => void

  updateMonthlyInvestment: (monthlyId: string, monthlyData: Record<string, number>) => void
  setEditingMonthlyId: (id: string | null) => void

  /** Get latest locked version per budget type for a project */
  getLatestLockedVersions: (projectId: string) => HrMachineVersion[]

  /** Calculate monthly split for a version */
  calculateMonthlySplit: (version: HrMachineVersion) => Record<string, number>
}

/* ── Store ─────────────────────────────────────────────────────────── */

const ALL_BUDGET_TYPES: BudgetType[] = ['annual', 'projectEstimate', 'projectBudget']

export const useHrMachineStore = create<HrMachineState & HrMachineActions>()(
  persist(
    (set, get) => ({
      projects: MOCK_PROJECTS,
      monthlyInvestments: createMockMonthlyInvestments(),
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
          projectLevel: form.projectLevel,
          levelCoefficient: form.levelCoefficient,
          hrModelVersion: form.hrModelVersion,
          status: 'active',
          annualBudget: 0,
          projectEstimate: 0,
          projectBudget: 0,
          projectAccounting: 0,
          versions: [],
          createdAt: new Date().toISOString().split('T')[0],
        }
        return { projects: [...s.projects, newProject], showNewProjectModal: false }
      }),

      deleteProject: (projectId) => set((s) => ({
        projects: s.projects.filter(p => p.id !== projectId),
        selectedProjectId: null,
      })),

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

      addVersion: (projectId, budgetType) => set((s) => ({
        projects: s.projects.map(p => {
          if (p.id !== projectId) return p
          // Find existing versions for this budget type
          const typeVersions = p.versions
            .filter(v => v.budgetType === budgetType)
            .sort((a, b) => b.majorVersion - a.majorVersion || b.minorVersion - a.minorVersion)
          const latest = typeVersions[0]
          let majorVersion: number
          let minorVersion: number
          if (!latest) {
            // First version
            majorVersion = 0
            minorVersion = 1
          } else if (latest.lockState === 'locked') {
            // Same major version, start from minor 1 (e.g., after V1.0 lock → V1.1)
            majorVersion = latest.majorVersion
            minorVersion = 1
          } else {
            // Increment minor version
            majorVersion = latest.majorVersion
            minorVersion = latest.minorVersion + 1
          }
          const newVersion: HrMachineVersion = {
            id: `${projectId}-v${Date.now()}`,
            projectId,
            budgetType,
            versionNumber: generateVersionNumber(majorVersion, minorVersion),
            lockState: 'unlocked',
            majorVersion,
            minorVersion,
            milestones: {
              conceptStart: null,
              str1: null,
              str3: null,
              str4: null,
              str5: null,
              productLaunch: null,
            },
            estimatedInvestment: 0,
            createdAt: new Date().toISOString().split('T')[0],
            lockedAt: null,
          }
          return { ...p, versions: [...p.versions, newVersion] }
        }),
        showNewVersionModal: false,
      })),

      deleteVersion: (projectId, versionId) => set((s) => ({
        projects: s.projects.map(p => {
          if (p.id !== projectId) return p
          const newVersions = p.versions.filter(v => v.id !== versionId)
          // If all versions deleted, delete the project
          if (newVersions.length === 0) {
            return p // Keep the project but with empty versions; caller handles deletion
          }
          return { ...p, versions: newVersions }
        }),
      })),

      lockVersion: (projectId, versionId) => set((s) => ({
        projects: s.projects.map(p => {
          if (p.id !== projectId) return p
          const targetVersion = p.versions.find(v => v.id === versionId)
          if (!targetVersion || targetVersion.lockState === 'locked') return p
          // Lock this version and make older versions read-only
          const newVersions = p.versions.map(v => {
            if (v.id === versionId) {
              const newMajor = v.majorVersion + 1
              return {
                ...v,
                lockState: 'locked' as const,
                majorVersion: newMajor,
                minorVersion: 0,
                versionNumber: generateVersionNumber(newMajor, 0),
                lockedAt: new Date().toISOString().split('T')[0],
              }
            }
            return v
          })
          return { ...p, versions: newVersions }
        }),
      })),

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

      getLatestLockedVersions: (projectId) => {
        const project = get().projects.find(p => p.id === projectId)
        if (!project) return []
        const lockedVersions = project.versions.filter(v => v.lockState === 'locked')
        const seenTypes = new Set<BudgetType>()
        const result: HrMachineVersion[] = []
        // Sort by major version desc, then minor desc
        const sorted = [...lockedVersions].sort((a, b) =>
          b.majorVersion - a.majorVersion || b.minorVersion - a.minorVersion,
        )
        for (const v of sorted) {
          if (!seenTypes.has(v.budgetType)) {
            seenTypes.add(v.budgetType)
            result.push(v)
          }
        }
        return result
      },

      calculateMonthlySplit: (version) => {
        const result: Record<string, number> = {}
        for (const rule of PHASE_SPLIT_RULES) {
          const startVal = version.milestones[rule.startField as keyof MilestoneNodes]
          const endVal = version.milestones[rule.endField as keyof MilestoneNodes]
          if (!startVal || !endVal) continue
          const duration = calcPhaseDuration(startVal, endVal)
          if (duration <= 0) continue
          // Phase investment = total estimated / 5 phases (simplified)
          const phaseInvestment = version.estimatedInvestment / PHASE_SPLIT_RULES.length
          const dailyRate = phaseInvestment / duration
          // Distribute to months
          const start = new Date(startVal)
          const end = new Date(endVal)
          const current = new Date(start)
          while (current <= end) {
            const monthStart = new Date(current.getFullYear(), current.getMonth(), 1)
            const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0)
            const periodStart = current < monthStart ? monthStart : current
            const periodEnd = end < monthEnd ? end : monthEnd
            const daysInPeriod = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
            const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`
            result[key] = (result[key] || 0) + Math.round(dailyRate * daysInPeriod * 10) / 10
            current.setMonth(current.getMonth() + 1)
            current.setDate(1)
          }
        }
        return result
      },
    }),
    { name: 'pms-hr-machine', version: 2 },
  ),
)
