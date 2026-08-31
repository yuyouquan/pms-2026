import {
  MACHINE_PROJECT_TYPES,
  LEGACY_PROJECT_TYPE_MACHINE,
  PROJECT_TYPE_TOS_VERSION,
  isMachineProjectType,
  type ProjectTypeName,
} from '@/constants/projectTypes'
import type { ProjectInfoValues } from '@/types/app'
import { PROJECT_CATEGORY_TECH } from '@/constants/projectTypes'
import {
  TECHNICAL_DELIVERABLE_FIELDS,
  TECHNICAL_TEAM_FIELDS,
} from '@/constants/technicalProject'
import type { TechnicalDeliverableKey, TechnicalTeam } from '@/types/technicalProject'

export type ProjectInfoGroupKey = 'basic' | 'extended' | 'team'

export type ProjectInfoInputType =
  | 'text'
  | 'link'
  | 'select'
  | 'multiSelect'
  | 'person'
  | 'people'
  | 'date'
  | 'boolean'
  | 'jira'
  | 'textarea'
  | 'deliverable'

export interface ProjectInfoFieldDefinition {
  key: string
  label: string
  group: ProjectInfoGroupKey
  inputType: ProjectInfoInputType
  required: boolean
  requiredOnCreate: boolean
  defaultVisible: boolean
  hideable: boolean
  readOnly?: boolean
  options?: readonly string[]
  placeholder?: string
  visibleWhen?: (values: ProjectInfoValues) => boolean
  conditionalHint?: string
  /** Omitted fields belong to the original, unversioned schema. */
  introducedInSchemaVersion?: number
}

export type ProjectSurfaceFieldDefinition = Pick<
  ProjectInfoFieldDefinition,
  'key' | 'label' | 'defaultVisible' | 'hideable' | 'introducedInSchemaVersion'
>

type ProjectInfoFieldConfig = Omit<ProjectInfoFieldDefinition, 'required'> & {
  required?: boolean
}

export interface ProjectInfoGroupDefinition {
  key: ProjectInfoGroupKey
  label: string
}

export const PROJECT_INFO_SCHEMA_VERSION = 3
export const LEGACY_PROJECT_INFO_SCHEMA_VERSION = 0

const yesNo = ['是', '否'] as const
const defineFields = (
  fields: ProjectInfoFieldConfig[],
  requiredByDefault = false,
): ProjectInfoFieldDefinition[] => fields.map(field => ({
  required: requiredByDefault,
  ...field,
}))

export const isExternalMachineDevelopment = (values: ProjectInfoValues) => {
  const researchMode = String(values.researchMode || '')
  const developmentMode = String(values.developmentMode || '')
  return researchMode.includes('外研') || developmentMode.toUpperCase().includes('ODC')
}

export const MACHINE_PROJECT_INFO_GROUPS: ProjectInfoGroupDefinition[] = [
  { key: 'basic', label: '基础信息' },
  { key: 'extended', label: '扩展信息' },
  { key: 'team', label: '团队信息' },
]

export const TOS_PROJECT_INFO_GROUPS: ProjectInfoGroupDefinition[] = [
  { key: 'basic', label: '基础信息' },
  { key: 'team', label: '团队信息' },
]

