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
  '第X版转测',
  'TDR3',
] as const

export const TECHNICAL_TEMPLATE_STORAGE_KEYS = {
  tdt: '技术项目::TDT项目计划',
  subproject: '技术项目::子项目计划',
} as const satisfies Record<TechnicalTemplateKind, string>

const createTask = (
  id: string,
  order: number,
  taskName: string,
  parentId?: string,
): TechnicalTemplateTask => ({
  id,
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
    const parentId = `tdt-${phaseIndex + 1}`
    return [
      createTask(parentId, phaseIndex + 1, phaseName),
      ...children.map((taskName, childIndex) => (
        createTask(`${parentId}-${childIndex + 1}`, childIndex + 1, taskName, parentId)
      )),
    ]
  })
)

export const buildSubprojectTemplateTasks = (): TechnicalTemplateTask[] => (
  SUBPROJECT_TEMPLATE_SEED.map((taskName, index) => (
    createTask(`subproject-${index + 1}`, index + 1, taskName)
  ))
)

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
