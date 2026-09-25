import type { HrProjectCategory } from '@/lib/hrFormalProjectSource'
import { cloneNonLaborInvestment, nonLaborMonths } from '@/lib/nonLaborInvestment'
import { resolveMachineDepartmentInvestments } from '@/lib/resourceAllocation'
import type { ResourceAccountingDataset } from '@/types/resourceAccounting'
import { buildAccountingAnalysis, dashboardDepartmentParents, matchesDashboardDepartment, UNASSIGNED_PRIMARY, type AccountingAnalysis, type DashboardFilter } from '@/components/project-resources/resourceAccounting'
import { buildDashboardAnalysis, type DashboardAnalysis, type DashboardSource } from '@/components/project-resources/resourceDashboardData'
import { dashboardMonthDates, validDashboardDate } from '@/components/project-resources/resourceDashboardPeriods'
import type { ResourceMonthlyRow } from '@/components/project-resources/resourceVersionViewData'

export interface DashboardInvestment { labor?: number; cost?: number }
const keyOf = (primary: string, secondary: string) => JSON.stringify([primary || UNASSIGNED_PRIMARY, secondary])
export const executionPercent = (actual: number | undefined, planned: number | undefined) => actual === undefined || planned === undefined || planned <= 0 ? undefined : actual / planned * 100

/** Choose once for the project. Missing department rows or dates never trigger a different source. */
export function selectCumulativeEstimateSource(sources: readonly (DashboardSource | undefined)[]) {
  for (const type of ['projectBudget', 'projectEstimate', 'annual']) {
    const official = sources.filter((source): source is DashboardSource => !!source?.version.isActive && source.version.budgetType === type)
    if (official.length === 1) return official[0]
  }
}

/** Monthly plans are spread over every calendar day, including initiation day and today. */
export function buildCumulativeEstimate(_category: HrProjectCategory, sources: readonly (DashboardSource | undefined)[], rate: number, filter: DashboardFilter,
  today: string, monthly: readonly ResourceMonthlyRow[], projectStart?: string) {
  const source = selectCumulativeEstimateSource(sources)
  if (!source) return undefined
  const version = source.version
  const upper = 'hrModelVersion' in version ? resolveMachineDepartmentInvestments(version) : version.departmentInvestments
  const sourceRows = monthly.filter(row => row.versionId === version.id && !row.isArchived)
  const globalIssues: string[] = []
  if (!projectStart || !validDashboardDate(projectStart)) globalIssues.push('请补全有效的项目开始日期，作为立项起算日')
  if (!validDashboardDate(today)) globalIssues.push('累计截止日期无效')
  if (!sourceRows.length && version.estimatedInvestment > 0) globalIssues.push('来源正式版本缺少月度预估投入')
  const fraction = (month: string) => {
    const days = dashboardMonthDates(month)
    return days.length && projectStart ? days.filter(date => date >= projectStart && date <= today).length / days.length : 0
  }
  const groups = new Map<string, { key: string; primary: string; secondary: string; labor: number; nonLaborYuan: number; issues: string[] }>()
  const getGroup = (primary: string, secondary: string) => {
    primary ||= UNASSIGNED_PRIMARY
    const key = keyOf(primary, secondary)
    const group = groups.get(key) ?? { key, primary, secondary, labor: 0, nonLaborYuan: 0, issues: [] }
    groups.set(key, group)
    return group
  }
  for (const row of sourceRows.filter(row => matchesDashboardDepartment(row.primaryDepartment, row.secondaryDepartment, filter))) {
    const group = getGroup(row.primaryDepartment, row.secondaryDepartment)
    if (!Object.keys(row.monthlyData).length && row.estimatedTotal > 0) group.issues.push(`${group.primary} / ${group.secondary}：缺少月度预估投入`)
    for (const [month, amount] of Object.entries(row.monthlyData)) {
      if (!dashboardMonthDates(month).length || !Number.isFinite(amount) || amount < 0) group.issues.push(`${group.primary} / ${group.secondary}：月度预估投入无效`)
      else group.labor += amount * fraction(month)
    }
  }
  // Locked legacy snapshots can have only part of the department monthly rows.
  // Preserve manual monthly amounts, but never interpret a missing positive department as zero.
  for (const row of upper.filter(row => row.estimatedInvestment > 0 && matchesDashboardDepartment(row.primaryDepartment, row.secondaryDepartment, filter))) {
    if (!sourceRows.some(month => keyOf(month.primaryDepartment, month.secondaryDepartment) === keyOf(row.primaryDepartment, row.secondaryDepartment))) {
      const group = getGroup(row.primaryDepartment, row.secondaryDepartment)
      group.issues.push(`${group.primary} / ${group.secondary}：缺少月度预估投入`)
    }
  }
  const expenses = cloneNonLaborInvestment(version.nonLaborInvestment)
  const months = nonLaborMonths(expenses)
  const parents = filter.departmentParents ?? dashboardDepartmentParents([...upper, ...sourceRows])
  for (const item of expenses.items) {
    const primary = item.primaryDepartment || parents[item.secondaryDepartment] || UNASSIGNED_PRIMARY
    if (!matchesDashboardDepartment(primary, item.secondaryDepartment, filter)) continue
    const group = getGroup(primary, item.secondaryDepartment)
    for (const month of months) {
      const amount = Number(item.monthlyAmounts[month] ?? 0)
      if (!Number.isFinite(amount) || amount < 0) group.issues.push(`${primary} / ${item.secondaryDepartment}：非人力费用无效`)
      else group.nonLaborYuan += amount * fraction(month)
    }
  }
  const validRate = Number.isFinite(rate) && rate >= 0
  const rows = [...groups.values()].map(row => ({ ...row,
    labor: globalIssues.length || row.issues.length ? undefined : row.labor,
    cost: globalIssues.length || row.issues.length || !validRate ? undefined : row.labor * rate + row.nonLaborYuan / 10000,
  }))
  const issues = [...new Set([...globalIssues, ...rows.flatMap(row => row.issues)])]
  const labor = issues.length ? undefined : rows.reduce((sum, row) => sum + (row.labor ?? 0), 0)
  return { source, today, projectStart, rows, issues, labor, cost: labor === undefined || !validRate ? undefined : rows.reduce((sum, row) => sum + (row.cost ?? 0), 0) }
}
export type CumulativeEstimate = ReturnType<typeof buildCumulativeEstimate>

