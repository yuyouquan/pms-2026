import type {
  TechnicalTemplateKind,
  TechnicalTemplateTask,
  TechnicalTemplateTaskInput,
} from '@/types/technicalPlan'

export const TDT_TEMPLATE_SEED = [
  ['规划阶段', ['规划启动', 'charter DCP']],
  ['概念阶段', ['TDR1']],
  ['计划阶段', ['TDR2', 'PDCP']],
  ['开发验证阶段', ['TDR3_X', 'TDCP_X']],
  ['迁移阶段', ['TDR4', 'EDCP']],
] as const

export const SUBPROJECT_TEMPLATE_SEED = [
  '第1版转测',
  '第2版转测',
  'TDR3',
] as const

export const TECHNICAL_TEMPLATE_STORAGE_KEYS = {
  tdt: '技术项目::TDT项目计划',
  subproject: '技术项目::子项目计划',
} as const satisfies Record<TechnicalTemplateKind, string>

export const getTemplateConfigScopeKey = (projectType: string, planLevel: string) => (
  `config-template::${projectType}::${planLevel}`
)

const createTask = (
  id: string,
  order: number,
  taskName: string,
  parentId?: string,
): TechnicalTemplateTask => ({
  id,
  stableId: `${parentId ? `${parentId}-` : ''}${taskName}`,
  source: 'template',
  role: '技术项目负责人',
  order,
  taskName,
  ...(parentId ? { parentId } : {}),
  responsible: '技术项目负责人',
  predecessor: '',
  planStartDate: '',
  planEndDate: '',
  estimatedDays: 0,
  actualStartDate: '',
  actualEndDate: '',
  actualDays: 0,
  status: '未开始',
  progress: 0,
  defaultRoadmap: Boolean(parentId),
})

export const buildTdtTemplateTasks = (): TechnicalTemplateTask[] => (
  TDT_TEMPLATE_SEED.flatMap(([phaseName, children], phaseIndex) => {
    const parentId = String(phaseIndex + 1)
    return [
      createTask(parentId, phaseIndex + 1, phaseName),
      ...children.map((taskName, childIndex) => (
        createTask(`${parentId}.${childIndex + 1}`, childIndex + 1, taskName, parentId)
      )),
    ]
  })
)

export const buildSubprojectTemplateTasks = (): TechnicalTemplateTask[] => (
  SUBPROJECT_TEMPLATE_SEED.map((taskName, index) => (
    createTask(String(index + 1), index + 1, taskName)
  ))
)

export type InsertNextTechnicalSubprojectTransferResult =
  | { ok: true; tasks: TechnicalTemplateTask[]; task: TechnicalTemplateTask }
  | { ok: false; reason: 'tdr3-missing' | 'tdr3-invalid-position' }

const createUniqueTechnicalStableId = (tasks: readonly TechnicalTemplateTask[], candidate: string): string => {
  const existingStableIds = new Set(tasks.map(task => task.stableId || task.id))
  let stableId = candidate
  let suffix = 2
  while (existingStableIds.has(stableId)) {
    stableId = `${candidate}-${suffix}`
    suffix += 1
  }
  return stableId
}

export const insertNextTechnicalSubprojectTransfer = (
  tasks: readonly TechnicalTemplateTask[],
): InsertNextTechnicalSubprojectTransferResult => {
  const ordered = tasks
    .map((task, index) => ({ task: { ...task }, index }))
    .sort((left, right) => left.task.order - right.task.order || left.index - right.index)
  const tdr3Index = ordered.findIndex(({ task }) => task.taskName === 'TDR3')
  if (tdr3Index < 0) return { ok: false, reason: 'tdr3-missing' }
  if (tdr3Index !== ordered.length - 1 || ordered.filter(({ task }) => task.taskName === 'TDR3').length !== 1) {
    return { ok: false, reason: 'tdr3-invalid-position' }
  }
  const maximumTransferVersion = ordered.reduce((maximum, { task }) => {
    const match = /^第(\d+)版转测$/.exec(task.taskName)
    return match ? Math.max(maximum, Number(match[1])) : maximum
  }, 0)
  const taskName = `第${maximumTransferVersion + 1}版转测`
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const stableId = createUniqueTechnicalStableId(tasks, `custom-subproject-transfer-${nonce}`)
  const next = ordered.map(({ task }) => task)
  next.splice(tdr3Index, 0, {
    id: stableId,
    stableId,
    source: 'custom',
    role: '技术项目负责人',
    order: tdr3Index + 1,
    taskName,
    responsible: '技术项目负责人',
    predecessor: '',
    planStartDate: '',
    planEndDate: '',
    estimatedDays: 0,
    actualStartDate: '',
    actualEndDate: '',
    actualDays: 0,
    status: '未开始',
    progress: 0,
    defaultRoadmap: false,
  })
  const renumbered = next.map((task, index) => ({ ...task, id: String(index + 1), order: index + 1 }))
  return { ok: true, tasks: renumbered, task: renumbered.find(task => task.stableId === stableId)! }
}

