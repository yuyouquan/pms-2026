import {
  getProjectInfoFields,
  type ProjectInfoFieldDefinition,
} from '@/constants/projectInfoSchema'
import {
  PROJECT_CATEGORY_MACHINE,
  PROJECT_CATEGORY_TECH,
  PROJECT_TYPE_TOS_VERSION,
  resolveProjectClassification,
} from '@/constants/projectTypes'
import {
  isValuelessFilterOperator,
  normalizeFilterConditions,
  type AnyFilterCondition,
  type FilterFieldDefinition,
} from '@/lib/filterConditions'
import {
  formatProjectInfoValue,
  getProjectInfoValue,
  type ProjectInfoProject,
} from '@/lib/projectInfoValues'
import { getTemplateSnapshotKey } from '@/lib/projectTemplateCompatibility'
import {
  getProjectListMatrix,
  isOverdueProjectListDate,
  type ProjectListTemplateTask,
  type ProjectListVariant,
} from '@/lib/projectListMatrix'

export type ProjectSummaryFieldSource = 'system' | 'projectInfo' | 'templateTask'

export interface ProjectSummaryFieldDefinition {
  key: string
  title: string
  source: ProjectSummaryFieldSource
  defaultVisible: boolean
  hideable: boolean
  inputType: ProjectInfoFieldDefinition['inputType'] | 'system'
  width: number
  taskId?: string
  parentTaskName?: string
  group?: { key: string; label: string; color: string }
}

export function getProjectListFieldDefinitions(
  variant: ProjectListVariant,
  templateTasks: readonly ProjectListTemplateTask[],
  projectType: string,
): ProjectSummaryFieldDefinition[] {
  const optionalFields = getProjectInfoFields(projectType).map(field => ({
    key: field.key,
    label: field.label,
    defaultVisible: field.defaultVisible,
    width: getProjectInfoFieldWidth(field.inputType),
  }))
  return getProjectListMatrix(variant, { templateTasks, optionalFields }).map(column => ({
    key: column.key,
    title: column.label,
    source: column.source ?? 'system',
    defaultVisible: column.required,
    hideable: column.hideable,
    inputType: column.source === 'templateTask' ? 'date' : 'system',
    width: column.width ?? 140,
    taskId: column.taskId,
    group: column.group,
  }))
}

const SYSTEM_FIELDS: ProjectSummaryFieldDefinition[] = [
  {
    key: 'projectName',
    title: '项目名称',
    source: 'system',
    defaultVisible: true,
    hideable: false,
    inputType: 'system',
    width: 200,
  },
  {
    key: 'projectCategory',
    title: '项目分类',
    source: 'system',
    defaultVisible: true,
    hideable: false,
    inputType: 'system',
    width: 140,
  },
  {
    key: 'status',
    title: '状态',
    source: 'system',
    defaultVisible: true,
    hideable: true,
    inputType: 'system',
    width: 100,
  },
]

const getProjectInfoFieldWidth = (inputType: ProjectInfoFieldDefinition['inputType']) => {
  if (inputType === 'people') return 160
  if (inputType === 'link') return 220
  return 140
}

export function getProjectSummaryFieldDefinitions(
  projectType: string,
): ProjectSummaryFieldDefinition[] {
  const { projectCategory } = resolveProjectClassification(projectType)
  const projectInfoFields = getProjectInfoFields(projectCategory).map(field => ({
    key: field.key,
    title: field.label,
    source: 'projectInfo' as const,
    defaultVisible: field.defaultVisible,
    hideable: field.hideable,
    inputType: field.inputType,
    width: getProjectInfoFieldWidth(field.inputType),
  }))
  return [...SYSTEM_FIELDS, ...projectInfoFields]
}

interface PublishedTemplateVersion {
  id: string
  versionNo: string
  status: string
}

export interface ProjectSummaryTemplateTask {
  id: string
  parentId?: string
  order?: number
  taskName: string
  defaultRoadmap?: boolean
  [key: string]: unknown
}

const cloneTasks = <T extends ProjectSummaryTemplateTask>(tasks: readonly T[]): T[] => (
  tasks.map(task => ({ ...task }))
)

const getVersionNumber = (versionNo: string) => {
  const match = String(versionNo).match(/\d+/)
  return match ? Number(match[0]) : -1
}

