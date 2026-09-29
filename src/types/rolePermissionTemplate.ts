export const ROLE_TEMPLATE_TYPES = ['整机产品项目', 'tOS版本项目', '技术项目', '能力建设项目'] as const
export type RoleTemplateProjectType = typeof ROLE_TEMPLATE_TYPES[number]
export interface RoleTemplateInput { roleName: string; pmsRoleCode: string; ipmRoleCode: string }
export interface RolePermissionTemplate extends RoleTemplateInput { id: string; grants: Record<string, boolean> }
export interface SyncedProjectRole extends RolePermissionTemplate {
  source: 'ipm'
  sourceBinding: string
  sourceRoleName: string
  projectId: string
  templateId?: string
}
export type ProjectRoleTarget = { source: 'local'; name: string } | { source: 'ipm'; id: string }
