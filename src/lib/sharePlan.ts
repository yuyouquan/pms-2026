import { isMachineProjectType, PROJECT_TYPE_TECH, PROJECT_TYPE_TOS_VERSION } from '@/constants/projectTypes'
import { getProjectLevel1MockSnapshotKey } from '@/data/projectListPlanMocks'
import {
  buildMarketRowsFromMarkets, getMarketPlanVersionKey, getProjectMarketSnapshotKey,
  type MarketConfigRow, type PlanVersionLike,
} from '@/lib/marketRules'
import { comparePlanVersions, parsePlanVersionNo } from '@/lib/planVersioning'
import {
  buildTosTypeRows, getTosTypePlanSourceType, getTosTypeSnapshotKey, getTosTypeVersionKey,
  type TosTypeConfigRow,
} from '@/lib/tosTypeRules'
import type { PlanState } from '@/stores/plan'

interface ShareProject {
  id: string
  type: string
  markets?: readonly string[]
  versionTypes?: string[]
  versionType?: string
}

export interface SharedPlanScope {
  kind: 'market' | 'tos-type' | 'ordinary'
  value: string
  sourceValue: string
  isMain: boolean
}

interface SharedPlanQuery {
  project?: ShareProject
  level: string
  scopeValue?: string
  marketRows?: MarketConfigRow[]
  tosTypeRows?: TosTypeConfigRow[]
}

export const getSharedLevel1Scopes = ({ project, marketRows, tosTypeRows }: Omit<SharedPlanQuery, 'level'>): SharedPlanScope[] => {
  if (!project || project.type === PROJECT_TYPE_TECH) return []
  if (isMachineProjectType(project.type)) {
    return buildMarketRowsFromMarkets([...(project.markets || [])], marketRows)
      .map(row => ({ kind: 'market', value: row.market, sourceValue: row.market, isMain: row.isMain }))
  }
  if (project.type === PROJECT_TYPE_TOS_VERSION) {
    const rows = buildTosTypeRows(project.versionTypes, project.versionType, tosTypeRows)
    return rows.map(row => ({
      kind: 'tos-type', value: row.type,
      sourceValue: getTosTypePlanSourceType(rows, row.type, 'level1'), isMain: row.isMain,
    }))
  }
  return [{ kind: 'ordinary', value: 'default', sourceValue: 'default', isMain: true }]
}

type SharedPlanState = Pick<PlanState, 'versions' | 'marketVersionsByKey' | 'tosTypeVersionsByKey' | 'publishedSnapshots'>
type SharedPlanResult =
  | { ok: true; scope: SharedPlanScope; version: PlanVersionLike; tasks: any[] }
  | { ok: false }

/** Read only a project's latest published snapshot; local edits are never transported by the URL. */
export const resolveSharedLevel1Plan = (state: SharedPlanState, query: SharedPlanQuery): SharedPlanResult => {
  if (!query.project || query.level !== 'level1') return { ok: false }
  const projectId = query.project.id
  const scopes = getSharedLevel1Scopes(query)
  const scope = query.scopeValue
    ? scopes.find(candidate => candidate.value === query.scopeValue)
    : scopes.find(candidate => candidate.isMain) || scopes[0]
  if (!scope) return { ok: false }
  const versions = scope.kind === 'market'
    ? state.marketVersionsByKey[getMarketPlanVersionKey(projectId, scope.sourceValue)] ?? state.versions
    : scope.kind === 'tos-type'
      ? state.tosTypeVersionsByKey[getTosTypeVersionKey(projectId, scope.sourceValue, 'level1')] ?? state.versions
      : state.versions
  const version = versions
    .filter(candidate => candidate.status === '已发布' && parsePlanVersionNo(candidate.versionNo))
    .sort((left, right) => comparePlanVersions(right, left))[0]
  if (!version) return { ok: false }
  const snapshotKey = scope.kind === 'market'
    ? getProjectMarketSnapshotKey(projectId, scope.sourceValue, version.id)
    : scope.kind === 'tos-type'
      ? getTosTypeSnapshotKey(projectId, scope.sourceValue, 'level1', version.id)
      : getProjectLevel1MockSnapshotKey(projectId, version.id)
  const tasks = state.publishedSnapshots[snapshotKey]
  if (!Array.isArray(tasks)) return { ok: false }
  return { ok: true, scope: { ...scope }, version: { ...version }, tasks: JSON.parse(JSON.stringify(tasks)) }
}
