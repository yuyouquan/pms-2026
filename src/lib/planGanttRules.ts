import { validateLevel1ScheduleDates, type Level1PlanTask, type Level1ScheduleAxis } from '@/lib/level1PlanRules'
import type { GanttStatic } from 'dhtmlx-gantt'

export type PlanGanttMode = 'hierarchical' | 'technical-subproject'
export type PlanGanttNodeType = 'project' | 'milestone' | 'task'

export interface PlanGanttDateChange {
  taskId: string
  mode: 'milestone' | 'task'
  startDate: string
  endDate: string
}

export interface PlanTaskDatePatch {
  taskId: string
  patch: Partial<Pick<Level1PlanTask, 'planStartDate' | 'planEndDate' | 'actualStartDate' | 'actualEndDate'>>
}

export interface PlanGanttTask extends Level1PlanTask {
  type: PlanGanttNodeType
  readonly: boolean
  start_date: string
  end_date: string
  duration: number
  unscheduled?: boolean
}

export interface PlanGanttTaskDateChange {
  taskId: string
  nodeType: 'milestone' | 'task'
  startDate: string
  endDate: string
}

export interface PlanGanttInteractionTask {
  id: string | number
  type?: string
  readonly?: boolean
  start_date?: unknown
  end_date?: unknown
}

export interface PlanGanttInteractionControllerOptions {
  readOnly: boolean
  allowLightbox?: boolean
  allowStandaloneUpdate?: boolean
  getValidateTaskDateChange?: () => ((change: PlanGanttTaskDateChange) => boolean) | undefined
  getOnTaskDateChange: () => ((change: PlanGanttTaskDateChange) => boolean | undefined) | undefined
  formatDate: (value: unknown) => string
  updateTask: (task: PlanGanttInteractionTask) => void
  refreshTask?: (task: PlanGanttInteractionTask) => void
}

const sortByOrder = <T extends { order: number }>(items: readonly T[]) => (
  [...items].sort((left, right) => left.order - right.order)
)

const parseUtcDate = (value: unknown): number | null => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const timestamp = Date.UTC(year, month - 1, day)
  const date = new Date(timestamp)
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? timestamp
    : null
}

const getDateDifference = (startDate: string, endDate: string): number | null => {
  const start = parseUtcDate(startDate)
  const end = parseUtcDate(endDate)
  return start === null || end === null || end < start ? null : (end - start) / 86_400_000
}

const addDay = (date: string): string => {
  const timestamp = parseUtcDate(date)
  return timestamp === null ? '' : new Date(timestamp + 86_400_000).toISOString().slice(0, 10)
}

const getProjectedDuration = (task: Level1PlanTask): number => {
  const calculated = getDateDifference(task.planStartDate || '', task.planEndDate || '')
  return calculated ?? (typeof task.estimatedDays === 'number' && task.estimatedDays >= 0 ? task.estimatedDays : 0)
}

const asDate = (value: unknown): string => parseUtcDate(value) === null ? '' : value as string

type StageScheduleChild = {
  startDate: string
  endDate: string
  nodeKind: 'fixed-milestone' | 'business-period' | 'legacy'
}

const getStageRange = (stage: Level1PlanTask, children: Level1PlanTask[], previousEnd: string) => {
  const scheduledChildren = children.flatMap<StageScheduleChild>(task => {
    const startDate = asDate(task.planStartDate)
    const endDate = asDate(task.planEndDate)
    if (task.nodeKind === 'business-period') {
      return getDateDifference(startDate, endDate) === null ? [] : [{ startDate, endDate, nodeKind: task.nodeKind }]
    }
    if (task.nodeKind === 'fixed-milestone') {
      return endDate ? [{ startDate: endDate, endDate, nodeKind: task.nodeKind }] : []
    }
    const legacyDate = endDate || startDate
    return legacyDate ? [{ startDate: startDate || legacyDate, endDate: endDate || legacyDate, nodeKind: 'legacy' as const }] : []
  })
  const earliestChild = scheduledChildren.reduce<(typeof scheduledChildren)[number] | null>((earliest, child) => (
    !earliest || child.startDate < earliest.startDate ? child : earliest
  ), null)
  const latestChild = scheduledChildren.reduce<(typeof scheduledChildren)[number] | null>((latest, child) => (
    !latest || child.endDate > latest.endDate ? child : latest
  ), null)
  const hasBusinessPeriod = scheduledChildren.some(child => child.nodeKind === 'business-period')
  const usesDerivedStageRange = stage.nodeKind === 'stage'
  const ownStart = usesDerivedStageRange ? '' : asDate(stage.planStartDate)
  const ownEnd = usesDerivedStageRange ? '' : asDate(stage.planEndDate)
  const naturalStart = earliestChild?.startDate || ''
  const startDate = ownStart
    || (hasBusinessPeriod ? naturalStart : '')
    || (previousEnd && earliestChild ? addDay(previousEnd) : '')
    || naturalStart
  const endDate = ownEnd || latestChild?.endDate || ''

  if (!startDate || !endDate || getDateDifference(startDate, endDate) === null) {
    return { startDate: '', endDate: '', duration: 0 }
  }

  return { startDate, endDate, duration: getDateDifference(startDate, endDate) || 0 }
}

