import { getProjectLevel1MockSnapshotKey } from '@/data/projectListPlanMocks'
import { getProjectMarketSnapshotKey } from '@/lib/marketRules'

export type ComparisonVersion = {
  id: string
  status: string
}

export type ComparisonSnapshotScope =
  | { kind: 'market'; projectId: string; market: string }
  | { kind: 'project'; projectId: string }
  | { kind: 'global' }

const comparisonSnapshotKey = (scope: ComparisonSnapshotScope, versionId: string) => {
  if (scope.kind === 'market') return getProjectMarketSnapshotKey(scope.projectId, scope.market, versionId)
  if (scope.kind === 'project') return getProjectLevel1MockSnapshotKey(scope.projectId, versionId)
  return versionId
}

/** Seeds missing historical snapshots without replacing an already published scope. */
export const ensurePublishedComparisonSnapshots = <T>(input: {
  publishedSnapshots: Record<string, T[]>
  versions: readonly ComparisonVersion[]
  scope: ComparisonSnapshotScope
  seedTasks: readonly T[]
}): Record<string, T[]> => {
  const { publishedSnapshots, versions, scope, seedTasks } = input
  let next = publishedSnapshots
  versions.forEach(version => {
    if (version.status !== '已发布') return
    const key = comparisonSnapshotKey(scope, version.id)
    if (next[key] !== undefined) return
    if (next === publishedSnapshots) next = { ...publishedSnapshots }
    next[key] = JSON.parse(JSON.stringify(seedTasks))
  })
  return next
}

/**
 * Resolves a published plan only from its own persistence scope.  In
 * particular, a market comparison must never fall back to another market's
 * snapshot (or the unscoped template key with the same version id).
 */
export const resolveComparisonVersionTasks = <T>(input: {
  version: ComparisonVersion
  effectiveTasks: T[]
  publishedSnapshots: Record<string, T[]>
  scope: ComparisonSnapshotScope
}): T[] => {
  const { version, effectiveTasks, publishedSnapshots, scope } = input
  if (version.status !== '已发布') return effectiveTasks

  if (scope.kind === 'market') {
    return publishedSnapshots[comparisonSnapshotKey(scope, version.id)] || effectiveTasks
  }
  if (scope.kind === 'project') {
    return publishedSnapshots[comparisonSnapshotKey(scope, version.id)] || publishedSnapshots[version.id] || effectiveTasks
  }
  return publishedSnapshots[version.id] || effectiveTasks
}
