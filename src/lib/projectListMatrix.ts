import type { ProjectItem } from '@/types/app'
import type { TechnicalSubproject } from '@/types/technicalProject'
import { comparePlanVersions } from '@/lib/planVersioning'
import {
  calculateTechnicalProjectStage,
  comparePublishedTechnicalPlanVersions,
} from '@/lib/technicalProjectRules'

export type ProjectListVariant =
  | 'machine'
  | 'tos'
  | 'technical-tdt'
  | 'technical-subproject'
  | 'capability'

export interface ProjectListColumnDefinition {
  key: string
  label: string
  defaultVisible: boolean
  required: boolean
  hideable: boolean
  reorderable: boolean
  width?: number
  source?: 'system' | 'projectInfo' | 'templateTask'
  taskId?: string
  group?: { key: string; label: string; color: string }
}

export interface ProjectListGroupSegment<T extends { key: string; group?: ProjectListColumnDefinition['group'] }> {
  key: string
  group?: ProjectListColumnDefinition['group']
  items: T[]
}

export function buildStableGroupSegments<T extends { key: string; group?: ProjectListColumnDefinition['group'] }>(
  items: readonly T[],
): ProjectListGroupSegment<T>[] {
  const segments: ProjectListGroupSegment<T>[] = []
  items.forEach((item, index) => {
    if (!item.group) {
      segments.push({ key: `${item.key}::plain`, items: [item] })
      return
    }
    const previous = segments[segments.length - 1]
    if (previous?.group?.key === item.group.key) {
      previous.items.push(item)
      return
    }
    segments.push({ key: `${item.group.key}::segment-${index}`, group: item.group, items: [item] })
  })
  return segments
}

interface PublishedVersionLike { id: string; versionNo: string; status: string }
export function selectLatestPublishedScopedSnapshot<T>(
  versions: readonly PublishedVersionLike[],
  snapshots: Readonly<Record<string, readonly T[]>>,
  snapshotKey: (versionId: string) => string,
): T[] {
  const published = versions
    .filter(version => version.status === '已发布')
    .sort((left, right) => comparePlanVersions(right, left))
  const latest = published[0]
  if (!latest) return []
  const snapshot = snapshots[snapshotKey(latest.id)]
  return Array.isArray(snapshot) ? snapshot.map(item => ({ ...item })) : []
}

export interface ProjectListTemplateTask {
  id: string
  taskName?: string
  name?: string
  parentId?: string | null
  order?: number
  planStartDate?: string
  planEndDate?: string
}

export const PROJECT_LIST_CATEGORIES = [
  '整机产品项目', 'tOS版本项目', '技术项目', '能力建设项目',
] as const

export const PROJECT_LIST_QUICK_FILTERS = {
  machine: [
    { key: 'projectName', label: '项目名称' },
    { key: 'firstSaleTosVersion', label: '首销tOS版本' },
    { key: 'chipCode', label: '芯片编码' },
    { key: 'researchMode', label: '研发模式' },
  ],
  tos: [
    { key: 'projectName', label: '项目名称' },
  ],
  technicalTdt: [
    { key: 'projectName', label: '项目名称' },
    { key: 'technicalTrack', label: '技术赛道' },
    { key: 'tmg', label: 'TMG及技术领域' },
  ],
  technicalSubproject: [
    { key: 'projectName', label: '子任务名称' },
    { key: 'parentProjectName', label: '所属TDT项目名称' },
  ],
} as const

export const TECHNICAL_PROJECT_TYPE_OPTIONS = [
  { label: 'TDT项目', value: 'tdt' },
  { label: '子项目', value: 'subproject' },
] as const

export type TechnicalProjectListType = typeof TECHNICAL_PROJECT_TYPE_OPTIONS[number]['value']

export function resolveTechnicalProjectType(values: readonly string[]): TechnicalProjectListType {
  return values.includes('subproject') ? 'subproject' : 'tdt'
}

