import type { ResourceAccountingDataset } from '@/types/resourceAccounting'
import { aggregateDashboardDays, dashboardDates, emptyDashboardAmounts, matchesDashboardDate, validDashboardDate, type DashboardDateFilter } from '@/components/project-resources/resourceDashboardPeriods'
export const UNASSIGNED_PRIMARY = '未归属一级部门'
export interface DashboardFilter extends DashboardDateFilter { primary?: string; department?: string; departmentParents?: Record<string, string> }
export function matchesDashboardDepartment(primary: string, secondary: string, filter: DashboardFilter) {
  return (!filter.primary || filter.primary === 'all' || (primary || UNASSIGNED_PRIMARY) === filter.primary)
    && (filter.department === undefined || filter.department === 'all' || secondary === filter.department)
}
/** Ambiguous secondary names stay unassigned; never allocate the same expense into two parent departments. */
export function dashboardDepartmentParents(pairs: readonly { primaryDepartment: string; secondaryDepartment: string }[]) {
  const values = new Map<string, Set<string>>()
  pairs.forEach(pair => { if (!pair.secondaryDepartment) return; const parents = values.get(pair.secondaryDepartment) ?? new Set<string>(); if (pair.primaryDepartment) parents.add(pair.primaryDepartment); values.set(pair.secondaryDepartment, parents) })
  return Object.fromEntries([...values].map(([secondary, parents]) => [secondary, parents.size === 1 ? [...parents][0] : UNASSIGNED_PRIMARY]))
}
export function buildAccountingAnalysis(dataset: ResourceAccountingDataset | undefined, rate: number, filter: DashboardFilter = {}) {
  if (!dataset) return undefined
  const validRate = Number.isFinite(rate) && rate >= 0 ? rate : 0
  const inScope = (row: { date: string; primaryDepartment: string; secondaryDepartment: string }) => validDashboardDate(row.date)
    && row.date >= dataset.startDate && row.date <= dataset.endDate && matchesDashboardDate(row.date, filter)
    && matchesDashboardDepartment(row.primaryDepartment, row.secondaryDepartment, filter)
  const validWorklog = (row: ResourceAccountingDataset['worklogs'][number]) => Number.isFinite(row.personDays) && row.personDays >= 0 && Number.isFinite(row.monthWorkingDays) && row.monthWorkingDays > 0
  const scopedLogs = dataset.worklogs.filter(inScope)
  const worklogs = scopedLogs.filter(validWorklog).map(row => ({ ...row, labor: row.personDays / row.monthWorkingDays, laborCost: row.personDays / row.monthWorkingDays * validRate }))
    .sort((a, b) => b.date.localeCompare(a.date) || a.person.localeCompare(b.person))
  const scopedExpenses = dataset.expenses.filter(inScope)
  const expenses = scopedExpenses.filter(row => Number.isFinite(row.amountYuan) && row.amountYuan >= 0).sort((a, b) => b.date.localeCompare(a.date))
  const byDay = new Map(dashboardDates(dataset.startDate, dataset.endDate).filter(date => matchesDashboardDate(date, filter)).map(date => [date, { date, ...emptyDashboardAmounts() }]))
  worklogs.forEach(row => { const day = byDay.get(row.date)!; day.labor += row.labor; day.laborCost += row.laborCost; day.cost += row.laborCost })
  expenses.forEach(row => { const day = byDay.get(row.date)!; day.nonLaborYuan += row.amountYuan; day.cost += row.amountYuan / 10000 })
  const daily = [...byDay.values()], monthly = aggregateDashboardDays(daily, 'month')
  const totals = daily.reduce((sum, row) => ({ labor: sum.labor + row.labor, laborCost: sum.laborCost + row.laborCost, nonLaborYuan: sum.nonLaborYuan + row.nonLaborYuan, cost: sum.cost + row.cost }), emptyDashboardAmounts())
  const invalidCount = scopedLogs.length - worklogs.length + scopedExpenses.length - expenses.length
  return { ...totals, daily, monthly, months: monthly.map(row => row.period), worklogs, expenses, rate: validRate,
    personDays: worklogs.reduce((sum, row) => sum + row.personDays, 0), dataset,
    issues: [...(invalidCount ? [`${invalidCount} 条来源记录的工作日或金额无效，未纳入汇总`] : []), ...(!Number.isFinite(rate) || rate < 0 ? ['人力费率无效，当前按 0 计算'] : [])] }
}
export type AccountingAnalysis = NonNullable<ReturnType<typeof buildAccountingAnalysis>>
