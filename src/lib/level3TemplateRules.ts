import type { Level3Activity } from '@/types/level3Plan'
import type {
  Level1TemplateTaskLike,
  Level3TemplateActivity,
  Level3TemplateMaterializeContext,
  NumberedLevel3TemplateActivity,
} from '@/types/level3Template'

const MACHINE_TYPES = new Set([
  '整机产品项目', '整机-手机', '整机-平板', '整机-笔电', '整机-功能机',
  '整机-AIOT扩品类', '整机-基线项目', '整机-N+1项目', '整机-预研项目',
  '整机产品-手机', '整机-PAD', '整机产品-PAD', '整机产品-笔电',
  '整机-AIOT', '整机-基线', '整机-N+1', '整机-预研',
])

export const supportsLevel3Template = (projectType: string): boolean => (
  MACHINE_TYPES.has(String(projectType || '').trim())
  || String(projectType || '').trim() === 'tOS版本项目'
)

type TemplateVersionScopeLike<TVersion extends { id: string }> = {
  versions: TVersion[]
  currentVersion: string
}

export function resolveTemplateVersionScopeForMigration<TVersion extends { id: string }>(
  scope: string,
  stored: TemplateVersionScopeLike<TVersion> | undefined,
  initial: TemplateVersionScopeLike<TVersion>,
  legacy: TemplateVersionScopeLike<TVersion>,
): TemplateVersionScopeLike<TVersion> {
  const source = stored?.versions.some(version => version.id === stored.currentVersion)
    ? stored
    : scope.endsWith('::level3') ? initial : legacy
  return {
    versions: source.versions.map(version => ({ ...version })),
    currentVersion: source.currentVersion,
  }
}

const cloneTemplateActivity = (activity: Level3TemplateActivity): Level3TemplateActivity => ({ ...activity })

export function normalizeLevel3TemplateActivities(
  activities: readonly Level3TemplateActivity[],
): Level3TemplateActivity[] {
  const byId = new Map<string, Level3TemplateActivity>()
  activities.forEach(activity => {
    const id = String(activity.id || '').trim()
    if (!id) throw new Error('活动ID不能为空')
    if (byId.has(id)) throw new Error(`活动ID重复：${id}`)
    byId.set(id, { ...cloneTemplateActivity(activity), id })
  })

  byId.forEach(activity => {
    if (!activity.parentId) return
    const parent = byId.get(activity.parentId)
    if (!parent) throw new Error(`父活动不存在：${activity.parentId}`)
    if (parent.parentId) throw new Error('三级计划模板最多支持两级活动')
  })

  const roots = [...byId.values()]
    .filter(activity => !activity.parentId)
    .sort((left, right) => left.order - right.order)
  const result: Level3TemplateActivity[] = []
  roots.forEach((root, rootOrder) => {
    result.push({ ...root, parentId: null, order: rootOrder, activityName: root.activityName.trim() })
    const children = [...byId.values()]
      .filter(activity => activity.parentId === root.id)
      .sort((left, right) => left.order - right.order)
    children.forEach((child, childOrder) => result.push({
      ...child,
      parentId: root.id,
      order: childOrder,
      activityName: child.activityName.trim(),
    }))
  })
  return result
}

export function numberLevel3TemplateActivities(
  activities: readonly Level3TemplateActivity[],
): NumberedLevel3TemplateActivity[] {
  const normalized = normalizeLevel3TemplateActivities(activities)
  let parentNumber = 0
  const parentNumbers = new Map<string, number>()
  return normalized.map(activity => {
    if (!activity.parentId) {
      parentNumber += 1
      parentNumbers.set(activity.id, parentNumber)
      return { ...activity, number: String(parentNumber), depth: 0 }
    }
    const siblings = normalized.filter(item => item.parentId === activity.parentId)
    return {
      ...activity,
      number: `${parentNumbers.get(activity.parentId) || 0}.${siblings.findIndex(item => item.id === activity.id) + 1}`,
      depth: 1,
    }
  })
}

export function getLevel3TemplateMilestoneOptions(tasks: readonly Level1TemplateTaskLike[]) {
  const seen = new Set<string>()
  return tasks
    .filter(task => Boolean(task.parentId && task.id && String(task.taskName || '').trim()))
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0))
    .flatMap(task => {
      const value = String(task.stableId || task.id)
      if (seen.has(value)) return []
      seen.add(value)
      return [{ value, label: String(task.taskName).trim() }]
    })
}

export function validateLevel3TemplateForPublish(
  activities: readonly Level3TemplateActivity[],
  milestoneOptions: readonly { value: string; label: string }[],
): string[] {
  let normalized: Level3TemplateActivity[]
  try {
    normalized = normalizeLevel3TemplateActivities(activities)
  } catch (error) {
    return [error instanceof Error ? error.message : '三级计划模板结构无效']
  }
  const validMilestoneIds = new Set(milestoneOptions.map(option => option.value))
  const errors: string[] = []
  normalized.forEach(activity => {
    if (!activity.activityName.trim()) errors.push('活动名称不能为空')
    if (activity.milestoneId && !validMilestoneIds.has(activity.milestoneId)) {
      errors.push(`活动“${activity.activityName || activity.id}”的关键节点已失效`)
    }
  })
  return [...new Set(errors)]
}

