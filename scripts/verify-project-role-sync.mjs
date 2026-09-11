#!/usr/bin/env node
import assert from 'node:assert/strict'
import { hasCallExpression, loadTypeScriptModule, projectRoot, readSource } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const permissionConstants = loadTypeScriptModule(root, 'src/constants/permissions.ts')
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
  示例应用领域开发代表: 'tosSystemAppDevRepresentative', 示例通信领域开发代表: 'tosBasebandDevRepresentative',
  示例集成领域开发代表: 'tosIntegrationDevRepresentative', 软件架设与技术规划部开发代表: 'tosArchitectureDevRepresentative',
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
const seededProjectRoles = permissionStore.getState().rolesByProject
assert.equal(permissionConstants.ALL_USERS.includes('演示用户09'), true, '演示用户09 is available in the shared user selector')
assert.equal(projectModule.INITIAL_PROJECT_MEMBER_MAP['1'].includes('演示用户09'), true, '演示用户09 can see the target project')
assert.equal(
  Object.entries(projectModule.INITIAL_PROJECT_MEMBER_MAP)
    .filter(([projectId]) => projectId !== '1')
    .some(([, members]) => members.includes('演示用户09')),
  false,
  '演示用户09 is not a member of any non-target project',
)
assert.equal(seededProjectRoles['1'].find(role => role.name === '项目经理')?.members.includes('演示用户09'), true, '演示用户09 is a target-project manager')
assert.equal(
  Object.entries(seededProjectRoles)
    .filter(([projectId]) => !['1', 'mock-budget-machine-bound'].includes(projectId))
    .some(([, roles]) => roles.some(role => role.members.includes('演示用户09'))),
  false,
  '演示用户09 is absent outside its formal target and explicitly owned budget source',
)
assert.equal(seededProjectRoles['mock-budget-machine-bound'].find(role => role.name === '系统管理员')?.members.includes('演示用户09'), true, 'new budget source assigns its explicit owner the system administrator role')
assert.deepEqual(seededProjectRoles['3'].find(role => role.name === '项目经理')?.members, ['演示用户01', '演示用户04'], 'the shared project-manager defaults are unchanged')
assert.equal(permissionStore.getState().globalRoles.some(role => role.members.includes('演示用户09')), false, '演示用户09 has no global role')
assert.equal(typeof permissionStore.getState().setRolesForProjectGuarded, 'function', 'role mutations expose a guarded store action')
assert.equal(typeof permissionStore.getState().setRolePermissionsForProjectGuarded, 'function', 'permission mutations expose a guarded store action')
assert.equal(typeof permissionStore.getState().ensureProjectPermissions, 'function', 'project hydration can backfill missing permission slots')
const technicalProject = {
  id: 'role-tech', name: '角色技术项目', type: '技术项目', secondaryCategory: '技术项目', status: '在研', progress: 0,
  leader: '演示用户02', responsiblePersons: ['演示用户02'], markets: [], androidVersion: '', chipPlatform: '', spm: '', updatedAt: '', productLine: '', tosVersion: '', planStartDate: '', planEndDate: '', developCycle: 0, healthStatus: 'normal',
  technicalLead: '演示用户02', technicalProjectManager: '演示用户03', testRepresentative: '演示用户04', qualityRepresentative: '', productRepresentative: '演示用户05', standardizationRepresentative: '', technicalOther: '演示用户08',
}
permissionStore.setState({ rolesByProject: { 'role-tech': [...permissionModule.getFixedProjectRoles(technicalProject), { name: '架构顾问', members: ['演示用户01'], isFixed: false }] } })
projectStore.setState({ projects: [technicalProject], selectedProject: technicalProject })
assert.equal(projectStore.getState().syncTechnicalTeamPermissionMembers('role-tech'), true)
const syncedTechnical = permissionStore.getState().rolesByProject['role-tech']
assert.deepEqual(syncedTechnical.slice(0, 7).map(role => [role.name, role.members]), [
  ['技术项目负责人', ['演示用户02']], ['技术项目经理', ['演示用户03']], ['测试代表', ['演示用户04']], ['质量代表', []], ['产品代表', ['演示用户05']], ['标准化代表', []],
  ['其他', ['演示用户08']],
])
assert.deepEqual(syncedTechnical.at(-1), { name: '架构顾问', members: ['演示用户01'], isFixed: false }, 'custom technical roles remain assignable')

