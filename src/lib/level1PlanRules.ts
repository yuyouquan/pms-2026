export type Level1TaskSource = 'template' | 'custom'
export type Level1ProjectionMode = 'standard' | 'technical-subproject'
export type Level1DelayStatus = '延期' | '按时' | '-'

export interface Level1PlanTask {
  id: string
  stableId?: string
  parentId?: string | null
  order: number
  taskName: string
  role?: string
  source?: Level1TaskSource
  status?: string
  progress?: number
  responsible?: string
  predecessor?: string
  planStartDate?: string
  planEndDate?: string
  estimatedDays?: number | null
  actualStartDate?: string
  actualEndDate?: string
  actualDays?: number | null
}

export interface Level1FlatMilestoneRow extends Level1PlanTask {
  sequence: number
  stageId: string
  stageStableId: string
  stageName: string
  milestoneName: string
  activityName: string
  planStartDate: string
  planEndDate: string
  estimatedDays: number | null
  actualStartDate: string
  actualEndDate: string
  actualDays: number | null
  delayStatus: Level1DelayStatus
}

export interface Level1PlanViewRow extends Level1PlanTask {
  planStartDate: string
  planEndDate: string
  estimatedDays: number | null
  actualStartDate: string
  actualEndDate: string
  actualDays: number | null
  delayStatus: Level1DelayStatus | ''
  manpowerPercent: number | null
  isMilestone: boolean
}

export type Level1StructureAction = 'rename' | 'delete' | 'reorder'

export interface Level1StructureMutationInput {
  projectType: string
  technicalKind?: 'tdt' | 'subproject'
  task: Level1PlanTask
  parent?: Level1PlanTask
  action: Level1StructureAction
}

export interface Level1DateViolation {
  taskId: string
  field: 'planEndDate' | 'actualEndDate'
  message: string
}

export interface Level1DateValidationResult {
  valid: boolean
  violations: Level1DateViolation[]
  byTaskId: Record<string, Partial<Record<'planEndDate' | 'actualEndDate', string[]>>>
}

const templateTask = (
  id: string,
  parentId: string | null,
  order: number,
  taskName: string,
  role = '',
): Level1PlanTask => ({
  id,
  stableId: id,
  parentId,
  order,
  taskName,
  role,
  source: 'template',
  planEndDate: '',
  actualEndDate: '',
})

export const STANDARD_LEVEL1_TEMPLATE_TASKS: Level1PlanTask[] = [
  templateTask('stage-concept', null, 0, '概念阶段'),
  templateTask('milestone-concept-start', 'stage-concept', 0, '概念启动', 'SPM'),
  templateTask('milestone-str1', 'stage-concept', 1, 'STR1', 'SPM'),
  templateTask('stage-plan', null, 1, '计划阶段'),
  templateTask('milestone-str2', 'stage-plan', 0, 'STR2', 'SPM'),
  templateTask('milestone-str3', 'stage-plan', 1, 'STR3', 'SPM'),
  templateTask('stage-development', null, 2, '开发验证阶段'),
  templateTask('milestone-str4', 'stage-development', 0, 'STR4', 'SPM'),
  templateTask('milestone-str4a', 'stage-development', 1, 'STR4A', 'SPM'),
  templateTask('milestone-str5', 'stage-development', 2, 'STR5', 'SPM'),
  templateTask('stage-launch', null, 3, '上市收编阶段'),
  templateTask('milestone-close', 'stage-launch', 0, '收编完成', 'SPM'),
]

const STANDARD_DISPLAY_IDS = ['1', '1.1', '1.2', '2', '2.1', '2.2', '3', '3.1', '3.2', '3.3', '4', '4.1']
const STANDARD_MOCK_DATES: Record<string, { planEndDate: string; actualEndDate: string }> = {
  'milestone-concept-start': { planEndDate: '2026-02-26', actualEndDate: '2026-02-27' },
  'milestone-str1': { planEndDate: '2026-03-17', actualEndDate: '2026-03-18' },
  'milestone-str2': { planEndDate: '2026-04-28', actualEndDate: '2026-04-28' },
  'milestone-str3': { planEndDate: '2026-05-22', actualEndDate: '2026-05-22' },
  'milestone-str4': { planEndDate: '2026-07-31', actualEndDate: '2026-07-31' },
  'milestone-str4a': { planEndDate: '2026-10-12', actualEndDate: '2026-10-12' },
  'milestone-str5': { planEndDate: '2026-12-15', actualEndDate: '2026-12-15' },
  'milestone-close': { planEndDate: '2027-03-01', actualEndDate: '2027-03-01' },
}

