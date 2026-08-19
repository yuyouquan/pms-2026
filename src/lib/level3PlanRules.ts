import type {
  Level3Activity,
  Level3ActivityFormValue,
  Level3ActivityRisk,
  Level3ActivityPermissions,
  Level3ActivityStatus,
  Level3ActivityViewRow,
  Level3ChangeLog,
  Level3ActualDateOverride,
  Level3ActualDateOverrideMap,
  Level3WorkflowOverride,
  Level3WorkflowOverrideMap,
  Level3DeleteResult,
  Level3Milestone,
  Level3MovePermission,
  Level3MoveResult,
  Level3ParentRollup,
  Level3PermissionContext,
  Level3ScopeInput,
  Level3ScopeKind,
  Level3ScopeData,
  Level3ScopeFork,
  Level3ScopeResolution,
  Level3ValidationResult,
  NumberedLevel3Activity,
} from '@/types/level3Plan'

const cloneActivities = (activities: Level3Activity[]) => activities.map(activity => ({ ...activity }))

const sortByOrder = <T extends { order: number }>(items: T[]) => (
  [...items].sort((left, right) => left.order - right.order)
)

const normalizeSiblingOrders = (activities: Level3Activity[], parentId: string | null) => {
  const siblings = sortByOrder(activities.filter(activity => activity.parentId === parentId))
  siblings.forEach((activity, order) => {
    activity.order = order
  })
}

const flattenActivityTree = (activities: Level3Activity[]) => {
  const roots = sortByOrder(activities.filter(activity => !activity.parentId))
  const result: Level3Activity[] = []
  roots.forEach(root => {
    result.push(root)
    result.push(...sortByOrder(activities.filter(activity => activity.parentId === root.id)))
  })
  const included = new Set(result.map(activity => activity.id))
  result.push(...sortByOrder(activities.filter(activity => !included.has(activity.id))))
  return result
}

const hasSameLevel3ActivityStructure = (left: Level3Activity[], right: Level3Activity[]) => {
  const leftTree = flattenActivityTree(left)
  const rightTree = flattenActivityTree(right)
  return leftTree.length === rightTree.length && leftTree.every((activity, index) => (
    activity.id === rightTree[index]?.id && activity.parentId === rightTree[index]?.parentId
  ))
}

const dateDifference = (start: string, end: string): number | null => {
  if (!start || !end) return null
  const startTime = Date.parse(`${start}T00:00:00Z`)
  const endTime = Date.parse(`${end}T00:00:00Z`)
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return null
  return Math.round((endTime - startTime) / 86_400_000)
}

const dateMin = (values: string[]) => values.filter(Boolean).sort()[0] || ''
const dateMax = (values: string[]) => values.filter(Boolean).sort().at(-1) || ''

