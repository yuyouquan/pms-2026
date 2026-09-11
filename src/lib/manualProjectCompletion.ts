import { mergeProjectInfoValues, type ProjectInfoProject } from '@/lib/projectInfoValues'
import { TECHNICAL_STRING_FIELD_KEYS } from '@/constants/technicalProject'
import { isMachineProjectType, MACHINE_PROJECT_TYPES } from '@/constants/projectTypes'
import { normalizeTosSnapshot } from '@/lib/enumConsumers'
import { isExactIsoDate } from '@/lib/roadmapValidation'
import { validateJiraProjectRows } from '@/lib/jiraProject'
import type { ProjectInfoValues, ProjectItem } from '@/types/app'
import type { EnumRowsByType } from '@/types/enums'

/** Minimal manual records accept partial completion; present changed values must be valid. */
export function validateManualProjectCompletion(candidate: ProjectItem, previous: ProjectItem, rows: EnumRowsByType): string | null {
  for (const key of ['str5Date', 'launchDate', 'planStartDate', 'planEndDate'] as const) {
    if (candidate[key] && candidate[key] !== previous[key] && !isExactIsoDate(candidate[key])) return '日期格式必须为 YYYY-MM-DD'
  }
  if (candidate.str5Date && candidate.launchDate && candidate.str5Date > candidate.launchDate) return 'STR5 不能晚于上市时间'
  if (validateJiraProjectRows(candidate.fieldValues?.jiraProjects).length) return 'JIRA 项目配置无效'
  if (candidate.type === '技术项目') {
    const year = candidate.fieldValues?.projectYear ?? (candidate as unknown as Record<string, unknown>).projectYear
    const previousYear = previous.fieldValues?.projectYear ?? (previous as unknown as Record<string, unknown>).projectYear
    if (year && year !== previousYear && !/^\d{4}$/.test(String(year))) return '项目年份必须为四位数字'
  }
  if (!isMachineProjectType(candidate.type)) return null
  for (const [key, values] of [
    ['secondaryCategory', MACHINE_PROJECT_TYPES], ['productType', ['新品', '老品']],
    ['androidVersion', ['Android 16', 'Android 17', 'Android 18']],
    ['brand', ['示例品牌A', '示例品牌B', '示例品牌C', '待定', '其他品牌']],
    ['versionType', rows['version-type'].map(row => row.value)],
    ['developMode', rows['machine-development-mode'].map(row => row.value)],
  ] as const) {
    const value = candidate[key]
    if (value && value !== previous[key] && !(values as readonly string[]).includes(value)) return `${({ secondaryCategory: '项目二级分类', productType: '产品类型', androidVersion: '安卓版本', brand: '品牌', versionType: '版本类型', developMode: '开发模式' })[key]}取值无效`
  }
  for (const key of ['firstSaleTosVersionId', 'firstSaleTosVersion', 'currentTosVersionId', 'currentTosVersion'] as const) {
    const value = normalizeTosSnapshot(candidate[key])
    if (value && value !== normalizeTosSnapshot(previous[key]) && !rows['first-sale-tos'].some(row => normalizeTosSnapshot(row.value) === value)) return '请选择有效的 tOS 版本'
  }
  const chip = candidate.fieldValues?.chipCode
  if (chip && chip !== previous.fieldValues?.chipCode && !rows['chip-mapping'].some(row => row.chipCode === chip)) return '请选择有效的芯片编码'
  return null
}

/** Treat absent form controls as empty without converting stored optional fields. */
export function sameManualInfoValue(left: unknown, right: unknown): boolean {
  const normalize = (value: unknown): unknown => {
    if (value == null || value === '') return null
    if (Array.isArray(value)) return value.length ? value.map(normalize) : null
    if (typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, normalize(item)] as const).filter(([, item]) => item !== null).sort(([a], [b]) => a.localeCompare(b))
      return entries.length ? Object.fromEntries(entries) : null
    }
    return value
  }
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right))
}

