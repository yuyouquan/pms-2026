export interface TemplateIntervalTask {
  id: string
  parentId?: string
  intervalDays?: number | null
}

const validDays = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
const sumDays = (values: number[]) => Number(values.reduce((sum, value) => sum + value, 0).toFixed(8))

/** Only second-level milestones contribute; stage values are always derived. */
export function calculateTemplateIntervals(tasks: readonly TemplateIntervalTask[]) {
  const stages = new Set(tasks.filter(task => !task.parentId).map(task => task.id))
  const milestones = tasks.filter(task => task.parentId && stages.has(task.parentId))
  const totalDays = sumDays(milestones.map(task => validDays(task.intervalDays) ? task.intervalDays : 0))
  const byId: Record<string, { intervalDays: number | null; intervalRatio: number | null; editable: boolean }> = {}
  for (const task of tasks) {
    const editable = Boolean(task.parentId && stages.has(task.parentId))
    const intervalDays = stages.has(task.id)
      ? sumDays(milestones.filter(child => child.parentId === task.id).map(child => validDays(child.intervalDays) ? child.intervalDays : 0))
      : editable && validDays(task.intervalDays) ? task.intervalDays : null
    byId[task.id] = { intervalDays, intervalRatio: intervalDays === null ? null : totalDays > 0 ? intervalDays * 100 / totalDays : 0, editable }
  }
  return { totalDays, byId }
}

export function updateTemplateInterval<T extends TemplateIntervalTask>(tasks: readonly T[], id: string, value: number | null): T[] {
  if (!calculateTemplateIntervals(tasks).byId[id]?.editable) throw new Error('仅二级里程碑可填写间隔天数')
  if (value !== null && !validDays(value)) throw new Error('间隔天数必须为非负数字')
  return tasks.map(task => task.id === id ? { ...task, intervalDays: value } : task)
}

export function withTemplateIntervalSummary<T extends TemplateIntervalTask>(tasks: readonly T[]) {
  const { byId } = calculateTemplateIntervals(tasks)
  return tasks.map(task => ({ ...task, intervalDays: byId[task.id].intervalDays, intervalRatio: byId[task.id].intervalRatio }))
}

export const formatTemplateIntervalRatio = (value: number | null | undefined) => value == null ? '-' : `${value.toFixed(2)}%`