export const buildStandardLevel1Tasks = (withMockDates = true): Level1PlanTask[] => {
  const idByStableId = new Map(STANDARD_LEVEL1_TEMPLATE_TASKS.map((task, index) => [task.id, STANDARD_DISPLAY_IDS[index]]))
  return STANDARD_LEVEL1_TEMPLATE_TASKS.map((task, index) => {
    const mockDates = withMockDates ? STANDARD_MOCK_DATES[task.id] : undefined
    return {
      ...task,
      id: STANDARD_DISPLAY_IDS[index],
      stableId: task.id,
      parentId: task.parentId ? idByStableId.get(task.parentId) || null : null,
      role: task.role || '',
      responsible: task.role || '',
      predecessor: '',
      planStartDate: '',
      planEndDate: mockDates?.planEndDate || '',
      estimatedDays: 0,
      actualStartDate: '',
      actualEndDate: mockDates?.actualEndDate || '',
      actualDays: 0,
      status: '未开始',
      progress: 0,
      defaultRoadmap: Boolean(task.parentId),
    }
  })
}

const sortByOrder = <T extends { order: number }>(items: T[]) => (
  [...items].sort((left, right) => left.order - right.order)
)

const parseStrictDate = (value: unknown): number | null => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const timestamp = Date.UTC(year, month - 1, day)
  const date = new Date(timestamp)
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return timestamp
}

export const isValidLevel1Date = (value: unknown): value is string => parseStrictDate(value) !== null

export const getLevel1DateDifference = (start: string, end: string): number | null => {
  const startTime = parseStrictDate(start)
  const endTime = parseStrictDate(end)
  if (startTime === null || endTime === null || endTime < startTime) return null
  return Math.round((endTime - startTime) / 86_400_000)
}

const getLevel1ScheduleDate = (value: unknown): string => typeof value === 'string' ? value : ''

const getNonNegativeLevel1Duration = (value: unknown): number | null => (
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
)

/** Uses current date pairs first so changed dates never retain a stale stored duration. */
export const getLevel1ProjectedDuration = (
  startDate: unknown,
  endDate: unknown,
  storedDuration: unknown,
): number | null => {
  const start = getLevel1ScheduleDate(startDate)
  const end = getLevel1ScheduleDate(endDate)
  const calculated = getLevel1DateDifference(start, end)
  return calculated ?? getNonNegativeLevel1Duration(storedDuration)
}

export const sumLevel1EstimatedDays = (
  rows: readonly Pick<Level1PlanViewRow, 'estimatedDays'>[],
): number | null => {
  const durations = rows
    .map(row => row.estimatedDays)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0)
  return durations.length > 0
    ? durations.reduce((total, duration) => total + duration, 0)
    : null
}

export const addLevel1Days = (value: string, days: number): string => {
  const timestamp = parseStrictDate(value)
  if (timestamp === null) return ''
  return new Date(timestamp + days * 86_400_000).toISOString().slice(0, 10)
}

const cloneTask = (task: Level1PlanTask): Level1PlanTask => ({
  ...task,
  stableId: task.stableId || task.id,
  source: task.source || 'template',
  planEndDate: typeof task.planEndDate === 'string' ? task.planEndDate : '',
  actualEndDate: typeof task.actualEndDate === 'string' ? task.actualEndDate : '',
})

export const getOrderedLevel1Tasks = (tasks: readonly Level1PlanTask[]): Level1PlanTask[] => {
  const cloned = tasks.map(cloneTask)
  const roots = sortByOrder(cloned.filter(task => !task.parentId))
  const flattened = roots.flatMap(root => [
    root,
    ...sortByOrder(cloned.filter(task => task.parentId === root.id)),
  ])
  const included = new Set(flattened.map(task => task.id))
  return [...flattened, ...sortByOrder(cloned.filter(task => !included.has(task.id)))]
}