const PROJECT_LIST_FIXED_COLUMN_KEYS: Record<ProjectListVariant, readonly string[]> = {
  machine: [],
  tos: ['tosVersion'],
  'technical-tdt': [],
  'technical-subproject': ['projectName'],
  capability: [],
}

export function getProjectListFixedColumnKeys(variant: ProjectListVariant): string[] {
  return [...PROJECT_LIST_FIXED_COLUMN_KEYS[variant]]
}

export interface ProjectListRowGroup<T> {
  key: string
  rows: T[]
}

export function groupProjectListRows<T extends Record<string, unknown>>(
  rows: readonly T[],
  key: string,
  fallbackLabel: string,
): ProjectListRowGroup<T>[] {
  const groups: ProjectListRowGroup<T>[] = []
  const groupByKey = new Map<string, ProjectListRowGroup<T>>()
  rows.forEach(row => {
    const raw = String(row[key] ?? '').trim()
    const groupKey = !raw || raw === '-' || raw === '—' ? fallbackLabel : raw
    let group = groupByKey.get(groupKey)
    if (!group) {
      group = { key: groupKey, rows: [] }
      groupByKey.set(groupKey, group)
      groups.push(group)
    }
    group.rows.push(row)
  })
  return groups
}

export interface MachineProjectHierarchyMetadata {
  __brandKey: string
  __brandLabel: string
  __brandRowSpan: number
  __productLineKey: string
  __productLineLabel: string
  __productLineRowSpan: number
  __productSeriesKey: string
  __productSeriesLabel: string
  __productSeriesRowSpan: number
  __productSeriesProjectCount: number
  __productSeriesCollapsed: boolean
}

const normalizeHierarchyLabel = (value: unknown, fallback: string) => {
  const label = String(value ?? '').trim()
  return !label || label === '-' || label === '—' ? fallback : label
}

interface MachineHierarchyKeys {
  brandKey: string
  brandLabel: string
  productLineKey: string
  productLineLabel: string
  productSeriesKey: string
  productSeriesLabel: string
}

const getMachineHierarchyKeys = (row: Record<string, unknown>): MachineHierarchyKeys => {
  const brandLabel = normalizeHierarchyLabel(row.brand, '未配置品牌')
  const productLineLabel = normalizeHierarchyLabel(row.productLine, '未配置产品线')
  const productSeriesLabel = normalizeHierarchyLabel(row.productSeries, '未配置产品系列')
  const productLineKey = `${brandLabel}::${productLineLabel}`
  return {
    brandKey: brandLabel,
    brandLabel,
    productLineKey,
    productLineLabel,
    productSeriesKey: `${productLineKey}::${productSeriesLabel}`,
    productSeriesLabel,
  }
}

const calculateConsecutiveRowSpans = (keys: readonly string[]) => {
  const spans = Array.from({ length: keys.length }, () => 0)
  for (let start = 0; start < keys.length;) {
    let end = start + 1
    while (end < keys.length && keys[end] === keys[start]) end += 1
    spans[start] = end - start
    start = end
  }
  return spans
}

