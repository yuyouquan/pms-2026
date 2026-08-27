export const PROJECT_CATEGORY_MACHINE = '整机产品项目' as const
export const PROJECT_CATEGORY_TOS_VERSION = 'tOS版本项目' as const
export const PROJECT_CATEGORY_TECH = '技术项目' as const
export const PROJECT_CATEGORY_CAPABILITY = '能力建设项目' as const

export const PROJECT_TYPE_MACHINE_PHONE = '整机-手机' as const
export const PROJECT_TYPE_MACHINE_TABLET = '整机-平板' as const
export const PROJECT_TYPE_MACHINE_PAD = PROJECT_TYPE_MACHINE_TABLET
export const PROJECT_TYPE_MACHINE_LAPTOP = '整机-笔电' as const
export const PROJECT_TYPE_MACHINE_FEATURE_PHONE = '整机-功能机' as const
export const PROJECT_TYPE_MACHINE_AIOT = '整机-AIOT扩品类' as const
export const PROJECT_TYPE_MACHINE_BASELINE = '整机-基线项目' as const
export const PROJECT_TYPE_MACHINE_N_PLUS_1 = '整机-N+1项目' as const
export const PROJECT_TYPE_MACHINE_PRE_RESEARCH = '整机-预研项目' as const
export const PROJECT_TYPE_TOS_VERSION = PROJECT_CATEGORY_TOS_VERSION
export const PROJECT_TYPE_INDEPENDENT_SOFTWARE = '独立软件产品项目' as const
export const PROJECT_TYPE_TECH = PROJECT_CATEGORY_TECH
export const PROJECT_TYPE_CAPABILITY = PROJECT_CATEGORY_CAPABILITY

// Persisted values from earlier releases. Keep these exports and mappings so
// localStorage records and existing callers continue to resolve correctly.
export const LEGACY_PROJECT_TYPE_MACHINE = PROJECT_CATEGORY_MACHINE
export const LEGACY_PROJECT_TYPE_MACHINE_PHONE = '整机产品-手机' as const
export const LEGACY_PROJECT_TYPE_MACHINE_CURRENT_PAD = '整机-PAD' as const
export const LEGACY_PROJECT_TYPE_MACHINE_PAD = '整机产品-PAD' as const
export const LEGACY_PROJECT_TYPE_MACHINE_LAPTOP = '整机产品-笔电' as const
export const LEGACY_PROJECT_TYPE_MACHINE_AIOT = '整机-AIOT' as const
export const LEGACY_PROJECT_TYPE_MACHINE_BASELINE = '整机-基线' as const
export const LEGACY_PROJECT_TYPE_MACHINE_N_PLUS_1 = '整机-N+1' as const
export const LEGACY_PROJECT_TYPE_MACHINE_PRE_RESEARCH = '整机-预研' as const
export const LEGACY_SOFTWARE_PROJECT_TYPE = '产品项目' as const
export const SOFTWARE_PROJECT_DISPLAY_TYPE = '软件产品项目' as const

export const MACHINE_PROJECT_TYPES = [
  PROJECT_TYPE_MACHINE_PHONE,
  PROJECT_TYPE_MACHINE_TABLET,
  PROJECT_TYPE_MACHINE_LAPTOP,
  PROJECT_TYPE_MACHINE_FEATURE_PHONE,
  PROJECT_TYPE_MACHINE_AIOT,
  PROJECT_TYPE_MACHINE_BASELINE,
  PROJECT_TYPE_MACHINE_N_PLUS_1,
  PROJECT_TYPE_MACHINE_PRE_RESEARCH,
] as const

export const LEGACY_MACHINE_PROJECT_TYPES = [
  LEGACY_PROJECT_TYPE_MACHINE,
  LEGACY_PROJECT_TYPE_MACHINE_PHONE,
  LEGACY_PROJECT_TYPE_MACHINE_CURRENT_PAD,
  LEGACY_PROJECT_TYPE_MACHINE_PAD,
  LEGACY_PROJECT_TYPE_MACHINE_LAPTOP,
  LEGACY_PROJECT_TYPE_MACHINE_AIOT,
  LEGACY_PROJECT_TYPE_MACHINE_BASELINE,
  LEGACY_PROJECT_TYPE_MACHINE_N_PLUS_1,
  LEGACY_PROJECT_TYPE_MACHINE_PRE_RESEARCH,
] as const

