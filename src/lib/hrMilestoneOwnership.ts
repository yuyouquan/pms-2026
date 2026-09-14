import { isMachineProjectType, PROJECT_CATEGORY_TOS_VERSION } from '@/constants/projectTypes'
import type { HrProjectCategory } from '@/lib/hrFormalProjectSource'

/** These resource planning boundaries belong to each version, including formal projects. */
export const HR_MANUAL_MILESTONE_KEYS: Record<HrProjectCategory, readonly string[]> = {
  machine: ['productLaunch', 'lifecycleEnd'],
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
  return { ...source, ...Object.fromEntries(HR_MANUAL_MILESTONE_KEYS[category].map(key => [key,
    // Missing on legacy machine versions means their existing 180-day allocation;
    // an explicitly cleared end date means no lifecycle allocation.
    category === 'machine' && key === 'lifecycleEnd' ? dates[key] : dates[key] ?? null,
  ])) }
}
