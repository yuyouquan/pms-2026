import { PERMISSION_MENUS, PERMISSION_USERS, SUPER_ADMIN_ROLE_ID } from '@/constants/permissionCenter'
import { canConfigureProjectScope, PROJECT_REGISTRY_MANAGERS } from '@/lib/projectRegistryPermissions'
import { getRegistryProjectTypes, PROJECT_ATTRIBUTE_LABELS } from '@/types/projectRegistry'
import type { MenuPolicy, PermissionAction, PermissionCenterModel, PermissionMenuId } from '@/types/permissionCenter'

/** Explicit demonstration grants. Existing v2 configurations never call this initializer. */
export function createPermissionCenterSeed(): PermissionCenterModel {
  const model: PermissionCenterModel = {
    version: 2,
    groups: [{ id: 'group-admin', name: '管理组' }, { id: 'group-roadmap', name: 'tOS路标组' }, { id: 'group-project', name: '项目组' }],
    roles: [
      { id: SUPER_ADMIN_ROLE_ID, groupId: 'group-admin', name: '系统超级管理员', description: '内置全系统超级管理员', members: ['演示用户01', '演示用户07'], departments: [], builtin: 'superadmin' },
      { id: 'admin', groupId: 'group-admin', name: '管理员', description: '管理配置中心及角色授权，按明确菜单授权生效', members: ['演示用户03'], departments: [] },
      { id: 'roadmap-manager', groupId: 'group-roadmap', name: 'tOS路标管理组', description: '维护路标表单与版本演进图', members: ['演示用户02'], departments: [] },
      { id: 'roadmap-reader-all', groupId: 'group-roadmap', name: 'tOS路标查看组-全量查看', description: '查看全部品牌路标', members: [], departments: ['示例质量组'] },
      ...['A', 'B', 'C'].map((brand, index) => ({ id: `roadmap-reader-${brand}`, groupId: 'group-roadmap', name: `tOS路标查看组-示例品牌${brand}`, description: `仅查看示例品牌${brand}路标`, members: [`演示用户0${index + 4}`], departments: [] })),
      { id: 'project-manager', groupId: 'group-project', name: '项目经理', description: '项目组查看项目并维护联合计划', members: [], departments: ['示例项目组'] },
      { id: 'project-xpm', groupId: 'group-project', name: 'XPM', description: '项目协调角色，待配置功能', members: [], departments: [] },
      { id: 'project-developer', groupId: 'group-project', name: '开发代表', description: '底软组查看项目及联合计划', members: [], departments: ['示例底软组'] },
      { id: 'project-reader', groupId: 'group-project', name: '一般查看组', description: '演示人员查看工作台和项目', members: [...PERMISSION_USERS], departments: [] },
    ], policies: [],
  }
  const grant = (roleId: string, menuId: PermissionMenuId, actions: PermissionAction[], patch: Partial<MenuPolicy> = {}) => model.policies.push({ roleId, menuId, actions, data: { mode: 'all', conjunction: 'all', conditions: [] }, columns: { mode: 'all', fields: [] }, ...patch })
  PERMISSION_MENUS.filter(menu => menu.id.startsWith('config.')).forEach(menu => grant('admin', menu.id, [...menu.actions]))
  grant('admin', 'permission.center', ['view', 'manage'])
  for (const menu of ['roadmap.table', 'roadmap.evolution'] as const) {
    grant('roadmap-manager', menu, ['view', 'export', 'edit', 'create', 'delete'])
    grant('roadmap-reader-all', menu, ['view', 'export'])
    for (const brand of ['A', 'B', 'C']) grant(`roadmap-reader-${brand}`, menu, ['view'], { data: { mode: 'conditions', conjunction: 'all', conditions: [{ id: 'brand', field: 'brand', operator: 'eq', value: `示例品牌${brand}` }] } })
  }
  grant('project-reader', 'workbench', ['view'])
  grant('project-reader', 'project.view', ['view', 'export'])
  for (const role of ['project-manager', 'project-developer']) {
    grant(role, 'project.view', ['view', 'export'])
    grant(role, 'joint.plan', role === 'project-manager' ? ['view', 'edit'] : ['view'])
  }
  for (const attribute of ['formal', 'budget', 'roadmap'] as const) for (const type of getRegistryProjectTypes(attribute)) {
    const members = PROJECT_REGISTRY_MANAGERS.filter(user => canConfigureProjectScope(user, attribute, type, false))
    if (!members.length) continue
    const id = `project-registry:${attribute}:${type}`
    model.roles.push({ id, groupId: 'group-project', name: `项目配置负责人 / ${PROJECT_ATTRIBUTE_LABELS[attribute]} / ${type}`, description: '按项目属性与类型分配配置范围', members, departments: [] })
    grant(id, 'project.config', ['view', 'create', 'edit'], { data: { mode: 'conditions', conjunction: 'all', conditions: [{ id: 'attribute', field: 'projectAttribute', operator: 'eq', value: attribute }, { id: 'type', field: 'type', operator: 'eq', value: type }] } })
  }
  return model
}
