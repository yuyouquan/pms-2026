export const PROJECT_TYPE_MACHINE_PHONE = '整机-手机' as const
export const PROJECT_TYPE_MACHINE_PAD = '整机-PAD' as const
export const PROJECT_TYPE_MACHINE_LAPTOP = '整机-笔电' as const
export const PROJECT_TYPE_TOS_VERSION = 'tOS版本项目' as const
export const PROJECT_TYPE_INDEPENDENT_SOFTWARE = '独立软件产品项目' as const
export const PROJECT_TYPE_TECH = '技术项目' as const
export const PROJECT_TYPE_CAPABILITY = '能力建设项目' as const

export const LEGACY_PROJECT_TYPE_MACHINE = '整机产品项目' as const
export const LEGACY_PROJECT_TYPE_MACHINE_PHONE = '整机产品-手机' as const
export const LEGACY_PROJECT_TYPE_MACHINE_PAD = '整机产品-PAD' as const
export const LEGACY_PROJECT_TYPE_MACHINE_LAPTOP = '整机产品-笔电' as const
export const LEGACY_SOFTWARE_PROJECT_TYPE = '产品项目' as const
export const SOFTWARE_PROJECT_DISPLAY_TYPE = '软件产品项目' as const

export const MACHINE_PROJECT_TYPES = [
  PROJECT_TYPE_MACHINE_PHONE,
  PROJECT_TYPE_MACHINE_PAD,
  PROJECT_TYPE_MACHINE_LAPTOP,
] as const

export const LEGACY_MACHINE_PROJECT_TYPES = [
  LEGACY_PROJECT_TYPE_MACHINE,
  LEGACY_PROJECT_TYPE_MACHINE_PHONE,
  LEGACY_PROJECT_TYPE_MACHINE_PAD,
  LEGACY_PROJECT_TYPE_MACHINE_LAPTOP,
] as const

export const SOFTWARE_PROJECT_TYPES = [
  PROJECT_TYPE_TOS_VERSION,
  PROJECT_TYPE_INDEPENDENT_SOFTWARE,
] as const

export const PROJECT_TYPES = [
  ...MACHINE_PROJECT_TYPES,
  PROJECT_TYPE_TOS_VERSION,
  PROJECT_TYPE_INDEPENDENT_SOFTWARE,
  PROJECT_TYPE_TECH,
  PROJECT_TYPE_CAPABILITY,
] as const

export const PROJECT_TEMPLATE_TYPES = [
  ...MACHINE_PROJECT_TYPES,
  PROJECT_TYPE_TOS_VERSION,
  PROJECT_TYPE_INDEPENDENT_SOFTWARE,
  PROJECT_TYPE_TECH,
  PROJECT_TYPE_CAPABILITY,
] as const

export type MachineProjectType = typeof MACHINE_PROJECT_TYPES[number]
export type LegacyMachineProjectType = typeof LEGACY_MACHINE_PROJECT_TYPES[number]
export type CurrentProjectTypeName = typeof PROJECT_TYPES[number]
export type ProjectTypeName = CurrentProjectTypeName
export type PersistedProjectTypeName = CurrentProjectTypeName | LegacyMachineProjectType

export const MACHINE_PROJECT_TYPE_FILTER = 'machine'

export const MACHINE_PROJECT_FILTER_OPTIONS = [
  { label: '整机项目', value: MACHINE_PROJECT_TYPE_FILTER },
  ...MACHINE_PROJECT_TYPES.map(type => ({ label: type, value: type })),
] as const

