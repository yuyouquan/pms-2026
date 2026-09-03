import type { TechnicalTemplateKind, TechnicalTemplateTask } from '@/types/technicalPlan'
import type { FilterFieldDefinition } from '@/lib/filterConditions'
import {
  projectLevel1FlatMilestones,
  projectLevel1Plan,
  projectTechnicalSubprojectRows,
  sumLevel1EstimatedDays,
  type Level1FlatMilestoneRow,
} from '@/lib/level1PlanRules'

export const TECHNICAL_TDT_EXPORT_COLUMNS = [
  { key: 'sequence', title: '序号' },
  { key: 'stageName', title: '阶段' },
  { key: 'milestoneName', title: '里程碑点' },
  { key: 'status', title: '状态' },
  { key: 'planEndDate', title: '计划完成时间' },
  { key: 'estimatedDays', title: '计划开发周期' },
  { key: 'actualEndDate', title: '实际完成时间' },
  { key: 'actualDays', title: '实际开发周期' },
] as const

export const TECHNICAL_SUBPROJECT_EXPORT_COLUMNS = [
  { key: 'sequence', title: '序号' },
  { key: 'activityName', title: '活动名称' },
  { key: 'status', title: '状态' },
  { key: 'planStartDate', title: '计划开始时间' },
  { key: 'planEndDate', title: '计划完成时间' },
  { key: 'estimatedDays', title: '计划周期' },
  { key: 'actualStartDate', title: '实际开始时间' },
  { key: 'actualEndDate', title: '实际完成时间' },
  { key: 'actualDays', title: '实际周期' },
] as const

export const TECHNICAL_TDT_FILTER_FIELDS: readonly FilterFieldDefinition[] = [
  { key: 'sequence', label: '序号', kind: 'text' },
  { key: 'stageName', label: '阶段', kind: 'text' },
  { key: 'milestoneName', label: '里程碑点', kind: 'text' },
  { key: 'status', label: '状态', kind: 'enum' },
  { key: 'planEndDate', label: '计划完成时间', kind: 'date' },
  { key: 'estimatedDays', label: '计划开发周期', kind: 'text' },
  { key: 'actualEndDate', label: '实际完成时间', kind: 'date' },
  { key: 'actualDays', label: '实际开发周期', kind: 'text' },
]

export const TECHNICAL_SUBPROJECT_FILTER_FIELDS: readonly FilterFieldDefinition[] = [
  { key: 'sequence', label: '序号', kind: 'text' },
  { key: 'activityName', label: '活动名称', kind: 'text' },
  { key: 'status', label: '状态', kind: 'enum' },
  { key: 'planStartDate', label: '计划开始时间', kind: 'date' },
  { key: 'planEndDate', label: '计划完成时间', kind: 'date' },
  { key: 'estimatedDays', label: '计划周期', kind: 'text' },
  { key: 'actualStartDate', label: '实际开始时间', kind: 'date' },
  { key: 'actualEndDate', label: '实际完成时间', kind: 'date' },
  { key: 'actualDays', label: '实际周期', kind: 'text' },
]

export const TECHNICAL_PLAN_EXPORT_COLUMNS = [
  { key: 'id', title: '序号' },
  { key: 'taskName', title: '阶段/里程碑节点' },
  { key: 'planStartDate', title: '计划开始时间' },
  { key: 'planEndDate', title: '计划完成时间' },
  { key: 'estimatedDays', title: '预估工期' },
  { key: 'actualStartDate', title: '实际开始时间' },
  { key: 'actualEndDate', title: '实际结束时间' },
  { key: 'actualDays', title: '实际工期' },
  { key: 'delayStatus', title: '是否延期' },
] as const

export const getTechnicalPlanExportColumns = (templateKind: TechnicalTemplateKind) => (
  templateKind === 'subproject' ? TECHNICAL_SUBPROJECT_EXPORT_COLUMNS : TECHNICAL_TDT_EXPORT_COLUMNS
)

const DEFAULT_TECHNICAL_STATUS_OPTIONS = ['未开始', '进行中', '已完成'].map(value => ({ label: value, value }))