export function changedManualInfoValues(values: ProjectInfoValues, initial: ProjectInfoValues): ProjectInfoValues {
  return Object.fromEntries(Object.entries(values).filter(([key, value]) => !sameManualInfoValue(value, initial[key])))
}

export function buildManualProjectSpaceUpdate(project: ProjectItem, input: {
  infoValues: ProjectInfoValues
  responsiblePersons: string[]
  healthStatus: string
  projectStatus: string
  projectSecondaryCategory: string
}): ProjectItem {
  const { infoValues } = input
  const merged = mergeProjectInfoValues(project as unknown as ProjectInfoProject, infoValues) as unknown as ProjectItem
  for (const key of ['machineTeamRoles', 'tosTeamRoles'] as const) {
    const prefix = key === 'machineTeamRoles' ? 'machine' : 'tos'
    if (!Object.keys(infoValues).some(field => field.startsWith(prefix))) {
      if (project.fieldValues?.[key] === undefined) delete merged.fieldValues?.[key]
      else merged.fieldValues![key] = project.fieldValues[key]
    }
  }
  if (!Object.hasOwn(infoValues, 'developmentMode')) {
    for (const key of ['isTwoStage', 'isOutsourcedMini'] as const) {
      if (!Object.hasOwn(infoValues, key)) {
        if (Object.hasOwn(project, key)) (merged as unknown as Record<string, unknown>)[key] = (project as unknown as Record<string, unknown>)[key]
        if (project.fieldValues?.[key] !== undefined) merged.fieldValues![key] = project.fieldValues[key]
      }
    }
  }
  if (project.fieldValues === undefined && !Object.keys(merged.fieldValues || {}).length) delete merged.fieldValues
  const aliases: Record<string, string> = { startingRam: 'startRam', developmentMode: 'developMode', firstSaleTosVersion: 'firstSaleTosVersionId', currentTosVersion: 'currentTosVersionId' }
  for (const [key, value] of Object.entries(infoValues)) {
    if (['brand', 'productLine', 'marketName', 'androidVersion', 'productType', 'str5Date', 'launchDate', 'str5Estimated', 'launchEstimated', 'remark', 'technicalLead', 'tosVersion', 'projectDescription'].includes(key) || (project.type === '技术项目' && (TECHNICAL_STRING_FIELD_KEYS as readonly string[]).includes(key)) || aliases[key]) {
      ;(merged as unknown as Record<string, unknown>)[aliases[key] || key] = value
    }
  }
  if (!sameManualInfoValue(input.responsiblePersons, project.responsiblePersons)) {
    merged.responsiblePersons = input.responsiblePersons
    merged.leader = input.responsiblePersons[0] || ''
  }
  if (!sameManualInfoValue(input.projectSecondaryCategory, project.secondaryCategory)) merged.secondaryCategory = input.projectSecondaryCategory
  merged.status = input.projectStatus
  const healthLabels: Record<string, string> = { normal: '正常', attention: '关注', risk: '风险' }
  if (input.healthStatus !== (healthLabels[project.healthStatus] || project.healthStatus)) merged.healthStatus = input.healthStatus
  // Ordinary space edits never synthesize identity from a model or source fallback.
  for (const key of ['name','type','projectCode','sourceBid','projectAttribute','boundFormalProjectId','createdBy','createdAt'] as const) {
    if (Object.hasOwn(project, key)) (merged as unknown as Record<string, unknown>)[key] = project[key]
    else delete (merged as unknown as Record<string, unknown>)[key]
  }
  return merged
}

export function resolveManualCompletionResponsibility(type: string, changes: ProjectInfoValues, formResponsible: string[], initialResponsible: string[], previousResponsible: string[]): string[] {
  const field = isMachineProjectType(type) ? 'machineSpm' : type === 'tOS版本项目' ? 'tosVersionProjectManager' : type === '技术项目' ? 'technicalLead' : null
  if (!field) return sameManualInfoValue(formResponsible, initialResponsible) ? previousResponsible : formResponsible
  if (!Object.hasOwn(changes, field)) return previousResponsible
  const value = changes[field]
  return [...new Set((Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[、,]/) : []).filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean))]
}