export function buildMachineProjectHierarchyPage<T extends Record<string, unknown>>(
  allFilteredRows: readonly T[],
  pageRows: readonly T[],
  collapsedSeries: ReadonlySet<string>,
): Array<T & MachineProjectHierarchyMetadata> {
  const hierarchyOrder = new Map<string, number>()
  const projectOrder = new Map<unknown, number>()
  const productSeriesCounts = new Map<string, number>()
  allFilteredRows.forEach((row, index) => {
    const keys = getMachineHierarchyKeys(row)
    for (const key of [keys.brandKey, keys.productLineKey, keys.productSeriesKey]) {
      if (!hierarchyOrder.has(key)) hierarchyOrder.set(key, hierarchyOrder.size)
    }
    projectOrder.set(row.key ?? row.projectId ?? row, index)
    productSeriesCounts.set(
      keys.productSeriesKey,
      (productSeriesCounts.get(keys.productSeriesKey) ?? 0) + 1,
    )
  })

  const sortedRows = pageRows
    .map((row, pageIndex) => ({ row, pageIndex, keys: getMachineHierarchyKeys(row) }))
    .sort((left, right) => (
      (hierarchyOrder.get(left.keys.brandKey) ?? Number.MAX_SAFE_INTEGER)
        - (hierarchyOrder.get(right.keys.brandKey) ?? Number.MAX_SAFE_INTEGER)
      || (hierarchyOrder.get(left.keys.productLineKey) ?? Number.MAX_SAFE_INTEGER)
        - (hierarchyOrder.get(right.keys.productLineKey) ?? Number.MAX_SAFE_INTEGER)
      || (hierarchyOrder.get(left.keys.productSeriesKey) ?? Number.MAX_SAFE_INTEGER)
        - (hierarchyOrder.get(right.keys.productSeriesKey) ?? Number.MAX_SAFE_INTEGER)
      || (projectOrder.get(left.row.key ?? left.row.projectId ?? left.row) ?? left.pageIndex)
        - (projectOrder.get(right.row.key ?? right.row.projectId ?? right.row) ?? right.pageIndex)
    ))

  const visibleSeries = new Set<string>()
  const visibleRows = sortedRows.filter(({ keys }) => {
    if (!collapsedSeries.has(keys.productSeriesKey)) return true
    if (visibleSeries.has(keys.productSeriesKey)) return false
    visibleSeries.add(keys.productSeriesKey)
    return true
  })
  const brandSpans = calculateConsecutiveRowSpans(visibleRows.map(item => item.keys.brandKey))
  const productLineSpans = calculateConsecutiveRowSpans(visibleRows.map(item => item.keys.productLineKey))
  const productSeriesSpans = calculateConsecutiveRowSpans(visibleRows.map(item => item.keys.productSeriesKey))

  return visibleRows.map(({ row, keys }, index) => ({
    ...row,
    __brandKey: keys.brandKey,
    __brandLabel: keys.brandLabel,
    __brandRowSpan: brandSpans[index],
    __productLineKey: keys.productLineKey,
    __productLineLabel: keys.productLineLabel,
    __productLineRowSpan: productLineSpans[index],
    __productSeriesKey: keys.productSeriesKey,
    __productSeriesLabel: keys.productSeriesLabel,
    __productSeriesRowSpan: productSeriesSpans[index],
    __productSeriesProjectCount: productSeriesCounts.get(keys.productSeriesKey) ?? 0,
    __productSeriesCollapsed: collapsedSeries.has(keys.productSeriesKey),
  }))
}

const GROUP_COLORS = ['#e8f3ff', '#fff0e6', '#fff8db', '#edf6dc', '#f2e8ff'] as const

const required = (key: string, label: string, width = 132): ProjectListColumnDefinition => ({
  key, label, width, defaultVisible: true, required: true, hideable: true, reorderable: true, source: 'system',
})

const listField = (
  key: string,
  label: string,
  defaultVisible: boolean,
  width = 132,
): ProjectListColumnDefinition => ({
  key,
  label,
  width,
  defaultVisible,
  required: defaultVisible,
  hideable: true,
  reorderable: true,
  source: 'system',
})

const childMilestone = (label: string): ProjectListColumnDefinition => ({
  ...required(`milestone::${label}`, label),
  source: 'templateTask',
  group: { key: 'subproject-plan', label: '子项目计划', color: '#f2e8ff' },
})

