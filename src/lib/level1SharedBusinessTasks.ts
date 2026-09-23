import { comparePlanVersions } from '@/lib/planVersioning'
import { isBusinessStage, type Level1PlanTask } from '@/lib/level1PlanRules'

/** One live collection per project/market or project/tOS type, independent of revisions. */
export type Level1BusinessTasks = Record<string, Level1PlanTask[]>

export const getLevel1BusinessScopeKey = (projectId: string, kind: 'market' | 'tos', value: string) => (
  JSON.stringify([projectId, kind, value])
)

export function captureLevel1BusinessTasks(projectType: string, tasks: readonly Level1PlanTask[]): Level1BusinessTasks {
  return Object.fromEntries(tasks.filter(stage => isBusinessStage(projectType, stage)).map(stage => [
    stage.stableId!,
    tasks.filter(task => task.parentId === stage.id).map(task => ({ ...task })),
  ]))
}

/** Apply only the shared children; retain this version's stage IDs and other milestone values. */
export function applyLevel1BusinessTasks(
  projectType: string,
  tasks: readonly Level1PlanTask[],
  shared: Level1BusinessTasks | undefined,
): Level1PlanTask[] {
  if (!shared) return [...tasks]
  const stages = tasks.filter(stage => isBusinessStage(projectType, stage) && shared[stage.stableId!] !== undefined)
  const replacedParentIds = new Set(stages.map(stage => stage.id))
  const existingByStableId = new Map(tasks.map(task => [task.stableId || task.id, task]))
  const retained = tasks.filter(task => !task.parentId || !replacedParentIds.has(task.parentId))
  const usedIds = new Set(retained.map(task => task.id))
  const children = stages.flatMap(stage => shared[stage.stableId!].map(task => {
    const stableId = task.stableId || task.id
    const existing = existingByStableId.get(stableId)
    let id = existing?.id || stableId
    for (let suffix = 1; usedIds.has(id); suffix += 1) id = `${stableId}-${suffix}`
    usedIds.add(id)
    return { ...task, stableId, id, parentId: stage.id }
  }))
  return [...retained, ...children]
}

/** Legacy machine live tasks are market-only; only project-keyed sources can establish ownership. */
export function selectLevel1BusinessSeedTasks(input: {
  projectType: string
  hasDraft: boolean
  liveTasks: readonly Level1PlanTask[]
  latestPublishedTasks?: readonly Level1PlanTask[]
  projectSeedTasks: readonly Level1PlanTask[]
}): Level1PlanTask[] {
  const tasks = input.latestPublishedTasks || (input.projectType === '整机产品项目' ? input.projectSeedTasks : input.liveTasks)
  return tasks.map(task => ({ ...task }))
}

/** Recover only identities owned by exactly one real latest snapshot, never a synthetic seed. */
export function restoreOwnedLegacyLevel1BusinessTasks(input: {
  marketTasks: Record<string, { tasks?: Level1PlanTask[] }>
  versionsByKey: Record<string, Array<{ id: string; versionNo: string; status?: string }>>
  fallbackVersions: Array<{ id: string; versionNo: string; status?: string }>
  originalSnapshots: Record<string, Level1PlanTask[]>
  snapshots: Record<string, Level1PlanTask[]>
  sharedByScope: Record<string, Level1BusinessTasks>
}) {
  const projectType = '整机产品项目'
  const owners = new Map<string, Array<{ scope: string; snapshotKey: string; stage: string }>>()
  const identity = (market: string, stage: string, stableId: string) => JSON.stringify([market, stage, stableId])
  for (const [snapshotKey, tasks] of Object.entries(input.originalSnapshots)) {
    const match = /^project::([^:]+)::([^:]+)::level1::([^:]+)$/.exec(snapshotKey)
    if (!match || !Array.isArray(tasks)) continue
    const [, projectId, market, versionId] = match
    const versions = input.versionsByKey[`project::${projectId}::${market}::level1::versions`] || input.fallbackVersions
    const latest = versions.filter(version => version.status === '已发布').sort((a, b) => comparePlanVersions(b, a))[0]
    if (latest?.id !== versionId) continue
    const scope = getLevel1BusinessScopeKey(projectId, 'market', market)
    for (const [stage, children] of Object.entries(captureLevel1BusinessTasks(projectType, tasks))) {
      for (const task of children) {
        if (!task.stableId) continue
        const key = identity(market, stage, task.stableId)
        owners.set(key, [...(owners.get(key) || []), { scope, snapshotKey, stage }])
      }
    }
  }
  const sharedByScope = { ...input.sharedByScope }
  const snapshots = { ...input.snapshots }
  for (const [market, entry] of Object.entries(input.marketTasks)) {
    if (!Array.isArray(entry?.tasks)) continue
    for (const [stage, children] of Object.entries(captureLevel1BusinessTasks(projectType, entry.tasks))) {
      for (const task of children) {
        if (!task.stableId) continue
        const matches = owners.get(identity(market, stage, task.stableId)) || []
        if (matches.length !== 1) continue
        const owner = matches[0]
        if (input.sharedByScope[owner.scope]) continue
        const shared = sharedByScope[owner.scope] || captureLevel1BusinessTasks(projectType, snapshots[owner.snapshotKey])
        sharedByScope[owner.scope] = {
          ...shared,
          [stage]: shared[stage].map(existing => existing.stableId === task.stableId ? { ...task } : existing),
        }
        snapshots[owner.snapshotKey] = applyLevel1BusinessTasks(projectType, snapshots[owner.snapshotKey], sharedByScope[owner.scope])
      }
    }
  }
  return { sharedByScope, snapshots }
}
