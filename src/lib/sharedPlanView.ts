import { projectLevel1Plan, renumberLevel1Tasks, type Level1PlanTask } from '@/lib/level1PlanRules'
import { buildPlanGanttTasks, withPlanGanttListRows } from '@/lib/planGanttRules'
import type { SortableColumnDefinition } from '@/lib/columnSettings'

export const SHARED_LEVEL1_COLUMNS: SortableColumnDefinition<string>[] = [
  { key: 'id', title: '序号', defaultVisible: true, hideable: false, fixed: 'left' },
  { key: 'taskName', title: '阶段/节点', defaultVisible: true, hideable: false },
  { key: 'planStartDate', title: '计划开始时间', defaultVisible: true },
  { key: 'planEndDate', title: '计划完成时间', defaultVisible: true },
  { key: 'estimatedDays', title: '预估工期', defaultVisible: true },
  { key: 'actualStartDate', title: '实际开始时间', defaultVisible: true },
  { key: 'actualEndDate', title: '实际完成时间', defaultVisible: true },
  { key: 'actualDays', title: '实际工期', defaultVisible: true },
  { key: 'delayStatus', title: '是否延期', defaultVisible: true },
]

export const getSharedLevel1Columns = (ordinaryProject: boolean) => SHARED_LEVEL1_COLUMNS.map(column => ({
  ...column,
  title: ordinaryProject && column.key === 'taskName' ? '阶段/里程碑节点'
    : ordinaryProject && column.key === 'actualEndDate' ? '实际结束时间' : column.title,
}))

export const formatSharedPlanCell = (key: string, value: unknown): string => {
  if (value === null || value === undefined || value === '') return '-'
  return `${String(value)}${key === 'estimatedDays' || key === 'actualDays' ? '天' : ''}`
}

/** Project only the supplied published snapshot; there are no store reads or edit callbacks here. */
export const buildSharedLevel1View = (tasks: readonly Level1PlanTask[], isSubproject = false, searchText = '') => {
  const normalizedTasks = renumberLevel1Tasks([...tasks])
  const projection = projectLevel1Plan(normalizedTasks, { mode: isSubproject ? 'technical-subproject' : 'standard' })
  const query = searchText.trim().toLowerCase()
  const includedIds = new Set(projection.rows.filter(row => !query || `${row.id} ${row.taskName}`.toLowerCase().includes(query)).map(row => row.id))
  projection.rows.forEach(row => {
    if (!includedIds.has(row.id)) return
    let parentId = row.parentId
    while (parentId) {
      includedIds.add(parentId)
      parentId = projection.rows.find(parent => parent.id === parentId)?.parentId
    }
  })
  const rows = projection.rows.filter(row => includedIds.has(row.id))
  return {
    rows,
    ganttTasks: withPlanGanttListRows(buildPlanGanttTasks(normalizedTasks.filter(task => includedIds.has(task.id)), {
      mode: isSubproject ? 'technical-subproject' : 'hierarchical',
      editable: false,
    }), rows),
  }
}
