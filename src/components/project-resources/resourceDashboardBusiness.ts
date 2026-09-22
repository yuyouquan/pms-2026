import { dashboardStageForDate, UNASSIGNED_STAGE, type DashboardStageDefinition } from '@/components/project-resources/resourceDashboardStages'
export type DashboardTrendGrain = 'month' | 'week' | 'stage'
import { DASHBOARD_BUDGETS, dashboardDelta, type DashboardAnalysis } from '@/components/project-resources/resourceDashboardData'
import type { AccountingAnalysis } from '@/components/project-resources/resourceAccounting'
import { aggregateDashboardDays, dashboardDates, dashboardWeekLabel } from '@/components/project-resources/resourceDashboardPeriods'
export const DASHBOARD_SERIES = [...DASHBOARD_BUDGETS.map(item => ({ ...item, label: item.key === 'annual' ? '项目年度预算' : item.label })), { key: 'accounting', label: '项目核算', color: '#31976c' }]
export function dashboardBusinessMetrics(analyses: readonly (DashboardAnalysis | undefined)[], accounting: AccountingAnalysis | undefined) {
  const estimate = analyses[1]?.months.length ? analyses[1] : undefined
  const budget = analyses[2]?.months.length ? analyses[2] : undefined
  const actual = accounting?.months.length ? accounting : undefined
  return {
    costDelta: dashboardDelta(budget?.cost, estimate?.cost), laborDelta: dashboardDelta(budget?.labor, estimate?.labor),
    execution: budget && actual && budget.cost > 0 ? actual.cost / budget.cost * 100 : undefined,
    laborExecution: budget && actual && budget.labor > 0 ? actual.labor / budget.labor * 100 : undefined,
  }
}
export function dashboardBusinessTrend(analyses: readonly (DashboardAnalysis | undefined)[], accounting: AccountingAnalysis | undefined, mode: 'labor' | 'cost', grain: DashboardTrendGrain, stages: readonly (DashboardStageDefinition | undefined)[] = []) {
  const inputs = [...analyses.map(analysis => analysis?.daily), accounting?.daily]
  if (grain === 'stage') {
    const values = inputs.map((days, index) => {
      const totals = new Map<string, number>()
      days?.forEach(day => { const label = dashboardStageForDate(day.date, stages[index]); totals.set(label, (totals.get(label) ?? 0) + day[mode]) })
      return totals
    })
    const labels = [...new Set(stages.flatMap(stage => stage?.labels ?? []))]
    if (values.some(value => value.has(UNASSIGNED_STAGE))) labels.push(UNASSIGNED_STAGE)
    const axis = inputs.some(days => days?.length) ? labels : []
    return { periods: axis, labels: axis, series: DASHBOARD_SERIES.map((item, index) => ({ ...item, included: !!inputs[index], values: axis.map(label => values[index].get(label)) })), mode, grain }
  }
  const observed = inputs.flatMap(days => days?.map(day => day.date) ?? []).sort()
  const dates = observed.length ? dashboardDates(observed[0], observed[observed.length - 1]) : []
  const axis = aggregateDashboardDays(dates.map(date => ({ date, labor: 0, laborCost: 0, nonLaborYuan: 0, cost: 0 })), grain).map(row => row.period)
  const series = DASHBOARD_SERIES.map((item, index) => {
    const values = new Map(aggregateDashboardDays(inputs[index] ?? [], grain).map(row => [row.period, row[mode]]))
    return { ...item, included: !!inputs[index], values: axis.map(period => values.get(period)) }
  })
  return { periods: axis, labels: axis.map(period => grain === 'week' ? dashboardWeekLabel(period) : period), series, mode, grain }
}
export type DashboardBusinessTrend = ReturnType<typeof dashboardBusinessTrend>
