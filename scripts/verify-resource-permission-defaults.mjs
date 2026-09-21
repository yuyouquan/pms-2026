#!/usr/bin/env node
import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'

globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = { localStorage }
const loader = createTypeScriptModuleLoader()
const load = file => loader(path.resolve(file))
const constants = load('src/constants/permissions.ts')
const { usePermissionStore: store, resourcePermissionDefaults, hasPermission, PERMISSION_STORAGE_KEY, PERMISSION_STORAGE_VERSION } = load('src/stores/permission.ts')
const { initialProjects, ESTABLISHED_FORMAL_PROJECT_IDS } = load('src/data/projects.ts')
const keys = ['resource:view', 'resource:createVersion', 'resource:lockVersion', 'resource:setOfficialVersion', 'resource:deleteVersion', 'resource:export', 'resource:laborEdit', 'resource:nonLaborEdit']
const basic = ['resource:view', 'resource:laborEdit', 'resource:nonLaborEdit']
const management = keys.filter(key => !basic.includes(key))
const types = ['整机产品项目', 'tOS版本项目', '技术项目', '能力建设项目']
const owners = ['SPM', '版本项目经理', '技术项目负责人', '系统管理员']
let checks = 0
const check = async (label, run) => { await run(); checks += 1; console.log(`PASS ${label}`) }
const checkKeys = (user, projectId, allowed) => keys.forEach(key => assert.equal(hasPermission(user, projectId, key), allowed.includes(key), `${projectId} ${user} ${key}`))

await check('Resource configuration exposes exactly the eight agreed keys and Chinese labels', () => {
  assert.deepEqual(constants.RESOURCE_PERMISSION_KEYS, keys)
  assert.deepEqual(constants.PROJECT_PERMISSION_GROUPS.find(group => group.module === '资源').permissions.map(item => item.name), ['查看', '新建版本', '锁定/不锁定', '设置为正式版本', '删除', '导出', '各部门人力投入', '非人力投入'])
})

await check('Four owner mappings, system administrators and ordinary/custom roles receive exact defaults', () => {
  for (const [index, type] of types.entries()) {
    for (const name of ['系统管理员', ...new Set(owners), '项目经理', '普通成员']) {
      for (const isFixed of [false, true]) {
        const defaults = resourcePermissionDefaults({ name, isFixed }, type)
        keys.forEach(key => assert.equal(defaults[key], basic.includes(key) || isFixed && (name === '系统管理员' || name === owners[index]), `${type}/${name}/${isFixed}/${key}`))
      }
    }
  }
})

await check('Established machine SPM roles use real spm fields, splitting comma-separated people', () => {
  const machines = initialProjects.filter(project => project.type === types[0] && ESTABLISHED_FORMAL_PROJECT_IDS.has(project.id))
  assert.ok(machines.length)
  assert.ok(machines.some(project => /[,，、]/.test(project.spm)))
  for (const project of machines) {
    const role = store.getState().rolesByProject[project.id].find(role => role.name === 'SPM')
    assert.equal(role.isFixed, true)
    assert.deepEqual(role.members, [...new Set(project.spm.split(/[,，、]/).map(name => name.trim()).filter(Boolean))])
  }
})

const projects = types.map((type, index) => ({
  id: `resource-default-${index}`, type, createdBy: 'creator', responsiblePersons: [`owner-${index}`],
  spm: 'unrelated-root-spm', technicalLead: ['owner-2'], fieldValues: { tosVersionProjectManager: ['owner-1'] },
}))
store.setState({
  globalRoles: [{ name: '管理组', members: ['global-admin'] }, { name: '编辑组', members: ['global-editor'] }, { name: '查看组', members: ['global-viewer'] }],
})
store.getState().ensureProjectPermissions(projects)

await check('New projects retain derived owners through initializer; ordinary members and nonmembers are scoped', () => {
  store.getState().initProjectPermissions(projects[0].id, { 系统管理员: ['owner-0'] })
  for (const [index, project] of projects.entries()) {
    const role = store.getState().rolesByProject[project.id].find(role => role.name === owners[index])
    assert.deepEqual(role.members, [`owner-${index}`])
    store.getState().setRolesForProject(project.id, roles => [...roles, { name: '普通成员', members: [`member-${index}`], isFixed: false }])
    checkKeys(`owner-${index}`, project.id, keys)
    checkKeys(`member-${index}`, project.id, basic)
    checkKeys('nonmember', project.id, [])
    checkKeys('global-editor', project.id, [])
    checkKeys('global-viewer', project.id, [])
    checkKeys('global-admin', project.id, keys)
    checkKeys(`owner-${(index + 1) % 4}`, project.id, [])
  }
})

await check('Custom privileged-looking names cannot acquire manager defaults during creation, ensure or sync', () => {
  const project = projects[1]
  store.getState().setRolesForProject(project.id, roles => [...roles, { name: 'SPM', members: ['custom-spm'], isFixed: false }])
  store.getState().setRolePermissionsForProject(project.id, permissions => ({ ...permissions, SPM: {} }))
  store.getState().ensureProjectPermissions([project])
  store.getState().syncProjectTeamPermissionMembers(project)
  checkKeys('custom-spm', project.id, basic)
  const established = initialProjects.find(project => project.type === types[0] && ESTABLISHED_FORMAL_PROJECT_IDS.has(project.id))
  store.getState().setRolesForProject(established.id, roles => [...roles.filter(role => role.name !== 'SPM'), { name: 'SPM', members: ['fake-spm'], isFixed: false }])
  store.getState().ensureProjectPermissions([{ ...established, spm: 'real-spm-a，real-spm-b' }])
  assert.deepEqual(store.getState().rolesByProject[established.id].find(role => role.name === 'SPM').members, ['real-spm-a', 'real-spm-b'])
  checkKeys('fake-spm', established.id, [])
})

