import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'

const load = createTypeScriptModuleLoader()
const { usePermissionStore, hasPermission, hasProjectRoleManagementAccess, isProjectTeamReadOnly } = load(path.resolve('src/stores/permission.ts'))
const { useProjectTeamStore } = load(path.resolve('src/stores/projectTeam.ts'))
const { isProjectTeamMember } = load(path.resolve('src/lib/projectTeam.ts'))
const { canEnterProjectSpace, matchesAboutMine } = load(path.resolve('src/lib/projectListFilters.ts'))
const { roleAppliesToUser } = load(path.resolve('src/lib/projectRoleMembership.ts'))
const { createPermissionCenterSeed } = load(path.resolve('src/lib/permissionCenterSeed.ts'))

const member = '演示用户10'
const other = '演示用户11'
const project = { id: '1', name: 'Example', mockTeamSourceId: 'legacy:1' }
const child = { id: 'child-1', parentProjectId: '1', name: 'Child' }
const unrelated = { id: '2', name: 'Other', mockTeamSourceId: 'legacy:2' }
const technicalParent = { id: '9', name: 'Technical', mockTeamSourceId: 'legacy:9' }
const team = useProjectTeamStore.getState()
team.syncProjects([project, child, unrelated])
assert.equal(isProjectTeamMember(member, '1'), true, 'seed member uses stable employee ID')
assert.equal(isProjectTeamMember(member, 'child-1'), true, 'child resolves parent scope')
team.syncProjects([project, child, unrelated, technicalParent])
assert.equal(isProjectTeamMember(member, 'IPM-AI-001'), true, 'technical subproject resolves parent scope by stored ID')
team.syncProjects([{ ...project, sourceBid: 'UNKNOWN' }, child, unrelated, technicalParent])
assert.equal(isProjectTeamMember(member, '1'), false, 'unknown source does not retain legacy project ID team')
assert.equal(isProjectTeamMember(member, 'child-1'), false, 'child cannot retain team after parent source changes')
team.syncProjects([{ ...project, sourceBid: 'EXT-001' }, child])
assert.equal(isProjectTeamMember(member, '1'), true, 'known external source grants mapped team')
team.syncProjects([project, child])
assert.equal(isProjectTeamMember(member, '1'), false, 'known BID then missing BID denies after persisted source removal')
assert.equal(isProjectTeamMember(member, 'child-1'), false, 'child denies after parent BID removal')
team.syncProjects([{ id: 'new-formal', sourceBid: 'EXT-001', projectAttribute: 'formal' }])
assert.equal(isProjectTeamMember(member, 'new-formal'), true, 'new formal project binds external source')
team.syncProjects([{ ...project, projectAttribute: 'budget' }])
assert.equal(isProjectTeamMember(member, '1'), false, 'budget project does not inherit formal fixture')
team.syncProjects([child])
assert.equal(isProjectTeamMember(member, 'child-1'), false, 'orphan child cannot inherit a deleted parent team')
team.syncProjects([project, child, unrelated, technicalParent])
assert.equal(isProjectTeamMember(member, '2'), false, 'membership is per project')
assert.equal(useProjectTeamStore.getState().teamsByProjectId['2'].members.some(person => person.name === member), true, 'same display name appears in other project')
assert.equal(isProjectTeamMember(other, '1'), false, 'same-name or other employee never matches')
assert.equal(isProjectTeamMember('Unknown', '1'), false, 'unknown identity denies')
assert.equal(isProjectTeamMember('', '1'), false, 'empty identity denies')
assert.equal(canEnterProjectSpace('1', member, {}, false), true, 'team member enters')
assert.equal(matchesAboutMine('1', member, {}), true, 'team member appears in about mine')