permissionStore.setState(state => ({
  globalRoles: state.globalRoles,
  rolesByProject: {
    ...state.rolesByProject,
    guard: [{ name: '查看者', members: ['演示用户05'], isFixed: false }],
  },
  rolePermissionsByProject: {
    ...state.rolePermissionsByProject,
    guard: { 查看者: { 'basicInfo:查看': true } },
  },
}))
const guardBefore = structuredClone(permissionStore.getState().rolesByProject.guard)
assert.equal(permissionStore.getState().setRolesForProjectGuarded('guard', '演示用户05', [{ name: '越权', members: ['演示用户05'], isFixed: false }]), false, 'unauthorized role mutation is rejected in the store')
assert.deepEqual(permissionStore.getState().rolesByProject.guard, guardBefore, 'unauthorized role mutation emits no state change')
assert.equal(permissionStore.getState().setRolePermissionsForProjectGuarded('guard', '演示用户05', { 查看者: { 'projectPermission:manageRoles': true } }), false, 'unauthorized permission mutation is rejected in the store')
assert.equal(permissionStore.getState().setRolesForProjectGuarded('guard', '演示用户01', [{ name: '管理员新角色', members: ['演示用户02'], isFixed: false }]), true, 'global administrator bypass still authorizes role mutation')
assert.deepEqual(permissionStore.getState().rolesByProject.guard, [{ name: '管理员新角色', members: ['演示用户02'], isFixed: false }])
const permissionRoundTrip = permissionModule.migratePermissionState(
  permissionModule.partializePermissionState(permissionStore.getState()),
  permissionModule.PERMISSION_STORAGE_VERSION,
)
assert.deepEqual(permissionRoundTrip.rolesByProject.guard, [{ name: '管理员新角色', members: ['演示用户02'], isFixed: false }], 'persist roundtrip retains custom roles and members')

const persisted = permissionModule.migratePermissionState({
  rolesByProject: { persisted: [{ name: ' 自定义角色 ', members: [' 演示用户01 ', '演示用户01'], isFixed: false }] },
  rolePermissionsByProject: { persisted: { 自定义角色: { 'basicInfo:查看': true, bad: 'yes' } } },
}, 1)
assert.deepEqual(persisted.rolesByProject.persisted, [{ name: '自定义角色', members: ['演示用户01'], isFixed: false }], 'persist migration keeps and sanitizes custom roles and members')
assert.deepEqual(persisted.rolePermissionsByProject.persisted, { 自定义角色: { 'basicInfo:查看': true } }, 'persist migration keeps boolean role permissions')

const legacyProjectOne = {
  rolesByProject: {
    '1': [
      { name: '项目经理', members: ['演示用户01', '演示用户04'], isFixed: true },
      { name: '自定义项目角色', members: ['演示用户02'], isFixed: false },
    ],
  },
  rolePermissionsByProject: {
    '1': {
      项目经理: { 'basicInfo:编辑': true },
      自定义项目角色: { 'basicInfo:查看': true },
    },
  },
}
const migratedProjectOne = permissionModule.migratePermissionState(legacyProjectOne, 1)
assert.deepEqual(
  migratedProjectOne.rolesByProject['1'].find(role => role.name === '项目经理')?.members,
  ['演示用户01', '演示用户04', '演示用户09'],
  'the one-time legacy permission migration backfills 演示用户09 into project 1 manager members',
)
assert.deepEqual(
  migratedProjectOne.rolesByProject['1'].find(role => role.name === '自定义项目角色'),
  { name: '自定义项目角色', members: ['演示用户02'], isFixed: false },
  'the one-time legacy permission migration preserves custom roles',
)
assert.deepEqual(
  migratedProjectOne.rolePermissionsByProject['1'],
  legacyProjectOne.rolePermissionsByProject['1'],
  'the one-time legacy permission migration preserves configured permissions',
)
const currentProjectOne = permissionModule.migratePermissionState(legacyProjectOne, permissionModule.PERMISSION_STORAGE_VERSION)
assert.deepEqual(
  currentProjectOne.rolesByProject['1'].find(role => role.name === '项目经理')?.members,
  ['演示用户01', '演示用户04'],
  'current-version hydration does not repeatedly re-add a deliberately removed mock manager',
)
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
assert.equal(projectStore.getState().syncTosTeamPermissionMembersGuarded('role-tos', '演示用户05', '版本项目经理', ['越权']), false, 'permission-side tOS team mutation is store-guarded')
assert.deepEqual(projectStore.getState().projects[0].responsiblePersons, ['A'], 'rejected tOS mutation leaves the project unchanged')
assert.equal(projectStore.getState().syncTosTeamPermissionMembersGuarded('role-tos', '演示用户01', '版本项目经理', ['管理员']), true, 'global administrator can synchronize tOS members')
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
