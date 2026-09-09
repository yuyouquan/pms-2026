import type { ConfigRecord } from '@/types/hrConfig'

export const HR_MODEL_STATISTIC_PHASES = [
  { key: 'conceptPhase', label: '概念阶段' },
  { key: 'planningPhase', label: '计划阶段' },
  { key: 'developmentPhase', label: '开发阶段' },
  { key: 'validationPhase', label: '验证阶段' },
  { key: 'launchPhase', label: '上市阶段' },
  { key: 'lifecycle', label: '生命周期' },
] as const

type HrModelPhase = typeof HR_MODEL_STATISTIC_PHASES[number]['key']

export type HrModelStatistic = Record<HrModelPhase, number> & {
  key: string
  modelVersion: string
  projectLevel: string
  status: 'enabled' | 'disabled' | 'mixed'
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
      key, modelVersion, projectLevel, status: 'enabled', recordCount: 0, total: 0,
      conceptPhase: 0, planningPhase: 0, developmentPhase: 0, validationPhase: 0, launchPhase: 0, lifecycle: 0,
    }
    HR_MODEL_STATISTIC_PHASES.forEach(({ key: phase }) => {
      const value = Number(record[phase])
      if (Number.isFinite(value)) group[phase] += value
    })
    group.recordCount += 1
    groups.set(key, group)
  })

  return [...groups.values()].map(group => {
    const [versionKey] = JSON.parse(group.key) as [string, string]
    const states = versionStatuses.get(versionKey)!
    group.status = states.size > 1 ? 'mixed' : states.has(false) ? 'disabled' : 'enabled'
    const total = HR_MODEL_STATISTIC_PHASES.reduce((sum, { key }) => sum + group[key], 0)
    HR_MODEL_STATISTIC_PHASES.forEach(({ key }) => { group[key] = Number(group[key].toFixed(10)) })
    group.total = Number(total.toFixed(10))
    return group
  })
}