const original = usePermissionStore.getState()
const rolesByProject = { ...original.rolesByProject, '1': [{ name: 'extra', members: [member], departments: ['示例研发部'] }] }
const rolePermissionsByProject = { ...original.rolePermissionsByProject, '1': { extra: {
  'basicInfo:查看': true, 'plan:一级计划-查看': true, 'resource:view': true,
  'basicInfo:编辑': true, 'plan:一级计划-编辑': true, 'projectPermission:manageRoles': true,
  'plan:导出': true, 'resource:laborEdit': true,
} } }
usePermissionStore.setState({ rolesByProject, rolePermissionsByProject })
for (const key of ['basicInfo:编辑', 'plan:一级计划-编辑', 'projectPermission:manageRoles', 'plan:导出', 'resource:laborEdit']) {
  assert.equal(hasPermission(member, '1', key), false, `default source views deny ${key}`)
}
for (const key of ['basicInfo:查看', 'plan:一级计划-查看', 'resource:view']) {
  assert.equal(hasPermission(member, '1', key), true, `default source views permit ${key}`)
}
assert.equal(isProjectTeamReadOnly(member, '1'), true)
assert.equal(hasProjectRoleManagementAccess(usePermissionStore.getState(), member, '1'), false)
const departmentOnly = { name: 'department-extra', members: [], departments: ['示例研发部'] }
assert.equal(roleAppliesToUser(departmentOnly, member), true, 'department-only role applies before the team restriction')
usePermissionStore.setState({
  rolesByProject: { ...rolesByProject, '1': [departmentOnly] },
  rolePermissionsByProject: { ...rolePermissionsByProject, '1': { 'department-extra': { 'basicInfo:编辑': true, 'projectPermission:manageRoles': true } } },
})
assert.equal(hasPermission(member, '1', 'basicInfo:编辑'), false, 'department-only write grant cannot elevate team member')
assert.equal(hasProjectRoleManagementAccess(usePermissionStore.getState(), member, '1'), false)
const previousGlobalRoles = usePermissionStore.getState().globalRoles
const permissionCenter = createPermissionCenterSeed()
const ordinaryAdmin = { id: 'mock:ordinary-admin', groupId: permissionCenter.groups[0].id, name: '管理员', members: [member], departments: [] }
usePermissionStore.setState({
  permissionCenter: { ...permissionCenter, roles: [...permissionCenter.roles, ordinaryAdmin] },
  globalRoles: [{ name: '管理组', members: [member] }, ...previousGlobalRoles.filter(role => role.name !== '管理组')],
})
assert.equal(isProjectTeamReadOnly(member, '1'), true, 'ordinary 管理员 and legacy global role do not bypass an initialized permission center')
assert.equal(hasPermission(member, '1', 'basicInfo:编辑'), false)
const centerWithSuperAdmin = {
  ...permissionCenter,
  roles: [...permissionCenter.roles.map(role => role.builtin === 'superadmin' ? { ...role, members: [...role.members, member] } : role), ordinaryAdmin],
}
usePermissionStore.setState({ permissionCenter: centerWithSuperAdmin })
assert.equal(isProjectTeamReadOnly(member, '1'), false, 'system superadmin bypasses team read-only')
assert.equal(hasPermission(member, '1', 'basicInfo:编辑'), true)
assert.equal(hasProjectRoleManagementAccess(usePermissionStore.getState(), member, '1'), true)
usePermissionStore.setState({ permissionCenter: original.permissionCenter, globalRoles: previousGlobalRoles })
team.syncProjects([unrelated])
assert.equal(isProjectTeamMember(member, '1'), false, 'removed source removes membership')
team.syncProjects([project, child, unrelated])
team.refreshMock()
assert.equal(isProjectTeamMember(member, '1'), true, 'refresh rebuilds mock source')

