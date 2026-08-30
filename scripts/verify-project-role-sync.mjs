#!/usr/bin/env node
import assert from 'node:assert/strict'
import { hasCallExpression, loadTypeScriptModule, projectRoot, readSource } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const permissionModule = loadTypeScriptModule(root, 'src/stores/permission.ts')
const projectModule = loadTypeScriptModule(root, 'src/stores/project.ts')

const technicalMap = {
  技术项目负责人: 'technicalLead',
  技术项目经理: 'technicalProjectManager',
  测试代表: 'testRepresentative',
  质量代表: 'qualityRepresentative',
  产品代表: 'productRepresentative',
  标准化代表: 'standardizationRepresentative',
  其他: 'technicalOther',
}
const tosMap = {
  版本项目经理: 'tosVersionProjectManager', 规划代表: 'tosPlanningRepresentative', SE: 'tosSe',
  测试代表: 'tosTestRepresentative', SQA: 'tosSqa', CMO: 'tosCmo', UX: 'tosUx',
  稳定性代表: 'tosStabilityRepresentative', 性能代表: 'tosPerformanceRepresentative', 功耗代表: 'tosPowerRepresentative',
  系统应用开发代表: 'tosSystemAppDevRepresentative', 底软通信开发代表: 'tosBasebandDevRepresentative',
  集成维护开发代表: 'tosIntegrationDevRepresentative', 软件架设与技术规划部开发代表: 'tosArchitectureDevRepresentative',
  创新产品开发代表: 'tosInnovationDevRepresentative', 'TEX AI开发代表': 'tosTexAiDevRepresentative',
  影像开发代表: 'tosImagingDevRepresentative', 预装管理开发代表: 'tosPreinstallRepresentative',
  研发战略生态合作部代表: 'tosEcosystemRepresentative',
}
assert.deepEqual(permissionModule.TECHNICAL_TEAM_PERMISSION_MAPPING, technicalMap, 'technical fixed roles and fields are exact')
assert.deepEqual(permissionModule.TOS_TEAM_PERMISSION_MAPPING, tosMap, 'all 19 approved tOS roles and fields are exact')
assert.equal(Object.keys(permissionModule.TOS_TEAM_PERMISSION_MAPPING).length, 19)
assert.equal(typeof permissionModule.migratePermissionState, 'function', 'permission state exposes a versioned migration boundary')
assert.equal(permissionModule.resolvePermissionProjectId('child-1', 'tdt-1'), 'tdt-1', 'a child uses its TDT parent permission set')
assert.equal(permissionModule.resolvePermissionProjectId('tdt-1'), 'tdt-1')

const initialTechnicalRoles = { 技术项目负责人: ['旧负责人'], 技术项目经理: ['旧经理'], 测试代表: ['旧测试'], 质量代表: ['旧质量'], 产品代表: ['旧产品'], 标准化代表: ['旧标准'], 其他: ['旧其他'], 自定义角色: ['保留成员'] }
assert.deepEqual(projectModule.synchronizeTechnicalRoleMembers(initialTechnicalRoles, {
  技术项目负责人: ['新负责人'], 技术项目经理: [], 测试代表: ['新测试'], 质量代表: [], 产品代表: ['新产品'], 标准化代表: [], 其他: ['新其他'],
}), { 技术项目负责人: ['新负责人'], 技术项目经理: [], 测试代表: ['新测试'], 质量代表: [], 产品代表: ['新产品'], 标准化代表: [], 其他: ['新其他'], 自定义角色: ['保留成员'] }, 'technical save overwrites all seven fixed roles and preserves custom roles')

let fixture = projectModule.synchronizeTosRoleMembers({}, { source: 'team', members: ['A'], role: '版本项目经理' })
fixture = projectModule.synchronizeTosRoleMembers(fixture, { source: 'permission', members: ['B'], role: '版本项目经理' })
assert.deepEqual(fixture, { teamMembers: ['B'], permissionMembers: ['B'], responsiblePersons: ['B'] }, 'permission save wins after team save')
fixture = projectModule.synchronizeTosRoleMembers({}, { source: 'permission', members: ['B'], role: '版本项目经理' })
fixture = projectModule.synchronizeTosRoleMembers(fixture, { source: 'team', members: ['A'], role: '版本项目经理' })
assert.deepEqual(fixture, { teamMembers: ['A'], permissionMembers: ['A'], responsiblePersons: ['A'] }, 'team save wins after permission save')