export const MACHINE_PROJECT_INFO_FIELDS: ProjectInfoFieldDefinition[] = defineFields([
  { key: 'currentTosVersion', label: '当前tOS版本', group: 'basic', inputType: 'select', required: true, requiredOnCreate: false, defaultVisible: true, hideable: false },
  { key: 'versionType', label: '版本类型', group: 'basic', inputType: 'select', required: true, requiredOnCreate: true, defaultVisible: true, hideable: false },
  { key: 'softwareProjectLevel', label: '软件项目等级', group: 'basic', inputType: 'select', required: true, requiredOnCreate: true, defaultVisible: true, hideable: false },
  { key: 'isFirstLaunchProject', label: '是否首发项目', group: 'basic', inputType: 'boolean', required: true, requiredOnCreate: true, defaultVisible: true, hideable: false, options: yesNo },
  { key: 'productSeries', label: '产品系列', group: 'basic', inputType: 'select', required: true, requiredOnCreate: true, defaultVisible: true, hideable: false },
  { key: 'researchMode', label: '研发模式', group: 'basic', inputType: 'text', requiredOnCreate: false, defaultVisible: true, hideable: false, readOnly: true },
  { key: 'developmentMode', label: '开发模式', group: 'basic', inputType: 'select', required: true, requiredOnCreate: true, defaultVisible: true, hideable: false, placeholder: '请选择或输入开发模式' },
  { key: 'dimensionUpgradeStrategy', label: '升级策略', group: 'basic', inputType: 'select', requiredOnCreate: false, defaultVisible: true, hideable: false },
  { key: 'systemType', label: '系统类型', group: 'basic', inputType: 'select', required: true, requiredOnCreate: true, defaultVisible: true, hideable: false },
  { key: 'kernelVersion', label: 'Kernel版本', group: 'basic', inputType: 'select', required: true, requiredOnCreate: true, defaultVisible: true, hideable: false, placeholder: '请选择或输入 Kernel 版本' },
  { key: 'androidMajorUpgrade', label: '是否大版本升级', group: 'basic', inputType: 'boolean', requiredOnCreate: false, defaultVisible: true, hideable: false, readOnly: true, options: yesNo },
  { key: 'modelCategory', label: '机型分类', group: 'basic', inputType: 'text', requiredOnCreate: false, defaultVisible: true, hideable: false, readOnly: true },
  { key: 'productionForbiddenDate', label: '禁止生产时间', group: 'basic', inputType: 'date', requiredOnCreate: false, defaultVisible: true, hideable: false, readOnly: true },
  { key: 'confidentialityLevel', label: '保密级别', group: 'basic', inputType: 'text', requiredOnCreate: false, defaultVisible: true, hideable: false, readOnly: true },
  { key: 'projectModel', label: '项目名', group: 'basic', inputType: 'text', requiredOnCreate: false, defaultVisible: false, hideable: true, readOnly: true },
  { key: 'androidVersion', label: '安卓版本', group: 'basic', inputType: 'text', requiredOnCreate: false, defaultVisible: false, hideable: true, readOnly: true },
  { key: 'mainboardName', label: '主板名', group: 'basic', inputType: 'text', requiredOnCreate: false, defaultVisible: false, hideable: true, readOnly: true },
  { key: 'productType', label: '产品类型', group: 'basic', inputType: 'text', requiredOnCreate: false, defaultVisible: false, hideable: true, readOnly: true },

  { key: 'chipCode', label: '芯片编码', group: 'extended', inputType: 'select', required: true, requiredOnCreate: true, defaultVisible: true, hideable: false },
  { key: 'chipModel', label: '芯片型号', group: 'extended', inputType: 'text', required: true, requiredOnCreate: false, defaultVisible: true, hideable: false, readOnly: true },
  { key: 'chipPlatform', label: '芯片平台', group: 'extended', inputType: 'text', required: true, requiredOnCreate: false, defaultVisible: true, hideable: false, readOnly: true },
  { key: 'memorySize', label: '内存大小', group: 'extended', inputType: 'text', required: true, requiredOnCreate: true, defaultVisible: true, hideable: false, readOnly: true },
  { key: 'startingRam', label: '起步RAM', group: 'extended', inputType: 'text', requiredOnCreate: false, defaultVisible: true, hideable: false, readOnly: true },
  { key: 'isTwoStage', label: '是否二段式', group: 'extended', inputType: 'boolean', required: true, requiredOnCreate: true, defaultVisible: true, hideable: false, options: yesNo, visibleWhen: isExternalMachineDevelopment, conditionalHint: '外研或 ODC 项目时显示' },
  { key: 'isOutsourcedMini', label: '是否外研Mini版本', group: 'extended', inputType: 'boolean', requiredOnCreate: false, defaultVisible: true, hideable: false, options: yesNo, visibleWhen: isExternalMachineDevelopment, conditionalHint: '外研或 ODC 项目时显示' },
  { key: 'jiraProjects', label: 'JIRA项目', group: 'extended', inputType: 'jira', requiredOnCreate: false, defaultVisible: true, hideable: false },
  { key: 'baselineName', label: '基线名称', group: 'extended', inputType: 'text', requiredOnCreate: false, defaultVisible: false, hideable: true, readOnly: true },
  { key: 'wholeMachinePd', label: '整机PD', group: 'extended', inputType: 'link', requiredOnCreate: false, defaultVisible: false, hideable: true, placeholder: '请输入链接或 Excel 文件地址' },
  { key: 'pcbaSheet', label: 'PCBA表', group: 'extended', inputType: 'link', requiredOnCreate: false, defaultVisible: false, hideable: true, placeholder: '请输入链接或 Excel 文件地址' },
  { key: 'shippingCountrySheet', label: '出货国家表', group: 'extended', inputType: 'link', requiredOnCreate: false, defaultVisible: false, hideable: true, placeholder: '请输入链接或 Excel 文件地址' },
  { key: 'keyComponentsSheet', label: '关键器件选型表', group: 'extended', inputType: 'link', requiredOnCreate: false, defaultVisible: false, hideable: true, placeholder: '请输入链接或 Excel 文件地址' },

  { key: 'machineSpm', label: 'SPM', group: 'team', inputType: 'people', required: true, requiredOnCreate: true, defaultVisible: true, hideable: false },
  { key: 'machineSpp', label: 'SPP', group: 'team', inputType: 'people', requiredOnCreate: false, defaultVisible: true, hideable: false },
  { key: 'machineCmo', label: 'CMO', group: 'team', inputType: 'people', requiredOnCreate: false, defaultVisible: true, hideable: false },
  { key: 'machineSoftwareSe', label: '软件SE', group: 'team', inputType: 'people', requiredOnCreate: false, defaultVisible: true, hideable: false },
  { key: 'machineQualityRepresentative', label: '质量代表', group: 'team', inputType: 'people', requiredOnCreate: false, defaultVisible: true, hideable: false, introducedInSchemaVersion: 3 },
  { key: 'machineDevelopmentRepresentative', label: '开发代表', group: 'team', inputType: 'people', requiredOnCreate: false, defaultVisible: true, hideable: false },
  { key: 'machineTestRepresentative', label: '测试代表', group: 'team', inputType: 'people', requiredOnCreate: false, defaultVisible: true, hideable: false },
  { key: 'machineOther', label: '其他', group: 'team', inputType: 'people', requiredOnCreate: false, defaultVisible: true, hideable: false, introducedInSchemaVersion: 3 },
])

