import { isExternalMachineDevelopment } from '@/constants/projectInfoSchema'
import type { JiraProjectConfig } from '@/lib/jiraProject'
import type { ProjectInfoValue, ProjectInfoValues, VersionFiveRoles } from '@/types/app'

export type ProjectInfoProject = {
  id: string
  name: string
  type: string
  fieldValues?: ProjectInfoValues
  [key: string]: unknown
}

const LEGACY_ROOT_KEYS: Record<string, string> = {
  developmentMode: 'developMode',
  firstSaleTosVersion: 'tosVersionName',
  softwareProjectLevel: 'projectLevel',
  projectModel: 'model',
  mainboardName: 'mainboard',
  targetMarkets: 'market',
  currentTosVersion: 'tosVersion',
  chipModel: 'cpu',
  memorySize: 'memory',
  baselineName: 'born',
  machineSpm: 'spm',
}

const DIRECT_ROOT_KEYS = [
  'researchMode',
  'androidMajorUpgrade',
  'productType',
  'systemType',
  'kernelVersion',
  'productSeries',
  'launchDate',
  'productionForbiddenDate',
  'chipPlatform',
  'startingRam',
  'wholeMachinePd',
  'pcbaSheet',
  'shippingCountrySheet',
  'keyComponentsSheet',
  'isTwoStage',
  'isOutsourcedMini',
] as const

const TOS_FIVE_ROLE_KEYS: Record<string, keyof VersionFiveRoles> = {
  tosPlanningRepresentative: '版本规划代表',
  tosVersionProjectManager: '版本经理',
  tosSe: '版本SE',
  tosTestRepresentative: '版本测试代表',
  tosSqa: '版本质量代表',
}

const MACHINE_TEAM_KEYS: Record<string, string> = {
  machineSpm: 'spm',
  machineSpp: 'spp',
  machineCmo: 'cmo',
  machineSoftwareSe: 'softwareSe',
  machineUx: 'ux',
  machineDevelopmentRepresentative: 'developmentRepresentative',
  machineTestRepresentative: 'testRepresentative',
}

const TOS_TEAM_KEYS: Record<string, string> = {
  tosVersionProjectManager: 'versionProjectManager',
  tosPlanningRepresentative: 'planningRepresentative',
  tosSe: 'se',
  tosTestRepresentative: 'testRepresentative',
  tosSqa: 'sqa',
  tosCmo: 'cmo',
  tosUx: 'ux',
  tosStabilityRepresentative: 'stabilityRepresentative',
  tosPerformanceRepresentative: 'performanceRepresentative',
  tosPowerRepresentative: 'powerRepresentative',
  tosSystemAppDevRepresentative: 'systemAppDevRepresentative',
  tosBasebandDevRepresentative: 'basebandDevRepresentative',
  tosIntegrationDevRepresentative: 'integrationDevRepresentative',
  tosArchitectureDevRepresentative: 'architectureDevRepresentative',
  tosInnovationDevRepresentative: 'innovationDevRepresentative',
  tosTexAiDevRepresentative: 'texAiDevRepresentative',
  tosImagingDevRepresentative: 'imagingDevRepresentative',
  tosPreinstallRepresentative: 'preinstallRepresentative',
  tosEcosystemRepresentative: 'ecosystemRepresentative',
}

const isStringRecord = (value: unknown): value is Record<string, string> => (
  !!value && typeof value === 'object' && !Array.isArray(value)
)

export const getProjectInfoValue = (project: ProjectInfoProject, key: string): ProjectInfoValue | undefined => {
  const stored = project.fieldValues?.[key]
  if (stored !== undefined) return stored

  if (MACHINE_TEAM_KEYS[key]) {
    const roles = project.fieldValues?.machineTeamRoles
    if (isStringRecord(roles) && roles[MACHINE_TEAM_KEYS[key]] !== undefined) return roles[MACHINE_TEAM_KEYS[key]]
  }
  if (TOS_TEAM_KEYS[key]) {
    const roles = project.fieldValues?.tosTeamRoles
    if (isStringRecord(roles) && roles[TOS_TEAM_KEYS[key]] !== undefined) return roles[TOS_TEAM_KEYS[key]]
  }
  if (TOS_FIVE_ROLE_KEYS[key]) {
    const fiveRoles = project.versionFiveRoles as VersionFiveRoles | undefined
    const value = fiveRoles?.[TOS_FIVE_ROLE_KEYS[key]]
    if (value !== undefined) return value
  }

  if (key === 'targetMarkets') {
    if (typeof project.market === 'string') return project.market
    if (Array.isArray(project.markets)) return project.markets.filter((item): item is string => typeof item === 'string').join(',')
  }
  if (key === 'chipCode' && typeof project.cpu === 'string') return project.cpu
  if (key === 'researchMode') {
    const rootValue = project.researchMode
    if (typeof rootValue === 'string') return rootValue
  }

  const rootKey = LEGACY_ROOT_KEYS[key] || key
  const rootValue = project[rootKey]
  if (
    typeof rootValue === 'string'
    || typeof rootValue === 'boolean'
    || rootValue === null
    || Array.isArray(rootValue)
  ) {
    return rootValue as ProjectInfoValue
  }
  return undefined
}