const projectStore = projectModule.useProjectStore
const permissionStore = permissionModule.usePermissionStore
assert.equal(typeof permissionStore.getState().setRolesForProjectGuarded, 'function', 'role mutations expose a guarded store action')
assert.equal(typeof permissionStore.getState().setRolePermissionsForProjectGuarded, 'function', 'permission mutations expose a guarded store action')
assert.equal(typeof permissionStore.getState().ensureProjectPermissions, 'function', 'project hydration can backfill missing permission slots')
const technicalProject = {
  id: 'role-tech', name: '角色技术项目', type: '技术项目', secondaryCategory: '技术项目', status: '在研', progress: 0,
  leader: '李四', responsiblePersons: ['李四'], markets: [], androidVersion: '', chipPlatform: '', spm: '', updatedAt: '', productLine: '', tosVersion: '', planStartDate: '', planEndDate: '', developCycle: 0, healthStatus: 'normal',
  technicalLead: '李四', technicalProjectManager: '王五', testRepresentative: '赵六', qualityRepresentative: '', productRepresentative: '孙七', standardizationRepresentative: '', technicalOther: '杜甫',
}
permissionStore.setState({ rolesByProject: { 'role-tech': [...permissionModule.getFixedProjectRoles(technicalProject), { name: '架构顾问', members: ['张三'], isFixed: false }] } })
projectStore.setState({ projects: [technicalProject], selectedProject: technicalProject })
assert.equal(projectStore.getState().syncTechnicalTeamPermissionMembers('role-tech'), true)
const syncedTechnical = permissionStore.getState().rolesByProject['role-tech']
assert.deepEqual(syncedTechnical.slice(0, 7).map(role => [role.name, role.members]), [
  ['技术项目负责人', ['李四']], ['技术项目经理', ['王五']], ['测试代表', ['赵六']], ['质量代表', []], ['产品代表', ['孙七']], ['标准化代表', []],
  ['其他', ['杜甫']],
])
assert.deepEqual(syncedTechnical.at(-1), { name: '架构顾问', members: ['张三'], isFixed: false }, 'custom technical roles remain assignable')

permissionStore.setState(state => ({
  globalRoles: state.globalRoles,
  rolesByProject: {
    ...state.rolesByProject,
    guard: [{ name: '查看者', members: ['孙七'], isFixed: false }],
  },
  rolePermissionsByProject: {
    ...state.rolePermissionsByProject,
    guard: { 查看者: { 'basicInfo:查看': true } },
  },
}))
const guardBefore = structuredClone(permissionStore.getState().rolesByProject.guard)
assert.equal(permissionStore.getState().setRolesForProjectGuarded('guard', '孙七', [{ name: '越权', members: ['孙七'], isFixed: false }]), false, 'unauthorized role mutation is rejected in the store')
assert.deepEqual(permissionStore.getState().rolesByProject.guard, guardBefore, 'unauthorized role mutation emits no state change')
assert.equal(permissionStore.getState().setRolePermissionsForProjectGuarded('guard', '孙七', { 查看者: { 'projectPermission:manageRoles': true } }), false, 'unauthorized permission mutation is rejected in the store')
assert.equal(permissionStore.getState().setRolesForProjectGuarded('guard', '张三', [{ name: '管理员新角色', members: ['李四'], isFixed: false }]), true, 'global administrator bypass still authorizes role mutation')
assert.deepEqual(permissionStore.getState().rolesByProject.guard, [{ name: '管理员新角色', members: ['李四'], isFixed: false }])
const permissionRoundTrip = permissionModule.migratePermissionState(
  permissionModule.partializePermissionState(permissionStore.getState()),
  permissionModule.PERMISSION_STORAGE_VERSION,
)
assert.deepEqual(permissionRoundTrip.rolesByProject.guard, [{ name: '管理员新角色', members: ['李四'], isFixed: false }], 'persist roundtrip retains custom roles and members')

const persisted = permissionModule.migratePermissionState({
  rolesByProject: { persisted: [{ name: ' 自定义角色 ', members: [' 张三 ', '张三'], isFixed: false }] },
  rolePermissionsByProject: { persisted: { 自定义角色: { 'basicInfo:查看': true, bad: 'yes' } } },
}, 1)
assert.deepEqual(persisted.rolesByProject.persisted, [{ name: '自定义角色', members: ['张三'], isFixed: false }], 'persist migration keeps and sanitizes custom roles and members')
assert.deepEqual(persisted.rolePermissionsByProject.persisted, { 自定义角色: { 'basicInfo:查看': true } }, 'persist migration keeps boolean role permissions')
permissionStore.setState({ rolesByProject: {}, rolePermissionsByProject: {} })
permissionStore.getState().ensureProjectPermissions([technicalProject])
assert.deepEqual(permissionStore.getState().rolesByProject['role-tech'].map(role => role.name), Object.keys(technicalMap), 'project hydration backfills fixed roles for a persisted technical project')
permissionStore.getState().setRolesForProject('role-tech', [{ name: '技术项目负责人', members: ['保留'], isFixed: true }, { name: '自定义角色', members: ['保留'], isFixed: false }])
permissionStore.getState().ensureProjectPermissions([technicalProject])
assert.deepEqual(permissionStore.getState().rolesByProject['role-tech'].find(role => role.name === '技术项目负责人')?.members, ['保留'], 'hydration never overwrites existing fixed-role configuration')
assert.deepEqual(permissionStore.getState().rolesByProject['role-tech'].find(role => role.name === '自定义角色')?.members, ['保留'], 'hydration preserves custom roles')