export function normalizeLevel3Remark(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function getLevel3RemarkDisplay(value: unknown): { value: string; empty: boolean } {
  const normalized = normalizeLevel3Remark(value)
  return { value: normalized, empty: normalized.length === 0 }
}

const LEVEL3_RISK_PRIORITY: Record<Level3ActivityRisk, number> = {
  无: 0,
  低: 1,
  中: 2,
  高: 3,
}

const getParentStatus = (children: Level3Activity[]): Level3ActivityStatus => {
  if (children.length === 0 || children.every(child => child.status === '待启动')) return '待启动'
  if (children.every(child => child.status === '已完成')) return '已完成'
  return '进行中'
}

const getParentRisk = (children: Level3Activity[]): Level3ActivityRisk => (
  children.reduce<Level3ActivityRisk>((highest, child) => (
    LEVEL3_RISK_PRIORITY[child.risk] > LEVEL3_RISK_PRIORITY[highest] ? child.risk : highest
  ), '无')
)

export function getLevel3ScopeKey(projectId: string, kind: Level3ScopeKind, value: string): string {
  return `${projectId}::${kind}::${value}`
}

export function resolveLevel3Scope(input: Level3ScopeInput): Level3ScopeResolution {
  const sourceValue = input.followsMain && input.mainValue ? input.mainValue : input.value
  return {
    selectedScopeKey: getLevel3ScopeKey(input.projectId, input.kind, input.value),
    scopeKey: getLevel3ScopeKey(input.projectId, input.kind, sourceValue),
    selectedValue: input.value,
    sourceValue,
    readOnly: sourceValue !== input.value,
  }
}

export function resolveLevel3DetachedScopeFork(
  previous: Level3ScopeInput,
  next: Level3ScopeInput,
): Level3ScopeFork | null {
  if (
    previous.projectId !== next.projectId
    || previous.kind !== next.kind
    || previous.value !== next.value
  ) return null
  const previousResolution = resolveLevel3Scope(previous)
  const nextResolution = resolveLevel3Scope(next)
  if (!previousResolution.readOnly || nextResolution.readOnly) return null
  if (previousResolution.scopeKey === nextResolution.scopeKey) return null
  return {
    sourceScopeKey: previousResolution.scopeKey,
    targetScopeKey: nextResolution.scopeKey,
  }
}

export function mergeLevel3Histories(
  sourceHistory: Level3ChangeLog[],
  selectedScopeHistory: Level3ChangeLog[] = [],
): Level3ChangeLog[] {
  const historyById = new Map([
    ...sourceHistory.map(log => [log.id, log] as const),
    ...selectedScopeHistory.map(log => [log.id, log] as const),
  ])
  return [...historyById.values()]
    .sort((left, right) => (
      right.occurredAt.localeCompare(left.occurredAt) || left.id.localeCompare(right.id)
    ))
    .map(log => ({
      ...log,
      changes: log.changes.map(change => ({ ...change })),
    }))
}

export function forkLevel3ScopeData(
  source: Level3ScopeData,
  target?: Level3ScopeData,
  actualOverrides: Level3ActualDateOverrideMap = {},
  workflowOverrides: Level3WorkflowOverrideMap = {},
): Level3ScopeData {
  const targetColumnSettings = target?.columnSettings
  return {
    activities: mergeLevel3WorkflowOverrides(
      mergeLevel3ActualDateOverrides(source.activities, actualOverrides),
      workflowOverrides,
    ),
    history: mergeLevel3Histories(source.history, target?.history),
    collapsedIds: [...source.collapsedIds],
    columnSettings: {
      order: [...(targetColumnSettings?.order || source.columnSettings.order)],
      visible: [...(targetColumnSettings?.visible || source.columnSettings.visible)],
    },
  }
}

export function numberLevel3Activities(activities: Level3Activity[]): NumberedLevel3Activity[] {
  const normalized = cloneActivities(activities)
  normalizeSiblingOrders(normalized, null)
  normalized.filter(activity => !activity.parentId).forEach(parent => normalizeSiblingOrders(normalized, parent.id))
  const parents = sortByOrder(normalized.filter(activity => !activity.parentId))
  const parentNumbers = new Map(parents.map((parent, index) => [parent.id, String(index + 1)]))
  return flattenActivityTree(normalized).map(activity => {
    if (!activity.parentId) {
      return { ...activity, number: parentNumbers.get(activity.id) || '', depth: 0 }
    }
    const parentNumber = parentNumbers.get(activity.parentId) || ''
    const siblings = sortByOrder(normalized.filter(item => item.parentId === activity.parentId))
    const childIndex = siblings.findIndex(item => item.id === activity.id)
    return {
      ...activity,
      number: parentNumber ? `${parentNumber}.${childIndex + 1}` : String(childIndex + 1),
      depth: 1,
    }
  })
}

export function getLevel3NumberIndent(depth: number): number {
  return Math.max(0, depth) * 32
}

export function getLevel3ParentRollup(parentId: string, activities: Level3Activity[]): Level3ParentRollup {
  const children = activities.filter(activity => activity.parentId === parentId)
  const planStartDate = dateMin(children.map(activity => activity.planStartDate))
  const planEndDate = dateMax(children.map(activity => activity.planEndDate))
  const actualStartDate = dateMin(children.map(activity => activity.actualStartDate))
  const actualEndDate = dateMax(children.map(activity => activity.actualEndDate))
  return {
    planStartDate,
    planEndDate,
    estimatedDays: dateDifference(planStartDate, planEndDate),
    actualStartDate,
    actualEndDate,
    actualDays: dateDifference(actualStartDate, actualEndDate),
    status: getParentStatus(children),
    risk: getParentRisk(children),
  }
}

export function createLevel3ActualDateOverride(
  displayedActivity: Level3Activity,
  existing: Level3ActualDateOverride | undefined,
  patch: Pick<Partial<Level3Activity>, 'actualStartDate' | 'actualEndDate'>,
  actor: string,
  occurredAt: string,
): Level3ActualDateOverride {
  const frozen = existing || {
    activityId: displayedActivity.id,
    actualStartDate: displayedActivity.actualStartDate,
    actualEndDate: displayedActivity.actualEndDate,
    detachedBy: actor,
    detachedAt: occurredAt,
  }
  return {
    ...frozen,
    ...(patch.actualStartDate !== undefined ? { actualStartDate: patch.actualStartDate } : {}),
    ...(patch.actualEndDate !== undefined ? { actualEndDate: patch.actualEndDate } : {}),
    activityId: displayedActivity.id,
    detachedBy: actor,
    detachedAt: occurredAt,
  }
}

export function mergeLevel3ActualDateOverrides(
  activities: Level3Activity[],
  overrides: Level3ActualDateOverrideMap,
): Level3Activity[] {
  return activities.map(activity => {
    const override = overrides[activity.id]
    return override
      ? { ...activity, actualStartDate: override.actualStartDate, actualEndDate: override.actualEndDate }
      : { ...activity }
  })
}

export function createLevel3WorkflowOverride(
  displayedActivity: Level3Activity,
  existing: Level3WorkflowOverride | undefined,
  patch: Pick<Partial<Level3Activity>, 'status' | 'risk'>,
  actor: string,
  occurredAt: string,
): Level3WorkflowOverride {
  return {
    ...(existing || { activityId: displayedActivity.id, detachedBy: actor, detachedAt: occurredAt }),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.risk !== undefined ? { risk: patch.risk } : {}),
    activityId: displayedActivity.id,
    detachedBy: actor,
    detachedAt: occurredAt,
  }
}