export const buildPlanGanttTasks = (
  tasks: readonly Level1PlanTask[],
  { mode, editable }: { mode: PlanGanttMode; editable: boolean },
): PlanGanttTask[] => {
  if (mode === 'technical-subproject') {
    return sortByOrder(tasks).map(task => ({
      ...task,
      type: 'task',
      readonly: !editable,
      start_date: asDate(task.planStartDate),
      end_date: asDate(task.planEndDate),
      duration: getProjectedDuration(task),
    }))
  }

  const childrenByParent = new Map<string, Level1PlanTask[]>()
  tasks.forEach(task => {
    if (!task.parentId) return
    const children = childrenByParent.get(task.parentId) || []
    children.push(task)
    childrenByParent.set(task.parentId, children)
  })

  let previousStageEnd = ''
  const result: PlanGanttTask[] = []
  sortByOrder(tasks.filter(task => !task.parentId)).forEach(stage => {
    const children = sortByOrder(childrenByParent.get(stage.id) || [])
    const range = getStageRange(stage, children, previousStageEnd)
    if (range.endDate) previousStageEnd = range.endDate
    result.push({ ...stage, type: 'project', readonly: true, start_date: range.startDate, end_date: range.endDate, duration: range.duration })
    children.forEach(task => {
      if (task.nodeKind === 'business-period') {
        const startDate = asDate(task.planStartDate)
        const endDate = asDate(task.planEndDate)
        const duration = getDateDifference(startDate, endDate)
        result.push({
          ...task,
          type: 'task',
          readonly: !editable || duration === null,
          start_date: duration === null ? '' : startDate,
          end_date: duration === null ? '' : endDate,
          duration: duration ?? 0,
          ...(duration === null ? { unscheduled: true } : {}),
        })
        return
      }
      const date = asDate(task.planEndDate) || (task.nodeKind ? '' : asDate(task.planStartDate))
      result.push({ ...task, type: 'milestone', readonly: !editable, start_date: date, end_date: date, duration: 0 })
    })
  })

  return result
}

const areValidDatePair = (startDate: string, endDate: string): boolean => (
  getDateDifference(startDate, endDate) !== null
)

export type PlanGanttDateChangeResult<Task extends Level1PlanTask> =
  | { ok: true; tasks: Task[] }
  | { ok: false; message: string }

const buildPlanGanttDateCandidate = <Task extends Level1PlanTask>(
  tasks: readonly Task[],
  change: PlanGanttDateChange,
): Task[] | null => {
  if (!areValidDatePair(change.startDate, change.endDate)) return null
  const target = tasks.find(task => task.id === change.taskId)
  if (!target || target.nodeKind === 'stage') return null

  if (target.nodeKind === 'fixed-milestone') {
    return tasks.map(task => task.id === change.taskId
      ? { ...task, planEndDate: change.endDate }
      : task)
  }
  if (target.nodeKind === 'business-period') {
    const estimatedDays = getDateDifference(change.startDate, change.endDate)
    if (estimatedDays === null) return null
    return tasks.map(task => task.id === change.taskId
      ? { ...task, planStartDate: change.startDate, planEndDate: change.endDate, estimatedDays }
      : task)
  }

  if (change.mode === 'milestone') {
    const planStartDate = target.planStartDate || ''
    const estimatedDays = parseUtcDate(planStartDate) !== null
      ? getDateDifference(planStartDate, change.endDate)
      : target.estimatedDays
    if (estimatedDays === null) return null
    return tasks.map(task => task.id === change.taskId
      ? { ...task, planEndDate: change.endDate, ...(estimatedDays === null ? {} : { estimatedDays }) }
      : task)
  }

  const estimatedDays = getDateDifference(change.startDate, change.endDate)
  return tasks.map(task => task.id === change.taskId
    ? { ...task, planStartDate: change.startDate, planEndDate: change.endDate, estimatedDays }
    : task)
}

export const applyPlanGanttDateChangeResult = <Task extends Level1PlanTask>(
  tasks: readonly Task[],
  change: PlanGanttDateChange,
): PlanGanttDateChangeResult<Task> => {
  const candidate = buildPlanGanttDateCandidate(tasks, change)
  if (!candidate) return { ok: false, message: '日期格式或范围无效，未保存修改' }
  const target = tasks.find(task => task.id === change.taskId)
  if (target?.nodeKind) {
    const validation = validateLevel1ScheduleDates(candidate, { axes: ['plan'] })
    if (!validation.valid) {
      return { ok: false, message: validation.violations[0]?.message || '计划日期不符合顺序要求' }
    }
  }
  return { ok: true, tasks: candidate }
}