export function getLatestPublishedTemplateTasks<T extends ProjectSummaryTemplateTask>(
  projectType: string,
  versions: readonly PublishedTemplateVersion[],
  publishedSnapshots: Readonly<Record<string, readonly T[]>>,
  currentVersion: string,
  currentTemplateTasks: readonly T[],
  options: { namespacedOnly?: boolean } = {},
): T[] {
  const publishedVersions = versions
    .map((version, index) => ({ version, index }))
    .filter(({ version }) => version.status === '已发布')
    .sort((left, right) => (
      getVersionNumber(right.version.versionNo) - getVersionNumber(left.version.versionNo)
      || right.index - left.index
    ))
    .map(({ version }) => version)
  const namespacedVersion = publishedVersions.find(version => (
    Object.prototype.hasOwnProperty.call(
      publishedSnapshots,
      getTemplateSnapshotKey(projectType, version.id),
    )
  ))
  if (namespacedVersion) {
    const snapshot = publishedSnapshots[
      getTemplateSnapshotKey(projectType, namespacedVersion.id)
    ]
    return Array.isArray(snapshot) ? cloneTasks(snapshot) : []
  }
  if (options.namespacedOnly) return []

  const latest = publishedVersions[0]
  if (!latest) return []
  const snapshot = publishedSnapshots[latest.id]
  if (Array.isArray(snapshot)) return cloneTasks(snapshot)
  return latest.id === currentVersion ? cloneTasks(currentTemplateTasks) : []
}

export function getLevel1SecondLevelTasks<T extends ProjectSummaryTemplateTask>(
  tasks: readonly T[],
): T[] {
  const indexedTasks = tasks.map((task, index) => ({ task, index }))
  const topLevelTasks = indexedTasks
    .filter(({ task }) => !task.parentId)
    .map(({ task }, index) => ({ task, index }))
  const topLevelById = new Map(topLevelTasks.map(entry => [String(entry.task.id), entry]))

  return indexedTasks
    .filter(({ task }) => Boolean(task.parentId && topLevelById.has(String(task.parentId))))
    .sort((left, right) => {
      const leftParent = topLevelById.get(String(left.task.parentId))!
      const rightParent = topLevelById.get(String(right.task.parentId))!
      return (leftParent.task.order ?? leftParent.index) - (rightParent.task.order ?? rightParent.index)
        || leftParent.index - rightParent.index
        || (left.task.order ?? 0) - (right.task.order ?? 0)
        || left.index - right.index
    })
    .map(({ task }) => task)
}

export function getTemplateTaskFieldDefinitions(
  projectType: string,
  tasks: readonly ProjectSummaryTemplateTask[],
): ProjectSummaryFieldDefinition[] {
  const secondLevelTasks = getLevel1SecondLevelTasks(tasks)
  const nameCounts = new Map<string, number>()
  secondLevelTasks.forEach(task => {
    nameCounts.set(task.taskName, (nameCounts.get(task.taskName) ?? 0) + 1)
  })
  const parentsById = new Map(tasks.map(task => [String(task.id), task]))

  return secondLevelTasks.map(task => {
    const parentTaskName = parentsById.get(String(task.parentId))?.taskName ?? ''
    return {
      key: `templateTask::${projectType}::${task.id}`,
      title: (nameCounts.get(task.taskName) ?? 0) > 1
        ? `${parentTaskName} / ${task.taskName}`
        : task.taskName,
      source: 'templateTask',
      defaultVisible: Boolean(task.defaultRoadmap),
      hideable: true,
      inputType: 'date',
      width: 130,
      taskId: task.id,
      parentTaskName,
    }
  })
}

export type WorkbenchListState =
  | { kind: 'select-category' }
  | {
      kind: 'table' | 'unsupported'
      showSecondaryCategory: boolean
      showStatusQuickFilter: boolean
    }

export function getWorkbenchListState(projectType: string): WorkbenchListState {
  if (projectType === 'all') return { kind: 'select-category' }
  const { projectCategory } = resolveProjectClassification(projectType)
  if (projectCategory === PROJECT_CATEGORY_MACHINE) {
    return { kind: 'table', showSecondaryCategory: true, showStatusQuickFilter: true }
  }
  if (projectCategory === PROJECT_TYPE_TOS_VERSION) {
    return { kind: 'table', showSecondaryCategory: false, showStatusQuickFilter: false }
  }
  if (projectCategory === PROJECT_CATEGORY_TECH) {
    return { kind: 'table', showSecondaryCategory: false, showStatusQuickFilter: true }
  }
  return { kind: 'unsupported', showSecondaryCategory: false, showStatusQuickFilter: false }
}

