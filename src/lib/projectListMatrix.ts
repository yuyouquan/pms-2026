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
    { key: 'secondaryCategory', label: '项目二级分类' },
    { key: 'status', label: '状态' },
    { key: 'firstSaleTosVersion', label: '首销tOS版本' },
    { key: 'chipCode', label: '芯片编码' },
    { key: 'brand', label: '品牌' },
    { key: 'productSeries', label: '产品系列' },
    { key: 'productType', label: '产品类型' },
  ],
  tos: [
    { key: 'versionType', label: '版本类型' },
    { key: 'tosVersion', label: 'tOS版本' },
  ],
  technical: [
    { key: 'technicalProjectType', label: '项目类型' },
    { key: 'projectName', label: '项目名称' },
    { key: 'technicalTrack', label: '技术赛道' },
    { key: 'projectStage', label: '项目阶段' },
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
  machine: ['productSeries', 'projectName'],
  tos: ['tosVersion'],
  'technical-tdt': ['projectName'],
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

const GROUP_COLORS = ['#e8f3ff', '#fff0e6', '#fff8db', '#edf6dc', '#f2e8ff'] as const

const required = (key: string, label: string, width = 132): ProjectListColumnDefinition => ({
  key, label, width, required: true, hideable: false, reorderable: true, source: 'system',
})

const childMilestone = (label: string): ProjectListColumnDefinition => ({
  ...required(`milestone::${label}`, label),
  source: 'templateTask',
  group: { key: 'subproject-plan', label: '子项目计划', color: '#f2e8ff' },
})

const STATIC_COLUMNS: Record<Exclude<ProjectListVariant, 'capability'>, ProjectListColumnDefinition[]> = {
  machine: [
    required('productSeries', '产品系列'), required('projectName', '项目名称', 200),
    required('brand', '品牌'), required('chipCode', '芯片编码'),
    required('versionType', '版本类型'), required('firstSaleTosVersion', '首销tOS版本'),
    required('status', '项目状态'), required('spm', 'SPM'), required('spmDepartment', 'SPM部门', 160),
  ],
  tos: [
    required('tosVersion', 'tOS版本'), required('versionType', '版本类型'),
    required('status', '项目状态'), required('spm', 'SPM'),
  ],
  'technical-tdt': [
    required('projectName', 'TDT项目名称', 200), required('technicalTrack', '技术赛道'),
    required('tmg', 'TMG及技术领域', 160), required('subdomain', '子领域'),
    required('technicalLead', '技术项目负责人', 160),
    required('technicalProjectManager', '技术项目经理', 160), required('projectStage', '项目阶段'),
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
  const optional = (options.optionalFields || [])
    .filter(field => !existingLabels.has(field.label) && !dynamic.some(item => item.label === field.label))
    .map(field => ({
      key: field.key,
      label: field.label,
      width: field.width ?? 140,
      required: false,
      hideable: true,
      reorderable: true,
      source: 'projectInfo' as const,
    }))
  const beforeTail = variant === 'machine' ? base.slice(0, 7)
    : variant === 'tos' ? base.slice(0, 3)
      : variant === 'technical-tdt' ? base
        : base.slice(0, 7)
  const tail = variant === 'machine' ? base.slice(7)
    : variant === 'tos' ? base.slice(3)
      : variant === 'technical-subproject' ? base.slice(7)
        : []
  const milestoneColumns = dynamic.filter(column => !existingLabels.has(column.label))
  // Legacy label-only callers are source-contract probes; real template tasks
  // carry grouping metadata and are placed at their visual position.
  if (!options.templateTasks?.length) return [...base, ...milestoneColumns, ...optional]
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
      status: project.status || '-',
      technicalTrack: project.technicalTrack || '-',
      tmg: project.tmg || '-',
      subdomain: project.subdomain || '-',
      technicalLead: project.technicalLead || '-',
      technicalProjectManager: project.technicalProjectManager || '-',
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
