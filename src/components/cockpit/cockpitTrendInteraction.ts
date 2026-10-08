import { SOFTWARE_DEPARTMENTS, isSoftwareDepartment, type CockpitFact, type CockpitScope } from '@/components/cockpit/cockpitData'
import { dashboardMonthDates, dashboardWeekStart, validDashboardDate } from '@/components/project-resources/resourceDashboardPeriods'

/** Drill into the existing chart bucket without widening its current source window. */
export function cockpitTrendPeriodRange(period: string, grain: 'month' | 'week', dates: readonly [string, string]): [string, string] | undefined {
  if (!validDashboardDate(dates[0]) || !validDashboardDate(dates[1]) || dates[0] > dates[1]) return
  let start: string, end: string
  if (grain === 'month') {
    const days = dashboardMonthDates(period)
    if (!days.length) return
    start = days[0]; end = days[days.length - 1]
  } else {
    if (!validDashboardDate(period) || dashboardWeekStart(period) !== period) return
    start = period; end = new Date(Date.parse(`${period}T00:00:00Z`) + 6 * 86400000).toISOString().slice(0, 10)
  }
  const lower = start > dates[0] ? start : dates[0], upper = end < dates[1] ? end : dates[1]
  return lower <= upper ? [lower, upper] : undefined
}

/** Missing values in a new period keep the user's department restriction instead of becoming “all”. */
export function cockpitDepartmentSelection(facts: readonly Pick<CockpitFact, 'primary' | 'secondary'>[], scope: CockpitScope, selected: readonly string[]) {
  return {
    options: [...new Set([...SOFTWARE_DEPARTMENTS, ...facts.filter(row => scope === 'all' || isSoftwareDepartment(row.primary)).map(row => row.secondary), ...selected])],
    departments: [...selected],
  }
}

export function cockpitTrendDrilldown(period: string, grain: 'month' | 'week', dates: readonly [string, string], scope: CockpitScope, shareScopes: Record<'research' | 'category', CockpitScope>) {
  const range = cockpitTrendPeriodRange(period, grain, dates)
  return range ? { dates: range, scopePreference: scope, shareScopePreferences: { ...shareScopes } } : undefined
}