export const getTechnicalPlanFilterFields = (
  templateKind: TechnicalTemplateKind,
  rows: readonly { status?: unknown }[] = [],
): FilterFieldDefinition[] => {
  const statusOptions = Array.from(new Set(rows
    .map(row => typeof row.status === 'string' ? row.status.trim() : '')
    .filter(Boolean)))
    .map(value => ({ label: value, value }))
  const fields = templateKind === 'subproject' ? TECHNICAL_SUBPROJECT_FILTER_FIELDS : TECHNICAL_TDT_FILTER_FIELDS
  return fields.map(field => field.key === 'status'
    ? { ...field, options: statusOptions.length ? statusOptions : DEFAULT_TECHNICAL_STATUS_OPTIONS.map(option => ({ ...option })) }
    : { ...field })
}

export const getTechnicalPlanRowKey = (task: Pick<TechnicalTemplateTask, 'id' | 'stableId'>) => (
  task.stableId || task.id
)

export const projectTechnicalPlanRows = (
  templateKind: TechnicalTemplateKind,
  tasks: readonly TechnicalTemplateTask[],
): Level1FlatMilestoneRow[] => (
  templateKind === 'subproject'
    ? projectTechnicalSubprojectRows(tasks)
    : projectLevel1FlatMilestones(tasks)
)

export const filterTechnicalPlanGanttTasks = <T extends { id: string; parentId?: string }>(
  tasks: readonly T[],
  templateKind: TechnicalTemplateKind,
  rows: readonly Pick<Level1FlatMilestoneRow, 'id' | 'stageId'>[],
): T[] => {
  const visibleIds = new Set(rows.map(row => row.id))
  if (templateKind === 'subproject') return tasks.filter(task => visibleIds.has(task.id))
  rows.forEach(row => {
    if (row.stageId) visibleIds.add(row.stageId)
  })
  return tasks.filter(task => visibleIds.has(task.id))
}

export interface TechnicalSubprojectTransferScopeToken {
  projectId: string
  tabId: string
  scopeKey: string
  versionId: string
  user: string
}

export const canConfirmTechnicalSubprojectTransfer = ({
  opening,
  current,
  isCurrentDraft,
  isEditMode,
  canMaintain,
  canView,
  canEdit,
}: {
  opening: TechnicalSubprojectTransferScopeToken
  current: TechnicalSubprojectTransferScopeToken
  isCurrentDraft: boolean
  isEditMode: boolean
  canMaintain: boolean
  canView: boolean
  canEdit: boolean
}) => isCurrentDraft
  && isEditMode
  && canView
  && canEdit
  && canMaintain
  && opening.projectId === current.projectId
  && opening.tabId === current.tabId
  && opening.scopeKey === current.scopeKey
  && opening.versionId === current.versionId
  && opening.user === current.user

export const canConfirmTechnicalSubprojectMutation = canConfirmTechnicalSubprojectTransfer

export function selectVisibleTechnicalPlanVersions<T extends { status: string }>(
  versions: readonly T[],
  canViewDraft: boolean,
): T[] {
  return versions.filter(version => version.status !== '修订中' || canViewDraft)
}

export function isResponsibleForTechnicalPlanTasks(
  tasks: readonly { responsible?: string }[],
  currentLoginUser?: string,
): boolean {
  const userName = String(currentLoginUser || '').trim()
  if (!userName) return false
  return tasks.some(task => String(task.responsible || '')
    .split(/[,，、;；/]/)
    .map(name => name.trim())
    .filter(Boolean)
    .includes(userName))
}

export function includeTechnicalPlanAncestors<T extends { id: string; parentId?: string }>(
  allTasks: readonly T[],
  matchedTasks: readonly T[],
): T[] {
  const byId = new Map(allTasks.map(task => [task.id, task]))
  const included = new Set(matchedTasks.map(task => task.id))
  matchedTasks.forEach(task => {
    let parentId = task.parentId
    const visited = new Set<string>()
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId)
      included.add(parentId)
      parentId = byId.get(parentId)?.parentId
    }
  })
  return allTasks.filter(task => included.has(task.id))
}