await check('Missing resource defaults are filled while explicit denial and unrelated permissions survive ensure, sync and reload', async () => {
  const project = projects[2]
  // Seed an old role slot directly so ensure, rather than the setter, performs the upgrade.
  const old = { 'basicInfo:查看': false, 'plan:一级计划-编辑': false, 'resource:createVersion': false, 'resource:laborEdit': false }
  store.setState(state => ({ rolePermissionsByProject: { ...state.rolePermissionsByProject, [project.id]: { ...state.rolePermissionsByProject[project.id], 技术项目负责人: old } } }))
  store.getState().ensureProjectPermissions([project])
  store.getState().syncProjectTeamPermissionMembers(project)
  const expected = { ...resourcePermissionDefaults({ name: owners[2], isFixed: true }, project.type), ...old }
  assert.deepEqual(store.getState().rolePermissionsByProject[project.id].技术项目负责人, expected)
  await store.persist.rehydrate()
  assert.deepEqual(store.getState().rolePermissionsByProject[project.id].技术项目负责人, expected)
  assert.equal(store.getState().projectTypesByProject[project.id], project.type)
  // A user in several roles still receives the union; explicit false is per role.
  assert.equal(hasPermission('owner-2', project.id, 'resource:createVersion'), true)
  store.getState().setRolesForProject(project.id, roles => roles.map(role => role.name === '系统管理员' ? { ...role, members: [] } : role))
  assert.equal(hasPermission('owner-2', project.id, 'resource:createVersion'), false)
  assert.equal(hasPermission('owner-2', project.id, 'resource:laborEdit'), false)
  management.filter(key => key !== 'resource:createVersion').forEach(key => assert.equal(hasPermission('owner-2', project.id, key), true))
})

await check('Legacy storage upgrades at real hydration and preserves denials across a fresh module load', async () => {
  const project = projects[1]
  localStorage.setItem(PERMISSION_STORAGE_KEY, JSON.stringify({ version: PERMISSION_STORAGE_VERSION, state: {
    projectTypesByProject: { [project.id]: project.type },
    rolesByProject: { [project.id]: [{ name: '版本项目经理', members: ['stored-owner'], isFixed: true }, { name: '自定义成员', members: ['stored-member'], isFixed: false }] },
    rolePermissionsByProject: { [project.id]: { 版本项目经理: { 'resource:export': false, 'plan:导出': false }, 自定义成员: { 'resource:view': false } } },
  } }))
  await store.persist.rehydrate()
  checkKeys('stored-owner', project.id, keys.filter(key => key !== 'resource:export'))
  checkKeys('stored-member', project.id, basic.filter(key => key !== 'resource:view'))
  assert.equal(store.getState().rolePermissionsByProject[project.id].版本项目经理['plan:导出'], false)
  store.getState().setPermConfigTab('perms') // Persist the upgraded result through the actual adapter.
  const reloaded = createTypeScriptModuleLoader()(path.resolve('src/stores/permission.ts'))
  assert.equal(reloaded.hasPermission('stored-owner', project.id, 'resource:export'), false)
  assert.equal(reloaded.hasPermission('stored-owner', project.id, 'resource:createVersion'), true)
  assert.equal(reloaded.hasPermission('stored-member', project.id, 'resource:view'), false)
})

await check('Legacy custom-project owners wait for the real project type before missing defaults are granted', async () => {
  const project = { id: 'legacy-no-type', type: types[2], technicalLead: ['legacy-owner'] }
  localStorage.setItem(PERMISSION_STORAGE_KEY, JSON.stringify({ version: 2, state: {
    rolesByProject: { [project.id]: [{ name: '技术项目负责人', members: ['legacy-owner'], isFixed: true }] },
    rolePermissionsByProject: { [project.id]: { 技术项目负责人: { 'resource:export': false } } },
  } }))
  await store.persist.rehydrate()
  assert.equal(hasPermission('legacy-owner', project.id, 'resource:createVersion'), false)
  store.getState().ensureProjectPermissions([project])
  assert.equal(hasPermission('legacy-owner', project.id, 'resource:createVersion'), true)
  assert.equal(hasPermission('legacy-owner', project.id, 'resource:export'), false)
})

await check('Technical and tOS authoritative team synchronization changes members while retaining role grants', () => {
  for (const index of [1, 2]) {
    const project = projects[index]
    store.getState().ensureProjectPermissions([project])
    store.getState().setRolePermissionsForProject(project.id, permissions => ({ ...permissions, [owners[index]]: { ...permissions[owners[index]], 'resource:export': false } }))
    const updated = index === 1 ? { ...project, fieldValues: { tosVersionProjectManager: ['new-tos-owner'] } }
      : { ...project, technicalLead: ['new-tech-owner'] }
    store.getState().syncProjectTeamPermissionMembers(updated)
    assert.deepEqual(store.getState().rolesByProject[project.id].find(role => role.name === owners[index]).members, [index === 1 ? 'new-tos-owner' : 'new-tech-owner'])
    assert.equal(store.getState().rolePermissionsByProject[project.id][owners[index]]['resource:export'], false)
  }
})

console.log(`Resource permission defaults: ${checks} behavioral checks passed.`)
