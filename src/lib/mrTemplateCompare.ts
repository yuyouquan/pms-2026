import { numberMrTemplateActivities } from '@/lib/mrTemplateRules'
import type { MrTemplateActivity } from '@/types/mrVersionPlan'

export type MrTemplateChangeType = 'add' | 'remove' | 'rename' | 'reorder'

export interface MrTemplateSnapshotDiff {
  activityId: string
  number: string
  activityName: string
  changeType: MrTemplateChangeType
  before: string
  after: string
}

export function compareMrTemplateSnapshots(
  beforeRows: readonly MrTemplateActivity[],
  afterRows: readonly MrTemplateActivity[],
): MrTemplateSnapshotDiff[] {
  const before = numberMrTemplateActivities(beforeRows.map(row => ({ ...row })))
  const after = numberMrTemplateActivities(afterRows.map(row => ({ ...row })))
  const beforeById = new Map(before.map(row => [row.id, row]))
  const afterById = new Map(after.map(row => [row.id, row]))
  const diffs: MrTemplateSnapshotDiff[] = []

  after.forEach(row => {
    const previous = beforeById.get(row.id)
    if (!previous) {
      diffs.push({ activityId: row.id, number: row.number, activityName: row.activityName, changeType: 'add', before: '-', after: row.number })
      return
    }
    if (previous.activityName !== row.activityName) {
      diffs.push({ activityId: row.id, number: row.number, activityName: row.activityName, changeType: 'rename', before: previous.activityName, after: row.activityName })
    }
    if (previous.number !== row.number) {
      diffs.push({ activityId: row.id, number: row.number, activityName: row.activityName, changeType: 'reorder', before: previous.number, after: row.number })
    }
  })

  before.forEach(row => {
    if (afterById.has(row.id)) return
    diffs.push({ activityId: row.id, number: row.number, activityName: row.activityName, changeType: 'remove', before: row.number, after: '-' })
  })
  return diffs
}
