import type { HrProjectCategory } from '@/lib/hrFormalProjectSource'

export type BudgetScheduleCategory = Exclude<HrProjectCategory, 'capability'>

export interface BudgetScheduleTemplateTask {
  id: string
  parentId?: string | null
  order?: number
  taskName?: string
  intervalDays?: number | null
}

export interface BudgetScheduleMilestone {
  templateTaskId: string
  stageId: string
  fieldKey: string
  label: string
  intervalDays: number
}

export interface BudgetScheduleStage {
  templateTaskId: string
  label: string
  milestones: BudgetScheduleMilestone[]
}

export interface BudgetScheduleModelSnapshot {
  schemaVersion: 1
  category: BudgetScheduleCategory
  templateVersionId: string
  templateVersionNo: string
  templatePublishedAt: string | null
  firstAnchorKey: string
  lastAnchorKey: string
  totalModelDays: number
  milestones: BudgetScheduleMilestone[]
  stages: BudgetScheduleStage[]
}

interface PublishedTemplateVersion {
  id: string
  versionNo: string
  status: string
  publishedAt?: string
}

interface PublishedTemplateState {
  configTemplateVersionScopes: Record<string, { versions: PublishedTemplateVersion[]; currentVersion?: string } | undefined>
  publishedSnapshots: Record<string, BudgetScheduleTemplateTask[] | undefined>
}

interface BudgetScheduleSource {
  scopeKey: string
  snapshotKey: (versionId: string) => string
}

const MACHINE_TYPE = '整机产品项目'
const TOS_TYPE = 'tOS版本项目'
const TECHNICAL_TYPE = '技术项目'

export const BUDGET_SCHEDULE_SOURCES: Record<BudgetScheduleCategory, BudgetScheduleSource> = {
  machine: {
    scopeKey: `config-template::${MACHINE_TYPE}::level1`,
    snapshotKey: versionId => `template::${MACHINE_TYPE}::level1::${versionId}`,
  },
  tos: {
    scopeKey: `config-template::${TOS_TYPE}::level1`,
    snapshotKey: versionId => `template::${TOS_TYPE}::level1::${versionId}`,
  },
  technical: {
    scopeKey: `config-template::${TECHNICAL_TYPE}::tdt`,
    snapshotKey: versionId => `template::${TECHNICAL_TYPE}::tdt::${versionId}`,
  },
}

export const BUDGET_SCHEDULE_ANCHORS = {
  machine: [{ key: 'conceptStart', label: '概念启动' }, { key: 'str5', label: 'STR5' }],
  tos: [{ key: 'planningKO', label: '规划KO' }, { key: 'str5', label: 'STR5' }],
  technical: [{ key: 'planningStart', label: '规划启动' }, { key: 'edcp', label: 'EDCP' }],
} as const satisfies Record<BudgetScheduleCategory, readonly [{ key: string; label: string }, { key: string; label: string }]>

export const BUDGET_MILESTONE_FIELD_BY_LABEL: Record<BudgetScheduleCategory, Record<string, string>> = {
  machine: { 概念启动: 'conceptStart', STR1: 'str1', STR2: 'str2', STR3: 'str3', STR4: 'str4', STR4A: 'str4a', STR5: 'str5' },
  tos: { 规划KO: 'planningKO', CDCP: 'cdcp', 概念启动: 'conceptStart', STR1: 'str1', STR2: 'str2', STR3: 'str3', STR4: 'str4', STR4A: 'str4a', STR5: 'str5' },
  technical: { 规划启动: 'planningStart', 'charter DCP': 'charterDCP', TDR1: 'tdr1', TDR2: 'tdr2', PDCP: 'pdcp', TDR3_X: 'tdr3x', TDCP_X: 'tdcpx', TDR4: 'tdr4', EDCP: 'edcp' },
}

