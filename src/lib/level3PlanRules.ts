import type {
  Level3Activity,
  Level3ActivityFormValue,
  Level3ActivityPermissions,
  Level3ActivityViewRow,
  Level3DeleteResult,
  Level3Milestone,
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

const dateDifference = (start: string, end: string): number | null => {
  if (!start || !end) return null
  const startTime = Date.parse(`${start}T00:00:00Z`)
  const endTime = Date.parse(`${end}T00:00:00Z`)
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return null
  return Math.round((endTime - startTime) / 86_400_000)
}

const dateMin = (values: string[]) => values.filter(Boolean).sort()[0] || ''
const dateMax = (values: string[]) => values.filter(Boolean).sort().at(-1) || ''

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

export function forkLevel3ScopeData(
  source: Level3ScopeData,
  target?: Level3ScopeData,
): Level3ScopeData {
  const historyById = new Map([
    ...source.history.map(log => [log.id, log] as const),
    ...(target?.history || []).map(log => [log.id, log] as const),
  ])
  const targetColumnSettings = target?.columnSettings
  return {
    activities: source.activities.map(activity => ({ ...activity })),
    history: [...historyById.values()].map(log => ({
      ...log,
      changes: log.changes.map(change => ({ ...change })),
    })),
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
  }
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
  if (activeIsParent !== overIsParent) {
    return { ok: false, activities: cloneActivities(activities), reason: '仅支持同级活动拖动' }
  }

  const fromParentId = active.parentId
  const toParentId = over.parentId
  const fromSiblings = sortByOrder(next.filter(activity => activity.parentId === fromParentId))
  const fromIndex = fromSiblings.findIndex(activity => activity.id === active.id)
  const targetSiblings = sortByOrder(next.filter(activity => activity.parentId === toParentId && activity.id !== active.id))
  const overIndex = targetSiblings.findIndex(activity => activity.id === over.id)
  if (fromIndex < 0 || overIndex < 0) {
    return { ok: false, activities: cloneActivities(activities), reason: '无法确定拖动位置' }
  }

  const sameParent = fromParentId === toParentId
  const insertionIndex = sameParent
    ? (fromIndex < over.order ? overIndex + 1 : overIndex)
    : overIndex + 1
  targetSiblings.splice(Math.max(0, insertionIndex), 0, active)
  active.parentId = toParentId
  normalizeSiblingOrders(next, fromParentId)
  targetSiblings.forEach((activity, order) => {
    activity.order = order
  })
  normalizeSiblingOrders(next, toParentId)

  return {
    ok: true,
    activities: flattenActivityTree(next),
    activeId,
    fromParentId,
    toParentId,
    fromIndex,
    toIndex: targetSiblings.findIndex(activity => activity.id === active.id),
  }
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
    canDrag: isElevated || isParentOwner,
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
