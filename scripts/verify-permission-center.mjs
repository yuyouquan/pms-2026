import assert from 'node:assert/strict'
import path from 'node:path'
import { loadTypeScriptModule } from './lib/typescript-module-loader.mjs'
const load = file => loadTypeScriptModule(path.resolve(file))
const lib = load('src/lib/permissionCenter.ts')
const constants = load('src/constants/permissionCenter.ts')
const storeModule = load('src/stores/permission.ts')
const { usePermissionStore: store } = storeModule
const center = { version: 2, groups: [{ id: 'group-project', name: '项目组' }], roles: [{ id: constants.SUPER_ADMIN_ROLE_ID, groupId: 'group-project', name: '系统超级管理员', description: '', members: ['演示用户01'], departments: [], builtin: 'superadmin' }], policies: [] }
const role = { id: '演示用户02', groupId: 'group-project', name: 'Reader', description: '', members: ['演示用户02'], departments: [] }
center.roles.push(role)
const policy = (menuId, actions, brand, columns) => ({ ...lib.createEmptyMenuPolicy(role.id, menuId), actions, data: { mode: 'conditions', conjunction: 'all', conditions: [{ id: 'brand', field: 'brand', operator: 'eq', value: brand }] }, columns: { mode: 'selected', fields: ['firstSaleTosVersionId', ...columns] } })
center.policies.push(policy('roadmap.table', ['view', 'export'], '示例品牌A', ['displayName']))
center.roles.push({ ...role, id: 'second', name: 'Second' })
center.policies.push({ ...policy('roadmap.table', ['view'], '示例品牌B', ['remark']), roleId: 'second' })
const rows = [{ id: 'a', brand: '示例品牌A', displayName: 'A', remark: 'secret A' }, { id: 'b', brand: '示例品牌B', displayName: 'B', remark: 'secret B' }]
assert.equal(lib.evaluateMenuPermission(center, '演示用户02', 'roadmap.table', 'export', rows[1]), false)
assert.equal(lib.evaluateMenuPermission(center, 'outsider', 'project.view', 'view'), false)
assert.deepEqual(lib.projectAuthorizedRows(center, '演示用户02', 'roadmap.table', 'export', rows), [{ id: 'a', displayName: 'A' }])
assert.equal(lib.projectAuthorizedRows(center, '演示用户02', 'roadmap.table', 'view', rows)[0].remark, undefined)
assert.equal(lib.validateMenuPolicy({ ...center.policies[0], data: { mode: 'conditions', conjunction: 'all', conditions: [] } }).ok, false)
assert.equal(lib.validateMenuPolicy({ ...center.policies[0], data: { mode: 'conditions', conjunction: 'any', conditions: [{ field: 'unknown', operator: 'eq', value: 'x' }] } }).ok, false)
assert.equal(lib.isPermissionCenterAdmin(center, '演示用户01'), true)
assert.equal(lib.isPermissionCenterAdmin({ ...center, roles: [{ ...role, name: '管理组', members: ['演示用户02'] }] }, '演示用户02'), false)
store.setState({ permissionCenter: center })
assert.equal(store.getState().createCenterRole('outsider', { name: 'X', groupName: 'X' }).ok, false)
assert.equal(store.getState().createCenterRole('演示用户01', { name: 'ＲＥＡＤＥＲ', groupName: 'X' }).ok, false)
assert.equal(store.getState().setSuperAdminMembers('演示用户01', []).ok, false)
assert.equal(store.getState().deleteCenterRole('演示用户01', constants.SUPER_ADMIN_ROLE_ID).ok, false)
const created = store.getState().createCenterRole('演示用户01', { name: 'New', groupName: 'New group' })
assert.equal(created.ok, true)
assert.equal(store.getState().permissionCenter.policies.some(p => p.roleId === created.roleId), false)
assert.equal(store.getState().updateCenterRole('演示用户01', created.roleId, { name: 'Renamed', groupName: 'New group', description: 'scope' }).ok, true)
assert.equal(store.getState().deleteCenterRole('演示用户01', created.roleId).ok, true)
console.log('Permission center behavioral checks passed')
// Numeric/date ordering, all/any, departments, malformed grants and action dependencies.
const numericField = { key: 'progress', label: '进度', kind: 'number' }
assert.equal(lib.matchesPermissionCondition({ progress: 10 }, { field: 'progress', operator: 'gt', value: '2' }, numericField), true)
assert.equal(lib.matchesPermissionCondition({ progress: 2 }, { field: 'progress', operator: 'gt', value: '10' }, numericField), false)
assert.equal(lib.matchesPermissionCondition({ launchDate: '2026-10-01' }, { field: 'launchDate', operator: 'lt', value: '2026-09-01' }, { kind: 'date' }), false)
const dept = { ...lib.createEmptyMenuPolicy('演示用户02', 'project.view'), actions: ['view'] }
assert.equal(lib.evaluateMenuPermission({ ...center, roles: [{ ...role, departments: ['示例测试组'] }], policies: [dept] }, '演示用户04', 'project.view'), true)
assert.equal(lib.evaluateMenuPermission({ ...center, roles: [{ ...role, departments: ['示例测试组'] }], policies: [dept] }, '演示用户01', 'project.view'), false)
const any = { ...center.policies[0], data: { mode: 'conditions', conjunction: 'any', conditions: [{ id: 'a', field: 'brand', operator: 'eq', value: '示例品牌A' }, { id: 'b', field: 'brand', operator: 'eq', value: '示例品牌B' }] } }
assert.equal(lib.matchesPermissionData(any, rows[1]), true)
assert.equal(lib.matchesPermissionData({ ...any, data: { ...any.data, conjunction: 'all' } }, rows[1]), false)
assert.deepEqual(lib.normalizePolicyActions(['edit']), ['view', 'edit'])
assert.deepEqual(lib.normalizePolicyActions(['edit'], ['view', 'edit']), [])
assert.equal(store.getState().setSuperAdminMembers('演示用户01', ['invented-unselectable-user']).ok, false)
const managed = { ...lib.createEmptyMenuPolicy('演示用户02', 'permission.center'), actions: ['view', 'manage'] }
store.setState({ permissionCenter: { ...store.getState().permissionCenter, roles: store.getState().permissionCenter.roles.map(r => r.id === role.id ? { ...r, members: [...r.members, '演示用户03'] } : r), policies: [...store.getState().permissionCenter.policies, managed] } })
assert.equal(store.getState().setSuperAdminMembers('演示用户03', ['演示用户04']).ok, false)
assert.equal(store.getState().updateCenterRole('演示用户03', constants.SUPER_ADMIN_ROLE_ID, { name: 'Hijack', groupName: 'x' }).ok, false)
const beforeInvalid = store.getState().permissionCenter
assert.equal(store.getState().updateMenuPolicy('演示用户01', '演示用户02', 'roadmap.table', { data: { mode: 'conditions', conjunction: 'all', conditions: [] } }).ok, false)
assert.equal(store.getState().permissionCenter, beforeInvalid)
const restored = lib.parsePermissionCenter(JSON.parse(JSON.stringify(center)))
assert.deepEqual(restored, center)
assert.equal(lib.evaluateMenuPermission(lib.parsePermissionCenter({ version: 900 }), '演示用户01', 'project.view'), false)
constants.registerPermissionFields('project.view', [{ key: 'task:milestone', label: '任务里程碑', kind: 'date' }])
const dynamic = { ...lib.createEmptyMenuPolicy('演示用户02', 'project.view'), actions: ['view'], data: { mode: 'conditions', conjunction: 'all', conditions: [{ id: 'd', field: 'task:milestone', operator: 'gte', value: '2026-09-01' }] } }
assert.equal(lib.validateMenuPolicy(dynamic).ok, true)
assert.equal(lib.evaluateMenuPermission({ ...center, policies: [dynamic] }, '演示用户02', 'project.view', 'view', { 'task:milestone': '2026-09-28' }), true)
// Browser-like storage failure must keep the actual model and grants unchanged.
const beforeFailure = store.getState().permissionCenter
const storageMap = new Map([['pms:mock-dataset-version', '2026-09-15-v1']])
let failWrite = true
globalThis.window = { localStorage: { getItem: key => storageMap.get(key) ?? null, setItem: (key, value) => { if (failWrite) throw new Error('quota'); storageMap.set(key, value) }, removeItem: key => storageMap.delete(key) } }
assert.equal(store.getState().createCenterRole('演示用户01', { name: 'Failed write', groupName: 'No remnants' }).ok, false)
assert.equal(store.getState().permissionCenter, beforeFailure)
failWrite = false
const saved = store.getState().createCenterRole('演示用户01', { name: 'Saved write', groupName: 'New persisted' })
assert.equal(saved.ok, true)
const persisted = JSON.parse(storageMap.get('pms-project-permissions'))
assert.equal(persisted.version, storeModule.PERMISSION_STORAGE_VERSION)
assert.deepEqual(lib.parsePermissionCenter(persisted.state.permissionCenter), store.getState().permissionCenter)
delete globalThis.window
console.log('Permission center edge/migration/storage checks passed')
