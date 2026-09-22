import type { HrProjectCategory } from '@/lib/hrFormalProjectSource'
import { resolveMachineDepartmentInvestments } from '@/lib/resourceAllocation'
import { getResourcePhaseRatios } from '@/lib/resourceRatios'
import { withMachineDerivedMilestones } from '@/lib/hrMachinePeriods'
import type { ResourceAccountingDataset } from '@/types/resourceAccounting'
import { buildAccountingAnalysis, matchesDashboardDepartment, UNASSIGNED_PRIMARY, type AccountingAnalysis, type DashboardFilter } from '@/components/project-resources/resourceAccounting'
import { buildDashboardAnalysis, type DashboardAnalysis, type DashboardSource } from '@/components/project-resources/resourceDashboardData'
import { resourceInvestmentStages } from '@/components/project-resources/resourceMonthlyPresentation'
import { validDashboardDate } from '@/components/project-resources/resourceDashboardPeriods'
import type { ResourceMonthlyRow } from '@/components/project-resources/resourceVersionViewData'

export interface DashboardInvestment { labor?: number; cost?: number }
const keyOf = (primary: string, secondary: string) => JSON.stringify([primary || UNASSIGNED_PRIMARY, secondary])
export const executionPercent = (actual: number | undefined, planned: number | undefined) => actual === undefined || planned === undefined || planned <= 0 ? undefined : actual / planned * 100

/** Choose once for the project. Missing department rows or dates never trigger a different source. */
export function selectCumulativeEstimateSource(sources: readonly (DashboardSource | undefined)[]) {
  for (const type of ['projectBudget', 'annual', 'projectEstimate']) {
    const official = sources.filter((source): source is DashboardSource => !!source?.version.isActive && source.version.budgetType === type)
    if (official.length === 1) return official[0]
  }
}

/** Milestone intervals use elapsed calendar days [start, end), matching resource allocation. */
export function milestoneProgress(start: string | null | undefined, end: string | null | undefined, today: string) {
  if (!start || !end || !validDashboardDate(start) || !validDashboardDate(end) || !validDashboardDate(today) || end < start) return undefined
  if (today < start) return 0
  if (today >= end) return 1
  return (Date.parse(today) - Date.parse(start)) / (Date.parse(end) - Date.parse(start))
}

export function buildCumulativeEstimate(category: HrProjectCategory, sources: readonly (DashboardSource | undefined)[], rate: number, filter: DashboardFilter, today: string) {
  const source = selectCumulativeEstimateSource(sources)
  if (!source) return undefined
  const version = source.version
  const upper = 'hrModelVersion' in version ? resolveMachineDepartmentInvestments(version) : version.departmentInvestments
  const rawDates = 'milestones' in version ? version.milestones : version
  const dates = (category === 'machine' ? withMachineDerivedMilestones(rawDates) : rawDates) as unknown as Record<string, string | null>
  const stages = resourceInvestmentStages(category, version)
  const groups = new Map<string, { key: string; primary: string; secondary: string; labor: number; issues: string[] }>()
  for (const row of upper.filter(row => matchesDashboardDepartment(row.primaryDepartment, row.secondaryDepartment, filter))) {
    const primary = row.primaryDepartment || UNASSIGNED_PRIMARY, secondary = row.secondaryDepartment, key = keyOf(primary, secondary)
    const group = groups.get(key) ?? { key, primary, secondary, labor: 0, issues: [] }
    const ratios = category === 'machine' ? undefined : getResourcePhaseRatios(category, version, row)
    const amounts = stages.map(stage => category === 'machine' ? Number((row as unknown as Record<string, unknown>)[stage.key] ?? 0) : row.estimatedInvestment * (ratios?.[stage.key] ?? 0) / 100)
    if (!Number.isFinite(row.estimatedInvestment) || row.estimatedInvestment < 0 || amounts.some(value => !Number.isFinite(value) || value < 0)
      || Math.abs(amounts.reduce((sum, value) => sum + value, 0) - row.estimatedInvestment) > .00001) {
      group.issues.push(`${primary} / ${secondary}：阶段投入与部门预估不平衡`)
    }
    stages.forEach((stage, index) => {
      const amount = amounts[index]
      if (!amount) return
      const progress = milestoneProgress(dates[stage.startField], dates[stage.endField], today)
      if (progress === undefined) group.issues.push(`${primary} / ${secondary}：${stage.label}里程碑缺失或顺序无效`)
      else group.labor += amount * progress
    })
    groups.set(key, group)
  }
  const validRate = Number.isFinite(rate) && rate >= 0
  const rows = [...groups.values()].map(row => ({ ...row, labor: row.issues.length ? undefined : row.labor, cost: row.issues.length || !validRate ? undefined : row.labor * rate }))
  const issues = [...new Set(rows.flatMap(row => row.issues))]
  if (!upper.length && version.estimatedInvestment > 0) issues.push('来源版本缺少部门投入明细')
  const labor = issues.length ? undefined : rows.reduce((sum, row) => sum + (row.labor ?? 0), 0)
  return { source, today, rows, issues, labor, cost: labor === undefined || !validRate ? undefined : labor * rate }
}
export type CumulativeEstimate = ReturnType<typeof buildCumulativeEstimate>

