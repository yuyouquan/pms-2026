import type { Level1PlanTask } from '@/lib/level1PlanRules'

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
  getOnTaskDateChange: () => ((change: PlanGanttTaskDateChange) => boolean | undefined) | undefined
  formatDate: (value: unknown) => string
  updateTask: (task: PlanGanttInteractionTask) => void
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

const getStageRange = (stage: Level1PlanTask, children: Level1PlanTask[], previousEnd: string) => {
  const hasScheduleDate = (task: Level1PlanTask): boolean => Boolean(asDate(task.planStartDate) || asDate(task.planEndDate))
  const firstChild = children.find(hasScheduleDate)
  const lastChild = [...children].reverse().find(hasScheduleDate)
  const ownStart = asDate(stage.planStartDate)
  const ownEnd = asDate(stage.planEndDate)
  const startDate = ownStart || (previousEnd ? addDay(previousEnd) : '') || asDate(firstChild?.planStartDate) || asDate(firstChild?.planEndDate)
  const endDate = ownEnd || asDate(lastChild?.planEndDate) || asDate(lastChild?.planStartDate)

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
      const date = asDate(task.planEndDate) || asDate(task.planStartDate)
      result.push({ ...task, type: 'milestone', readonly: !editable, start_date: date, end_date: date, duration: 0 })
    })
  })

  return result
}

const areValidDatePair = (startDate: string, endDate: string): boolean => (
  getDateDifference(startDate, endDate) !== null
)

export const applyPlanGanttDateChange = <Task extends Level1PlanTask>(
  tasks: readonly Task[],
  change: PlanGanttDateChange,
): Task[] => {
  if (!areValidDatePair(change.startDate, change.endDate)) return tasks as Task[]
  const target = tasks.find(task => task.id === change.taskId)
  if (!target) return tasks as Task[]

  if (change.mode === 'milestone') {
    const planStartDate = target.planStartDate || ''
    const estimatedDays = parseUtcDate(planStartDate) !== null
      ? getDateDifference(planStartDate, change.endDate)
      : target.estimatedDays
    if (estimatedDays === null) return tasks as Task[]
    return tasks.map(task => task.id === change.taskId
      ? { ...task, planEndDate: change.endDate, ...(estimatedDays === null ? {} : { estimatedDays }) }
      : task)
  }

  const estimatedDays = getDateDifference(change.startDate, change.endDate)
  return tasks.map(task => task.id === change.taskId
    ? { ...task, planStartDate: change.startDate, planEndDate: change.endDate, estimatedDays }
    : task)
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
  const target = tasks.find(task => task.id === input.taskId)
  const patchKeys = dateKeys.filter(key => hasOwnDateKey(input.patch, key))
  if (!target || patchKeys.length === 0 || patchKeys.some(key => {
    const value = input.patch[key]
    return typeof value !== 'string' || (value !== '' && parseUtcDate(value) === null)
  })) return cloneTasks(tasks)

  const patched = { ...target, ...input.patch }
  const planChanged = hasOwnDateKey(input.patch, 'planStartDate') || hasOwnDateKey(input.patch, 'planEndDate')
  const actualChanged = hasOwnDateKey(input.patch, 'actualStartDate') || hasOwnDateKey(input.patch, 'actualEndDate')
  const estimatedDays = getPatchedDuration(patched.planStartDate || '', patched.planEndDate || '', target.estimatedDays)
  const actualDays = getPatchedDuration(patched.actualStartDate || '', patched.actualEndDate || '', target.actualDays)
  if (planChanged && estimatedDays === null) return cloneTasks(tasks)
  if (actualChanged && actualDays === null) return cloneTasks(tasks)
  if (planChanged) patched.estimatedDays = estimatedDays
  if (actualChanged) patched.actualDays = actualDays

  return tasks.map(task => task.id === input.taskId ? patched : task)
}

const cloneScheduleValue = (value: unknown): unknown => value instanceof Date ? new Date(value.getTime()) : value

export const createPlanGanttInteractionController = ({
  readOnly,
  getOnTaskDateChange,
  formatDate,
  updateTask,
}: PlanGanttInteractionControllerOptions) => {
  let dragSnapshot: { taskId: string; startDate: unknown; endDate: unknown } | null = null
  const canEdit = (task: PlanGanttInteractionTask): boolean => !(readOnly || task.readonly || task.type === 'project')

  return {
    beforeDrag(task: PlanGanttInteractionTask): boolean {
      dragSnapshot = null
      if (!canEdit(task)) return false
      dragSnapshot = {
        taskId: String(task.id),
        startDate: cloneScheduleValue(task.start_date),
        endDate: cloneScheduleValue(task.end_date),
      }
      return true
    },
    afterDrag(task: PlanGanttInteractionTask): void {
      const snapshot = dragSnapshot
      try {
        const accepted = getOnTaskDateChange()?.({
          taskId: String(task.id),
          nodeType: task.type === 'milestone' ? 'milestone' : 'task',
          startDate: formatDate(task.start_date),
          endDate: formatDate(task.end_date),
        })
        if (accepted === false && snapshot?.taskId === String(task.id)) {
          task.start_date = snapshot.startDate
          task.end_date = snapshot.endDate
          updateTask(task)
        }
      } finally {
        dragSnapshot = null
      }
    },
    canOpenLightbox(task: PlanGanttInteractionTask): boolean {
      return canEdit(task)
    },
    clear(): void {
      dragSnapshot = null
    },
  }
}
