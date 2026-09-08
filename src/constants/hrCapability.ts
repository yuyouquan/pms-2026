/* ── HR Pipeline - Capability Building Project Constants ─────────────── */

import type {
  BudgetType,
  VersionLockState,
} from '@/types/hrCapability'

/** 预算类型定义 */
export const CAPABILITY_BUDGET_TYPES: { value: BudgetType; label: string }[] = [
  { value: 'annual', label: '年度预算' },
  { value: 'projectEstimate', label: '项目概算' },
  { value: 'projectBudget', label: '项目预算' },
]

/** 预算类型 → 中文标签映射 */
export const CAPABILITY_BUDGET_TYPE_LABELS: Record<BudgetType, string> = {
  annual: '年度预算',
  projectEstimate: '项目概算',
  projectBudget: '项目预算',
}

/** 预算类型 → Ant Design Tag 颜色映射 */
export const CAPABILITY_BUDGET_TYPE_COLORS: Record<BudgetType, string> = {
  annual: 'purple',
  projectEstimate: 'orange',
  projectBudget: 'green',
}

/** 预算类型 → 行背景 CSS 类名 */
export const CAPABILITY_BUDGET_TYPE_ROW_CLASS: Record<BudgetType, string> = {
  annual: 'hr-capability-budget-annual',
  projectEstimate: 'hr-capability-budget-estimate',
  projectBudget: 'hr-capability-budget-budget',
}

/** 需要绑定 IPM 编码才能创建的预算类型 */
export const CAPABILITY_IPM_REQUIRED_TYPES: BudgetType[] = ['projectEstimate', 'projectBudget']

/** IPM 未绑定提示 */
export const CAPABILITY_IPM_REQUIRED_TIP = '请先绑定正式项目编码后再创建项目概算/项目预算版本'

/** IPM 正式项目列表（能力建设项目专用） */
export const CAPABILITY_IPM_PROJECTS: { code: string; name: string }[] = [
  { code: 'IPM-CAP-001', name: '流程优化平台' },
  { code: 'IPM-CAP-002', name: '工具链建设' },
  { code: 'IPM-CAP-003', name: '技术培训体系' },
  { code: 'IPM-CAP-004', name: '质量改进项目' },
  { code: 'IPM-CAP-005', name: '组织效能提升' },
]

/** 默认筛选器 */
export const DEFAULT_CAPABILITY_PROJECT_FILTERS = {
  projectName: [] as string[],
  showCancelled: false,
}

/** 项目历史版本空间默认筛选器 */
export const DEFAULT_CAPABILITY_HISTORY_VERSION_FILTERS = {
  budgetType: [] as BudgetType[],
  projectName: [] as string[],
  projectYear: [] as string[],
  lockState: [] as VersionLockState[],
}

/** 版本锁定状态选项 */
export const CAPABILITY_LOCK_STATE_OPTIONS: { value: VersionLockState; label: string }[] = [
  { value: 'locked', label: '已锁定' },
  { value: 'unlocked', label: '编辑中' },
]

/** 项目年度选项 */
export const CAPABILITY_PROJECT_YEAR_OPTIONS: { value: string; label: string }[] = [
  { value: '2024', label: '2024' },
  { value: '2025', label: '2025' },
  { value: '2026', label: '2026' },
  { value: '2027', label: '2027' },
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

/**
 * 计算能力建设项目月度拆分（简单日均法）
 *
 * 算法：
 * 1. dailyInvestment = estimatedInvestment / (projectEndTime - projectStartTime + 1) 天
 * 2. 遍历项目周期内每一天，累加到对应月份
 * 3. 每月投入 = 当月所有日期的 dailyInvestment 之和
 * 4. 四舍五入到1位小数
 *
 * @param estimatedInvestment 预估投入总额（人月）
 * @param projectStartTime 项目开始时间 'YYYY-MM-DD'
 * @param projectEndTime 项目结束时间 'YYYY-MM-DD'
 * @returns 月度数据：key = 'YYYY-MM' → value = 人月
 */
export function calcCapabilityMonthlySplit(
  estimatedInvestment: number,
  projectStartTime: string,
  projectEndTime: string,
): Record<string, number> {
  if (!projectStartTime || !projectEndTime || estimatedInvestment <= 0) {
    return {}
  }

  const start = new Date(projectStartTime)
  const end = new Date(projectEndTime)
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
    return {}
  }

  // 总天数（含首尾）
  const totalDays = Math.round(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  ) + 1

  if (totalDays <= 0) return {}

  const dailyInvestment = estimatedInvestment / totalDays

  // 遍历每一天，累加到对应月份
  const monthlyData: Record<string, number> = {}
  const cursor = new Date(start)

  while (cursor <= end) {
    const year = cursor.getFullYear()
    const month = String(cursor.getMonth() + 1).padStart(2, '0')
    const monthKey = `${year}-${month}`
    if (!monthlyData[monthKey]) monthlyData[monthKey] = 0
    monthlyData[monthKey] += dailyInvestment
    cursor.setDate(cursor.getDate() + 1)
  }

  // 四舍五入到1位小数
  for (const key of Object.keys(monthlyData)) {
    monthlyData[key] = Math.round(monthlyData[key] * 10) / 10
  }

  return monthlyData
}