const pickOrderedFields = <T extends { key: string }>(
  keys: readonly string[],
  definitions: readonly T[],
): T[] => {
  const definitionsByKey = new Map(definitions.map(field => [field.key, field]))
  return keys.map(key => {
    const field = definitionsByKey.get(key)
    if (!field) throw new Error(`Missing project field definition: ${key}`)
    return field
  })
}

const MACHINE_PROJECT_CREATE_ONLY_FIELDS = defineFields([
  { key: 'firstSaleTosVersion', label: '首销tOS版本', group: 'basic', inputType: 'select', required: true, requiredOnCreate: true, defaultVisible: true, hideable: false },
  { key: 'status', label: '项目状态', group: 'basic', inputType: 'select', required: true, requiredOnCreate: true, defaultVisible: true, hideable: false },
])

export const MACHINE_PROJECT_CREATE_FIELD_KEYS = [
  'firstSaleTosVersion', 'status', 'versionType', 'softwareProjectLevel',
  'isFirstLaunchProject', 'productSeries', 'researchMode', 'developmentMode',
  'dimensionUpgradeStrategy', 'systemType', 'kernelVersion', 'androidMajorUpgrade',
  'modelCategory', 'confidentialityLevel', 'chipCode', 'chipModel', 'chipPlatform',
  'memorySize', 'startingRam', 'isTwoStage', 'isOutsourcedMini', 'wholeMachinePd',
  'pcbaSheet', 'shippingCountrySheet', 'keyComponentsSheet', 'jiraProjects',
  'machineSpm', 'machineSpp', 'machineCmo', 'machineSoftwareSe',
  'machineQualityRepresentative', 'machineDevelopmentRepresentative',
  'machineTestRepresentative', 'machineOther',
] as const

export const MACHINE_PROJECT_CREATE_FIELDS = pickOrderedFields(
  MACHINE_PROJECT_CREATE_FIELD_KEYS,
  [...MACHINE_PROJECT_CREATE_ONLY_FIELDS, ...MACHINE_PROJECT_INFO_FIELDS],
)

