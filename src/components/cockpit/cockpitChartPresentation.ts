import { cockpitTrendPeriodRange } from '@/components/cockpit/cockpitTrendInteraction'
import { dashboardWeekStart, validDashboardDate } from '@/components/project-resources/resourceDashboardPeriods'

export interface CockpitTrendPresentation {
  today: string
  dates: readonly [string, string]
  grain: 'month' | 'week'
  activeIndex?: number
}

/** A clipped selection is complete once its own end is reached, even within this month. */
export function cockpitCurrentPeriod(periods: readonly string[], { today, dates, grain }: CockpitTrendPresentation) {
  if (!validDashboardDate(today) || today < dates[0] || today >= dates[1]) return
  const period = grain === 'month' ? today.slice(0, 7) : dashboardWeekStart(today)
  const index = periods.indexOf(period), range = cockpitTrendPeriodRange(period, grain, dates)
  if (index < 0 || !range || today < range[0] || today >= range[1]) return
  return { index, period, cutoff: today, label: `${grain === 'month' ? '本月' : '本周'}核算截至 ${today.slice(5).replace('-', '/')}` }
}

/** Keep current periods visible; completed years open near their end and future years at their start. */
export function cockpitInitialPeriodIndex(periods: readonly string[], today: string, grain: 'month' | 'week') {
  if (!periods.length || !validDashboardDate(today)) return 0
  const current = grain === 'month' ? today.slice(0, 7) : dashboardWeekStart(today)
  const next = periods.findIndex(period => period >= current)
  return next < 0 ? periods.length - 1 : next
}

export function cockpitPeriodWindow(count: number, capacity: number, index: number) {
  const length = Math.min(Math.max(0, count), capacity)
  const start = Math.max(0, Math.min(count - length, index - Math.floor(length / 2)))
  return { start, end: Math.max(start, start + length - 1) }
}

/** Horizontal category scrolling uses the same grid padding and visible time window as ECharts. */
export function cockpitPeriodScrollLeft(chartWidth: number, viewportWidth: number, index: number, window: { start: number; end: number }) {
  const slot = Math.max(0, Math.min(window.end - window.start, index - window.start))
  const center = 48 + Math.max(0, chartWidth - 72) * (slot + .5) / Math.max(1, window.end - window.start + 1)
  return Math.max(0, Math.min(Math.max(0, chartWidth - viewportWidth), center - viewportWidth / 2))
}

export function cockpitPeriodLabel(period: string | undefined, grain: 'month' | 'week') {
  if (!period) return '暂无期间'
  if (grain === 'month') return `${period.slice(0, 4)}年${Number(period.slice(5))}月`
  const end = new Date(Date.parse(`${period}T00:00:00Z`) + 6 * 86400000).toISOString().slice(0, 10)
  return `${period.slice(5).replace('-', '/')}–${end.slice(5).replace('-', '/')}`
}
