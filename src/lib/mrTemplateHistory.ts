import type { MrTemplateChangeLog } from '@/types/mrVersionPlan'

export function resolveMrTemplateHistoryActivityLabel(
  log: MrTemplateChangeLog,
  currentActivityNames: ReadonlyMap<string, string>,
): string {
  if (!log.activityId) return '整个修订版本'
  const stableName = log.activityName?.trim()
  if (stableName) return stableName
  const before = log.before?.trim()
  const after = log.after?.trim()
  if (log.action === 'add' && after) return after
  if (log.action === 'rename') return after || before || currentActivityNames.get(log.activityId) || log.activityId
  if (log.action === 'delete' && before) return before
  return currentActivityNames.get(log.activityId) || after || before || log.activityId
}