export const SOFTWARE_PROJECT_TYPES = [
  PROJECT_TYPE_TOS_VERSION,
  PROJECT_TYPE_INDEPENDENT_SOFTWARE,
] as const

export const PROJECT_TYPES = [
  PROJECT_CATEGORY_MACHINE,
  PROJECT_CATEGORY_TOS_VERSION,
  PROJECT_CATEGORY_TECH,
  PROJECT_CATEGORY_CAPABILITY,
] as const

export const PROJECT_CATEGORIES = PROJECT_TYPES
export const PROJECT_TEMPLATE_TYPES = PROJECT_TYPES

export const PROJECT_SECONDARY_CATEGORIES = {
  [PROJECT_CATEGORY_MACHINE]: MACHINE_PROJECT_TYPES,
  [PROJECT_CATEGORY_TOS_VERSION]: [],
  [PROJECT_CATEGORY_TECH]: [],
  [PROJECT_CATEGORY_CAPABILITY]: [],
} as const

export type MachineProjectType = typeof MACHINE_PROJECT_TYPES[number]
export type LegacyMachineProjectType = typeof LEGACY_MACHINE_PROJECT_TYPES[number]
export type ProjectCategoryName = typeof PROJECT_TYPES[number]
export type CurrentProjectTypeName = ProjectCategoryName
export type ProjectTypeName = CurrentProjectTypeName
export type PersistedProjectTypeName =
  | ProjectCategoryName
  | MachineProjectType
  | LegacyMachineProjectType
  | typeof PROJECT_TYPE_INDEPENDENT_SOFTWARE
  | typeof LEGACY_SOFTWARE_PROJECT_TYPE
  | typeof SOFTWARE_PROJECT_DISPLAY_TYPE

export interface ProjectClassification {
  projectCategory: string
  secondaryCategory?: string
}

export const MACHINE_PROJECT_TYPE_FILTER = 'machine'

export const MACHINE_PROJECT_FILTER_OPTIONS = MACHINE_PROJECT_TYPES.map(type => ({
  label: type,
  value: type,
}))

const MACHINE_SECONDARY_ALIASES: Record<string, MachineProjectType> = {
  [PROJECT_TYPE_MACHINE_PHONE]: PROJECT_TYPE_MACHINE_PHONE,
  [PROJECT_TYPE_MACHINE_TABLET]: PROJECT_TYPE_MACHINE_TABLET,
  [PROJECT_TYPE_MACHINE_LAPTOP]: PROJECT_TYPE_MACHINE_LAPTOP,
  [PROJECT_TYPE_MACHINE_FEATURE_PHONE]: PROJECT_TYPE_MACHINE_FEATURE_PHONE,
  [PROJECT_TYPE_MACHINE_AIOT]: PROJECT_TYPE_MACHINE_AIOT,
  [PROJECT_TYPE_MACHINE_BASELINE]: PROJECT_TYPE_MACHINE_BASELINE,
  [PROJECT_TYPE_MACHINE_N_PLUS_1]: PROJECT_TYPE_MACHINE_N_PLUS_1,
  [PROJECT_TYPE_MACHINE_PRE_RESEARCH]: PROJECT_TYPE_MACHINE_PRE_RESEARCH,
  [LEGACY_PROJECT_TYPE_MACHINE_PHONE]: PROJECT_TYPE_MACHINE_PHONE,
  [LEGACY_PROJECT_TYPE_MACHINE_CURRENT_PAD]: PROJECT_TYPE_MACHINE_TABLET,
  [LEGACY_PROJECT_TYPE_MACHINE_PAD]: PROJECT_TYPE_MACHINE_TABLET,
  [LEGACY_PROJECT_TYPE_MACHINE_LAPTOP]: PROJECT_TYPE_MACHINE_LAPTOP,
  [LEGACY_PROJECT_TYPE_MACHINE_AIOT]: PROJECT_TYPE_MACHINE_AIOT,
  [LEGACY_PROJECT_TYPE_MACHINE_BASELINE]: PROJECT_TYPE_MACHINE_BASELINE,
  [LEGACY_PROJECT_TYPE_MACHINE_N_PLUS_1]: PROJECT_TYPE_MACHINE_N_PLUS_1,
  [LEGACY_PROJECT_TYPE_MACHINE_PRE_RESEARCH]: PROJECT_TYPE_MACHINE_PRE_RESEARCH,
}