export const PROJECT_TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  [PROJECT_TYPE_MACHINE_PHONE]: { bg: 'rgba(99,102,241,0.08)', color: '#6366f1' },
  [PROJECT_TYPE_MACHINE_PAD]: { bg: 'rgba(99,102,241,0.08)', color: '#6366f1' },
  [PROJECT_TYPE_MACHINE_LAPTOP]: { bg: 'rgba(99,102,241,0.08)', color: '#6366f1' },
  [LEGACY_PROJECT_TYPE_MACHINE]: { bg: 'rgba(99,102,241,0.08)', color: '#6366f1' },
  [LEGACY_PROJECT_TYPE_MACHINE_PHONE]: { bg: 'rgba(99,102,241,0.08)', color: '#6366f1' },
  [LEGACY_PROJECT_TYPE_MACHINE_PAD]: { bg: 'rgba(99,102,241,0.08)', color: '#6366f1' },
  [LEGACY_PROJECT_TYPE_MACHINE_LAPTOP]: { bg: 'rgba(99,102,241,0.08)', color: '#6366f1' },
  [PROJECT_TYPE_TOS_VERSION]: { bg: 'rgba(6,182,212,0.10)', color: '#0891b2' },
  [PROJECT_TYPE_INDEPENDENT_SOFTWARE]: { bg: 'rgba(20,184,166,0.10)', color: '#0f766e' },
  [PROJECT_TYPE_TECH]: { bg: 'rgba(250,173,20,0.08)', color: '#d48806' },
  [PROJECT_TYPE_CAPABILITY]: { bg: 'rgba(82,196,26,0.08)', color: '#389e0d' },
  [LEGACY_SOFTWARE_PROJECT_TYPE]: { bg: 'rgba(22,119,255,0.08)', color: '#1677ff' },
}

export function isMachineProjectType(type: string | undefined | null): type is MachineProjectType {
  const value = String(type || '')
  return (MACHINE_PROJECT_TYPES as readonly string[]).includes(value)
}

export function normalizeMachineProjectType(type: string | undefined | null): string {
  if (type === LEGACY_PROJECT_TYPE_MACHINE || type === LEGACY_PROJECT_TYPE_MACHINE_PHONE) return PROJECT_TYPE_MACHINE_PHONE
  if (type === LEGACY_PROJECT_TYPE_MACHINE_PAD) return PROJECT_TYPE_MACHINE_PAD
  if (type === LEGACY_PROJECT_TYPE_MACHINE_LAPTOP) return PROJECT_TYPE_MACHINE_LAPTOP
  return type || ''
}

export function matchesProjectTypeColumn(
  projectType: string | undefined | null,
  columnType: string | undefined | null,
) {
  return normalizeMachineProjectType(projectType) === normalizeMachineProjectType(columnType)
}

export function matchesProjectTypeFilter(projectType: string, selectedFilter: string) {
  if (selectedFilter === 'all') return true
  if (selectedFilter === MACHINE_PROJECT_TYPE_FILTER) return isMachineProjectType(projectType)
  return normalizeMachineProjectType(projectType) === normalizeMachineProjectType(selectedFilter)
}

export function getProjectTypeFamilyKey(type: string | undefined | null) {
  return isMachineProjectType(type) ? PROJECT_TYPE_MACHINE_PHONE : type || ''
}

export function isSoftwareProjectType(type: string | undefined | null) {
  return type === PROJECT_TYPE_TOS_VERSION
    || type === PROJECT_TYPE_INDEPENDENT_SOFTWARE
    || type === LEGACY_SOFTWARE_PROJECT_TYPE
    || type === SOFTWARE_PROJECT_DISPLAY_TYPE
}

export function isTosVersionProjectName(projectName: string | undefined | null) {
  return /^tOS\s*\d+(?:\.\d+)?$/i.test(String(projectName || '').trim())
}

export function inferSoftwareProjectTypeFromName(projectName: string | undefined | null) {
  return isTosVersionProjectName(projectName)
    ? PROJECT_TYPE_TOS_VERSION
    : PROJECT_TYPE_INDEPENDENT_SOFTWARE
}

export function normalizeSoftwareProjectType(type: string | undefined | null, projectName?: string) {
  if (type === LEGACY_SOFTWARE_PROJECT_TYPE || type === SOFTWARE_PROJECT_DISPLAY_TYPE) {
    return inferSoftwareProjectTypeFromName(projectName)
  }
  if (type === PROJECT_TYPE_TOS_VERSION || type === PROJECT_TYPE_INDEPENDENT_SOFTWARE) return type
  return type || ''
}
