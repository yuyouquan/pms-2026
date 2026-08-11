/* ── HR Machine Project Constants ──────────────────────────────────── */

import type {
  MachineBrand,
  MachineProductLine,
  BudgetType,
  IpmProject,
} from '@/types/hrMachine'

/** 品牌选项 */
export const MACHINE_BRANDS: { value: MachineBrand; label: string }[] = [
  { value: 'TECNO', label: 'TECNO' },
  { value: 'Infinix', label: 'Infinix' },
  { value: 'itel', label: 'itel' },
]

/** 产品线选项 */
export const MACHINE_PRODUCT_LINES: { value: MachineProductLine; label: string }[] = [
  { value: 'CAMON', label: 'CAMON' },
  { value: 'NOTE', label: 'NOTE' },
  { value: 'GT', label: 'GT' },
  { value: 'POVE', label: 'POVE' },
  { value: 'SPARK', label: 'SPARK' },
  { value: 'HOT', label: 'HOT' },
  { value: 'S', label: 'S' },
  { value: 'P', label: 'P' },
  { value: 'A', label: 'A' },
  { value: 'CITY', label: 'CITY' },
]

/** 预算类型选项 */
export const BUDGET_TYPES: { value: BudgetType; label: string }[] = [
  { value: 'annual', label: '年度预算' },
  { value: 'projectEstimate', label: '项目概算' },
  { value: 'projectBudget', label: '项目预算' },
]

/** 预算类型标签映射 */
export const BUDGET_TYPE_LABELS: Record<BudgetType, string> = {
  annual: '年度预算',
  projectEstimate: '项目概算',
  projectBudget: '项目预算',
}

/** 项目等级选项（来源配置中心，此处为占位） */
export const PROJECT_LEVELS = ['S', 'A', 'B', 'C', 'D']

/** 人力模型版本选项（来源配置中心，此处为占位） */
export const HR_MODEL_VERSIONS = ['V2026.1', 'V2026.2', 'V2025.4']

/** 项目年份选项（来源配置中心） */
export const PROJECT_YEARS = [
  '25年立项26年结项',
  '26年立项26年结项',
  '26年立项27年结项',
]

/** IPM正式项目列表（mock，来源IPM系统） */
export const IPM_PROJECTS: IpmProject[] = [
  { code: 'IPM-2025-001', name: 'CO9m-X6895 整机项目' },
  { code: 'IPM-2025-002', name: 'NOTE40-Pro 整机项目' },
  { code: 'IPM-2025-003', name: 'SPARK30-Lite 整机项目' },
  { code: 'IPM-2026-001', name: 'GT30-Ultra 整机项目' },
  { code: 'IPM-2026-002', name: 'HOT50-Play 整机项目' },
  { code: 'IPM-2026-003', name: 'CAMON30-Pro 整机项目' },
  { code: 'IPM-2026-004', name: 'S25-X6920 整机项目' },
  { code: 'IPM-2026-005', name: 'P40-Pro 整机项目' },
]

/** 里程碑字段定义 */
export const MILESTONE_FIELDS = [
  { key: 'conceptStart', label: '概念启动' },
  { key: 'str1', label: 'STR1' },
  { key: 'str3', label: 'STR3' },
  { key: 'str4', label: 'STR4' },
  { key: 'str5', label: 'STR5' },
  { key: 'productLaunch', label: '产品上市' },
] as const

/** 项目列表列定义 */
export const PROJECT_LIST_COLUMNS = [
  { key: 'name', label: '项目名称', width: 200, fixed: 'left' as const },
  { key: 'brand', label: '品牌', width: 100 },
  { key: 'productLine', label: '产品线', width: 100 },
  { key: 'projectLevel', label: '项目等级', width: 100 },
  { key: 'annualBudget', label: '年度预算', width: 120, align: 'right' as const },
  { key: 'projectEstimate', label: '项目概算', width: 120, align: 'right' as const },
  { key: 'projectBudget', label: '项目预算', width: 120, align: 'right' as const },
  { key: 'projectAccounting', label: '项目核算', width: 120, align: 'right' as const },
  { key: 'budgetUsageRate', label: '预算使用率', width: 120, align: 'right' as const },
]

/** 单项目版本列表列定义 */
export const VERSION_LIST_COLUMNS = [
  { key: 'name', label: '项目名称', width: 150, fixed: 'left' as const },
  { key: 'brand', label: '品牌', width: 80 },
  { key: 'productLine', label: '产品线', width: 80 },
  { key: 'projectLevel', label: '项目等级', width: 80 },
  { key: 'levelCoefficient', label: '等级系数', width: 80 },
  { key: 'hrModelVersion', label: '人力模型版本', width: 120 },
  { key: 'estimatedInvestment', label: '预估投入', width: 100, align: 'right' as const },
  { key: 'conceptStart', label: '概念启动', width: 120 },
  { key: 'str1', label: 'STR1', width: 120 },
  { key: 'str3', label: 'STR3', width: 120 },
  { key: 'str4', label: 'STR4', width: 120 },
  { key: 'str5', label: 'STR5', width: 120 },
  { key: 'productLaunch', label: '产品上市', width: 120 },
  { key: 'budgetType', label: '预算类型', width: 100 },
  { key: 'versionNumber', label: '版本号', width: 100 },
  { key: 'versionLock', label: '版本锁定', width: 100 },
]

/** 月度预估投入列定义 */
export const MONTHLY_INVESTMENT_COLUMNS = [
  { key: 'name', label: '项目名称', width: 150, fixed: 'left' as const },
  { key: 'primaryDepartment', label: '一级部门', width: 120 },
  { key: 'secondaryDepartment', label: '二级部门', width: 120 },
  { key: 'budgetType', label: '预算类型', width: 100 },
  { key: 'versionNumber', label: '版本号', width: 100 },
  { key: 'estimatedTotal', label: '预估合计', width: 100, align: 'right' as const },
]

/** 阶段拆分规则 */
export const PHASE_SPLIT_RULES = [
  { phase: 'concept', startField: 'conceptStart', endField: 'str1', label: '概念阶段' },
  { phase: 'planning', startField: 'str1', endField: 'str3', label: '计划阶段' },
  { phase: 'development', startField: 'str3', endField: 'str4', label: '开发阶段' },
  { phase: 'validation', startField: 'str4', endField: 'str5', label: '验证阶段' },
  { phase: 'launch', startField: 'str5', endField: 'productLaunch', label: '上市阶段' },
] as const

/** 默认筛选器 */
export const DEFAULT_PROJECT_FILTERS = {
  brand: 'all' as const,
  productLine: 'all' as const,
  projectName: '',
  projectYear: 'all' as const,
  showCancelled: false,
}

/** 生成版本号 */
export function generateVersionNumber(majorVersion: number, minorVersion: number): string {
  return `V${majorVersion}.${minorVersion}`
}

/** 格式化数字（人月） */
export function formatPersonMonth(value: number): string {
  if (value === 0) return '-'
  return value.toFixed(1)
}

/** 格式化百分比 */
export function formatPercent(numerator: number, denominator: number): string {
  if (denominator === 0) return '-'
  return `${((numerator / denominator) * 100).toFixed(1)}%`
}

/** 计算阶段工期（天数） */
export function calcPhaseDuration(startDate: string | null, endDate: string | null): number {
  if (!startDate || !endDate) return 0
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diff = end.getTime() - start.getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}
