export interface ActualFieldsTask {
  id: string
  stableId?: string
  actualStartDate?: string
  actualEndDate?: string
  actualDays?: number | null
  [key: string]: unknown
}

export const mergeActualFieldsByStableId = <Task extends ActualFieldsTask>(
  liveTasks: readonly Task[],
  sourceUpdatedTasks: readonly Task[],
  targetStableId: string,
): Task[] => {
  const sourceTask = sourceUpdatedTasks.find(task => (task.stableId || task.id) === targetStableId)
  if (!sourceTask || !liveTasks.some(task => (task.stableId || task.id) === targetStableId)) {
    return liveTasks.map(task => ({ ...task }))
  }
  return liveTasks.map(task => (task.stableId || task.id) === targetStableId
    ? {
        ...task,
        actualStartDate: sourceTask.actualStartDate,
        actualEndDate: sourceTask.actualEndDate,
        actualDays: sourceTask.actualDays,
      }
    : { ...task })
}

export const LEVEL1_FLAT_FILTER_FIELDS = [
  { key: 'sequence', label: '序号', kind: 'text' },
  { key: 'stageName', label: '阶段', kind: 'text' },
  { key: 'milestoneName', label: '里程碑点', kind: 'text' },
  { key: 'status', label: '状态', kind: 'text' },
  { key: 'planEndDate', label: '计划完成时间', kind: 'date' },
  { key: 'estimatedDays', label: '计划开发周期', kind: 'text' },
  { key: 'actualEndDate', label: '实际完成时间', kind: 'date' },
  { key: 'actualDays', label: '实际开发周期', kind: 'text' },
] as const

export const LEVEL1_TREE_FILTER_FIELDS = [
  { key: 'id', label: '序号', kind: 'text' },
  { key: 'taskName', label: '阶段/节点', kind: 'text' },
  { key: 'planStartDate', label: '计划开始时间', kind: 'date' },
  { key: 'planEndDate', label: '计划完成时间', kind: 'date' },
  { key: 'estimatedDays', label: '预估工期', kind: 'text' },
  { key: 'actualStartDate', label: '实际开始时间', kind: 'date' },
  { key: 'actualEndDate', label: '实际完成时间', kind: 'date' },
  { key: 'actualDays', label: '实际工期', kind: 'text' },
  {
    key: 'delayStatus',
    label: '是否延期',
    kind: 'enum',
    options: ['延期', '按时', '-'].map(value => ({ label: value, value })),
  },
] as const

type FlatFilterKey = typeof LEVEL1_FLAT_FILTER_FIELDS[number]['key']
export interface FlatLevel1FilterCondition {
  field: string
  operator: string
  value: string | string[]
}

const isFlatFilterKey = (value: string): value is FlatFilterKey => (
  LEVEL1_FLAT_FILTER_FIELDS.some(field => field.key === value)
)

const isEmpty = (value: unknown) => value == null || ['', '-', '—'].includes(String(value).trim())

const matchesFilterCondition = (
  row: Record<string, unknown>,
  condition: FlatLevel1FilterCondition,
  fields: readonly { key: string }[],
) => {
  if (!fields.some(field => field.key === condition.field)) return true
  const actualValue = row[condition.field]
  const usesDelayDisplayValue = condition.field === 'delayStatus'
    && ['equals', 'notEquals', 'equalsAny'].includes(condition.operator)
  const normalizedActualValue = usesDelayDisplayValue
    && (actualValue == null || String(actualValue).trim() === '')
    ? '-'
    : actualValue
  const actual = String(normalizedActualValue ?? '').trim().toLowerCase()
  const values = (Array.isArray(condition.value) ? condition.value : [condition.value])
    .map(value => value.trim().toLowerCase())
    .filter(Boolean)
  const expected = values[0] || ''
  if (condition.operator === 'isEmpty') return isEmpty(row[condition.field])
  if (condition.operator === 'isNotEmpty') return !isEmpty(row[condition.field])
  if (!expected) return true
  if (condition.operator === 'equalsAny') return values.includes(actual)
  if (condition.operator === 'equals') return actual === expected
  if (condition.operator === 'notEquals') return actual !== expected
  if (condition.operator === 'before') return Boolean(actual) && actual < expected
  if (condition.operator === 'after') return Boolean(actual) && actual > expected
  if (condition.operator === 'notContains') return !actual.includes(expected)
  return actual.includes(expected)
}

