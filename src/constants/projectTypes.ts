export const PROJECT_TYPE_MACHINE_PHONE = '整机-手机'
export const PROJECT_TYPE_MACHINE_PAD = '整机-PAD'
export const PROJECT_TYPE_MACHINE_LAPTOP = '整机-笔电'
export const PROJECT_TYPE_TOS_VERSION = 'tOS版本项目'
export const PROJECT_TYPE_INDEPENDENT_SOFTWARE = '独立软件产品项目'
export const PROJECT_TYPE_TECH = '技术项目'
export const PROJECT_TYPE_CAPABILITY = '能力建设项目'
export const LEGACY_SOFTWARE_PROJECT_TYPE = '产品项目'
export const SOFTWARE_PROJECT_DISPLAY_TYPE = '软件产品项目'

export const SOFTWARE_PROJECT_TYPES = [
  PROJECT_TYPE_TOS_VERSION,
  PROJECT_TYPE_INDEPENDENT_SOFTWARE,
] as const

export const MACHINE_PROJECT_TYPES = [
  PROJECT_TYPE_MACHINE_PHONE,
  PROJECT_TYPE_MACHINE_PAD,
  PROJECT_TYPE_MACHINE_LAPTOP,
] as const

export type MachineProjectType = typeof MACHINE_PROJECT_TYPES[number]

export function isMachineProjectType(type: string | null | undefined): type is MachineProjectType {
  return MACHINE_PROJECT_TYPES.includes(type as MachineProjectType)
}

export const PROJECT_TYPES = [
  ...MACHINE_PROJECT_TYPES,
  PROJECT_TYPE_TOS_VERSION,
  PROJECT_TYPE_INDEPENDENT_SOFTWARE,
  PROJECT_TYPE_TECH,
  PROJECT_TYPE_CAPABILITY,
] as const

export type ProjectTypeName = typeof PROJECT_TYPES[number]

export const PROJECT_TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  [PROJECT_TYPE_MACHINE_PHONE]: { bg: 'rgba(99,102,241,0.08)', color: '#6366f1' },
  [PROJECT_TYPE_MACHINE_PAD]: { bg: 'rgba(99,102,241,0.08)', color: '#6366f1' },
  [PROJECT_TYPE_MACHINE_LAPTOP]: { bg: 'rgba(99,102,241,0.08)', color: '#6366f1' },
  [PROJECT_TYPE_TOS_VERSION]: { bg: 'rgba(6,182,212,0.10)', color: '#0891b2' },
  [PROJECT_TYPE_INDEPENDENT_SOFTWARE]: { bg: 'rgba(20,184,166,0.10)', color: '#0f766e' },
  [PROJECT_TYPE_TECH]: { bg: 'rgba(250,173,20,0.08)', color: '#d48806' },
  [PROJECT_TYPE_CAPABILITY]: { bg: 'rgba(82,196,26,0.08)', color: '#389e0d' },
  [LEGACY_SOFTWARE_PROJECT_TYPE]: { bg: 'rgba(22,119,255,0.08)', color: '#1677ff' },
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
