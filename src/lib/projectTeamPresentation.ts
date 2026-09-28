import type { ProjectTeamMember, ProjectTeamSnapshot } from '@/types/projectTeam'

/** Source roles are flat; merge repeated identities without guessing reporting lines. */
export function projectTeamRows(team: ProjectTeamSnapshot | undefined): ProjectTeamMember[] {
  const rows = new Map<string, ProjectTeamMember>()
  for (const member of team?.members || []) {
    if (!member.employeeId) continue
    const previous = rows.get(member.employeeId)
    rows.set(member.employeeId, { ...member, roles: [...new Set([...(previous?.roles || []), ...member.roles])] })
  }
  return [...rows.values()]
}
