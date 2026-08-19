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

const matchesFlatCondition = (row: Record<string, unknown>, condition: FlatLevel1FilterCondition) => {
  if (!isFlatFilterKey(condition.field)) return true
  const actual = String(row[condition.field] ?? '').trim().toLowerCase()
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

export const filterFlatLevel1Rows = <Row extends object>(
  rows: readonly Row[],
  conditions: readonly FlatLevel1FilterCondition[],
): Row[] => rows.filter(row => conditions.every(condition => matchesFlatCondition(row as Record<string, unknown>, condition)))

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
