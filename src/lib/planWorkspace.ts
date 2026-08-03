import { applyFilterConditions, type AnyFilterCondition, type FilterFieldDefinition } from '@/lib/filterConditions'

export type PlanWorkspaceViewMode = 'vertical' | 'horizontal' | 'gantt'

export interface PlanWorkspaceTask {
  id: string
  parentId?: string
  order: number
  [key: string]: unknown
}

export interface PlanHorizontalStageGroup<T extends PlanWorkspaceTask> {
  stage: T
  milestones: T[]
  colSpan: number
}

export function normalizePlanViewMode(
  viewMode: PlanWorkspaceViewMode,
  horizontalDisabled = false,
): PlanWorkspaceViewMode {
  return horizontalDisabled && viewMode === 'horizontal' ? 'vertical' : viewMode
}

export function filterPlanTasksByCollapsed<T extends Pick<PlanWorkspaceTask, 'id' | 'parentId'>>(
  tasks: readonly T[],
  collapsedIds: ReadonlySet<string>,
): T[] {
  if (collapsedIds.size === 0) return [...tasks]
  const tasksById = new Map(tasks.map(task => [task.id, task]))

  return tasks.filter(task => {
    let current = task
    const visited = new Set<string>()
    while (current.parentId && !visited.has(current.parentId)) {
      if (collapsedIds.has(current.parentId)) return false
      visited.add(current.parentId)
      const parent = tasksById.get(current.parentId)
      if (!parent) break
      current = parent
    }
    return true
  })
}

export function applyPlanWorkspaceFilters<T extends object>(
  tasks: readonly T[],
  conditions: readonly AnyFilterCondition[],
  fieldDefinitions?: readonly FilterFieldDefinition[],
): T[] {
  return applyFilterConditions(tasks, conditions, fieldDefinitions)
}

export function buildPlanHorizontalStageGroups<T extends PlanWorkspaceTask>(
  tasks: readonly T[],
): PlanHorizontalStageGroup<T>[] {
  return tasks
    .filter(task => !task.parentId)
    .sort((left, right) => left.order - right.order)
    .map(stage => {
      const milestones = tasks
        .filter(task => task.parentId === stage.id)
        .sort((left, right) => left.order - right.order)
      return { stage, milestones, colSpan: milestones.length || 1 }
    })
}

export function buildPlanHorizontalMilestones<T extends PlanWorkspaceTask>(
  stageGroups: readonly PlanHorizontalStageGroup<T>[],
): T[] {
  return stageGroups.flatMap(({ stage, milestones }) => milestones.length > 0 ? milestones : [stage])
}
