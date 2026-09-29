import { MOCK_LOGIN_EMPLOYEE_IDS } from '@/mock/projectTeam'
import { useProjectTeamStore } from '@/stores/projectTeam'
import type { ProjectTeamMember, ProjectTeamSnapshot } from '@/types/projectTeam'

function belongsToTeam(userName: string, team: ProjectTeamSnapshot | undefined): boolean {
  const employeeId = MOCK_LOGIN_EMPLOYEE_IDS[userName]
  return Boolean(employeeId && team?.members.some(member => member.employeeId === employeeId))
}

export function isProjectTeamMember(userName: string, projectId: string | undefined): boolean {
  return Boolean(projectId && belongsToTeam(userName, useProjectTeamStore.getState().teamsByProjectId[projectId]))
}

export function useIsProjectTeamMember(userName: string, projectId: string | undefined): boolean {
  const team = useProjectTeamStore(state => projectId ? state.teamsByProjectId[projectId] : undefined)
  return belongsToTeam(userName, team)
}

/** Read-only source assignment; never matches a display name. */
export function getProjectTeamRoleMembers(projectId: string, ipmRoleCode: string): readonly ProjectTeamMember[] {
  return (useProjectTeamStore.getState().teamsByProjectId[projectId]?.members ?? [])
    .filter(member => member.roleCodes?.includes(ipmRoleCode))
    .map(member => ({ ...member, roles: [...member.roles], roleCodes: [...(member.roleCodes ?? [])] }))
}