const matchesFlatCondition = (row: Record<string, unknown>, condition: FlatLevel1FilterCondition) => {
  if (!isFlatFilterKey(condition.field)) return true
  return matchesFilterCondition(row, condition, LEVEL1_FLAT_FILTER_FIELDS)
}

export const filterFlatLevel1Rows = <Row extends object>(
  rows: readonly Row[],
  conditions: readonly FlatLevel1FilterCondition[],
): Row[] => rows.filter(row => conditions.every(condition => matchesFlatCondition(row as Record<string, unknown>, condition)))

export interface Level1TreeFilterRow {
  id: string
  stableId?: string
  parentId?: string | null
  [key: string]: unknown
}

export const filterLevel1TreeRows = <Row extends Level1TreeFilterRow>(
  rows: readonly Row[],
  conditions: readonly FlatLevel1FilterCondition[],
): Row[] => {
  if (conditions.length === 0) return rows.map(row => ({ ...row }))

  const stableIndexById = new Map<string, number>()
  const displayIndexById = new Map<string, number>()
  rows.forEach((row, index) => {
    if (row.stableId && !stableIndexById.has(row.stableId)) stableIndexById.set(row.stableId, index)
    if (!displayIndexById.has(row.id)) displayIndexById.set(row.id, index)
  })

  const parentIndexByChild = new Map<number, number>()
  const childIndexesByParent = new Map<number, number[]>()
  rows.forEach((row, childIndex) => {
    if (!row.parentId) return
    const parentIndex = stableIndexById.get(row.parentId) ?? displayIndexById.get(row.parentId)
    if (parentIndex === undefined || parentIndex === childIndex) return
    parentIndexByChild.set(childIndex, parentIndex)
    const childIndexes = childIndexesByParent.get(parentIndex) || []
    childIndexes.push(childIndex)
    childIndexesByParent.set(parentIndex, childIndexes)
  })

  const includedIndexes = new Set<number>()
  const includeAncestors = (index: number) => {
    const visited = new Set<number>()
    let currentIndex: number | undefined = index
    while (currentIndex !== undefined && !visited.has(currentIndex)) {
      visited.add(currentIndex)
      includedIndexes.add(currentIndex)
      currentIndex = parentIndexByChild.get(currentIndex)
    }
  }
  const includeDescendants = (index: number) => {
    includedIndexes.add(index)
    const pending = [...(childIndexesByParent.get(index) || [])]
    const visited = new Set<number>([index])
    while (pending.length > 0) {
      const childIndex = pending.shift()!
      if (visited.has(childIndex)) continue
      visited.add(childIndex)
      includedIndexes.add(childIndex)
      pending.push(...(childIndexesByParent.get(childIndex) || []))
    }
  }

  rows.forEach((row, index) => {
    const matches = conditions.every(condition => (
      matchesFilterCondition(row as Record<string, unknown>, condition, LEVEL1_TREE_FILTER_FIELDS)
    ))
    if (!matches) return
    includeAncestors(index)
    includeDescendants(index)
  })

  return rows.flatMap((row, index) => includedIndexes.has(index) ? [{ ...row }] : [])
}

export interface Level1SummaryVersion {
  id: string
  versionNo: string
  status: string
}

export interface Level1SummaryTask {
  planStartDate?: unknown
  planEndDate?: unknown
  actualStartDate?: unknown
  actualEndDate?: unknown
  [key: string]: unknown
}

export interface LatestPublishedLevel1Summary {
  versionId: string | null
  planStartDate: string
  planEndDate: string
  actualStartDate: string
  actualEndDate: string
}

const emptyLatestPublishedLevel1Summary = (): LatestPublishedLevel1Summary => ({
  versionId: null,
  planStartDate: '',
  planEndDate: '',
  actualStartDate: '',
  actualEndDate: '',
})

const parseLevel1VersionNo = (versionNo: string) => {
  const match = /^V(\d+)(?:\.(\d+))?$/i.exec(String(versionNo || '').trim())
  if (!match) return null
  return { major: Number(match[1]), minor: match[2] === undefined ? 0 : Number(match[2]) }
}

const compareLevel1Versions = (left: Level1SummaryVersion, right: Level1SummaryVersion) => {
  const parsedLeft = parseLevel1VersionNo(left.versionNo)!
  const parsedRight = parseLevel1VersionNo(right.versionNo)!
  return parsedLeft.major - parsedRight.major || parsedLeft.minor - parsedRight.minor
}

