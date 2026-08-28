export type Level1TaskSource = 'template' | 'custom'
export type Level1ProjectionMode = 'standard' | 'technical-subproject'
export type Level1DelayStatus = '延期' | '按时' | '-'
export type Level1ProjectKind = 'machine' | 'tos'
export type Level1NodeKind = 'stage' | 'fixed-milestone' | 'business-period'
export type Level1DateField = 'planStartDate' | 'planEndDate' | 'actualStartDate' | 'actualEndDate'

export interface Level1PlanTask {
  id: string
  stableId?: string
  parentId?: string | null
  order: number
  taskName: string
  role?: string
  source?: Level1TaskSource
  nodeKind?: Level1NodeKind
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
  field: Level1DateField
  message: string
}

export interface Level1DateValidationResult {
  valid: boolean
  violations: Level1DateViolation[]
  byTaskId: Record<string, Partial<Record<Level1DateField, string[]>>>
}

export type ReorderLevel1BusinessNodesResult =
  | { ok: true; tasks: Level1PlanTask[] }
  | { ok: false; message: string }

export const LEVEL1_SCHEDULE_ORDER_ERROR = '下一个子节点日期不允许超上一个子节点。'

const templateTask = (
  id: string,
  parentId: string | null,
  order: number,
  taskName: string,
  nodeKind: Level1NodeKind,
  role = '',
): Level1PlanTask => ({
  id,
  stableId: id,
  parentId,
  order,
  taskName,
  role,
  source: 'template',
  nodeKind,
  planStartDate: '',
  planEndDate: '',
  estimatedDays: null,
  actualStartDate: '',
  actualEndDate: '',
  actualDays: null,
})

export const MACHINE_LEVEL1_TEMPLATE_TASKS: Level1PlanTask[] = [
  templateTask('machine-stage-concept', null, 0, '概念阶段', 'stage'),
  templateTask('machine-ms-concept-kickoff', 'machine-stage-concept', 0, '概念启动', 'fixed-milestone', 'SPM'),
  templateTask('machine-ms-str1', 'machine-stage-concept', 1, 'STR1', 'fixed-milestone', 'SPM'),
  templateTask('machine-stage-planning', null, 1, '计划阶段', 'stage'),
  templateTask('machine-ms-str2', 'machine-stage-planning', 0, 'STR2', 'fixed-milestone', 'SPM'),
  templateTask('machine-ms-str3', 'machine-stage-planning', 1, 'STR3', 'fixed-milestone', 'SPM'),
  templateTask('machine-stage-development', null, 2, '开发验证阶段', 'stage'),
  templateTask('machine-ms-str4', 'machine-stage-development', 0, 'STR4', 'fixed-milestone', 'SPM'),
  templateTask('machine-ms-str4a', 'machine-stage-development', 1, 'STR4A', 'fixed-milestone', 'SPM'),
  templateTask('machine-ms-str5', 'machine-stage-development', 2, 'STR5', 'fixed-milestone', 'SPM'),
  templateTask('machine-stage-launch', null, 3, '上市阶段', 'stage'),
  templateTask('machine-stage-lifecycle', null, 4, '生命周期阶段', 'stage'),
]

export const TOS_LEVEL1_TEMPLATE_TASKS: Level1PlanTask[] = [
  templateTask('tos-stage-concept', null, 0, '概念阶段', 'stage'),
  templateTask('tos-ms-concept-kickoff', 'tos-stage-concept', 0, '概念启动', 'fixed-milestone', 'SPM'),
  templateTask('tos-ms-str1', 'tos-stage-concept', 1, 'STR1', 'fixed-milestone', 'SPM'),
  templateTask('tos-stage-plan', null, 1, '计划阶段', 'stage'),
  templateTask('tos-ms-str2', 'tos-stage-plan', 0, 'STR2', 'fixed-milestone', 'SPM'),
  templateTask('tos-ms-str3', 'tos-stage-plan', 1, 'STR3', 'fixed-milestone', 'SPM'),
  templateTask('tos-stage-development-validation', null, 2, '开发验证阶段', 'stage'),
  templateTask('tos-ms-str4', 'tos-stage-development-validation', 0, 'STR4', 'fixed-milestone', 'SPM'),
  templateTask('tos-ms-str4a', 'tos-stage-development-validation', 1, 'STR4A', 'fixed-milestone', 'SPM'),
  templateTask('tos-ms-str5', 'tos-stage-development-validation', 2, 'STR5', 'fixed-milestone', 'SPM'),
  templateTask('tos-stage-launch-iteration', null, 3, '上市迭代阶段', 'stage'),
  templateTask('tos-stage-maintenance', null, 4, '维护阶段', 'stage'),
]