export function reorderTechnicalTasksWithinParent<T extends { id: string; parentId?: string; order: number }>(
  tasks: readonly T[],
  activeId: string,
  overId: string,
): T[] {
  const active = tasks.find(task => task.id === activeId)
  const over = tasks.find(task => task.id === overId)
  if (!active || !over || active.parentId !== over.parentId) return [...tasks]

  if (active.parentId) {
    const siblingIndexes = tasks.flatMap((task, index) => task.parentId === active.parentId ? [index] : [])
    const siblings = siblingIndexes.map(index => tasks[index])
    const oldIndex = siblings.findIndex(task => task.id === activeId)
    const newIndex = siblings.findIndex(task => task.id === overId)
    const reordered = [...siblings]
    const [moved] = reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, moved)
    const next = [...tasks]
    siblingIndexes.forEach((taskIndex, index) => { next[taskIndex] = reordered[index] })
    return next.map((task, index) => ({ ...task, order: index + 1 }))
  }

  const rootTasks = tasks.filter(task => !task.parentId)
  const oldRootIndex = rootTasks.findIndex(task => task.id === activeId)
  const newRootIndex = rootTasks.findIndex(task => task.id === overId)
  const reorderedRoots = [...rootTasks]
  const [movedRoot] = reorderedRoots.splice(oldRootIndex, 1)
  reorderedRoots.splice(newRootIndex, 0, movedRoot)
  const descendantsByRoot = new Map(rootTasks.map(root => [
    root.id,
    tasks.filter(task => task.parentId === root.id),
  ]))
  return reorderedRoots
    .flatMap(root => [root, ...(descendantsByRoot.get(root.id) || [])])
    .map((task, index) => ({ ...task, order: index + 1 }))
}

export function renumberTechnicalSubprojectTasks<T extends { id: string; stableId?: string; parentId?: string; order: number }>(
  tasks: readonly T[],
): T[] {
  return tasks.map((task, index) => ({ ...task, id: String(index + 1), order: index }))
}

const TECHNICAL_REVISION_TIME_FIELDS = [
  'planStartDate',
  'planEndDate',
  'estimatedDays',
  'actualStartDate',
  'actualEndDate',
  'actualDays',
] as const

export const normalizeTechnicalTaskName = (value: unknown) => String(value || '').trim()

const clearTechnicalTemplateDates = (task: TechnicalTemplateTask): TechnicalTemplateTask => ({
  ...task,
  planStartDate: '',
  planEndDate: '',
  actualStartDate: '',
  actualEndDate: '',
})

const refillTechnicalTemplateTime = (
  templateTask: TechnicalTemplateTask,
  previousTask?: TechnicalTemplateTask,
): TechnicalTemplateTask => {
  const next = clearTechnicalTemplateDates(templateTask)
  if (!previousTask) return { ...next, source: 'template' }
  TECHNICAL_REVISION_TIME_FIELDS.forEach(field => {
    if (Object.prototype.hasOwnProperty.call(previousTask, field)) {
      ;(next as unknown as Record<string, unknown>)[field] = previousTask[field]
    }
  })
  return { ...next, source: 'template' }
}