const STATIC_COLUMNS: Record<Exclude<ProjectListVariant, 'capability'>, ProjectListColumnDefinition[]> = {
  machine: [
    listField('brand', '品牌', true, 112), listField('productLine', '产品线', true, 120),
    listField('productSeries', '产品系列', true, 148), listField('projectCount', '项目数', true, 88),
    listField('marketName', '市场名', true, 150), listField('projectName', '项目名称', true, 200),
    listField('status', '项目状态', true, 112), listField('currentNode', '下一个节点', true, 112),
    listField('versionType', '版本类型', true, 112), listField('firstSaleTosVersion', '首销tOS版本', true, 128),
    listField('currentTosVersion', '当前tOS版本', true, 128), listField('chipCode', '芯片编码', true, 120),
    listField('chipModel', '芯片型号', false, 120), listField('chipPlatform', '芯片平台', false, 120),
    listField('researchMode', '研发模式', true, 112), listField('developmentMode', '开发模式', true, 112),
    listField('productType', '产品类型', false, 112), listField('softwareProjectLevel', '软件项目等级', true, 132),
    listField('healthStatus', '健康状态', false, 112), listField('isFirstLaunchProject', '是否首发项目', false, 132),
    listField('dimensionUpgradeStrategy', '升级策略', false, 112), listField('systemType', '系统类型', false, 112),
    listField('kernelVersion', 'Kernel版本', false, 120), listField('androidMajorUpgrade', '是否大版本升级', false, 148),
    listField('modelCategory', '机型分类', false, 112), listField('productionForbiddenDate', '禁止生产时间', false, 132),
    listField('confidentialityLevel', '保密级别', false, 112), listField('androidVersion', '安卓版本', false, 112),
    listField('targetMarket', '目标市场', false, 112), listField('memorySize', '内存大小', false, 112),
    listField('startingRam', '起步RAM', false, 112), listField('isTwoStage', '是否二段式', false, 120),
    listField('isOutsourcedMini', '是否外研Mini版本', false, 148), listField('jiraProjects', 'JIRA项目', false, 140),
    listField('spm', 'SPM', true, 112), listField('spmDepartment', 'SPM部门（二级部门）', true, 180),
  ],
  tos: [
    required('tosVersion', 'tOS版本'), required('spm', '版本项目经理', 160),
  ],
  'technical-tdt': [
    listField('projectName', 'TDT项目名称', true, 200), listField('subprojectCount', '子任务数', true, 100),
    listField('technicalTrack', '技术赛道', true), listField('tmg', 'TMG及技术领域', true, 160),
    listField('subdomain', '子领域', true), listField('technicalLead', '技术项目负责人', true, 160),
    listField('technicalProjectManager', '技术项目经理', true, 160),
    listField('qualityRepresentative', '质量代表', false, 132),
    listField('productRepresentative', '产品代表', false, 132),
    listField('standardizationRepresentative', '标准化代表', false, 140),
  ],
  'technical-subproject': [
    required('projectName', '子任务名称', 200), required('parentProjectName', '所属TDT项目名称', 200),
    required('coreValue', '核心价值'), required('developmentMode', '开发模式'),
    required('firstTosVersion', '首导tOS'), required('firstMachineProject', '首导整机产品', 180),
    required('projectStage', '项目阶段'),
    childMilestone('第1版转测'), childMilestone('第2版转测'),
    childMilestone('第X版转测'), childMilestone('TDR3'),
  ],
}

const getTaskName = (task: ProjectListTemplateTask) => String(task.taskName || task.name || '')
const sortTasks = (left: ProjectListTemplateTask, right: ProjectListTemplateTask) => (
  (left.order ?? 0) - (right.order ?? 0) || String(left.id).localeCompare(String(right.id))
)

export function buildGroupedMilestoneColumns(
  tasks: readonly ProjectListTemplateTask[],
  variant: ProjectListVariant,
): ProjectListColumnDefinition[] {
  if (variant === 'capability') return []
  if (variant === 'technical-subproject') {
    return [...tasks].filter(task => !task.parentId).sort(sortTasks).map(task => ({
      ...required(`milestone::${getTaskName(task)}`, getTaskName(task)),
      source: 'templateTask' as const,
      taskId: String(task.id),
      group: { key: 'subproject-plan', label: '子项目计划', color: '#f2e8ff' },
    }))
  }

  const parents = [...tasks].filter(task => !task.parentId).sort(sortTasks)
  const parentById = new Map(parents.map((parent, index) => [String(parent.id), { parent, index }]))
  return [...tasks]
    .filter(task => task.parentId && parentById.has(String(task.parentId)))
    .sort((left, right) => {
      const leftParent = parentById.get(String(left.parentId))!
      const rightParent = parentById.get(String(right.parentId))!
      return leftParent.index - rightParent.index || sortTasks(left, right)
    })
    .map(task => {
      const parentEntry = parentById.get(String(task.parentId))!
      const parentName = getTaskName(parentEntry.parent)
      return {
        ...required(`milestone::${getTaskName(task)}`, getTaskName(task)),
        source: 'templateTask' as const,
        taskId: String(task.id),
        group: {
          key: `phase::${parentEntry.parent.id}`,
          label: parentName,
          color: GROUP_COLORS[parentEntry.index % GROUP_COLORS.length],
        },
      }
    })
}

