import { isExternalMachineDevelopment } from '@/constants/projectInfoSchema'
import { isMachineProjectType } from '@/constants/projectTypes'
import type { JiraProjectConfig } from '@/lib/jiraProject'
import type {
  ProjectInfoValue,
  ProjectInfoValues,
  ProjectTeamRoleMap,
  VersionFiveRoles,
} from '@/types/app'

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
  'versionType',
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
  'machineQualityRepresentative',
  'machineOther',
  'technicalOther',
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
  machineQualityRepresentative: 'qualityRepresentative',
  machineDevelopmentRepresentative: 'developmentRepresentative',
  machineTestRepresentative: 'testRepresentative',
  machineOther: 'other',
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

const isTeamRoleMap = (value: unknown): value is ProjectTeamRoleMap => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  if ('kind' in value) return false
  return Object.values(value).every(item => (
    typeof item === 'string'
    || (Array.isArray(item) && item.every(member => typeof member === 'string'))
  ))
}

export const normalizeTeamMembers = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
  }
  return typeof value === 'string' && value.trim() ? [value] : []
}

export const deriveStartingRam = (memorySize: unknown) => {
  const text = String(memorySize || '')
  const configuredRams = Array.from(text.matchAll(/(\d+)\s*(?:GB)?\s*\+/gi))
    .map(match => Number(match[1]))
    .filter(Number.isFinite)
  if (configuredRams.length > 0) return `${Math.min(...configuredRams)}GB`
  const fallback = text.match(/(\d+)\s*GB/i)
  return fallback ? `${fallback[1]}GB` : ''
}

export const getProjectInfoValue = (project: ProjectInfoProject, key: string): ProjectInfoValue | undefined => {
  if (key === 'startingRam') {
    const derivedStartingRam = deriveStartingRam(getProjectInfoValue(project, 'memorySize'))
    if (derivedStartingRam) return derivedStartingRam
  }

  const stored = project.fieldValues?.[key]
  if (stored !== undefined) {
    if (key === 'versionType' && typeof stored === 'string' && stored.toUpperCase() === 'GO') return 'GO'
    return MACHINE_TEAM_KEYS[key] || TOS_TEAM_KEYS[key]
      ? normalizeTeamMembers(stored)
      : stored
  }

  if (key === 'firstSaleTosVersion') {
    const explicitVersion = project.firstSaleTosVersionId ?? project.firstSaleTosVersion
    if (typeof explicitVersion === 'string') return explicitVersion
  }
  if (key === 'currentTosVersion') {
    const explicitVersion = project.currentTosVersionId ?? project.currentTosVersion
    if (typeof explicitVersion === 'string') return explicitVersion
  }

  if (MACHINE_TEAM_KEYS[key]) {
    const roles = project.fieldValues?.machineTeamRoles
    const roleKey = MACHINE_TEAM_KEYS[key]
    if (isTeamRoleMap(roles) && (roles as ProjectTeamRoleMap)[roleKey] !== undefined) {
      return normalizeTeamMembers((roles as ProjectTeamRoleMap)[roleKey])
    }
  }
  if (TOS_TEAM_KEYS[key]) {
    const roles = project.fieldValues?.tosTeamRoles
    const roleKey = TOS_TEAM_KEYS[key]
    if (isTeamRoleMap(roles) && (roles as ProjectTeamRoleMap)[roleKey] !== undefined) {
      return normalizeTeamMembers((roles as ProjectTeamRoleMap)[roleKey])
    }
  }
  if (TOS_FIVE_ROLE_KEYS[key]) {
    const fiveRoles = project.versionFiveRoles as VersionFiveRoles | undefined
    const value = fiveRoles?.[TOS_FIVE_ROLE_KEYS[key]]
    if (value !== undefined) return normalizeTeamMembers(value)
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
  if (key === 'versionType' && typeof rootValue === 'string' && rootValue.toUpperCase() === 'GO') return 'GO'
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
  if (isMachineProjectType(type) && !isExternalMachineDevelopment(next)) {
    delete next.isTwoStage
    delete next.isOutsourcedMini
  }
  return next
}

const hasOwn = (object: object, key: string) => Object.prototype.hasOwnProperty.call(object, key)

const buildMachineTeamRoles = (
  project: ProjectInfoProject,
  values: ProjectInfoValues,
) => {
  const storedRoles = project.fieldValues?.machineTeamRoles
  const roles = isTeamRoleMap(storedRoles)
    ? Object.fromEntries(Object.entries(storedRoles).map(([role, members]) => [role, normalizeTeamMembers(members)]))
    : {}

  Object.entries(MACHINE_TEAM_KEYS).forEach(([key, role]) => {
    if (!hasOwn(roles, role)) {
      const existingValue = getProjectInfoValue(project, key)
      if (existingValue !== undefined) roles[role] = normalizeTeamMembers(existingValue)
    }
    if (hasOwn(values, key)) roles[role] = normalizeTeamMembers(values[key])
  })
  return roles
}

const buildTosTeamRoles = (values: ProjectInfoValues) => Object.entries(TOS_TEAM_KEYS).reduce<Record<string, string[]>>((roles, [key, role]) => {
  roles[role] = normalizeTeamMembers(values[key])
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
    machineTeamRoles: buildMachineTeamRoles(project, values),
    tosTeamRoles: buildTosTeamRoles(values),
  }
  if (isMachineProjectType(project.type) && !isExternalMachineDevelopment(values)) {
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
  if (isMachineProjectType(project.type) && !isExternalMachineDevelopment(values)) {
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
    const [primaryMember] = normalizeTeamMembers(values[key])
    if (primaryMember) roles[role] = primaryMember
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