const mergeTechnicalSubprojectRevisionTasks = (
  latestTemplateTasks: readonly TechnicalTemplateTask[],
  previousPublishedTasks: readonly TechnicalTemplateTask[],
): TechnicalTemplateTask[] => {
  const previousTasks = [...previousPublishedTasks].sort((left, right) => left.order - right.order)
  const previousByName = new Map<string, TechnicalTemplateTask[]>()
  previousTasks.forEach(task => {
    const name = normalizeTechnicalTaskName(task.taskName)
    if (!name) return
    previousByName.set(name, [...(previousByName.get(name) || []), task])
  })
  const consumedIds = new Set<string>()
  const takePreviousByName = (taskName: string) => {
    const candidates = previousByName.get(normalizeTechnicalTaskName(taskName)) || []
    const match = candidates.find(task => !consumedIds.has(task.stableId || task.id))
    if (match) consumedIds.add(match.stableId || match.id)
    return match
  }
  const orderedTemplate = [...latestTemplateTasks].sort((left, right) => left.order - right.order)
  const latestTemplateNames = new Set(orderedTemplate.map(task => normalizeTechnicalTaskName(task.taskName)))
  const customBeforeTemplate = new Map<string, TechnicalTemplateTask[]>()
  const trailingCustom: TechnicalTemplateTask[] = []
  previousTasks.forEach((task, index) => {
    if (task.source !== 'custom' || latestTemplateNames.has(normalizeTechnicalTaskName(task.taskName))) return
    const anchor = previousTasks.slice(index + 1).find(candidate => (
      candidate.source !== 'custom'
      && latestTemplateNames.has(normalizeTechnicalTaskName(candidate.taskName))
    ))
    const target = anchor
      ? customBeforeTemplate.get(normalizeTechnicalTaskName(anchor.taskName)) || []
      : trailingCustom
    target.push({ ...task, parentId: undefined, source: 'custom' })
    if (anchor) customBeforeTemplate.set(normalizeTechnicalTaskName(anchor.taskName), target)
  })
  const merged = orderedTemplate.flatMap(templateTask => [
    ...(customBeforeTemplate.get(normalizeTechnicalTaskName(templateTask.taskName)) || []),
    refillTechnicalTemplateTime(templateTask, takePreviousByName(templateTask.taskName)),
  ])
  return renumberTechnicalSubprojectTasks([...merged, ...trailingCustom])
}

const mergeTechnicalTdtRevisionTasks = (
  latestTemplateTasks: readonly TechnicalTemplateTask[],
  previousPublishedTasks: readonly TechnicalTemplateTask[],
): TechnicalTemplateTask[] => {
  const previousByName = new Map<string, TechnicalTemplateTask[]>()
  previousPublishedTasks.forEach(task => {
    const name = normalizeTechnicalTaskName(task.taskName)
    if (!name) return
    previousByName.set(name, [...(previousByName.get(name) || []), task])
  })
  const previousById = new Map(previousPublishedTasks.map(task => [task.id, task]))
  const consumedIds = new Set<string>()
  const previousIdToNextId = new Map<string, string>()
  const takePreviousByName = (taskName: string) => {
    const candidates = previousByName.get(normalizeTechnicalTaskName(taskName)) || []
    const match = candidates.find(task => !consumedIds.has(task.id))
    if (match) consumedIds.add(match.id)
    return match
  }
  const latestStages = latestTemplateTasks
    .filter(task => !task.parentId)
    .sort((left, right) => left.order - right.order)
  const result: TechnicalTemplateTask[] = []

  latestStages.forEach(stage => {
    const previousStage = takePreviousByName(stage.taskName)
    const nextStage = refillTechnicalTemplateTime({ ...stage, parentId: undefined }, previousStage)
    if (previousStage) previousIdToNextId.set(previousStage.id, nextStage.id)
    result.push(nextStage)

    const templateChildren = latestTemplateTasks
      .filter(task => task.parentId === stage.id)
      .sort((left, right) => left.order - right.order)
    templateChildren.forEach(child => {
      const previousChild = takePreviousByName(child.taskName)
      const nextChild = refillTechnicalTemplateTime({ ...child, parentId: stage.id }, previousChild)
      if (previousChild) previousIdToNextId.set(previousChild.id, nextChild.id)
      result.push(nextChild)
    })

    const matchingCustomChildren = previousPublishedTasks
      .filter(task => {
        if (task.source !== 'custom' || !task.parentId || consumedIds.has(task.id)) return false
        const previousParent = previousById.get(task.parentId)
        return normalizeTechnicalTaskName(previousParent?.taskName) === normalizeTechnicalTaskName(stage.taskName)
      })
      .sort((left, right) => left.order - right.order)
    matchingCustomChildren.forEach((customTask, customIndex) => {
      const nextId = `${stage.id}.${templateChildren.length + customIndex + 1}`
      consumedIds.add(customTask.id)
      previousIdToNextId.set(customTask.id, nextId)
      result.push({
        ...customTask,
        id: nextId,
        parentId: stage.id,
        order: templateChildren.length + customIndex + 1,
        source: 'custom',
      })
    })
  })

  return result.map(task => task.source === 'custom' && task.predecessor
    ? { ...task, predecessor: previousIdToNextId.get(task.predecessor) || '' }
    : task)
}