export const CAPABILITY_LEVEL1_TEMPLATE_TASKS: Level1PlanTask[] = [
  templateTask('capability-stage-concept', null, 0, '概念阶段', 'stage'),
  templateTask('capability-ms-concept-kickoff', 'capability-stage-concept', 0, '概念启动', 'fixed-milestone', 'SPM'),
  templateTask('capability-ms-str1', 'capability-stage-concept', 1, 'STR1', 'fixed-milestone', 'SPM'),
  templateTask('capability-stage-planning', null, 1, '计划阶段', 'stage'),
  templateTask('capability-ms-str2', 'capability-stage-planning', 0, 'STR2', 'fixed-milestone', 'SPM'),
  templateTask('capability-ms-str3', 'capability-stage-planning', 1, 'STR3', 'fixed-milestone', 'SPM'),
  templateTask('capability-stage-development', null, 2, '开发阶段', 'stage'),
  templateTask('capability-ms-str4', 'capability-stage-development', 0, 'STR4', 'fixed-milestone', 'SPM'),
  templateTask('capability-ms-str4a', 'capability-stage-development', 1, 'STR4A', 'fixed-milestone', 'SPM'),
  templateTask('capability-stage-validation', null, 3, '验证阶段', 'stage'),
  templateTask('capability-ms-str5', 'capability-stage-validation', 0, 'STR5', 'fixed-milestone', 'SPM'),
  templateTask('capability-stage-launch', null, 4, '上市阶段', 'stage'),
  templateTask('capability-stage-lifecycle', null, 5, '生命周期阶段', 'stage'),
]

/** Compatibility export for callers that have not yet selected a project-specific template. */
export const STANDARD_LEVEL1_TEMPLATE_TASKS = MACHINE_LEVEL1_TEMPLATE_TASKS

const MACHINE_MOCK_DATES: Record<string, { planEndDate: string; actualEndDate: string }> = {
  'machine-ms-concept-kickoff': { planEndDate: '2026-02-26', actualEndDate: '2026-02-27' },
  'machine-ms-str1': { planEndDate: '2026-03-17', actualEndDate: '2026-03-18' },
  'machine-ms-str2': { planEndDate: '2026-04-28', actualEndDate: '2026-04-28' },
  'machine-ms-str3': { planEndDate: '2026-05-22', actualEndDate: '2026-05-22' },
  'machine-ms-str4': { planEndDate: '2026-07-31', actualEndDate: '2026-07-31' },
  'machine-ms-str4a': { planEndDate: '2026-10-12', actualEndDate: '2026-10-12' },
  'machine-ms-str5': { planEndDate: '2026-12-15', actualEndDate: '2026-12-15' },
}

const TOS_MOCK_DATES: Record<string, { planEndDate: string; actualEndDate: string }> = {
  'tos-ms-concept-kickoff': { planEndDate: '2026-02-26', actualEndDate: '2026-02-27' },
  'tos-ms-str1': { planEndDate: '2026-03-17', actualEndDate: '2026-03-18' },
  'tos-ms-str2': { planEndDate: '2026-04-28', actualEndDate: '2026-04-28' },
  'tos-ms-str3': { planEndDate: '2026-05-22', actualEndDate: '2026-05-22' },
  'tos-ms-str4': { planEndDate: '2026-07-31', actualEndDate: '2026-07-31' },
  'tos-ms-str4a': { planEndDate: '2026-10-12', actualEndDate: '2026-10-12' },
  'tos-ms-str5': { planEndDate: '2026-12-15', actualEndDate: '2026-12-15' },
}

const CAPABILITY_MOCK_DATES: Record<string, { planEndDate: string; actualEndDate: string }> = {
  'capability-ms-concept-kickoff': MACHINE_MOCK_DATES['machine-ms-concept-kickoff'],
  'capability-ms-str1': MACHINE_MOCK_DATES['machine-ms-str1'],
  'capability-ms-str2': MACHINE_MOCK_DATES['machine-ms-str2'],
  'capability-ms-str3': MACHINE_MOCK_DATES['machine-ms-str3'],
  'capability-ms-str4': MACHINE_MOCK_DATES['machine-ms-str4'],
  'capability-ms-str4a': MACHINE_MOCK_DATES['machine-ms-str4a'],
  'capability-ms-str5': MACHINE_MOCK_DATES['machine-ms-str5'],
}

const buildTemplateTasks = (
  template: readonly Level1PlanTask[],
  mockDatesByStableId: Readonly<Record<string, { planEndDate: string; actualEndDate: string }>>,
  withMockDates: boolean,
): Level1PlanTask[] => {
  const idByStableId = new Map<string, string>()
  const childCountByParent = new Map<string, number>()
  let rootCount = 0
  template.forEach(task => {
    if (!task.parentId) {
      rootCount += 1
      idByStableId.set(task.id, String(rootCount))
      return
    }
    const childCount = (childCountByParent.get(task.parentId) || 0) + 1
    childCountByParent.set(task.parentId, childCount)
    idByStableId.set(task.id, `${idByStableId.get(task.parentId)}.${childCount}`)
  })

  return template.map(task => {
    const mockDates = withMockDates ? mockDatesByStableId[task.id] : undefined
    return {
      ...task,
      id: idByStableId.get(task.id)!,
      stableId: task.id,
      parentId: task.parentId ? idByStableId.get(task.parentId) || null : null,
      role: task.role || '',
      responsible: task.role || '',
      predecessor: '',
      planStartDate: '',
      planEndDate: mockDates?.planEndDate || '',
      estimatedDays: null,
      actualStartDate: '',
      actualEndDate: mockDates?.actualEndDate || '',
      actualDays: null,
      status: '未开始',
      progress: 0,
      defaultRoadmap: Boolean(task.parentId),
    }
  })
}