export function mergeLevel3WorkflowOverrides(
  activities: Level3Activity[],
  overrides: Level3WorkflowOverrideMap,
): Level3Activity[] {
  return activities.map(activity => {
    const override = overrides[activity.id]
    return {
      ...activity,
      ...(override?.status !== undefined ? { status: override.status } : {}),
      ...(override?.risk !== undefined ? { risk: override.risk } : {}),
    }
  })
}

export function applyLevel3Rollups(activities: Level3Activity[]): Level3ActivityViewRow[] {
  return numberLevel3Activities(activities).map(activity => {
    if (activity.parentId) {
      return {
        ...activity,
        estimatedDays: dateDifference(activity.planStartDate, activity.planEndDate),
        actualDays: dateDifference(activity.actualStartDate, activity.actualEndDate),
      }
    }
    return { ...activity, ...getLevel3ParentRollup(activity.id, activities) }
  })
}

export function validateLevel3ChildDates(
  values: Level3ActivityFormValue,
  milestone: Level3Milestone | undefined,
): Level3ValidationResult {
  const errors: string[] = []
  if (values.planStartDate && values.planEndDate && values.planStartDate > values.planEndDate) {
    errors.push('计划开始时间不能晚于计划完成时间')
  }
  if (values.planEndDate && milestone?.planEndDate && values.planEndDate > milestone.planEndDate) {
    errors.push(`计划完成时间不能晚于关键节点「${milestone.name}」的计划完成时间 ${milestone.planEndDate}`)
  }
  if (values.actualStartDate && values.actualEndDate && values.actualStartDate > values.actualEndDate) {
    errors.push('实际开始时间不能晚于实际完成时间')
  }
  return { ok: errors.length === 0, errors }
}

