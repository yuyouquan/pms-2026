import { getProjectPermissionCatalog } from '@/components/permission/projectPermissionCatalog'
import { ROLE_TEMPLATE_TYPES, type RolePermissionTemplate, type RoleTemplateInput, type RoleTemplateProjectType } from '@/types/rolePermissionTemplate'
import type { ProjectItem } from '@/types/app'
export function isRoleTemplateType(type: string): type is RoleTemplateProjectType { return (ROLE_TEMPLATE_TYPES as readonly string[]).includes(type) }
export function projectGrantKeys(type: string, projectAttribute?: ProjectItem['projectAttribute']): string[] {
  return [...new Set(getProjectPermissionCatalog({ type: type as ProjectItem['type'], projectAttribute }).flatMap(group => group.rows.flatMap(row => row.actions.map(action => action.key))))]
}
export function defaultViewGrants(type: string, attribute?: ProjectItem['projectAttribute']): Record<string, boolean> {
  return Object.fromEntries(getProjectPermissionCatalog({ type: type as ProjectItem['type'], projectAttribute: attribute }).flatMap(group => group.rows.flatMap(row => row.actions.filter(action => action.label === '查看').map(action => [action.key, true]))))
}
export function validateTemplateInput(rows: readonly RolePermissionTemplate[], input: RoleTemplateInput, id?: string): string | undefined {
  if (!input || ['roleName', 'ipmRoleCode', 'pmsRoleCode'].some(key => typeof input[key as keyof RoleTemplateInput] !== 'string' || !input[key as keyof RoleTemplateInput].trim())) return '角色名称、PMS角色编码和IPM角色编码必填'
  if (rows.some(row => row.id !== id && (row.ipmRoleCode === input.ipmRoleCode.trim() || row.pmsRoleCode === input.pmsRoleCode.trim()))) return '同一项目类型内角色编码不能重复'
}
export function createRoleTemplateSeed(): Record<RoleTemplateProjectType, RolePermissionTemplate[]> {
  return Object.fromEntries(ROLE_TEMPLATE_TYPES.map(type => [type, [
    ['SPM', 'RJPM', 'SPM'], ['研发代表', 'RD', 'DEV'], ['测试代表', 'QA', 'QA'],
  ].map(([roleName, ipmRoleCode, pmsRoleCode]) => ({ id: `template:${type}:${ipmRoleCode}`, roleName, ipmRoleCode, pmsRoleCode, grants: defaultViewGrants(type) }))])) as Record<RoleTemplateProjectType, RolePermissionTemplate[]>
}
export const sourceRoleIdentity = (binding: string, code: string): string => `ipm:${encodeURIComponent(binding)}:${encodeURIComponent(code)}`