export const applyPlanGanttDateChange = <Task extends Level1PlanTask>(
  tasks: readonly Task[],
  change: PlanGanttDateChange,
): Task[] => {
  const result = applyPlanGanttDateChangeResult(tasks, change)
  return result.ok ? result.tasks : tasks as Task[]
}

const dateKeys = ['planStartDate', 'planEndDate', 'actualStartDate', 'actualEndDate'] as const
type DateKey = typeof dateKeys[number]

const hasOwnDateKey = (patch: PlanTaskDatePatch['patch'], key: DateKey): boolean => (
  Object.prototype.hasOwnProperty.call(patch, key)
)

const cloneTasks = <Task extends Level1PlanTask>(tasks: readonly Task[]): Task[] => (
  tasks.map(task => ({ ...task }))
)

const getPatchedDuration = (
  startDate: string,
  endDate: string,
  currentDuration: number | null | undefined,
): number | null | undefined => {
  if (!startDate || !endDate) return currentDuration
  return getDateDifference(startDate, endDate)
}

export const applyPlanTaskDatePatch = <Task extends Level1PlanTask>(
  tasks: readonly Task[],
  input: PlanTaskDatePatch,
): Task[] => {
  const evaluation = evaluatePlanTaskDatePatch(tasks, input)
  if (evaluation.ok) return evaluation.tasks
  return evaluation.preserveIdentity ? tasks as Task[] : cloneTasks(tasks)
}

export type PlanTaskDatePatchResult<Task extends Level1PlanTask> =
  | { ok: true; tasks: Task[] }
  | { ok: false; message: string }

type PlanTaskDatePatchEvaluation<Task extends Level1PlanTask> =
  | { ok: true; tasks: Task[] }
  | { ok: false; message: string; preserveIdentity: boolean }

const evaluatePlanTaskDatePatch = <Task extends Level1PlanTask>(
  tasks: readonly Task[],
  input: PlanTaskDatePatch,
): PlanTaskDatePatchEvaluation<Task> => {
  const target = tasks.find(task => task.id === input.taskId)
  const patchKeys = dateKeys.filter(key => hasOwnDateKey(input.patch, key))
  if (!target || patchKeys.length === 0 || patchKeys.some(key => {
    const value = input.patch[key]
    return typeof value !== 'string' || (value !== '' && parseUtcDate(value) === null)
  })) return { ok: false, message: '日期格式或范围无效，未保存修改', preserveIdentity: false }

  const patched = { ...target, ...input.patch }
  const planChanged = hasOwnDateKey(input.patch, 'planStartDate') || hasOwnDateKey(input.patch, 'planEndDate')
  const actualChanged = hasOwnDateKey(input.patch, 'actualStartDate') || hasOwnDateKey(input.patch, 'actualEndDate')
  const estimatedDays = getPatchedDuration(patched.planStartDate || '', patched.planEndDate || '', target.estimatedDays)
  const actualDays = getPatchedDuration(patched.actualStartDate || '', patched.actualEndDate || '', target.actualDays)
  if (planChanged && estimatedDays === null) return { ok: false, message: '日期格式或范围无效，未保存修改', preserveIdentity: false }
  if (actualChanged && actualDays === null) return { ok: false, message: '日期格式或范围无效，未保存修改', preserveIdentity: false }
  if (planChanged) patched.estimatedDays = estimatedDays
  if (actualChanged) patched.actualDays = actualDays

  const candidate = tasks.map(task => task.id === input.taskId ? patched : task)
  const axes: Level1ScheduleAxis[] = [
    ...(planChanged ? ['plan' as const] : []),
    ...(actualChanged ? ['actual' as const] : []),
  ]
  if (target.nodeKind) {
    const validation = validateLevel1ScheduleDates(candidate, { axes })
    if (!validation.valid) {
      return {
        ok: false,
        message: validation.violations[0]?.message || '计划日期不符合顺序要求',
        preserveIdentity: true,
      }
    }
  }
  return { ok: true, tasks: candidate }
}

export const applyPlanTaskDatePatchResult = <Task extends Level1PlanTask>(
  tasks: readonly Task[],
  input: PlanTaskDatePatch,
): PlanTaskDatePatchResult<Task> => {
  const evaluation = evaluatePlanTaskDatePatch(tasks, input)
  return evaluation.ok
    ? evaluation
    : { ok: false, message: evaluation.message }
}

const cloneScheduleValue = (value: unknown): unknown => value instanceof Date ? new Date(value.getTime()) : value