/** Builds every technical-plan revision from the latest published configuration template. */
export const mergeTechnicalPlanRevisionTasks = (
  templateKind: TechnicalTemplateKind,
  latestTemplateTasks: readonly TechnicalTemplateTask[],
  previousPublishedTasks: readonly TechnicalTemplateTask[],
): TechnicalTemplateTask[] => {
  if (templateKind === 'subproject') {
    return mergeTechnicalSubprojectRevisionTasks(latestTemplateTasks, previousPublishedTasks)
  }
  return mergeTechnicalTdtRevisionTasks(latestTemplateTasks, previousPublishedTasks)
}

export function reorderTechnicalSubprojectCustomTasks<
  T extends { id: string; stableId?: string; source?: 'template' | 'custom'; parentId?: string; order: number },
>(tasks: readonly T[], activeId: string, overId: string): T[] {
  const ordered = [...tasks].sort((left, right) => left.order - right.order)
  const activeIndex = ordered.findIndex(task => task.id === activeId)
  const overIndex = ordered.findIndex(task => task.id === overId)
  const active = ordered[activeIndex]
  const over = ordered[overIndex]
  if (
    activeIndex < 0
    || overIndex < 0
    || active?.source !== 'custom'
    || over?.source !== 'custom'
    || active.parentId
    || over.parentId
  ) return tasks.map(task => ({ ...task }))
  const next = [...ordered]
  const [moved] = next.splice(activeIndex, 1)
  next.splice(overIndex, 0, moved)
  return renumberTechnicalSubprojectTasks(next)
}

const stringValue = (value: unknown) => value == null ? '' : String(value)
const optionalStringValue = (value: unknown) => {
  const text = stringValue(value).trim()
  return text === '-' || text === '—' ? '' : text
}
const numberValue = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function parseTechnicalPlanImportRows(
  rows: readonly Record<string, unknown>[],
  fallbackTasks: readonly TechnicalTemplateTask[] = [],
): TechnicalTemplateTask[] {
  const hasIdColumn = rows.some(row => (
    Object.prototype.hasOwnProperty.call(row, 'ID') || Object.prototype.hasOwnProperty.call(row, 'id')
  ))
  const fallbackById = new Map(fallbackTasks.map(task => [task.id, task]))
  const usedIds = new Set<string>()
  return rows.map((row, index) => {
    const rowId = optionalStringValue(row.ID ?? row.id)
    const id = hasIdColumn ? rowId : fallbackTasks[index]?.id || ''
    if (!id) throw new Error('technical-import-missing-id')
    if (usedIds.has(id)) throw new Error('technical-import-duplicate-id')
    usedIds.add(id)
    const fallback = hasIdColumn ? fallbackById.get(id) : fallbackTasks[index]
    const parentId = optionalStringValue(row['父任务ID'] ?? row.parentId ?? fallback?.parentId)
    return {
      ...(fallback || {}),
      id,
      order: index + 1,
      ...(parentId ? { parentId } : { parentId: undefined }),
      taskName: stringValue(row['任务名称'] ?? row.taskName ?? fallback?.taskName),
      responsible: optionalStringValue(row['责任人'] ?? row.responsible ?? fallback?.responsible),
      predecessor: optionalStringValue(row['前置任务'] ?? row.predecessor ?? fallback?.predecessor),
      planStartDate: optionalStringValue(row['计划开始'] ?? row.planStartDate ?? fallback?.planStartDate),
      planEndDate: optionalStringValue(row['计划完成'] ?? row.planEndDate ?? fallback?.planEndDate),
      estimatedDays: numberValue(row['预估工期'] ?? row.estimatedDays ?? fallback?.estimatedDays),
      actualStartDate: optionalStringValue(row['实际开始'] ?? row.actualStartDate ?? fallback?.actualStartDate),
      actualEndDate: optionalStringValue(row['实际完成'] ?? row.actualEndDate ?? fallback?.actualEndDate),
      actualDays: numberValue(row['实际工期'] ?? row.actualDays ?? fallback?.actualDays),
      status: stringValue(row['状态'] ?? row.status ?? fallback?.status ?? '未开始'),
      progress: numberValue(row['进度'] ?? row.progress ?? fallback?.progress),
      defaultRoadmap: Boolean(parentId),
    }
  })
}

