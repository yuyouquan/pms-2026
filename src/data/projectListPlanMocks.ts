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
  [...projectId].reduce((total, character) => total + character.charCodeAt(0), 0) % 3
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

export function buildProjectListMockPlanTasks<T extends ProjectListMockTemplateTask>(
  projectId: string,
  templateTasks: readonly T[],
): T[] {
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