export function moveLevel3Activity(
  activities: Level3Activity[],
  activeId: string,
  overId: string,
): Level3MoveResult {
  const next = cloneActivities(activities)
  const active = next.find(activity => activity.id === activeId)
  const over = next.find(activity => activity.id === overId)
  if (!active || !over) return { ok: false, activities: cloneActivities(activities), reason: '未找到拖动活动' }
  const activeIsParent = !active.parentId
  const overIsParent = !over.parentId
  const fromParentId = active.parentId
  const fromSiblings = sortByOrder(next.filter(activity => activity.parentId === fromParentId))
  const fromIndex = fromSiblings.findIndex(activity => activity.id === active.id)
  if (fromIndex < 0) return { ok: false, activities: cloneActivities(activities), reason: '无法确定拖动位置' }
  if (activeId === overId) {
    return {
      ok: true,
      changed: false,
      activities: flattenActivityTree(next),
      activeId,
      fromParentId,
      toParentId: fromParentId,
      fromIndex,
      toIndex: fromIndex,
    }
  }
  if (activeIsParent && !overIsParent) {
    return { ok: false, activities: cloneActivities(activities), reason: '父活动仅支持拖动到父活动' }
  }
  const toParentId = activeIsParent ? null : (overIsParent ? over.id : over.parentId)
  if (!activeIsParent && !toParentId) {
    return { ok: false, activities: cloneActivities(activities), reason: '未找到目标父活动' }
  }
  if (!activeIsParent) {
    const sourceParent = next.find(activity => activity.id === fromParentId)
    const targetParent = next.find(activity => activity.id === toParentId)
    if (!sourceParent || sourceParent.parentId || !targetParent || targetParent.parentId) {
      return { ok: false, activities: cloneActivities(activities), reason: '父子层级无效' }
    }
  }
  const targetSiblings = sortByOrder(next.filter(activity => activity.parentId === toParentId && activity.id !== active.id))
  const reorderingWithinSameSiblings = fromParentId === toParentId && (activeIsParent || !overIsParent)
  const overIndex = fromSiblings.findIndex(activity => activity.id === over.id)
  const insertionIndex = reorderingWithinSameSiblings
    ? (() => {
      const targetIndex = targetSiblings.findIndex(activity => activity.id === over.id)
      return fromIndex < overIndex ? targetIndex + 1 : targetIndex
    })()
    : activeIsParent
      ? targetSiblings.findIndex(activity => activity.id === over.id)
    : (overIsParent ? targetSiblings.length : targetSiblings.findIndex(activity => activity.id === over.id))
  if (insertionIndex < 0) return { ok: false, activities: cloneActivities(activities), reason: '无法确定拖动位置' }
  targetSiblings.splice(insertionIndex, 0, active)
  active.parentId = toParentId
  if (fromParentId !== toParentId) normalizeSiblingOrders(next, fromParentId)
  targetSiblings.forEach((activity, order) => {
    activity.order = order
  })
  normalizeSiblingOrders(next, toParentId)

  const resultActivities = flattenActivityTree(next)
  return {
    ok: true,
    changed: !hasSameLevel3ActivityStructure(activities, resultActivities),
    activities: resultActivities,
    activeId,
    fromParentId,
    toParentId,
    fromIndex,
    toIndex: targetSiblings.findIndex(activity => activity.id === active.id),
  }
}

export function getLevel3MovePermission(
  activeId: string,
  overId: string,
  activities: Level3Activity[],
  context: Level3PermissionContext,
  readOnly: boolean,
): Level3MovePermission {
  if (readOnly) return { allowed: false, reason: '跟随范围不支持拖动' }
  const active = activities.find(activity => activity.id === activeId)
  const over = activities.find(activity => activity.id === overId)
  if (!active || !over) return { allowed: false, reason: '未找到拖动活动' }
  if (activeId === overId) return { allowed: false, reason: '拖动位置未变化' }
  const activeIsParent = !active.parentId
  const overIsParent = !over.parentId
  if (activeIsParent) {
    if (!overIsParent) return { allowed: false, reason: '父活动仅支持拖动到父活动' }
    const permissions = getLevel3ActivityPermissions(active, activities, context)
    return permissions.canDrag ? { allowed: true } : { allowed: false, reason: '无拖动权限' }
  }
  const sourceParent = activities.find(activity => activity.id === active.parentId)
  const targetParent = overIsParent ? over : activities.find(activity => activity.id === over.parentId)
  if (!sourceParent || sourceParent.parentId || !targetParent || targetParent.parentId) {
    return { allowed: false, reason: '父子层级无效' }
  }
  const isElevated = context.structuralAdministratorUsers.includes(context.currentUser)
    || context.spmUsers.includes(context.currentUser)
  if (isElevated) return { allowed: true }
  if (sourceParent.responsible !== context.currentUser) return { allowed: false, reason: '仅父活动责任人可拖动子活动' }
  if (sourceParent.id !== targetParent.id && targetParent.responsible !== context.currentUser) {
    return { allowed: false, reason: '仅可拖动到本人负责的父活动' }
  }
  return { allowed: true }
}

