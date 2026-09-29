import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
const load = createTypeScriptModuleLoader()
const { usePermissionStore } = load(path.resolve('src/stores/permission.ts'))
const permission = usePermissionStore.getState()
assert.equal(typeof permission.toggleProjectRolePermissions, 'function', 'project bulk authorization must be atomic')
const { useRolePermissionTemplateStore } = load(path.resolve('src/stores/rolePermissionTemplates.ts'))
permission.ensurePermissionCenter()
const store = useRolePermissionTemplateStore.getState
const type = '整机产品项目', other = '技术项目', admin = '演示用户01'
const input = { roleName: ' New ', ipmRoleCode: ' NEW ', pmsRoleCode: ' NEWPMS ' }
const created = store().createTemplate(admin, type, input)
assert.equal(created.ok, true)
const row = store().templatesByType[type].find(row => row.id === created.roleId)
assert.equal(row.ipmRoleCode, 'NEW')
assert.equal(store().createTemplate(admin, type, input).ok, false, 'duplicate IPM/PMS codes reject entire row')
assert.equal(store().createTemplate(admin, other, input).ok, true, 'codes isolated per type')
assert.equal(store().updateTemplate(admin, type, row.id, { ...input, roleName: '  ' }).ok, false)
assert.equal(store().updateTemplate(admin, type, row.id, { ...input, roleName: 'Renamed' }).ok, true)
assert.equal(store().updateTemplateGrants(admin, type, row.id, ['basicInfo:编辑'], true).ok, true)
assert.equal(store().templatesByType[type].find(item => item.id === row.id).grants['basicInfo:编辑'], true)
const before = JSON.stringify(store().templatesByType)
assert.equal(store().updateTemplateGrants(admin, type, row.id, ['basicInfo:查看', 'plan:导入'], true).ok, false)
assert.equal(JSON.stringify(store().templatesByType), before, 'invalid batch cannot partially save')
assert.equal(store().deleteTemplate('演示用户10', type, row.id).ok, false)
assert.equal(store().deleteTemplate(admin, type, row.id).ok, true)
assert.equal(permission.createProjectRole(admin, '1', { name: 'Local Assignment', groupName: 'Local' }).ok, true)
assert.equal(permission.setProjectRoleAssignees(admin, '1', 'Local Assignment', { users: ['演示用户11'], departments: [] }).ok, true)
const beforeAssignments = JSON.stringify(usePermissionStore.getState().rolesByProject['1'])
assert.equal(permission.setProjectRoleAssignees(admin, '1', 'Local Assignment', { users: ['演示用户10'], departments: ['invalid department'] }).ok, false)
assert.equal(JSON.stringify(usePermissionStore.getState().rolesByProject['1']), beforeAssignments, 'invalid department cannot partially assign users')
console.log('PASS role template CRUD, isolation, validation and atomic grant operations')

// Authorization is checked for the exact type on every mutation, including self revoke.
const roleId = permission.createCenterRole(admin, { name: '模板编辑员', groupName: '验证' }).roleId
permission.setCenterRoleAssignees(admin, roleId, { users: ['演示用户10'], departments: [] })
assert.equal(permission.updateMenuActionsBulk(admin, roleId, [{ menuId: `config.rolePermission:${type}`, actions: ['edit'] }], true).ok, true)
assert.equal(store().createTemplate('演示用户10', type, { ...input, ipmRoleCode: 'SCOPE', pmsRoleCode: 'SCOPE' }).ok, true)
assert.equal(store().createTemplate('演示用户10', other, { ...input, ipmRoleCode: 'SCOPE', pmsRoleCode: 'SCOPE' }).ok, false)
const centerBefore = JSON.stringify(usePermissionStore.getState().permissionCenter)
assert.equal(permission.updateMenuActionsBulk(admin, roleId, [{ menuId: `config.rolePermission:${type}`, actions: ['view'] }, { menuId: 'workbench', actions: ['edit'] }], false).ok, false)
assert.equal(JSON.stringify(usePermissionStore.getState().permissionCenter), centerBefore)
permission.updateMenuActionsBulk(admin, roleId, [{ menuId: `config.rolePermission:${type}`, actions: ['view', 'edit'] }], false)
assert.equal(store().createTemplate('演示用户10', type, { ...input, ipmRoleCode: 'REVOKED', pmsRoleCode: 'REVOKED' }).ok, false)

