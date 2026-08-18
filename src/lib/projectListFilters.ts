export type AggregateProjectStatus = 'all' | 'inProgress' | 'completed'

export const IN_PROGRESS_PROJECT_STATUSES = new Set([
  '待立项', '规划中', '在研', '进行中', '待验',
])

export const COMPLETED_PROJECT_STATUSES = new Set([
  '已完成', '上市', '转维', 'EOS', '已迁移',
])

export interface ProjectPermissionRole {
  members: readonly string[]
}

export type ProjectPermissionRolesByProject = Readonly<Record<string, readonly ProjectPermissionRole[]>>

export function matchesAboutMine(
  projectId: string,
  currentLoginUser: string,
  rolesByProject: ProjectPermissionRolesByProject,
) {
  const user = currentLoginUser.trim()
  if (!user) return false
  return (rolesByProject[projectId] || []).some(role => role.members.includes(user))
}

export function canEnterProjectSpace(
  projectId: string,
  currentLoginUser: string,
  rolesByProject: ProjectPermissionRolesByProject,
  isGlobalAdmin: boolean,
) {
  const user = currentLoginUser.trim()
  if (!user) return false
  return isGlobalAdmin || matchesAboutMine(projectId, user, rolesByProject)
}

export function matchesAggregateProjectStatus(
  status: unknown,
  aggregateStatus: AggregateProjectStatus | string,
) {
  if (aggregateStatus === 'all') return true
  const normalized = String(status || '').trim()
  if (aggregateStatus === 'inProgress') return IN_PROGRESS_PROJECT_STATUSES.has(normalized)
  if (aggregateStatus === 'completed') return COMPLETED_PROJECT_STATUSES.has(normalized)
  return normalized === aggregateStatus
}

export interface ProjectListFilterInput<T> {
  projects: readonly T[]
  aboutMine: boolean
  currentLoginUser: string
  rolesByProject: ProjectPermissionRolesByProject
  getProjectId: (project: T) => string
  matchesCategory: (project: T) => boolean
  matchesSecondaryCategory: (project: T) => boolean
  matchesStatus: (project: T) => boolean
}

export function filterProjectsForList<T>(input: ProjectListFilterInput<T>) {
  return input.projects.filter(project => (
    (!input.aboutMine || matchesAboutMine(
      input.getProjectId(project),
      input.currentLoginUser,
      input.rolesByProject,
    ))
    && input.matchesCategory(project)
    && input.matchesSecondaryCategory(project)
    && input.matchesStatus(project)
  ))
}

export function countProjectsByCategory<T>(
  projects: readonly T[],
  categories: readonly string[],
  matchesCategory: (project: T, category: string) => boolean,
) {
  return Object.fromEntries(categories.map(category => [
    category,
    projects.filter(project => matchesCategory(project, category)).length,
  ]))
}
