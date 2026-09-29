import assert from 'node:assert/strict'
import path from 'node:path'
import { loadTypeScriptModule } from './lib/typescript-module-loader.mjs'
const load = file => loadTypeScriptModule(path.resolve(file))
const core = load('src/lib/permissionCenter.ts')
const metadata = load('src/constants/permissionCenter.ts')
const projects = load('src/lib/projectMenuPermissions.ts')
const summary = load('src/lib/projectSummary.ts')
const tasks = [{ id: 'phase', taskName: '阶段' }, { id: 'gate', parentId: 'phase', taskName: '验收', planEndDate: '2026-09-28' }]
projects.registerProjectPermissionFields({ 整机产品项目: tasks, tOS版本项目: tasks })
for (const [scope, type, template] of [['machine', '整机产品项目', tasks], ['tos', 'tOS版本项目', tasks], ['technical-tdt', '技术项目', []], ['technical-subproject', '技术项目', []], ['capability', '能力建设项目', []]]) {
  assert.deepEqual(metadata.getPermissionColumnFields('project.view', scope).map(f => [f.key, f.label]), summary.getProjectListFieldDefinitions(scope, template, type).map(f => [f.key, f.title]), `${scope} column catalog must exactly match the list`)
}
const actor = '演示用户02'
const role = id => ({ id, groupId: 'g', name: id, description: '', members: [actor], departments: [] })
const all = { mode: 'all', conjunction: 'all', conditions: [] }
const columns = (...fields) => ({ mode: 'selected', fields })
const rule = (field, value, ...keys) => ({ data: { mode: 'conditions', conjunction: 'all', conditions: [{ id: field, field, operator: 'eq', value }] }, columns: columns(...keys) })
const policy = { ...core.createEmptyMenuPolicy('a', 'project.view'), actions: ['view', 'export'], projectScopes: {
  machine: rule('brand', '示例品牌A', 'projectName', 'brand'),
  tos: rule('tosVersion', 'tOS 16', 'tosVersion', 'spm'),
  'technical-tdt': { data: all, columns: columns('projectName', 'technicalTrack') },
  'technical-subproject': { data: all, columns: columns('projectName', 'coreValue') },
} }
const model = { version: 2, groups: [{ id: 'g', name: 'G' }], roles: [role('a')], policies: [policy] }
const source = (id, type, fields = {}) => ({ id, name: id, projectName: id, type, ...fields })
const machine = source('machineA', '整机产品项目', { brand: '示例品牌A' })
const wrongMachine = source('machineB', '整机产品项目', { brand: '示例品牌B' })
const tos = source('tos16', 'tOS版本项目', { tosVersion: 'tOS 16', spm: 'Alice' })
const wrongTos = source('tos15', 'tOS版本项目', { tosVersion: 'tOS 15' })
assert.equal(core.validateMenuPolicy(policy).ok, true)
for (const action of ['view', 'export']) {
  assert.equal(core.evaluateMenuPermission(model, actor, 'project.view', action, machine), true)
  assert.equal(core.evaluateMenuPermission(model, actor, 'project.view', action, wrongMachine), false)
  assert.equal(core.evaluateMenuPermission(model, actor, 'project.view', action, tos), true)
  assert.equal(core.evaluateMenuPermission(model, actor, 'project.view', action, wrongTos), false)
}
assert(core.getAuthorizedColumns(model, actor, 'project.view', 'view', machine).includes('brand'))
assert(!core.getAuthorizedColumns(model, actor, 'project.view', 'view', tos).includes('brand'))
assert(!projects.hasAllProjectFields(model, actor, 'project.view', machine), 'A scoped selected-column override must not fall back to all base columns')
assert(core.getAuthorizedColumns(model, actor, 'project.view', 'view', undefined, 'technical-tdt').includes('technicalTrack'))
assert(!core.getAuthorizedColumns(model, actor, 'project.view', 'view', undefined, 'technical-subproject').includes('technicalTrack'))
assert(core.getAuthorizedColumns(model, actor, 'project.view', 'view', source('child', '技术项目', { technicalProjectType: 'subproject' })).includes('coreValue'))
assert.equal(core.evaluateWholeMenuPermission(model, actor, 'project.view', 'export'), false)
const persisted = core.parsePermissionCenter(JSON.parse(JSON.stringify(model)))
assert.deepEqual(persisted, model)
assert.equal(core.evaluateMenuPermission(persisted, actor, 'project.view', 'view', wrongMachine), false)
const corrupt = JSON.parse(JSON.stringify(model))
corrupt.policies[0].projectScopes.machine.columns.mode = 'bad'
assert.equal(core.evaluateMenuPermission(core.parsePermissionCenter(corrupt), actor, 'project.view', 'view', machine), false, 'Corrupt scope cannot restore an all-data base grant')
const noActions = { ...model, policies: [{ ...policy, actions: [] }] }
assert.equal(core.evaluateMenuPermission(noActions, actor, 'project.view', 'view', machine), false)
const legacy = { ...core.createEmptyMenuPolicy('a', 'project.view'), actions: ['view'], data: rule('brand', '示例品牌A', 'name').data, columns: columns('name') }
const legacyModel = { ...model, policies: [legacy] }
assert.equal(core.evaluateMenuPermission(legacyModel, actor, 'project.view', 'view', wrongMachine), false)
assert.equal(projects.canReadProjectClassification(legacyModel, actor, machine), false)
const union = { ...model, roles: [role('a'), role('b')], policies: [policy, { ...core.createEmptyMenuPolicy('b', 'project.view'), actions: ['view'], projectScopes: { machine: rule('brand', '示例品牌B', 'projectName', 'status') } }] }
assert(!core.getAuthorizedColumns(union, actor, 'project.view', 'export', wrongMachine).includes('status'))
assert(!core.getAuthorizedColumns(union, actor, 'project.view', 'view', machine).includes('status'), 'Fields from a nonmatching role must not leak')
// Preserve the old name filter's parent-project meaning for child rows.
const legacyParentRestriction = { ...legacy, data: { ...legacy.data, conditions: [{ id: 'parent', field: 'name', operator: 'neq', value: 'Restricted TDT' }] } }
const legacyChildSource = source('Restricted TDT', '技术项目', { projectName: 'Child A', technicalProjectType: 'subproject' })
assert.equal(core.evaluateMenuPermission({ ...model, policies: [legacyParentRestriction] }, actor, 'project.view', 'view', legacyChildSource), false)
const otherScopeOnly = { ...legacyParentRestriction, projectScopes: { machine: { data: all, columns: columns('projectName') } } }
assert.equal(core.evaluateMenuPermission({ ...model, policies: [otherScopeOnly] }, actor, 'project.view', 'view', legacyChildSource), false)
const childOnly = { ...model, policies: [{ ...policy, projectScopes: {
  'technical-tdt': rule('projectName', '不可见父项目', 'projectName'),
  'technical-subproject': { data: all, columns: columns('projectName') },
} }] }
const parent = source('技术父项目', '技术项目')
const child = { projectName: '允许的子项目', technicalProjectType: 'subproject', targetSubprojectId: 'child-1' }
assert.equal(core.evaluateMenuPermission(childOnly, actor, 'project.view', 'view', parent), false)
const classification = projects.getReadableProjectClassificationSource(childOnly, actor, parent, [child])
assert.equal(classification.projectName, '允许的子项目')
assert.equal(projects.matchesAuthorizedProjectClassification(childOnly, actor, classification, '技术项目'), true)
assert.equal(projects.getReadableProjectClassificationSource(childOnly, actor, parent, []), undefined)
assert.equal(projects.getReadableProjectClassificationSource(childOnly, actor, parent, [child], true), undefined)
// The current published technical template is the same source as both technical lists;
// old snapshots and an unrelated project's milestones cannot enter its column picker.
const { getTemplateSnapshotKey } = load('src/lib/projectTemplateCompatibility.ts')
const { getTemplateConfigScopeKey } = load('src/lib/technicalPlanRules.ts')
const technicalTasks = [{ id: 'root', taskName: '技术阶段' }, { id: 'tech-gate', parentId: 'root', taskName: '技术验收' }]
const childTasks = [{ id: 'child-root', taskName: '子项目交付' }]
const snapshots = { [getTemplateSnapshotKey('技术项目', 'v2', 'tdt')]: technicalTasks, [getTemplateSnapshotKey('技术项目', 'v1', 'tdt')]: [{ id: 'old', taskName: '不应显示旧字段' }], [getTemplateSnapshotKey('技术项目', 'v2', 'subproject')]: childTasks }
const scopeVersions = { versions: [{ id: 'v2', versionNo: 'V002', status: '已发布' }, { id: 'v1', versionNo: 'V001', status: '已发布' }], currentVersion: 'v2' }
projects.registerProjectPermissionFields({ 整机产品项目: tasks }, snapshots, { [getTemplateConfigScopeKey('技术项目', 'tdt')]: scopeVersions, [getTemplateConfigScopeKey('技术项目', 'subproject')]: scopeVersions })
for (const [scope, template] of [['technical-tdt', technicalTasks], ['technical-subproject', childTasks]]) {
  assert.deepEqual(metadata.getPermissionColumnFields('project.view', scope).map(f => [f.key, f.label]), summary.getProjectListFieldDefinitions(scope, template, '技术项目').map(f => [f.key, f.title]))
}
assert.equal(core.evaluateMenuPermission(model, actor, 'project.view', 'view', { ...wrongMachine, type: '整机-手机' }), false, 'Legacy project type aliases must not bypass scope conditions')
assert.equal(core.evaluateMenuPermission(model, actor, 'project.view', 'view', { ...tos, type: '独立软件产品项目' }), true)
const emptyColumns = { ...policy, projectScopes: { machine: { data: all, columns: columns() } } }
assert.equal(core.validateMenuPolicy(emptyColumns).ok, true)
assert(!core.getAuthorizedColumns({ ...model, policies: [emptyColumns] }, actor, 'project.view', 'view', machine).includes('name'))
const seeded = load('src/lib/permissionCenterSeed.ts').createPermissionCenterSeed()
seeded.roles.push(role('a')); seeded.groups.push({ id: 'g', name: 'G' }); seeded.policies.push(policy)
const { usePermissionStore } = load('src/stores/permission.ts')
usePermissionStore.setState({ permissionCenter: seeded })
const saved = usePermissionStore.getState().updateMenuPolicy('SnoopyYu', 'a', 'project.view', previous => ({ ...previous, projectScopes: { ...previous.projectScopes, tos: { data: all, columns: columns('tosVersion') } } }))
assert.equal(saved.ok, true)
const updated = usePermissionStore.getState().permissionCenter.policies.find(p => p.roleId === 'a')
assert.deepEqual(updated.projectScopes.machine, policy.projectScopes.machine)
assert.deepEqual(updated.actions, ['view', 'export'])
const revoke = usePermissionStore.getState().updateMenuActionsBulk('SnoopyYu', 'a', [{ menuId: 'project.view', actions: ['view', 'export'] }], false)
assert.equal(revoke.ok, true)
const revoked = usePermissionStore.getState().permissionCenter.policies.find(p => p.roleId === 'a')
assert.deepEqual(revoked.actions, [])
assert.deepEqual(revoked.projectScopes, updated.projectScopes)
assert.deepEqual(core.parsePermissionCenter(usePermissionStore.getState().permissionCenter).policies.find(p => p.roleId === 'a'), revoked)
console.log('Project type data permissions: catalog parity, independent scope rules, aliases, persistence, fail-closed, view/export and role unions passed')
