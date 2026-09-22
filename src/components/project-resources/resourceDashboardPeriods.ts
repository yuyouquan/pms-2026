/** Calendar arithmetic uses UTC to keep week/month boundaries independent of browser timezone. */
export interface DashboardDateFilter { startDate?: string; endDate?: string; year?: string }
export interface DashboardAmounts { labor: number; laborCost: number; nonLaborYuan: number; cost: number }
export interface DashboardDay extends DashboardAmounts { date: string }
export const emptyDashboardAmounts = (): DashboardAmounts => ({ labor: 0, laborCost: 0, nonLaborYuan: 0, cost: 0 })
const DAY = 86400000
export function validDashboardDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`)
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}
export function dashboardDates(start: string, end: string) {
  if (!validDashboardDate(start) || !validDashboardDate(end) || start > end) return []
  const result: string[] = []
  for (let t = Date.parse(`${start}T00:00:00Z`); t <= Date.parse(`${end}T00:00:00Z`); t += DAY) result.push(new Date(t).toISOString().slice(0, 10))
  return result
}
export function dashboardMonthDates(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month) || !validDashboardDate(`${month}-01`)) return []
  const [year, number] = month.split('-').map(Number)
  return dashboardDates(`${month}-01`, new Date(Date.UTC(year, number, 0)).toISOString().slice(0, 10))
}
export function isDashboardWorkday(date: string) { const day = new Date(`${date}T00:00:00Z`).getUTCDay(); return day !== 0 && day !== 6 }
export function matchesDashboardDate(date: string, filter: DashboardDateFilter) {
  return (!filter.startDate || date >= filter.startDate) && (!filter.endDate || date <= filter.endDate)
    && (!filter.year || filter.year === 'all' || date.startsWith(`${filter.year}-`))
}
export function dashboardMonthFraction(month: string, filter: DashboardDateFilter) {
  const days = dashboardMonthDates(month).filter(isDashboardWorkday)
  return days.length ? days.filter(date => matchesDashboardDate(date, filter)).length / days.length : 0
}
/** Plan-only approximation; actual IPM person-days use the source calendar instead. */
export function spreadDashboardPlan(monthly: readonly ({ month: string } & DashboardAmounts)[], filter: DashboardDateFilter = {}): DashboardDay[] {
  return monthly.flatMap(row => {
    const dates = dashboardMonthDates(row.month), workdays = dates.filter(isDashboardWorkday).length
    return dates.filter(date => matchesDashboardDate(date, filter)).map(date => {
      const fraction = isDashboardWorkday(date) && workdays ? 1 / workdays : 0
      return { date, labor: row.labor * fraction, laborCost: row.laborCost * fraction, nonLaborYuan: row.nonLaborYuan * fraction, cost: row.cost * fraction }
    })
  })
}
export function dashboardWeekStart(date: string) {
  const time = new Date(`${date}T00:00:00Z`), weekday = (time.getUTCDay() + 6) % 7
  return new Date(time.getTime() - weekday * DAY).toISOString().slice(0, 10)
}
export function dashboardWeekLabel(start: string) {
  const end = new Date(Date.parse(`${start}T00:00:00Z`) + 6 * DAY).toISOString().slice(0, 10)
  return `${start}～${end}`
}
export function aggregateDashboardDays(days: readonly DashboardDay[], grain: 'month' | 'week') {
  const values = new Map<string, DashboardAmounts>()
  days.forEach(day => {
    const key = grain === 'week' ? dashboardWeekStart(day.date) : day.date.slice(0, 7)
    const value = values.get(key) ?? emptyDashboardAmounts()
    for (const field of ['labor', 'laborCost', 'nonLaborYuan', 'cost'] as const) value[field] += day[field]
    values.set(key, value)
  })
  return [...values].sort(([a], [b]) => a.localeCompare(b)).map(([period, value]) => ({ period, ...value }))
}
