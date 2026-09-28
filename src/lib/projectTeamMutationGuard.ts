import { isProjectTeamReadOnly } from '@/stores/permission'

/** A callback may outlive its rendered user/project. Recheck the target at execution. */
export function canExecuteProjectTeamWrite(
  actor: string,
  projectId: string | undefined,
  live: { currentLoginUser: string; selectedProject: { id: string } | null },
  permissionProjectId = projectId,
): boolean {
  return Boolean(projectId) && live.currentLoginUser === actor && live.selectedProject?.id === projectId
    && !isProjectTeamReadOnly(actor, permissionProjectId)
}