const getStrictIsoDate = (value: unknown): string | null => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return value
}

const selectIsoBoundary = (
  tasks: readonly Level1SummaryTask[],
  field: 'planStartDate' | 'planEndDate' | 'actualStartDate' | 'actualEndDate',
  boundary: 'min' | 'max',
) => {
  const values = tasks
    .map(task => getStrictIsoDate(task[field]))
    .filter((value): value is string => value !== null)
    .sort()
  if (values.length === 0) return ''
  return boundary === 'min' ? values[0] : values[values.length - 1]
}

export const selectLatestPublishedLevel1Summary = <Task extends Level1SummaryTask>({
  versions,
  getSnapshot,
}: {
  versions: readonly Level1SummaryVersion[]
  getSnapshot: (versionId: string) => readonly Task[] | null | undefined
}): LatestPublishedLevel1Summary => {
  const latestPublished = versions
    .filter(version => version.status === '已发布' && parseLevel1VersionNo(version.versionNo) !== null)
    .sort((left, right) => compareLevel1Versions(right, left))[0]
  if (!latestPublished) return emptyLatestPublishedLevel1Summary()

  const snapshot = getSnapshot(latestPublished.id)
  if (!snapshot || snapshot.length === 0) return emptyLatestPublishedLevel1Summary()

  return {
    versionId: latestPublished.id,
    planStartDate: selectIsoBoundary(snapshot, 'planStartDate', 'min'),
    planEndDate: selectIsoBoundary(snapshot, 'planEndDate', 'max'),
    actualStartDate: selectIsoBoundary(snapshot, 'actualStartDate', 'min'),
    actualEndDate: selectIsoBoundary(snapshot, 'actualEndDate', 'max'),
  }
}

export interface FlatGanttTask {
  id: string
  stableId?: string
  parentId?: string | null
  [key: string]: unknown
}

export interface FlatGanttRow {
  id: string
  parentId?: string | null
  stageId?: string
}

export const selectFlatGanttHierarchy = <Task extends FlatGanttTask, Row extends FlatGanttRow>(
  hierarchy: readonly Task[],
  filteredRows: readonly Row[],
): Task[] => {
  const includedIds = new Set<string>()
  filteredRows.forEach(row => {
    includedIds.add(row.id)
    const stageId = row.stageId || row.parentId
    if (stageId) includedIds.add(stageId)
  })
  return hierarchy.filter(task => includedIds.has(task.id)).map(task => ({ ...task }))
}

export interface ProjectSpaceLevel1ScopeToken {
  projectId: string
  scopeKind: 'market' | 'tos'
  scopeValue: string
  versionId: string
  currentUser: string
}

export const canConfirmMachineMrInsertion = ({
  openingScope,
  currentScope,
  isMachineProject,
  isCurrentDraft,
  isEditMode,
  canMaintain,
  followedReadOnly,
}: {
  openingScope: ProjectSpaceLevel1ScopeToken
  currentScope: ProjectSpaceLevel1ScopeToken
  isMachineProject: boolean
  isCurrentDraft: boolean
  isEditMode: boolean
  canMaintain: boolean
  followedReadOnly: boolean
}) => isMachineProject
  && isCurrentDraft
  && isEditMode
  && canMaintain
  && !followedReadOnly
  && openingScope.projectId === currentScope.projectId
  && openingScope.scopeKind === currentScope.scopeKind
  && openingScope.scopeValue === currentScope.scopeValue
  && openingScope.versionId === currentScope.versionId
  && openingScope.currentUser === currentScope.currentUser

export const getLevel1MaintainerUsers = (
  spm: unknown,
  roles: readonly { name?: string; members?: readonly string[] }[],
) => Array.from(new Set([
  ...String(spm || '').split(/[,，、]/).map(user => user.trim()).filter(Boolean),
  ...(roles.find(role => role.name === '项目经理')?.members || []),
]))

const SCOPED_PLAN_PERSISTENCE_KEYS = [
  'marketPlanData',
  'marketFollowVersionMeta',
  'marketVersionsByKey',
  'marketCurrentVersionByKey',
  'tosTypePlanDataByProjectId',
  'tosTypeVersionsByKey',
  'tosTypeCurrentVersionByKey',
] as const

export const pickScopedPlanPersistence = <State extends object>(state: State) => {
  const values = state as Record<string, unknown>
  return Object.fromEntries(SCOPED_PLAN_PERSISTENCE_KEYS.map(key => [key, values[key]]))
}