export function materializeLevel3Template(
  template: readonly Level3TemplateActivity[],
  context: Level3TemplateMaterializeContext,
): Level3Activity[] {
  const milestones = new Map(context.projectMilestones.map(item => [item.id, item]))
  return normalizeLevel3TemplateActivities(template).map(item => ({
    id: item.id,
    parentId: item.parentId,
    order: item.order,
    activityName: item.activityName.trim(),
    responsible: '',
    responsibleDepartment: '',
    planStartDate: '',
    planEndDate: '',
    actualStartDate: '',
    actualEndDate: '',
    milestoneId: item.milestoneId,
    milestoneName: item.milestoneName,
    milestonePlanEndDate: milestones.get(item.milestoneId)?.planEndDate || '',
    status: '待启动',
    risk: '无',
    remark: '',
    creator: context.actor,
    createdAt: context.initializedAt,
    updatedBy: context.actor,
    updatedAt: context.initializedAt,
  }))
}

export function getAddedDimensionValues(previous: readonly string[], next: readonly string[]): string[] {
  const previousSet = new Set(previous.map(value => value.trim()).filter(Boolean))
  return [...new Set(next.map(value => value.trim()).filter(Boolean))]
    .filter(value => !previousSet.has(value))
}

const row = (
  id: string,
  parentId: string | null,
  order: number,
  activityName: string,
  milestoneId = '',
  milestoneName = '',
): Level3TemplateActivity => ({
  id, parentId, order, activityName, milestoneId, milestoneName, source: 'template',
})

export const DEFAULT_LEVEL3_TEMPLATE_ACTIVITIES: Level3TemplateActivity[] = [
  row('level3-template-ir', null, 0, 'IR计划输出'),
  row('level3-template-ir-original', 'level3-template-ir', 0, '原始IR输出', 'milestone-concept-start', '概念启动'),
  row('level3-template-ir-review', 'level3-template-ir', 1, '需求串讲', 'milestone-str1', 'STR1'),
  row('level3-template-ir-lock', 'level3-template-ir', 2, 'IR锁定', 'milestone-str1', 'STR1'),
  row('level3-template-ir-test', 'level3-template-ir', 3, 'PD/UX/概设/测试方案锁定', 'milestone-str1', 'STR1'),
  row('level3-template-sr', 'level3-template-ir', 4, 'SR分解', 'milestone-str1', 'STR1'),
  row('level3-template-demand', 'level3-template-ir', 5, '需求反串讲', 'milestone-str1', 'STR1'),
  row('level3-template-schedule', 'level3-template-ir', 6, 'IR排期', 'milestone-str1', 'STR1'),
  row('level3-template-develop', 'level3-template-ir', 7, 'IR开发', 'milestone-str1', 'STR1'),
  row('level3-template-accept', 'level3-template-ir', 8, 'IR验收', 'milestone-str1', 'STR1'),
  row('level3-template-design', null, 1, 'tOS子系统概要设计'),
  row('level3-template-design-start', 'level3-template-design', 0, '概要设计启动', 'milestone-str2', 'STR2'),
  row('level3-template-sdrb', 'level3-template-design', 1, 'SDRB评审', 'milestone-str3', 'STR3'),
  row('level3-template-design-final', 'level3-template-design', 2, '子系统概要设计终审', 'milestone-str3', 'STR3'),
  row('level3-template-test', null, 2, '测试计划'),
  row('level3-template-test-scope', 'level3-template-test', 0, '测试范围 & 需求拆解', 'milestone-str4', 'STR4'),
  row('level3-template-test-case', 'level3-template-test', 1, '测试用例设计评审', 'milestone-str4', 'STR4'),
  row('level3-template-test-strategy', 'level3-template-test', 2, '测试策略&计划评审', 'milestone-str4', 'STR4'),
  row('level3-template-str4', 'level3-template-test', 3, '版本测试-STR4', 'milestone-str4', 'STR4'),
  row('level3-template-str4a', 'level3-template-test', 4, '版本测试-STR4A', 'milestone-str4a', 'STR4A'),
  row('level3-template-str5', 'level3-template-test', 5, 'STR5版本归档', 'milestone-str5', 'STR5'),
  row('level3-template-nps', null, 3, 'Beta NPS调研计划'),
  row('level3-template-nps-design', 'level3-template-nps', 0, '调研问卷设计', 'milestone-close', '收编完成'),
  row('level3-template-beta', 'level3-template-nps', 1, 'Beta版本发布', 'milestone-close', '收编完成'),
  row('level3-template-feedback', 'level3-template-nps', 2, '用户反馈收集', 'milestone-close', '收编完成'),
  row('level3-template-nps-stat', 'level3-template-nps', 3, 'NPS数据统计', 'milestone-close', '收编完成'),
  row('level3-template-report', 'level3-template-nps', 4, '调研报告输出', 'milestone-close', '收编完成'),
]

export const cloneDefaultLevel3TemplateActivities = () => (
  DEFAULT_LEVEL3_TEMPLATE_ACTIVITIES.map(activity => ({ ...activity }))
)
