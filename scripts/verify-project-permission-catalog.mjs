import assert from 'node:assert/strict'
import { loadTypeScriptModule } from './lib/source-contract.mjs'
const { getProjectPermissionCatalog } = loadTypeScriptModule(process.cwd(), 'src/components/permission/projectPermissionCatalog.ts')
const catalog = (type, projectAttribute = 'formal') => getProjectPermissionCatalog({ type, projectAttribute })
const keys = groups => groups.flatMap(group => group.rows.flatMap(row => row.actions.map(action => action.key)))
const machine = catalog('整机产品项目')
assert.deepEqual(machine.map(group => group.id), ['basic', 'plan', 'resources', 'permission'])
assert(keys(machine).includes('basicInfo:applyTransfer'))
assert(keys(machine).includes('plan:二级计划-编辑'))
assert(machine.find(group => group.id === 'plan').rows.find(row => row.id === 'plan-l2').actions.some(action => action.key === 'plan:导出'), 'Version-train export shares the plan export gate')
assert.equal(machine.find(group => group.id === 'plan').rows.find(row => row.id === 'plan-mr').actions[0].key, 'plan:一级计划-查看', 'MR surface uses the shared L1 view gate')
assert(!keys(machine).includes('plan:导入'), 'No regular-plan import action exists')
assert(!keys(machine).includes('plan:一级计划-编辑'), 'L1 maintenance follows fixed responsibility governance')
const technical = catalog('技术项目')
assert(keys(technical).includes('plan:导入'))
assert(!keys(technical).includes('basicInfo:applyTransfer'))
assert(!keys(technical).includes('plan:二级计划-编辑'))
for (const type of ['整机产品项目', '技术项目', 'tOS版本项目']) {
  assert.deepEqual(catalog(type, 'budget').map(group => group.id), ['resources', 'permission'])
  assert.deepEqual(catalog(type, 'roadmap').map(group => group.id), ['basic', 'permission'])
}
assert.deepEqual(catalog('能力建设项目').map(group => group.id), ['resources', 'permission'])
for (const groups of [machine, technical, catalog('tOS版本项目')]) {
  for (const group of groups) {
    assert(group.rows.length > 0)
    for (const row of group.rows) assert(row.actions.length > 0, 'No empty permission rows')
  }
}
console.log('PASS project-space catalog: actual operations, project type and attribute scope, no placeholder columns')
