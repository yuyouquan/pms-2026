export type PermissionAction = 'view' | 'export' | 'import' | 'create' | 'edit' | 'delete' | 'publish' | 'share' | 'baseline' | 'manage'
export type PermissionMenuId = 'project.view' | 'project.config' | 'joint.plan' | 'roadmap.table' | 'roadmap.evolution' | 'workbench' | 'permission.center' | `config.${string}` | `hr.${string}`
export type PermissionOperator = 'eq' | 'neq' | 'contains' | 'notContains' | 'in' | 'notIn' | 'empty' | 'notEmpty' | 'gt' | 'gte' | 'lt' | 'lte'
export interface PermissionField { key: string; label: string; kind: 'text' | 'enum' | 'number' | 'date'; options?: readonly string[]; required?: boolean }
export interface PermissionMenu { id: PermissionMenuId; label: string; category: string; actions: readonly PermissionAction[]; fields: readonly PermissionField[] }
export interface PermissionGroup { id: string; name: string }
export interface PermissionCenterRole { id: string; groupId: string; name: string; description: string; members: string[]; builtin?: 'superadmin' }
export interface PermissionCondition { id: string; field: string; operator: PermissionOperator; value?: string | number | string[] }
export interface MenuPolicy { roleId: string; menuId: PermissionMenuId; users: string[]; departments: string[]; actions: PermissionAction[]; data: { mode: 'all' | 'conditions'; conjunction: 'all' | 'any'; conditions: PermissionCondition[] }; columns: { mode: 'all' | 'selected'; fields: string[] } }
export interface PermissionCenterModel { version: 1; groups: PermissionGroup[]; roles: PermissionCenterRole[]; policies: MenuPolicy[] }
export type PermissionMutationResult = { ok: true; roleId?: string } | { ok: false; error: string }
export interface CenterRoleInput { name: string; groupName: string; description?: string }