/** Keeps task content intact while aligning technical templates with the shared 1 / 1.1 numbering contract. */
export const renumberTechnicalTasks = <Task extends TechnicalTemplateTaskInput>(
  tasks: readonly Task[],
): Task[] => {
  const indexed = tasks.map((task, index) => ({ task, index }))
  const byId = new Map(indexed.filter(item => item.task.id).map(item => [String(item.task.id), item]))
  const childrenByParent = new Map<string, typeof indexed>()
  indexed.forEach(item => {
    if (!item.task.parentId || !byId.has(String(item.task.parentId))) return
    const parentId = String(item.task.parentId)
    childrenByParent.set(parentId, [...(childrenByParent.get(parentId) || []), item])
  })
  const sortSiblings = (items: typeof indexed) => [...items].sort((left, right) => (
    (Number(left.task.order) || left.index + 1) - (Number(right.task.order) || right.index + 1)
    || left.index - right.index
  ))
  const idMap = new Map<string, string>()
  const visited = new Set<number>()
  const numbered: Array<{ item: (typeof indexed)[number]; id: string; parentId?: string; order: number }> = []
  const visit = (item: (typeof indexed)[number], id: string, parentId: string | undefined, order: number) => {
    if (visited.has(item.index)) return
    visited.add(item.index)
    if (item.task.id) idMap.set(String(item.task.id), id)
    numbered.push({ item, id, ...(parentId ? { parentId } : {}), order })
    sortSiblings(childrenByParent.get(String(item.task.id || '')) || []).forEach((child, childIndex) => {
      visit(child, `${id}.${childIndex + 1}`, id, childIndex + 1)
    })
  }
  const roots = indexed.filter(item => !item.task.parentId || !byId.has(String(item.task.parentId)))
  sortSiblings(roots).forEach((item, rootIndex) => visit(item, String(rootIndex + 1), undefined, rootIndex + 1))
  indexed.filter(item => !visited.has(item.index)).forEach(item => {
    const rootIndex = numbered.filter(entry => !entry.parentId).length
    visit(item, String(rootIndex + 1), undefined, rootIndex + 1)
  })
  return numbered.map(({ item, id, parentId, order }) => {
    const { parentId: _priorParentId, ...taskWithoutParent } = item.task
    return {
      ...taskWithoutParent,
      id,
      ...(parentId ? { parentId } : {}),
      order,
      ...(item.task.predecessor
        ? { predecessor: idMap.get(String(item.task.predecessor)) || item.task.predecessor }
        : {}),
    }
  }) as Task[]
}

const assertNestedDepth = (
  kind: TechnicalTemplateKind,
  tasks: readonly TechnicalTemplateTaskInput[],
  depth = 1,
) => {
  if (kind === 'tdt' && depth > 2) throw new Error('TDT template depth exceeds two levels')
  if (kind === 'subproject' && depth > 1) throw new Error('Subproject template does not allow child tasks')
  tasks.forEach(task => {
    if (task.children?.length) assertNestedDepth(kind, task.children, depth + 1)
  })
}

const getFlatDepth = (
  task: TechnicalTemplateTaskInput,
  byId: ReadonlyMap<string, TechnicalTemplateTaskInput>,
) => {
  let depth = 1
  let parentId = task.parentId
  const visited = new Set<string>()
  while (parentId) {
    if (visited.has(parentId)) throw new Error('Technical template contains a parent cycle')
    visited.add(parentId)
    const parent = byId.get(parentId)
    if (!parent) throw new Error(`Technical template parent is missing: ${parentId}`)
    depth += 1
    parentId = parent.parentId
  }
  return depth
}

export const validateTechnicalTemplateDepth = (
  kind: TechnicalTemplateKind,
  tasks: readonly TechnicalTemplateTaskInput[],
) => {
  assertNestedDepth(kind, tasks)
  const byId = new Map(tasks.filter(task => task.id).map(task => [task.id!, task]))
  tasks.forEach(task => {
    const depth = getFlatDepth(task, byId)
    if (kind === 'tdt' && depth > 2) throw new Error('TDT template depth exceeds two levels')
    if (kind === 'subproject' && depth > 1) throw new Error('Subproject template does not allow child tasks')
  })
  return true
}

