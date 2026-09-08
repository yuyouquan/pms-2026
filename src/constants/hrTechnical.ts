/* ── HR Pipeline - Technical Project Constants ──────────────────────── */

import type { BudgetType, TechMilestoneNodes, TechPhaseKey, VersionLockState } from '@/types/hrTechnical'

/** 预算类型定义 */
export const TECH_BUDGET_TYPES: { value: BudgetType; label: string }[] = [
  { value: 'annual', label: '年度预算' },
  { value: 'projectEstimate', label: '项目概算' },
  { value: 'projectBudget', label: '项目预算' },
]

/** 预算类型 → 中文标签映射 */
export const TECH_BUDGET_TYPE_LABELS: Record<BudgetType, string> = {
  annual: '年度预算',
  projectEstimate: '项目概算',
  projectBudget: '项目预算',
}

/** 预算类型 → Ant Design Tag 颜色映射 */
export const TECH_BUDGET_TYPE_COLORS: Record<BudgetType, string> = {
  annual: 'purple',
  projectEstimate: 'orange',
  projectBudget: 'green',
}

/** 预算类型 → 行背景 CSS 类名 */
export const TECH_BUDGET_TYPE_ROW_CLASS: Record<BudgetType, string> = {
  annual: 'hr-tech-budget-annual',
  projectEstimate: 'hr-tech-budget-estimate',
  projectBudget: 'hr-tech-budget-budget',
}

/** 需要绑定 IPM 编码才能创建的预算类型 */
export const TECH_IPM_REQUIRED_TYPES: BudgetType[] = ['projectEstimate', 'projectBudget']

/** IPM 未绑定提示 */
export const TECH_IPM_REQUIRED_TIP = '请先绑定正式项目编码后再创建项目概算/项目预算版本'

/** 里程碑字段定义（6个，与 tOS 7个不同） */
export const TECH_MILESTONE_FIELDS: { key: keyof TechMilestoneNodes; label: string }[] = [
  { key: 'planningStart', label: '规划启动' },
  { key: 'charterDCP', label: 'Charter DCP' },
  { key: 'tdr1', label: 'TDR1' },
  { key: 'pdcp', label: 'PDCP' },
  { key: 'tdcpx', label: 'TDCP-X' },
  { key: 'edcp', label: 'EDCP' },
]

/** 技术项目 阶段预估投入字段定义（5个阶段） */
export const TECH_PHASE_INVESTMENT_FIELDS: { key: TechPhaseKey; label: string }[] = [
  { key: 'planningPhase', label: '规划阶段' },
  { key: 'conceptPhase', label: '概念阶段' },
  { key: 'planPhase', label: '计划阶段' },
  { key: 'developmentPhase', label: '开发验证阶段' },
  { key: 'migrationPhase', label: '迁移阶段' },
]

/** IPM 正式项目列表（技术项目专用） */
export const TECH_IPM_PROJECTS: { code: string; name: string }[] = [
  { code: 'IPM-TECH-001', name: '摄像头驱动平台' },
  { code: 'IPM-TECH-002', name: '显示驱动升级' },
  { code: 'IPM-TECH-003', name: '电源管理优化' },
  { code: 'IPM-TECH-004', name: '射频调试平台' },
  { code: 'IPM-TECH-005', name: 'AI推理框架' },
]

/** 默认筛选器 */
export const DEFAULT_TECH_PROJECT_FILTERS = {
  planningYear: [] as string[],
  techDomain: [] as string[],
  tmg: [] as string[],
  techTrack: [] as string[],
  subTrack: [] as string[],
  subTaskName: [] as string[],
  showCancelled: false,
}

/** 项目历史版本空间默认筛选器 */
export const DEFAULT_TECH_HISTORY_VERSION_FILTERS = {
  budgetType: [] as BudgetType[],
  projectName: [] as string[],
  lockState: [] as VersionLockState[],
}

/** 版本锁定状态选项 */
export const TECH_LOCK_STATE_OPTIONS: { value: VersionLockState; label: string }[] = [
  { value: 'locked', label: '已锁定' },
  { value: 'unlocked', label: '编辑中' },
]

/** 规划年度选项 */
export const TECH_PLANNING_YEAR_OPTIONS: { value: string; label: string }[] = [
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

/** 计算阶段工期（天数，包含首尾日期 +1） */
export function calcTechPhaseDuration(startDate: string | null, endDate: string | null): number {
  if (!startDate || !endDate) return 0
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diff = end.getTime() - start.getTime()
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)) + 1)
}

/** 技术项目 阶段拆分规则（5个阶段） */
export interface TechPhaseSplitRule {
  label: string
  startField: keyof TechMilestoneNodes
  endField: keyof TechMilestoneNodes
  configKey: string
}

export const TECH_PHASE_SPLIT_RULES: TechPhaseSplitRule[] = [
  { label: '规划阶段', startField: 'planningStart', endField: 'charterDCP', configKey: 'planningPhase' },
  { label: '概念阶段', startField: 'charterDCP', endField: 'tdr1', configKey: 'conceptPhase' },
  { label: '计划阶段', startField: 'tdr1', endField: 'pdcp', configKey: 'planPhase' },
  { label: '开发验证阶段', startField: 'pdcp', endField: 'tdcpx', configKey: 'developmentPhase' },
  { label: '迁移阶段', startField: 'tdcpx', endField: 'edcp', configKey: 'migrationPhase' },
]