const getMilestoneSequence = (tasks: readonly Level1PlanTask[]): Level1PlanTask[] => {
  const ordered = getOrderedLevel1Tasks(tasks)
  const hasChildren = ordered.some(task => Boolean(task.parentId))
  return hasChildren ? ordered.filter(task => Boolean(task.parentId)) : ordered
}

export const getLevel1DelayStatus = (
  planEndDate: string,
  actualEndDate: string,
  today: string,
): Level1DelayStatus => {
  const planTime = parseStrictDate(planEndDate)
  if (planTime === null) return '-'
  const comparisonTime = parseStrictDate(actualEndDate) ?? parseStrictDate(today)
  if (comparisonTime === null) return '-'
  return comparisonTime > planTime ? '延期' : '按时'
}

export const projectLevel1FlatMilestones = (
  tasks: readonly Level1PlanTask[],
  options: { today?: string } = {},
): Level1FlatMilestoneRow[] => {
  const today = options.today || new Date().toISOString().slice(0, 10)
  const ordered = getOrderedLevel1Tasks(tasks)
  const stagesById = new Map(ordered.filter(task => !task.parentId).map(task => [task.id, task]))

  return ordered
    .filter(task => Boolean(task.parentId))
    .map((task, index) => {
      const stage = stagesById.get(task.parentId!)
      const planStartDate = getLevel1ScheduleDate(task.planStartDate)
      const planEndDate = getLevel1ScheduleDate(task.planEndDate)
      const actualStartDate = getLevel1ScheduleDate(task.actualStartDate)
      const actualEndDate = getLevel1ScheduleDate(task.actualEndDate)
      return {
        ...task,
        sequence: index + 1,
        stageId: stage?.id || '',
        stageStableId: stage?.stableId || stage?.id || '',
        stageName: stage?.taskName || '',
        milestoneName: task.taskName,
        activityName: task.taskName,
        planStartDate,
        planEndDate,
        estimatedDays: getLevel1ProjectedDuration(planStartDate, planEndDate, task.estimatedDays),
        actualStartDate,
        actualEndDate,
        actualDays: getLevel1ProjectedDuration(actualStartDate, actualEndDate, task.actualDays),
        delayStatus: getLevel1DelayStatus(planEndDate, actualEndDate, today),
      }
    })
}

export const projectTechnicalSubprojectRows = (
  tasks: readonly Level1PlanTask[],
  options: { today?: string } = {},
): Level1FlatMilestoneRow[] => {
  const today = options.today || new Date().toISOString().slice(0, 10)
  return getOrderedLevel1Tasks(tasks).map((task, index) => {
    const planStartDate = getLevel1ScheduleDate(task.planStartDate)
    const planEndDate = getLevel1ScheduleDate(task.planEndDate)
    const actualStartDate = getLevel1ScheduleDate(task.actualStartDate)
    const actualEndDate = getLevel1ScheduleDate(task.actualEndDate)
    return {
      ...task,
      sequence: index + 1,
      stageId: '',
      stageStableId: '',
      stageName: '',
      milestoneName: '',
      activityName: task.taskName,
      planStartDate,
      planEndDate,
      estimatedDays: getLevel1ProjectedDuration(planStartDate, planEndDate, task.estimatedDays),
      actualStartDate,
      actualEndDate,
      actualDays: getLevel1ProjectedDuration(actualStartDate, actualEndDate, task.actualDays),
      delayStatus: getLevel1DelayStatus(planEndDate, actualEndDate, today),
    }
  })
}

export const validateLevel1MilestoneDates = (tasks: readonly Level1PlanTask[]): Level1DateValidationResult => {
  const sequence = getMilestoneSequence(tasks)
  const violations: Level1DateViolation[] = []
  const byTaskId: Level1DateValidationResult['byTaskId'] = {}

  ;(['planEndDate', 'actualEndDate'] as const).forEach(field => {
    let previous: Level1PlanTask | null = null
    sequence.forEach(task => {
      const value = typeof task[field] === 'string' ? task[field] as string : ''
      if (!value) return
      const timestamp = parseStrictDate(value)
      if (timestamp === null) {
        const message = `${field === 'planEndDate' ? '计划完成时间' : '实际结束时间'}格式无效`
        violations.push({ taskId: task.id, field, message })
        byTaskId[task.id] = byTaskId[task.id] || {}
        byTaskId[task.id][field] = [...(byTaskId[task.id][field] || []), message]
        return
      }
      if (previous) {
        const previousValue = previous[field] as string
        const previousTimestamp = parseStrictDate(previousValue)
        if (previousTimestamp !== null && timestamp <= previousTimestamp) {
          const message = `${field === 'planEndDate' ? '计划完成时间' : '实际结束时间'}必须晚于上一节点“${previous.taskName}”的${previousValue}`
          violations.push({ taskId: task.id, field, message })
          byTaskId[task.id] = byTaskId[task.id] || {}
          byTaskId[task.id][field] = [...(byTaskId[task.id][field] || []), message]
        }
      }
      previous = task
    })
  })

  return { valid: violations.length === 0, violations, byTaskId }
}