export const buildProjectInfoValues = (project: ProjectInfoProject, fieldKeys?: string[]): ProjectInfoValues => {
  const values: ProjectInfoValues = { ...(project.fieldValues || {}) }
  ;(fieldKeys || Object.keys(LEGACY_ROOT_KEYS)).forEach(key => {
    const value = getProjectInfoValue(project, key)
    if (value !== undefined) values[key] = value
  })
  return values
}

export const sanitizeInactiveProjectInfoValues = (
  type: string,
  values: ProjectInfoValues,
): ProjectInfoValues => {
  const next = { ...values }
  if (type === '整机产品项目' && !isExternalMachineDevelopment(next)) {
    delete next.isTwoStage
    delete next.isOutsourcedMini
  }
  return next
}

const buildMachineTeamRoles = (values: ProjectInfoValues) => Object.entries(MACHINE_TEAM_KEYS).reduce<Record<string, string>>((roles, [key, role]) => {
  const value = values[key]
  if (typeof value === 'string') roles[role] = value
  return roles
}, {})

const buildTosTeamRoles = (values: ProjectInfoValues) => Object.entries(TOS_TEAM_KEYS).reduce<Record<string, string>>((roles, [key, role]) => {
  const value = values[key]
  if (typeof value === 'string') roles[role] = value
  return roles
}, {})

export const mergeProjectInfoValues = <T extends ProjectInfoProject>(
  project: T,
  rawValues: ProjectInfoValues,
): T => {
  const values = sanitizeInactiveProjectInfoValues(project.type, rawValues)
  const nextFieldValues: ProjectInfoValues = {
    ...(project.fieldValues || {}),
    ...values,
    machineTeamRoles: buildMachineTeamRoles(values),
    tosTeamRoles: buildTosTeamRoles(values),
  }
  if (project.type === '整机产品项目' && !isExternalMachineDevelopment(values)) {
    delete nextFieldValues.isTwoStage
    delete nextFieldValues.isOutsourcedMini
  }
  const next = {
    ...project,
    fieldValues: nextFieldValues,
  } as T

  Object.entries(LEGACY_ROOT_KEYS).forEach(([key, rootKey]) => {
    const value = values[key]
    if (value !== undefined) (next as Record<string, unknown>)[rootKey] = value
  })
  DIRECT_ROOT_KEYS.forEach(key => {
    const value = values[key]
    if (value !== undefined) (next as Record<string, unknown>)[key] = value
  })
  if (project.type === '整机产品项目' && !isExternalMachineDevelopment(values)) {
    delete (next as Record<string, unknown>).isTwoStage
    delete (next as Record<string, unknown>).isOutsourcedMini
  }

  if (typeof values.targetMarkets === 'string') {
    const markets = values.targetMarkets.split(',').map(value => value.trim()).filter(Boolean)
    ;(next as Record<string, unknown>).market = values.targetMarkets
    ;(next as Record<string, unknown>).markets = markets
  }
  if (Array.isArray(values.jiraProjects)) {
    ;(next as Record<string, unknown>).jiraProjects = values.jiraProjects as JiraProjectConfig[]
  }

  const existingFiveRoles = (project.versionFiveRoles || {}) as Partial<VersionFiveRoles>
  const versionFiveRoles = Object.entries(TOS_FIVE_ROLE_KEYS).reduce<Partial<VersionFiveRoles>>((roles, [key, role]) => {
    const value = values[key]
    if (typeof value === 'string') roles[role] = value
    return roles
  }, { ...existingFiveRoles })
  if (Object.keys(versionFiveRoles).length > 0) {
    ;(next as Record<string, unknown>).versionFiveRoles = versionFiveRoles
  }

  return next
}

export const formatProjectInfoValue = (value: ProjectInfoValue | undefined): string => {
  if (value === undefined || value === null || value === '') return '-'
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (Array.isArray(value)) {
    if (value.length === 0) return '-'
    if (typeof value[0] === 'string') return (value as string[]).join('、')
    return `${value.length} 个项目`
  }
  if (typeof value === 'object') return Object.values(value).filter(Boolean).join('、') || '-'
  return String(value)
}