const { useProjectStore, migrateProjectState, PROJECT_STORE_VERSION } = load(path.resolve('src/stores/project.ts'))
const seeded = useProjectStore.getState().projects.find(item => item.id === '1')
assert.equal(seeded.mockTeamSourceId, 'legacy:1', 'existing seed has explicit legacy identity')
const legacyRecord = { ...seeded }
delete legacyRecord.mockTeamSourceId
assert.equal(migrateProjectState({ projects: [legacyRecord] }, 10).projects[0].mockTeamSourceId, 'legacy:1', 'old saved seed receives one-time migration')
const startingProjects = useProjectStore.getState().projects
useProjectStore.getState().setProjects(rows => rows.map(item => item.id === '1' ? { ...item, sourceBid: 'EXT-001' } : item))
assert.equal(useProjectStore.getState().projects.find(item => item.id === '1').mockTeamSourceId, null, 'binding change permanently clears legacy marker')
useProjectStore.getState().setProjects(rows => rows.map(item => item.id === '1' ? { ...item, sourceBid: '' } : item))
assert.equal(isProjectTeamMember(member, '1'), false, 'clearing source after project-store mutation denies access')
const cleared = useProjectStore.getState().projects.find(item => item.id === '1')
assert.equal(migrateProjectState({ projects: [cleared] }, PROJECT_STORE_VERSION).projects[0].mockTeamSourceId, null, 'reload preserves removed source marker')
assert.equal(migrateProjectState({ projects: [cleared] }, PROJECT_STORE_VERSION).projects[0].sourceBid, '', 'reload does not infer a removed source')
useProjectStore.setState({ projects: startingProjects })
const capabilitySeed = startingProjects.find(row => row.id === '5')
const oldCapability = { ...capabilitySeed }; delete oldCapability.mockTeamSourceId
assert.equal(migrateProjectState({ projects: [oldCapability] }, 11).projects[0].mockTeamSourceId, 'legacy:5')
assert.equal(migrateProjectState({ projects: [{ ...oldCapability, mockTeamSourceId: null }] }, 11).projects[0].mockTeamSourceId, null, 'capability migration never revives explicitly removed source')
console.log('project-team access: passed')

