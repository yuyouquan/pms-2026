import assert from 'node:assert/strict'
import path from 'node:path'
import { loadTypeScriptModule } from './lib/typescript-module-loader.mjs'

const load = file => loadTypeScriptModule(path.resolve(file))
const permission = load('src/lib/permissionCenter.ts')
const roadmap = load('src/lib/roadmapPermission.ts')
const { applyRoadmapFilters } = load('src/lib/roadmapFilters.ts')
const { ROADMAP_COLUMNS } = load('src/types/roadmap.ts')
const model = permission.migrateLegacyPermissionCenter([{ name: '管理组', members: ['admin'] }], {})
const addPolicy = (id, menu, brand, actions, fields) => {
  model.roles.push({ id, name: id, groupId: 'group-roadmap', description: '', members: [] })
  model.policies.push({
    ...permission.createEmptyMenuPolicy(id, menu), users: ['reader'], actions,
    data: { mode: 'conditions', conjunction: 'all', conditions: [{ id: 'brand', field: 'brand', operator: 'eq', value: brand }] },
    columns: { mode: 'selected', fields },
  })
}
addPolicy('a-export', 'roadmap.table', '示例品牌A', ['view', 'export'], ['firstSaleTosVersionId', 'displayName', 'brand'])
addPolicy('b-view', 'roadmap.table', '示例品牌B', ['view'], ['firstSaleTosVersionId', 'remark'])
addPolicy('a-evolution', 'roadmap.evolution', '示例品牌A', ['view'], ['firstSaleTosVersionId', 'marketName', 'displayName'])
assert.equal(model.policies.every(policy => permission.validateMenuPolicy(policy).ok), true)
const rows = ['A', 'B', 'C'].map((brand, index) => roadmap.completeProjectedRoadmapRow({
  id: brand, source: 'normal', brand: `示例品牌${brand}`, firstSaleTosVersionId: `${index + 1}.0`,
  displayName: `Visible name ${brand}`, marketName: `Market ${brand}`, productType: '新品',
  remark: `Private remark ${brand}`, projectCode: `Private code ${brand}`, androidVersion: 'Android 17',
}))
const versions = rows.map((row, index) => ({ id: row.firstSaleTosVersionId, name: row.firstSaleTosVersionId, major: index + 1, minor: 0, targets: [], periodStartDate: '', periodEndDate: '', createdAt: '', updatedAt: '' }))
const table = roadmap.projectRoadmapRows(model, 'reader', 'roadmap.table', 'view', rows)
assert.deepEqual(table.map(row => row.id), ['A', 'B'])
assert.equal(table[0].remark, '')
assert.equal(table[1].displayName, '')
assert.equal(table[1].brand, '')
assert.equal(table[0].projectCode, '')
assert.equal(table[0].source, '', 'selected fields must not restore raw metadata')
const scopedVersions = roadmap.scopeRoadmapVersions(versions, table)
assert.deepEqual(scopedVersions.map(version => version.id), ['1.0', '2.0'])
const definitions = roadmap.buildAuthorizedRoadmapFilterDefinitions(table, scopedVersions, permission.getAuthorizedColumns(model, 'reader', 'roadmap.table'))
assert.deepEqual(definitions.find(field => field.key === 'brand').options.map(option => option.value), ['示例品牌A'])
assert.equal(definitions.some(field => field.key === 'projectCode'), false)
assert.deepEqual(applyRoadmapFilters(table, 'all', 'all', [], definitions).map(row => row.id), ['A', 'B'], 'clearing personal filters cannot restore C')
assert.deepEqual(applyRoadmapFilters(table, 'all', 'all', [{ id: 'hidden-b', field: 'brand', operator: 'equals', value: '示例品牌B' }], definitions), [], 'hidden B brand cannot be used as a filter oracle')
const keys = ROADMAP_COLUMNS.map(column => column.key)
const exported = roadmap.buildRoadmapPermissionExport(model, 'reader', 'roadmap.table', rows, versions, [], keys, keys, null)
assert.deepEqual(exported.rows.map(row => row.id), ['A'])
assert.deepEqual(exported.columns, ['firstSaleTosVersionId', 'brand', 'displayName'])
assert.equal(exported.rows[0].remark, '')
assert.deepEqual(roadmap.buildRoadmapPermissionExport(model, 'reader', 'roadmap.table', rows, versions, [], keys, keys, '2.0').rows, [])
assert.deepEqual(roadmap.buildRoadmapPermissionExport(model, 'reader', 'roadmap.evolution', rows, versions, [], keys, keys, null).rows, [])
const evolution = roadmap.projectRoadmapRows(model, 'reader', 'roadmap.evolution', 'view', rows)
assert.deepEqual(evolution.map(row => row.id), ['A'])
assert.equal(evolution[0].displayName, rows[0].displayName)
assert.equal(evolution[0].productType, '')
assert.equal(evolution[0].brand, '')
assert.equal(evolution[0].androidVersion, '')
assert.equal(permission.evaluateWholeMenuPermission(model, 'reader', 'roadmap.table', 'view'), false)
assert.deepEqual(roadmap.projectRoadmapRows({ ...model, policies: [] }, 'reader', 'roadmap.table', 'view', rows), [], 'revocation invalidates already selected rows')
assert.deepEqual(roadmap.projectRoadmapRows(model, 'outsider', 'roadmap.table', 'view', rows), [])
assert.deepEqual(roadmap.projectRoadmapRows(model, 'admin', 'roadmap.table', 'view', rows), rows)
console.log('Roadmap permission checks passed: menu scope, projected candidates, field isolation, export action, revocation, superadmin')
