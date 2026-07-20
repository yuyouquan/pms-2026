import {
  PROJECT_TYPE_MACHINE,
  PROJECT_TYPE_TOS_VERSION,
  type ProjectTypeName,
} from '@/constants/projectTypes'
import type { ProjectInfoValues } from '@/types/app'

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

export interface ProjectInfoFieldDefinition {
  key: string
  label: string
  group: ProjectInfoGroupKey
  inputType: ProjectInfoInputType
  requiredOnCreate: boolean
  defaultVisible: boolean
  hideable: boolean
  readOnly?: boolean
  options?: readonly string[]
  placeholder?: string
  visibleWhen?: (values: ProjectInfoValues) => boolean
  conditionalHint?: string
}

export interface ProjectInfoGroupDefinition {
  key: ProjectInfoGroupKey
  label: string
}

const yesNo = ['是', '否'] as const

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

export const MACHINE_PROJECT_INFO_FIELDS: ProjectInfoFieldDefinition[] = [
  // 基础信息（顺序与字段参考文档保持一致）
  { key: 'researchMode', label: '研发模式', group: 'basic', inputType: 'text', requiredOnCreate: false, defaultVisible: true, hideable: false, readOnly: true },
  { key: 'developmentMode', label: '开发模式', group: 'basic', inputType: 'select', requiredOnCreate: true, defaultVisible: true, hideable: false, placeholder: '请选择或输入开发模式' },
  { key: 'firstSaleTosVersion', label: '首销 tOS 版本', group: 'basic', inputType: 'select', requiredOnCreate: true, defaultVisible: true, hideable: false, options: ['tOS17.0', 'tOS17.1', 'tOS17.2'] },
  { key: 'isFirstLaunchProject', label: '是否首发项目', group: 'basic', inputType: 'boolean', requiredOnCreate: true, defaultVisible: true, hideable: false, options: yesNo },
  { key: 'softwareProjectLevel', label: '软件项目等级', group: 'basic', inputType: 'select', requiredOnCreate: true, defaultVisible: true, hideable: false, options: ['A', 'B', 'C'] },
  { key: 'versionType', label: '版本类型', group: 'basic', inputType: 'select', requiredOnCreate: true, defaultVisible: true, hideable: false, options: ['Full', 'Slim', 'Go'] },
  { key: 'dimensionUpgradeStrategy', label: '升维策略', group: 'basic', inputType: 'select', requiredOnCreate: true, defaultVisible: true, hideable: false, options: ['首发版本', '大版本升级', '维护版本'] },
  { key: 'projectModel', label: '项目名', group: 'basic', inputType: 'text', requiredOnCreate: false, defaultVisible: false, hideable: true, readOnly: true },
  { key: 'mainboardName', label: '主板名', group: 'basic', inputType: 'text', requiredOnCreate: false, defaultVisible: false, hideable: true, readOnly: true },
  { key: 'androidMajorUpgrade', label: '是否大版本升级', group: 'basic', inputType: 'boolean', requiredOnCreate: false, defaultVisible: true, hideable: false, readOnly: true, options: yesNo },
  { key: 'productType', label: '产品类型', group: 'basic', inputType: 'text', requiredOnCreate: false, defaultVisible: false, hideable: true, readOnly: true },
  { key: 'targetMarkets', label: '目标市场', group: 'basic', inputType: 'text', requiredOnCreate: false, defaultVisible: false, hideable: true, readOnly: true },
  { key: 'systemType', label: '系统类型', group: 'basic', inputType: 'select', requiredOnCreate: true, defaultVisible: false, hideable: true, options: ['64bit', '64only'] },
  { key: 'kernelVersion', label: 'Kernel 版本', group: 'basic', inputType: 'select', requiredOnCreate: true, defaultVisible: false, hideable: true, placeholder: '请选择或输入 Kernel 版本' },
  { key: 'confidentialityLevel', label: '保密级别', group: 'basic', inputType: 'text', requiredOnCreate: false, defaultVisible: false, hideable: true, readOnly: true },
  { key: 'androidVersion', label: '安卓版本', group: 'basic', inputType: 'text', requiredOnCreate: false, defaultVisible: false, hideable: true, readOnly: true },
  { key: 'productSeries', label: '产品系列', group: 'basic', inputType: 'text', requiredOnCreate: true, defaultVisible: false, hideable: true },
  { key: 'modelCategory', label: '机型分类', group: 'basic', inputType: 'text', requiredOnCreate: false, defaultVisible: true, hideable: false, readOnly: true },
  { key: 'currentTosVersion', label: '当前 tOS 版本', group: 'basic', inputType: 'text', requiredOnCreate: false, defaultVisible: false, hideable: true, readOnly: true },
  { key: 'launchDate', label: '上市时间', group: 'basic', inputType: 'date', requiredOnCreate: false, defaultVisible: false, hideable: true, readOnly: true },
  { key: 'productionForbiddenDate', label: '禁止生产时间', group: 'basic', inputType: 'date', requiredOnCreate: false, defaultVisible: false, hideable: true, readOnly: true },

  // 扩展信息
  { key: 'chipCode', label: '芯片编码', group: 'extended', inputType: 'text', requiredOnCreate: false, defaultVisible: true, hideable: false, readOnly: true },
  { key: 'chipModel', label: '芯片型号', group: 'extended', inputType: 'text', requiredOnCreate: true, defaultVisible: true, hideable: false },
  { key: 'chipPlatform', label: '芯片平台', group: 'extended', inputType: 'select', requiredOnCreate: true, defaultVisible: true, hideable: false, options: ['MTK', 'UNISOC', 'QCOM'] },
  { key: 'memorySize', label: '内存大小', group: 'extended', inputType: 'text', requiredOnCreate: false, defaultVisible: true, hideable: false, readOnly: true },
  { key: 'startingRam', label: '起步 RAM', group: 'extended', inputType: 'text', requiredOnCreate: false, defaultVisible: true, hideable: false },
  { key: 'wholeMachinePd', label: '整机 PD', group: 'extended', inputType: 'link', requiredOnCreate: true, defaultVisible: true, hideable: false, placeholder: '请输入链接或 Excel 文件地址' },
  { key: 'pcbaSheet', label: 'PCBA 表', group: 'extended', inputType: 'link', requiredOnCreate: true, defaultVisible: true, hideable: false, placeholder: '请输入链接或 Excel 文件地址' },
  { key: 'shippingCountrySheet', label: '出货国家表', group: 'extended', inputType: 'link', requiredOnCreate: true, defaultVisible: true, hideable: false, placeholder: '请输入链接或 Excel 文件地址' },
  { key: 'keyComponentsSheet', label: '关键器件选型表', group: 'extended', inputType: 'link', requiredOnCreate: true, defaultVisible: true, hideable: false, placeholder: '请输入链接或 Excel 文件地址' },
  { key: 'isTwoStage', label: '是否二段式', group: 'extended', inputType: 'boolean', requiredOnCreate: true, defaultVisible: false, hideable: true, options: yesNo, visibleWhen: isExternalMachineDevelopment, conditionalHint: '外研或 ODC 项目时显示' },
  { key: 'isOutsourcedMini', label: '是否外研 mini 版本', group: 'extended', inputType: 'boolean', requiredOnCreate: true, defaultVisible: false, hideable: true, options: yesNo, visibleWhen: isExternalMachineDevelopment, conditionalHint: '外研或 ODC 项目时显示' },
  { key: 'baselineName', label: '基线名称', group: 'extended', inputType: 'text', requiredOnCreate: false, defaultVisible: false, hideable: true, readOnly: true },
  { key: 'jiraProjects', label: 'JIRA 项目', group: 'extended', inputType: 'jira', requiredOnCreate: false, defaultVisible: false, hideable: true },

  // 团队信息
  { key: 'machineSpm', label: 'SPM', group: 'team', inputType: 'person', requiredOnCreate: false, defaultVisible: true, hideable: false },
  { key: 'machineSpp', label: 'SPP', group: 'team', inputType: 'person', requiredOnCreate: false, defaultVisible: true, hideable: false },
  { key: 'machineCmo', label: 'CMO', group: 'team', inputType: 'person', requiredOnCreate: false, defaultVisible: true, hideable: false },
  { key: 'machineSoftwareSe', label: '软件 SE', group: 'team', inputType: 'person', requiredOnCreate: false, defaultVisible: true, hideable: false },
  { key: 'machineUx', label: 'UX', group: 'team', inputType: 'person', requiredOnCreate: false, defaultVisible: true, hideable: false },
  { key: 'machineDevelopmentRepresentative', label: '开发代表', group: 'team', inputType: 'person', requiredOnCreate: false, defaultVisible: true, hideable: false },
  { key: 'machineTestRepresentative', label: '测试代表', group: 'team', inputType: 'person', requiredOnCreate: false, defaultVisible: true, hideable: false },
]