export interface ResourceDepartmentDetail {
  key: string; primary: string; secondary: string
  annual?: DashboardInvestment; estimate?: DashboardInvestment; budget?: DashboardInvestment
  cumulative?: DashboardInvestment; actual?: DashboardInvestment
  toDateExecution?: number; toDateCostExecution?: number; lifecycleExecution?: number; lifecycleCostExecution?: number
}
const visible = (analysis: DashboardAnalysis | AccountingAnalysis | undefined): DashboardInvestment | undefined => analysis?.months.length ? { labor: analysis.labor, cost: analysis.cost } : undefined

export function buildResourceDepartmentDetails(category: HrProjectCategory, sources: readonly (DashboardSource | undefined)[], monthly: readonly ResourceMonthlyRow[],
  rate: number, dataset: ResourceAccountingDataset | undefined, filter: DashboardFilter, today: string, projectStart?: string) {
  filter = { ...filter, departmentParents: filter.departmentParents ?? dashboardDepartmentParents([
    ...sources.flatMap(source => source ? 'hrModelVersion' in source.version ? resolveMachineDepartmentInvestments(source.version) : source.version.departmentInvestments : []),
    ...monthly.filter(row => sources.some(source => source?.version.id === row.versionId) && !row.isArchived),
    ...(dataset?.worklogs ?? []), ...(dataset?.expenses ?? []),
  ]) }
  const cumulative = buildCumulativeEstimate(category, sources, rate, filter, today, monthly, projectStart)
  const analyses = sources.map(source => source && buildDashboardAnalysis(category, source, monthly, rate, filter))
  const actual = buildAccountingAnalysis(dataset, rate, filter)
  const departments = new Map<string, { primary: string; secondary: string }>()
  const add = (primary: string, secondary: string) => {
    if (matchesDashboardDepartment(primary, secondary, filter)) departments.set(keyOf(primary, secondary), { primary: primary || UNASSIGNED_PRIMARY, secondary })
  }
  analyses.forEach(analysis => {
    analysis?.departments.forEach(row => add(row.primary, row.secondary))
    analysis?.source.version.nonLaborInvestment?.items.forEach(row => add(row.primaryDepartment || filter.departmentParents?.[row.secondaryDepartment] || UNASSIGNED_PRIMARY, row.secondaryDepartment))
  })
  cumulative?.rows.forEach(row => add(row.primary, row.secondary))
  ;[...(actual?.worklogs ?? []), ...(actual?.expenses ?? [])].forEach(row => add(row.primaryDepartment, row.secondaryDepartment))
  const rows: ResourceDepartmentDetail[] = [...departments].map(([key, { primary, secondary }]) => {
    const scoped = { ...filter, primary, department: secondary }
    const planned = sources.map(source => source && visible(buildDashboardAnalysis(category, source, monthly, rate, scoped)))
    const currentActual = visible(buildAccountingAnalysis(dataset, rate, scoped))
    const estimate = cumulative?.rows.find(row => row.key === key) ?? (cumulative ? cumulative.issues.length ? {} : { labor: 0, cost: 0 } : undefined)
    return { key, primary, secondary, annual: planned[0], estimate: planned[1], budget: planned[2], cumulative: estimate, actual: currentActual,
      toDateExecution: executionPercent(currentActual?.labor, estimate?.labor), toDateCostExecution: executionPercent(currentActual?.cost, estimate?.cost),
      lifecycleExecution: executionPercent(currentActual?.labor, planned[2]?.labor), lifecycleCostExecution: executionPercent(currentActual?.cost, planned[2]?.cost) }
  }).sort((a, b) => a.primary.localeCompare(b.primary, 'zh-CN') || a.secondary.localeCompare(b.secondary, 'zh-CN'))
  const total: ResourceDepartmentDetail = { key: 'total', primary: '合计', secondary: '', annual: visible(analyses[0]), estimate: visible(analyses[1]), budget: visible(analyses[2]),
    cumulative, actual: visible(actual), toDateExecution: executionPercent(visible(actual)?.labor, cumulative?.labor), toDateCostExecution: executionPercent(visible(actual)?.cost, cumulative?.cost),
    lifecycleExecution: executionPercent(visible(actual)?.labor, visible(analyses[2])?.labor), lifecycleCostExecution: executionPercent(visible(actual)?.cost, visible(analyses[2])?.cost) }
  return { cumulative, rows, total, today }
}
export type ResourceDepartmentDetails = ReturnType<typeof buildResourceDepartmentDetails>