/** Fresh mock/template defaults only. Persisted snapshots and drafts are never rewritten with these values. */
export const DEFAULT_BUDGET_INTERVALS_BY_LABEL: Record<BudgetScheduleCategory, Record<string, number>> = {
  machine: { 概念启动: 0, STR1: 10, STR2: 30, STR3: 20, STR4: 10, STR4A: 10, STR5: 20 },
  tos: { 规划KO: 0, CDCP: 20, 概念启动: 0, STR1: 10, STR2: 10, STR3: 20, STR4: 10, STR4A: 10, STR5: 20 },
  technical: { 规划启动: 0, 'charter DCP': 10, TDR1: 20, TDR2: 10, PDCP: 10, TDR3_X: 20, TDCP_X: 10, TDR4: 10, EDCP: 10 },
}

const normalizeLabel = (value: unknown) => String(value ?? '').trim().replace(/[\s_-]+/g, '').toUpperCase()
const normalizedDefaultIntervals = Object.fromEntries(Object.entries(DEFAULT_BUDGET_INTERVALS_BY_LABEL).map(([category, values]) => [
  category,
  Object.fromEntries(Object.entries(values).map(([label, intervalDays]) => [normalizeLabel(label), intervalDays])),
])) as Record<BudgetScheduleCategory, Record<string, number>>

export function withDefaultBudgetScheduleIntervals<T extends BudgetScheduleTemplateTask>(category: BudgetScheduleCategory, tasks: readonly T[]): T[] {
  const intervals = normalizedDefaultIntervals[category]
  return tasks.map(task => {
    const intervalDays = intervals[normalizeLabel(task.taskName)]
    return intervalDays === undefined ? { ...task } : { ...task, intervalDays }
  })
}
const normalizedFieldMaps = Object.fromEntries(Object.entries(BUDGET_MILESTONE_FIELD_BY_LABEL).map(([category, fields]) => [
  category,
  Object.fromEntries(Object.entries(fields).map(([label, field]) => [normalizeLabel(label), field])),
])) as Record<BudgetScheduleCategory, Record<string, string>>
const normalizedAnchorLabels = Object.fromEntries(Object.entries(BUDGET_SCHEDULE_ANCHORS).map(([category, anchors]) => [
  category,
  anchors.map(anchor => normalizeLabel(anchor.label)),
])) as Record<BudgetScheduleCategory, string[]>
const resourceFieldOrder = Object.fromEntries(Object.entries(BUDGET_MILESTONE_FIELD_BY_LABEL).map(([category, fields]) => [
  category,
  [...new Set(Object.values(fields))],
])) as Record<BudgetScheduleCategory, string[]>

const sortTasks = <T extends BudgetScheduleTemplateTask>(tasks: readonly T[]) => tasks
  .map((task, index) => ({ task, index }))
  .sort((left, right) => (Number(left.task.order) || left.index + 1) - (Number(right.task.order) || right.index + 1) || left.index - right.index)
  .map(item => item.task)

const versionParts = (value: string) => (value.match(/\d+/g) ?? []).map(Number)
const compareVersions = (left: PublishedTemplateVersion, right: PublishedTemplateVersion) => {
  const leftTime = left.publishedAt ? Date.parse(left.publishedAt) : Number.NaN
  const rightTime = right.publishedAt ? Date.parse(right.publishedAt) : Number.NaN
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) return leftTime - rightTime
  const leftParts = versionParts(left.versionNo)
  const rightParts = versionParts(right.versionNo)
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0)
    if (difference) return difference
  }
  return left.id.localeCompare(right.id)
}

const isWeight = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0