const cycleDays = (
  tasks: readonly TechnicalTemplateTask[],
  startKey: 'planStartDate' | 'actualStartDate',
  endKey: 'planEndDate' | 'actualEndDate',
) => {
  const starts = tasks.map(task => Date.parse(task[startKey])).filter(Number.isFinite)
  const ends = tasks.map(task => Date.parse(task[endKey])).filter(Number.isFinite)
  if (!starts.length || !ends.length) return null
  return Math.max(0, Math.ceil((Math.max(...ends) - Math.min(...starts)) / 86_400_000))
}

const sumTechnicalEstimatedDays = (tasks: readonly TechnicalTemplateTask[]): number | null => {
  const mode = tasks.some(task => task.parentId) ? 'standard' : 'technical-subproject'
  return sumLevel1EstimatedDays(projectLevel1Plan(tasks, { mode }).rows)
}

export type TechnicalHorizontalRow = {
  id: string
  rowType: 'version' | 'actual'
  versionNo: string
  status: string
  cycleDays: number | null
  endDatesByTaskId: Record<string, string>
}

type TechnicalHorizontalDateTask = Pick<
  TechnicalTemplateTask,
  'id' | 'stableId' | 'taskName' | 'planEndDate' | 'actualEndDate'
>

export function buildTechnicalHorizontalDateMap(
  headerTasks: readonly TechnicalHorizontalDateTask[],
  versionTasks: readonly TechnicalHorizontalDateTask[],
  field: 'planEndDate' | 'actualEndDate',
): Record<string, string> {
  const versionByName = new Map(versionTasks.map(task => [normalizeTechnicalTaskName(task.taskName), task]))
  return Object.fromEntries(headerTasks.map(header => [
    getTechnicalPlanRowKey(header),
    versionByName.get(normalizeTechnicalTaskName(header.taskName))?.[field] || '',
  ]))
}

export function buildTechnicalHorizontalRows(
  versions: readonly { id: string; versionNo: string; status: string; tasks: TechnicalTemplateTask[] }[],
  currentVersionId: string,
  headerTasks?: readonly TechnicalTemplateTask[],
): TechnicalHorizontalRow[] {
  const versionRows = versions.map(version => ({
    id: version.id,
    rowType: 'version' as const,
    versionNo: version.versionNo,
    status: version.status,
    cycleDays: sumTechnicalEstimatedDays(version.tasks),
    endDatesByTaskId: headerTasks
      ? buildTechnicalHorizontalDateMap(headerTasks, version.tasks, 'planEndDate')
      : Object.fromEntries(version.tasks.map(task => [getTechnicalPlanRowKey(task), task.planEndDate || ''])),
  }))
  const currentVersion = versions.find(version => version.id === currentVersionId)
  return [
    ...versionRows,
    {
      id: 'actual',
      rowType: 'actual',
      versionNo: '实际',
      status: '',
      cycleDays: currentVersion ? cycleDays(currentVersion.tasks, 'actualStartDate', 'actualEndDate') : null,
      endDatesByTaskId: headerTasks
        ? buildTechnicalHorizontalDateMap(headerTasks, currentVersion?.tasks || [], 'actualEndDate')
        : Object.fromEntries((currentVersion?.tasks || []).map(task => [getTechnicalPlanRowKey(task), task.actualEndDate || ''])),
    },
  ]
}
