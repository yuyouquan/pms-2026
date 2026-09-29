import { evaluateMenuPermission, getAuthorizedColumns, matchesPermissionCondition, validateMenuPolicy } from '@/lib/permissionCenter'
import { canConfigureProjectScope, canEditProjectRegistry } from '@/lib/projectRegistryPermissions'
import { isGlobalAdmin, usePermissionStore } from '@/stores/permission'
import { getProjectAttribute, getRegistryProjectTypes, type ProjectAttribute } from '@/types/projectRegistry'
import type { PermissionAction } from '@/types/permissionCenter'
import { getPermissionFields } from '@/constants/permissionCenter'

type RegistryRow = { projectAttribute?: ProjectAttribute; type: string; fieldValues?: unknown; projectCode?: unknown; boundFormalProjectId?: string | null }
export function canUseProjectRegistry(actor: string, action: PermissionAction, project?: RegistryRow): boolean {
  const model = usePermissionStore.getState().permissionCenter
  if (model) return evaluateMenuPermission(model, actor, 'project.config', action, project ? { ...project, ...project.fieldValues as object, projectAttribute: getProjectAttribute(project), code: project.projectCode } : undefined)
  if (action === 'delete' || action === 'export') return isGlobalAdmin(actor)
  return project ? canEditProjectRegistry(actor, project, isGlobalAdmin(actor)) : getAllowedRegistryAttributes(actor).length > 0
}
export function canChangeRegistryFields(actor: string, previous: RegistryRow, next: RegistryRow): boolean {
  if (!canUseProjectRegistry(actor, 'edit', previous) || !canUseProjectRegistry(actor, 'edit', next)) return false
  const model = usePermissionStore.getState().permissionCenter
  if (!model) return true
  const source = { ...previous, ...previous.fieldValues as object, projectAttribute: getProjectAttribute(previous), code: previous.projectCode }
  if (evaluateMenuPermission({ ...model, policies: model.policies.filter(policy => policy.columns.mode === 'all') }, actor, 'project.config', 'edit', source)) return true
  const fields = getAuthorizedColumns(model, actor, 'project.config', 'edit', source)
  return Object.keys(next).every(key => JSON.stringify((previous as Record<string, unknown>)[key]) === JSON.stringify((next as Record<string, unknown>)[key]) || fields.includes(key) || (key === 'projectCode' && fields.includes('code')))
}
export function getAllowedRegistryTypes(actor: string, attribute: ProjectAttribute): string[] {
  const model = usePermissionStore.getState().permissionCenter
  return getRegistryProjectTypes(attribute).filter(type => model
    ? evaluateMenuPermission({ ...model, policies: model.policies.map(policy => {
        if (policy.menuId !== 'project.config' || policy.data.mode !== 'conditions') return policy
        if (!validateMenuPolicy(policy).ok) return { ...policy, actions: [] }
        const known = policy.data.conditions.filter(condition => condition.field === 'type' || condition.field === 'projectAttribute')
        const unknownCount = policy.data.conditions.length - known.length
        const matches = known.map(condition => matchesPermissionCondition({ type, projectAttribute: attribute }, condition, getPermissionFields('project.config').find(field => field.key === condition.field)!))
        const feasible = policy.data.conjunction === 'all' ? matches.every(Boolean) : unknownCount > 0 || matches.some(Boolean)
        return feasible ? { ...policy, data: { mode: 'all' as const, conjunction: 'all' as const, conditions: [] } } : { ...policy, actions: [] }
      }) }, actor, 'project.config', 'create')
    : canConfigureProjectScope(actor, attribute, type, isGlobalAdmin(actor)))
}
export function getAllowedRegistryAttributes(actor: string): ProjectAttribute[] {
  return (['formal', 'budget', 'roadmap'] as const).filter(attribute => getAllowedRegistryTypes(actor, attribute).length > 0)
}