interface MatrixOptions {
  milestones?: readonly string[]
  templateTasks?: readonly ProjectListTemplateTask[]
  templateStages?: readonly string[]
  directLevel2Nodes?: readonly string[]
  optionalFields?: readonly { key: string; label: string; defaultVisible?: boolean; width?: number }[]
}

export function getProjectListMatrix(
  variant: ProjectListVariant,
  options: MatrixOptions = {},
): ProjectListColumnDefinition[] {
  if (variant === 'capability') return []
  const base = STATIC_COLUMNS[variant].map(column => ({ ...column }))
  const existingLabels = new Set(base.map(column => column.label))
  const existingKeys = new Set(base.map(column => column.key))
  const dynamic = options.templateTasks?.length
    ? buildGroupedMilestoneColumns(options.templateTasks, variant)
    : [...(options.directLevel2Nodes || options.milestones || [])].map((label, index) => ({
        ...required(`milestone::${label}`, label),
        source: 'templateTask' as const,
        group: variant === 'technical-subproject'
          ? { key: 'subproject-plan', label: '子项目计划', color: '#f2e8ff' }
          : undefined,
        taskId: `dynamic-${index}`,
      }))
  const optional = (variant === 'machine' || variant === 'technical-tdt' ? [] : (options.optionalFields || []))
    .filter(field => !existingKeys.has(field.key) && !dynamic.some(item => item.key === field.key))
    .map(field => ({
      key: field.key,
      label: field.label,
      width: field.width ?? 140,
      defaultVisible: field.defaultVisible ?? false,
      required: false,
      hideable: true,
      reorderable: true,
      source: 'projectInfo' as const,
    }))
  const beforeTail = variant === 'machine' ? base
    : variant === 'tos' ? base.slice(0, 1)
      : variant === 'technical-tdt' ? base
        : base.slice(0, 7)
  const tail = variant === 'machine' ? []
    : variant === 'tos' ? base.slice(1)
      : variant === 'technical-subproject' ? base.slice(7)
        : []
  const milestoneColumns = dynamic.filter(column => !existingLabels.has(column.label))
  // Legacy label-only callers are source-contract probes; real template tasks
  // carry grouping metadata and are placed at their visual position.
  if (!options.templateTasks?.length) {
    return variant === 'tos'
      ? [...beforeTail, ...milestoneColumns, ...tail, ...optional]
      : [...base, ...milestoneColumns, ...optional]
  }
  return [...beforeTail, ...milestoneColumns, ...tail, ...optional]
}

interface TechnicalPlanVersionLike {
  id: string
  versionNo: string
  status: string
  templateType: string
  publishedAt?: string
  tasks: readonly ProjectListTemplateTask[]
}
interface TechnicalPlanInstanceLike { templateKind: 'tdt' | 'subproject'; versions: readonly TechnicalPlanVersionLike[] }

const latestPublished = (instance?: TechnicalPlanInstanceLike) => instance?.versions
  .filter(version => version.status === '已发布')
  .sort((left, right) => comparePublishedTechnicalPlanVersions(
    { ...left, tasks: [] },
    { ...right, tasks: [] },
  ))[0]

const milestoneValues = (tasks: readonly ProjectListTemplateTask[]) => Object.fromEntries(
  tasks.map(task => [`milestone::${getTaskName(task)}`, task.planEndDate || '-']),
)