export function resolveProjectClassification(
  type: string | undefined | null,
  secondaryCategory?: string | undefined | null,
): ProjectClassification {
  const rawType = String(type || '').trim()
  const rawSecondaryCategory = String(secondaryCategory || '').trim()
  if (rawType === PROJECT_CATEGORY_MACHINE) {
    return {
      projectCategory: PROJECT_CATEGORY_MACHINE,
      secondaryCategory: MACHINE_SECONDARY_ALIASES[rawSecondaryCategory] || PROJECT_TYPE_MACHINE_PHONE,
    }
  }
  if (rawType === PROJECT_CATEGORY_TOS_VERSION) {
    return {
      projectCategory: PROJECT_CATEGORY_TOS_VERSION,
      ...(rawSecondaryCategory ? { secondaryCategory: rawSecondaryCategory } : {}),
    }
  }
  if (rawType === PROJECT_CATEGORY_TECH) {
    return {
      projectCategory: PROJECT_CATEGORY_TECH,
      ...(rawSecondaryCategory ? { secondaryCategory: rawSecondaryCategory } : {}),
    }
  }
  if (rawType === PROJECT_CATEGORY_CAPABILITY) {
    return {
      projectCategory: PROJECT_CATEGORY_CAPABILITY,
      ...(rawSecondaryCategory ? { secondaryCategory: rawSecondaryCategory } : {}),
    }
  }

  const machineSecondaryCategory = MACHINE_SECONDARY_ALIASES[rawType]
  if (machineSecondaryCategory) {
    return {
      projectCategory: PROJECT_CATEGORY_MACHINE,
      secondaryCategory: machineSecondaryCategory,
    }
  }
  if (
    rawType === PROJECT_TYPE_INDEPENDENT_SOFTWARE
    || rawType === LEGACY_SOFTWARE_PROJECT_TYPE
    || rawType === SOFTWARE_PROJECT_DISPLAY_TYPE
  ) {
    return {
      projectCategory: PROJECT_CATEGORY_TOS_VERSION,
    }
  }
  return {
    projectCategory: rawType,
    ...(rawSecondaryCategory ? { secondaryCategory: rawSecondaryCategory } : {}),
  }
}

