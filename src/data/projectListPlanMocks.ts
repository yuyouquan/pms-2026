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

const AUGUST_2026_MILESTONE_DAYS = [3, 5, 7, 10, 12, 14, 17, 19, 21, 24, 26, 28, 31] as const

const projectOffset = (projectId: string) => (
  [...projectId].reduce((total, character) => total + character.charCodeAt(0), 0) % 3
)

const formatAugustDate = (day: number) => `2026-08-${String(day).padStart(2, '0')}`

export const getProjectLevel1MockSnapshotKey = (projectId: string, versionId: string) => (
  `project::${projectId}::level1::${versionId}`
)

export function buildProjectListMockPlanTasks<T extends ProjectListMockTemplateTask>(
  projectId: string,
  templateTasks: readonly T[],
): T[] {
  const offset = projectOffset(projectId)
  return templateTasks.map((task, index) => {
    const endIndex = Math.min(index + offset, AUGUST_2026_MILESTONE_DAYS.length - 1)
    const startIndex = Math.max(0, endIndex - 1)
    return {
      ...task,
      planStartDate: formatAugustDate(AUGUST_2026_MILESTONE_DAYS[startIndex]),
      planEndDate: formatAugustDate(AUGUST_2026_MILESTONE_DAYS[endIndex]),
      actualEndDate: index % 4 === 3
        ? ''
        : formatAugustDate(AUGUST_2026_MILESTONE_DAYS[Math.min(endIndex + (index % 3 === 0 ? 1 : 0), AUGUST_2026_MILESTONE_DAYS.length - 1)]),
    }
  })
}
