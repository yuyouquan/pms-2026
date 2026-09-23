import { buildMachineLevel1Tasks, type Level1PlanTask } from '@/lib/level1PlanRules'
import { getMachineMarketDate } from '@/lib/mrMachineMarketRules'
import { canonicalizeTosMrVersion, resolveMachineTosProjectKey } from '@/lib/mrAggregationRules'
import { compareTosVersionNumbers, normalizeMrBusinessDate } from '@/lib/mrVersionPlanRules'
import type { MrLevel1TaskLike, MrMachineMarketProjection, MrMachineProjectSource, MrMarketOverride, MrTosProjectSource, TosMrVersionInstance } from '@/types/mrVersionPlan'

type Phase = 'launch' | 'lifecycle'
const SOURCE_PHASES: Readonly<Record<string, Phase>> = {
  'tos-stage-launch-iteration': 'launch',
  'tos-stage-maintenance': 'lifecycle',
}
const MACHINE_STAGES: Readonly<Record<Phase, string>> = {
  launch: 'machine-stage-launch',
  lifecycle: 'machine-stage-lifecycle',
}

export function classifyMachineMrSource(
  machine: MrMachineProjectSource,
  tosProjects: readonly MrTosProjectSource[],
  sourceTasksByProjectId: Readonly<Record<string, readonly MrLevel1TaskLike[] | null | undefined>>,
): 'unbound' | 'pending' | 'ready' {
  const key = resolveMachineTosProjectKey(machine)
  const source = key ? tosProjects.find(project => project.tosProjectKey === key) : undefined
  if (!source) return 'unbound'
  return sourceTasksByProjectId[source.projectId] == null ? 'pending' : 'ready'
}

/** Resolve the source phase from the active tOS business collection, never the machine market. */
export function getTosMrSourcePhases(tasks: readonly MrLevel1TaskLike[]): Map<string, Phase> {
  const parents = new Map(tasks.filter(task => !task.parentId).map(task => [task.id, SOURCE_PHASES[task.stableId || '']]))
  const phases = new Map<string, Phase>()
  for (const task of tasks) {
    const version = canonicalizeTosMrVersion(task.taskName || '')
    const phase = parents.get(task.parentId || '')
    if (version && phase) phases.set(version, phase)
  }
  return phases
}

/** One numbered MR per eligible tOS version, across both business phases. */
export function projectMachineMrLevel1Tasks(input: {
  versions: readonly MrMachineMarketProjection[]
  instancesByProjectId: Readonly<Record<string, readonly TosMrVersionInstance[] | undefined>>
  sourceTasksByProjectId: Readonly<Record<string, readonly MrLevel1TaskLike[] | null | undefined>>
  overridesByKey: Readonly<Record<string, MrMarketOverride>>
  market: string
  mainMarket: string
}): Level1PlanTask[] {
  const stages = buildMachineLevel1Tasks(false).filter(task => task.stableId === MACHINE_STAGES.launch || task.stableId === MACHINE_STAGES.lifecycle)
  const stageByPhase = new Map<Phase, Level1PlanTask>(stages.map(stage => [
    stage.stableId === MACHINE_STAGES.launch ? 'launch' : 'lifecycle', stage,
  ]))
  const phaseMaps = new Map(Object.entries(input.sourceTasksByProjectId).map(([projectId, tasks]) => [
    projectId, tasks ? getTosMrSourcePhases(tasks) : new Map<string, Phase>(),
  ]))
  const sorted = [...input.versions].sort((left, right) =>
    compareTosVersionNumbers(left.tosVersion, right.tosVersion)
      || left.tosProjectId.localeCompare(right.tosProjectId)
      || left.key.localeCompare(right.key))
  let number = 0
  const children = sorted.flatMap((version): Level1PlanTask[] => {
    const canonicalVersion = canonicalizeTosMrVersion(version.tosVersion)
    const phase = canonicalVersion && phaseMaps.get(version.tosProjectId)?.get(canonicalVersion)
    const stage = phase ? stageByPhase.get(phase) : undefined
    if (!stage || !canonicalVersion) return []
    const instance = (input.instancesByProjectId[version.tosProjectId] || []).find(row =>
      canonicalizeTosMrVersion(row.tosVersion) === canonicalVersion)
    if (!instance) return []
    const dates = version.activities.filter(activity => activity.parentId !== null)
      .map(activity => normalizeMrBusinessDate(getMachineMarketDate({
        plan: version.plan, overridesByKey: input.overridesByKey,
        market: input.market, mainMarket: input.mainMarket, activityId: activity.id,
      })))
      .filter(Boolean).sort()
    const sourceIdentity = instance.sourceLevel1TaskId || canonicalVersion
    const stableId = `machine-mr:${JSON.stringify([version.tosProjectId, sourceIdentity])}`
    return [{
      id: stableId, stableId, parentId: stage.id, order: number,
      taskName: `MR${++number}`, source: 'template', nodeKind: 'business-period',
      planStartDate: dates[0] || '', planEndDate: dates.at(-1) || '',
    }]
  })
  return [...stages, ...children]
}
