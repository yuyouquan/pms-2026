import { useProjectStore } from '@/stores/project'
import { buildTechnicalPlanTabs, getTechnicalPlanKey, useTechnicalPlanStore, type TechnicalPlanScope } from '@/stores/technicalPlan'
import { useTechnicalProjectStore } from '@/stores/technicalProject'
import { getTechnicalLevel1MaintainerUsers } from '@/lib/projectSpaceLevel1Rules'
import { isProjectTeamMember } from '@/lib/projectTeam'
import { matchesAboutMine } from '@/lib/projectListFilters'
import { canMaintainLevel1Plan } from '@/lib/level1PlanRules'
import { useProjectTeamStore } from '@/stores/projectTeam'
import { effectiveTeamProjectId } from '@/stores/rolePermissionTemplates'
import { hasPermission, isProjectSpaceReadOnly, isGlobalAdmin, usePermissionStore } from '@/stores/permission'

export function projectTeamScopeToken(projectId: string | undefined): string {
  if (!projectId) return ''
  const scope = effectiveTeamProjectId(projectId)
  return `${scope}:${useProjectTeamStore.getState().teamsByProjectId[scope]?.sourceBinding ?? ''}`
}

/** A callback may outlive its rendered user/project. Recheck the target at execution. */
export function canExecuteProjectTeamWrite(
  actor: string,
  projectId: string | undefined,
  live: { currentLoginUser: string; selectedProject: { id: string } | null },
  permissionProjectId = projectId,
  operationKey?: string,
  openingSourceToken?: string,
): boolean {
  return Boolean(projectId) && live.currentLoginUser === actor && live.selectedProject?.id === projectId
    && (openingSourceToken === undefined || openingSourceToken === projectTeamScopeToken(projectId))
    && permissionProjectId === effectiveTeamProjectId(projectId!)
    && (operationKey ? hasPermission(actor, permissionProjectId, operationKey)
      : !isProjectSpaceReadOnly(actor, permissionProjectId)
        && (isGlobalAdmin(actor) || matchesAboutMine(permissionProjectId!, actor, usePermissionStore.getState().rolesByProject)))
}

/** Import is a separate configured operation; it never enables general L1 maintenance. */
export function canImportTechnicalDraft(actor: string, projectId: string): boolean {
  const live = useProjectStore.getState()
  const project = live.selectedProject
  return Boolean(project && project.id === projectId && live.currentLoginUser === actor && project.type === '技术项目'
    && hasPermission(actor, projectId, 'plan:一级计划-查看') && hasPermission(actor, projectId, 'plan:导入')
    && canMaintainLevel1Plan({ projectType: project.type, currentUser: actor, spmUsers: [],
      technicalLead: getTechnicalLevel1MaintainerUsers(project, isProjectTeamMember(actor, projectId) ? [] : usePermissionStore.getState().rolesByProject[projectId] ?? []),
      globalAdmins: isGlobalAdmin(actor) ? [actor] : [],
    }))
}
export function canImportTechnicalRevision(actor: string, projectId: string, scope: TechnicalPlanScope, versionId: string, sourceToken: string): boolean {
  if (!canImportTechnicalDraft(actor, projectId) || scope.parentProjectId !== projectId
    || !canExecuteProjectTeamWrite(actor, projectId, useProjectStore.getState(), projectId, 'plan:导入', sourceToken)) return false
  const key = getTechnicalPlanKey(scope)
  const tab = buildTechnicalPlanTabs(projectId, useTechnicalProjectStore.getState().subprojects, false).find(tab => getTechnicalPlanKey(tab.scope) === key)
  if (!tab || (tab.subproject && (!tab.subproject.active || !tab.subproject.configuration.coreValue || !tab.subproject.configuration.developmentMode))) return false
  const instance = useTechnicalPlanStore.getState().plansByKey[key]
  return Boolean(instance && instance.currentVersionId === versionId && instance.versions.some(version => version.id === versionId && version.status === '修订中'))
}
