export interface ProjectResponsibilitySource {
  leader?: unknown
  responsiblePersons?: unknown
}

export interface ProjectRoleWithMembers {
  name: string
  members: string[]
}

/** Older owner snapshots used a joined display string; editor values and grants use individual names. */
export const normalizeProjectResponsibleMembers = (value: unknown): string[] => {
  const members = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[、,]/) : []
  return [...new Set(members.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean))]
}

const normalizeNames = (names: unknown): string[] => {
  if (!Array.isArray(names)) return []
  return Array.from(new Set(names.filter((name): name is string => typeof name === 'string' && name.length > 0)))
}

export const getProjectResponsiblePersons = (project: ProjectResponsibilitySource): string[] => {
  const stored = normalizeNames(project.responsiblePersons)
  if (stored.length > 0) return stored
  return typeof project.leader === 'string' && project.leader.length > 0 ? [project.leader] : []
}

export const haveProjectResponsiblePersonsChanged = (previous: string[], next: string[]): boolean => {
  const normalizedPrevious = normalizeNames(previous)
  const normalizedNext = normalizeNames(next)
  return normalizedPrevious.length !== normalizedNext.length
    || normalizedPrevious.some((name, index) => name !== normalizedNext[index])
}

export const mergeResponsiblePersonsIntoVisibleMembers = (
  visibleMembers: string[],
  responsiblePersons: string[],
): string[] => normalizeNames([...visibleMembers, ...responsiblePersons])

export const replaceProjectSystemAdministrators = <T extends ProjectRoleWithMembers>(
  roles: T[],
  responsiblePersons: string[],
): T[] => roles.map(role => (
  role.name === '系统管理员'
    ? { ...role, members: normalizeNames(responsiblePersons) }
    : role
))
