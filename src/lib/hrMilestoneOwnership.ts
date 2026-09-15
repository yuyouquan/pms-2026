import { withMachineDerivedMilestones } from '@/lib/hrMachinePeriods'
import { isMachineProjectType, PROJECT_CATEGORY_TOS_VERSION } from '@/constants/projectTypes'
import type { HrProjectCategory } from '@/lib/hrFormalProjectSource'

/** These resource planning boundaries belong to each version, including formal projects. */
export const HR_MANUAL_MILESTONE_KEYS: Record<HrProjectCategory, readonly string[]> = {
  machine: [],
  tos: ['marketIteration', 'maintenanceEnd'],
  technical: [],
  capability: [],
}

export function getManualHrMilestoneKeysForType(type?: string): readonly string[] {
  if (type && isMachineProjectType(type)) return HR_MANUAL_MILESTONE_KEYS.machine
  return type === PROJECT_CATEGORY_TOS_VERSION ? HR_MANUAL_MILESTONE_KEYS.tos : []
}

export function mergeHrFormalMilestones(category: HrProjectCategory, source: object, manual?: object) {
  const dates = (manual ?? {}) as Record<string, string | null | undefined>
  const legacy = category === 'machine' ? { productLaunch: dates.productLaunch, lifecycleEnd: dates.lifecycleEnd } : {}
  const merged = { ...source, ...legacy, ...Object.fromEntries(HR_MANUAL_MILESTONE_KEYS[category].map(key => [key, dates[key] ?? null])) }
  return category === 'machine' ? withMachineDerivedMilestones(merged) : merged
}
