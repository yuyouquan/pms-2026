import { normalizeMrBusinessDate } from '@/lib/mrVersionPlanRules'
import { canonicalizeTosMrVersion } from '@/lib/mrAggregationRules'
import type {
  MrJointMachineRow,
  MrJointReferenceRow,
  MrMachineMetadata,
  MrPermissionResult,
  MrStopReleaseRecord,
  TosMrVersionInstance,
} from '@/types/mrVersionPlan'

const COLLECTION_START = '修改点收集开始时间'
export const MISSING_COLLECTION_START_REASON = '当前MR版本计划缺少修改点收集开始时间，无法判断停止范围'

type JointRow = MrJointReferenceRow | MrJointMachineRow

export interface StopReleaseCandidate {
  projectId: string
  projectName: string
  disabled: boolean
  reason?: string
}

interface BuildStopReleaseCandidatesInput {
  rows: readonly JointRow[]
  instances: readonly TosMrVersionInstance[]
  stopRecords: readonly MrStopReleaseRecord[]
  permissionsByProjectId: ReadonlyMap<string, MrPermissionResult>
  metadataByProjectId: Readonly<Record<string, MrMachineMetadata | undefined>>
}

function hasCollectionStart(instance: TosMrVersionInstance | undefined): boolean {
  const activity = instance?.activities.find(item => (
    item.parentId !== null && item.activityName.trim() === COLLECTION_START
  ))
  if (!activity) return false
  const value = instance?.dates[activity.id]
  if (typeof value !== 'string' || !value.trim()) return true
  return !!normalizeMrBusinessDate(value)
}

export function buildStopReleaseCandidates(input: BuildStopReleaseCandidatesInput): StopReleaseCandidate[] {
  const stopped = new Set(input.stopRecords.map(record => record.projectId.trim()))
  const rowsByProject = new Map<string, MrJointMachineRow[]>()
  input.rows.forEach(row => {
    if (row.kind !== 'machine' || stopped.has(row.projectId)) return
    const permission = input.permissionsByProjectId.get(row.projectId)
    if (!permission?.canStopRelease) return
    rowsByProject.set(row.projectId, [...(rowsByProject.get(row.projectId) ?? []), row])
  })

  return [...rowsByProject.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([projectId, rows]) => {
      const projectName = input.metadataByProjectId[projectId]?.projectName?.trim() || projectId
      const hasReference = rows.some(row => {
        const rowVersion = canonicalizeTosMrVersion(row.tosVersion)
        return !!rowVersion && hasCollectionStart(input.instances.find(instance => (
          instance.projectId === row.tosProjectId
          && canonicalizeTosMrVersion(instance.tosVersion) === rowVersion
        )))
      })
      return {
        projectId,
        projectName,
        disabled: !hasReference,
        ...(!hasReference ? { reason: MISSING_COLLECTION_START_REASON } : {}),
      }
    })
}

export function sortStopReleaseHistory(records: readonly MrStopReleaseRecord[]): MrStopReleaseRecord[] {
  return records.map(record => ({ ...record })).sort((left, right) => (
    right.operatedAt.localeCompare(left.operatedAt) || left.id.localeCompare(right.id)
  ))
}

export function resolveStopReleaseButtonReason(
  candidates: readonly StopReleaseCandidate[],
  visibleMachineRowCount: number,
): string | undefined {
  if (candidates.some(candidate => !candidate.disabled)) return undefined
  if (candidates.length) return MISSING_COLLECTION_START_REASON
  return visibleMachineRowCount > 0
    ? '当前用户没有可停止发版的项目'
    : '当前筛选结果没有可停止发版的项目'
}

export function formatStopReleaseOperatedAt(value: unknown): string {
  const source = typeof value === 'string' ? value.trim() : ''
  if (!source) return '-'
  const date = new Date(source)
  if (Number.isNaN(date.getTime())) return source
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const byType = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${byType.year}-${byType.month}-${byType.day} ${byType.hour}:${byType.minute}:${byType.second}`
}
