/**
 * Project-scoped fallback plans for the mock-only demo.
 *
 * Real published plan snapshots always win. These dates only make the project
 * list calendar demonstrable before a project has published its first plan.
 */
export interface ProjectListMockTemplateTask {
  id: string
  taskName?: string
  name?: string
  parentId?: string | null
  order?: number
  planStartDate?: string
  planEndDate?: string
  actualEndDate?: string
  [key: string]: unknown
}

export interface ProjectListMockContext {
  projectType: string
  projectName: string
}

const LEVEL1_MOCK_MILESTONE_DATES = [
  '2026-02-26',
  '2026-03-17',
  '2026-04-28',
  '2026-05-22',
  '2026-07-31',
  '2026-10-12',
  '2026-12-15',
  '2027-03-01',
] as const

const projectOffset = (projectId: string) => (
  ([...projectId].reduce((total, character) => total + character.charCodeAt(0), 0) + 2) % 3
)

const shiftIsoDate = (value: string, days: number) => {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

const getMilestoneDate = (index: number, offset: number) => {
  const lastIndex = LEVEL1_MOCK_MILESTONE_DATES.length - 1
  const baseDate = LEVEL1_MOCK_MILESTONE_DATES[Math.min(index, lastIndex)]
  const overflowDays = Math.max(0, index - lastIndex) * 45
  return shiftIsoDate(baseDate, offset + overflowDays)
}

export const getProjectLevel1MockSnapshotKey = (projectId: string, versionId: string) => (
  `project::${projectId}::level1::${versionId}`
)

const buildDatedMilestones = <T extends ProjectListMockTemplateTask>(
  projectId: string,
  templateTasks: readonly T[],
): T[] => {
  const offset = projectOffset(projectId)
  let milestoneIndex = 0
  return templateTasks.map(task => {
    if (!task.parentId) {
      return {
        ...task,
        planStartDate: '',
        planEndDate: '',
        actualStartDate: '',
        actualEndDate: '',
      }
    }
    if (task.nodeKind === 'business-period') return { ...task }
    const currentMilestoneIndex = milestoneIndex
    milestoneIndex += 1
    const planEndDate = getMilestoneDate(currentMilestoneIndex, offset)
    return {
      ...task,
      planStartDate: '',
      planEndDate,
      actualStartDate: '',
      actualEndDate: shiftIsoDate(planEndDate, currentMilestoneIndex < 2 ? 1 : 0),
    }
  })
}

interface BusinessMockSeed {
  stageName: string
  taskName: string
  planStartDate: string
  planEndDate: string
}

const appendBusinessMockRows = <T extends ProjectListMockTemplateTask>(
  tasks: readonly T[],
  projectId: string,
  seeds: readonly BusinessMockSeed[],
): T[] => {
  const taskByName = new Map(tasks.map(task => [task.taskName || task.name || '', task]))
  const offset = projectOffset(projectId)
  const additions = seeds.flatMap((seed, index) => {
    const stage = taskByName.get(seed.stageName)
    if (!stage || tasks.some(task => task.parentId === stage.id && task.nodeKind === 'business-period')) return []
    const existingCount = tasks.filter(task => task.parentId === stage.id).length
    return [{
      id: `${stage.id}.${existingCount + 1}`,
      stableId: `mock-${projectId}-business-${index + 1}`,
      parentId: stage.id,
      order: existingCount,
      taskName: seed.taskName,
      source: 'custom',
      nodeKind: 'business-period',
      planStartDate: shiftIsoDate(seed.planStartDate, offset),
      planEndDate: shiftIsoDate(seed.planEndDate, offset),
      actualStartDate: shiftIsoDate(seed.planStartDate, offset + 1),
      actualEndDate: shiftIsoDate(seed.planEndDate, offset + 1),
      estimatedDays: null,
      actualDays: null,
    } as unknown as T]
  })
  return [...tasks.map(task => ({ ...task })), ...additions]
}

const getTosVersionPrefix = (projectName: string) => {
  const match = /tOS\s*(\d+)\.(\d+)/i.exec(projectName)
  return match ? `${match[1]}.${match[2]}.0` : undefined
}

export function buildProjectListMockPlanTasks<T extends ProjectListMockTemplateTask>(
  projectId: string,
  templateTasks: readonly T[],
  context?: ProjectListMockContext,
): T[] {
  const dated = buildDatedMilestones(projectId, templateTasks)
  if (context?.projectType === '整机产品项目') {
    return appendBusinessMockRows(dated, projectId, [
      { stageName: '上市阶段', taskName: 'MR1', planStartDate: '2026-12-16', planEndDate: '2027-01-15' },
      { stageName: '生命周期阶段', taskName: 'MR2', planStartDate: '2027-01-16', planEndDate: '2027-03-01' },
    ])
  }
  const prefix = context?.projectType === 'tOS版本项目'
    ? getTosVersionPrefix(context.projectName)
    : undefined
  return prefix
    ? appendBusinessMockRows(dated, projectId, [
        { stageName: '上市迭代阶段', taskName: `${prefix}.110`, planStartDate: '2026-12-16', planEndDate: '2027-01-15' },
        { stageName: '维护阶段', taskName: `${prefix}.115`, planStartDate: '2027-01-16', planEndDate: '2027-03-01' },
      ])
    : dated
}