export const MACHINE_PROJECT_SPACE_CORE_FIELDS: ProjectSurfaceFieldDefinition[] = [
  { key: 'brand', label: '品牌', defaultVisible: true, hideable: false },
  { key: 'productLine', label: '产品线', defaultVisible: true, hideable: false },
  { key: 'marketName', label: '市场名', defaultVisible: true, hideable: false },
  { key: 'firstSaleTosVersion', label: '首销tOS版本', defaultVisible: true, hideable: false },
  { key: 'status', label: '项目状态', defaultVisible: true, hideable: false },
  { key: 'healthStatus', label: '健康状态', defaultVisible: true, hideable: false },
  { key: 'currentNode', label: '下一个节点', defaultVisible: true, hideable: false },
]

export const MACHINE_PROJECT_SPACE_CORE_FIELD_KEYS = [
  'brand', 'productLine', 'marketName', 'firstSaleTosVersion', 'status',
  'healthStatus', 'currentNode',
] as const

export const MACHINE_PROJECT_SPACE_INFO_FIELD_KEYS = [
  'currentTosVersion', 'versionType', 'softwareProjectLevel', 'isFirstLaunchProject',
  'productSeries', 'researchMode', 'developmentMode', 'dimensionUpgradeStrategy',
  'systemType', 'kernelVersion', 'androidMajorUpgrade', 'modelCategory',
  'productionForbiddenDate', 'confidentialityLevel', 'projectModel', 'androidVersion',
  'mainboardName', 'productType', 'chipCode', 'chipModel', 'chipPlatform',
  'memorySize', 'startingRam', 'isTwoStage', 'isOutsourcedMini', 'jiraProjects',
  'baselineName', 'wholeMachinePd', 'pcbaSheet', 'shippingCountrySheet',
  'keyComponentsSheet', 'machineSpm', 'machineSpp', 'machineCmo',
  'machineSoftwareSe', 'machineQualityRepresentative',
  'machineDevelopmentRepresentative', 'machineTestRepresentative', 'machineOther',
] as const

export const MACHINE_PROJECT_SPACE_INFO_FIELDS = pickOrderedFields(
  MACHINE_PROJECT_SPACE_INFO_FIELD_KEYS,
  MACHINE_PROJECT_INFO_FIELDS,
)