export const projectLevel1Plan = (
  tasks: readonly Level1PlanTask[],
  options: { mode?: Level1ProjectionMode; today?: string } = {},
): { rows: Level1PlanViewRow[]; stageGroups: Array<{ stage: Level1PlanViewRow; milestones: Level1PlanViewRow[] }>; validation: Level1DateValidationResult } => {
  const mode = options.mode || 'standard'
  const today = options.today || new Date().toISOString().slice(0, 10)
  const ordered = getOrderedLevel1Tasks(tasks)
  const validation = validateLevel1MilestoneDates(ordered)

  if (mode === 'technical-subproject') {
    const rows = projectTechnicalSubprojectRows(ordered, { today }).map(row => ({
      ...row,
      manpowerPercent: null,
      isMilestone: true,
    }))
    return { rows, stageGroups: [], validation }
  }

  const roots = sortByOrder(ordered.filter(task => !task.parentId))
  const computedById = new Map<string, Level1PlanViewRow>()
  let previousPlanEnd = ''
  let previousActualEnd = ''

  roots.forEach(root => {
    const milestones = sortByOrder(ordered.filter(task => task.parentId === root.id))
    const planned = milestones.filter(task => isValidLevel1Date(task.planEndDate))
    const actual = milestones.filter(task => isValidLevel1Date(task.actualEndDate))
    const planEndDate = planned.at(-1)?.planEndDate || ''
    const actualEndDate = actual.at(-1)?.actualEndDate || ''
    const planStartDate = planEndDate
      ? (previousPlanEnd ? addLevel1Days(previousPlanEnd, 1) : planned[0]?.planEndDate || '')
      : ''
    const actualStartDate = actualEndDate
      ? (previousActualEnd ? addLevel1Days(previousActualEnd, 1) : actual[0]?.actualEndDate || '')
      : ''

    const stage: Level1PlanViewRow = {
      ...root,
      planStartDate,
      planEndDate,
      estimatedDays: getLevel1DateDifference(planStartDate, planEndDate),
      actualStartDate,
      actualEndDate,
      actualDays: getLevel1DateDifference(actualStartDate, actualEndDate),
      delayStatus: '',
      manpowerPercent: null,
      isMilestone: false,
    }
    computedById.set(root.id, stage)
    milestones.forEach(task => computedById.set(task.id, {
      ...task,
      planStartDate: '',
      planEndDate: task.planEndDate || '',
      estimatedDays: null,
      actualStartDate: '',
      actualEndDate: task.actualEndDate || '',
      actualDays: null,
      delayStatus: getLevel1DelayStatus(task.planEndDate || '', task.actualEndDate || '', today),
      manpowerPercent: null,
      isMilestone: true,
    }))
    if (planEndDate) previousPlanEnd = planEndDate
    if (actualEndDate) previousActualEnd = actualEndDate
  })

  ordered.filter(task => !computedById.has(task.id)).forEach(task => computedById.set(task.id, {
    ...task,
    planStartDate: '',
    planEndDate: task.planEndDate || '',
    estimatedDays: null,
    actualStartDate: '',
    actualEndDate: task.actualEndDate || '',
    actualDays: null,
    delayStatus: getLevel1DelayStatus(task.planEndDate || '', task.actualEndDate || '', today),
    manpowerPercent: null,
    isMilestone: true,
  }))

  const totalEstimatedDays = roots.reduce((sum, root) => sum + (computedById.get(root.id)?.estimatedDays || 0), 0)
  roots.forEach(root => {
    const stage = computedById.get(root.id)
    if (!stage || stage.estimatedDays === null || totalEstimatedDays <= 0) return
    const value = Math.round((stage.estimatedDays / totalEstimatedDays) * 1000) / 10
    stage.manpowerPercent = Number.isInteger(value) ? Math.trunc(value) : value
  })

  const rows = ordered.map(task => computedById.get(task.id)!)
  const stageGroups = roots.map(root => ({
    stage: computedById.get(root.id)!,
    milestones: sortByOrder(ordered.filter(task => task.parentId === root.id)).map(task => computedById.get(task.id)!),
  }))
  return { rows, stageGroups, validation }
}