export const buildMachineLevel1Tasks = (withMockDates = true): Level1PlanTask[] => (
  buildTemplateTasks(MACHINE_LEVEL1_TEMPLATE_TASKS, MACHINE_MOCK_DATES, withMockDates)
)

export const buildTosLevel1Tasks = (withMockDates = true): Level1PlanTask[] => (
  buildTemplateTasks(TOS_LEVEL1_TEMPLATE_TASKS, TOS_MOCK_DATES, withMockDates)
)

export const buildCapabilityLevel1Tasks = (withMockDates = true): Level1PlanTask[] => (
  buildTemplateTasks(CAPABILITY_LEVEL1_TEMPLATE_TASKS, CAPABILITY_MOCK_DATES, withMockDates)
)

export const buildLevel1TasksForProjectType = (
  projectType: string,
  withMockDates = true,
): Level1PlanTask[] => {
  if (projectType === 'tOS版本项目') return buildTosLevel1Tasks(withMockDates)
  if (projectType === '能力建设项目') return buildCapabilityLevel1Tasks(withMockDates)
  return buildMachineLevel1Tasks(withMockDates)
}

/** Whole-machine compatibility alias for legacy callers pending scoped migration. */
export const buildStandardLevel1Tasks = buildMachineLevel1Tasks

export const parseTosProjectVersionPrefix = (projectName: string) => {
  const match = /tOS\s*(\d+)\.(\d+)/i.exec(projectName)
  return match
    ? { major: match[1], minor: match[2], prefix: `${match[1]}.${match[2]}.0` }
    : null
}