export function resolvePublishedBudgetScheduleModel(
  state: PublishedTemplateState,
  category: BudgetScheduleCategory,
): BudgetScheduleModelSnapshot {
  const source = BUDGET_SCHEDULE_SOURCES[category]
  const scope = state.configTemplateVersionScopes[source.scopeKey]
  const latest = scope?.versions.filter(version => version.status === '已发布').sort(compareVersions).at(-1)
  if (!latest) throw new Error('未找到已发布的一级计划模板，无法执行排布')
  const tasks = state.publishedSnapshots[source.snapshotKey(latest.id)]
  if (!Array.isArray(tasks)) throw new Error(`最新已发布模板 ${latest.versionNo} 缺少快照，无法执行排布`)

  const roots = sortTasks(tasks.filter(task => !task.parentId))
  const taskIds = new Set(tasks.map(task => String(task.id)))
  const rootIds = new Set(roots.map(root => String(root.id)))
  const directChildren = new Map(roots.map(root => [String(root.id), sortTasks(tasks.filter(task => String(task.parentId ?? '') === String(root.id)))]))
  const unsupportedWeightedNode = tasks.find(task => task.parentId && !rootIds.has(String(task.parentId)) && isWeight(task.intervalDays) && task.intervalDays > 0)
  if (unsupportedWeightedNode) {
    const parentExists = taskIds.has(String(unsupportedWeightedNode.parentId))
    throw new Error(`模板节点“${unsupportedWeightedNode.taskName || unsupportedWeightedNode.id}”${parentExists ? '不是阶段直接里程碑' : '的阶段不存在'}，无法映射模型`)
  }
  const flattened = roots.flatMap(root => (directChildren.get(String(root.id)) ?? []).map(child => ({ root, child })))
  const [firstAnchorLabel, lastAnchorLabel] = normalizedAnchorLabels[category]
  const firstMatches = flattened.map((item, index) => normalizeLabel(item.child.taskName) === firstAnchorLabel ? index : -1).filter(index => index >= 0)
  const lastMatches = flattened.map((item, index) => normalizeLabel(item.child.taskName) === lastAnchorLabel ? index : -1).filter(index => index >= 0)
  if (firstMatches.length !== 1 || lastMatches.length !== 1) throw new Error('模板缺少唯一的排布锚点名称，无法执行排布')
  const startIndex = firstMatches[0]
  const endIndex = lastMatches[0]
  if (startIndex >= endIndex) throw new Error('模板锚点顺序冲突，无法执行排布')

  const fieldMap = normalizedFieldMaps[category]
  const order = resourceFieldOrder[category]
  const seenFields = new Set<string>()
  let previousFieldIndex = -1
  const milestones: BudgetScheduleMilestone[] = []
  const byStage = new Map<string, BudgetScheduleMilestone[]>()
  for (const [relativeIndex, { root, child }] of flattened.slice(startIndex, endIndex + 1).entries()) {
    const label = String(child.taskName ?? '').trim()
    const fieldKey = fieldMap[normalizeLabel(label)]
    if (!fieldKey) {
      if (isWeight(child.intervalDays) && child.intervalDays > 0) throw new Error(`模板节点“${label || child.id}”无法映射到资源里程碑字段`)
      continue
    }
    if (seenFields.has(fieldKey)) throw new Error(`模板里程碑“${label}”重复，映射顺序冲突`)
    seenFields.add(fieldKey)
    const fieldIndex = order.indexOf(fieldKey)
    if (fieldIndex <= previousFieldIndex) throw new Error(`模板里程碑“${label}”与资源字段顺序冲突`)
    previousFieldIndex = fieldIndex
    const intervalDays = relativeIndex === 0 ? 0 : child.intervalDays
    if (!isWeight(intervalDays)) throw new Error(`模板里程碑“${label}”缺少有效的间隔天数`)
    const item = { templateTaskId: String(child.id), stageId: String(root.id), fieldKey, label, intervalDays }
    milestones.push(item)
    byStage.set(String(root.id), [...(byStage.get(String(root.id)) ?? []), item])
  }

  const [firstAnchor, lastAnchor] = BUDGET_SCHEDULE_ANCHORS[category]
  if (milestones[0]?.fieldKey !== firstAnchor.key || milestones.at(-1)?.fieldKey !== lastAnchor.key) {
    throw new Error('模板必需锚点无法映射到资源日期字段')
  }
  const totalModelDays = milestones.reduce((sum, milestone, index) => sum + (index === 0 ? 0 : milestone.intervalDays), 0)
  if (!(totalModelDays > 0)) throw new Error('模板模型周期必须大于0天，无法执行排布')
  const stages = roots.flatMap(root => {
    const children = byStage.get(String(root.id))
    return children?.length ? [{ templateTaskId: String(root.id), label: String(root.taskName ?? '').trim() || '未命名阶段', milestones: children }] : []
  })
  return {
    schemaVersion: 1,
    category,
    templateVersionId: latest.id,
    templateVersionNo: latest.versionNo,
    templatePublishedAt: latest.publishedAt ?? null,
    firstAnchorKey: firstAnchor.key,
    lastAnchorKey: lastAnchor.key,
    totalModelDays,
    milestones,
    stages,
  }
}

