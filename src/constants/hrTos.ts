/* ── HR Pipeline - tOS Project Constants ─────────────────────────── */

import type { BudgetType, TosMilestoneNodes, TosPhaseKey, VersionLockState } from '@/types/hrTos'

/** 预算类型定义 */
export const TOS_BUDGET_TYPES: { value: BudgetType; label: string }[] = [
  { value: 'annual', label: '年度预算' },
  { value: 'projectEstimate', label: '项目概算' },
  { value: 'projectBudget', label: '项目预算' },
]

/** 预算类型 → 中文标签映射 */
export const TOS_BUDGET_TYPE_LABELS: Record<BudgetType, string> = {
  annual: '年度预算',
  projectEstimate: '项目概算',
  projectBudget: '项目预算',
}

/** 预算类型 → Ant Design Tag 颜色映射 */
export const TOS_BUDGET_TYPE_COLORS: Record<BudgetType, string> = {
  annual: 'purple',
  projectEstimate: 'orange',
  projectBudget: 'green',
}

/** 预算类型 → 行背景 CSS 类名 */
export const TOS_BUDGET_TYPE_ROW_CLASS: Record<BudgetType, string> = {
  annual: 'hr-tos-budget-annual',
  projectEstimate: 'hr-tos-budget-estimate',
  projectBudget: 'hr-tos-budget-budget',
}

/** 需要绑定 IPM 编码才能创建的预算类型 */
export const TOS_IPM_REQUIRED_TYPES: BudgetType[] = ['projectEstimate', 'projectBudget']

/** IPM 未绑定提示 */
export const TOS_IPM_REQUIRED_TIP = '请先绑定正式项目编码后再创建项目概算/项目预算版本'

/** 里程碑字段定义（与整机产品项目不同） */
export const TOS_MILESTONE_FIELDS: { key: keyof TosMilestoneNodes; label: string }[] = [
  { key: 'planningKO', label: '规划KO' },
  { key: 'conceptStart', label: '概念启动' },
  { key: 'str1', label: 'STR1' },
  { key: 'str3', label: 'STR3' },
  { key: 'str5', label: 'STR5' },
  { key: 'marketIteration', label: '上市迭代' },
  { key: 'maintenanceEnd', label: '维护结束' },
]

/** tOS 阶段预估投入字段定义（用于版本详情表格列、模板下载、导入解析） */
export const TOS_PHASE_INVESTMENT_FIELDS: { key: TosPhaseKey; label: string }[] = [
  { key: 'planningPhase', label: '规划阶段' },
  { key: 'conceptPhase', label: '概念阶段' },
  { key: 'planningPhase2', label: '计划阶段' },
  { key: 'developmentValidationPhase', label: '开发验证阶段' },
  { key: 'marketIterationPhase', label: '上市迭代阶段' },
  { key: 'maintenancePhase', label: '维护阶段' },
]

/** IPM 正式项目列表（tOS 专用） */
export const TOS_IPM_PROJECTS: { code: string; name: string }[] = [
  { code: 'IPM-TOS-001', name: 'tOS-平台V1.0' },
  { code: 'IPM-TOS-002', name: 'tOS-框架升级' },
  { code: 'IPM-TOS-003', name: 'tOS-组件库' },
  { code: 'IPM-TOS-004', name: 'tOS-性能优化' },
  { code: 'IPM-TOS-005', name: 'tOS-安全加固' },
]

/** 默认筛选器 */
export const DEFAULT_TOS_PROJECT_FILTERS = {
  projectName: [] as string[],
  showCancelled: false,
}

/** 项目历史版本空间默认筛选器 */
export const DEFAULT_TOS_HISTORY_VERSION_FILTERS = {
  budgetType: [] as BudgetType[],
  projectName: [] as string[],
  lockState: [] as VersionLockState[],
}

/** 版本锁定状态选项 */
export const TOS_LOCK_STATE_OPTIONS: { value: VersionLockState; label: string }[] = [
  { value: 'locked', label: '已锁定' },
  { value: 'unlocked', label: '编辑中' },
]

/** 格式化人月 */
export function formatPersonMonth(value: number | undefined | null): string {
  if (!value) return '0'
  if (Number.isInteger(value)) return String(value)
  return value.toFixed(1)
}

/** 格式化百分比 */
export function formatPercent(value: number): string {
  if (value === 0) return '0%'
  return `${(value * 100).toFixed(1)}%`
}

/** 计算阶段工期（天数，包含首尾日期 +1） */
export function calcTosPhaseDuration(startDate: string | null, endDate: string | null): number {
  if (!startDate || !endDate) return 0
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diff = end.getTime() - start.getTime()
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)) + 1)
}

/** tOS 阶段拆分规则（6个阶段，与整机产品项目的6个阶段不同） */
export interface TosPhaseSplitRule {
  label: string
  startField: keyof TosMilestoneNodes
  endField: keyof TosMilestoneNodes
  configKey: string
}

export const TOS_PHASE_SPLIT_RULES: TosPhaseSplitRule[] = [
  { label: '规划阶段', startField: 'planningKO', endField: 'conceptStart', configKey: 'planningPhase' },
  { label: '概念阶段', startField: 'conceptStart', endField: 'str1', configKey: 'conceptPhase' },
  { label: '计划阶段', startField: 'str1', endField: 'str3', configKey: 'planningPhase2' },
  { label: '开发验证阶段', startField: 'str3', endField: 'str5', configKey: 'developmentValidationPhase' },
  { label: '上市迭代阶段', startField: 'str5', endField: 'marketIteration', configKey: 'marketIterationPhase' },
  { label: '维护阶段', startField: 'marketIteration', endField: 'maintenanceEnd', configKey: 'maintenancePhase' },
]