export const PROJECT_TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  [PROJECT_CATEGORY_MACHINE]: { bg: 'rgba(99,102,241,0.08)', color: '#6366f1' },
  [PROJECT_TYPE_MACHINE_PHONE]: { bg: 'rgba(99,102,241,0.08)', color: '#6366f1' },
  [PROJECT_TYPE_MACHINE_TABLET]: { bg: 'rgba(99,102,241,0.08)', color: '#6366f1' },
  [PROJECT_TYPE_MACHINE_LAPTOP]: { bg: 'rgba(99,102,241,0.08)', color: '#6366f1' },
  [PROJECT_TYPE_MACHINE_FEATURE_PHONE]: { bg: 'rgba(99,102,241,0.08)', color: '#6366f1' },
  [PROJECT_TYPE_MACHINE_AIOT]: { bg: 'rgba(99,102,241,0.08)', color: '#6366f1' },
  [PROJECT_TYPE_MACHINE_BASELINE]: { bg: 'rgba(99,102,241,0.08)', color: '#6366f1' },
  [PROJECT_TYPE_MACHINE_N_PLUS_1]: { bg: 'rgba(99,102,241,0.08)', color: '#6366f1' },
  [PROJECT_TYPE_MACHINE_PRE_RESEARCH]: { bg: 'rgba(99,102,241,0.08)', color: '#6366f1' },
  [LEGACY_PROJECT_TYPE_MACHINE_PHONE]: { bg: 'rgba(99,102,241,0.08)', color: '#6366f1' },
  [LEGACY_PROJECT_TYPE_MACHINE_CURRENT_PAD]: { bg: 'rgba(99,102,241,0.08)', color: '#6366f1' },
  [LEGACY_PROJECT_TYPE_MACHINE_PAD]: { bg: 'rgba(99,102,241,0.08)', color: '#6366f1' },
  [LEGACY_PROJECT_TYPE_MACHINE_LAPTOP]: { bg: 'rgba(99,102,241,0.08)', color: '#6366f1' },
  [LEGACY_PROJECT_TYPE_MACHINE_AIOT]: { bg: 'rgba(99,102,241,0.08)', color: '#6366f1' },
  [LEGACY_PROJECT_TYPE_MACHINE_BASELINE]: { bg: 'rgba(99,102,241,0.08)', color: '#6366f1' },
  [LEGACY_PROJECT_TYPE_MACHINE_N_PLUS_1]: { bg: 'rgba(99,102,241,0.08)', color: '#6366f1' },
  [LEGACY_PROJECT_TYPE_MACHINE_PRE_RESEARCH]: { bg: 'rgba(99,102,241,0.08)', color: '#6366f1' },
  [PROJECT_TYPE_TOS_VERSION]: { bg: 'rgba(6,182,212,0.10)', color: '#0891b2' },
  [PROJECT_TYPE_INDEPENDENT_SOFTWARE]: { bg: 'rgba(20,184,166,0.10)', color: '#0f766e' },
  [PROJECT_TYPE_TECH]: { bg: 'rgba(250,173,20,0.08)', color: '#d48806' },
  [PROJECT_TYPE_CAPABILITY]: { bg: 'rgba(82,196,26,0.08)', color: '#389e0d' },
  [LEGACY_SOFTWARE_PROJECT_TYPE]: { bg: 'rgba(22,119,255,0.08)', color: '#1677ff' },
}

export function isMachineProjectType(type: string | undefined | null) {
  return resolveProjectClassification(type).projectCategory === PROJECT_CATEGORY_MACHINE
}

export function normalizeMachineProjectType(type: string | undefined | null): string {
  const rawType = String(type || '').trim()
  return MACHINE_SECONDARY_ALIASES[rawType] || rawType
}

export function normalizeMachineSecondaryCategory(
  value: string | undefined | null,
): MachineProjectType | null {
  const rawValue = String(value || '').trim()
  if (rawValue === PROJECT_CATEGORY_MACHINE) return PROJECT_TYPE_MACHINE_PHONE
  return MACHINE_SECONDARY_ALIASES[rawValue] || null
}

export function matchesProjectTypeColumn(
  projectType: string | undefined | null,
  columnType: string | undefined | null,
) {
  return resolveProjectClassification(projectType).projectCategory
    === resolveProjectClassification(columnType).projectCategory
}

export function matchesProjectTypeFilter(
  projectType: string,
  selectedFilter: string,
  secondaryCategory?: string | undefined | null,
) {
  if (selectedFilter === 'all') return true
  if (selectedFilter === MACHINE_PROJECT_TYPE_FILTER) return isMachineProjectType(projectType)
  const projectClassification = resolveProjectClassification(projectType, secondaryCategory)
  const selectedClassification = resolveProjectClassification(selectedFilter)
  if (projectClassification.projectCategory !== selectedClassification.projectCategory) return false
  if ((PROJECT_CATEGORIES as readonly string[]).includes(selectedFilter)) return true
  return projectClassification.secondaryCategory === selectedClassification.secondaryCategory
}

export function matchesProjectSecondaryCategoryFilter(
  projectType: string,
  secondaryCategory: string | undefined | null,
  selectedSecondary: string,
) {
  if (selectedSecondary === 'all') return true
  const projectSecondaryCategory = resolveProjectClassification(
    projectType,
    secondaryCategory,
  ).secondaryCategory
  const selectedSecondaryCategory = resolveProjectClassification(
    selectedSecondary,
  ).secondaryCategory || selectedSecondary
  return projectSecondaryCategory === selectedSecondaryCategory
}

export function getProjectTypeFamilyKey(type: string | undefined | null) {
  return resolveProjectClassification(type).projectCategory
}

export function isSoftwareProjectType(type: string | undefined | null) {
  return resolveProjectClassification(type).projectCategory === PROJECT_CATEGORY_TOS_VERSION
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