const tosProject = {
  ...technicalProject, id: 'role-tos', name: 'tOS18.0', type: 'tOS版本项目', secondaryCategory: 'tOS版本项目', leader: 'A', responsiblePersons: ['A'],
  technicalLead: undefined, technicalProjectManager: undefined, testRepresentative: undefined, qualityRepresentative: undefined, productRepresentative: undefined, standardizationRepresentative: undefined,
  fieldValues: { tosVersionProjectManager: ['A'], tosPlanningRepresentative: ['规划A'], tosSe: ['SE-A'] },
}
projectStore.setState({ projects: [tosProject], selectedProject: tosProject })
assert.equal(projectStore.getState().syncTosTeamPermissionMembers('role-tos'), true)
assert.deepEqual(permissionStore.getState().rolesByProject['role-tos'].map(role => role.name), Object.keys(tosMap), 'tOS permission page exposes exactly 19 fixed roles')
assert.equal(projectStore.getState().syncTosTeamPermissionMembersGuarded('role-tos', '孙七', '版本项目经理', ['越权']), false, 'permission-side tOS team mutation is store-guarded')
assert.deepEqual(projectStore.getState().projects[0].responsiblePersons, ['A'], 'rejected tOS mutation leaves the project unchanged')
assert.equal(projectStore.getState().syncTosTeamPermissionMembersGuarded('role-tos', '张三', '版本项目经理', ['管理员']), true, 'global administrator can synchronize tOS members')
assert.equal(projectStore.getState().syncTosTeamPermissionMembers('role-tos', '版本项目经理', [' B ', 'B']), true)
const afterPermissionSave = projectStore.getState().projects[0]
assert.deepEqual(afterPermissionSave.fieldValues.tosVersionProjectManager, ['B'], 'permission save writes the team field')
assert.deepEqual(afterPermissionSave.responsiblePersons, ['B'], 'version manager updates responsible persons')
assert.equal(afterPermissionSave.leader, 'B')
assert.deepEqual(permissionStore.getState().rolesByProject['role-tos'][0].members, ['B'])
const teamSaved = projectStore.getState().updateProject('role-tos', {
  fieldValues: { ...afterPermissionSave.fieldValues, tosVersionProjectManager: ['C'] },
})
assert.equal(teamSaved?.id, 'role-tos', 'team update returns the saved project')
assert.deepEqual(permissionStore.getState().rolesByProject['role-tos'][0].members, ['C'], 'later team save overwrites permission members')

const modal = readSource(root, 'src/components/project-info/ProjectInfoModal.tsx')
const permission = readSource(root, 'src/components/permission/PermissionModule.tsx')
assert.equal(hasCallExpression(modal, 'syncTechnicalTeamPermissionMembers'), true, 'team save calls technical one-way synchronization')
assert.equal(hasCallExpression(modal, 'syncTosTeamPermissionMembers'), true, 'team save calls shared tOS synchronization')
assert.equal(hasCallExpression(permission, 'syncTosTeamPermissionMembers'), true, 'permission save calls shared tOS synchronization')
assert.match(permission, /disabled=\{isTechnicalFixedRole \|\| !canManageRoles\}/, 'technical fixed-role member control is read-only')
assert.match(permission, /请在项目团队信息中维护/, 'read-only technical roles explain where to edit members')
assert.match(permission, /handleAddRole/, 'custom role creation remains available')
assert.match(permission, /handlePermToggle/, 'fixed-role permissions remain editable')
assert.match(permission, /canManageRoles/, 'permission UI receives an explicit mutation capability')
assert.match(permission, /disabled=\{!canManageRoles/, 'permission UI disables unauthorized mutation controls')
assert.match(readSource(root, 'src/stores/project.ts'), /onRehydrateStorage:[\s\S]*ensureProjectPermissions/, 'project hydration backfills permissions from persisted projects')

console.log('project role sync contract passed')