export const validateTechnicalPlanInstanceDepth = (
  kind: TechnicalTemplateKind,
  tasks: readonly TechnicalTemplateTaskInput[],
  maxDepth: number,
) => {
  validateTechnicalTemplateDepth(kind, tasks)
  if (!Number.isInteger(maxDepth) || maxDepth < 1) throw new Error('Technical plan maxDepth is invalid')
  const byId = new Map(tasks.filter(task => task.id).map(task => [task.id!, task]))
  tasks.forEach(task => {
    if (getFlatDepth(task, byId) > maxDepth) throw new Error('Technical plan maxDepth exceeded')
  })
  return true
}

export const insertTechnicalPlanTask = <Task extends TechnicalTemplateTaskInput>(
  tasks: readonly Task[],
  task: Task,
  kind: TechnicalTemplateKind,
  maxDepth: number,
): Task[] => {
  const next = tasks.map(item => ({ ...item })) as Task[]
  if (task.parentId) {
    const parentIndex = next.findIndex(item => item.id === task.parentId)
    if (parentIndex < 0) throw new Error('Technical plan parent is missing')
    const lastChildIndex = next.reduce((last, item, index) => item.parentId === task.parentId ? index : last, parentIndex)
    next.splice(lastChildIndex + 1, 0, { ...task })
  } else {
    next.push({ ...task })
  }
  const ordered = next.map((item, index) => ({ ...item, order: index + 1 })) as Task[]
  validateTechnicalPlanInstanceDepth(kind, ordered, maxDepth)
  return ordered
}

export const deleteTechnicalPlanTaskCascade = <Task extends TechnicalTemplateTaskInput>(
  tasks: readonly Task[],
  taskId: string,
): Task[] => {
  const removed = new Set([taskId])
  let changed = true
  while (changed) {
    changed = false
    tasks.forEach(task => {
      if (task.parentId && removed.has(task.parentId) && task.id && !removed.has(task.id)) {
        removed.add(task.id)
        changed = true
      }
    })
  }
  return tasks.filter(task => !task.id || !removed.has(task.id)).map((task, index) => ({ ...task, order: index + 1 })) as Task[]
}

export interface InvalidTechnicalTaskFields {
  start?: string[]
  end?: string[]
}

export type TechnicalSubprojectDateField = 'planStartDate' | 'planEndDate' | 'actualStartDate' | 'actualEndDate'

export interface TechnicalSubprojectDateValidationResult {
  valid: boolean
  byTaskId: Record<string, Partial<Record<TechnicalSubprojectDateField, string[]>>>
}

export const validateTechnicalSubprojectDates = (
  tasks: readonly TechnicalTemplateTaskInput[],
): TechnicalSubprojectDateValidationResult => {
  const byTaskId: TechnicalSubprojectDateValidationResult['byTaskId'] = {}
  const add = (taskId: string, field: TechnicalSubprojectDateField, message: string) => {
    byTaskId[taskId] = byTaskId[taskId] || {}
    byTaskId[taskId][field] = [...(byTaskId[taskId][field] || []), message]
  }

  tasks.forEach(task => {
    if (!task.id) return
    const validatePair = (
      startField: 'planStartDate' | 'actualStartDate',
      endField: 'planEndDate' | 'actualEndDate',
      startMessage: string,
      endMessage: string,
    ) => {
      const start = typeof task[startField] === 'string' ? task[startField] : ''
      const end = typeof task[endField] === 'string' ? task[endField] : ''
      if (start && end && start > end) {
        add(task.id!, startField, startMessage)
        add(task.id!, endField, endMessage)
      }
    }
    validatePair('planStartDate', 'planEndDate', '计划开始时间不得晚于计划完成时间', '计划完成时间不得早于计划开始时间')
    validatePair('actualStartDate', 'actualEndDate', '实际开始时间不得晚于实际完成时间', '实际完成时间不得早于实际开始时间')
  })

  return { valid: Object.keys(byTaskId).length === 0, byTaskId }
}

/**
 * TDT stages are immutable summary rows while their child milestones may share
 * a completion day. Their completion dates must nevertheless stay ordered in
 * the global displayed milestone stream, while empty partial inputs remain
 * editable.
 */