const parseDate = (value: unknown): number | null => {
  if (typeof value !== 'string') return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3])
  const timestamp = Date.UTC(year, month - 1, day)
  const date = new Date(timestamp)
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? timestamp : null
}
const formatDate = (timestamp: number) => new Date(timestamp).toISOString().slice(0, 10)
const DAY = 24 * 60 * 60 * 1000

export function createBudgetMilestoneSchedule(model: BudgetScheduleModelSnapshot, firstDate: string, lastDate: string) {
  const first = parseDate(firstDate)
  const last = parseDate(lastDate)
  if (first === null || last === null) throw new Error('请选择有效日期')
  if (last < first) throw new Error('结束时间不能早于开始时间，请检查里程碑顺序')
  if (!(model.totalModelDays > 0) || model.milestones.length < 2) throw new Error('排布模型无有效区间')
  const totalCalendarDays = Math.round((last - first) / DAY)
  let cumulativeModelDays = 0
  const dates: Record<string, string> = { [model.firstAnchorKey]: firstDate }
  model.milestones.slice(1).forEach((milestone, index) => {
    cumulativeModelDays += milestone.intervalDays
    const isLast = index === model.milestones.length - 2
    const offset = isLast ? totalCalendarDays : Math.round(totalCalendarDays * cumulativeModelDays / model.totalModelDays)
    dates[milestone.fieldKey] = formatDate(first + offset * DAY)
  })
  dates[model.lastAnchorKey] = lastDate
  return dates
}

export interface BudgetScheduledSegment {
  fieldKey: string
  previousFieldKey: string
  days: number | null
}

export interface BudgetStageMetrics {
  stageId: string
  label: string
  scheduledDays: number | null
  scheduledRatio: number | null
  modelDays: number
  modelRatio: number
  scheduledSegments: BudgetScheduledSegment[]
}

export function calculateBudgetStageMetrics(model: BudgetScheduleModelSnapshot, dates: Record<string, string | null | undefined>): BudgetStageMetrics[] {
  const first = parseDate(dates[model.firstAnchorKey])
  const last = parseDate(dates[model.lastAnchorKey])
  const scheduledTotal = first !== null && last !== null && last >= first ? Math.round((last - first) / DAY) : null
  const milestoneIndex = new Map(model.milestones.map((milestone, index) => [milestone.fieldKey, index]))
  return model.stages.map(stage => {
    const segments = stage.milestones.flatMap(milestone => {
      const index = milestoneIndex.get(milestone.fieldKey) ?? -1
      if (index <= 0) return []
      const previous = model.milestones[index - 1]
      const previousDate = parseDate(dates[previous.fieldKey])
      const currentDate = parseDate(dates[milestone.fieldKey])
      const days = previousDate !== null && currentDate !== null && currentDate >= previousDate
        ? Math.round((currentDate - previousDate) / DAY)
        : null
      return [{ fieldKey: milestone.fieldKey, previousFieldKey: previous.fieldKey, days }]
    })
    const scheduledDays = segments.some(segment => segment.days === null)
      ? null
      : segments.reduce((sum, segment) => sum + (segment.days ?? 0), 0)
    const modelDays = stage.milestones.reduce((sum, milestone) => sum + (milestoneIndex.get(milestone.fieldKey) === 0 ? 0 : milestone.intervalDays), 0)
    return {
      stageId: stage.templateTaskId,
      label: stage.label,
      scheduledDays,
      scheduledRatio: scheduledDays === null || scheduledTotal === null || scheduledTotal === 0 ? null : scheduledDays * 100 / scheduledTotal,
      modelDays,
      modelRatio: modelDays * 100 / model.totalModelDays,
      scheduledSegments: segments,
    }
  })
}

