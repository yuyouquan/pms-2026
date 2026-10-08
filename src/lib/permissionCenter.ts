import { canConfigureProjectScope, PROJECT_REGISTRY_MANAGERS } from '@/lib/projectRegistryPermissions'
import { getPermissionFields, getPermissionMenu, PROJECT_DATA_SCOPES, PERMISSION_DEPARTMENTS, PERMISSION_MENUS, PERMISSION_USER_DEPARTMENTS, PERMISSION_USERS, SUPER_ADMIN_ROLE_ID } from '@/constants/permissionCenter'
import { getRegistryProjectTypes, getProjectAttribute, PROJECT_ATTRIBUTE_LABELS } from '@/types/projectRegistry'
import { getProjectInfoValue } from '@/lib/projectInfoValues'
import type { MenuPolicy, PermissionAction, PermissionCenterModel, PermissionCondition, PermissionCenterRole, PermissionField, PermissionMenuId, PermissionMutationResult, ProjectDataScope } from '@/types/permissionCenter'
import { getProjectDataPolicy, getProjectDataScope } from '@/lib/projectPermissionScope'
export const normalizePermissionName = (name: string) => name.trim().normalize('NFKC').toLocaleLowerCase()
export const createEmptyMenuPolicy = (roleId: string, menuId: PermissionMenuId): MenuPolicy => ({ roleId, menuId, actions: [], data: { mode: 'all', conjunction: 'all', conditions: [] }, columns: { mode: 'all', fields: [] } })
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string')
const validRoleAssignees = (role: PermissionCenterRole) => strings(role.members) && strings(role.departments) && role.members.every(user => PERMISSION_USERS.includes(user)) && role.departments.every(dept => PERMISSION_DEPARTMENTS.includes(dept))
export function isRoleAssignedToUser(role: PermissionCenterRole, user: string): boolean {
  if (!user || !role || !validRoleAssignees(role)) return false
  if (role.id === SUPER_ADMIN_ROLE_ID || role.builtin === 'superadmin') return role.id === SUPER_ADMIN_ROLE_ID && role.builtin === 'superadmin' && role.departments.length === 0 && role.members.includes(user)
  return role.members.includes(user) || role.departments.some(dept => PERMISSION_USER_DEPARTMENTS[user]?.includes(dept))
}
export function getAssignedPermissionUsers(model: PermissionCenterModel): string[] {
  return model?.version === 2 ? PERMISSION_USERS.filter(user => model.roles.some(role => isRoleAssignedToUser(role, user))) : []
}
export const isPermissionCenterAdmin = (model: PermissionCenterModel | undefined, user: string) => model?.version === 2 && !!model.roles.some(role => role.id === SUPER_ADMIN_ROLE_ID && role.builtin === 'superadmin' && isRoleAssignedToUser(role, user))
export const getPermissionOperators = (field: PermissionField): PermissionCondition['operator'][] => ['eq', 'neq', 'in', 'notIn', 'empty', 'notEmpty', ...(field.kind === 'number' || field.kind === 'date' ? ['gt', 'gte', 'lt', 'lte'] as const : ['contains', 'notContains'] as const)]
const invalid = (error: string): PermissionMutationResult => ({ ok: false, error })
export function validateMenuPolicy(policy: MenuPolicy, scope?: ProjectDataScope): PermissionMutationResult {
  if (!policy || typeof policy !== 'object') return invalid('权限策略格式无效')
  const menu = getPermissionMenu(policy.menuId)
  if (!menu || !policy.roleId || !Array.isArray(policy.actions) || 'users' in policy || 'departments' in policy) return invalid('菜单或策略格式无效')
  if (policy.actions.some(action => !menu.actions.includes(action)) || (policy.actions.length > 0 && !policy.actions.includes('view'))) return invalid('功能权限无效；其他操作需要查看权限')
  if (!policy.data || !['all', 'conditions'].includes(policy.data.mode) || !['all', 'any'].includes(policy.data.conjunction) || !Array.isArray(policy.data.conditions)) return invalid('数据权限格式无效')
  if (policy.projectScopes !== undefined) {
    if (scope || policy.menuId !== 'project.view' || !policy.projectScopes || typeof policy.projectScopes !== 'object' || Array.isArray(policy.projectScopes)) return invalid('项目类型数据权限格式无效')
    for (const [key, rule] of Object.entries(policy.projectScopes)) {
      if (!PROJECT_DATA_SCOPES.includes(key as ProjectDataScope) || !rule || typeof rule !== 'object' || Object.keys(rule).some(key => !['data', 'columns'].includes(key))) return invalid('项目类型数据权限格式无效')
      const result = validateMenuPolicy({ ...getProjectDataPolicy(policy), data: rule.data, columns: rule.columns }, key as ProjectDataScope)
      if (!result.ok) return result
    }
  }
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
  if (policy.columns.mode === 'selected' && (!scope && !policy.columns.fields.length || policy.columns.fields.some(key => !fields.some(field => field.key === key)) || !scope && fields.some(field => field.required && !policy.columns.fields.includes(field.key)))) return invalid('指定列不能为空，且必须保留必要识别列')
  return { ok: true }
}
/** Treat an action change as one atomic dependency change. */
export function normalizePolicyActions(actions: PermissionAction[], previous: readonly PermissionAction[] = []): PermissionAction[] {
  if (previous.includes('view') && !actions.includes('view')) return []
  return [...new Set(actions.length ? ['view' as const, ...actions] : [])]
}
export function readPermissionField(row: Record<string, unknown>, field: string): unknown {
  if (field === 'projectName') return row.projectName ?? row.name
  if (field === 'projectCategory') return row.projectCategory ?? row.type
  if (field === 'projectCode') return row.projectCode ?? row.code
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
export function getMatchingMenuPolicies(model: PermissionCenterModel | undefined, user: string, menuId: PermissionMenuId, action: PermissionAction, row?: Record<string, unknown>, scope?: ProjectDataScope): MenuPolicy[] {
  if (model?.version !== 2 || !user || !getPermissionMenu(menuId)?.actions.includes(action)) return []
  const effectiveScope = menuId === 'project.view' ? scope ?? getProjectDataScope(row) : undefined
  return model.policies.flatMap(policy => {
    if (policy.menuId !== menuId || !model.roles.some(role => role.id === policy.roleId && role.id !== SUPER_ADMIN_ROLE_ID && isRoleAssignedToUser(role, user)) || !validateMenuPolicy(policy).ok || !policy.actions.includes(action)) return []
    // A row with unknown classification cannot bypass type-specific restrictions.
    if (menuId === 'project.view' && policy.projectScopes && row && !effectiveScope) return []
    const candidates = menuId === 'project.view' && !row && !effectiveScope && policy.projectScopes
      ? PROJECT_DATA_SCOPES.map(key => getProjectDataPolicy(policy, key))
      : [getProjectDataPolicy(policy, effectiveScope)]
    return candidates.filter(candidate => !row || matchesPermissionData(candidate, row))
  })
}
export function evaluateMenuPermission(model: PermissionCenterModel | undefined, user: string, menuId: PermissionMenuId, action: PermissionAction = 'view', row?: Record<string, unknown>): boolean {
  if (!getPermissionMenu(menuId)?.actions.includes(action)) return false
  return isPermissionCenterAdmin(model, user) || getMatchingMenuPolicies(model, user, menuId, action, row).length > 0
}
/** Whole-collection operations require a full grant for every project type, not just one type. */
export function evaluateWholeMenuPermission(model: PermissionCenterModel | undefined, user: string, menuId: PermissionMenuId, action: PermissionAction): boolean {
  if (!getPermissionMenu(menuId)?.actions.includes(action)) return false
  if (isPermissionCenterAdmin(model, user)) return true
  const unrestricted = (scope?: ProjectDataScope) => getMatchingMenuPolicies(model, user, menuId, action, undefined, scope).some(policy => policy.data.mode === 'all' && policy.columns.mode === 'all')
  return menuId === 'project.view' ? PROJECT_DATA_SCOPES.every(unrestricted) : unrestricted()
}
export function getAuthorizedColumns(model: PermissionCenterModel | undefined, user: string, menuId: PermissionMenuId, action: PermissionAction = 'view', row?: Record<string, unknown>, scope?: ProjectDataScope): string[] {
  if (isPermissionCenterAdmin(model, user)) return getPermissionFields(menuId).map(field => field.key)
  const policies = getMatchingMenuPolicies(model, user, menuId, action, row, scope)
  const keys = getPermissionFields(menuId).filter(field => policies.some(policy => policy.columns.mode === 'all' || policy.columns.fields.includes(field.key))).map(field => field.key)
  if (menuId !== 'project.view') return keys
  // List aliases refer to the same value, not a second independent grant.
  for (const [list, source] of [['projectName', 'name'], ['projectCategory', 'type'], ['projectCode', 'code']]) {
    if (keys.includes(list) && !keys.includes(source)) keys.push(source)
    if (keys.includes(source) && !keys.includes(list)) keys.push(list)
  }
  const effectiveScope = scope ?? getProjectDataScope(row)
  // Selecting a named project-type scope already discloses that category. Secondary categories still need a grant.
  if (effectiveScope && policies.some(policy => model?.policies.some(source => source.roleId === policy.roleId && source.menuId === menuId && source.projectScopes?.[effectiveScope]))) {
    if (!keys.includes('type')) keys.push('type')
    if (!keys.includes('projectCategory')) keys.push('projectCategory')
  }
  return keys
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
/** Ephemeral fallback for old standalone consumers only; persisted initialization uses clean v2 seeds. */
export function migrateLegacyPermissionCenter(roles: readonly { name: string; members: string[] }[], perms: Record<string, Record<string, boolean>>): PermissionCenterModel {
  const model: PermissionCenterModel = { version: 2, groups: [{ id: 'group-admin', name: '管理组' }, { id: 'group-roadmap', name: 'tOS路标组' }, { id: 'group-project', name: '项目组' }, { id: 'group-compat', name: '历史兼容授权' }], roles: [], policies: [] }
  model.roles.push({ id: SUPER_ADMIN_ROLE_ID, groupId: 'group-admin', name: '系统超级管理员', description: '内置全系统超级管理员', members: [...new Set(roles.filter(role => role.name === '管理组').flatMap(role => role.members))], departments: [], builtin: 'superadmin' })
  roles.filter(role => role.name !== '管理组').forEach((role, index) => {
    const id = `legacy:${index}`
    model.roles.push({ id, groupId: 'group-compat', name: role.name, description: '迁移原全局角色', members: [...role.members], departments: [] })
    const byMenu = new Map<PermissionMenuId, MenuPolicy>()
    Object.entries(perms[role.name] ?? {}).filter(([, enabled]) => enabled).forEach(([key]) => {
      const targets = legacyPermissionTargets(key)
      // Preserve historical grouped operations only in visible migration policies.
      if (key === 'configCenter:hrModelEdit') targets.push({ menuId: 'config.hrPipeline:feeRate', action: 'edit' }, { menuId: 'config.hrPipeline:hrModel', action: 'import' })
      if (key === 'configCenter:nonLaborSubjectEdit') targets.push({ menuId: 'config.hrPipeline:nonLaborSubject', action: 'import' })
      targets.forEach(({ menuId, action }) => {
      const policy = byMenu.get(menuId) ?? createEmptyMenuPolicy(id, menuId)
      policy.actions = [...new Set(['view' as const, ...policy.actions, action])]; byMenu.set(menuId, policy)
      })
    })
    model.policies.push(...byMenu.values())
  })
  const compatibilityId = 'compat:existing-navigation'
  model.roles.push({ id: compatibilityId, groupId: 'group-compat', name: '历史公开入口', description: '原先未配置全局权限的入口；可在此撤销', members: [], departments: [] })
  model.roles.find(role => role.id === compatibilityId)!.members = [...PERMISSION_USERS]
  PERMISSION_MENUS.filter(menu => !menu.id.startsWith('roadmap.') && menu.id !== 'permission.center' && menu.id !== 'project.config' && menu.id !== 'project.space').forEach(menu => {
    const actions: PermissionAction[] = ['view']
    if (menu.id === 'project.view' || menu.id.startsWith('config.transfer:') || menu.id.startsWith('config.hrPipeline:') || menu.id.startsWith('hr.config/')) {
      if (menu.actions.includes('export')) actions.push('export')
    }
    if (menu.id.startsWith('hr.config/')) actions.push('edit', 'import')
    model.policies.push({ ...createEmptyMenuPolicy(compatibilityId, menu.id), actions })
  })
  for (const attribute of ['formal', 'budget', 'roadmap'] as const) for (const type of getRegistryProjectTypes(attribute)) {
    const members = PROJECT_REGISTRY_MANAGERS.filter(user => canConfigureProjectScope(user, attribute, type, false))
    if (!members.length) continue
    const id = `compat:registry:${attribute}:${type}`
    model.roles.push({ id, groupId: 'group-compat', name: `项目配置负责人 / ${PROJECT_ATTRIBUTE_LABELS[attribute]} / ${type}`, description: '保留原指定负责人和项目类型、属性范围', members, departments: [] })
    model.policies.push({ ...createEmptyMenuPolicy(id, 'project.config'), actions: ['view', 'create', 'edit'], data: { mode: 'conditions', conjunction: 'all', conditions: [{ id: 'attribute', field: 'projectAttribute', operator: 'eq', value: attribute }, { id: 'type', field: 'type', operator: 'eq', value: type }] } })
  }
  const templates = [['管理员', 'group-admin'], ['tOS路标管理组', 'group-roadmap'], ...['全量查看', 'TECNO', 'Infinix', 'itel'].map(name => [`tOS路标查看组-${name}`, 'group-roadmap']), ...['项目经理', 'XPM', '开发代表', '一般查看组'].map(name => [name, 'group-project'])]
  templates.forEach(([name, groupId], index) => { if (!model.roles.some(role => normalizePermissionName(role.name) === normalizePermissionName(name))) model.roles.push({ id: `template:${index}`, groupId, name, description: '', members: [], departments: [] }) })
  return model
}
/** Runtime models never read menu-level assignees. */
export function parsePermissionCenter(value: unknown): PermissionCenterModel {
  const empty: PermissionCenterModel = { version: 2, groups: [], roles: [], policies: [] }
  if (!value || typeof value !== 'object') return empty
  const model = value as PermissionCenterModel
  if (model.version !== 2 || !Array.isArray(model.groups) || !Array.isArray(model.roles) || !Array.isArray(model.policies)) return empty
  const groups = model.groups.filter(group => group && typeof group.id === 'string' && !!group.id.trim() && typeof group.name === 'string')
  const roles = model.roles.filter(role => role && typeof role.id === 'string' && !!role.id.trim() && typeof role.name === 'string' && typeof role.description === 'string' && validRoleAssignees(role) && groups.some(group => group.id === role.groupId) && (role.builtin === undefined || role.builtin === 'superadmin' && role.id === SUPER_ADMIN_ROLE_ID && !role.departments.length)).filter(role => model.roles.filter(candidate => candidate?.id === role.id).length === 1)
  // Preserve structurally valid dynamic-field conditions until metadata registers.
  const policies = model.policies.filter(policy => isStructuralPolicy(policy, roles.map(role => role.id), false)).map(policy => policy.data.mode === 'all' ? { ...policy, data: { ...policy.data, conditions: [] } } : policy)
  return { version: 2, groups, roles, policies }
}
function isStructuralPolicy(value: unknown, roleIds: string[], legacy: boolean, scope?: ProjectDataScope): boolean {
  if (!value || typeof value !== 'object') return false
  const policy = value as MenuPolicy & { users?: unknown; departments?: unknown }
  if (!roleIds.includes(policy.roleId) || !getPermissionMenu(policy.menuId) || !strings(policy.actions) || policy.actions.some(action => !getPermissionMenu(policy.menuId)!.actions.includes(action)) || policy.actions.length > 0 && !policy.actions.includes('view')) return false
  if (legacy ? !strings(policy.users) || !strings(policy.departments) || policy.users.some(user => !PERMISSION_USERS.includes(user)) || policy.departments.some(dept => !PERMISSION_DEPARTMENTS.includes(dept)) : 'users' in policy || 'departments' in policy) return false
  if (policy.projectScopes !== undefined) {
    if (scope || policy.menuId !== 'project.view' || !policy.projectScopes || typeof policy.projectScopes !== 'object' || Array.isArray(policy.projectScopes)) return false
    for (const [key, rule] of Object.entries(policy.projectScopes)) {
      if (!PROJECT_DATA_SCOPES.includes(key as ProjectDataScope) || !rule || typeof rule !== 'object' || Object.keys(rule).some(key => !['data', 'columns'].includes(key))) return false
      if (!isStructuralPolicy({ ...getProjectDataPolicy(policy), data: rule.data, columns: rule.columns }, roleIds, legacy, key as ProjectDataScope)) return false
    }
  }
  const { data, columns } = policy
  if (!data || !['all', 'conditions'].includes(data.mode) || !['all', 'any'].includes(data.conjunction) || !Array.isArray(data.conditions) || !columns || !['all', 'selected'].includes(columns.mode) || !strings(columns.fields)) return false
  if (data.mode === 'conditions' && !data.conditions.length || columns.mode === 'selected' && !scope && !columns.fields.length) return false
  const fields = getPermissionFields(policy.menuId)
  if (columns.mode === 'selected' && (columns.fields.some(key => !key.trim()) || !scope && fields.some(field => field.required && !columns.fields.includes(field.key)))) return false
  // All-data ignores discarded filter drafts, matching validation and evaluation.
  if (data.mode === 'all') return true
  return data.conditions.every(condition => {
    if (!condition || typeof condition.id !== 'string' || !condition.id.trim() || typeof condition.field !== 'string' || !condition.field.trim() || !['eq', 'neq', 'contains', 'notContains', 'in', 'notIn', 'empty', 'notEmpty', 'gt', 'gte', 'lt', 'lte'].includes(condition.operator)) return false
    const field = fields.find(field => field.key === condition.field)
    if (field && !getPermissionOperators(field).includes(condition.operator)) return false
    if (['empty', 'notEmpty'].includes(condition.operator)) return true
    const value = condition.value
    if (['in', 'notIn'].includes(condition.operator) ? !strings(value) || !value.length || value.some(item => !item.trim()) : (typeof value !== 'string' && typeof value !== 'number') || !String(value).trim()) return false
    const values = Array.isArray(value) ? value : [value]
    if (values.some(item => typeof item === 'number' && !Number.isFinite(item))) return false
    if (field?.kind === 'number' && values.some(item => !Number.isFinite(Number(item)))) return false
    if (field?.kind === 'date' && values.some(item => !Number.isFinite(Date.parse(String(item))))) return false
    return true
  })
}
/** A reset grants demo authority, so recognize the complete old snapshot before resetting. */
export function isValidLegacyPermissionCenter(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const model = value as { version: number; groups: PermissionCenterModel['groups']; roles: PermissionCenterRole[]; policies: unknown[] }
  if (model.version !== 1 || !Array.isArray(model.groups) || !model.groups.length || !Array.isArray(model.roles) || !model.roles.length || !Array.isArray(model.policies)) return false
  if (!model.groups.every(group => group && typeof group.id === 'string' && !!group.id.trim() && typeof group.name === 'string' && !!group.name.trim()) || new Set(model.groups.map(group => group.id)).size !== model.groups.length) return false
  if (!model.roles.every(role => role && typeof role.id === 'string' && !!role.id.trim() && typeof role.name === 'string' && !!role.name.trim() && (role.description === undefined || typeof role.description === 'string') && strings(role.members) && role.members.every(user => PERMISSION_USERS.includes(user)) && model.groups.some(group => group.id === role.groupId) && (role.builtin === undefined || role.builtin === 'superadmin' && role.id === SUPER_ADMIN_ROLE_ID)) || new Set(model.roles.map(role => role.id)).size !== model.roles.length) return false
  if (!model.roles.some(role => role.id === SUPER_ADMIN_ROLE_ID && role.builtin === 'superadmin' && role.members.length)) return false
  return model.policies.every(policy => isStructuralPolicy(policy, model.roles.map(role => role.id), true))
}