export function filterLevel3HistoryForActivity(
  history: Level3ChangeLog[],
  activity: Level3Activity,
  activities: Level3Activity[],
): Level3ChangeLog[] {
  if (activity.parentId) return history.filter(log => log.activityId === activity.id)
  const currentChildIds = new Set(activities.filter(item => item.parentId === activity.id).map(item => item.id))
  return history.filter(log => (
    log.activityId === activity.id
    || log.parentActivityId === activity.id
    || log.sourceParentActivityId === activity.id
    || log.targetParentActivityId === activity.id
    || (
      currentChildIds.has(log.activityId)
      && !log.parentActivityId
      && !log.sourceParentActivityId
      && !log.targetParentActivityId
    )
  ))
}

export function deleteLevel3ActivityTree(
  activities: Level3Activity[],
  activityId: string,
): Level3DeleteResult {
  const target = activities.find(activity => activity.id === activityId)
  if (!target) {
    return {
      ok: false,
      activities: cloneActivities(activities),
      deletedActivities: [],
      reason: '未找到待删除活动',
    }
  }
  const deletedIds = new Set([activityId])
  let foundDescendant = true
  while (foundDescendant) {
    foundDescendant = false
    activities.forEach(activity => {
      if (activity.parentId && deletedIds.has(activity.parentId) && !deletedIds.has(activity.id)) {
        deletedIds.add(activity.id)
        foundDescendant = true
      }
    })
  }
  const deletedActivities = activities.filter(activity => deletedIds.has(activity.id)).map(activity => ({ ...activity }))
  const remaining = cloneActivities(activities.filter(activity => !deletedIds.has(activity.id)))
  normalizeSiblingOrders(remaining, target.parentId)
  return {
    ok: true,
    activities: flattenActivityTree(remaining),
    deletedActivities,
  }
}

export function getLevel3ActivityPermissions(
  activity: Level3Activity | undefined,
  activities: Level3Activity[],
  context: Level3PermissionContext,
): Level3ActivityPermissions {
  const isAdministrator = context.administratorUsers.includes(context.currentUser)
  const isStructuralAdministrator = context.structuralAdministratorUsers.includes(context.currentUser)
  const isSpm = context.spmUsers.includes(context.currentUser)
  const isElevated = isAdministrator || isSpm
  if (!activity) {
    return { canCreateParent: isElevated, canEdit: false, canAddChild: false, canDrag: false, canDelete: false }
  }
  const parent = activity.parentId
    ? activities.find(item => item.id === activity.parentId)
    : activity
  const isParentOwner = parent?.responsible === context.currentUser
  const isActivityOwner = activity.responsible === context.currentUser
  const canEdit = isElevated || isParentOwner || isActivityOwner
  return {
    canCreateParent: isElevated,
    canEdit,
    canAddChild: !activity.parentId && (isElevated || isParentOwner),
    canDrag: isStructuralAdministrator || isSpm || isParentOwner,
    canDelete: canEdit,
  }
}

export function canInlineEditLevel3ActualDate(
  activity: Level3Activity | undefined,
  activities: Level3Activity[],
  context: Level3PermissionContext,
  readOnly: boolean,
): boolean {
  if (readOnly || !activity?.parentId) return false
  return getLevel3ActivityPermissions(activity, activities, context).canEdit
}

export function canInlineEditLevel3ChildField(
  activity: Level3Activity | undefined,
  activities: Level3Activity[],
  context: Level3PermissionContext,
): boolean {
  return Boolean(activity?.parentId && getLevel3ActivityPermissions(activity, activities, context).canEdit)
}

export function shouldShowLevel3CreateButton(readOnly: boolean): boolean {
  return !readOnly
}

export function filterLevel3ActivitiesWithParents(
  rows: NumberedLevel3Activity[],
  matchedIds: Set<string>,
): NumberedLevel3Activity[] {
  if (matchedIds.size === 0) return []
  const includedIds = new Set(matchedIds)
  rows.forEach(row => {
    if (matchedIds.has(row.id) && row.parentId) includedIds.add(row.parentId)
    if (matchedIds.has(row.id) && !row.parentId) {
      rows.filter(child => child.parentId === row.id).forEach(child => includedIds.add(child.id))
    }
  })
  return rows.filter(row => includedIds.has(row.id))
}
