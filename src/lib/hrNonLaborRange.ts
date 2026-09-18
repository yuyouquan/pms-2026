import dayjs from 'dayjs'
import { MILESTONE_FIELDS } from '@/constants/hrMachine'
import { TOS_MILESTONE_FIELDS } from '@/constants/hrTos'
import { TECH_MILESTONE_FIELDS } from '@/constants/hrTechnical'
import { withMachineDerivedMilestones } from '@/lib/hrMachinePeriods'
import { cloneNonLaborInvestment } from '@/lib/nonLaborInvestment'
import type { HrProjectCategory } from '@/lib/hrFormalProjectSource'
import type { NonLaborInvestment } from '@/types/nonLaborInvestment'

const fields = {
  machine: MILESTONE_FIELDS,
  tos: TOS_MILESTONE_FIELDS,
  technical: TECH_MILESTONE_FIELDS,
  capability: [{ key: 'projectStartTime' }, { key: 'projectEndTime' }],
}

/** Only the milestones shown for this category define its expense months. */
export function hrNonLaborMonthRange(category: HrProjectCategory, values: object, frozen = false) {
  const dates = (category === 'machine' && !frozen ? withMachineDerivedMilestones(values) : values) as Record<string, unknown>
  const months = fields[category].flatMap(({ key }) => {
    const value = dates[key]
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
      && dayjs(value).isValid() && dayjs(value).format('YYYY-MM-DD') === value ? [value.slice(0, 7)] : []
  }).sort()
  return { startMonth: months[0] ?? null, endMonth: months.at(-1) ?? null }
}

/** Range changes hide amounts, but never discard the version's saved month data. */
export function withHrNonLaborRange(value: NonLaborInvestment | undefined, category: HrProjectCategory, dates: object): NonLaborInvestment {
  return { ...cloneNonLaborInvestment(value), ...hrNonLaborMonthRange(category, dates) }
}