const formatDays = (value: number) => Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)))
const formatRatio = (value: number) => `${value.toFixed(2)}%`
export const formatBudgetStageMetrics = (metrics: Pick<BudgetStageMetrics, 'scheduledDays' | 'scheduledRatio' | 'modelDays' | 'modelRatio'>) => (
  `${metrics.scheduledDays === null || metrics.scheduledRatio === null ? '排布不可用' : `排布${formatDays(metrics.scheduledDays)}天（${formatRatio(metrics.scheduledRatio)}）`}/${Number.isFinite(metrics.modelDays) && Number.isFinite(metrics.modelRatio) ? `模型${formatDays(metrics.modelDays)}天（${formatRatio(metrics.modelRatio)}）` : '模型不可用'}`
)

export function validateBudgetScheduleSnapshot(category: BudgetScheduleCategory, snapshot: BudgetScheduleModelSnapshot) {
  if (snapshot.schemaVersion !== 1 || snapshot.category !== category || !snapshot.templateVersionId || !snapshot.templateVersionNo) throw new Error('排布模型快照无效')
  const anchors = BUDGET_SCHEDULE_ANCHORS[category]
  if (snapshot.firstAnchorKey !== anchors[0].key || snapshot.lastAnchorKey !== anchors[1].key || !(snapshot.totalModelDays > 0)) throw new Error('排布模型锚点或周期无效')
  if (snapshot.milestones[0]?.fieldKey !== snapshot.firstAnchorKey || snapshot.milestones.at(-1)?.fieldKey !== snapshot.lastAnchorKey) throw new Error('排布模型里程碑不完整')
  const allowedOrder = resourceFieldOrder[category]
  const fields = snapshot.milestones.map(milestone => milestone.fieldKey)
  if (new Set(fields).size !== fields.length || fields.some(field => !allowedOrder.includes(field))) throw new Error('排布模型包含重复或未知里程碑')
  if (fields.some((field, index) => index > 0 && allowedOrder.indexOf(field) <= allowedOrder.indexOf(fields[index - 1]))) throw new Error('排布模型里程碑顺序冲突')
  if (snapshot.milestones.some((milestone, index) => !isWeight(milestone.intervalDays) || index === 0 && milestone.intervalDays !== 0)) throw new Error('排布模型间隔天数无效')
  const total = snapshot.milestones.slice(1).reduce((sum, milestone) => sum + milestone.intervalDays, 0)
  if (Math.abs(total - snapshot.totalModelDays) > 0.000001) throw new Error('排布模型周期汇总不一致')
  const stagedMilestones = snapshot.stages.flatMap(stage => stage.milestones.map(milestone => {
    if (milestone.stageId !== stage.templateTaskId) throw new Error('排布模型阶段归属无效')
    return milestone
  }))
  if (stagedMilestones.length !== snapshot.milestones.length) throw new Error('排布模型阶段映射不完整')
  const milestoneProperties: (keyof BudgetScheduleMilestone)[] = ['templateTaskId', 'stageId', 'fieldKey', 'label', 'intervalDays']
  if (stagedMilestones.some((milestone, index) => milestoneProperties.some(property => milestone[property] !== snapshot.milestones[index][property]))) {
    throw new Error('排布模型阶段里程碑与模型不一致')
  }
}
