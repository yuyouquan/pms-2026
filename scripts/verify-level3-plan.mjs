import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const rulesPath = path.join(root, 'src/lib/level3PlanRules.ts')

if (!fs.existsSync(rulesPath)) {
  throw new Error('src/lib/level3PlanRules.ts does not exist')
}

const source = fs.readFileSync(rulesPath, 'utf8')
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: rulesPath,
}).outputText
const rules = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`)

const parent = {
  id: 'p1', parentId: null, order: 0, activityName: '父活动', responsible: '张三',
  responsibleDepartment: '待补充', planStartDate: '', planEndDate: '', actualStartDate: '', actualEndDate: '',
  milestoneId: '', milestoneName: '', milestonePlanEndDate: '', status: '待启动', risk: '无', remark: '',
  creator: '张三', createdAt: '2026-08-17 10:00:00', updatedBy: '张三', updatedAt: '2026-08-17 10:00:00',
}
const childA = {
  ...parent, id: 'c1', parentId: 'p1', order: 0, activityName: '子活动A', responsible: '李四',
  planStartDate: '2026-01-03', planEndDate: '2026-01-08', actualStartDate: '2026-01-04', actualEndDate: '2026-01-07',
}
const childB = {
  ...parent, id: 'c2', parentId: 'p1', order: 1, activityName: '子活动B',
  planStartDate: '2026-01-01', planEndDate: '2026-01-10', actualStartDate: '2026-01-02', actualEndDate: '2026-01-09',
}

assert.deepEqual(
  rules.numberLevel3Activities([parent, childA, childB]).map(row => row.number),
  ['1', '1.1', '1.2'],
)
assert.deepEqual(rules.getLevel3ParentRollup('p1', [parent, childA, childB]), {
  planStartDate: '2026-01-01',
  planEndDate: '2026-01-10',
  estimatedDays: 9,
  actualStartDate: '2026-01-02',
  actualEndDate: '2026-01-09',
  actualDays: 7,
})
assert.equal(rules.validateLevel3ChildDates(
  { planStartDate: '2026-01-06', planEndDate: '2026-01-11' },
  { id: 'm1', name: 'STR1', planEndDate: '2026-01-10' },
).ok, false)
assert.deepEqual(rules.resolveLevel3Scope({
  projectId: 'project-1', kind: 'market', value: 'TR', mainValue: 'OP', followsMain: true,
}), {
  selectedScopeKey: 'project-1::market::TR',
  scopeKey: 'project-1::market::OP',
  selectedValue: 'TR',
  sourceValue: 'OP',
  readOnly: true,
})

const parent2 = { ...parent, id: 'p2', order: 1, activityName: '父活动2', responsible: '李四' }
const childC = { ...childA, id: 'c3', parentId: 'p2', order: 0, activityName: '子活动C' }
const movedParent = rules.moveLevel3Activity([parent, childA, childB, parent2, childC], 'p2', 'p1')
assert.equal(movedParent.ok, true)
assert.deepEqual(rules.numberLevel3Activities(movedParent.activities).map(row => `${row.number}:${row.id}`), [
  '1:p2', '1.1:c3', '2:p1', '2.1:c1', '2.2:c2',
])
const movedChild = rules.moveLevel3Activity([parent, childA, childB, parent2, childC], 'c2', 'c3')
assert.equal(movedChild.ok, true)
assert.equal(movedChild.activities.find(item => item.id === 'c2').parentId, 'p2')
assert.deepEqual(
  movedChild.activities.filter(item => item.parentId === 'p2').map(item => item.id),
  ['c3', 'c2'],
)

const baseContext = { currentUser: '张三', administratorUsers: [], spmUsers: [] }
assert.equal(rules.getLevel3ActivityPermissions(parent, [parent, childA], { ...baseContext, administratorUsers: ['张三'] }).canEdit, true)
assert.equal(rules.getLevel3ActivityPermissions(parent, [parent, childA], { ...baseContext, spmUsers: ['张三'] }).canAddChild, true)
assert.equal(rules.getLevel3ActivityPermissions(childA, [parent, childA], baseContext).canEdit, true)
assert.equal(rules.getLevel3ActivityPermissions(childA, [parent, childA], { ...baseContext, currentUser: '李四' }).canEdit, true)
assert.equal(rules.getLevel3ActivityPermissions(childA, [parent, childA], { ...baseContext, currentUser: '李四' }).canDrag, false)
assert.equal(rules.getLevel3ActivityPermissions(childA, [parent, childA], { ...baseContext, currentUser: '赵六' }).canEdit, false)

const filtered = rules.filterLevel3ActivitiesWithParents(
  rules.numberLevel3Activities([parent, childA, childB]),
  new Set(['c2']),
)
assert.deepEqual(filtered.map(item => item.id), ['p1', 'c2'])

const storePath = path.join(root, 'src/stores/level3Plan.ts')
assert.ok(fs.existsSync(storePath), 'src/stores/level3Plan.ts does not exist')
const storeSource = fs.readFileSync(storePath, 'utf8')
for (const token of [
  'getScopeData',
  'createActivity',
  'updateActivity',
  'moveActivity',
  'setCollapsedIds',
  'setColumnSettings',
  'activitiesByScope',
  'historyByScope',
]) {
  assert.ok(storeSource.includes(token), `level3 plan store is missing ${token}`)
}

const componentPath = path.join(root, 'src/components/plans/Level3PlanModule.tsx')
assert.ok(fs.existsSync(componentPath), 'src/components/plans/Level3PlanModule.tsx does not exist')
const componentSource = fs.readFileSync(componentPath, 'utf8')
const assertInOrder = (text, tokens) => {
  let cursor = -1
  tokens.forEach(token => {
    const next = text.indexOf(token, cursor + 1)
    assert.ok(next > cursor, `expected ${token} after the previous toolbar token`)
    cursor = next
  })
}
assertInOrder(componentSource, ['筛选', '导出', '字段配置', '全部展开', '全部收起', '历史修改记录'])
for (const label of [
  '活动名称', '责任人', '责任部门', '计划开始时间', '计划完成时间',
  '关键节点', '状态', '任务风险', '备注',
]) {
  assert.ok(componentSource.includes(label), `missing form label ${label}`)
}
for (const token of [
  'DndContext', 'SortableColumnSettings', 'FloatingFilterPanel', 'exportSheet',
  'pms-level3-parent-row', 'pms-level3-row-actions', '历史修改记录',
]) {
  assert.ok(componentSource.includes(token), `level3 plan component is missing ${token}`)
}

console.log(`Level 3 plan rule verification passed (${pathToFileURL(rulesPath).pathname})`)