export interface TechnicalProjectListRow extends Record<string, unknown> {
  key: string
  projectId: string
  projectName: string
  targetProjectId: string
  targetSubprojectId?: string
  technicalProjectType: 'tdt' | 'subproject'
}

export function buildTechnicalProjectListRows(input: {
  projects: readonly ProjectItem[]
  subprojects: readonly TechnicalSubproject[]
  plansByKey: Readonly<Record<string, TechnicalPlanInstanceLike>>
  machineProjects?: readonly Pick<ProjectItem, 'id' | 'name'>[]
  today?: string
}) {
  const today = input.today || new Date().toISOString().slice(0, 10)
  const machineNames = new Map((input.machineProjects || []).map(project => [project.id, project.name]))
  const technicalProjects = input.projects.filter(project => project.type === '技术项目')
  const parentById = new Map(technicalProjects.map(project => [project.id, project]))
  const activeSubprojectCounts = new Map<string, number>()
  input.subprojects.forEach(child => {
    if (!child.active) return
    activeSubprojectCounts.set(
      child.parentProjectId,
      (activeSubprojectCounts.get(child.parentProjectId) ?? 0) + 1,
    )
  })
  const stageByParent = new Map<string, string>()
  const tdt = technicalProjects.map(project => {
    const published = latestPublished(input.plansByKey[`${project.id}:tdt`])
    const projectStage = published ? calculateTechnicalProjectStage(
      published.tasks.map(task => ({
        ...task,
        name: getTaskName(task),
        planStartDate: task.planStartDate || '',
        planEndDate: task.planEndDate || '',
        order: task.order ?? 0,
      })),
      today,
    ) : '-'
    stageByParent.set(project.id, projectStage)
    return {
      key: `tdt::${project.id}`,
      projectId: project.id,
      projectName: project.name,
      targetProjectId: project.id,
      technicalProjectType: 'tdt' as const,
      subprojectCount: activeSubprojectCounts.get(project.id) ?? 0,
      status: project.status || '-',
      technicalTrack: project.technicalTrack || '-',
      tmg: project.tmg || '-',
      subdomain: project.subdomain || '-',
      technicalLead: project.technicalLead || '-',
      technicalProjectManager: project.technicalProjectManager || '-',
      qualityRepresentative: project.qualityRepresentative || '-',
      productRepresentative: project.productRepresentative || '-',
      standardizationRepresentative: project.standardizationRepresentative || '-',
      projectStage,
      ...(published ? milestoneValues(published.tasks) : {}),
    }
  })
  const children = input.subprojects.filter(child => child.active && parentById.has(child.parentProjectId)).map(child => {
    const parent = parentById.get(child.parentProjectId)!
    const published = latestPublished(input.plansByKey[`${child.parentProjectId}:subproject:${child.id}`])
    return {
      key: `subproject::${child.id}`,
      projectId: child.id,
      projectName: child.name,
      parentProjectName: parent.name,
      targetProjectId: parent.id,
      targetSubprojectId: child.id,
      technicalProjectType: 'subproject' as const,
      status: parent.status || '-',
      technicalTrack: parent.technicalTrack || '-',
      coreValue: child.configuration.coreValue || '-',
      developmentMode: child.configuration.developmentMode || '-',
      firstTosVersion: child.configuration.firstTosVersion ? `tOS${child.configuration.firstTosVersion}` : '-',
      firstMachineProject: machineNames.get(child.configuration.firstMachineProjectId) || '-',
      projectStage: stageByParent.get(parent.id) || '-',
      ...(published ? milestoneValues(published.tasks) : {}),
    }
  })
  return { tdt, children }
}

const STRICT_ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
export function isOverdueProjectListDate(value: unknown, today = new Date().toISOString().slice(0, 10)) {
  if (typeof value !== 'string') return false
  const match = value.match(STRICT_ISO_DATE)
  if (!match) return false
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return false
  return value < today
}
