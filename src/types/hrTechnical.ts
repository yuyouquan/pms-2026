/* ── HR Pipeline - Technical Project Types ──────────────────────────── */

/** 预算类型 */
export type BudgetType = 'annual' | 'projectEstimate' | 'projectBudget'

/** 版本锁定状态 */
export type VersionLockState = 'locked' | 'unlocked'

/** 项目状态 */
export type ProjectStatus = 'active' | 'cancelled' | 'paused'

/** 技术项目 里程碑节点（6个，与 tOS 7个不同） */
export interface TechMilestoneNodes {
  /** 规划启动 */
  planningStart: string | null
  /** Charter DCP */
  charterDCP: string | null
  /** TDR1 */
  tdr1: string | null
  /** PDCP */
  pdcp: string | null
  /** TDCP-X */
  tdcpx: string | null
  /** EDCP */
  edcp: string | null
}

/** 技术项目 阶段预估投入字段 key（5个阶段） */
export type TechPhaseKey =
  | 'planningPhase'
  | 'conceptPhase'
  | 'planPhase'
  | 'developmentPhase'
  | 'migrationPhase'

/** 版本详情中的部门预估投入 */
export interface TechDepartmentInvestment {
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
  planPhase: number
  /** 开发验证阶段预估投入 */
  developmentPhase: number
  /** 迁移阶段预估投入 */
  migrationPhase: number
}

/** 版本操作日志类型 */
export type TechVersionOperationType =
  | 'created'     // 创建
  | 'locked'      // 锁定
  | 'unlocked'    // 解锁
  | 'copied'      // 复制
  | 'deleted'     // 删除
  | 'edited'      // 编辑版本信息
  | 'deptUpdated' // 部门预估投入更新

/** 版本操作日志 */
export interface TechVersionOperationLog {
  /** 记录ID */
  id: string
  /** 操作类型 */
  operation: TechVersionOperationType
  /** 操作人 */
  operator: string
  /** 操作时间 */
  timestamp: string
  /** 操作描述 */
  description: string
}

/** 单项目版本 */
export interface HrTechnicalVersion {
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
  /** 里程碑节点 */
  milestones: TechMilestoneNodes
  /** 版本详情：部门预估投入列表 */
  departmentInvestments: TechDepartmentInvestment[]
  /** 创建时间 */
  createdAt: string
  /** 锁定时间 */
  lockedAt: string | null
  /** 操作日志 */
  operationLogs: TechVersionOperationLog[]
}

/** 技术项目 */
export interface HrTechnicalProject {
  id: string
  /** TDT项目名称 */
  tdtName: string
  /** 规划年度 */
  planningYear: string
  /** 技术领域 */
  techDomain: string
  /** TMG及领域 */
  tmg: string
  /** 技术赛道 */
  techTrack: string
  /** 子赛道 */
  subTrack: string
  /** 子任务名称 */
  subTaskName: string
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
  versions: HrTechnicalVersion[]
  /** 创建时间 */
  createdAt: string
}

/** 月度预估投入记录 */
export interface TechMonthlyInvestment {
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
export interface TechProjectListFilters {
  /** 规划年度（多选，空数组表示不筛选） */
  planningYear: string[]
  /** 技术领域（多选） */
  techDomain: string[]
  /** TMG及领域（多选） */
  tmg: string[]
  /** 技术赛道（多选） */
  techTrack: string[]
  /** 子赛道（多选） */
  subTrack: string[]
  /** 子任务名称（多选） */
  subTaskName: string[]
  /** 是否显示已取消/暂停的项目 */
  showCancelled: boolean
}

/** 项目历史版本空间筛选器（多选，空数组表示不筛选） */
export interface TechHistoryVersionFilters {
  budgetType: BudgetType[]
  projectName: string[]
  lockState: VersionLockState[]
}

/** 新建项目表单 */
export interface TechNewProjectForm {
  tdtName: string
  planningYear: string
  techDomain: string
  tmg: string
  techTrack: string
  subTrack: string
  subTaskName: string
}

/** 新建版本表单 */
export interface TechNewVersionForm {
  budgetType: BudgetType
  departmentInvestments: TechDepartmentInvestment[]
}
