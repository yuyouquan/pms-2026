import {
  getEffectiveProjectInfoFields,
  getProjectInfoFields,
} from '@/constants/projectInfoSchema'
import { PROJECT_TYPE_MACHINE, PROJECT_TYPE_TOS_VERSION } from '@/constants/projectTypes'
import { getProjectInfoValue, type ProjectInfoProject } from '@/lib/projectInfoValues'
import type { ProjectInfoValues } from '@/types/app'

export interface ProjectInfoValidationError {
  fieldKey: string
  groupKey: 'basic' | 'extended' | 'team'
  message: string
}

export interface ExternalProjectInfoSource {
  name: string
  spm?: string
  productLine?: string
  productSeries?: string
  brand?: string
  marketName?: string
  tosVersion?: string
  androidVersion?: string
  chipPlatform?: string
  chipCode?: string
  chipModel?: string
  memorySize?: string
  mainboardName?: string
  researchMode?: string
  androidMajorUpgrade?: string
  confidentialityLevel?: string
  launchDate?: string
  productionForbiddenDate?: string
  targetMarkets?: string
}

const uniqueText = (values: Array<unknown>) => (
  [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))].join('、')
)

const parseMachineProjectName = (name: string) => {
  const [left = name, mainboard = ''] = name.split('_')
  const segments = left.split('-')
  return {
    projectModel: segments[0] || name,
    chipCode: segments[1] || '',
    mainboardName: mainboard,
  }
}

export const deriveProductType = (androidMajorUpgrade: unknown) => (
  String(androidMajorUpgrade || '') === '是' ? '老品' : '新品'
)

export const deriveStartingRam = (memorySize: unknown) => {
  const match = String(memorySize || '').match(/(\d+)\s*GB/i)
  return match ? `${match[1]}GB` : ''
}

export const deriveMachineProjectInfoValues = (source: ExternalProjectInfoSource): ProjectInfoValues => {
  const parsedName = parseMachineProjectName(source.name)
  const androidMajorUpgrade = source.androidMajorUpgrade || '否'
  const memorySize = source.memorySize || '8GB+256GB'
  return {
    researchMode: source.researchMode || '自研',
    developmentMode: '',
    firstSaleTosVersion: source.tosVersion || '',
    isFirstLaunchProject: '否',
    softwareProjectLevel: '',
    versionType: 'Full',
    dimensionUpgradeStrategy: '',
    projectModel: parsedName.projectModel,
    mainboardName: source.mainboardName || parsedName.mainboardName,
    androidMajorUpgrade,
    productType: deriveProductType(androidMajorUpgrade),
    targetMarkets: source.targetMarkets || '',
    systemType: '',
    kernelVersion: '',
    confidentialityLevel: source.confidentialityLevel || '内部公开',
    androidVersion: source.androidVersion || '',
    productSeries: source.productSeries || '',
    modelCategory: '整机',
    currentTosVersion: source.tosVersion || '',
    launchDate: source.launchDate || '',
    productionForbiddenDate: source.productionForbiddenDate || '',
    chipCode: source.chipCode || parsedName.chipCode,
    chipModel: source.chipModel || '',
    chipPlatform: source.chipPlatform || '',
    memorySize,
    startingRam: deriveStartingRam(memorySize),
    baselineName: source.name,
    machineSpm: source.spm || '',
  }
}

const asInfoProject = (project: unknown): ProjectInfoProject => project as ProjectInfoProject

const getProjectString = (project: ProjectInfoProject, key: string) => {
  const value = getProjectInfoValue(project, key)
  return typeof value === 'string' ? value : ''
}

export interface TosAggregateResult {
  values: ProjectInfoValues
  missingSources: string[]
}

export const deriveTosProjectAggregates = (
  selectedProjectIds: string[],
  projects: unknown[],
  tosProjectName: string,
): TosAggregateResult => {
  const machineProjects = projects
    .map(asInfoProject)
    .filter(project => project.type === PROJECT_TYPE_MACHINE)
  const selectedProjects = selectedProjectIds
    .map(projectId => machineProjects.find(project => project.id === projectId))
    .filter((project): project is ProjectInfoProject => !!project)
  const missingSources: string[] = []

  selectedProjects.forEach(project => {
    const missing = [
      ['芯片编码/芯片型号', getProjectString(project, 'chipCode') || getProjectString(project, 'chipModel')],
      ['品牌', String(project.brand || '')],
      ['产品线', String(project.productLine || '')],
      ['芯片平台', String(project.chipPlatform || '')],
    ].filter(([, value]) => !value).map(([label]) => label)
    if (missing.length) missingSources.push(`${project.name} 缺少${missing.join('、')}`)
  })

  const versionProjects = machineProjects.filter(project => (
    getProjectString(project, 'firstSaleTosVersion') === tosProjectName
    || String(project.tosVersionName || '') === tosProjectName
  ))
  const newProjects = versionProjects.filter(project => getProjectString(project, 'productType') === '新品')
  const legacyProjects = versionProjects.filter(project => getProjectString(project, 'productType') === '老品')

  return {
    values: {
      firstLaunchProjects: selectedProjectIds,
      firstLaunchProjectChips: uniqueText(selectedProjects.map(project => {
        const code = getProjectString(project, 'chipCode')
        const model = getProjectString(project, 'chipModel')
        return code && model ? `${code}（${model}）` : code || model
      })),
      applicableBrands: uniqueText(selectedProjects.map(project => project.brand)),
      applicableProductLines: uniqueText(selectedProjects.map(project => project.productLine)),
      applicableChipPlatforms: uniqueText(selectedProjects.map(project => project.chipPlatform)),
      newProductProjectList: uniqueText(newProjects.map(project => project.name)),
      legacyProductProjectList: uniqueText(legacyProjects.map(project => project.name)),
    },
    missingSources,
  }
}

const isEmptyValue = (value: unknown) => (
  value === undefined
  || value === null
  || (typeof value === 'string' && value.trim() === '')
  || (Array.isArray(value) && value.length === 0)
)

export const validateProjectInfoValues = (
  type: string,
  values: ProjectInfoValues,
  options?: { tosAggregateMissingSources?: string[] },
): ProjectInfoValidationError[] => {
  const effectiveKeys = new Set(getEffectiveProjectInfoFields(type, values).map(field => field.key))
  const errors = getProjectInfoFields(type)
    .filter(field => field.requiredOnCreate && effectiveKeys.has(field.key) && isEmptyValue(values[field.key]))
    .map(field => ({
      fieldKey: field.key,
      groupKey: field.group,
      message: `请填写${field.label}`,
    }))

  if (type === PROJECT_TYPE_TOS_VERSION && options?.tosAggregateMissingSources?.length) {
    errors.push({
      fieldKey: 'firstLaunchProjects',
      groupKey: 'basic',
      message: options.tosAggregateMissingSources.join('；'),
    })
  }
  return errors
}