export const TOS_PROJECT_INFO_FIELDS: ProjectInfoFieldDefinition[] = [
  { key: 'firstLaunchProjects', label: '首发项目', group: 'basic', inputType: 'multiSelect', requiredOnCreate: true, defaultVisible: true, hideable: false },
  { key: 'firstLaunchProjectChips', label: '首发项目芯片', group: 'basic', inputType: 'text', requiredOnCreate: true, defaultVisible: true, hideable: false, readOnly: true },
  { key: 'applicableBrands', label: '适用品牌', group: 'basic', inputType: 'text', requiredOnCreate: true, defaultVisible: true, hideable: false, readOnly: true },
  { key: 'applicableProductLines', label: '适用产品线', group: 'basic', inputType: 'text', requiredOnCreate: true, defaultVisible: true, hideable: false, readOnly: true },
  { key: 'applicableChipPlatforms', label: '适用芯片平台', group: 'basic', inputType: 'text', requiredOnCreate: true, defaultVisible: true, hideable: false, readOnly: true },
  { key: 'newProductProjectList', label: '新品项目清单', group: 'basic', inputType: 'text', requiredOnCreate: false, defaultVisible: false, hideable: true, readOnly: true },
  { key: 'legacyProductProjectList', label: '老品项目清单', group: 'basic', inputType: 'text', requiredOnCreate: false, defaultVisible: false, hideable: true, readOnly: true },

  { key: 'tosVersionProjectManager', label: '版本项目经理', group: 'team', inputType: 'person', requiredOnCreate: true, defaultVisible: true, hideable: false },
  { key: 'tosPlanningRepresentative', label: '规划代表', group: 'team', inputType: 'person', requiredOnCreate: true, defaultVisible: true, hideable: false },
  { key: 'tosSe', label: 'SE', group: 'team', inputType: 'person', requiredOnCreate: true, defaultVisible: true, hideable: false },
  { key: 'tosTestRepresentative', label: '测试代表', group: 'team', inputType: 'person', requiredOnCreate: true, defaultVisible: true, hideable: false },
  { key: 'tosSqa', label: 'SQA', group: 'team', inputType: 'person', requiredOnCreate: true, defaultVisible: true, hideable: false },
  { key: 'tosCmo', label: 'CMO', group: 'team', inputType: 'person', requiredOnCreate: true, defaultVisible: true, hideable: false },
  { key: 'tosUx', label: 'UX', group: 'team', inputType: 'person', requiredOnCreate: true, defaultVisible: true, hideable: false },
  { key: 'tosStabilityRepresentative', label: '稳定性代表', group: 'team', inputType: 'person', requiredOnCreate: true, defaultVisible: false, hideable: true },
  { key: 'tosPerformanceRepresentative', label: '性能代表', group: 'team', inputType: 'person', requiredOnCreate: true, defaultVisible: false, hideable: true },
  { key: 'tosPowerRepresentative', label: '功耗代表', group: 'team', inputType: 'person', requiredOnCreate: true, defaultVisible: false, hideable: true },
  { key: 'tosSystemAppDevRepresentative', label: '系统应用开发代表', group: 'team', inputType: 'person', requiredOnCreate: true, defaultVisible: false, hideable: true },
  { key: 'tosBasebandDevRepresentative', label: '底软通信开发代表', group: 'team', inputType: 'person', requiredOnCreate: true, defaultVisible: false, hideable: true },
  { key: 'tosIntegrationDevRepresentative', label: '集成维护开发代表', group: 'team', inputType: 'person', requiredOnCreate: true, defaultVisible: false, hideable: true },
  { key: 'tosArchitectureDevRepresentative', label: '软件架设与技术规划部开发代表', group: 'team', inputType: 'person', requiredOnCreate: true, defaultVisible: false, hideable: true },
  { key: 'tosInnovationDevRepresentative', label: '创新产品开发代表', group: 'team', inputType: 'person', requiredOnCreate: true, defaultVisible: false, hideable: true },
  { key: 'tosTexAiDevRepresentative', label: 'TEX AI 开发代表', group: 'team', inputType: 'person', requiredOnCreate: true, defaultVisible: false, hideable: true },
  { key: 'tosImagingDevRepresentative', label: '影像开发代表', group: 'team', inputType: 'person', requiredOnCreate: true, defaultVisible: false, hideable: true },
  { key: 'tosPreinstallRepresentative', label: '预装管理开发代表', group: 'team', inputType: 'person', requiredOnCreate: true, defaultVisible: false, hideable: true },
  { key: 'tosEcosystemRepresentative', label: '研发战略生态合作部代表', group: 'team', inputType: 'person', requiredOnCreate: true, defaultVisible: false, hideable: true },
]

export const TARGET_PROJECT_TYPES = [PROJECT_TYPE_MACHINE, PROJECT_TYPE_TOS_VERSION] as const

export const isTargetProjectInfoType = (type: string | undefined): type is typeof TARGET_PROJECT_TYPES[number] => (
  type === PROJECT_TYPE_MACHINE || type === PROJECT_TYPE_TOS_VERSION
)

export const getProjectInfoFields = (type: string | undefined) => {
  if (type === PROJECT_TYPE_MACHINE) return MACHINE_PROJECT_INFO_FIELDS
  if (type === PROJECT_TYPE_TOS_VERSION) return TOS_PROJECT_INFO_FIELDS
  return []
}

export const getProjectInfoGroups = (type: string | undefined) => {
  if (type === PROJECT_TYPE_MACHINE) return MACHINE_PROJECT_INFO_GROUPS
  if (type === PROJECT_TYPE_TOS_VERSION) return TOS_PROJECT_INFO_GROUPS
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