export const TOS_PROJECT_INFO_FIELDS: ProjectInfoFieldDefinition[] = defineFields([
  { key: 'tosVersion', label: 'tOS 版本', group: 'basic', inputType: 'text', requiredOnCreate: false, defaultVisible: true, hideable: false, readOnly: true },
  { key: 'firstLaunchProjects', label: '首发项目', group: 'basic', inputType: 'multiSelect', requiredOnCreate: true, defaultVisible: true, hideable: false },
  { key: 'firstLaunchProjectChips', label: '首发项目芯片', group: 'basic', inputType: 'text', requiredOnCreate: true, defaultVisible: true, hideable: false, readOnly: true },
  { key: 'applicableBrands', label: '适用品牌', group: 'basic', inputType: 'text', requiredOnCreate: true, defaultVisible: true, hideable: false, readOnly: true },
  { key: 'applicableProductLines', label: '适用产品线', group: 'basic', inputType: 'text', requiredOnCreate: true, defaultVisible: true, hideable: false, readOnly: true },
  { key: 'applicableChipPlatforms', label: '适用芯片平台', group: 'basic', inputType: 'text', requiredOnCreate: true, defaultVisible: true, hideable: false, readOnly: true },
  { key: 'newProductProjectList', label: '新品项目清单', group: 'basic', inputType: 'text', requiredOnCreate: false, defaultVisible: false, hideable: true, readOnly: true },
  { key: 'legacyProductProjectList', label: '老品项目清单', group: 'basic', inputType: 'text', requiredOnCreate: false, defaultVisible: false, hideable: true, readOnly: true },

  { key: 'tosVersionProjectManager', label: '版本项目经理', group: 'team', inputType: 'people', requiredOnCreate: true, defaultVisible: true, hideable: false },
  { key: 'tosPlanningRepresentative', label: '规划代表', group: 'team', inputType: 'people', requiredOnCreate: true, defaultVisible: true, hideable: false },
  { key: 'tosSe', label: 'SE', group: 'team', inputType: 'people', requiredOnCreate: true, defaultVisible: true, hideable: false },
  { key: 'tosTestRepresentative', label: '测试代表', group: 'team', inputType: 'people', requiredOnCreate: true, defaultVisible: true, hideable: false },
  { key: 'tosSqa', label: 'SQA', group: 'team', inputType: 'people', requiredOnCreate: true, defaultVisible: true, hideable: false },
  { key: 'tosCmo', label: 'CMO', group: 'team', inputType: 'people', requiredOnCreate: true, defaultVisible: true, hideable: false },
  { key: 'tosUx', label: 'UX', group: 'team', inputType: 'people', requiredOnCreate: true, defaultVisible: true, hideable: false },
  { key: 'tosStabilityRepresentative', label: '稳定性代表', group: 'team', inputType: 'people', requiredOnCreate: false, defaultVisible: false, hideable: true },
  { key: 'tosPerformanceRepresentative', label: '性能代表', group: 'team', inputType: 'people', requiredOnCreate: false, defaultVisible: false, hideable: true },
  { key: 'tosPowerRepresentative', label: '功耗代表', group: 'team', inputType: 'people', requiredOnCreate: false, defaultVisible: false, hideable: true },
  { key: 'tosSystemAppDevRepresentative', label: '系统应用开发代表', group: 'team', inputType: 'people', requiredOnCreate: false, defaultVisible: false, hideable: true },
  { key: 'tosBasebandDevRepresentative', label: '底软通信开发代表', group: 'team', inputType: 'people', requiredOnCreate: false, defaultVisible: false, hideable: true },
  { key: 'tosIntegrationDevRepresentative', label: '集成维护开发代表', group: 'team', inputType: 'people', requiredOnCreate: false, defaultVisible: false, hideable: true },
  { key: 'tosArchitectureDevRepresentative', label: '软件架设与技术规划部开发代表', group: 'team', inputType: 'people', requiredOnCreate: false, defaultVisible: false, hideable: true },
  { key: 'tosInnovationDevRepresentative', label: '创新产品开发代表', group: 'team', inputType: 'people', requiredOnCreate: false, defaultVisible: false, hideable: true },
  { key: 'tosTexAiDevRepresentative', label: 'TEX AI 开发代表', group: 'team', inputType: 'people', requiredOnCreate: false, defaultVisible: false, hideable: true },
  { key: 'tosImagingDevRepresentative', label: '影像开发代表', group: 'team', inputType: 'people', requiredOnCreate: false, defaultVisible: false, hideable: true },
  { key: 'tosPreinstallRepresentative', label: '预装管理开发代表', group: 'team', inputType: 'people', requiredOnCreate: false, defaultVisible: false, hideable: true },
  { key: 'tosEcosystemRepresentative', label: '研发战略生态合作部代表', group: 'team', inputType: 'people', requiredOnCreate: false, defaultVisible: false, hideable: true },
], true)

export const TECHNICAL_PROJECT_INFO_GROUPS: ProjectInfoGroupDefinition[] = [
  { key: 'basic', label: '技术信息' },
  { key: 'team', label: '团队人员' },
  { key: 'extended', label: '交付物' },
]

const TECHNICAL_PROJECT_BASIC_INFO_FIELDS = defineFields([
  { key: 'technicalTrack', label: '技术赛道', group: 'basic', inputType: 'text', requiredOnCreate: false, defaultVisible: true, hideable: false, readOnly: true },
  { key: 'tmg', label: 'TMG及技术领域', group: 'basic', inputType: 'select', required: true, requiredOnCreate: true, defaultVisible: true, hideable: false },
  { key: 'subdomain', label: '子领域', group: 'basic', inputType: 'select', required: true, requiredOnCreate: true, defaultVisible: true, hideable: false },
  { key: 'projectValue', label: '项目价值', group: 'basic', inputType: 'textarea', required: true, requiredOnCreate: true, defaultVisible: true, hideable: false },
  { key: 'projectYear', label: '项目年份', group: 'basic', inputType: 'text', required: true, requiredOnCreate: true, defaultVisible: true, hideable: false },
  { key: 'preProjectId', label: '前置项目', group: 'basic', inputType: 'select', requiredOnCreate: false, defaultVisible: true, hideable: false },
])