export const validateTechnicalTdtMilestoneDates = (
  tasks: readonly TechnicalTemplateTaskInput[],
): TechnicalSubprojectDateValidationResult => {
  const byTaskId: TechnicalSubprojectDateValidationResult['byTaskId'] = {}
  const add = (taskId: string, field: TechnicalSubprojectDateField, message: string) => {
    byTaskId[taskId] = byTaskId[taskId] || {}
    byTaskId[taskId][field] = [...(byTaskId[taskId][field] || []), message]
  }
  const isStrictDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
    const [year, month, day] = value.split('-').map(Number)
    const parsed = new Date(Date.UTC(year, month - 1, day))
    return parsed.getUTCFullYear() === year
      && parsed.getUTCMonth() === month - 1
      && parsed.getUTCDate() === day
  }
  const byId = new Map(tasks.filter(task => task.id).map(task => [task.id!, task]))
  const indexedTasks = tasks.map((task, index) => ({ task, index }))
  const byDisplayOrder = (left: { task: TechnicalTemplateTaskInput; index: number }, right: { task: TechnicalTemplateTaskInput; index: number }) => (
    Number(left.task.order ?? left.index + 1) - Number(right.task.order ?? right.index + 1)
    || left.index - right.index
  )
  const rootDisplayIndex = new Map(
    indexedTasks.filter(({ task }) => task.id && !task.parentId).sort(byDisplayOrder)
      .map(({ task }, index) => [task.id!, index]),
  )
  const milestones = indexedTasks.filter(({ task }) => task.id && task.parentId).sort((left, right) => (
    (rootDisplayIndex.get(left.task.parentId!) ?? Number.MAX_SAFE_INTEGER)
      - (rootDisplayIndex.get(right.task.parentId!) ?? Number.MAX_SAFE_INTEGER)
    || byDisplayOrder(left, right)
  ))
  let priorPlanEnd = ''
  let priorActualEnd = ''
  milestones.forEach(({ task }) => {
    const planEnd = typeof task.planEndDate === 'string' ? task.planEndDate : ''
    const actualEnd = typeof task.actualEndDate === 'string' ? task.actualEndDate : ''
    if (planEnd && !isStrictDate(planEnd)) add(task.id!, 'planEndDate', '计划完成时间格式无效')
    if (actualEnd && !isStrictDate(actualEnd)) add(task.id!, 'actualEndDate', '实际完成时间格式无效')
    if (planEnd && isStrictDate(planEnd)) {
      if (priorPlanEnd && planEnd < priorPlanEnd) add(task.id!, 'planEndDate', '计划完成时间不得早于前序里程碑')
      priorPlanEnd = planEnd
    }
    if (actualEnd && isStrictDate(actualEnd)) {
      if (priorActualEnd && actualEnd < priorActualEnd) add(task.id!, 'actualEndDate', '实际完成时间不得早于前序里程碑')
      priorActualEnd = actualEnd
    }
  })
  tasks.filter(task => task.id && task.parentId).forEach(task => {
    const parent = byId.get(task.parentId!)
    const planEnd = typeof task.planEndDate === 'string' ? task.planEndDate : ''
    const parentStart = typeof parent?.planStartDate === 'string' ? parent.planStartDate : ''
    const parentEnd = typeof parent?.planEndDate === 'string' ? parent.planEndDate : ''
    if (planEnd && isStrictDate(planEnd) && parentStart && isStrictDate(parentStart) && planEnd < parentStart) add(task.id!, 'planEndDate', '计划完成时间不得早于所属阶段开始时间')
    if (planEnd && isStrictDate(planEnd) && parentEnd && isStrictDate(parentEnd) && planEnd > parentEnd) add(task.id!, 'planEndDate', '计划完成时间不得晚于所属阶段完成时间')
  })
  return { valid: Object.keys(byTaskId).length === 0, byTaskId }
}

/** Same-row and parent-range date checks used by technical plan drafts. Empty dates stay valid. */
export const getInvalidTechnicalTaskFields = (
  tasks: readonly TechnicalTemplateTaskInput[],
): Map<string, InvalidTechnicalTaskFields> => {
  const result = new Map<string, InvalidTechnicalTaskFields>()
  const byId = new Map(tasks.filter(task => task.id).map(task => [task.id!, task]))
  const add = (id: string, field: keyof InvalidTechnicalTaskFields, reason: string) => {
    const current = result.get(id) || {}
    current[field] = [...(current[field] || []), reason]
    result.set(id, current)
  }
  tasks.forEach(task => {
    if (!task.id) return
    const start = String(task.planStartDate || '')
    const end = String(task.planEndDate || '')
    if (start && end && start > end) {
      add(task.id, 'start', '计划开始不能晚于计划完成')
      add(task.id, 'end', '计划完成不能早于计划开始')
    }
    if (!task.parentId) return
    const parent = byId.get(task.parentId)
    if (!parent) return
    const parentStart = String(parent.planStartDate || '')
    const parentEnd = String(parent.planEndDate || '')
    if (start && parentStart && start < parentStart) add(task.id, 'start', '计划开始不能早于父任务')
    if (end && parentEnd && end > parentEnd) add(task.id, 'end', '计划完成不能晚于父任务')
  })
  return result
}

