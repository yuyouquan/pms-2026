/* ── HR Machine Project Types ──────────────────────────────────────── */

/** 品牌 */
export type MachineBrand = 'TECNO' | 'Infinix' | 'itel'

/** 产品线 */
export type MachineProductLine =
  | 'CAMON' | 'NOTE' | 'GT' | 'POVE'
  | 'SPARK' | 'HOT' | 'S' | 'P' | 'A' | 'CITY'

/** 预算类型 */
export type BudgetType = 'annual' | 'projectEstimate' | 'projectBudget'

/** 版本状态 */
export type VersionLockState = 'unlocked' | 'locked'

/** 项目状态 */
export type MachineProjectStatus = 'active' | 'cancelled'

/** 里程碑节点 */
export interface MilestoneNodes {
  /** 概念启动 */
  conceptStart: string | null
  /** STR1 */
  str1: string | null
  /** STR3 */
  str3: string | null
  /** STR4 */
  str4: string | null
  /** STR5 */
  str5: string | null
  /** 产品上市 */
  productLaunch: string | null
}

/** 单项目版本 */
export interface HrMachineVersion {
  id: string
  projectId: string
  /** 预算类型 */
  budgetType: BudgetType
  /** 版本号，如 V0.1, V1.0, V2.3 */
  versionNumber: string
  /** 版本锁定状态 */
  lockState: VersionLockState
  /** 大版本号，锁定后递增 */
  majorVersion: number
  /** 小版本号 */
  minorVersion: number
  /** 里程碑节点 */
  milestones: MilestoneNodes
  /** 预估投入（人月） */
  estimatedInvestment: number
  /** 创建时间 */
  createdAt: string
  /** 锁定时间 */
  lockedAt: string | null
}

/** 整机产品项目 */
export interface HrMachineProject {
  id: string
  /** 项目名称 */
  name: string
  /** 品牌 */
  brand: MachineBrand
  /** 产品线 */
  productLine: MachineProductLine
  /** 项目等级（来源配置中心） */
  projectLevel: string
  /** 等级系数 */
  levelCoefficient: number
  /** 人力模型版本（来源配置中心） */
  hrModelVersion: string
  /** 项目状态 */
  status: MachineProjectStatus
  /** 年度预算 */
  annualBudget: number
  /** 项目概算 */
  projectEstimate: number
  /** 项目预算 */
  projectBudget: number
  /** 项目核算（总投入） */
  projectAccounting: number
  /** 版本列表 */
  versions: HrMachineVersion[]
  /** 创建时间 */
  createdAt: string
}

/** 月度预估投入 */
export interface MonthlyInvestment {
  id: string
  projectId: string
  versionId: string
  /** 一级部门 */
  primaryDepartment: string
  /** 二级部门 */
  secondaryDepartment: string
  /** 预算类型 */
  budgetType: BudgetType
  /** 版本号 */
  versionNumber: string
  /** 预估合计 */
  estimatedTotal: number
  /** 月度投入：key = 'YYYY-MM' → value = 人月 */
  monthlyData: Record<string, number>
  /** 是否被手动编辑过 */
  isEdited: boolean
}

/** 项目列表筛选器 */
export interface ProjectListFilters {
  brand: MachineBrand | 'all'
  productLine: MachineProductLine | 'all'
  projectName: string
  showCancelled: boolean
}

/** 新建项目表单 */
export interface NewProjectForm {
  name: string
  brand: MachineBrand
  productLine: MachineProductLine
  projectLevel: string
  levelCoefficient: number
  hrModelVersion: string
}

/** 新建版本表单 */
export interface NewVersionForm {
  budgetType: BudgetType
}

/** 月度编辑表单 */
export interface MonthlyEditForm {
  monthlyData: Record<string, number>
}
