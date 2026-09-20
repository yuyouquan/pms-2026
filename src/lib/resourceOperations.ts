import type { ResourceProject, ResourceVersion } from '@/components/project-resources/resourceVersionAdapter'
import type { ResourceOperationLog } from '@/types/resourceOperations'
import { getResourcePhaseRatios, getResourceRatioFields } from '@/lib/resourceRatios'
import { resourceMilestoneFields } from '@/lib/resourceInlineEditing'
import { MACHINE_INVESTMENT_PERIODS, LEGACY_MACHINE_PHASES } from '@/lib/hrMachinePeriods'
import { useProjectStore } from '@/stores/project'

type Changes = ResourceOperationLog['changes']
type RecordValue = Record<string, unknown>
const labels: Record<string, string> = {
  versionNumber: '版本号', budgetType: '预算分类', batch: '批次', lockState: '锁定状态', isActive: '正式版本',
  projectLevel: '项目等级', hrModelVersion: '人力模型版本', levelCoefficient: '等级系数', estimatedInvestment: '预估投入合计',
  projectStartTime: '项目开始时间', projectEndTime: '项目结束时间', primaryDepartment: '一级部门', secondaryDepartment: '二级部门',
  tertiaryDepartment: '三级部门', secondarySubject: '二级科目', tertiarySubject: '三级科目', projectPeriod: '项目周期',
  startMonth: '开始月份', endMonth: '结束月份',
}
function display(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—'
  if (typeof value === 'boolean') return value ? '是' : '否'
  const text: Record<string, string> = { locked: '已锁定', unlocked: '未锁定', annual: '年度预算', projectEstimate: '项目概算', projectBudget: '项目预算' }
  return text[String(value)] ?? String(value)
}
function add(changes: Changes, field: string, before: unknown, after: unknown) {
  if (JSON.stringify(before) !== JSON.stringify(after)) changes.push({ field, before: display(before), after: display(after) })
}
function categoryOf(version: ResourceVersion) {
  return 'hrModelVersion' in version ? 'machine' : 'projectStartTime' in version ? 'capability' : 'planningKO' in version.milestones ? 'tos' : 'technical'
}
function fieldLabels(version: ResourceVersion) {
  const result = { ...labels }, category = categoryOf(version)
  for (const field of [...resourceMilestoneFields[category], ...getResourceRatioFields(category)]) result[field.key] = field.label
  if (category === 'machine') for (const field of [...MACHINE_INVESTMENT_PERIODS, ...LEGACY_MACHINE_PHASES]) result[field.key] = field.label
  return result
}
function departmentName(row?: RecordValue): string {
  return [row?.primaryDepartment, row?.secondaryDepartment].filter(Boolean).join(' / ') || '待填部门'
}
function rowsOf(version: ResourceVersion | undefined): RecordValue[] {
  if (!version) return []
  return ('departmentInvestments' in version ? version.departmentInvestments : version.machineDepartmentInvestments ?? []) as unknown as RecordValue[]
}
function departmentChanges(changes: Changes, before: ResourceVersion, after: ResourceVersion, names: Record<string, string>) {
  const oldRows = rowsOf(before), newRows = rowsOf(after)
  for (const id of new Set([...oldRows, ...newRows].map(row => String(row.id)))) {
    const old = oldRows.find(row => row.id === id), next = newRows.find(row => row.id === id)
    const path = `部门「${departmentName(next ?? old)}」`
    if (!old || !next) {
      add(changes, `${path} · 部门明细`, old ? `${departmentName(old)}，${display(old.estimatedInvestment)} 人月` : undefined, next ? `${departmentName(next)}，${display(next.estimatedInvestment)} 人月` : undefined)
      continue
    }
    for (const key of new Set([...Object.keys(old), ...Object.keys(next)])) if (names[key]) add(changes, `${path} · ${names[key]}`, old[key], next[key])
  }
  const previous = before.departmentPhaseRatios ?? {}, current = after.departmentPhaseRatios ?? {}
  for (const id of new Set([...Object.keys(previous), ...Object.keys(current)])) {
    const oldRow = oldRows.find(row => row.id === id), newRow = newRows.find(row => row.id === id)
    const row = newRow ?? oldRow
    const oldRatios = oldRow ? getResourcePhaseRatios(categoryOf(before), before, oldRow as unknown as { id: string; estimatedInvestment: number }) : {}
    const newRatios = newRow ? getResourcePhaseRatios(categoryOf(after), after, newRow as unknown as { id: string; estimatedInvestment: number }) : {}
    for (const key of new Set([...Object.keys(oldRatios), ...Object.keys(newRatios)])) {
      if (!names[key]) continue
      const old = oldRatios[key], next = newRatios[key]
      add(changes, `部门「${departmentName(row)}」 · ${names[key]}比例`, old === undefined ? undefined : `${old}%`, next === undefined ? undefined : `${next}%`)
    }
  }
}
function expenseChanges(changes: Changes, before: ResourceVersion, after: ResourceVersion) {
  const previous = before.nonLaborInvestment, current = after.nonLaborInvestment
  const oldRows = previous?.items ?? [], newRows = current?.items ?? []
  for (const id of new Set([...oldRows, ...newRows].map(row => row.id))) {
    const old = oldRows.find(row => row.id === id), next = newRows.find(row => row.id === id), row = next ?? old!
    const department = [row.secondaryDepartment, row.tertiaryDepartment].filter(Boolean).join(' / ') || '待填部门'
    const subject = [row.secondarySubject, row.tertiarySubject].filter(Boolean).join(' / ') || '待填科目'
    const path = `非人力「${department} · ${subject}」`
    if (!old || !next) add(changes, `${path} · 明细`, old ? '已有明细' : undefined, next ? '新增明细' : undefined)
    for (const key of ['secondaryDepartment', 'tertiaryDepartment', 'secondarySubject', 'tertiarySubject'] as const) add(changes, `${path} · ${labels[key]}`, old?.[key], next?.[key])
    for (const month of new Set([...Object.keys(old?.monthlyAmounts ?? {}), ...Object.keys(next?.monthlyAmounts ?? {})])) add(changes, `${path} · ${month} 金额`, old?.monthlyAmounts[month] ?? 0, next?.monthlyAmounts[month] ?? 0)
  }
}
/** Field-level audit deltas use business labels; internal row IDs only match identity. */
export function resourceVersionChanges(before?: ResourceVersion, after?: ResourceVersion): Changes {
  const changes: Changes = [], names = fieldLabels((after ?? before)!)
  if (!before || !after) {
    add(changes, '版本号', before?.versionNumber, after?.versionNumber)
    add(changes, '预估投入合计（人月）', before?.estimatedInvestment, after?.estimatedInvestment)
    if (after?.copiedFromVersionNumber) add(changes, '初始化来源', undefined, after.copiedFromVersionNumber)
    return changes
  }
  for (const key of Object.keys(labels)) {
    if (key in before || key in after) add(changes, labels[key], (before as unknown as RecordValue)[key], (after as unknown as RecordValue)[key])
  }
  const oldDates = 'milestones' in before ? before.milestones as unknown as RecordValue : {}
  const newDates = 'milestones' in after ? after.milestones as unknown as RecordValue : {}
  for (const key of new Set([...Object.keys(oldDates), ...Object.keys(newDates)])) if (names[key]) add(changes, `里程碑 · ${names[key]}`, oldDates[key], newDates[key])
  departmentChanges(changes, before, after, names)
  expenseChanges(changes, before, after)
  if ('scheduleModelSnapshot' in before || 'scheduleModelSnapshot' in after) {
    const old = 'scheduleModelSnapshot' in before ? before.scheduleModelSnapshot : undefined
    const next = 'scheduleModelSnapshot' in after ? after.scheduleModelSnapshot : undefined
    if (JSON.stringify(old) !== JSON.stringify(next)) add(changes, '里程碑排布模型', old ? '已保存排布模型' : undefined, next ? '保存当前排布模型' : undefined)
  }
  return changes
}
export function appendResourceOperation<P extends ResourceProject>(project: P, version: ResourceVersion, action: string, changes: Changes): P {
  if (!changes.length) return project
  return { ...project, resourceOperationLogs: [...(project.resourceOperationLogs ?? []), {
    id: `resource-log-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, versionId: version.id, versionNumber: version.versionNumber,
    budgetType: version.budgetType, operator: useProjectStore.getState().currentLoginUser, timestamp: new Date().toISOString(), action, changes,
  }] }
}