export const validateTosBusinessVersionName = (projectName: string, taskName: string) => {
  const parsed = parseTosProjectVersionPrefix(projectName)
  if (!parsed) return { valid: false, message: '无法从项目名称解析 tOS 版本前缀' }
  const valid = new RegExp(`^${parsed.major}\\.${parsed.minor}\\.0\\.\\d{2}[05]$`).test(taskName)
  return {
    valid,
    message: valid ? '' : `版本号必须符合 ${parsed.prefix}.XXX，且尾号最后一位为0或5`,
  }
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

export const getLevel1InclusiveDuration = (start: string, end: string): number | null => {
  const difference = getLevel1DateDifference(start, end)
  return difference === null ? null : difference + 1
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

/** Flat milestone cycles are the interval between adjacent completion points. */
export const getLevel1AdjacentMilestoneDuration = (
  previousEndDate: unknown,
  currentEndDate: unknown,
): number | null => getLevel1DateDifference(
  getLevel1ScheduleDate(previousEndDate),
  getLevel1ScheduleDate(currentEndDate),
)

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
  const milestones = ordered.filter(task => Boolean(task.parentId))

  return milestones.map((task, index) => {
    const stage = stagesById.get(task.parentId!)
    const previousMilestone = milestones[index - 1]
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
      estimatedDays: previousMilestone
        ? getLevel1AdjacentMilestoneDuration(previousMilestone.planEndDate, planEndDate)
        : getLevel1ProjectedDuration(planStartDate, planEndDate, task.estimatedDays),
      actualStartDate,
      actualEndDate,
      actualDays: previousMilestone
        ? getLevel1AdjacentMilestoneDuration(previousMilestone.actualEndDate, actualEndDate)
        : getLevel1ProjectedDuration(actualStartDate, actualEndDate, task.actualDays),
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

const LEVEL1_DATE_FIELDS: readonly Level1DateField[] = [
  'planStartDate',
  'planEndDate',
  'actualStartDate',
  'actualEndDate',
]

const LEVEL1_DATE_FIELD_LABELS: Record<Level1DateField, string> = {
  planStartDate: '计划开始时间',
  planEndDate: '计划完成时间',
  actualStartDate: '实际开始时间',
  actualEndDate: '实际完成时间',
}

const LEVEL1_DATE_AXES = [
  { startField: 'planStartDate', endField: 'planEndDate', label: '计划' },
  { startField: 'actualStartDate', endField: 'actualEndDate', label: '实际' },
] as const

export const validateLevel1ScheduleDates = (tasks: readonly Level1PlanTask[]): Level1DateValidationResult => {
  const ordered = getOrderedLevel1Tasks(tasks)
  const parentIds = new Set(ordered.flatMap(task => task.parentId ? [task.parentId] : []))
  const getNodeKind = (task: Level1PlanTask): Level1NodeKind => (
    task.nodeKind || (parentIds.has(task.id) ? 'stage' : 'fixed-milestone')
  )
  const violations: Level1DateViolation[] = []
  const byTaskId: Level1DateValidationResult['byTaskId'] = {}

  const addViolation = (task: Level1PlanTask, field: Level1DateField, message: string) => {
    const fieldMessages = byTaskId[task.id]?.[field] || []
    if (fieldMessages.includes(message)) return
    violations.push({ taskId: task.id, field, message })
    byTaskId[task.id] = byTaskId[task.id] || {}
    byTaskId[task.id][field] = [...fieldMessages, message]
  }

  const getValidTime = (task: Level1PlanTask, field: Level1DateField): number | null => (
    parseStrictDate(task[field])
  )

  ordered.forEach(task => {
    const nodeKind = getNodeKind(task)
    const editableFields = nodeKind === 'business-period'
      ? LEVEL1_DATE_FIELDS
      : nodeKind === 'fixed-milestone'
        ? (['planEndDate', 'actualEndDate'] as const)
        : []
    editableFields.forEach(field => {
      const value = task[field]
      if (value === undefined || value === null || value === '') return
      if (parseStrictDate(value) === null) {
        addViolation(task, field, `${LEVEL1_DATE_FIELD_LABELS[field]}格式无效`)
      }
    })

    if (nodeKind !== 'business-period') return
    LEVEL1_DATE_AXES.forEach(({ startField, endField, label }) => {
      const start = getValidTime(task, startField)
      const end = getValidTime(task, endField)
      if (start === null || end === null || start <= end) return
      addViolation(task, startField, `${label}开始时间不得晚于完成时间`)
      addViolation(task, endField, `${label}完成时间不得早于开始时间`)
    })
  })

  LEVEL1_DATE_AXES.forEach(({ endField }) => {
    let previous: Level1PlanTask | null = null
    ordered.filter(task => getNodeKind(task) === 'fixed-milestone').forEach(task => {
      const timestamp = getValidTime(task, endField)
      if (timestamp === null) return
      if (previous) {
        const previousTimestamp = getValidTime(previous, endField)
        const violatesOrder = previousTimestamp !== null && timestamp <= previousTimestamp
        if (violatesOrder) {
          addViolation(task, endField, LEVEL1_SCHEDULE_ORDER_ERROR)
        }
      }
      previous = task
    })
  })

  const roots = sortByOrder(ordered.filter(task => getNodeKind(task) === 'stage'))
  const childrenByParent = new Map<string, Level1PlanTask[]>()
  ordered.forEach(task => {
    if (!task.parentId) return
    const children = childrenByParent.get(task.parentId) || []
    children.push(task)
    childrenByParent.set(task.parentId, children)
  })

  roots.forEach(stage => {
    const businessPeriods = sortByOrder((childrenByParent.get(stage.id) || [])
      .filter(task => getNodeKind(task) === 'business-period'))
    LEVEL1_DATE_AXES.forEach(({ startField, endField }) => {
      let blockingPeriod: Level1PlanTask | null = null
      businessPeriods.forEach(task => {
        const start = getValidTime(task, startField)
        const end = getValidTime(task, endField)
        if (start === null || end === null || start > end) return
        if (blockingPeriod) {
          const blockingEnd = getValidTime(blockingPeriod, endField)
          if (blockingEnd !== null && start <= blockingEnd) {
            addViolation(task, startField, LEVEL1_SCHEDULE_ORDER_ERROR)
          }
          if (blockingEnd !== null && end <= blockingEnd) return
        }
        blockingPeriod = task
      })
    })
  })

  type Level1StageBoundary = {
    start: number
    end: number
    startTask: Level1PlanTask
    startField: Level1DateField
  }

  LEVEL1_DATE_AXES.forEach(({ startField, endField }) => {
    let blockingStageEnd: number | null = null
    roots.forEach(stage => {
      const scheduled = sortByOrder(childrenByParent.get(stage.id) || []).flatMap<Level1StageBoundary>(task => {
        const nodeKind = getNodeKind(task)
        const end = getValidTime(task, endField)
        if (nodeKind === 'fixed-milestone') {
          return end === null
            ? []
            : [{ start: end, end, startTask: task, startField: endField }]
        }
        if (nodeKind !== 'business-period') return []
        const start = getValidTime(task, startField)
        return start === null || end === null || start > end
          ? []
          : [{ start, end, startTask: task, startField }]
      })
      const stageStart = scheduled.reduce<Level1StageBoundary | null>((earliest, boundary) => (
        !earliest || boundary.start < earliest.start ? boundary : earliest
      ), null)
      const stageEnd = scheduled.reduce<number | null>((latest, boundary) => (
        latest === null || boundary.end > latest ? boundary.end : latest
      ), null)
      if (!stageStart || stageEnd === null || stageStart.start > stageEnd) return
      if (blockingStageEnd !== null && stageStart.start <= blockingStageEnd) {
        addViolation(stageStart.startTask, stageStart.startField, LEVEL1_SCHEDULE_ORDER_ERROR)
      }
      if (blockingStageEnd === null || stageEnd > blockingStageEnd) {
        blockingStageEnd = stageEnd
      }
    })
  })

  return { valid: violations.length === 0, violations, byTaskId }
}

/** Compatibility alias for callers that still use the milestone-specific name. */
export const validateLevel1MilestoneDates = validateLevel1ScheduleDates

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
  const usesProjectSpecificNodeModel = ordered.some(task => task.nodeKind !== undefined)

  const getNodeKind = (task: Level1PlanTask): Level1NodeKind => (
    task.nodeKind || (task.parentId ? 'fixed-milestone' : 'stage')
  )
  const getStageRange = (
    children: readonly Level1PlanTask[],
    startField: 'planStartDate' | 'actualStartDate',
    endField: 'planEndDate' | 'actualEndDate',
    previousStageEnd: string,
  ): { startDate: string; endDate: string; duration: number | null } => {
    const scheduled = children.flatMap(child => {
      const nodeKind = getNodeKind(child)
      const startDate = isValidLevel1Date(child[startField]) ? child[startField] : ''
      const endDate = isValidLevel1Date(child[endField]) ? child[endField] : ''
      if (nodeKind === 'fixed-milestone') {
        return endDate ? [{ startDate: '', endDate }] : []
      }
      if (nodeKind === 'business-period' && getLevel1DateDifference(startDate, endDate) !== null) {
        return [{ startDate, endDate }]
      }
      return []
    })
    const first = scheduled[0]
    const endDate = scheduled.at(-1)?.endDate || ''
    if (!first || !endDate) return { startDate: '', endDate, duration: null }
    const startDate = first.startDate || (previousStageEnd ? addLevel1Days(previousStageEnd, 1) : first.endDate)
    return {
      startDate,
      endDate,
      duration: getLevel1DateDifference(startDate, endDate),
    }
  }

  roots.forEach(root => {
    const children = sortByOrder(ordered.filter(task => task.parentId === root.id))
    if (!usesProjectSpecificNodeModel) {
      const plannedChildren = children.filter(task => isValidLevel1Date(task.planEndDate))
      const actualChildren = children.filter(task => isValidLevel1Date(task.actualEndDate))
      const planEndDate = plannedChildren.at(-1)?.planEndDate || ''
      const actualEndDate = actualChildren.at(-1)?.actualEndDate || ''
      const planStartDate = planEndDate
        ? (previousPlanEnd ? addLevel1Days(previousPlanEnd, 1) : plannedChildren[0]?.planEndDate || '')
        : ''
      const actualStartDate = actualEndDate
        ? (previousActualEnd ? addLevel1Days(previousActualEnd, 1) : actualChildren[0]?.actualEndDate || '')
        : ''

      computedById.set(root.id, {
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
      })
      children.forEach(task => computedById.set(task.id, {
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
      return
    }

    const planned = getStageRange(children, 'planStartDate', 'planEndDate', previousPlanEnd)
    const actual = getStageRange(children, 'actualStartDate', 'actualEndDate', previousActualEnd)

    const stage: Level1PlanViewRow = {
      ...root,
      planStartDate: planned.startDate,
      planEndDate: planned.endDate,
      estimatedDays: planned.duration,
      actualStartDate: actual.startDate,
      actualEndDate: actual.endDate,
      actualDays: actual.duration,
      delayStatus: '',
      manpowerPercent: null,
      isMilestone: false,
    }
    computedById.set(root.id, stage)
    children.forEach(task => {
      const nodeKind = getNodeKind(task)
      const planStartDate = nodeKind === 'business-period' ? getLevel1ScheduleDate(task.planStartDate) : ''
      const planEndDate = getLevel1ScheduleDate(task.planEndDate)
      const actualStartDate = nodeKind === 'business-period' ? getLevel1ScheduleDate(task.actualStartDate) : ''
      const actualEndDate = getLevel1ScheduleDate(task.actualEndDate)
      computedById.set(task.id, {
        ...task,
        planStartDate,
        planEndDate,
        estimatedDays: nodeKind === 'business-period'
          ? getLevel1DateDifference(planStartDate, planEndDate)
          : null,
        actualStartDate,
        actualEndDate,
        actualDays: nodeKind === 'business-period'
          ? getLevel1DateDifference(actualStartDate, actualEndDate)
          : null,
        delayStatus: getLevel1DelayStatus(planEndDate, actualEndDate, today),
        manpowerPercent: null,
        isMilestone: nodeKind === 'fixed-milestone',
      })
    })
    if (planned.endDate) previousPlanEnd = planned.endDate
    if (actual.endDate) previousActualEnd = actual.endDate
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
    isMilestone: getNodeKind(task) === 'fixed-milestone',
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

export const renumberLevel1Tasks = (tasks: readonly Level1PlanTask[]): Level1PlanTask[] => {
  const indexed = tasks.map((task, index) => ({ task: cloneTask(task), index }))
  const knownIds = new Set(indexed.map(({ task }) => task.id))
  const sortSiblings = (items: typeof indexed) => [...items].sort((left, right) => (
    left.task.order - right.task.order || left.index - right.index
  ))
  const roots = sortSiblings(indexed.filter(({ task }) => !task.parentId || !knownIds.has(task.parentId)))
  const childrenByParent = new Map<string, typeof indexed>()
  indexed.forEach(item => {
    if (!item.task.parentId || !knownIds.has(item.task.parentId)) return
    childrenByParent.set(item.task.parentId, [...(childrenByParent.get(item.task.parentId) || []), item])
  })
  const numbered: Level1PlanTask[] = []
  const included = new Set<number>()
  const addRoot = (item: (typeof indexed)[number], rootIndex: number) => {
    if (included.has(item.index)) return
    included.add(item.index)
    const rootId = String(rootIndex + 1)
    const { parentId: _parentId, ...root } = item.task
    numbered.push({ ...root, id: rootId, order: rootIndex + 1 })
    sortSiblings(childrenByParent.get(item.task.id) || []).forEach((child, childIndex) => {
      if (included.has(child.index)) return
      included.add(child.index)
      numbered.push({ ...child.task, id: `${rootId}.${childIndex + 1}`, parentId: rootId, order: childIndex + 1 })
    })
  }
  roots.forEach((root, rootIndex) => addRoot(root, rootIndex))
  indexed.filter(item => !included.has(item.index)).forEach(item => addRoot(item, numbered.filter(task => !task.parentId).length))
  return numbered
}

const renumberLevel1TaskDisplayFields = (tasks: readonly Level1PlanTask[]): Level1PlanTask[] => {
  const indexed = tasks.map((task, index) => ({ task: { ...task }, index }))
  const knownIds = new Set(indexed.map(({ task }) => task.id))
  const sortSiblings = (items: typeof indexed) => [...items].sort((left, right) => (
    left.task.order - right.task.order || left.index - right.index
  ))
  const roots = sortSiblings(indexed.filter(({ task }) => !task.parentId || !knownIds.has(task.parentId)))
  const childrenByParent = new Map<string, typeof indexed>()
  indexed.forEach(item => {
    if (!item.task.parentId || !knownIds.has(item.task.parentId)) return
    childrenByParent.set(item.task.parentId, [...(childrenByParent.get(item.task.parentId) || []), item])
  })
  const numbered: Level1PlanTask[] = []
  const included = new Set<number>()
  const addRoot = (item: (typeof indexed)[number], rootIndex: number) => {
    if (included.has(item.index)) return
    included.add(item.index)
    const rootId = String(rootIndex + 1)
    numbered.push({ ...item.task, id: rootId, order: rootIndex + 1 })
    sortSiblings(childrenByParent.get(item.task.id) || []).forEach((child, childIndex) => {
      if (included.has(child.index)) return
      included.add(child.index)
      numbered.push({ ...child.task, id: `${rootId}.${childIndex + 1}`, parentId: rootId, order: childIndex + 1 })
    })
  }
  roots.forEach((root, rootIndex) => addRoot(root, rootIndex))
  indexed.filter(item => !included.has(item.index)).forEach(item => addRoot(item, numbered.filter(task => !task.parentId).length))
  return numbered
}

export const reorderLevel1BusinessNodes = (
  tasks: readonly Level1PlanTask[],
  activeStableId: string,
  overStableId: string,
): ReorderLevel1BusinessNodesResult => {
  const active = tasks.find(task => (task.stableId || task.id) === activeStableId)
  const over = tasks.find(task => (task.stableId || task.id) === overStableId)
  if (!active || !over) {
    return { ok: false, message: '未找到需要调整顺序的业务节点' }
  }
  const isCustomBusinessNode = (task: Level1PlanTask) => (
    task.source === 'custom' && task.nodeKind === 'business-period' && Boolean(task.parentId)
  )
  if (!isCustomBusinessNode(active) || !isCustomBusinessNode(over)) {
    return { ok: false, message: '只能调整自定义业务节点的顺序' }
  }
  if (active.parentId !== over.parentId) {
    return { ok: false, message: '只能在同一阶段内调整业务节点顺序' }
  }
  const parent = tasks.find(task => task.id === active.parentId)
  if (!parent) {
    return { ok: false, message: '未找到业务节点所属父阶段' }
  }
  if (parent.parentId || parent.nodeKind !== 'stage') {
    return { ok: false, message: '业务节点父节点必须是一级阶段' }
  }
  if (activeStableId === overStableId) {
    return { ok: true, tasks: tasks.map(task => ({ ...task })) }
  }

  const siblings = sortByOrder(tasks.filter(task => task.parentId === active.parentId))
  const activeIndex = siblings.findIndex(task => (task.stableId || task.id) === activeStableId)
  const overIndex = siblings.findIndex(task => (task.stableId || task.id) === overStableId)
  if (activeIndex < 0 || overIndex < 0) {
    return { ok: false, message: '未找到同阶段内需要调整顺序的业务节点' }
  }
  const reorderedSiblings = [...siblings]
  const [moved] = reorderedSiblings.splice(activeIndex, 1)
  reorderedSiblings.splice(overIndex, 0, moved)
  const orderByStableId = new Map(reorderedSiblings.map((task, index) => [task.stableId || task.id, index + 1]))
  const candidate = renumberLevel1TaskDisplayFields(tasks.map(task => ({
    ...task,
    order: task.parentId === active.parentId
      ? orderByStableId.get(task.stableId || task.id) || task.order
      : task.order,
  })))
  const validation = validateLevel1ScheduleDates(candidate)
  if (!validation.valid) {
    return {
      ok: false,
      message: validation.violations.some(violation => violation.message === LEVEL1_SCHEDULE_ORDER_ERROR)
        ? LEVEL1_SCHEDULE_ORDER_ERROR
        : '调整后的节点日期无效，请先修正日期',
    }
  }
  return { ok: true, tasks: candidate }
}

export const isLaunchStageTask = (task?: Level1PlanTask) => Boolean(
  task && (task.stableId === 'stage-launch' || task.taskName === '上市阶段' || task.taskName === '上市收编阶段'),
)

export const canAddLevel1CustomChild = (
  _projectType: string,
  _parent: Level1PlanTask,
): boolean => false

export const canMutateLevel1TaskStructure = (
  input: Level1StructureMutationInput,
): boolean => {
  if (input.task.source !== 'custom') return false
  if (input.action !== 'delete') return false
  if (input.technicalKind === 'tdt') return false
  if (input.technicalKind === 'subproject') return !input.task.parentId
  return input.projectType === '整机产品项目'
    && Boolean(input.task.parentId)
    && isLaunchStageTask(input.parent)
}

const BUSINESS_STAGE_IDS: Record<Level1ProjectKind, ReadonlySet<string>> = {
  machine: new Set(['machine-stage-launch', 'machine-stage-lifecycle']),
  tos: new Set(['tos-stage-launch-iteration', 'tos-stage-maintenance']),
}

const getLevel1ProjectKind = (projectType: string): Level1ProjectKind | null => {
  if (projectType === '整机产品项目') return 'machine'
  if (projectType === 'tOS版本项目') return 'tos'
  return null
}

export const isBusinessStage = (projectType: string, task?: Level1PlanTask): boolean => {
  const projectKind = getLevel1ProjectKind(projectType)
  return Boolean(
    projectKind
    && task
    && !task.parentId
    && task.nodeKind === 'stage'
    && task.stableId
    && BUSINESS_STAGE_IDS[projectKind].has(task.stableId),
  )
}

export interface Level1StructurePermissionInput {
  projectType: string
  isDraft: boolean
  isSuperAdmin: boolean
  isSpm: boolean
  task?: Level1PlanTask
  parent?: Level1PlanTask
}

export interface Level1StructurePermissions {
  canAddStage: boolean
  canAddChild: boolean
  canRename: boolean
  canDelete: boolean
  canReorder: boolean
}

const denyLevel1StructurePermissions = (): Level1StructurePermissions => ({
  canAddStage: false,
  canAddChild: false,
  canRename: false,
  canDelete: false,
  canReorder: false,
})

export const getLevel1StructurePermissions = (
  input: Level1StructurePermissionInput,
): Level1StructurePermissions => {
  if (!getLevel1ProjectKind(input.projectType)) return denyLevel1StructurePermissions()
  if (!input.isDraft) return denyLevel1StructurePermissions()
  if (input.isSuperAdmin) {
    return { canAddStage: true, canAddChild: true, canRename: true, canDelete: true, canReorder: true }
  }
  if (!input.isSpm) return denyLevel1StructurePermissions()

  const businessParent = isBusinessStage(input.projectType, input.parent)
  const businessTask = input.task?.nodeKind === 'business-period'
    && input.task.parentId === input.parent?.id
  return {
    canAddStage: false,
    canAddChild: businessParent,
    canRename: Boolean(businessParent && businessTask),
    canDelete: Boolean(businessParent && businessTask),
    canReorder: Boolean(businessParent && businessTask),
  }
}

export interface InsertLevel1BusinessNodeInput {
  projectType: string
  projectName?: string
  parentStableId: string
  taskName: string
  now: number
}

export type InsertLevel1BusinessNodeFailureCode =
  | 'parent-missing'
  | 'parent-not-business-stage'
  | 'invalid-name'
  | 'duplicate-name'

export type InsertLevel1BusinessNodeResult =
  | { ok: true; tasks: Level1PlanTask[]; task: Level1PlanTask; parent: Level1PlanTask }
  | { ok: false; code: InsertLevel1BusinessNodeFailureCode; message: string }

export interface RenameLevel1BusinessNodeInput {
  projectType: string
  projectName?: string
  taskStableId: string
  taskName: string
}

export type RenameLevel1BusinessNodeFailureCode =
  | 'task-missing'
  | 'task-not-custom-business'
  | 'parent-missing'
  | 'parent-not-stage'
  | 'invalid-name'
  | 'duplicate-name'

export type RenameLevel1BusinessNodeResult =
  | { ok: true; tasks: Level1PlanTask[]; task: Level1PlanTask }
  | { ok: false; code: RenameLevel1BusinessNodeFailureCode; message: string }

export type InsertNextMachineMrMilestoneResult =
  | { ok: true; tasks: Level1PlanTask[]; task: Level1PlanTask }
  | { ok: false; reason: 'launch-stage-missing' | 'duplicate-name' }

const createUniqueLevel1StableId = (tasks: readonly Level1PlanTask[], candidate: string): string => {
  const existingStableIds = new Set(tasks.map(task => task.stableId || task.id))
  let stableId = candidate
  let suffix = 2
  while (existingStableIds.has(stableId)) {
    stableId = `${candidate}-${suffix}`
    suffix += 1
  }
  return stableId
}

export const insertLevel1BusinessNode = (
  tasks: readonly Level1PlanTask[],
  input: InsertLevel1BusinessNodeInput,
): InsertLevel1BusinessNodeResult => {
  const parent = tasks.find(task => task.stableId === input.parentStableId)
  if (!parent) {
    return { ok: false, code: 'parent-missing', message: '未找到指定的一级计划父阶段' }
  }
  if (!isBusinessStage(input.projectType, parent)) {
    return { ok: false, code: 'parent-not-business-stage', message: '只能在当前项目类型允许的业务阶段下新增节点' }
  }

  if (input.projectType === '整机产品项目') {
    if (!/^MR\d+$/.test(input.taskName)) {
      return {
        ok: false,
        code: 'invalid-name',
        message: '整机业务节点名称必须为 MR 加数字（例如 MR0、MR01 或 MR1）',
      }
    }
  } else {
    const validation = validateTosBusinessVersionName(input.projectName || '', input.taskName)
    if (!validation.valid) return { ok: false, code: 'invalid-name', message: validation.message }
  }

  if (tasks.some(task => task.taskName === input.taskName)) {
    return { ok: false, code: 'duplicate-name', message: '一级计划中已存在同名业务节点' }
  }

  const stableId = createUniqueLevel1StableId(tasks, `business-period-${input.now}`)
  const siblingOrder = tasks
    .filter(task => task.parentId === parent.id)
    .reduce((maximum, task) => Math.max(maximum, task.order), 0)
  const renumbered = renumberLevel1TaskDisplayFields([
    ...tasks,
    {
      id: stableId,
      stableId,
      parentId: parent.id,
      order: siblingOrder + 1,
      taskName: input.taskName,
      source: 'custom',
      nodeKind: 'business-period',
      responsible: '',
      predecessor: '',
      planStartDate: '',
      planEndDate: '',
      estimatedDays: null,
      actualStartDate: '',
      actualEndDate: '',
      actualDays: null,
      status: '未开始',
      progress: 0,
    },
  ])
  return {
    ok: true,
    tasks: renumbered,
    task: renumbered.find(task => task.stableId === stableId)!,
    parent: renumbered.find(task => task.stableId === parent.stableId)!,
  }
}

export const renameLevel1BusinessNode = (
  tasks: readonly Level1PlanTask[],
  input: RenameLevel1BusinessNodeInput,
): RenameLevel1BusinessNodeResult => {
  const task = tasks.find(candidate => (candidate.stableId || candidate.id) === input.taskStableId)
  if (!task) return { ok: false, code: 'task-missing', message: '未找到需要修改的业务节点' }
  if (task.source !== 'custom' || task.nodeKind !== 'business-period' || !task.parentId) {
    return { ok: false, code: 'task-not-custom-business', message: '只能修改自定义业务节点名称' }
  }
  const parent = tasks.find(candidate => candidate.id === task.parentId)
  if (!parent) return { ok: false, code: 'parent-missing', message: '未找到业务节点所属父阶段' }
  if (parent.parentId || parent.nodeKind !== 'stage') {
    return { ok: false, code: 'parent-not-stage', message: '业务节点父节点必须是一级阶段' }
  }

  const taskName = input.taskName.trim()
  if (input.projectType === '整机产品项目') {
    if (!/^MR\d+$/.test(taskName)) {
      return { ok: false, code: 'invalid-name', message: '整机业务节点名称必须为 MR 加数字（例如 MR0、MR01 或 MR1）' }
    }
  } else {
    const validation = validateTosBusinessVersionName(input.projectName || '', taskName)
    if (!validation.valid) return { ok: false, code: 'invalid-name', message: validation.message }
  }
  if (tasks.some(candidate => (
    candidate.id !== task.id
    && candidate.parentId === task.parentId
    && candidate.taskName === taskName
  ))) {
    return { ok: false, code: 'duplicate-name', message: '同一阶段中已存在同名业务节点' }
  }

  const renamedTasks = tasks.map(candidate => candidate.id === task.id ? { ...candidate, taskName } : { ...candidate })
  return { ok: true, tasks: renamedTasks, task: renamedTasks.find(candidate => candidate.id === task.id)! }
}

export const insertNextMachineMrMilestone = (
  tasks: readonly Level1PlanTask[],
): InsertNextMachineMrMilestoneResult => {
  const launchStage = tasks.find(task => !task.parentId && isLaunchStageTask(task))
  if (!launchStage) return { ok: false, reason: 'launch-stage-missing' }
  const maximumMr = tasks
    .filter(task => task.parentId === launchStage.id)
    .reduce((maximum, task) => {
      const match = /^MR(\d+)$/.exec(task.taskName)
      return match ? Math.max(maximum, Number(match[1])) : maximum
    }, 3)
  const taskName = `MR${maximumMr + 1}`
  if (tasks.some(task => task.taskName === taskName)) return { ok: false, reason: 'duplicate-name' }
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const stableId = createUniqueLevel1StableId(tasks, `custom-mr-${nonce}`)
  const renumbered = renumberLevel1Tasks([
    ...tasks,
    {
      id: stableId,
      stableId,
      parentId: launchStage.id,
      order: Math.max(0, ...tasks.filter(task => task.parentId === launchStage.id).map(task => task.order)) + 1,
      taskName,
      source: 'custom',
      responsible: '',
      predecessor: '',
      planStartDate: '',
      planEndDate: '',
      estimatedDays: null,
      actualStartDate: '',
      actualEndDate: '',
      actualDays: null,
      status: '未开始',
      progress: 0,
    },
  ])
  return { ok: true, tasks: renumbered, task: renumbered.find(task => task.stableId === stableId)! }
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