export const canMaintainLevel1Plan = (input: {
  projectType: string
  currentUser: string
  spmUsers: string[]
  technicalLead: string
  globalAdmins: string[]
}): boolean => {
  if (input.globalAdmins.includes(input.currentUser)) return true
  if (input.projectType === '技术项目') return input.technicalLead === input.currentUser
  return input.spmUsers.includes(input.currentUser)
}

const isLaunchStageTask = (task?: Level1PlanTask) => Boolean(
  task && (task.stableId === 'stage-launch' || task.taskName === '上市收编阶段'),
)

export const canAddLevel1CustomChild = (
  projectType: string,
  parent: Level1PlanTask,
): boolean => projectType === '整机产品项目' && !parent.parentId && isLaunchStageTask(parent)

export const canMutateLevel1TaskStructure = (
  input: Level1StructureMutationInput,
): boolean => {
  if (input.task.source !== 'custom') return false
  if (input.technicalKind === 'tdt') return false
  if (input.technicalKind === 'subproject') return !input.task.parentId
  return input.projectType === '整机产品项目'
    && Boolean(input.task.parentId)
    && isLaunchStageTask(input.parent)
}

const getStableId = (task: Level1PlanTask) => task.stableId || task.id

const assertUniqueStableIds = (tasks: Level1PlanTask[], label: string) => {
  const seen = new Set<string>()
  tasks.forEach(task => {
    const stableId = getStableId(task)
    if (!stableId || seen.has(stableId)) throw new Error(`${label}存在未知或重复稳定任务ID: ${stableId || '-'}`)
    seen.add(stableId)
  })
}

export const buildFirstLevel1RevisionTasks = (
  previousPublishedTasks: Level1PlanTask[],
  latestTemplateTasks: Level1PlanTask[],
): Level1PlanTask[] => {
  assertUniqueStableIds(previousPublishedTasks, '上一正式版本')
  assertUniqueStableIds(latestTemplateTasks, '最新模板')
  const previousByStableId = new Map(previousPublishedTasks.map(task => [getStableId(task), task]))
  const syncedTemplate = latestTemplateTasks.map(templateTaskValue => {
    const stableId = getStableId(templateTaskValue)
    const previous = previousByStableId.get(stableId)
    return {
      ...cloneTask(templateTaskValue),
      stableId,
      source: 'template' as const,
      planEndDate: previous?.planEndDate || '',
      actualEndDate: previous?.actualEndDate || '',
    }
  })
  const customTasks = previousPublishedTasks
    .filter(task => task.source === 'custom')
    .map(task => ({ ...cloneTask(task), source: 'custom' as const }))
  return [...syncedTemplate, ...customTasks]
}

export const buildNextLevel1RevisionTasks = (previousPublishedTasks: Level1PlanTask[]): Level1PlanTask[] => {
  assertUniqueStableIds(previousPublishedTasks, '上一正式版本')
  return previousPublishedTasks.map(cloneTask)
}

export const synchronizeLevel1ActualEndDate = (
  sourceTasks: Level1PlanTask[],
  pairedTasks: Level1PlanTask[],
  taskId: string,
  actualEndDate: string,
): { sourceTasks: Level1PlanTask[]; pairedTasks: Level1PlanTask[] } => {
  const sourceTask = sourceTasks.find(task => task.id === taskId)
  if (!sourceTask) return { sourceTasks: sourceTasks.map(cloneTask), pairedTasks: pairedTasks.map(cloneTask) }
  const stableId = getStableId(sourceTask)
  const update = (tasks: Level1PlanTask[]) => tasks.map(task => (
    getStableId(task) === stableId ? { ...cloneTask(task), actualEndDate } : cloneTask(task)
  ))
  return { sourceTasks: update(sourceTasks), pairedTasks: update(pairedTasks) }
}
