import { ROLE_TEMPLATE_TYPES } from '@/types/rolePermissionTemplate'
import { CONFIG_MENU_GROUPS } from '@/lib/configNavigation'
import { HR_SIDEBAR_NAV } from '@/constants/hrPipeline'
import { ROADMAP_COLUMNS } from '@/types/roadmap'
import { MACHINE_PROJECT_INFO_FIELDS, TOS_PROJECT_INFO_FIELDS, TECHNICAL_PROJECT_INFO_FIELDS } from '@/constants/projectInfoSchema'
import { MOCK_TM_USERS } from '@/mock/transfer-maintenance'
import { PROJECT_USER_CHOICES } from '@/lib/projectUserDirectory'
import type { PermissionAction, PermissionField, PermissionMenu, PermissionMenuId } from '@/types/permissionCenter'
export const SUPER_ADMIN_ROLE_ID = 'builtin:superadmin'
export const PERMISSION_ACTION_LABELS: Record<PermissionAction, string> = { view: '查看', export: '导出', import: '导入', create: '新增', edit: '编辑', delete: '删除', publish: '发布', share: '分享', baseline: '基线', manage: '管理' }
export const PERMISSION_USERS = PROJECT_USER_CHOICES
export const PERMISSION_DEPARTMENTS = [...new Set(MOCK_TM_USERS.map(user => user.department))]
export const PERMISSION_USER_DEPARTMENTS: Record<string, readonly string[]> = Object.fromEntries(MOCK_TM_USERS.map(user => [user.name, [user.department]]))
const core: PermissionField[] = [{ key: 'name', label: '项目名称', kind: 'text', required: true }, { key: 'code', label: '项目编码', kind: 'text' }, { key: 'type', label: '项目类型', kind: 'enum' }, { key: 'projectAttribute', label: '项目属性', kind: 'enum', options: ['formal', 'budget', 'roadmap'] }, { key: 'status', label: '状态', kind: 'enum' }, { key: 'leader', label: '负责人', kind: 'text' }, { key: 'progress', label: '进度', kind: 'number' }]
export const PERMISSION_PROJECT_FIELDS: PermissionField[] = [...new Map([...core, ...[...MACHINE_PROJECT_INFO_FIELDS, ...TOS_PROJECT_INFO_FIELDS, ...TECHNICAL_PROJECT_INFO_FIELDS].map(field => ({ key: field.key, label: field.label, kind: field.inputType === 'date' ? 'date' as const : field.options ? 'enum' as const : 'text' as const, options: field.options }))].map(field => [field.key, field])).values()].map(field => ({ ...field, required: field.key === 'name' }))
const roadmapFields = (evolution: boolean): PermissionField[] => ROADMAP_COLUMNS.map(field => ({ key: field.key, label: field.label, kind: field.kind === 'date' ? 'date' : field.kind === 'enum' ? 'enum' : 'text', required: evolution ? ['firstSaleTosVersionId', 'marketName', 'displayName'].includes(field.key) : field.key === 'firstSaleTosVersionId', ...(field.key === 'brand' ? { options: ['示例品牌A', '示例品牌B', '示例品牌C', '待定', '其他品牌'] } : {}) }))
export const PERMISSION_MENUS: PermissionMenu[] = [
  { id: 'workbench', label: '工作台', category: '工作台', actions: ['view'], fields: [] },
  { id: 'project.view', label: '项目视图', category: '项目管理', actions: ['view', 'export'], fields: PERMISSION_PROJECT_FIELDS },
  { id: 'project.config', label: '项目配置', category: '项目管理', actions: ['view', 'export', 'create', 'edit', 'delete'], fields: PERMISSION_PROJECT_FIELDS },
  { id: 'joint.plan', label: 'tOS&整机1+N项目计划', category: '项目组合管理', actions: ['view', 'edit'], fields: [] },
  ...(['table', 'evolution'] as const).map(view => ({ id: `roadmap.${view}` as PermissionMenuId, label: view === 'table' ? '表单视图' : '版本演进图', category: 'tOS路标', actions: ['view', 'export', 'edit', 'create', 'delete'] as PermissionAction[], fields: roadmapFields(view === 'evolution') })),
  ...HR_SIDEBAR_NAV.flatMap(group => group.children.map(leaf => ({ id: `hr.${leaf.key}` as PermissionMenuId, label: leaf.label, category: `人力资源管道 / ${group.label}`, actions: (group.key === 'config' ? ['view', 'edit', 'import', 'export'] : ['view']) as PermissionAction[], fields: [] }))),
  ...CONFIG_MENU_GROUPS.flatMap(group => group.children.map(leaf => ({ id: `config.${leaf.key}` as PermissionMenuId, label: leaf.target.module === 'transfer' ? `${leaf.target.projectType} / ${leaf.label}` : leaf.label, category: `配置中心 / ${group.label}`, actions: (group.key === 'plan' ? ['view', 'edit', 'publish'] : leaf.target.module === 'transfer' && leaf.target.view !== 'team' ? ['view', 'import', 'export'] : leaf.target.module === 'hrPipeline' && leaf.target.moduleKey !== 'feeRate' ? ['view', 'edit', 'import', 'export'] : ['view', 'edit']) as PermissionAction[], fields: [] }))),
  ...ROLE_TEMPLATE_TYPES.map(type => ({ id: `config.rolePermission:${type}` as PermissionMenuId, label: type, category: '配置中心 / 角色权限配置模板', actions: ['view', 'edit'] as PermissionAction[], fields: [] })),
  { id: 'permission.center', label: '角色与权限配置', category: '权限中心', actions: ['view', 'manage'], fields: [] },
]
export const getPermissionMenu = (id: string) => PERMISSION_MENUS.find(menu => menu.id === id)
const registeredFields = new Map<string, readonly PermissionField[]>()
/** Consumers register actual dynamic business metadata; unknown stored fields deny until registered. */
export function registerPermissionFields(id: PermissionMenuId, fields: readonly PermissionField[]): void {
  if (!getPermissionMenu(id)) throw new Error('未知权限菜单')
  registeredFields.set(id, [...new Map([...(getPermissionMenu(id)?.fields ?? []), ...fields].map(field => [field.key, field])).values()])
}
export const getPermissionFields = (id: string): readonly PermissionField[] => registeredFields.get(id) ?? getPermissionMenu(id)?.fields ?? []
