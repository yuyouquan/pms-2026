import { getPermissionFields, getPermissionMenu, PERMISSION_DEPARTMENTS, PERMISSION_MENUS, PERMISSION_USER_DEPARTMENTS, PERMISSION_USERS, SUPER_ADMIN_ROLE_ID } from '@/constants/permissionCenter'
import { canConfigureProjectScope, PROJECT_REGISTRY_MANAGERS } from '@/lib/projectRegistryPermissions'
import { getRegistryProjectTypes, getProjectAttribute, PROJECT_ATTRIBUTE_LABELS } from '@/types/projectRegistry'
import { getProjectInfoValue } from '@/lib/projectInfoValues'
import type { MenuPolicy, PermissionAction, PermissionCenterModel, PermissionCondition, PermissionField, PermissionMenuId, PermissionMutationResult } from '@/types/permissionCenter'
export const normalizePermissionName = (name: string) => name.trim().normalize('NFKC').toLocaleLowerCase()
export const createEmptyMenuPolicy = (roleId: string, menuId: PermissionMenuId): MenuPolicy => ({ roleId, menuId, users: [], departments: [], actions: [], data: { mode: 'all', conjunction: 'all', conditions: [] }, columns: { mode: 'all', fields: [] } })
export const isPermissionCenterAdmin = (model: PermissionCenterModel | undefined, user: string) => !!user && !!model?.roles.some(role => role.id === SUPER_ADMIN_ROLE_ID && role.builtin === 'superadmin' && role.members.includes(user))
export const getPermissionOperators = (field: PermissionField): PermissionCondition['operator'][] => ['eq', 'neq', 'in', 'notIn', 'empty', 'notEmpty', ...(field.kind === 'number' || field.kind === 'date' ? ['gt', 'gte', 'lt', 'lte'] as const : ['contains', 'notContains'] as const)]
const invalid = (error: string): PermissionMutationResult => ({ ok: false, error })
export function validateMenuPolicy(policy: MenuPolicy): PermissionMutationResult {
  if (!policy || typeof policy !== 'object') return invalid('权限策略格式无效')
  const menu = getPermissionMenu(policy.menuId)
  if (!menu || !policy.roleId || !Array.isArray(policy.actions) || !Array.isArray(policy.users) || !Array.isArray(policy.departments) || policy.users.some(user => typeof user !== 'string' || !user.trim()) || policy.departments.some(dept => !PERMISSION_DEPARTMENTS.includes(dept))) return invalid('菜单、人员或部门无效')
  if (policy.actions.some(action => !menu.actions.includes(action)) || (policy.actions.length > 0 && !policy.actions.includes('view'))) return invalid('功能权限无效；其他操作需要查看权限')
  if (!policy.data || !['all', 'conditions'].includes(policy.data.mode) || !['all', 'any'].includes(policy.data.conjunction) || !Array.isArray(policy.data.conditions)) return invalid('数据权限格式无效')
  const fields = getPermissionFields(policy.menuId)
  if (policy.data.mode === 'conditions') {
    if (!policy.data.conditions.length || !fields.length) return invalid('至少填写一条完整筛选条件')
    for (const condition of policy.data.conditions) {
      const field = fields.find(field => field.key === condition?.field)
      if (!field || !getPermissionOperators(field).includes(condition.operator)) return invalid('未知筛选字段或不支持的运算符')
      if (['empty', 'notEmpty'].includes(condition.operator)) continue
      const value = condition.value
      if (['in', 'notIn'].includes(condition.operator) ? !Array.isArray(value) || !value.length || value.some(item => typeof item !== 'string' || !item.trim()) : (typeof value !== 'string' && typeof value !== 'number') || !String(value).trim()) return invalid('条件未完整，尚未生效')
      if (field.kind === 'number' && (Array.isArray(value) ? value.some(item => !Number.isFinite(Number(item))) : !Number.isFinite(Number(value)))) return invalid('请输入有效数字')
      if (field.kind === 'date' && (Array.isArray(value) ? value.some(item => !Number.isFinite(Date.parse(item))) : !Number.isFinite(Date.parse(String(value))))) return invalid('请输入有效日期')
    }
  }
  if (!policy.columns || !['all', 'selected'].includes(policy.columns.mode) || !Array.isArray(policy.columns.fields)) return invalid('可见列格式无效')
  if (policy.columns.mode === 'selected' && (!policy.columns.fields.length || policy.columns.fields.some(key => !fields.some(field => field.key === key)) || fields.some(field => field.required && !policy.columns.fields.includes(field.key)))) return invalid('指定列不能为空，且必须保留必要识别列')
  return { ok: true }
}
/** Treat an action change as one atomic dependency change. */
export function normalizePolicyActions(actions: PermissionAction[], previous: readonly PermissionAction[] = []): PermissionAction[] {
  if (previous.includes('view') && !actions.includes('view')) return []
  return [...new Set(actions.length ? ['view' as const, ...actions] : [])]
}
export function readPermissionField(row: Record<string, unknown>, field: string): unknown {
  if (field === 'projectAttribute') return getProjectAttribute(row as any)
  if (row.fieldValues && typeof row.fieldValues === 'object' && Object.prototype.hasOwnProperty.call(row.fieldValues, field)) return (row.fieldValues as Record<string, unknown>)[field]
  return getProjectInfoValue(row as any, field) ?? row[field]
}
export function matchesPermissionCondition(row: Record<string, unknown>, condition: PermissionCondition, field?: PermissionField): boolean {
  const value = readPermissionField(row, condition.field)
  const values = Array.isArray(value) ? value.map(String) : [value == null ? '' : String(value)]
  const expected = Array.isArray(condition.value) ? condition.value : [String(condition.value ?? '')]
  const empty = values.every(value => !value.trim())
  const comparable = (value: string): string | number => field?.kind === 'number' ? Number(value) : field?.kind === 'date' ? Date.parse(value) : value
  const target = comparable(expected[0])
  const equalsExpected = (value: string) => (!(field?.kind === 'number' || field?.kind === 'date') || Boolean(value.trim())) && expected.some(item => comparable(value) === comparable(item))
  switch (condition.operator) {
    case 'empty': return empty
    case 'notEmpty': return !empty
    case 'eq': case 'in': return values.some(equalsExpected)
    case 'neq': case 'notIn': return !empty && values.every(value => !equalsExpected(value))
    case 'contains': return values.some(value => value.toLocaleLowerCase().includes(expected[0].toLocaleLowerCase()))
    case 'notContains': return !empty && values.every(value => !value.toLocaleLowerCase().includes(expected[0].toLocaleLowerCase()))
    case 'gt': return !empty && values.some(value => comparable(value) > target)
    case 'gte': return !empty && values.some(value => comparable(value) >= target)
    case 'lt': return !empty && values.some(value => comparable(value) < target)
    case 'lte': return !empty && values.some(value => comparable(value) <= target)
    default: return false
  }
}
export const matchesPermissionData = (policy: MenuPolicy, row: Record<string, unknown>) => policy.data.mode === 'all' || (policy.data.conjunction === 'all' ? policy.data.conditions.every(condition => matchesPermissionCondition(row, condition, getPermissionFields(policy.menuId).find(field => field.key === condition.field))) : policy.data.conditions.some(condition => matchesPermissionCondition(row, condition, getPermissionFields(policy.menuId).find(field => field.key === condition.field))))
export function getMatchingMenuPolicies(model: PermissionCenterModel | undefined, user: string, menuId: PermissionMenuId, action: PermissionAction, row?: Record<string, unknown>): MenuPolicy[] {
  if (!model || !user || !getPermissionMenu(menuId)?.actions.includes(action)) return []
  return model.policies.filter(policy => policy.menuId === menuId && model.roles.some(role => role.id === policy.roleId && role.id !== SUPER_ADMIN_ROLE_ID) && validateMenuPolicy(policy).ok && (policy.users.includes(user) || policy.departments.some(dept => PERMISSION_USER_DEPARTMENTS[user]?.includes(dept))) && policy.actions.includes(action) && (!row || matchesPermissionData(policy, row)))
}
export function evaluateMenuPermission(model: PermissionCenterModel | undefined, user: string, menuId: PermissionMenuId, action: PermissionAction = 'view', row?: Record<string, unknown>): boolean {
  if (!getPermissionMenu(menuId)?.actions.includes(action)) return false
  return isPermissionCenterAdmin(model, user) || getMatchingMenuPolicies(model, user, menuId, action, row).length > 0
}
/** For operations affecting a whole collection, conditional grants are insufficient. */
export function evaluateWholeMenuPermission(model: PermissionCenterModel | undefined, user: string, menuId: PermissionMenuId, action: PermissionAction): boolean {
  if (!getPermissionMenu(menuId)?.actions.includes(action)) return false
  return isPermissionCenterAdmin(model, user) || getMatchingMenuPolicies(model, user, menuId, action).some(policy => policy.data.mode === 'all' && policy.columns.mode === 'all')
}
export function getAuthorizedColumns(model: PermissionCenterModel | undefined, user: string, menuId: PermissionMenuId, action: PermissionAction = 'view', row?: Record<string, unknown>): string[] {
  if (isPermissionCenterAdmin(model, user)) return getPermissionFields(menuId).map(field => field.key)
  const policies = getMatchingMenuPolicies(model, user, menuId, action, row)
  return getPermissionFields(menuId).filter(field => policies.some(policy => policy.columns.mode === 'all' || policy.columns.fields.includes(field.key))).map(field => field.key)
}
/** Never combine one grant's rows with another grant's fields. Structural IDs carry no display data. */
export function projectAuthorizedRows<T extends object>(model: PermissionCenterModel | undefined, user: string, menuId: PermissionMenuId, action: PermissionAction, rows: readonly T[]): Partial<T>[] {
  return rows.flatMap(row => {
    const source = row as Record<string, unknown>
    if (!evaluateMenuPermission(model, user, menuId, action, source)) return []
    if (isPermissionCenterAdmin(model, user)) return [{ ...row }]
    const policies = getMatchingMenuPolicies(model, user, menuId, action, source)
    if (policies.some(policy => policy.columns.mode === 'all')) return [{ ...row }]
    const keys = getAuthorizedColumns(model, user, menuId, action, source)
    const projected: Record<string, unknown> = source.id === undefined ? {} : { id: source.id }
    for (const key of keys) { const value = readPermissionField(source, key); if (value !== undefined) projected[key] = value }
    return [projected as Partial<T>]
  })
}
export function legacyPermissionTargets(key: string): { menuId: PermissionMenuId; action: PermissionAction }[] {
  const [group, action] = key.split(':')
  if (group === 'roadmap' && ['view', 'edit', 'baseline', 'share', 'export'].includes(action)) return ['roadmap.table', 'roadmap.evolution'].filter(menuId => getPermissionMenu(menuId)?.actions.includes(action as PermissionAction)).map(menuId => ({ menuId: menuId as PermissionMenuId, action: action as PermissionAction }))
  if (key === 'permissionCenter:manageRoles') return [{ menuId: 'permission.center', action: 'manage' }]
  const prefixes: Record<string, string> = { planEdit: 'config.plan:', planPublish: 'config.plan:', transferEdit: 'config.transfer:', enumEdit: 'config.enum:', hrModelEdit: 'config.hrPipeline:hrModel', nonLaborSubjectEdit: 'config.hrPipeline:nonLaborSubject' }
  if (group !== 'configCenter' || !prefixes[action]) return []
  return PERMISSION_MENUS.filter(menu => menu.id.startsWith(prefixes[action])).flatMap(menu => {
    const targetAction: PermissionAction = action === 'planPublish' ? 'publish' : action === 'transferEdit' && !menu.id.endsWith(':team') ? 'import' : 'edit'
    return menu.actions.includes(targetAction) ? [{ menuId: menu.id, action: targetAction }] : []
  })
}
export function migrateLegacyPermissionCenter(roles: readonly { name: string; members: string[] }[], perms: Record<string, Record<string, boolean>>): PermissionCenterModel {
  const model: PermissionCenterModel = { version: 1, groups: [{ id: 'group-admin', name: '管理组' }, { id: 'group-roadmap', name: 'tOS路标组' }, { id: 'group-project', name: '项目组' }, { id: 'group-compat', name: '历史兼容授权' }], roles: [], policies: [] }
  model.roles.push({ id: SUPER_ADMIN_ROLE_ID, groupId: 'group-admin', name: '系统超级管理员', description: '内置全系统超级管理员', members: [...new Set(roles.filter(role => role.name === '管理组').flatMap(role => role.members))], builtin: 'superadmin' })
  roles.filter(role => role.name !== '管理组').forEach((role, index) => {
    const id = `legacy:${index}`
    model.roles.push({ id, groupId: 'group-compat', name: role.name, description: '迁移原全局角色', members: [] })
    const byMenu = new Map<PermissionMenuId, MenuPolicy>()
    Object.entries(perms[role.name] ?? {}).filter(([, enabled]) => enabled).forEach(([key]) => {
      const targets = legacyPermissionTargets(key)
      // Preserve historical grouped operations only in visible migration policies.
      if (key === 'configCenter:hrModelEdit') targets.push({ menuId: 'config.hrPipeline:feeRate', action: 'edit' }, { menuId: 'config.hrPipeline:hrModel', action: 'import' })
      if (key === 'configCenter:nonLaborSubjectEdit') targets.push({ menuId: 'config.hrPipeline:nonLaborSubject', action: 'import' })
      targets.forEach(({ menuId, action }) => {
      const policy = byMenu.get(menuId) ?? { ...createEmptyMenuPolicy(id, menuId), users: [...role.members] }
      policy.actions = [...new Set(['view' as const, ...policy.actions, action])]; byMenu.set(menuId, policy)
      })
    })
    model.policies.push(...byMenu.values())
  })
  const compatibilityId = 'compat:existing-navigation'
  model.roles.push({ id: compatibilityId, groupId: 'group-compat', name: '历史公开入口', description: '原先未配置全局权限的入口；可在此撤销', members: [] })
  const users = [...new Set([...PERMISSION_USERS, ...roles.flatMap(role => role.members)])]
  PERMISSION_MENUS.filter(menu => !menu.id.startsWith('roadmap.') && menu.id !== 'permission.center' && menu.id !== 'project.config').forEach(menu => {
    const actions: PermissionAction[] = ['view']
    if (menu.id === 'project.view' || menu.id.startsWith('config.transfer:') || menu.id.startsWith('config.hrPipeline:') || menu.id.startsWith('hr.config/')) {
      if (menu.actions.includes('export')) actions.push('export')
    }
    if (menu.id.startsWith('hr.config/')) actions.push('edit', 'import')
    model.policies.push({ ...createEmptyMenuPolicy(compatibilityId, menu.id), users, actions })
  })
  for (const attribute of ['formal', 'budget', 'roadmap'] as const) for (const type of getRegistryProjectTypes(attribute)) {
    const members = PROJECT_REGISTRY_MANAGERS.filter(user => canConfigureProjectScope(user, attribute, type, false))
    if (!members.length) continue
    const id = `compat:registry:${attribute}:${type}`
    model.roles.push({ id, groupId: 'group-compat', name: `项目配置负责人 / ${PROJECT_ATTRIBUTE_LABELS[attribute]} / ${type}`, description: '保留原指定负责人和项目类型、属性范围', members: [] })
    model.policies.push({ ...createEmptyMenuPolicy(id, 'project.config'), users: members, actions: ['view', 'create', 'edit'], data: { mode: 'conditions', conjunction: 'all', conditions: [{ id: 'attribute', field: 'projectAttribute', operator: 'eq', value: attribute }, { id: 'type', field: 'type', operator: 'eq', value: type }] } })
  }
  const templates = [['管理员', 'group-admin'], ['tOS路标管理组', 'group-roadmap'], ...['全量查看', 'TECNO', 'Infinix', 'itel'].map(name => [`tOS路标查看组-${name}`, 'group-roadmap']), ...['项目经理', 'XPM', '开发代表', '一般查看组'].map(name => [name, 'group-project'])]
  templates.forEach(([name, groupId], index) => { if (!model.roles.some(role => normalizePermissionName(role.name) === normalizePermissionName(name))) model.roles.push({ id: `template:${index}`, groupId, name, description: '', members: [] }) })
  return model
}
/** Persisted corruption never falls back to a newly privileged default. */
export function parsePermissionCenter(value: unknown): PermissionCenterModel {
  const empty: PermissionCenterModel = { version: 1, groups: [], roles: [], policies: [] }
  if (!value || typeof value !== 'object') return empty
  const model = value as PermissionCenterModel
  if (model.version !== 1 || !Array.isArray(model.groups) || !Array.isArray(model.roles) || !Array.isArray(model.policies)) return empty
  const groups = model.groups.filter(group => group && typeof group.id === 'string' && typeof group.name === 'string')
  const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string')
  const roles = model.roles.filter(role => role && typeof role.id === 'string' && typeof role.name === 'string' && (role.description === undefined || typeof role.description === 'string') && strings(role.members) && groups.some(group => group.id === role.groupId)).map(role => ({ ...role, description: role.description ?? '' }))
  // Keep structurally valid dynamic-field policies until their consumer registers metadata.
  // Drop malformed nested data before any UI/consumer reads it; never repair it to all.
  const policies = model.policies.filter(policy => {
    if (!policy || typeof policy !== 'object' || !roles.some(role => role.id === policy.roleId) || typeof policy.menuId !== 'string' || !strings(policy.users) || !strings(policy.departments) || !strings(policy.actions)) return false
    const { data, columns } = policy
    if (!data || !['all', 'conditions'].includes(data.mode) || !['all', 'any'].includes(data.conjunction) || !Array.isArray(data.conditions) || !columns || !['all', 'selected'].includes(columns.mode) || !strings(columns.fields)) return false
    return data.conditions.every(condition => condition && typeof condition.id === 'string' && typeof condition.field === 'string' && typeof condition.operator === 'string' && (condition.value === undefined || typeof condition.value === 'string' || (typeof condition.value === 'number' && Number.isFinite(condition.value)) || strings(condition.value)))
  })
  return { version: 1, groups, roles, policies }
}