export interface ProjectSummaryQuickFilterDefinition {
  key: string
  label: string
  options: { label: string; value: string }[]
}

const MACHINE_QUICK_FILTERS = [
  { key: 'firstSaleTosVersion', label: '首销 tOS 版本' },
  { key: 'chipCode', label: '芯片编码' },
  { key: 'brand', label: '品牌' },
  { key: 'productSeries', label: '产品系列' },
  { key: 'productType', label: '产品类型' },
] as const

const TOS_QUICK_FILTERS = [
  { key: 'versionType', label: '版本类型' },
  { key: 'tosVersion', label: 'tOS 版本' },
] as const

const TOP_LEVEL_QUICK_FILTER_FIELDS = new Set(['brand', 'versionType', 'tosVersion'])

const getQuickFilterValue = (project: ProjectInfoProject, field: string) => {
  const topLevelValue = project[field]
  if (TOP_LEVEL_QUICK_FILTER_FIELDS.has(field)) {
    return typeof topLevelValue === 'string' ? topLevelValue.trim() : ''
  }
  const value = getProjectInfoValue(project, field)
  return typeof value === 'string' ? value.trim() : ''
}

export function getProjectSummaryQuickFilterDefinitions(
  projectType: string,
  projects: readonly ProjectInfoProject[],
): ProjectSummaryQuickFilterDefinition[] {
  const { projectCategory } = resolveProjectClassification(projectType)
  const definitions = projectCategory === PROJECT_CATEGORY_MACHINE
    ? MACHINE_QUICK_FILTERS
    : projectCategory === PROJECT_TYPE_TOS_VERSION
      ? TOS_QUICK_FILTERS
      : []

  return definitions.map(definition => {
    const values = projects.reduce<string[]>((result, project) => {
      const value = getQuickFilterValue(project, definition.key)
      if (value) result.push(value)
      return result
    }, [])
    const uniqueValues = [...new Set(values)].sort((left, right) => (
      left.localeCompare(right, 'zh-CN', { numeric: true })
    ))
    return {
      ...definition,
      options: uniqueValues.map(value => ({ label: value, value })),
    }
  })
}

export function updateLinkedQuickFilterCondition(
  conditions: readonly AnyFilterCondition[],
  field: string,
  values: readonly string[],
): AnyFilterCondition[] {
  const normalizedValues = [...new Set(values.map(value => value.trim()).filter(Boolean))]
  const existing = conditions.find(condition => condition.field === field)
  const otherConditions = conditions.filter(condition => condition.field !== field)
  if (normalizedValues.length === 0) return otherConditions

  const linkedCondition: AnyFilterCondition = {
    id: existing?.id ?? `quick-${field}`,
    field,
    operator: 'equalsAny',
    value: normalizedValues,
  }
  return [...otherConditions, linkedCondition]
}

export function getLinkedQuickFilterValues(
  conditions: readonly AnyFilterCondition[],
  field: string,
): string[] {
  const condition = conditions.find(candidate => (
    candidate.field === field
    && candidate.operator === 'equalsAny'
    && Array.isArray(candidate.value)
  ))
  return condition && Array.isArray(condition.value) ? [...condition.value] : []
}

export function normalizeStoredProjectSummaryFilters(
  value: unknown,
  fieldDefinitions: readonly FilterFieldDefinition[],
): AnyFilterCondition[] {
  if (!Array.isArray(value)) return []

  const definitionsByKey = new Map(
    fieldDefinitions.map(definition => [definition.key, definition]),
  )
  const sanitized: AnyFilterCondition[] = []

  value.forEach(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return
    const candidate = item as Record<string, unknown>
    if (
      typeof candidate.id !== 'string'
      || typeof candidate.field !== 'string'
      || typeof candidate.operator !== 'string'
    ) return

    const rawValue = candidate.value
    if (typeof rawValue !== 'string' && !Array.isArray(rawValue)) return
    const normalizedRawValue = Array.isArray(rawValue)
      ? rawValue.filter((entry): entry is string => typeof entry === 'string')
      : rawValue
    const definition = definitionsByKey.get(candidate.field)

    if (definition?.multiple) {
      if (isValuelessFilterOperator(
        candidate.operator as AnyFilterCondition['operator'],
      )) return
      const values = [
        ...new Set(
          (Array.isArray(normalizedRawValue)
            ? normalizedRawValue
            : [normalizedRawValue])
            .map(entry => entry.trim())
            .filter(Boolean),
        ),
      ]
      if (values.length === 0) return
      sanitized.push({
        id: candidate.id,
        field: candidate.field,
        operator: 'equalsAny',
        value: values,
      })
      return
    }

    sanitized.push({
      id: candidate.id,
      field: candidate.field,
      operator: candidate.operator as AnyFilterCondition['operator'],
      value: normalizedRawValue,
    })
  })

  return normalizeFilterConditions(sanitized, fieldDefinitions)
}

