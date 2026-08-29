import { PROJECT_TYPE_TOS_VERSION, isMachineProjectType } from '@/constants/projectTypes'
import {
  getMainMarket,
  getMarketVersions,
  getProjectMarketSnapshotKey,
  normalizeMarketRows,
  type MarketConfigRow,
  type MarketVersionsState,
} from '@/lib/marketRules'
import { getProjectInfoValue, type ProjectInfoProject } from '@/lib/projectInfoValues'
import { normalizeTosSnapshot } from '@/lib/enumConsumers'
import { normalizeMrBusinessDate } from '@/lib/mrVersionPlanRules'
import {
  getMainTosType,
  getTosTypeSnapshotKey,
  getTosTypeVersions,
  type TosTypeConfigRow,
  type TosTypeVersionsState,
} from '@/lib/tosTypeRules'
import type { ProjectItem } from '@/types/app'
import type {
  MrAggregationSources,
  MrLevel1TaskLike,
  MrMachineMetadata,
  MrPlanVersionLike,
  MrPublishedLevel1Source,
} from '@/types/mrVersionPlan'

type SnapshotState = Readonly<Record<string, readonly MrLevel1TaskLike[] | undefined>>

export interface TosLevel1AdapterInput {
  project: ProjectItem
  tosTypeRows: readonly TosTypeConfigRow[]
  tosTypeVersionsByKey: TosTypeVersionsState
  publishedSnapshots: SnapshotState
  fallbackVersions: readonly MrPlanVersionLike[]
}

export interface MachineLevel1AdapterInput {
  project: ProjectItem
  marketRows: readonly MarketConfigRow[]
  marketVersionsByKey: MarketVersionsState
  publishedSnapshots: SnapshotState
  fallbackVersions: readonly MrPlanVersionLike[]
}

export interface MrStoreAdapterInput {
  projects: readonly ProjectItem[]
  marketConfigsByProjectId: Readonly<Record<string, readonly MarketConfigRow[] | undefined>>
  tosTypeConfigsByProjectId: Readonly<Record<string, readonly TosTypeConfigRow[] | undefined>>
  marketVersionsByKey: MarketVersionsState
  tosTypeVersionsByKey: TosTypeVersionsState
  publishedSnapshots: SnapshotState
  fallbackVersions: readonly MrPlanVersionLike[]
}

function cloneVersions(versions: readonly MrPlanVersionLike[]): MrPlanVersionLike[] {
  return versions.map(version => ({ ...version }))
}

function normalizeTask(task: MrLevel1TaskLike): MrLevel1TaskLike {
  return {
    ...task,
    planStartDate: normalizeMrBusinessDate(task.planStartDate),
    planEndDate: normalizeMrBusinessDate(task.planEndDate),
  }
}

function normalizeSnapshot(snapshot: readonly MrLevel1TaskLike[]): MrLevel1TaskLike[] {
  return snapshot.map(normalizeTask)
}

function parseVersionNo(versionNo: string): number[] | null {
  const value = String(versionNo || '').trim()
  if (!/^V\d+(?:\.\d+)*$/i.test(value)) return null
  const parts = value.slice(1).split('.').map(Number)
  return parts.every(Number.isSafeInteger) ? parts : null
}

function compareVersionNo(left: string, right: string): number {
  const leftParts = parseVersionNo(left)
  const rightParts = parseVersionNo(right)
  if (!leftParts || !rightParts) {
    if (leftParts) return 1
    if (rightParts) return -1
    return 0
  }
  const length = Math.max(leftParts.length, rightParts.length)
  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0)
    if (difference !== 0) return difference
  }
  return 0
}

function selectLatestPublished(
  versions: readonly MrPlanVersionLike[],
  getSnapshot: (versionId: string) => readonly MrLevel1TaskLike[] | undefined,
): MrPublishedLevel1Source | null {
  const latest = versions.reduce<MrPlanVersionLike | null>((current, version) => {
    if (version.status !== '已发布' || !parseVersionNo(version.versionNo)) return current
    return !current || compareVersionNo(version.versionNo, current.versionNo) > 0 ? version : current
  }, null)
  if (!latest) return null
  const snapshot = getSnapshot(latest.id)
  if (!snapshot) return null

  const clonedVersions = cloneVersions(versions)
  const tasks = normalizeSnapshot(snapshot)
  return {
    versions: clonedVersions,
    versionId: latest.id,
    versionNo: latest.versionNo,
    tasks,
    getSnapshot: versionId => {
      if (versionId === latest.id) return normalizeSnapshot(snapshot)
      const otherSnapshot = getSnapshot(versionId)
      return otherSnapshot ? normalizeSnapshot(otherSnapshot) : undefined
    },
  }
}

export function selectLatestPublishedTosLevel1(input: TosLevel1AdapterInput): MrPublishedLevel1Source | null {
  const primaryType = getMainTosType([...input.tosTypeRows])
  if (!primaryType) return null
  const versions = getTosTypeVersions(
    input.tosTypeVersionsByKey,
    input.project.id,
    primaryType,
    'level1',
    cloneVersions(input.fallbackVersions),
  )
  return selectLatestPublished(versions, versionId => (
    input.publishedSnapshots[getTosTypeSnapshotKey(input.project.id, primaryType, 'level1', versionId)]
  ))
}