// Hydration may infer a display BID by name, but it is not a stable team association.
const collision = { ...seeded, id: 'unbound-collision', name: 'DEMO021-DEMOCHIP003_DEMOBOARD003' }
delete collision.sourceBid
delete collision.mockTeamSourceId
for (const version of [PROJECT_STORE_VERSION, PROJECT_STORE_VERSION - 1, 8]) {
  let hydrated = migrateProjectState({ projects: [collision] }, version).projects.find(row => row.id === collision.id)
  assert.equal(hydrated.sourceBid, 'EXT-001', 'existing registry display inference remains compatible')
  for (let reload = 0; reload < 3; reload++) {
    team.syncProjects([hydrated])
    assert.equal(isProjectTeamMember(member, collision.id), false, `name-inferred source cannot authorize at v${version} reload${reload}`)
    assert.equal(canEnterProjectSpace(collision.id, member, {}, false), false)
    assert.equal(useProjectTeamStore.getState().teamsByProjectId[collision.id], undefined)
    hydrated = migrateProjectState({ projects: [JSON.parse(JSON.stringify(hydrated))] }, PROJECT_STORE_VERSION).projects.find(row => row.id === collision.id)
  }
}
const inferredImport = migrateProjectState({ projects: [collision] }, PROJECT_STORE_VERSION).projects[0]
useProjectStore.setState({ projects: [collision] })
useProjectStore.getState().setProjects([inferredImport])
assert.equal(isProjectTeamMember(member, collision.id), false, 'applying migrated display data through setProjects retains inferred provenance')
assert.equal(useProjectStore.getState().projects[0].nameInferredSourceBid, 'EXT-001')
const explicit = migrateProjectState({ projects: [{ ...collision, sourceBid: 'EXT-001' }] }, PROJECT_STORE_VERSION).projects[0]
team.syncProjects([explicit])
assert.equal(isProjectTeamMember(member, collision.id), true, 'genuine explicit BID survives hydration')
const trusted = migrateProjectState({ projects: [legacyRecord] }, 10).projects.find(row => row.id === '1')
team.syncProjects([trusted])
assert.equal(isProjectTeamMember(member, '1'), true, 'trusted seed stable identity remains authorized')
console.log('project-team inferred-source hydration provenance: passed')
const inferred = migrateProjectState({ projects: [collision] }, PROJECT_STORE_VERSION).projects[0]
useProjectStore.setState({ projects: [inferred] })
team.syncProjects([inferred])
const { updateConfiguredProject } = load(path.resolve('src/lib/projectRegistry.ts'))
for (const [label, save] of [
  ['ordinary full-record basic/market save', () => useProjectStore.getState().updateProject(collision.id, { ...inferred, progress: inferred.progress + 1 }, '演示用户01')],
  ['ordinary updater function save', () => useProjectStore.getState().updateProject(collision.id, previous => ({ ...previous, progress: previous.progress + 1 }), '演示用户01')],
  ['registry full-record roundtrip', () => updateConfiguredProject(collision.id, { name: inferred.name }, '演示用户01')],
  ['same-BID patch without a confirmation UI', () => useProjectStore.getState().updateProject(collision.id, { sourceBid: 'EXT-001' }, '演示用户01')],
]) {
  useProjectStore.setState({ projects: [inferred] })
  team.syncProjects([inferred])
  const saved = save()
  assert.ok(saved && saved.ok !== false, `${label} remains a valid ordinary save`)
  const persisted = useProjectStore.getState().projects[0]
  assert.equal(persisted.nameInferredSourceBid, 'EXT-001', `${label} preserves inferred provenance`)
  assert.equal(isProjectTeamMember(member, collision.id), false, `${label} cannot elevate membership`)
  const reloaded = migrateProjectState({ projects: [JSON.parse(JSON.stringify(persisted))] }, PROJECT_STORE_VERSION).projects[0]
  team.syncProjects([reloaded])
  assert.equal(isProjectTeamMember(member, collision.id), false, `${label} remains denied after reload`)
  assert.equal(canEnterProjectSpace(collision.id, member, {}, false), false)
}
// Actual changed-BID writes retain their existing lifecycle semantics. No new
// same-BID confirmation UI/API is invented for display-only inferred sources.
useProjectStore.setState({ projects: [inferred] })
useProjectStore.getState().setProjects(rows => rows.map(row => ({ ...row, sourceBid: 'EXT-006' })))
const rebound = useProjectStore.getState().projects[0]
assert.equal(rebound.nameInferredSourceBid, undefined)
assert.equal(isProjectTeamMember(member, collision.id), true, 'actual explicit BID change binds independently of the old inferred source')
const reboundReload = migrateProjectState({ projects: [JSON.parse(JSON.stringify(rebound))] }, PROJECT_STORE_VERSION).projects[0]
team.syncProjects([reboundReload])
assert.equal(isProjectTeamMember(member, collision.id), true, 'changed explicit BID survives reload')
useProjectStore.getState().setProjects(rows => rows.map(row => ({ ...row, sourceBid: '' })))
const removedAfterRebind = useProjectStore.getState().projects[0]
assert.equal(removedAfterRebind.mockTeamSourceId, null)
const removedReload = migrateProjectState({ projects: [removedAfterRebind] }, PROJECT_STORE_VERSION).projects[0]
assert.equal(removedReload.sourceBid, '', 'retirement prevents display inference from resurrecting the old association')
team.syncProjects([removedReload])
assert.equal(isProjectTeamMember(member, collision.id), false)
useProjectStore.getState().setProjects(rows => rows.map(row => ({ ...row, sourceBid: 'EXT-001' })))
assert.equal(isProjectTeamMember(member, collision.id), true, 'intentional new explicit BID can bind after retirement')
console.log('project-team ordinary save provenance, retirement and explicit rebinding: passed')
