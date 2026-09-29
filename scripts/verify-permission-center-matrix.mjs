import assert from 'node:assert/strict'
import path from 'node:path'
import { loadTypeScriptModule } from './lib/typescript-module-loader.mjs'

const tree = loadTypeScriptModule(path.resolve('src/components/permission-center/menuTree.ts'))
const catalog = loadTypeScriptModule(path.resolve('src/constants/permissionCenter.ts'))
const nodes = tree.buildPermissionMenuTree()
const leaves = (items, parents = []) => items.flatMap(node => node.children
  ? leaves(node.children, [...parents, node.label])
  : [{ id: node.key, label: node.label, parents }])
const rows = leaves(nodes)
const ids = rows.map(row => row.id)
const expected = catalog.PERMISSION_MENUS.filter(menu => !menu.id.startsWith('hr.') && !menu.id.startsWith('config.hrPipeline:')).map(menu => menu.id)
assert.deepEqual([...ids].sort(), expected.sort(), 'every in-scope menu appears exactly once')
assert.equal(new Set(ids).size, ids.length)
const groupKeys = tree.getMenuGroupKeys(nodes)
assert.equal(new Set(groupKeys).size, groupKeys.length, 'same labels under different parents must collapse independently')
assert(groupKeys.every(key => !ids.includes(key)), 'group controls must never target menu policies')
assert.deepEqual(rows.filter(row => row.parents[0] === '项目管理').map(row => row.label), ['项目视图', '项目配置'])
assert(rows.filter(row => row.id.startsWith('config.transfer:')).every(row => row.parents.length === 3 && !row.label.includes(' / ')), 'transfer templates retain category and project-type hierarchy')
for (const query of ['配置中心 计划模板', '整机产品项目', '项目配置']) {
  const filtered = leaves(tree.buildPermissionMenuTree(query))
  assert(filtered.length > 0, 'search should retain matching menus and their full ancestors')
  for (const row of filtered) for (const term of query.split(' ')) assert([...row.parents, row.label].join(' ').includes(term))
}
assert.equal(tree.buildPermissionMenuTree('不存在的菜单').length, 0)
console.log('PASS permission function hierarchy, menu coverage, independent groups and full-path search')