export const createPlanGanttInteractionController = ({
  readOnly,
  allowLightbox = true,
  allowStandaloneUpdate = true,
  getValidateTaskDateChange,
  getOnTaskDateChange,
  formatDate,
  updateTask,
  refreshTask,
}: PlanGanttInteractionControllerOptions) => {
  let dragSnapshot: { taskId: string; startDate: unknown; endDate: unknown } | null = null
  let approvedUpdateTaskId: string | null = null
  const committedSnapshots = new Map<string, { startDate: unknown; endDate: unknown }>()
  const canEdit = (task: PlanGanttInteractionTask): boolean => !(readOnly || task.readonly || task.type === 'project')
  const rememberTask = (task: PlanGanttInteractionTask) => {
    committedSnapshots.set(String(task.id), {
      startDate: cloneScheduleValue(task.start_date),
      endDate: cloneScheduleValue(task.end_date),
    })
  }
  const restoreTask = (
    task: PlanGanttInteractionTask,
    fallback?: { start_date?: unknown; end_date?: unknown },
  ) => {
    const committed = committedSnapshots.get(String(task.id))
    task.start_date = cloneScheduleValue(committed ? committed.startDate : fallback?.start_date)
    task.end_date = cloneScheduleValue(committed ? committed.endDate : fallback?.end_date)
    if (refreshTask) refreshTask(task)
    else updateTask(task)
  }

  return {
    rememberTask,
    beforeDrag(task: PlanGanttInteractionTask): boolean {
      dragSnapshot = null
      approvedUpdateTaskId = null
      if (!canEdit(task)) return false
      dragSnapshot = {
        taskId: String(task.id),
        startDate: cloneScheduleValue(task.start_date),
        endDate: cloneScheduleValue(task.end_date),
      }
      return true
    },
    beforeUpdate(task: PlanGanttInteractionTask): boolean {
      if (canEdit(task) && (allowStandaloneUpdate || approvedUpdateTaskId === String(task.id))) {
        if (allowStandaloneUpdate) rememberTask(task)
        return true
      }
      restoreTask(task)
      approvedUpdateTaskId = null
      return false
    },
    beforeTaskChanged(task: PlanGanttInteractionTask, originalTask: PlanGanttInteractionTask): boolean {
      const snapshot = dragSnapshot
      if (!snapshot || snapshot.taskId !== String(task.id) || !canEdit(task)) {
        restoreTask(task, originalTask)
        dragSnapshot = null
        approvedUpdateTaskId = null
        return false
      }
      try {
        const change = {
          taskId: String(task.id),
          nodeType: task.type === 'milestone' ? 'milestone' : 'task',
          startDate: formatDate(task.start_date),
          endDate: formatDate(task.end_date),
        } as const
        if (getValidateTaskDateChange?.()?.(change) === false) {
          restoreTask(task, originalTask)
          return false
        }
        const accepted = getOnTaskDateChange()?.(change)
        if (accepted === false) {
          restoreTask(task, originalTask)
          return false
        }
        approvedUpdateTaskId = String(task.id)
        return true
      } finally {
        dragSnapshot = null
      }
    },
    afterDrag(task: PlanGanttInteractionTask): void {
      if (approvedUpdateTaskId === String(task.id)) rememberTask(task)
      approvedUpdateTaskId = null
      dragSnapshot = null
    },
    canOpenLightbox(task: PlanGanttInteractionTask): boolean {
      return allowLightbox && canEdit(task)
    },
    clear(): void {
      dragSnapshot = null
      approvedUpdateTaskId = null
      committedSnapshots.clear()
    },
  }
}

export type PlanGanttInteractionController = ReturnType<typeof createPlanGanttInteractionController>

export type PlanGanttLifecycleHost = Pick<GanttStatic, 'attachEvent' | 'detachEvent' | 'getTask' | 'eachTask'>

export const attachPlanGanttInteractionLifecycle = (
  host: PlanGanttLifecycleHost,
  controller: PlanGanttInteractionController,
): (() => void) => {
  host.eachTask(task => controller.rememberTask(task))
  const handlers = [
    host.attachEvent('onBeforeTaskDrag', (id: string | number) => controller.beforeDrag(host.getTask(id))),
    host.attachEvent('onBeforeTaskChanged', (id: string | number, _mode: string, originalTask: PlanGanttInteractionTask) => (
      controller.beforeTaskChanged(host.getTask(id), originalTask)
    )),
    host.attachEvent('onAfterTaskDrag', (id: string | number) => {
      controller.afterDrag(host.getTask(id))
      return true
    }),
    host.attachEvent('onBeforeTaskUpdate', (id: string | number, task: PlanGanttInteractionTask) => (
      controller.beforeUpdate(task || host.getTask(id))
    )),
    host.attachEvent('onBeforeLightbox', (id: string | number) => controller.canOpenLightbox(host.getTask(id))),
  ]
  return () => handlers.forEach(handler => host.detachEvent(handler))
}
