import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'

const load = createTypeScriptModuleLoader()
const permission = load(path.resolve('src/stores/permission.ts'))
const { usePermissionStore, hasPermission, isGlobalAdmin, isProjectSpaceReadOnly } = permission
const { createEmptyMenuPolicy, evaluateMenuPermission, migrateLegacyPermissionCenter, parsePermissionCenter } = load(path.resolve('src/lib/permissionCenter.ts'))
const { createPermissionCenterSeed } = load(path.resolve('src/lib/permissionCenterSeed.ts'))
const { getPermissionMenu, PERMISSION_USER_DEPARTMENTS } = load(path.resolve('src/constants/permissionCenter.ts'))
const { canEnterProjectSpace, matchesAboutMine } = load(path.resolve('src/lib/projectListFilters.ts'))
const { useProjectTeamStore } = load(path.resolve('src/stores/projectTeam.ts'))
const { useRolePermissionTemplateStore } = load(path.resolve('src/stores/rolePermissionTemplates.ts'))
const { canExecuteProjectTeamWrite } = load(path.resolve('src/lib/projectTeamMutationGuard.ts'))

const menu = 'project.space', actor = '演示用户11', sourceActor = '演示用户10', admin = '演示用户01'
assert.deepEqual(getPermissionMenu(menu)?.actions, ['view'], 'only the requested all-space view action exists')
const model = createPermissionCenterSeed()
model.roles.push({ id: 'all-spaces', groupId: model.groups[0].id, name: '跨项目查看', description: '', members: [actor, sourceActor], departments: [] })
model.policies.push({ ...createEmptyMenuPolicy('all-spaces', menu), actions: ['view'] })
usePermissionStore.setState({ permissionCenter: model, rolesByProject: {}, rolePermissionsByProject: {} })
assert.equal(permission.hasAllProjectSpaceView(actor), true)
assert.equal(isGlobalAdmin(actor), false, 'view access is never system-admin identity')
const viewKeys = ['basicInfo:查看', 'basicInfo:planConfigView', 'basicInfo:transferView', 'plan:一级计划-查看', 'plan:二级计划-查看', 'resource:view']
const writeKeys = ['basicInfo:编辑', 'basicInfo:applyTransfer', 'plan:一级计划-编辑', 'plan:二级计划-编辑', 'plan:导入', 'plan:导出', 'plan:一级计划-分享', 'resource:createVersion', 'resource:deleteVersion', 'resource:lockVersion', 'resource:setOfficialVersion', 'resource:laborEdit', 'resource:nonLaborEdit', 'resource:export', 'projectPermission:manageRoles', 'unknown:view']
for (const id of ['1', '9', 'new-project', 'budget-project', 'roadmap-project', 'capability-project']) {
  assert.equal(canEnterProjectSpace(id, actor, {}, false, permission.hasAllProjectSpaceView(actor)), true)
  for (const key of viewKeys) assert.equal(hasPermission(actor, id, key), true, `${id}: ${key}`)
  for (const key of writeKeys) assert.equal(hasPermission(actor, id, key), false, `view cannot imply ${key}`)
}
assert.equal(hasPermission(actor, undefined, 'basicInfo:查看'), false)
assert.equal(canEnterProjectSpace('1', '', {}, false, true), false)
assert.equal(matchesAboutMine('new-project', actor, {}), false, 'global observation is not project membership')
assert.equal(evaluateMenuPermission(model, actor, 'project.config', 'edit'), false)
assert.equal(evaluateMenuPermission(model, actor, 'permission.center', 'manage'), false)
assert.equal(isProjectSpaceReadOnly(actor, 'new-project'), true, 'global-only observers cannot use responsibility-based writes')
assert.equal(canExecuteProjectTeamWrite(actor, 'new-project', { currentLoginUser: actor, selectedProject: { id: 'new-project' } }), false)

// Source roles may deny viewing; explicit global view wins, but local write grants still cannot elevate source members.
useProjectTeamStore.getState().syncProjects([{ id: '1', type: '整机产品项目', mockTeamSourceId: 'legacy:1' }, { id: 'child', parentProjectId: '1' }])
for (const role of permission.getSyncedProjectRoles('1')) {
  assert.equal(usePermissionStore.getState().toggleProjectRolePermissions(admin, '1', { source: 'ipm', id: role.id }, Object.keys(role.grants), false).ok, true)
}
usePermissionStore.setState({ rolesByProject: { '1': [{ name: 'extra', members: [sourceActor], departments: [] }] }, rolePermissionsByProject: { '1': { extra: { 'basicInfo:编辑': true } } } })
assert.equal(hasPermission(sourceActor, '1', 'basicInfo:查看'), true)
assert.equal(hasPermission(sourceActor, 'child', 'resource:view'), true)
assert.equal(hasPermission(sourceActor, '1', 'basicInfo:编辑'), false)
const copiedBefore = JSON.stringify(useRolePermissionTemplateStore.getState().copiesByProject)