export function selectLatestPublishedMachineLevel1(input: MachineLevel1AdapterInput): MrPublishedLevel1Source | null {
  const marketRows = normalizeMarketRows([...input.marketRows])
  const mainMarket = getMainMarket(marketRows)
  if (!mainMarket) return null
  const versions = getMarketVersions(
    input.marketVersionsByKey,
    input.project.id,
    mainMarket,
    cloneVersions(input.fallbackVersions),
  )
  return selectLatestPublished(versions, versionId => (
    input.publishedSnapshots[getProjectMarketSnapshotKey(input.project.id, mainMarket, versionId)]
  ))
}

function text(value: unknown): string {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean).join(',')
  return typeof value === 'string' ? value.trim() : ''
}

function projectValue(project: ProjectItem, key: string) {
  return getProjectInfoValue(project as unknown as ProjectInfoProject, key)
}

export function projectMachineMrMetadata(
  project: ProjectItem,
  marketRows: readonly MarketConfigRow[],
): MrMachineMetadata {
  const normalizedRows = normalizeMarketRows([...marketRows])
  return {
    projectName: project.name.trim(),
    marketName: getMainMarket(normalizedRows),
    productLine: text(projectValue(project, 'productLine')),
    spm: text(projectValue(project, 'machineSpm')),
    isMada: normalizedRows.some(row => row.isMadaControlled === '是') ? '是' : '否',
    socPlatform: text(projectValue(project, 'chipModel'))
      || text(projectValue(project, 'platform'))
      || text(projectValue(project, 'chipPlatform')),
    packageMode: '/',
  }
}

export function getTosManagerUsers(project: ProjectItem): string[] {
  const value = projectValue(project, 'tosVersionProjectManager')
  const candidates = Array.isArray(value)
    ? value.filter((candidate): candidate is string => typeof candidate === 'string')
    : typeof value === 'string' ? [value] : []
  const seen = new Set<string>()
  return candidates.reduce<string[]>((users, candidate) => {
    const user = candidate.trim()
    if (!user || seen.has(user)) return users
    seen.add(user)
    users.push(user)
    return users
  }, [])
}

function getTosProjectKey(project: ProjectItem): string {
  const value = text(projectValue(project, 'tosVersion')) || project.name
  const match = value.match(/(?:tos)?\s*(\d+)\.(\d+)/i)
  return match ? `${Number(match[1])}.${Number(match[2])}` : ''
}

function getMachineProjectSource(project: ProjectItem) {
  return {
    id: project.id,
    projectName: project.name.trim(),
    productType: text(projectValue(project, 'productType')),
    firstSaleTosVersion: normalizeTosSnapshot(projectValue(project, 'firstSaleTosVersion')),
    currentTosVersion: normalizeTosSnapshot(projectValue(project, 'currentTosVersion')),
    spm: text(projectValue(project, 'machineSpm')),
  }
}

export function buildMrAggregationSources(input: MrStoreAdapterInput): MrAggregationSources {
  const result: MrAggregationSources = {
    tosProjects: [],
    machineProjects: [],
    latestPublishedLevel1ByProjectId: {},
    machineMetadataByProjectId: {},
    tosManagerUsersByProjectId: {},
  }

  const projects = [...input.projects].sort((left, right) => left.id.localeCompare(right.id, 'zh-CN'))
  projects.forEach(project => {
    if (project.type === PROJECT_TYPE_TOS_VERSION) {
      const source = selectLatestPublishedTosLevel1({
        project,
        tosTypeRows: input.tosTypeConfigsByProjectId[project.id] || [],
        tosTypeVersionsByKey: input.tosTypeVersionsByKey,
        publishedSnapshots: input.publishedSnapshots,
        fallbackVersions: input.fallbackVersions,
      })
      const tosProjectKey = getTosProjectKey(project)
      if (tosProjectKey) {
        result.tosProjects.push({ projectId: project.id, tosProjectKey, projectName: project.name.trim() })
      }
      if (source) result.latestPublishedLevel1ByProjectId[project.id] = source
      result.tosManagerUsersByProjectId[project.id] = getTosManagerUsers(project)
      return
    }

    if (!isMachineProjectType(project.type)) return
    const marketRows = input.marketConfigsByProjectId[project.id] || []
    const source = selectLatestPublishedMachineLevel1({
      project,
      marketRows,
      marketVersionsByKey: input.marketVersionsByKey,
      publishedSnapshots: input.publishedSnapshots,
      fallbackVersions: input.fallbackVersions,
    })
    result.machineProjects.push(getMachineProjectSource(project))
    result.machineMetadataByProjectId[project.id] = projectMachineMrMetadata(project, marketRows)
    if (source) result.latestPublishedLevel1ByProjectId[project.id] = source
  })

  return result
}
