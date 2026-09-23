import { buildTosLevel1Tasks, isBusinessStage } from '@/lib/level1PlanRules'
import { getLevel1BusinessScopeKey, type Level1BusinessTasks } from '@/lib/level1SharedBusinessTasks'
import { selectLatestPublishedTosLevel1, type TosLevel1AdapterInput } from '@/lib/mrPlanSourceAdapters'
import { getMainTosType, getTosTypeVersions, type TosTypePlanData } from '@/lib/tosTypeRules'
import { canonicalizeTosMrVersion } from '@/lib/mrAggregationRules'
import { compareTosVersionNumbers, createTosMrVersionInstance } from '@/lib/mrVersionPlanRules'
import type { MrLevel1TaskLike, MrTemplateVersion, TosMrVersionCandidate, TosMrVersionInstance } from '@/types/mrVersionPlan'

export interface ActiveTosMrSourceInput extends TosLevel1AdapterInput {
  sharedBusinessTasks: Readonly<Record<string, Level1BusinessTasks>>
  tosTypePlanData: TosTypePlanData
}

/** MR plans have one canonical project source, independent of the currently selected type/version. */
export function selectActiveTosMrTasks(input: ActiveTosMrSourceInput): readonly MrLevel1TaskLike[] | null {
  const type = getMainTosType([...input.tosTypeRows])
  if (!type) return null
  const shared = input.sharedBusinessTasks[getLevel1BusinessScopeKey(input.project.id, 'tos', type)]
  if (shared) {
    return buildTosLevel1Tasks().filter(stage => isBusinessStage('tOS版本项目', stage)).flatMap(stage => [
      stage,
      ...(shared[stage.stableId!] || []).map(task => ({ ...task, parentId: stage.id })),
    ])
  }
  const versions = getTosTypeVersions(input.tosTypeVersionsByKey, input.project.id, type, 'level1', [...input.fallbackVersions])
  const live = input.tosTypePlanData[input.project.id]?.[type]?.level1Tasks
  if (live && versions.some(version => version.status === '修订中')) return live
  return selectLatestPublishedTosLevel1(input)?.tasks ?? null
}

export function reconcileTosMrInstances(input: {
  projectId: string
  candidates: readonly TosMrVersionCandidate[]
  existing: readonly TosMrVersionInstance[]
  template?: MrTemplateVersion
  now: string
}): TosMrVersionInstance[] {
  const seen = new Set<string>()
  return input.candidates.flatMap(candidate => {
    const tosVersion = canonicalizeTosMrVersion(candidate.value)
    if (!tosVersion || seen.has(tosVersion)) return []
    seen.add(tosVersion)
    const existing = (candidate.sourceLevel1TaskId
      ? input.existing.find(row => row.sourceLevel1TaskId === candidate.sourceLevel1TaskId)
      : undefined) || input.existing.find(row => !row.sourceLevel1TaskId && canonicalizeTosMrVersion(row.tosVersion) === tosVersion)
    if (existing) {
      if (existing.tosVersion === tosVersion && existing.sourceLevel1TaskId === candidate.sourceLevel1TaskId) return [existing]
      return [{ ...existing, tosVersion, sourceLevel1TaskId: candidate.sourceLevel1TaskId, updatedBy: '一级计划同步', updatedAt: input.now }]
    }
    if (!input.template) return []
    return [{
      ...createTosMrVersionInstance({ projectId: input.projectId, tosVersion, templateVersion: input.template, actor: '一级计划同步', now: input.now }),
      sourceLevel1TaskId: candidate.sourceLevel1TaskId,
    }]
  }).sort((a, b) => compareTosVersionNumbers(a.tosVersion, b.tosVersion))
}
