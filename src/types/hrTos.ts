/* ── HR Pipeline - tOS Project Types ───────────────────────────────── */

/** 预算类型 */
export type BudgetType = 'annual' | 'projectEstimate' | 'projectBudget'

/** 旧数据兼容字段，不再用于控制编辑 */
export type VersionLockState = 'locked' | 'unlocked'

/** 项目状态 */
export type ProjectStatus = 'active' | 'cancelled' | 'paused'

/** tOS 里程碑节点（与整机产品项目不同） */
export interface TosMilestoneNodes {
  /** 规划KO */
  planningKO: string | null
  /** 概念启动 */
  conceptStart: string | null
  /** STR1 */
  str1: string | null
  /** STR3 */
  str3: string | null
  /** STR5 */
  str5: string | null
  /** 上市迭代 */
  marketIteration: string | null
  /** 维护结束 */
  maintenanceEnd: string | null
}

/** tOS 阶段预估投入字段 key（对应 TosDepartmentInvestment 中的阶段字段） */
export type TosPhaseKey =
  | 'planningPhase'
  | 'conceptPhase'
  | 'planningPhase2'
  | 'developmentValidationPhase'
  | 'marketIterationPhase'
  | 'maintenancePhase'

/** 版本详情中的部门预估投入 */
export interface TosDepartmentInvestment {
  /** 记录ID */
  id: string
  /** 一级部门 */
  primaryDepartment: string
  /** 二级部门 */
  secondaryDepartment: string
  /** 预估投入合计（人月）= 各阶段预估投入之和 */
  estimatedInvestment: number
  /** 规划阶段预估投入 */
  planningPhase: number
  /** 概念阶段预估投入 */
  conceptPhase: number
  /** 计划阶段预估投入 */
  planningPhase2: number
  /** 开发验证阶段预估投入 */
  developmentValidationPhase: number
  /** 上市迭代阶段预估投入 */
  marketIterationPhase: number
  /** 维护阶段预估投入 */
  maintenancePhase: number
}

/** 版本操作日志类型 */
export type TosVersionOperationType =
  | 'created'     // 创建
  | 'locked'      // 锁定
  | 'unlocked'    // 解锁
  | 'copied'      // 复制
  | 'deleted'     // 删除
  | 'edited'      // 编辑版本信息
  | 'deptUpdated' // 部门预估投入更新

/** 版本操作日志 */
export interface TosVersionOperationLog {
  /** 记录ID */
  id: string
  /** 操作类型 */
  operation: TosVersionOperationType
  /** 操作人 */
  operator: string
  /** 操作时间 */
  timestamp: string
  /** 操作描述 */
  description: string
}

/** 单项目版本 */
export interface HrTosVersion {
  id: string
  projectId: string
  /** 预算类型 */
  budgetType: BudgetType
  /** 版本号，如 V0.1、V0.2 */
  versionNumber: string
  /** 所属批次，所有历史版本均可更新 */
  batch?: number | null
  /** 旧数据兼容字段，不再用于控制编辑 */
  lockState: VersionLockState
  /** 兼容旧数据的大版本字段；当前编号固定为 0 */
  majorVersion: number
  /** 小版本号 */
  minorVersion: number
  /** 创建人 */
  createdBy: string
  /** 预估投入合计（人月）= 各部门预估投入之和 */
  estimatedInvestment: number
  /** 里程碑节点 */
  milestones: TosMilestoneNodes
  /** 版本详情：部门预估投入列表 */
  departmentInvestments: TosDepartmentInvestment[]
  /** 创建时间 */
  createdAt: string
  /** 锁定时间 */
  lockedAt: string | null
  /** 操作日志 */
  operationLogs: TosVersionOperationLog[]
}

/** tOS 项目 */
export interface HrTosProject {
  pmsProjectId?: string
  migrationIssue?: string
  legacyHrSnapshot?: unknown
  id: string
  /** 项目名称 */
  name: string
  /** 项目目标 */
  projectTarget: string
  /** 正式项目编码（IPM） */
  ipmProjectCode: string | null
  /** 正式项目名称（IPM） */
  ipmProjectName: string | null
  /** 项目状态 */
  status: ProjectStatus
  /** 年度预算（来自最新版本） */
  annualBudget: number
  /** 项目概算（来自最新版本） */
  projectEstimate: number
  /** 项目预算（来自最新版本） */
  projectBudget: number
  /** 项目核算 */
  projectAccounting: number
  /** 版本列表 */
  versions: HrTosVersion[]
  /** 创建时间 */
  createdAt: string
}

/** 月度预估投入记录 */
export interface TosMonthlyInvestment {
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
  /** 所属批次，所有历史版本均可更新 */
  batch?: number | null
  /** 旧数据兼容字段，不再用于控制编辑 */
  versionLockState: VersionLockState
  /** 预估合计 */
  estimatedTotal: number
  /** 月度数据：key = 'YYYY-MM' → value = 人月 */
  monthlyData: Record<string, number>
  /** 是否已手动编辑 */
  isEdited: boolean
  /** Removed source rows remain archived for manual-data restoration, excluded from active totals. */
  isArchived?: boolean
}

/** 项目列表筛选器 */
export interface TosProjectListFilters {
  /** 项目名称（多选，空数组表示不筛选） */
  projectName: string[]
  /** 是否显示已取消/暂停的项目 */
  showCancelled: boolean
}

/** 项目历史版本空间筛选器（多选，空数组表示不筛选） */
export interface TosHistoryVersionFilters {
  budgetType: BudgetType[]
  projectName: string[]
  lockState: VersionLockState[]
}

/** 新建项目表单 */
export interface TosNewProjectForm {
  name: string
  projectTarget: string
}

/** 新建版本表单 */
export interface TosNewVersionForm {
  budgetType: BudgetType
  departmentInvestments: TosDepartmentInvestment[]
}
