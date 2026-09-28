import assert from 'node:assert/strict'
import path from 'node:path'
import { loadTypeScriptModule } from './lib/typescript-module-loader.mjs'

const tree = loadTypeScriptModule(path.resolve('src/components/permission-center/menuTree.ts'))
const catalog = loadTypeScriptModule(path.resolve('src/constants/permissionCenter.ts'))
const result = tree.buildPermissionMatrixRows()
const ids = result.rows.map(row => row.menu.id)
const expected = catalog.PERMISSION_MENUS.filter(menu => !menu.id.startsWith('hr.') && !menu.id.startsWith('config.hrPipeline:')).map(menu => menu.id)
assert.deepEqual([...ids].sort(), expected.sort(), 'every in-scope menu appears exactly once')
assert.equal(new Set(ids).size, ids.length)
assert.equal(result.depth, 3, 'transfer templates retain module, category and project-type parents')

function verifySpans({ rows, depth }) {
  for (let column = 0; column < depth; column++) {
    const covered = new Set()
    rows.forEach((row, index) => {
      if (!row.parents[column]) {
        assert.equal(row.spans[column], 1, 'shallow menus must retain blank ancestor cells so actions stay in their column')
        return
      }
      if (row.spans[column] === 0) {
        assert(covered.has(index), `hidden parent at row ${index} must be covered by a previous span`)
        return
      }
      for (let offset = 0; offset < row.spans[column]; offset++) {
        const next = index + offset
        assert(next < rows.length, 'span must remain within the table')
        assert(!covered.has(next), 'merged cells must not overlap')
        assert.deepEqual(rows[next].parents.slice(0, column + 1), row.parents.slice(0, column + 1), 'merge must preserve complete parent path')
        covered.add(next)
      }
    })
    assert.equal(covered.size, rows.filter(row => row.parents[column]).length, 'all real ancestors must remain visible through a merged cell')
  }
}
verifySpans(result)
const project = result.rows.filter(row => row.parents[0] === '项目管理')
assert.equal(project[0].spans[0], 2)
assert.equal(project[1].spans[0], 0)
assert.deepEqual(project.map(row => row.leaf), ['项目视图', '项目配置'])
assert(result.rows.filter(row => row.menu.id.startsWith('config.transfer:')).every(row => row.parents.length === 3 && !row.leaf.includes(' / ')), 'transfer leaf labels must not flatten the path')
for (const query of ['配置中心 计划模板', '整机产品项目', '项目配置', '不存在的菜单']) {
  const filtered = tree.buildPermissionMatrixRows(query)
  verifySpans(filtered)
  for (const row of filtered.rows) for (const term of query.split(' ')) assert([...row.parents, row.leaf].join(' ').includes(term))
}
assert.equal(tree.buildPermissionMatrixRows('不存在的菜单').rows.length, 0)
console.log('PASS permission matrix menu coverage, full hierarchy, merged-cell coverage and filtered spans')
