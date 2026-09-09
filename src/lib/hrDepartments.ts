export interface HrDepartmentOption {
  value: string
  label: string
}

interface HrDepartmentProject {
  versions?: readonly { departmentInvestments?: readonly unknown[] }[]
}

export interface HrDepartmentOptions {
  primaryOptions: HrDepartmentOption[]
  getSecondaryOptions: (primary: string) => HrDepartmentOption[]
  isValidPair: (primary: string, secondary: string) => boolean
}

/** Observed pairs are compatibility data, not an official organization tree. */
export function createHrDepartmentOptions(
  configRecords: readonly unknown[],
  projectGroups: readonly (readonly HrDepartmentProject[])[] = [],
): HrDepartmentOptions {
  const departments = new Map<string, Set<string>>()
  const addPair = (candidate: unknown) => {
    if (!candidate || typeof candidate !== 'object') return
    const { primaryDepartment, secondaryDepartment } = candidate as Record<string, unknown>
    if (typeof primaryDepartment !== 'string' || !primaryDepartment.trim()
      || typeof secondaryDepartment !== 'string' || !secondaryDepartment.trim()) return
    const secondary = departments.get(primaryDepartment) ?? new Set<string>()
    secondary.add(secondaryDepartment)
    departments.set(primaryDepartment, secondary)
  }

  configRecords.forEach(addPair)
  projectGroups.forEach(projects => projects.forEach(project => {
    project.versions?.forEach(version => version.departmentInvestments?.forEach(addPair))
  }))

  const secondaryOptions = new Map([...departments].map(([primary, secondary]) => [
    primary,
    [...secondary].map(value => ({ value, label: value })),
  ]))

  return {
    primaryOptions: [...departments.keys()].map(value => ({ value, label: value })),
    getSecondaryOptions: primary => secondaryOptions.get(primary) ?? [],
    isValidPair: (primary, secondary) => departments.get(primary)?.has(secondary) ?? false,
  }
}
