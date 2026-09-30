import assert from 'node:assert/strict'
import path from 'node:path'
import { loadTypeScriptModule } from './lib/typescript-module-loader.mjs'
const load = file => loadTypeScriptModule(path.resolve(file))
const metadata = load('src/constants/permissionCenter.ts')
const projects = load('src/lib/projectMenuPermissions.ts')
const summary = load('src/lib/projectSummary.ts')
const tasks = [{ id: 'phase', taskName: '阶段' }, { id: 'gate', parentId: 'phase', taskName: '验收' }, { id: 'gate2', parentId: 'phase', taskName: '发布' }]
const { getTemplateSnapshotKey } = load('src/lib/projectTemplateCompatibility.ts')
const { getTemplateConfigScopeKey } = load('src/lib/technicalPlanRules.ts')
const snapshots = Object.fromEntries(['tdt', 'subproject'].map(level => [getTemplateSnapshotKey('技术项目', 'v1', level), tasks]))
const scopes = Object.fromEntries(['tdt', 'subproject'].map(level => [getTemplateConfigScopeKey('技术项目', level), { versions: [{ id: 'v1', versionNo: 'V001', status: '已发布' }], currentVersion: 'v1' }]))
projects.registerProjectPermissionFields({ 整机产品项目: tasks, tOS版本项目: tasks }, snapshots, scopes)
assert(metadata.getPermissionColumnFields('project.view', 'machine').some(field => field.source === 'templateTask'), 'Preserve the actual list field source so milestone grouping matches Project View')
const columns = load('src/lib/permissionColumnUnits.ts')
const order = load('src/lib/projectListColumnOrder.ts')
for (const [scope, type, template] of [['machine', '整机产品项目', tasks], ['tos', 'tOS版本项目', tasks], ['technical-tdt', '技术项目', tasks], ['technical-subproject', '技术项目', tasks], ['capability', '能力建设项目', []]]) {
  const expected = order.buildProjectListColumnUnits(summary.getProjectListFieldDefinitions(scope, template, type).map(field => ({ ...field, defaultVisible: true })))
  const actual = columns.getPermissionColumnUnits('project.view', scope)
  assert.deepEqual(actual.map(unit => [unit.key, unit.label, unit.fieldKeys]), expected.map(unit => [unit.key, unit.title, unit.leafKeys]), `${scope} must expose exactly the same column units as Project View`)
}
const units = columns.getPermissionColumnUnits('project.view', 'machine')
const milestone = units.find(unit => unit.key === 'milestone')
assert(milestone.fieldKeys.length > 1)
assert.equal(units.filter(unit => unit.label === '里程碑').length, 1)
const partial = ['projectName', milestone.fieldKeys[0]]
assert.deepEqual(columns.getPermissionColumnUnitState(milestone, partial), { checked: false, indeterminate: true, selectedCount: 1 })
const unrelated = units.find(unit => unit.key === 'brand')
assert.deepEqual(columns.togglePermissionColumnUnit(partial, unrelated, true), [...partial, 'brand'], 'Unrelated edits must not expand a partially granted milestone')
const full = columns.togglePermissionColumnUnit(partial, milestone, true)
assert(columns.getPermissionColumnUnitState(milestone, full).checked)
assert.deepEqual(columns.togglePermissionColumnUnit(full, milestone, false), ['projectName'])
assert.deepEqual(columns.getSelectedPermissionColumns('project.view', { mode: 'selected', fields: ['name', 'unknown', milestone.fieldKeys[0]] }, 'machine'), ['projectName', milestone.fieldKeys[0]], 'Legacy aliases normalize without granting missing leaves')
assert(columns.getPermissionColumnUnits('project.view', 'tos').find(unit => unit.key === 'tosVersion').required)
assert(columns.getPermissionColumnUnits('project.view', 'technical-subproject').find(unit => unit.key === 'projectName').required)
const otherMenu = columns.getPermissionColumnUnits('project.config')
assert(otherMenu.every(unit => unit.fieldKeys.length === 1), 'Other data menus retain independent fields')
assert.deepEqual(columns.getPermissionColumnUnits('project.view', 'capability'), [])
console.log('Permission column units: list parity, milestone grouping, partial grants, atomic toggles, aliases and empty scope passed')