// Department grants, independent-role union, reload and revocation use normal center policy semantics.
const departmentModel = structuredClone(model)
departmentModel.roles.find(role => role.id === 'all-spaces').members = []
departmentModel.roles.find(role => role.id === 'all-spaces').departments = [...PERMISSION_USER_DEPARTMENTS[actor]]
usePermissionStore.setState({ permissionCenter: departmentModel })
assert.equal(permission.hasAllProjectSpaceView(actor), true)
usePermissionStore.setState({ permissionCenter: model, rolesByProject: { 'local': [{ name: 'editor', members: [actor], departments: [] }] }, rolePermissionsByProject: { 'local': { editor: { 'basicInfo:编辑': true } } } })
assert.equal(hasPermission(actor, 'local', 'basicInfo:编辑'), true, 'existing local permissions stay intact')
assert.equal(isProjectSpaceReadOnly(actor, 'local'), false)
assert.equal(usePermissionStore.getState().updateMenuPolicy(admin, 'all-spaces', menu, { actions: [] }).ok, true)
assert.equal(permission.hasAllProjectSpaceView(actor), false)
assert.equal(canEnterProjectSpace('new-project', actor, {}, false, permission.hasAllProjectSpaceView(actor)), false)
assert.equal(hasPermission(sourceActor, '1', 'basicInfo:查看'), false, 'revocation restores source grants')
assert.equal(canExecuteProjectTeamWrite(actor, 'new-project', { currentLoginUser: actor, selectedProject: { id: 'new-project' } }), false, 'revocation also rejects a stale responsibility callback')
assert.equal(hasPermission(actor, 'local', 'basicInfo:编辑'), true)
assert.equal(JSON.stringify(useRolePermissionTemplateStore.getState().copiesByProject), copiedBefore, 'global grants never rewrite project copies')
assert.equal(createPermissionCenterSeed().policies.some(policy => policy.menuId === menu), false, 'no ordinary seed role gains access automatically')
assert.equal(migrateLegacyPermissionCenter([], {}).policies.some(policy => policy.menuId === menu), false, 'compatibility migration must not grant the new privilege')
console.log('PASS all-space view: explicit grants, departments, source precedence, read-only bounds, revocation, no implicit migration')

// Cross-project joint-plan responsibilities must not be reduced by adding space viewing.
const { resolveMrPermissions } = load(path.resolve('src/lib/mrVersionPlanRules.ts'))
const jointModel = structuredClone(model)
jointModel.policies.push({ ...createEmptyMenuPolicy('all-spaces', 'joint.plan'), actions: ['view', 'edit'] })
usePermissionStore.setState({ permissionCenter: jointModel })
const jointInput = { context: 'joint-machine', currentUser: actor, globalAdminUsers: [], tosManagerUsers: [actor], machineSpm: '', machineProjectId: 'independent-machine', tosProjectId: 'managed-tos' }
assert.equal(resolveMrPermissions(jointInput).canEditMachine, true, 'global space viewing cannot revoke existing joint responsibilities')
assert.equal(resolveMrPermissions(jointInput).canManageMachineLocks, true)
assert.equal(resolveMrPermissions({ ...jointInput, context: 'machine-market', machineSpm: actor }).canEditMarket, false, 'global-only project entry is still read-only')
assert.equal(resolveMrPermissions({ ...jointInput, context: 'tos' }).canEditTos, false, 'global-only tOS space entry is still read-only')
assert.equal(evaluateMenuPermission(parsePermissionCenter(JSON.parse(JSON.stringify(model))), actor, menu, 'view'), true, 'grant survives persisted-model parsing')
console.log('PASS cross-project joint duties remain independent of space viewing')

const isolatedModel = { ...model, policies: model.policies.filter(policy => policy.menuId === menu) }
usePermissionStore.setState({ permissionCenter: isolatedModel })
assert.equal(evaluateMenuPermission(isolatedModel, actor, 'project.view', 'view', { id: 'new-project', name: 'Hidden outer row' }), false, 'global spaces do not override outer project list data policies')
assert.equal(permission.hasAllProjectSpaceView(actor), true, 'space entry works without outer list grants')
const duplicate = { ...model.roles.find(role => role.id === 'all-spaces'), id: 'second-viewer', name: '第二查看角色' }
const unionModel = { ...isolatedModel, roles: [...isolatedModel.roles, duplicate], policies: [...isolatedModel.policies, { ...createEmptyMenuPolicy(duplicate.id, menu), actions: ['view'] }] }
usePermissionStore.setState({ permissionCenter: unionModel })
assert.equal(usePermissionStore.getState().updateMenuPolicy(admin, 'all-spaces', menu, { actions: [] }).ok, true)
assert.equal(permission.hasAllProjectSpaceView(actor), true, 'revoking one role retains independently granted global view')
assert.equal(usePermissionStore.getState().updateMenuPolicy(admin, duplicate.id, menu, { actions: ['view', 'edit'] }).ok, false, 'unsupported edit action rejects atomically')
assert.equal(usePermissionStore.getState().updateMenuPolicy(actor, duplicate.id, menu, { actions: [] }).ok, false, 'viewers cannot administer global grants')
console.log('PASS outer-data isolation, multi-role union and unsupported-edit denial')
