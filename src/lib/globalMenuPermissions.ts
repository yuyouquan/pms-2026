import { usePermissionStore } from '@/stores/permission'
import { useProjectStore } from '@/stores/project'
import { evaluateWholeMenuPermission, migrateLegacyPermissionCenter } from '@/lib/permissionCenter'
import { CONFIG_MENU_GROUPS } from '@/lib/configNavigation'
import { HR_SIDEBAR_NAV } from '@/constants/hrPipeline'
import type { ConfigModuleKey } from '@/types/hrConfig'
import type { PermissionAction, PermissionMenuId, PermissionCenterModel } from '@/types/permissionCenter'

export const HR_CONFIG_PERMISSION_MENUS: Record<ConfigModuleKey, PermissionMenuId> = {
  hrModel: 'config.hrPipeline:hrModel', nonLaborSubject: 'config.hrPipeline:nonLaborSubject', feeRate: 'config.hrPipeline:feeRate',
  tosPhaseRatio: 'hr.config/tos-phase-ratio', tosBrandAllocation: 'hr.config/tos-brand-allocation',
  techModuleDept: 'hr.config/tech-module-dept', techTmg: 'hr.config/tech-tmg', techPhaseRatio: 'hr.config/tech-phase-ratio',
}

/** Whole-configuration operations cannot borrow a sibling menu or a partial grant. */
export function hasGlobalMenuPermission(user: string, menuId: PermissionMenuId, action: PermissionAction = 'view'): boolean {
  const state = usePermissionStore.getState()
  // Home initializes the persisted model. Legacy standalone callers are evaluated
  // against an ephemeral migration without changing their store/test lifecycle.
  const model = state.permissionCenter ?? migrateLegacyPermissionCenter(state.globalRoles, state.globalRolePerms)
  return evaluateWholeMenuPermission(model, user, menuId, action)
}
export function useGlobalMenuPermission(user: string, menuId: PermissionMenuId) {
  const model = usePermissionStore(state => state.permissionCenter)
  return (action: PermissionAction = 'view') => evaluateWholeMenuPermission(model, user, menuId, action)
}
/** Reject a callback captured before an identity switch as well as live revocation. */
export function canRunGlobalMenuAction(actor: string, menuId: PermissionMenuId, action: PermissionAction): boolean {
  return useProjectStore.getState().currentLoginUser === actor && hasGlobalMenuPermission(actor, menuId, action)
}
export const getAccessibleConfigGroups = (model: PermissionCenterModel | undefined, user: string) => CONFIG_MENU_GROUPS.flatMap(group => {
  const children = group.children.filter(leaf => evaluateWholeMenuPermission(model, user, `config.${leaf.key}`, 'view'))
  return children.length ? [{ ...group, children }] : []
})
export const getAccessibleHrGroups = (model: PermissionCenterModel | undefined, user: string) => HR_SIDEBAR_NAV.flatMap(group => {
  const children = group.children.filter(leaf => evaluateWholeMenuPermission(model, user, `hr.${leaf.key}`, 'view'))
  return children.length ? [{ ...group, children }] : []
})
