import type { ConfigRecord } from '@/types/hrConfig'

import { MACHINE_INVESTMENT_PERIODS, LEGACY_MACHINE_PHASES, isCurrentMachineModel } from '@/lib/hrMachinePeriods'

export const HR_MODEL_STATISTIC_PHASES = MACHINE_INVESTMENT_PERIODS

type HrModelPhase = typeof HR_MODEL_STATISTIC_PHASES[number]['key']

export type HrModelStatistic = Record<HrModelPhase, number> & {
  key: string
  modelVersion: string
  projectLevel: string
  status: 'enabled' | 'disabled' | 'mixed'
  hasLegacyModels: boolean
  recordCount: number
  total: number
}

/** Summarize every department row, including disabled and legacy records. */
export function summarizeHrModels(records: readonly ConfigRecord[]): HrModelStatistic[] {
  const groups = new Map<string, HrModelStatistic>()
  const versionStatuses = new Map<string, Set<boolean>>()

  records.forEach(record => {
    const modelVersion = String(record.modelVersion ?? '')
    const projectLevel = String(record.projectLevel ?? '')
    const versionKey = modelVersion
    const key = JSON.stringify([versionKey, projectLevel])
    const states = versionStatuses.get(versionKey) ?? new Set<boolean>()
    states.add(record.enabled !== false)
    versionStatuses.set(versionKey, states)

    const group = groups.get(key) ?? {
      key, modelVersion, projectLevel, status: 'enabled', hasLegacyModels: false, recordCount: 0, total: 0,
      conceptToStr1: 0, str1ToStr2: 0, str2ToStr3: 0, str3ToStr4: 0, str4ToStr4a: 0, str4aToStr5: 0, str5ToSixMonths: 0,
    }
    HR_MODEL_STATISTIC_PHASES.forEach(({ key: phase }) => {
      const value = Number(record[phase])
      if (Number.isFinite(value)) group[phase] += value
    })
    const currentSchema = isCurrentMachineModel(record)
    group.hasLegacyModels ||= !currentSchema
    group.total += (currentSchema ? MACHINE_INVESTMENT_PERIODS : LEGACY_MACHINE_PHASES).reduce((sum, { key }) => sum + (Number(record[key]) || 0), 0)
    group.recordCount += 1
    groups.set(key, group)
  })

  return [...groups.values()].map(group => {
    const [versionKey] = JSON.parse(group.key) as [string, string]
    const states = versionStatuses.get(versionKey)!
    group.status = states.size > 1 ? 'mixed' : states.has(false) ? 'disabled' : 'enabled'
    HR_MODEL_STATISTIC_PHASES.forEach(({ key }) => { group[key] = Number(group[key].toFixed(10)) })
    group.total = Number(group.total.toFixed(10))
    return group
  })
}