const TECHNICAL_PROJECT_TEAM_INFO_FIELDS = defineFields(TECHNICAL_TEAM_FIELDS.map(field => ({
  key: field.key,
  label: field.label,
  group: 'team' as const,
  inputType: 'person' as const,
  required: field.required,
  requiredOnCreate: field.required,
  defaultVisible: true,
  hideable: false,
  ...(field.key === 'technicalOther' ? { introducedInSchemaVersion: PROJECT_INFO_SCHEMA_VERSION } : {}),
})))

const TECHNICAL_PROJECT_DELIVERABLE_INFO_FIELDS = defineFields(TECHNICAL_DELIVERABLE_FIELDS.map(field => ({
  key: field.key,
  label: field.label,
  group: 'extended' as const,
  inputType: 'deliverable' as const,
  requiredOnCreate: false,
  defaultVisible: true,
  hideable: false,
})))

export const TECHNICAL_PROJECT_INFO_FIELDS: ProjectInfoFieldDefinition[] = [
  ...TECHNICAL_PROJECT_BASIC_INFO_FIELDS,
  ...TECHNICAL_PROJECT_TEAM_INFO_FIELDS,
  ...TECHNICAL_PROJECT_DELIVERABLE_INFO_FIELDS,
]

const TECHNICAL_PROJECT_CREATE_ONLY_FIELDS = defineFields([
  { key: 'secondaryCategory', label: '项目分类', group: 'basic', inputType: 'text', requiredOnCreate: false, defaultVisible: true, hideable: false, readOnly: true },
  { key: 'projectName', label: '子项目名称', group: 'basic', inputType: 'text', requiredOnCreate: false, defaultVisible: true, hideable: false, readOnly: true },
  { key: 'status', label: '项目状态', group: 'basic', inputType: 'text', requiredOnCreate: false, defaultVisible: true, hideable: false, readOnly: true },
])

type TechnicalProjectCreateFieldKey =
  | 'secondaryCategory'
  | 'technicalTrack'
  | 'projectName'
  | 'status'
  | 'tmg'
  | 'subdomain'
  | 'projectValue'
  | 'projectYear'
  | 'preProjectId'
  | keyof TechnicalTeam
  | TechnicalDeliverableKey

export const TECHNICAL_PROJECT_CREATE_FIELD_KEYS = [
  'secondaryCategory', 'technicalTrack', 'projectName', 'status', 'tmg', 'subdomain',
  'projectValue', 'projectYear', 'preProjectId', 'technicalLead',
  'technicalProjectManager', 'testRepresentative', 'qualityRepresentative',
  'productRepresentative', 'standardizationRepresentative', 'technicalOther',
  'projectKpi', 'conceptDesign', 'charterReport', 'pdcpReport', 'tdcpReport',
  'edcpReport',
] as const satisfies readonly TechnicalProjectCreateFieldKey[]

export const TECHNICAL_PROJECT_CREATE_FIELDS = pickOrderedFields(
  TECHNICAL_PROJECT_CREATE_FIELD_KEYS,
  [...TECHNICAL_PROJECT_CREATE_ONLY_FIELDS, ...TECHNICAL_PROJECT_INFO_FIELDS],
)

export const TECHNICAL_PROJECT_SPACE_CORE_FIELDS: ProjectSurfaceFieldDefinition[] = [
  { key: 'secondaryCategory', label: '项目分类', defaultVisible: true, hideable: false },
  { key: 'technicalTrack', label: '技术赛道', defaultVisible: true, hideable: false },
  { key: 'tmg', label: 'TMG及技术领域', defaultVisible: true, hideable: false },
  { key: 'subdomain', label: '子领域', defaultVisible: true, hideable: false },
  { key: 'status', label: '项目状态', defaultVisible: true, hideable: false },
  { key: 'projectStage', label: '项目阶段', defaultVisible: true, hideable: false },
  { key: 'projectYear', label: '项目年份', defaultVisible: true, hideable: false },
  { key: 'preProjectId', label: '前置项目', defaultVisible: true, hideable: false },
  { key: 'projectValue', label: '项目价值', defaultVisible: true, hideable: false },
]