export interface ProjectSummaryRow extends Record<string, unknown> {
  key: string
  projectId: string
  projectName: string
}

function findProjectTaskDate(
  tasks: readonly ProjectSummaryTemplateTask[],
  taskId: string,
) {
  const task = tasks.find(item => String(item?.id) === taskId)
  return typeof task?.planEndDate === 'string' && task.planEndDate ? task.planEndDate : '-'
}

const getTopLevelSummaryValue = (project: ProjectInfoProject, key: string) => {
  const value = project[key]
  return typeof value === 'string' && value ? value : '-'
}

export function buildProjectSummaryRow(
  project: ProjectInfoProject,
  definitions: readonly ProjectSummaryFieldDefinition[],
  level1PlanTasks: readonly ProjectSummaryTemplateTask[] = [],
): ProjectSummaryRow {
  const classification = resolveProjectClassification(
    project.type,
    String(project.secondaryCategory ?? ''),
  )
  const row: ProjectSummaryRow = {
    key: project.id,
    projectId: project.id,
    projectName: project.name,
    secondaryCategory: String(project.secondaryCategory || '-'),
    brand: getTopLevelSummaryValue(project, 'brand'),
    versionType: getTopLevelSummaryValue(project, 'versionType'),
    tosVersion: getTopLevelSummaryValue(project, 'tosVersion'),
  }

  definitions.forEach(definition => {
    if (definition.key === 'projectName') row[definition.key] = project.name
    else if (definition.key === 'projectCategory') {
      row[definition.key] = classification.projectCategory
    } else if (definition.key === 'status') {
      row[definition.key] = formatProjectInfoValue(project.status as never)
    } else if (definition.source === 'projectInfo') {
      row[definition.key] = formatProjectInfoValue(
        getProjectInfoValue(project, definition.key),
      )
    } else if (definition.source === 'templateTask' && definition.taskId) {
      const byId = findProjectTaskDate(level1PlanTasks, definition.taskId)
      const byName = level1PlanTasks.find(task => task.taskName === definition.title)?.planEndDate
      row[definition.key] = byId === '-' && typeof byName === 'string' && byName ? byName : byId
    } else if (definition.source === 'system') {
      const aliases: Record<string, string> = {
        spm: 'machineSpm',
        spmDepartment: 'machineSpmDepartment',
      }
      const key = aliases[definition.key] ?? definition.key
      const raw = project[definition.key] ?? getProjectInfoValue(project, key)
      const formatted = raw === undefined || raw === null || raw === ''
        ? '-'
        : formatProjectInfoValue(raw as never)
      row[definition.key] = ['firstSaleTosVersion', 'currentTosVersion', 'tosVersion'].includes(definition.key)
        && formatted !== '-' && !String(formatted).toLowerCase().startsWith('tos')
        ? `tOS${formatted}`
        : formatted
    }
  })

  return row
}

export function buildProjectSummaryColumns(
  definitions: readonly ProjectSummaryFieldDefinition[],
) {
  return definitions.map(definition => ({
    title: definition.title,
    dataIndex: definition.key,
    key: definition.key,
    width: definition.width,
    fixed: definition.key === 'projectName' ? 'left' as const : undefined,
    ellipsis: true,
    className: definition.source === 'templateTask' ? 'pms-project-list-milestone-cell' : undefined,
    onHeaderCell: () => ({
      style: definition.group ? { background: definition.group.color } : undefined,
    }),
    onCell: (record: ProjectSummaryRow) => ({
      className: isOverdueProjectListDate(record[definition.key])
        ? 'pms-project-list-overdue'
        : '',
    }),
  }))
}