// A manager may revoke its own management and other menus in one complete transaction.
permission.updateMenuActionsBulk(admin, roleId, [{ menuId: 'permission.center', actions: ['manage'] }, { menuId: 'project.view', actions: ['export'] }], true)
assert.equal(permission.updateMenuActionsBulk('演示用户10', roleId, [{ menuId: 'permission.center', actions: ['view', 'manage'] }, { menuId: 'project.view', actions: ['view', 'export'] }], false).ok, true)
assert.equal(usePermissionStore.getState().permissionCenter.policies.some(policy => policy.roleId === roleId && policy.actions.length > 0), false)
assert.equal(permission.updateMenuActionsBulk('演示用户10', roleId, [{ menuId: 'project.view', actions: ['view'] }], true).ok, false)
// Browser storage is the only fake; all stores, migration, policy and initialization are real.
const { createCurrentDatasetStorage } = await import('./lib/mock-dataset-storage.mjs')
const browserStorage = createCurrentDatasetStorage()
globalThis.window = { localStorage: browserStorage }
const freshLoad = createTypeScriptModuleLoader()
const p2 = freshLoad(path.resolve('src/stores/permission.ts'))
const t2 = freshLoad(path.resolve('src/stores/rolePermissionTemplates.ts'))
p2.usePermissionStore.getState().ensurePermissionCenter()
const source = p2.getSyncedProjectRoles('1').find(row => row.ipmRoleCode === 'RJPM')
const unmapped = p2.getSyncedProjectRoles('1').find(row => row.ipmRoleCode === 'UNMAPPED')
assert.equal(unmapped.pmsRoleCode, '')
assert.equal(p2.usePermissionStore.getState().toggleProjectRolePermissions(admin, '1', { source: 'ipm', id: source.id }, Object.keys(source.grants), false).ok, true)
const persistedBefore = browserStorage.getItem(t2.ROLE_TEMPLATE_STORAGE_KEY)
const memoryBefore = JSON.stringify(t2.useRolePermissionTemplateStore.getState().copiesByProject)
const rawSet = browserStorage.setItem
browserStorage.setItem = () => { throw new Error('storage quota') }
assert.equal(p2.usePermissionStore.getState().toggleProjectRolePermissions(admin, '1', { source: 'ipm', id: source.id }, ['basicInfo:编辑', 'resource:laborEdit'], true).ok, false)
assert.equal(JSON.stringify(t2.useRolePermissionTemplateStore.getState().copiesByProject), memoryBefore)
assert.equal(browserStorage.getItem(t2.ROLE_TEMPLATE_STORAGE_KEY), persistedBefore)
assert.equal(t2.useRolePermissionTemplateStore.getState().createTemplate(admin, type, input).ok, false)
const projectBefore = JSON.stringify(p2.usePermissionStore.getState().rolePermissionsByProject)
assert.equal(p2.usePermissionStore.getState().toggleProjectRolePermissions(admin, '1', { source: 'local', name: '系统管理员' }, ['basicInfo:编辑'], false).ok, false)
assert.equal(JSON.stringify(p2.usePermissionStore.getState().rolePermissionsByProject), projectBefore)
const assignmentBefore = JSON.stringify(p2.usePermissionStore.getState().rolesByProject)
assert.equal(p2.usePermissionStore.getState().setProjectRoleAssignees(admin, '1', 'SPM', { users: ['演示用户11'], departments: [] }).ok, false)
assert.equal(JSON.stringify(p2.usePermissionStore.getState().rolesByProject), assignmentBefore)
const c2 = p2.usePermissionStore.getState().permissionCenter.roles.find(row => !row.builtin)
const beforeGlobal = JSON.stringify(p2.usePermissionStore.getState().permissionCenter)
assert.equal(p2.usePermissionStore.getState().updateMenuActionsBulk(admin, c2.id, [{ menuId: 'project.view', actions: ['view', 'export'] }], true).ok, false)
assert.equal(JSON.stringify(p2.usePermissionStore.getState().permissionCenter), beforeGlobal)
browserStorage.setItem = rawSet
const reload = createTypeScriptModuleLoader()
const p3 = reload(path.resolve('src/stores/permission.ts'))
const t3 = reload(path.resolve('src/stores/rolePermissionTemplates.ts'))
assert.equal(t3.useRolePermissionTemplateStore.getState().error, undefined, 'unmapped empty PMS code survives reload')
assert.equal(p3.getSyncedProjectRoles('1').find(row => row.id === source.id).grants['basicInfo:查看'], false, 'explicit empty copy survives reload')
assert.equal(p3.getSyncedProjectRoles('5').length, 2, 'capability source initialized')
// Migrated local roles are editable and deleted entries never regenerate on ensure/sync/reload.
assert.equal(p3.usePermissionStore.getState().deleteProjectRole(admin, '1', 'SPM').ok, true)
p3.usePermissionStore.getState().ensureProjectPermissions([{ id: '1', type, spm: '演示用户10' }])
p3.usePermissionStore.getState().syncProjectTeamPermissionMembers({ id: '1', type, spm: '演示用户10' })
assert.equal(p3.usePermissionStore.getState().rolesByProject['1'].some(row => row.name === 'SPM'), false)
const again = createTypeScriptModuleLoader()(path.resolve('src/stores/permission.ts'))
assert.equal(again.usePermissionStore.getState().rolesByProject['1'].some(row => row.name === 'SPM'), false)
let writes = 0
browserStorage.setItem = (key, value) => { writes++; rawSet(key, value) }
const liveRole = p3.usePermissionStore.getState().permissionCenter.roles.find(row => !row.builtin)
assert.equal(p3.usePermissionStore.getState().updateMenuActionsBulk(admin, liveRole.id, [{ menuId: 'project.view', actions: ['view', 'export'] }, { menuId: 'workbench', actions: ['view'] }], true).ok, true)
assert.equal(writes, 1, 'one bulk operation writes exactly one complete snapshot')
writes = 0
assert.equal(typeof t3.useRolePermissionTemplateStore.getState().rehydrate, 'function')
t3.useRolePermissionTemplateStore.getState().rehydrate()
assert.equal(writes, 0, 'rehydration never echoes storage')
browserStorage.setItem = rawSet
browserStorage.setItem(t3.ROLE_TEMPLATE_STORAGE_KEY, '{broken')
const broken = createTypeScriptModuleLoader()(path.resolve('src/stores/rolePermissionTemplates.ts'))
assert(broken.useRolePermissionTemplateStore.getState().error)
assert.equal(broken.useRolePermissionTemplateStore.getState().createTemplate(admin, type, input).ok, false)
delete globalThis.window
console.log('PASS exact-type authority, browser atomic rollback, copy reload, corrupt cache and local migration')
