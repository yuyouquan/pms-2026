import dayjs from 'dayjs'
import type { HrProjectCategory } from '@/lib/hrFormalProjectSource'
import { normalizeMachineBudgetScheduleStages, type BudgetScheduleDisplay } from '@/lib/budgetMilestoneScheduling'
import { validDashboardDate } from '@/components/project-resources/resourceDashboardPeriods'

export interface DashboardStagePeriod { label: string; start: string; end: string; includeEnd?: boolean }
export interface DashboardStageDefinition { labels: string[]; periods: DashboardStagePeriod[] }
export const UNASSIGNED_STAGE = '未归属阶段'

/** Match milestone-strip grouping. An interval belongs to its ending milestone's stage.
 * Missing/reversed intervals stay unassigned; adjacent boundaries are counted exactly once. */
export function dashboardStageDefinition(category: HrProjectCategory, dates: Record<string, string | null | undefined>, display?: BudgetScheduleDisplay): DashboardStageDefinition {
  const valid = (value: string | null | undefined): value is string => !!value && validDashboardDate(value)
  if (category === 'capability') return { labels: ['项目周期'], periods: valid(dates.projectStartTime) && valid(dates.projectEndTime) && dates.projectStartTime <= dates.projectEndTime
    ? [{ label: '项目周期', start: dates.projectStartTime, end: dates.projectEndTime, includeEnd: true }] : [] }
  if (!display) return { labels: [], periods: [] }
  const model = normalizeMachineBudgetScheduleStages(display)
  const periods: DashboardStagePeriod[] = []
  const labels = model.stages.map(stage => stage.label)
  model.milestones.slice(1).forEach((milestone, index) => {
    const start = dates[model.milestones[index].fieldKey], end = dates[milestone.fieldKey]
    const label = model.stages.find(stage => stage.milestones.some(item => item.fieldKey === milestone.fieldKey))?.label
    if (label && valid(start) && valid(end) && start < end) periods.push({ label, start, end, includeEnd: index === model.milestones.length - 2 })
  })
  const last = dates[model.lastAnchorKey]
  const tailLabel = category === 'machine' ? '上市&生命周期' : category === 'tos' ? '上市迭代&维护' : undefined
  const tail = category === 'machine' ? valid(last) ? dayjs(last).add(6, 'month').format('YYYY-MM-DD') : undefined
    : [dates.marketIteration, dates.maintenanceEnd].filter(valid).sort().at(-1)
  if (tailLabel) {
    labels.push(tailLabel)
    if (valid(last) && valid(tail) && last < tail) {
      periods.forEach(period => { if (period.end === last) period.includeEnd = false })
      periods.push({ label: tailLabel, start: last, end: tail, includeEnd: true })
    }
  }
  return { labels: [...new Set(labels)], periods }
}

export function dashboardStageForDate(date: string, definition?: DashboardStageDefinition) {
  const matches = definition?.periods.filter(period => date >= period.start && (date < period.end || period.includeEnd && date === period.end)) ?? []
  return matches.length === 1 ? matches[0].label : UNASSIGNED_STAGE
}
