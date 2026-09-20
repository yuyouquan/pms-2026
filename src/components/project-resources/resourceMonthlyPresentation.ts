import dayjs from 'dayjs'
import { getResourcePhaseRatios } from '@/lib/resourceRatios'
import { TOS_PHASE_SPLIT_RULES } from '@/constants/hrTos'
import { TECH_PHASE_SPLIT_RULES } from '@/constants/hrTechnical'
import { resolveMachineDepartmentInvestments, resolveMachinePhaseFields } from '@/lib/resourceAllocation'
import type { HrProjectCategory } from '@/lib/hrFormalProjectSource'
import type { ResourceVersion } from '@/components/project-resources/resourceVersionAdapter'
import type { ResourceMonthlyRow } from '@/components/project-resources/resourceVersionViewData'

export const RESOURCE_STAGE_COLORS = ['#25815b', '#346fd1', '#ad582c', '#8353ba', '#28868a', '#8d713f', '#6578a3']
export const sumMonthlyRow = (row: ResourceMonthlyRow, months?: readonly string[]) => Math.round((months
  ? months.reduce((sum, month) => sum + (row.monthlyData[month] ?? 0), 0)
  : Object.values(row.monthlyData).reduce((sum, amount) => sum + (Number.isFinite(amount) ? amount : 0), 0)) * 1000) / 1000

export function resourceInvestmentStages(category: HrProjectCategory, version: ResourceVersion) {
  const dates = ('milestones' in version ? version.milestones : version) as unknown as Record<string, string | null>
  const rows = 'hrModelVersion' in version ? resolveMachineDepartmentInvestments(version) : version.departmentInvestments
  const rules = category === 'machine' && 'hrModelVersion' in version ? resolveMachinePhaseFields(version)
    : category === 'tos' ? TOS_PHASE_SPLIT_RULES.map(rule => ({ ...rule, key: rule.configKey }))
      : category === 'technical' ? TECH_PHASE_SPLIT_RULES.map(rule => ({ ...rule, key: rule.configKey }))
        : [{ key: 'projectPeriod', label: '项目周期', startField: 'projectStartTime', endField: 'projectEndTime' }]
  return rules.map((rule, index) => ({ ...rule, start: dates[rule.startField], end: dates[rule.endField], color: RESOURCE_STAGE_COLORS[index % RESOURCE_STAGE_COLORS.length],
    amount: Math.round(rows.reduce((sum, row) => sum + Number(category === 'capability' ? row.estimatedInvestment * (getResourcePhaseRatios(category, version, row).projectPeriod ?? 100) / 100 : (row as unknown as Record<string, number>)[rule.key] ?? 0), 0) * 1000) / 1000 }))
}
export type ResourceInvestmentStage = ReturnType<typeof resourceInvestmentStages>[number]

/** Each month appears once; assign a boundary month to its largest day overlap, ties to the earlier phase. */
export function groupResourceMonths(months: readonly string[], stages: readonly ResourceInvestmentStage[]) {
  const groups: { key: string; label: string; color: string; stageKey: string; months: string[] }[] = []
  for (const month of months) {
    const start = dayjs(`${month}-01`), end = start.add(1, 'month')
    let chosen: ResourceInvestmentStage | undefined, best = 0
    for (const stage of stages) {
      if (!stage.start || !stage.end) continue
      const from = dayjs(stage.start), to = dayjs(stage.end)
      if (!from.isValid() || !to.isValid() || to.isBefore(from)) continue
      const overlap = Math.max(0, Math.min(to.valueOf(), end.valueOf()) - Math.max(from.valueOf(), start.valueOf()))
      if (overlap > best) { best = overlap; chosen = stage }
    }
    const stageKey = chosen?.key ?? 'unassigned'
    const previous = groups.at(-1)
    if (previous?.stageKey === stageKey) previous.months.push(month)
    else groups.push({ key: `${stageKey}-${month}`, stageKey, label: chosen?.label ?? '未归属阶段', color: chosen?.color ?? '#72778b', months: [month] })
  }
  return groups
}
