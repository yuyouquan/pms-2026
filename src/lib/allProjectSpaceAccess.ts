import { evaluateMenuPermission } from '@/lib/permissionCenter'
import type { PermissionCenterModel } from '@/types/permissionCenter'

/** Explicit global viewing never confers edit, export, share or role-management powers. */
export const ALL_PROJECT_SPACE_VIEW_KEYS: ReadonlySet<string> = new Set([
  'basicInfo:查看', 'basicInfo:planConfigView', 'basicInfo:transferView',
  'plan:一级计划-查看', 'plan:二级计划-查看', 'resource:view',
])

export const canViewAllProjectSpaces = (model: PermissionCenterModel | undefined, user: string): boolean => (
  evaluateMenuPermission(model, user, 'project.space', 'view')
)