const isLegacyTechnicalTemplateKey = (key: string) => (
  key === '技术项目'
  || key.startsWith('技术项目::一级计划')
  || key.startsWith('技术项目::二级计划')
  || key.startsWith('技术项目::TDT项目计划')
  || key.startsWith('技术项目::子项目计划')
)

export const migrateTechnicalTemplateState = <T extends Record<string, any>>(state: T): T => {
  const priorTemplates = state.configTemplateTasksByType && typeof state.configTemplateTasksByType === 'object'
    ? state.configTemplateTasksByType as Record<string, unknown>
    : {}
  const configTemplateTasksByType = Object.fromEntries(
    Object.entries(priorTemplates).filter(([key]) => !isLegacyTechnicalTemplateKey(key)),
  )
  const priorSnapshots = state.publishedSnapshots && typeof state.publishedSnapshots === 'object'
    ? state.publishedSnapshots as Record<string, unknown>
    : {}
  const publishedSnapshots = Object.fromEntries(
    Object.entries(priorSnapshots).filter(([key]) => !key.startsWith('template::技术项目::')),
  )
  return {
    ...state,
    configTemplateTasksByType: {
      ...configTemplateTasksByType,
      技术项目: buildTdtTemplateTasks(),
      [TECHNICAL_TEMPLATE_STORAGE_KEYS.tdt]: buildTdtTemplateTasks(),
      [TECHNICAL_TEMPLATE_STORAGE_KEYS.subproject]: buildSubprojectTemplateTasks(),
    },
    publishedSnapshots: {
      ...publishedSnapshots,
      'template::技术项目::level1::v3': buildTdtTemplateTasks(),
      'template::技术项目::tdt::v3': buildTdtTemplateTasks(),
      'template::技术项目::subproject::v3': buildSubprojectTemplateTasks(),
    },
  }
}

/** Non-destructive migration for persisted technical templates created before numeric IDs were shared. */
export const migrateTechnicalTemplateNumberingState = <T extends Record<string, any>>(state: T): T => {
  const templates = state.configTemplateTasksByType && typeof state.configTemplateTasksByType === 'object'
    ? state.configTemplateTasksByType as Record<string, unknown>
    : {}
  const snapshots = state.publishedSnapshots && typeof state.publishedSnapshots === 'object'
    ? state.publishedSnapshots as Record<string, unknown>
    : {}
  return {
    ...state,
    configTemplateTasksByType: Object.fromEntries(Object.entries(templates).map(([key, value]) => [
      key,
      isLegacyTechnicalTemplateKey(key) && Array.isArray(value) ? renumberTechnicalTasks(value) : value,
    ])),
    publishedSnapshots: Object.fromEntries(Object.entries(snapshots).map(([key, value]) => [
      key,
      key.startsWith('template::技术项目::') && Array.isArray(value) ? renumberTechnicalTasks(value) : value,
    ])),
  }
}

export const migrateTechnicalSubprojectSeedState = <T extends Record<string, any>>(state: T): T => {
  const templates = state.configTemplateTasksByType && typeof state.configTemplateTasksByType === 'object'
    ? state.configTemplateTasksByType as Record<string, unknown>
    : undefined
  const current = templates?.[TECHNICAL_TEMPLATE_STORAGE_KEYS.subproject]
  const legacySeed = ['第1版转测', '第2版转测', '第X版转测', 'TDR3']
  const isExactLegacySeed = Array.isArray(current)
    && current.length === legacySeed.length
    && current.every((task, index) => task?.taskName === legacySeed[index])
  if (!isExactLegacySeed) return state
  const migratedTasks = current
    .filter(task => task.taskName !== '第X版转测')
    .map((task, index) => (
      task.id === String(index + 1) && task.order === index + 1
        ? task
        : { ...task, id: String(index + 1), order: index + 1 }
    ))
  return {
    ...state,
    configTemplateTasksByType: {
      ...templates,
      [TECHNICAL_TEMPLATE_STORAGE_KEYS.subproject]: migratedTasks,
    },
  }
}
