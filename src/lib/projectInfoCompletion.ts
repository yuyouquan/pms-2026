import { validateFanTrial } from '@/lib/fanTrial'
import { isMachineProjectType } from '@/constants/projectTypes'
import { getProjectInfoCreateFields } from '@/lib/projectInfoRules'
import { buildProjectInfoValues, getProjectInfoValue, type ProjectInfoProject } from '@/lib/projectInfoValues'
import { getProjectResponsiblePersons } from '@/lib/projectResponsibility'
import { getProjectAttribute, isFormalProject } from '@/types/projectRegistry'
import type { ProjectInfoValues, ProjectItem } from '@/types/app'
import type { WorkbenchTodo } from '@/lib/todoAggregation'

export interface MissingProjectInfoField { key: string; label: string }

// These are the required inputs of the former planned-project creation form.
const ROADMAP_REQUIRED_FIELDS: MissingProjectInfoField[] = [
  { key: 'secondaryCategory', label: '项目二级分类' },
  { key: 'androidVersion', label: '安卓版本' },
  { key: 'productType', label: '产品类型' },
  { key: 'firstSaleTosVersion', label: 'tOS 版本' },
  { key: 'brand', label: '品牌' },
  { key: 'productLine', label: '产品线' },
  { key: 'productSeries', label: '产品系列' },
  { key: 'marketName', label: '市场名' },
  { key: 'chipCode', label: '芯片编码' },
  { key: 'startingRam', label: '起步 RAM' },
  { key: 'versionType', label: '版本类型' },
  { key: 'developmentMode', label: '开发模式' },
  { key: 'str5Date', label: 'STR5 时间' },
  { key: 'launchDate', label: '上市时间' },
]

const isMissing = (value: unknown): boolean => (
  value == null || (typeof value === 'string' && !value.trim())
  || (Array.isArray(value) && !value.some(item => !isMissing(item)))
)

/** Read saved values, including legacy aliases; never count defaults from an unsaved form. */
export function getMissingProjectInfoFields(project: ProjectItem): MissingProjectInfoField[] {
  const fields: Array<MissingProjectInfoField & { visibleWhen?: (values: ProjectInfoValues) => boolean }> = getProjectAttribute(project) === 'roadmap'
    ? ROADMAP_REQUIRED_FIELDS
    : getProjectInfoCreateFields(project.type).filter(field => (
        field.requiredOnCreate && (!field.readOnly || (!isFormalProject(project) && field.key === 'memorySize'))
      ))
  const source = project as unknown as ProjectInfoProject
  // Conditional requirements can depend on a legacy root field (e.g. developMode).
  const values = buildProjectInfoValues(source, getProjectInfoCreateFields(project.type).map(field => field.key))
  const missing = fields.filter(field => (
    (!field.visibleWhen || field.visibleWhen(values))
    && isMissing(getProjectInfoValue(source, field.key))
  )).map(({ key, label }) => ({ key, label }))
  const fanTrialError = isMachineProjectType(project.type) ? validateFanTrial(values) : null
  if (fanTrialError && !missing.some(field => field.key === fanTrialError.fieldKey)) missing.push({ key: fanTrialError.fieldKey, label: fanTrialError.fieldKey === 'fanTrialEnabled' ? '是否粉丝试用' : '粉丝试用国家及试用台数' })
  return missing
}

export function buildProjectInfoTodos({ projects, currentUser, canEditProjectInfo }: {
  projects: readonly ProjectItem[]
  currentUser: string
  canEditProjectInfo: (projectId: string) => boolean
}): WorkbenchTodo[] {
  const user = currentUser.trim()
  if (!user) return []
  return projects.flatMap(project => {
    if (!getProjectResponsiblePersons(project).some(owner => owner.trim() === user) || !canEditProjectInfo(project.id)) return []
    const missing = getMissingProjectInfoFields(project)
    if (!missing.length) return []
    return [{
      id: `basic-info:${project.id}`, source: 'basicInfo', title: '补全项目基础信息',
      projectId: project.id, projectName: project.name, assignee: user,
      generatedAt: project.createdAt?.slice(0, 10) || '', dueDate: '', status: 'pending',
      nodeLabel: '基础信息', taskContent: `待填写：${missing.map(field => field.label).join('、')}`,
      route: { kind: 'basicInfo' },
    }]
  })
}