export interface ResourceDepartmentDetail {
  key: string; primary: string; secondary: string
  annual?: DashboardInvestment; estimate?: DashboardInvestment; budget?: DashboardInvestment
  cumulative?: DashboardInvestment; actual?: DashboardInvestment; actualToDate?: DashboardInvestment
  toDateExecution?: number; lifecycleExecution?: number
}
const visible = (analysis: DashboardAnalysis | AccountingAnalysis | undefined): DashboardInvestment | undefined => analysis?.months.length ? { labor: analysis.labor, cost: analysis.cost } : undefined

export function buildResourceDepartmentDetails(category: HrProjectCategory, sources: readonly (DashboardSource | undefined)[], monthly: readonly ResourceMonthlyRow[],
  rate: number, dataset: ResourceAccountingDataset | undefined, filter: DashboardFilter, today: string, projectStart?: string) {
  const cumulative = buildCumulativeEstimate(category, sources, rate, filter, today)
  // Life-to-date is intentionally independent of the trend's date/year filters.
  const toDateFilter = { primary: filter.primary, department: filter.department, startDate: projectStart, endDate: today }
  const actualToDate = buildAccountingAnalysis(dataset, rate, toDateFilter)
  const analyses = sources.map(source => source && buildDashboardAnalysis(category, source, monthly, rate, filter))
  const actual = buildAccountingAnalysis(dataset, rate, filter)
  const departments = new Map<string, { primary: string; secondary: string }>()
  const add = (primary: string, secondary: string) => {
    if (matchesDashboardDepartment(primary, secondary, filter)) departments.set(keyOf(primary, secondary), { primary: primary || UNASSIGNED_PRIMARY, secondary })
  }
  analyses.forEach(analysis => {
    analysis?.departments.forEach(row => add(row.primary, row.secondary))
    analysis?.source.version.nonLaborInvestment?.items.forEach(row => add(filter.departmentParents?.[row.secondaryDepartment] ?? UNASSIGNED_PRIMARY, row.secondaryDepartment))
  })
  cumulative?.rows.forEach(row => add(row.primary, row.secondary))
  ;[...(actual?.worklogs ?? []), ...(actual?.expenses ?? []), ...(actualToDate?.worklogs ?? [])].forEach(row => add(row.primaryDepartment, row.secondaryDepartment))
  const rows: ResourceDepartmentDetail[] = [...departments].map(([key, { primary, secondary }]) => {
    const scoped = { ...filter, primary, department: secondary }
    const planned = sources.map(source => source && visible(buildDashboardAnalysis(category, source, monthly, rate, scoped)))
    const currentActual = visible(buildAccountingAnalysis(dataset, rate, scoped))
    const toDateActual = actualToDate ? buildAccountingAnalysis(dataset, rate, { ...toDateFilter, primary, department: secondary }) : undefined
    const estimate = cumulative?.rows.find(row => row.key === key) ?? (cumulative ? cumulative.issues.length && !cumulative.rows.length ? {} : { labor: 0, cost: 0 } : undefined)
    return { key, primary, secondary, annual: planned[0], estimate: planned[1], budget: planned[2], cumulative: estimate, actual: currentActual, actualToDate: toDateActual,
      toDateExecution: executionPercent(toDateActual?.labor, estimate?.labor), lifecycleExecution: executionPercent(currentActual?.cost, planned[2]?.cost) }
  }).sort((a, b) => a.primary.localeCompare(b.primary, 'zh-CN') || a.secondary.localeCompare(b.secondary, 'zh-CN'))
  const total: ResourceDepartmentDetail = { key: 'total', primary: '合计', secondary: '', annual: visible(analyses[0]), estimate: visible(analyses[1]), budget: visible(analyses[2]),
    cumulative, actual: visible(actual), actualToDate, toDateExecution: executionPercent(actualToDate?.labor, cumulative?.labor), lifecycleExecution: executionPercent(visible(actual)?.cost, visible(analyses[2])?.cost) }
  return { cumulative, actualToDate, rows, total, today }
}
export type ResourceDepartmentDetails = ReturnType<typeof buildResourceDepartmentDetails>
