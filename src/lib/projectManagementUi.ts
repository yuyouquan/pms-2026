import { sameManualInfoValue } from '@/lib/manualProjectCompletion'
import type { ProjectItem } from '@/types/app'
import {
  MACHINE_PROJECT_INFO_FIELDS,
  MACHINE_PROJECT_SPACE_CORE_FIELDS,
  TECHNICAL_PROJECT_INFO_FIELDS,
  TECHNICAL_PROJECT_SPACE_CORE_FIELDS,
  TOS_PROJECT_INFO_FIELDS,
} from '@/constants/projectInfoSchema'
import {
  PROJECT_ATTRIBUTE_LABELS,
  isFormalProject,
  type ProjectRegistryHistoryEntry,
} from '@/types/projectRegistry'

export function filterFormalRegistryProjects<T extends ProjectItem>(projects: readonly T[]): T[] {
  return projects.filter(isFormalProject)
}

export function normalizeConfigurationCellValue(value: string | null | undefined): string {
  return value?.trim() ?? ''
}

export function shouldConfirmConfigurationChange(
  before: string | null | undefined,
  after: string | null | undefined,
): boolean {
  return normalizeConfigurationCellValue(before) !== normalizeConfigurationCellValue(after)
}

export interface ProjectRegistryHistoryRow {
  key: string
  action: string
  actor: string
  timestamp: string
  field: string
  before: string
  after: string
}

const ACTION_LABELS = {
  create: '创建', update: '修改', bind: '绑定', rebind: '改绑', unbind: '解绑', delete: '删除',
}

const FIELD_LABELS = new Map<string, string>([
  ['name', '项目名称'], ['type', '项目类型'], ['projectAttribute', '项目属性'],
  ['projectCode', '项目编码'], ['createdBy', '创建人'], ['createdAt', '创建时间'],
  ['responsiblePersons', '责任人'], ['boundFormalProjectId', '绑定正式项目'],
  ['planStartDate', '计划开始时间'], ['planEndDate', '计划结束时间'],
  ['str5Date', 'STR5时间'], ['launchDate', '上市时间'], ['str5Estimated', 'STR5为预估时间'], ['launchEstimated', '上市为预估时间'], ['remark', '备注'],
  ['firstSaleTosVersionId', '首销tOS版本'], ['tosVersionName', '首销tOS版本'], ['currentTosVersionId', '当前tOS版本'], ['startRam', '起步RAM'], ['developMode', '开发模式'],
  ['machineTeamRoles', '整机团队'], ['tosTeamRoles', 'tOS团队'],
  ['leader', '项目负责人'], ['spm', 'SPM'], ['technicalLead', '技术项目负责人'],
  ...[
    ...MACHINE_PROJECT_INFO_FIELDS,
    ...MACHINE_PROJECT_SPACE_CORE_FIELDS,
    ...TOS_PROJECT_INFO_FIELDS,
    ...TECHNICAL_PROJECT_INFO_FIELDS,
    ...TECHNICAL_PROJECT_SPACE_CORE_FIELDS,
  ].map(field => [field.key, field.label] as [string, string]),
  ['projectDescription', '项目描述'],
])

function readableValue(value: unknown, projects: readonly Pick<ProjectItem, 'id' | 'name'>[], field: string): string {
  if (value == null || value === '') return '—'
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (field === 'projectAttribute' && typeof value === 'string' && value in PROJECT_ATTRIBUTE_LABELS) {
    return PROJECT_ATTRIBUTE_LABELS[value as keyof typeof PROJECT_ATTRIBUTE_LABELS]
  }
  if (field === 'boundFormalProjectId' && typeof value === 'string') {
    return projects.find(project => project.id === value)?.name ?? '已删除的正式项目'
  }
  if (Array.isArray(value)) return value.map(item => typeof item === 'object' ? '已配置' : String(item)).join('、') || '—'
  if (typeof value === 'object') return Object.keys(value as object).length ? '已配置' : '—'
  return String(value)
}

function snapshotSummary(project: ProjectItem | null, projects: readonly Pick<ProjectItem, 'id' | 'name'>[]): string {
  if (!project) return '—'
  const details = [
    `名称：${project.name}`,
    `类型：${project.type}`,
    `属性：${PROJECT_ATTRIBUTE_LABELS[project.projectAttribute ?? 'formal']}`,
    `编码：${project.projectCode?.trim() || '—'}`,
    `责任人：${project.responsiblePersons?.join('、') || project.leader || '—'}`,
    `创建人：${project.createdBy || '—'}`,
    `创建时间：${project.createdAt ? new Date(project.createdAt).toLocaleString('zh-CN', { hour12: false }) : '—'}`,
  ]
  if (project.boundFormalProjectId) {
    details.push(`绑定正式项目：${readableValue(project.boundFormalProjectId, projects, 'boundFormalProjectId')}`)
  }
  return details.join('；')
}

function changedNestedFields(before: unknown, after: unknown): Array<{ field: string; before: unknown; after: unknown }> {
  const previous = before && typeof before === 'object' && !Array.isArray(before) ? before as Record<string, unknown> : {}
  const next = after && typeof after === 'object' && !Array.isArray(after) ? after as Record<string, unknown> : {}
  return [...new Set([...Object.keys(previous), ...Object.keys(next)])]
    .filter(field => JSON.stringify(previous[field]) !== JSON.stringify(next[field]))
    .map(field => ({ field, before: previous[field], after: next[field] }))
}

export function buildProjectRegistryHistoryRows(
  entries: readonly ProjectRegistryHistoryEntry[],
  projects: readonly Pick<ProjectItem, 'id' | 'name'>[],
): ProjectRegistryHistoryRow[] {
  return [...entries].sort((left, right) => right.timestamp.localeCompare(left.timestamp)).flatMap(entry => {
    if (entry.action === 'create' || entry.action === 'delete') {
      return [{
        key: entry.id,
        action: ACTION_LABELS[entry.action],
        actor: entry.actor,
        timestamp: entry.timestamp,
        field: '项目档案',
        before: snapshotSummary(entry.before, projects),
        after: snapshotSummary(entry.after, projects),
      }]
    }
    const displayed = new Set<string>()
    return entry.changes.flatMap((change, index) => {
      if (change.field === 'updatedAt' || change.field === 'machineBudgetMetadataAuthority') return []
      const changes = change.field === 'fieldValues'
        ? changedNestedFields(change.before, change.after)
        : [change]
      return changes.filter(item => !sameManualInfoValue(item.before, item.after)).map((item, nestedIndex) => ({
        key: `${entry.id}-${index}-${nestedIndex}`,
        action: ACTION_LABELS[entry.action],
        actor: entry.actor,
        timestamp: entry.timestamp,
        field: FIELD_LABELS.get(item.field) ?? '项目资料',
        before: readableValue(item.before, projects, item.field),
        after: readableValue(item.after, projects, item.field),
      })).filter(row => {
        const key = `${row.field}|${row.before}|${row.after}`
        if (displayed.has(key)) return false
        displayed.add(key)
        return true
      })
    })
  })
}
