/* ── HR Pipeline - Capability Building Project Types ────────────────── */

/** 预算类型 */
export type BudgetType = 'annual' | 'projectEstimate' | 'projectBudget'

/** 版本锁定状态 */
export type VersionLockState = 'locked' | 'unlocked'

/** 项目状态 */
export type ProjectStatus = 'active' | 'cancelled'

/** 版本操作日志类型 */
export type CapabilityVersionOperationType =
  | 'created'     // 创建
  | 'locked'      // 锁定
  | 'unlocked'    // 解锁
  | 'copied'      // 复制
  | 'deleted'     // 删除
  | 'edited'      // 编辑版本信息
  | 'deptUpdated' // 部门预估投入更新

/** 版本操作日志 */
export interface CapabilityVersionOperationLog {
  /** 记录ID */
  id: string
  /** 操作类型 */
  operation: CapabilityVersionOperationType
  /** 操作人 */
  operator: string
  /** 操作时间 */
  timestamp: string
  /** 操作描述 */
  description: string
}

/** 版本详情中的部门预估投入（无阶段列，仅预估投入） */
export interface CapabilityDepartmentInvestment {
  /** 记录ID */
  id: string
  /** 一级部门 */
  primaryDepartment: string
  /** 二级部门 */
  secondaryDepartment: string
  /** 预估投入合计（人月） */
  estimatedInvestment: number
}

/** 单项目版本 */
export interface HrCapabilityVersion {
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
  /** 创建人 */
  createdBy: string
  /** 预估投入合计（人月）= 各部门预估投入之和 */
  estimatedInvestment: number
  /** 项目开始时间 */
  projectStartTime: string
  /** 项目结束时间 */
  projectEndTime: string
  /** 版本详情：部门预估投入列表 */
  departmentInvestments: CapabilityDepartmentInvestment[]
  /** 创建时间 */
  createdAt: string
  /** 锁定时间 */
  lockedAt: string | null
  /** 操作日志 */
  operationLogs: CapabilityVersionOperationLog[]
}

/** 能力建设项目 */
export interface HrCapabilityProject {
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
  versions: HrCapabilityVersion[]
  /** 创建时间 */
  createdAt: string
}

/** 月度预估投入记录 */
export interface CapabilityMonthlyInvestment {
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
  /** 版本锁定状态 */
  versionLockState: VersionLockState
  /** 预估合计 */
  estimatedTotal: number
  /** 月度数据：key = 'YYYY-MM' → value = 人月 */
  monthlyData: Record<string, number>
  /** 是否已手动编辑 */
  isEdited: boolean
}

/** 项目列表筛选器 */
export interface CapabilityProjectListFilters {
  /** 项目名称（多选，空数组表示不筛选） */
  projectName: string[]
  /** 是否显示已取消的项目 */
  showCancelled: boolean
}

/** 项目历史版本空间筛选器（多选，空数组表示不筛选） */
export interface CapabilityHistoryVersionFilters {
  budgetType: BudgetType[]
  projectName: string[]
  projectYear: string[]
  lockState: VersionLockState[]
}

/** 新建项目表单 */
export interface CapabilityNewProjectForm {
  name: string
  projectTarget: string
}

/** 新建版本表单 */
export interface CapabilityNewVersionForm {
  budgetType: BudgetType
  projectStartTime: string
  projectEndTime: string
  departmentInvestments: CapabilityDepartmentInvestment[]
}