export const TECHNICAL_PROJECT_SPACE_CORE_FIELD_KEYS = [
  'secondaryCategory', 'technicalTrack', 'tmg', 'subdomain', 'status', 'projectStage',
  'projectYear', 'preProjectId', 'projectValue',
] as const

export const TECHNICAL_PROJECT_SPACE_PLAN_FIELD_KEY = 'technicalPlan' as const
export const TECHNICAL_PROJECT_SPACE_PLAN_FIELD: ProjectSurfaceFieldDefinition = {
  key: TECHNICAL_PROJECT_SPACE_PLAN_FIELD_KEY,
  label: '计划',
  defaultVisible: true,
  hideable: false,
}

export const TECHNICAL_PROJECT_SPACE_BASIC_FIELDS: ProjectSurfaceFieldDefinition[] = [
  { key: 'coreValue', label: '核心价值', defaultVisible: true, hideable: false },
  { key: 'developmentMode', label: '开发模式', defaultVisible: true, hideable: false },
  { key: 'firstTosVersion', label: '首导tOS版本', defaultVisible: true, hideable: false },
  { key: 'firstMachineProjectId', label: '首导整机产品项目', defaultVisible: true, hideable: false },
]

export const TECHNICAL_PROJECT_SPACE_BASIC_FIELD_KEYS = [
  'coreValue', 'developmentMode', 'firstTosVersion', 'firstMachineProjectId',
] as const

const TECHNICAL_PROJECT_SPACE_TEAM_FIELDS = pickOrderedFields(
  TECHNICAL_TEAM_FIELDS.map(field => field.key),
  TECHNICAL_PROJECT_INFO_FIELDS,
)
const TECHNICAL_PROJECT_SPACE_DELIVERABLE_FIELDS = pickOrderedFields(
  TECHNICAL_DELIVERABLE_FIELDS.map(field => field.key),
  TECHNICAL_PROJECT_INFO_FIELDS,
)

export const TECHNICAL_PROJECT_SPACE_FIELDS: ProjectSurfaceFieldDefinition[] = [
  ...TECHNICAL_PROJECT_SPACE_CORE_FIELDS,
  TECHNICAL_PROJECT_SPACE_PLAN_FIELD,
  ...TECHNICAL_PROJECT_SPACE_BASIC_FIELDS,
  ...TECHNICAL_PROJECT_SPACE_TEAM_FIELDS,
  ...TECHNICAL_PROJECT_SPACE_DELIVERABLE_FIELDS,
]

export const TARGET_PROJECT_TYPES = [...MACHINE_PROJECT_TYPES, PROJECT_TYPE_TOS_VERSION] as const

export type TargetProjectInfoType = typeof MACHINE_PROJECT_TYPES[number]
  | typeof LEGACY_PROJECT_TYPE_MACHINE
  | typeof PROJECT_TYPE_TOS_VERSION

export const isTargetProjectInfoType = (type: string | undefined): type is TargetProjectInfoType => (
  isMachineProjectType(type) || type === PROJECT_TYPE_TOS_VERSION
)

export const getProjectInfoFields = (type: string | undefined) => {
  if (isMachineProjectType(type)) return MACHINE_PROJECT_INFO_FIELDS
  if (type === PROJECT_TYPE_TOS_VERSION) return TOS_PROJECT_INFO_FIELDS
  if (type === PROJECT_CATEGORY_TECH) return TECHNICAL_PROJECT_INFO_FIELDS
  return []
}

export const getProjectInfoGroups = (type: string | undefined) => {
  if (isMachineProjectType(type)) return MACHINE_PROJECT_INFO_GROUPS
  if (type === PROJECT_TYPE_TOS_VERSION) return TOS_PROJECT_INFO_GROUPS
  if (type === PROJECT_CATEGORY_TECH) return TECHNICAL_PROJECT_INFO_GROUPS
  return []
}

export const getFieldsForGroup = (type: string | undefined, group: ProjectInfoGroupKey) => (
  getProjectInfoFields(type).filter(field => field.group === group)
)

export const getEffectiveProjectInfoFields = (type: string | undefined, values: ProjectInfoValues) => (
  getProjectInfoFields(type).filter(field => !field.visibleWhen || field.visibleWhen(values))
)

export const isProjectTypeName = (type: string): type is ProjectTypeName => (
  (TARGET_PROJECT_TYPES as readonly string[]).includes(type)
)
