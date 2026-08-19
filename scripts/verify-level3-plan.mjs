import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const rulesPath = path.join(root, 'src/lib/level3PlanRules.ts')
const tosTypeRulesPath = path.join(root, 'src/lib/tosTypeRules.ts')
const rootRequire = createRequire(path.join(root, 'package.json'))

const loadCommonJsTypeScriptModule = (filePath, moduleOverrides = {}) => {
  const sourceText = fs.readFileSync(filePath, 'utf8')
  const compiled = ts.transpileModule(sourceText, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filePath,
  }).outputText
  const module = { exports: {} }
  const localRequire = (specifier) => moduleOverrides[specifier] || rootRequire(specifier)
  new Function('exports', 'require', 'module', '__filename', '__dirname', compiled)(
    module.exports,
    localRequire,
    module,
    filePath,
    path.dirname(filePath),
  )
  return module.exports
}

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
const tosTypeRules = loadCommonJsTypeScriptModule(tosTypeRulesPath)

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

const parentRollupCases = [
  {
    name: 'no children',
    children: [],
    expected: { status: '待启动', risk: '无' },
  },
  {
    name: 'all pending uses highest child risk',
    children: [
      { ...childA, status: '待启动', risk: '低' },
      { ...childB, status: '待启动', risk: '高' },
    ],
    expected: { status: '待启动', risk: '高' },
  },
  {
    name: 'all completed uses highest child risk',
    children: [
      { ...childA, status: '已完成', risk: '无' },
      { ...childB, status: '已完成', risk: '中' },
    ],
    expected: { status: '已完成', risk: '中' },
  },
  {
    name: 'pending and completed is in progress',
    children: [
      { ...childA, status: '待启动', risk: '无' },
      { ...childB, status: '已完成', risk: '低' },
    ],
    expected: { status: '进行中', risk: '低' },
  },
  {
    name: 'any in progress is in progress',
    children: [
      { ...childA, status: '待启动', risk: '无' },
      { ...childB, status: '进行中', risk: '中' },
    ],
    expected: { status: '进行中', risk: '中' },
  },
  {
    name: 'risk priority is high over medium, low, and none',
    children: [
      { ...childA, status: '待启动', risk: '无' },
      { ...childB, status: '待启动', risk: '低' },
      { ...childA, id: 'c3', status: '待启动', risk: '中' },
      { ...childB, id: 'c4', status: '待启动', risk: '高' },
    ],
    expected: { status: '待启动', risk: '高' },
  },
]
for (const testCase of parentRollupCases) {
  const activities = [parent, ...testCase.children]
  const rollup = rules.getLevel3ParentRollup('p1', activities)
  const rows = rules.applyLevel3Rollups(activities)
  assert.deepEqual(
    {
      status: rollup.status,
      risk: rollup.risk,
    },
    testCase.expected,
    testCase.name,
  )
  assert.deepEqual(
    {
      status: rows.find(row => row.id === 'p1').status,
      risk: rows.find(row => row.id === 'p1').risk,
    },
    testCase.expected,
    `${testCase.name} through applyLevel3Rollups`,
  )
}

const followerSourceActivities = [
  { ...parent, status: '已完成', risk: '高' },
  { ...childA, status: '待启动', risk: '低' },
  { ...childB, status: '进行中', risk: '中' },
]
const followerActualOverrides = {
  c1: {
    activityId: 'c1', actualStartDate: '2026-08-02', actualEndDate: '2026-08-06',
    detachedBy: '李四', detachedAt: '2026-08-17 12:20:00',
  },
}
const followerWorkflowOverrides = {
  c1: {
    activityId: 'c1', status: '已完成', risk: '高',
    detachedBy: '李四', detachedAt: '2026-08-17 12:21:00',
  },
  c2: {
    activityId: 'c2', status: '待启动', risk: '低',
    detachedBy: '李四', detachedAt: '2026-08-17 12:21:00',
  },
}
const followerSourceSnapshot = structuredClone(followerSourceActivities)
const followerActualSnapshot = structuredClone(followerActualOverrides)
const followerWorkflowSnapshot = structuredClone(followerWorkflowOverrides)
const followerEffectiveActivities = rules.mergeLevel3WorkflowOverrides(
  rules.mergeLevel3ActualDateOverrides(followerSourceActivities, followerActualOverrides),
  followerWorkflowOverrides,
)
const followerRows = rules.applyLevel3Rollups(followerEffectiveActivities)
const followerParent = followerRows.find(row => row.id === 'p1')
assert.deepEqual(
  { status: followerParent.status, risk: followerParent.risk },
  { status: '进行中', risk: '高' },
  'rollup follows effective child status and risk rather than source or stored parent values',
)
assert.deepEqual(
  followerRows.filter(row => row.parentId === 'p1').map(row => ({ id: row.id, status: row.status, risk: row.risk })),
  [
    { id: 'c1', status: '已完成', risk: '高' },
    { id: 'c2', status: '待启动', risk: '低' },
  ],
  'rollup does not override child status or risk',
)
assert.deepEqual(followerSourceActivities, followerSourceSnapshot)
assert.deepEqual(followerActualOverrides, followerActualSnapshot)
assert.deepEqual(followerWorkflowOverrides, followerWorkflowSnapshot)

const displayedActivity = { ...childA, actualStartDate: '2026-08-01', actualEndDate: '2026-08-05' }
const displayedActivitySnapshot = structuredClone(displayedActivity)
const override = rules.createLevel3ActualDateOverride(
  displayedActivity,
  undefined,
  { actualStartDate: '2026-08-02' },
  '李四',
  '2026-08-17 12:00:00',
)
assert.deepEqual(override, {
  activityId: 'c1',
  actualStartDate: '2026-08-02',
  actualEndDate: '2026-08-05',
  detachedBy: '李四',
  detachedAt: '2026-08-17 12:00:00',
})
assert.deepEqual(displayedActivity, displayedActivitySnapshot)

const sourceChildA = { ...childA, actualStartDate: '2026-08-03', actualEndDate: '2026-08-08' }
const mergeInput = [sourceChildA, childB]
const mergeInputSnapshot = structuredClone(mergeInput)
const overrides = { c1: override }
const overridesSnapshot = structuredClone(overrides)
const merged = rules.mergeLevel3ActualDateOverrides(
  mergeInput,
  overrides,
)
assert.equal(merged[0].actualStartDate, '2026-08-02')
assert.equal(merged[0].actualEndDate, '2026-08-05')
assert.notEqual(merged[0], sourceChildA)
assert.notEqual(merged[1], childB)
assert.equal(merged[1].actualStartDate, childB.actualStartDate)
assert.deepEqual(mergeInput, mergeInputSnapshot)
assert.deepEqual(overrides, overridesSnapshot)

const displayedWorkflowActivity = { ...childA, status: '进行中', risk: '中' }
const displayedWorkflowActivitySnapshot = structuredClone(displayedWorkflowActivity)
const workflowOverride = rules.createLevel3WorkflowOverride(
  displayedWorkflowActivity,
  undefined,
  { status: '已完成', risk: undefined },
  '李四',
  '2026-08-17 12:04:00',
)
assert.deepEqual(workflowOverride, {
  activityId: 'c1', status: '已完成', detachedBy: '李四', detachedAt: '2026-08-17 12:04:00',
})
assert.deepEqual(displayedWorkflowActivity, displayedWorkflowActivitySnapshot)
const workflowOverrideSnapshot = structuredClone(workflowOverride)
const secondWorkflowOverride = rules.createLevel3WorkflowOverride(
  { ...childA, status: '待启动', risk: '高' },
  workflowOverride,
  { risk: '低' },
  '王五',
  '2026-08-17 12:05:00',
)
assert.deepEqual(secondWorkflowOverride, {
  activityId: 'c1', status: '已完成', risk: '低', detachedBy: '王五', detachedAt: '2026-08-17 12:05:00',
})
assert.deepEqual(workflowOverride, workflowOverrideSnapshot)
assert.deepEqual(
  rules.mergeLevel3WorkflowOverrides([{ ...childA, status: '待启动', risk: '高' }], { c1: workflowOverride }),
  [{ ...childA, status: '已完成', risk: '高' }],
  'a status-only override must continue following later source risk changes',
)
const workflowMergeInput = [{ ...childA, status: '待启动', risk: '高' }, childB]
const workflowMergeInputSnapshot = structuredClone(workflowMergeInput)
const workflowOverrides = { c1: secondWorkflowOverride }
const workflowOverridesSnapshot = structuredClone(workflowOverrides)
const workflowMerged = rules.mergeLevel3WorkflowOverrides(workflowMergeInput, workflowOverrides)
assert.deepEqual(workflowMerged[0], { ...childA, status: '已完成', risk: '低' })
assert.deepEqual(workflowMerged[1], childB)
assert.notEqual(workflowMerged[0], workflowMergeInput[0])
assert.notEqual(workflowMerged[1], childB)
assert.deepEqual(workflowMergeInput, workflowMergeInputSnapshot)
assert.deepEqual(workflowOverrides, workflowOverridesSnapshot)

const overrideSnapshot = structuredClone(override)
const secondDisplayedActivity = { ...sourceChildA, actualEndDate: '2026-08-20' }
const secondDisplayedActivitySnapshot = structuredClone(secondDisplayedActivity)
const secondEdit = rules.createLevel3ActualDateOverride(
  secondDisplayedActivity,
  override,
  { actualStartDate: '2026-08-04' },
  '王五',
  '2026-08-17 12:02:00',
)
assert.deepEqual(secondEdit, {
  activityId: 'c1',
  actualStartDate: '2026-08-04',
  actualEndDate: '2026-08-05',
  detachedBy: '王五',
  detachedAt: '2026-08-17 12:02:00',
})
assert.deepEqual(override, overrideSnapshot)
assert.deepEqual(secondDisplayedActivity, secondDisplayedActivitySnapshot)

const rollupRows = rules.applyLevel3Rollups(rules.mergeLevel3ActualDateOverrides(
  [parent, sourceChildA, { ...childB, actualStartDate: '2026-08-06', actualEndDate: '2026-08-15' }],
  { c1: secondEdit },
))
assert.deepEqual(rollupRows.find(row => row.id === 'p1'), {
  ...parent,
  number: '1',
  depth: 0,
  planStartDate: '2026-01-01',
  planEndDate: '2026-01-10',
  estimatedDays: 9,
  actualStartDate: '2026-08-04',
  actualEndDate: '2026-08-15',
  actualDays: 11,
  status: '待启动',
  risk: '无',
})

const clearedDisplayedActivity = { ...childA, actualStartDate: '2026-08-01', actualEndDate: '2026-08-05' }
const clearedDisplayedActivitySnapshot = structuredClone(clearedDisplayedActivity)
const cleared = rules.createLevel3ActualDateOverride(
  clearedDisplayedActivity,
  undefined,
  { actualEndDate: '' },
  '李四',
  '2026-08-17 12:01:00',
)
assert.equal(cleared.actualStartDate, '2026-08-01')
assert.equal(cleared.actualEndDate, '')
assert.deepEqual(clearedDisplayedActivity, clearedDisplayedActivitySnapshot)

const undefinedPatchDisplayedActivity = { ...childA, actualStartDate: '2026-08-01', actualEndDate: '2026-08-05' }
const undefinedPatchDisplayedActivitySnapshot = structuredClone(undefinedPatchDisplayedActivity)
const undefinedPatch = rules.createLevel3ActualDateOverride(
  undefinedPatchDisplayedActivity,
  undefined,
  { actualStartDate: undefined, actualEndDate: undefined },
  '李四',
  '2026-08-17 12:03:00',
)
assert.deepEqual(undefinedPatch, {
  activityId: 'c1',
  actualStartDate: '2026-08-01',
  actualEndDate: '2026-08-05',
  detachedBy: '李四',
  detachedAt: '2026-08-17 12:03:00',
})
assert.deepEqual(undefinedPatchDisplayedActivity, undefinedPatchDisplayedActivitySnapshot)

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
  status: '待启动',
  risk: '无',
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
assert.deepEqual(rules.resolveLevel3DetachedScopeFork(
  { projectId: 'project-1', kind: 'market', value: 'TR', mainValue: 'OP', followsMain: true },
  { projectId: 'project-1', kind: 'market', value: 'TR', mainValue: 'OP', followsMain: false },
), {
  sourceScopeKey: 'project-1::market::OP',
  targetScopeKey: 'project-1::market::TR',
})
assert.equal(rules.resolveLevel3DetachedScopeFork(
  { projectId: 'project-1', kind: 'market', value: 'TR', mainValue: 'OP', followsMain: false },
  { projectId: 'project-1', kind: 'market', value: 'TR', mainValue: 'OP', followsMain: false },
), null)
assert.deepEqual(rules.resolveLevel3DetachedScopeFork(
  { projectId: 'project-1', kind: 'tosType', value: 'GO', mainValue: 'Full', followsMain: true },
  { projectId: 'project-1', kind: 'tosType', value: 'GO', mainValue: 'GO', followsMain: false },
), {
  sourceScopeKey: 'project-1::tosType::Full',
  targetScopeKey: 'project-1::tosType::GO',
}, 'a promoted tOS type must fork from its previous main scope')

const tosTypeRowsBeforeDetach = [
  { id: 'full', type: 'Full', isMain: true, followsMain: false },
  { id: 'go', type: 'GO', isMain: false, followsMain: true },
  { id: 'pad', type: 'PAD', isMain: false, followsMain: true },
  { id: 'slim', type: 'Slim', isMain: false, followsMain: false },
]
assert.deepEqual(
  tosTypeRules.deriveDetachedTosTypes(tosTypeRowsBeforeDetach, [
    { id: 'full', type: 'Full', isMain: true, followsMain: false },
    { id: 'go', type: 'GO', isMain: false, followsMain: false },
    { id: 'pad', type: 'PAD', isMain: false, followsMain: true },
    { id: 'slim', type: 'Slim', isMain: false, followsMain: false },
  ]),
  ['GO'],
  'direct tOS unfollow should materialize only the detached type',
)
assert.deepEqual(
  tosTypeRules.deriveDetachedTosTypes(tosTypeRowsBeforeDetach, [
    { id: 'full', type: 'Full', isMain: false, followsMain: false },
    { id: 'go', type: 'GO', isMain: true, followsMain: false },
    { id: 'pad', type: 'PAD', isMain: false, followsMain: false },
    { id: 'slim', type: 'Slim', isMain: false, followsMain: false },
  ]),
  ['GO', 'PAD'],
  'promoted and remaining former followers should both materialize from the previous main',
)
assert.deepEqual(
  tosTypeRules.deriveDetachedTosTypes(tosTypeRowsBeforeDetach, tosTypeRowsBeforeDetach),
  [],
  'unchanged tOS followers should not materialize',
)
const removedFollowerTransitions = tosTypeRules.planDetachedTosTypeTransitions(
  tosTypeRowsBeforeDetach,
  tosTypeRowsBeforeDetach.filter(row => row.type !== 'GO'),
)
assert.deepEqual(removedFollowerTransitions.map(item => ({
  type: item.type,
  nextRow: item.nextRow,
})), [{
  type: 'GO',
  nextRow: { id: 'tos-type-detached-GO', type: 'GO', isMain: false, followsMain: false },
}], 'removed followers must retain a synthetic independent target state')

const sourceHistory = [{
  id: 'source-log', action: 'edit', actor: '张三', occurredAt: '2026-08-17 10:00:00',
  activityId: 'c1', activityName: '子活动A', activityNumber: '1.1', summary: '编辑活动', changes: [],
}, {
  id: 'tie-b', action: 'edit', actor: '张三', occurredAt: '2026-08-17 11:00:00',
  activityId: 'c1', activityName: '子活动A', activityNumber: '1.1', summary: '同一时刻的源历史', changes: [],
}]
const targetHistory = [{
  ...sourceHistory[0], id: 'target-log', occurredAt: '2026-08-18 10:00:00', summary: '历史独立编辑',
}, {
  ...sourceHistory[0], id: 'tie-a', occurredAt: '2026-08-17 11:00:00', summary: '同一时刻的跟随历史',
}, {
  ...sourceHistory[0],
}]
const sourceHistoryInputSnapshot = structuredClone(sourceHistory)
const targetHistoryInputSnapshot = structuredClone(targetHistory)
const forkedScope = rules.forkLevel3ScopeData({
  activities: [parent, childA], history: sourceHistory, collapsedIds: ['p1'],
  columnSettings: { order: ['number', 'activityName'], visible: ['number', 'activityName'] },
}, {
  activities: [], history: targetHistory, collapsedIds: [],
  columnSettings: { order: ['activityName', 'number'], visible: ['number'] },
}, {
  c1: {
    activityId: 'c1', actualStartDate: '2026-08-04', actualEndDate: '2026-08-06',
    detachedBy: '李四', detachedAt: '2026-08-17 12:10:00',
  },
}, {
  c1: secondWorkflowOverride,
})
assert.deepEqual(forkedScope.activities.map(item => item.id), ['p1', 'c1'])
assert.deepEqual(forkedScope.activities.find(item => item.id === 'c1'), {
  ...childA,
  actualStartDate: '2026-08-04',
  actualEndDate: '2026-08-06',
  status: '已完成',
  risk: '低',
})
assert.deepEqual(forkedScope.history.map(item => item.id), ['target-log', 'tie-a', 'tie-b', 'source-log'])
assert.equal(new Set(forkedScope.history.map(item => item.id)).size, forkedScope.history.length)
assert.deepEqual(sourceHistory, sourceHistoryInputSnapshot)
assert.deepEqual(targetHistory, targetHistoryInputSnapshot)
assert.deepEqual(forkedScope.columnSettings, { order: ['activityName', 'number'], visible: ['number'] })
assert.notEqual(forkedScope.activities[0], parent)
assert.deepEqual(childA.actualStartDate, '2026-01-04')
assert.deepEqual(childA.actualEndDate, '2026-01-07')

assert.deepEqual(
  rules.mergeLevel3Histories(sourceHistory, targetHistory).map(log => log.id),
  ['target-log', 'tie-a', 'tie-b', 'source-log'],
  '跟随范围历史应合并来源和当前范围，并沿用脱离跟随时的稳定排序规则',
)

const parent2 = { ...parent, id: 'p2', order: 1, activityName: '父活动2', responsible: '李四' }
const childC = { ...childA, id: 'c3', parentId: 'p2', order: 0, activityName: '子活动C' }
const parent3 = { ...parent, id: 'p3', order: 2, activityName: '父活动3', responsible: '王五' }
const childD = { ...childA, id: 'c4', parentId: 'p2', order: 1, activityName: '子活动D' }
const dragActivities = [parent, childA, childB, parent2, childC, childD, parent3]
const dragContext = { currentUser: '张三', administratorUsers: [], spmUsers: [] }

assert.deepEqual(
  rules.getLevel3MovePermission('c1', 'p2', dragActivities, dragContext, true),
  { allowed: false, reason: '跟随范围不支持拖动' },
  'read-only scope must deny structural dragging',
)
assert.equal(
  rules.getLevel3MovePermission('c1', 'p3', dragActivities, { ...dragContext, administratorUsers: ['张三'] }, false).allowed,
  true,
  'administrator can move any child across parents',
)
assert.equal(
  rules.getLevel3MovePermission('c1', 'p3', dragActivities, { ...dragContext, spmUsers: ['张三'] }, false).allowed,
  true,
  'SPM can move any child across parents',
)
assert.deepEqual(
  rules.getLevel3MovePermission('c1', 'c1', dragActivities, { ...dragContext, currentUser: '赵六' }, false),
  { allowed: false, reason: '拖动位置未变化' },
  'self-drop is denied regardless of the user permission',
)
assert.equal(
  rules.getLevel3MovePermission('c1', 'c2', dragActivities, { ...dragContext, currentUser: '李四' }, false).allowed,
  false,
  'child owner alone cannot structurally drag',
)
const sameOwnerTarget = { ...parent2, responsible: '张三' }
assert.equal(
  rules.getLevel3MovePermission('c1', 'p2', [parent, childA, childB, sameOwnerTarget, childC], dragContext, false).allowed,
  true,
  'parent owner may move children between parents they also own',
)
assert.equal(
  rules.getLevel3MovePermission('c1', 'p2', dragActivities, dragContext, false).allowed,
  false,
  'parent owner cannot move a child into another owner\'s parent',
)
const malformedTargetActivities = [parent, childA, { ...childB, parentId: 'c1' }]
assert.equal(
  rules.getLevel3MovePermission('c1', 'c2', malformedTargetActivities, { ...dragContext, administratorUsers: ['张三'] }, false).allowed,
  false,
  'a child target whose parent is another child is never authorized',
)
const rejectedMalformedMove = rules.moveLevel3Activity(malformedTargetActivities, 'c1', 'c2')
assert.equal(rejectedMalformedMove.ok, false)
assert.equal(rejectedMalformedMove.activities.find(item => item.id === 'c1').parentId, 'p1')
assert.equal(rejectedMalformedMove.activities.some(item => item.id === 'c1' && item.parentId === item.id), false)
const malformedSourceActivities = [parent, { ...childA, parentId: 'c2' }, childB]
assert.equal(
  rules.getLevel3MovePermission('c1', 'p1', malformedSourceActivities, { ...dragContext, administratorUsers: ['张三'] }, false).allowed,
  false,
  'a third-level source child is never authorized for structural dragging',
)
assert.equal(rules.moveLevel3Activity(malformedSourceActivities, 'c1', 'p1').ok, false)

const appendedToParent = rules.moveLevel3Activity(dragActivities, 'c1', 'p2')
assert.equal(appendedToParent.ok, true)
assert.equal(appendedToParent.changed, true)
assert.deepEqual(
  appendedToParent.activities.filter(item => item.parentId === 'p2').map(item => item.id),
  ['c3', 'c4', 'c1'],
  'dropping a child on a parent appends it to that parent',
)
const insertedAtChild = rules.moveLevel3Activity(dragActivities, 'c1', 'c4')
assert.equal(insertedAtChild.ok, true)
assert.deepEqual(
  insertedAtChild.activities.filter(item => item.parentId === 'p2').map(item => item.id),
  ['c3', 'c1', 'c4'],
  'dropping a child on another child inserts at the target position',
)
const rootReorder = rules.moveLevel3Activity(dragActivities, 'p2', 'p1')
assert.equal(rootReorder.ok, true)
assert.deepEqual(rootReorder.activities.map(item => item.id), ['p2', 'c3', 'c4', 'p1', 'c1', 'c2', 'p3'])
assert.equal(rootReorder.changed, true, 'root reordering carries its children in flattened output')
const noOpMove = rules.moveLevel3Activity(dragActivities, 'c1', 'c1')
assert.equal(noOpMove.ok, true)
assert.equal(noOpMove.changed, false, 'dropping an activity over itself is a no-op')
const unchangedChildInsert = rules.moveLevel3Activity([parent, childA, childB], 'c1', 'c2')
assert.equal(unchangedChildInsert.ok, true)
assert.equal(unchangedChildInsert.changed, false, 'inserting a child before its current next sibling is a no-op')
assert.deepEqual(
  { fromParentId: unchangedChildInsert.fromParentId, toParentId: unchangedChildInsert.toParentId, fromIndex: unchangedChildInsert.fromIndex, toIndex: unchangedChildInsert.toIndex },
  { fromParentId: 'p1', toParentId: 'p1', fromIndex: 0, toIndex: 0 },
  'unchanged child insertion retains source and target metadata',
)
const unchangedParentAppend = rules.moveLevel3Activity([parent, childA, childB], 'c2', 'p1')
assert.equal(unchangedParentAppend.ok, true)
assert.equal(unchangedParentAppend.changed, false, 'appending the current last child to its parent is a no-op')
assert.deepEqual(
  { fromParentId: unchangedParentAppend.fromParentId, toParentId: unchangedParentAppend.toParentId, fromIndex: unchangedParentAppend.fromIndex, toIndex: unchangedParentAppend.toIndex },
  { fromParentId: 'p1', toParentId: 'p1', fromIndex: 1, toIndex: 1 },
  'unchanged parent append retains source and target metadata',
)
const unchangedRootReorder = rules.moveLevel3Activity([parent, childA, parent2, childC], 'p1', 'p2')
assert.equal(unchangedRootReorder.ok, true)
assert.equal(unchangedRootReorder.changed, false, 'reordering a root immediately before its target is a no-op')
assert.deepEqual(
  { fromParentId: unchangedRootReorder.fromParentId, toParentId: unchangedRootReorder.toParentId, fromIndex: unchangedRootReorder.fromIndex, toIndex: unchangedRootReorder.toIndex },
  { fromParentId: null, toParentId: null, fromIndex: 0, toIndex: 0 },
  'unchanged root reordering retains source and target metadata',
)

const parentHistory = [
  { id: 'moved-away', action: 'move', actor: '张三', occurredAt: '2026-08-19 10:03:00', activityId: 'c1', activityName: '子活动A', activityNumber: '1.1', summary: '移出父活动', changes: [], sourceParentActivityId: 'p1', sourceParentActivityName: '父活动' },
  { id: 'deleted-child', action: 'delete', actor: '张三', occurredAt: '2026-08-19 10:02:00', activityId: 'deleted', activityName: '已删除子活动', activityNumber: '1.3', summary: '删除活动', changes: [], parentActivityId: 'p1', parentActivityName: '父活动' },
  { id: 'current-child', action: 'edit', actor: '张三', occurredAt: '2026-08-19 10:01:00', activityId: 'c2', activityName: '子活动B', activityNumber: '1.2', summary: '编辑活动', changes: [] },
  { id: 'other', action: 'edit', actor: '李四', occurredAt: '2026-08-19 10:00:00', activityId: 'c3', activityName: '子活动C', activityNumber: '2.1', summary: '其他活动', changes: [] },
]
assert.deepEqual(
  rules.filterLevel3HistoryForActivity(parentHistory, parent, [parent, childB, parent2, childC]).map(log => log.id),
  ['moved-away', 'deleted-child', 'current-child'],
  'parent history includes current children and child snapshots after moves or deletion',
)
assert.deepEqual(
  rules.filterLevel3HistoryForActivity(parentHistory, childB, dragActivities).map(log => log.id),
  ['current-child'],
  'child history is always exact to the child id',
)
const movedToParent2 = { ...childA, parentId: 'p2' }
assert.deepEqual(
  rules.filterLevel3HistoryForActivity(parentHistory, parent2, [parent, parent2, movedToParent2]).map(log => log.id),
  [],
  'operation-time parent snapshots prevent old child history appearing under its current parent',
)
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
  ['c2', 'c3'],
)
const deletedChild = rules.deleteLevel3ActivityTree([parent, childA, childB, parent2, childC], 'c1')
assert.equal(deletedChild.ok, true)
assert.deepEqual(deletedChild.deletedActivities.map(item => item.id), ['c1'])
assert.deepEqual(deletedChild.activities.map(item => item.id), ['p1', 'c2', 'p2', 'c3'])
const deletedParent = rules.deleteLevel3ActivityTree([parent, childA, childB, parent2, childC], 'p1')
assert.equal(deletedParent.ok, true)
assert.deepEqual(deletedParent.deletedActivities.map(item => item.id), ['p1', 'c1', 'c2'])
assert.deepEqual(deletedParent.activities.map(item => item.id), ['p2', 'c3'])

const baseContext = { currentUser: '张三', administratorUsers: [], spmUsers: [] }
assert.equal(rules.getLevel3ActivityPermissions(parent, [parent, childA], { ...baseContext, administratorUsers: ['张三'] }).canEdit, true)
assert.equal(rules.getLevel3ActivityPermissions(parent, [parent, childA], { ...baseContext, spmUsers: ['张三'] }).canAddChild, true)
assert.equal(rules.getLevel3ActivityPermissions(parent, [parent, childA], baseContext).canDelete, true)
assert.equal(rules.getLevel3ActivityPermissions(childA, [parent, childA], baseContext).canEdit, true)
assert.equal(rules.getLevel3ActivityPermissions(childA, [parent, childA], { ...baseContext, currentUser: '李四' }).canEdit, true)
assert.equal(rules.getLevel3ActivityPermissions(childA, [parent, childA], { ...baseContext, currentUser: '李四' }).canDrag, false)
assert.equal(rules.getLevel3ActivityPermissions(childA, [parent, childA], { ...baseContext, currentUser: '赵六' }).canEdit, false)
assert.equal(rules.getLevel3NumberIndent(0), 0)
assert.equal(rules.getLevel3NumberIndent(1), 32)
assert.equal(rules.canInlineEditLevel3ActualDate(childA, [parent, childA], baseContext, false), true)
assert.equal(rules.canInlineEditLevel3ChildField(childA, [parent, childA], baseContext), true)
assert.equal(rules.canInlineEditLevel3ChildField(parent, [parent, childA], baseContext), false)
assert.equal(rules.canInlineEditLevel3ChildField(childA, [parent, childA], { ...baseContext, currentUser: '赵六' }), false)
assert.equal(rules.canInlineEditLevel3ActualDate(parent, [parent, childA], baseContext, false), false)
assert.equal(rules.canInlineEditLevel3ActualDate(childA, [parent, childA], { ...baseContext, currentUser: '赵六' }, false), false)
assert.equal(rules.canInlineEditLevel3ActualDate(childA, [parent, childA], baseContext, true), false)
assert.equal(rules.shouldShowLevel3CreateButton(false), true)
assert.equal(rules.shouldShowLevel3CreateButton(true), false)

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
  'forkFollowScope',
  'deleteActivity',
  'activitiesByScope',
  'historyByScope',
  'actualOverridesByScope',
  'workflowOverridesByScope',
  'updateFollowActualDates',
  'updateFollowWorkflowFields',
  'mergeLevel3ActualDateOverrides',
  'mergeLevel3WorkflowOverrides',
  'LEVEL3_PLAN_STORE_VERSION = 3',
]) {
  assert.ok(storeSource.includes(token), `level3 plan store is missing ${token}`)
}

const storeModule = loadCommonJsTypeScriptModule(storePath, {
  '@/lib/level3PlanRules': loadCommonJsTypeScriptModule(rulesPath),
  '@/types/level3Plan': loadCommonJsTypeScriptModule(path.join(root, 'src/types/level3Plan.ts')),
})
const store = storeModule.useLevel3PlanStore
const mockActivities = storeModule.buildLevel3MockActivities([
  { id: 'str1', name: 'STR1', planEndDate: '2026-02-26' },
  { id: 'str4', name: 'STR4', planEndDate: '2026-12-15' },
])
assert.equal(mockActivities.filter(activity => activity.parentId === null).length, 4)
assert.equal(mockActivities.filter(activity => activity.parentId !== null).length, 23)
assert.deepEqual(
  rules.numberLevel3Activities(mockActivities).map(activity => `${activity.number}:${activity.activityName}`),
  [
    '1:IR计划输出', '1.1:原始IR输出', '1.2:需求串讲', '1.3:IR锁定', '1.4:PD/UX/概设/测试方案锁定',
    '1.5:SR分解', '1.6:需求反串讲', '1.7:IR排期', '1.8:IR开发', '1.9:IR验收',
    '2:tOS子系统概要设计', '2.1:概要设计启动', '2.2:SDRB评审', '2.3:子系统概要设计终审',
    '3:测试计划', '3.1:测试范围 & 需求拆解', '3.2:测试用例设计评审', '3.3:测试策略&计划评审',
    '3.4:版本测试-STR4', '3.5:版本测试-STR4A', '3.6:STR5版本归档',
    '4:Beta NPS调研计划', '4.1:调研问卷设计', '4.2:Beta版本发布', '4.3:用户反馈收集',
    '4.4:NPS数据统计', '4.5:调研报告输出',
  ],
)
const storeSourceScope = 'project-1::market::OP'
const storeFollowerScope = 'project-1::market::TR'
const storeOtherScope = 'project-1::market::RU'
const sourceActivitiesSnapshot = structuredClone([parent, childA])
const sourceHistorySnapshot = structuredClone(sourceHistory)
store.setState({
  activitiesByScope: { [storeSourceScope]: [parent, childA] },
  historyByScope: { [storeSourceScope]: sourceHistory, [storeFollowerScope]: targetHistory },
  collapsedIdsByScope: {},
  columnSettingsByScope: {},
  actualOverridesByScope: { [storeOtherScope]: { c2: override } },
  workflowOverridesByScope: { [storeOtherScope]: { c2: workflowOverride } },
})
assert.equal(
  store.getState().updateFollowWorkflowFields(
    storeSourceScope,
    storeFollowerScope,
    'c1',
    { status: '已完成' },
    '李四',
  ),
  true,
)
let workflowPersisted = store.getState()
assert.deepEqual(workflowPersisted.workflowOverridesByScope[storeFollowerScope].c1, {
  activityId: 'c1', status: '已完成', detachedBy: '李四',
  detachedAt: workflowPersisted.workflowOverridesByScope[storeFollowerScope].c1.detachedAt,
})
assert.deepEqual(workflowPersisted.historyByScope[storeFollowerScope][0].changes, [{
  field: 'status', label: '状态', before: '待启动', after: '已完成',
}])
store.setState(state => ({
  activitiesByScope: {
    ...state.activitiesByScope,
    [storeSourceScope]: state.activitiesByScope[storeSourceScope].map(activity => (
      activity.id === 'c1' ? { ...activity, risk: '中' } : { ...activity }
    )),
  },
}))
assert.equal(
  store.getState().updateFollowWorkflowFields(
    storeSourceScope,
    storeFollowerScope,
    'c1',
    { risk: '高' },
    '王五',
  ),
  true,
)
workflowPersisted = store.getState()
assert.deepEqual(workflowPersisted.workflowOverridesByScope[storeFollowerScope].c1, {
  activityId: 'c1', status: '已完成', risk: '高', detachedBy: '王五',
  detachedAt: workflowPersisted.workflowOverridesByScope[storeFollowerScope].c1.detachedAt,
})
assert.deepEqual(workflowPersisted.historyByScope[storeFollowerScope][0].changes, [{
  field: 'risk', label: '任务风险', before: '中', after: '高',
}])
const workflowHistoryLength = workflowPersisted.historyByScope[storeFollowerScope].length
for (const { sourceScopeKey, selectedScopeKey, activityId, patch, actor } of [
  { sourceScopeKey: storeSourceScope, selectedScopeKey: storeFollowerScope, activityId: 'p1', patch: { status: '进行中' }, actor: '李四' },
  { sourceScopeKey: storeSourceScope, selectedScopeKey: storeFollowerScope, activityId: 'missing', patch: { status: '进行中' }, actor: '李四' },
  { sourceScopeKey: storeSourceScope, selectedScopeKey: storeFollowerScope, activityId: 'c1', patch: { status: '无效状态' }, actor: '李四' },
  { sourceScopeKey: storeSourceScope, selectedScopeKey: storeFollowerScope, activityId: 'c1', patch: { risk: '无效风险' }, actor: '李四' },
  { sourceScopeKey: storeSourceScope, selectedScopeKey: storeFollowerScope, activityId: 'c1', patch: { status: '已完成' }, actor: '李四' },
  { sourceScopeKey: storeSourceScope, selectedScopeKey: storeFollowerScope, activityId: 'c1', patch: { status: undefined, risk: undefined }, actor: '李四' },
  { sourceScopeKey: storeSourceScope, selectedScopeKey: storeFollowerScope, activityId: 'c1', patch: { status: '进行中' }, actor: '' },
  { sourceScopeKey: '', selectedScopeKey: storeFollowerScope, activityId: 'c1', patch: { status: '进行中' }, actor: '李四' },
  { sourceScopeKey: storeSourceScope, selectedScopeKey: '', activityId: 'c1', patch: { status: '进行中' }, actor: '李四' },
  { sourceScopeKey: storeSourceScope, selectedScopeKey: storeSourceScope, activityId: 'c1', patch: { status: '进行中' }, actor: '李四' },
]) {
  assert.equal(
    store.getState().updateFollowWorkflowFields(
      sourceScopeKey,
      selectedScopeKey,
      activityId,
      patch,
      actor,
    ),
    false,
  )
}
assert.equal(store.getState().historyByScope[storeFollowerScope].length, workflowHistoryLength)
assert.equal(
  store.getState().updateFollowActualDates(
    storeSourceScope,
    storeFollowerScope,
    'c1',
    { actualStartDate: '2026-01-05' },
    '李四',
  ),
  true,
)
let persisted = store.getState()
assert.deepEqual(persisted.activitiesByScope[storeSourceScope].find(item => item.id === 'c1'), { ...childA, risk: '中' })
assert.deepEqual(persisted.actualOverridesByScope[storeFollowerScope].c1, {
  activityId: 'c1', actualStartDate: '2026-01-05', actualEndDate: '2026-01-07',
  detachedBy: '李四', detachedAt: persisted.actualOverridesByScope[storeFollowerScope].c1.detachedAt,
})
assert.equal(persisted.historyByScope[storeFollowerScope][0].actor, '李四')
assert.deepEqual(persisted.historyByScope[storeFollowerScope][0].changes, [{
  field: 'actualStartDate', label: '实际开始时间', before: '2026-01-04', after: '2026-01-05',
}])
assert.equal(
  store.getState().updateFollowActualDates(
    storeSourceScope,
    storeFollowerScope,
    'c1',
    { actualEndDate: '2026-01-08' },
    '王五',
  ),
  true,
)
persisted = store.getState()
assert.equal(persisted.actualOverridesByScope[storeFollowerScope].c1.actualStartDate, '2026-01-05')
assert.equal(persisted.actualOverridesByScope[storeFollowerScope].c1.actualEndDate, '2026-01-08')
const followerHistoryIds = persisted.historyByScope[storeFollowerScope].map(log => log.id)
assert.equal(new Set(followerHistoryIds).size, followerHistoryIds.length)
const historyLengthBeforeRejectedUpdate = persisted.historyByScope[storeFollowerScope].length
assert.equal(
  store.getState().updateFollowActualDates(
    storeSourceScope,
    storeFollowerScope,
    'c1',
    { actualStartDate: '2026-01-09' },
    '李四',
  ),
  false,
)
for (const malformedDate of ['2026-2-03', '2026-02-30', '2026-13-01']) {
  assert.equal(
    store.getState().updateFollowActualDates(
      storeSourceScope,
      storeFollowerScope,
      'c1',
      { actualStartDate: malformedDate },
      '李四',
    ),
    false,
  )
}
assert.equal(
  store.getState().updateFollowActualDates(
    storeSourceScope,
    storeFollowerScope,
    'c1',
    { actualEndDate: '2026-2-03' },
    '李四',
  ),
  false,
)
assert.equal(
  store.getState().updateFollowActualDates(
    storeSourceScope,
    storeFollowerScope,
    'missing',
    { actualStartDate: '2026-01-05' },
    '李四',
  ),
  false,
)
assert.equal(
  store.getState().updateFollowActualDates(
    storeSourceScope,
    storeFollowerScope,
    'c1',
    { actualEndDate: '2026-01-08' },
    '李四',
  ),
  false,
)
assert.equal(store.getState().historyByScope[storeFollowerScope].length, historyLengthBeforeRejectedUpdate)
assert.equal(store.getState().forkFollowScope(storeSourceScope, storeFollowerScope), true)
persisted = store.getState()
assert.deepEqual(persisted.activitiesByScope[storeFollowerScope].find(item => item.id === 'c1'), {
  ...childA,
  actualStartDate: '2026-01-05', actualEndDate: '2026-01-08',
  status: '已完成', risk: '高',
})
assert.equal(persisted.actualOverridesByScope[storeFollowerScope], undefined)
assert.equal(persisted.workflowOverridesByScope[storeFollowerScope], undefined)
assert.deepEqual(persisted.actualOverridesByScope[storeOtherScope], { c2: override })
assert.deepEqual(persisted.workflowOverridesByScope[storeOtherScope], { c2: workflowOverride })
assert.deepEqual(persisted.activitiesByScope[storeSourceScope], [parent, { ...childA, risk: '中' }])
assert.deepEqual(persisted.historyByScope[storeSourceScope], sourceHistorySnapshot)
assert.deepEqual(store.persist.getOptions().partialize(persisted).actualOverridesByScope, {
  [storeOtherScope]: { c2: override },
})
assert.deepEqual(store.persist.getOptions().partialize(persisted).workflowOverridesByScope, {
  [storeOtherScope]: { c2: workflowOverride },
})
const failedForkState = structuredClone({
  activitiesByScope: store.getState().activitiesByScope,
  historyByScope: store.getState().historyByScope,
  actualOverridesByScope: store.getState().actualOverridesByScope,
})
assert.equal(store.getState().forkFollowScope('', storeFollowerScope), false)
assert.deepEqual(store.getState().activitiesByScope, failedForkState.activitiesByScope)
assert.deepEqual(store.getState().historyByScope, failedForkState.historyByScope)
assert.deepEqual(store.getState().actualOverridesByScope, failedForkState.actualOverridesByScope)
const targetOnlyScope = 'project-1::tosType::GO'
const targetOnlyActivities = [parent, childA]
store.setState({
  activitiesByScope: { [targetOnlyScope]: targetOnlyActivities },
  historyByScope: { [targetOnlyScope]: targetHistory },
  collapsedIdsByScope: { [targetOnlyScope]: ['p1'] },
  columnSettingsByScope: { [targetOnlyScope]: { order: ['activityName', 'number'], visible: ['number'] } },
  actualOverridesByScope: { [targetOnlyScope]: { c1: secondEdit } },
  workflowOverridesByScope: { [targetOnlyScope]: { c1: secondWorkflowOverride } },
})
assert.equal(store.getState().forkFollowScope('project-1::tosType::Full', targetOnlyScope), true)
persisted = store.getState()
assert.deepEqual(persisted.activitiesByScope[targetOnlyScope].find(item => item.id === 'c1'), {
  ...childA,
  actualStartDate: secondEdit.actualStartDate,
  actualEndDate: secondEdit.actualEndDate,
  status: '已完成', risk: '低',
})
assert.deepEqual(persisted.historyByScope[targetOnlyScope].map(log => log.id), ['target-log', 'tie-a', 'source-log'])
assert.deepEqual(persisted.columnSettingsByScope[targetOnlyScope], {
  order: ['activityName', 'number'], visible: ['number'],
})
assert.equal(persisted.actualOverridesByScope[targetOnlyScope], undefined)
assert.equal(persisted.workflowOverridesByScope[targetOnlyScope], undefined)
const explicitlyEmptySourceScope = 'project-1::tosType::Full'
const populatedFallbackTargetScope = 'project-1::tosType::Slim'
store.setState({
  activitiesByScope: {
    [explicitlyEmptySourceScope]: [],
    [populatedFallbackTargetScope]: [parent, childA],
  },
  historyByScope: {
    [explicitlyEmptySourceScope]: [],
    [populatedFallbackTargetScope]: targetHistory,
  },
  collapsedIdsByScope: {
    [explicitlyEmptySourceScope]: [],
    [populatedFallbackTargetScope]: ['p1'],
  },
  columnSettingsByScope: {
    [explicitlyEmptySourceScope]: { order: [], visible: [] },
    [populatedFallbackTargetScope]: { order: ['activityName', 'number'], visible: ['number'] },
  },
  actualOverridesByScope: { [populatedFallbackTargetScope]: { c1: secondEdit } },
  workflowOverridesByScope: { [populatedFallbackTargetScope]: { c1: secondWorkflowOverride } },
})
assert.equal(store.getState().forkFollowScope(explicitlyEmptySourceScope, populatedFallbackTargetScope), true)
persisted = store.getState()
assert.deepEqual(persisted.activitiesByScope[populatedFallbackTargetScope].find(item => item.id === 'c1'), {
  ...childA,
  actualStartDate: secondEdit.actualStartDate,
  actualEndDate: secondEdit.actualEndDate,
  status: '已完成', risk: '低',
}, 'an explicitly empty source must fall back to populated target data')
assert.deepEqual(persisted.columnSettingsByScope[populatedFallbackTargetScope], {
  order: ['activityName', 'number'], visible: ['number'],
})
assert.equal(persisted.actualOverridesByScope[populatedFallbackTargetScope], undefined)
assert.equal(persisted.workflowOverridesByScope[populatedFallbackTargetScope], undefined)
const orphanOverride = { c1: secondEdit }
store.setState({
  activitiesByScope: {}, historyByScope: {}, collapsedIdsByScope: {}, columnSettingsByScope: {},
  actualOverridesByScope: { [targetOnlyScope]: orphanOverride },
  workflowOverridesByScope: { [targetOnlyScope]: { missing: secondWorkflowOverride } },
})
assert.equal(store.getState().forkFollowScope('project-1::tosType::Full', targetOnlyScope), true)
assert.deepEqual(store.getState().actualOverridesByScope[targetOnlyScope], orphanOverride)
assert.deepEqual(store.getState().workflowOverridesByScope[targetOnlyScope], { missing: secondWorkflowOverride })
const sourceWithOrphanOverrideScope = 'project-1::tosType::PAD'
const targetWithOrphanOverrideScope = 'project-1::tosType::GO'
const orphanActivityOverride = { missing: secondEdit }
store.setState({
  activitiesByScope: { [sourceWithOrphanOverrideScope]: [parent] },
  historyByScope: {}, collapsedIdsByScope: {}, columnSettingsByScope: {},
  actualOverridesByScope: { [targetWithOrphanOverrideScope]: orphanActivityOverride },
  workflowOverridesByScope: { [targetWithOrphanOverrideScope]: { missing: secondWorkflowOverride } },
})
assert.equal(store.getState().forkFollowScope(sourceWithOrphanOverrideScope, targetWithOrphanOverrideScope), true)
assert.deepEqual(
  store.getState().actualOverridesByScope[targetWithOrphanOverrideScope],
  orphanActivityOverride,
  'unmaterializable target overrides must survive a source fork',
)
assert.deepEqual(
  store.getState().workflowOverridesByScope[targetWithOrphanOverrideScope],
  { missing: secondWorkflowOverride },
  'unmaterializable target workflow overrides must survive a source fork',
)
const migrate = store.persist.getOptions().migrate
const migrated = await migrate({
  activitiesByScope: { legacy: [parent] },
  historyByScope: { legacy: sourceHistory },
  collapsedIdsByScope: { legacy: ['p1'] },
  columnSettingsByScope: { legacy: { order: ['number'], visible: ['number'] } },
}, 1)
assert.deepEqual(migrated, {
  activitiesByScope: { legacy: [parent] },
  historyByScope: { legacy: sourceHistory },
  collapsedIdsByScope: { legacy: ['p1'] },
  columnSettingsByScope: { legacy: { order: ['number'], visible: ['number'] } },
  actualOverridesByScope: {},
  workflowOverridesByScope: {},
})
const migratedV1WithActualOverrides = await migrate({
  activitiesByScope: { legacy: [parent] },
  historyByScope: { legacy: sourceHistory },
  collapsedIdsByScope: { legacy: ['p1'] },
  columnSettingsByScope: { legacy: { order: ['number'], visible: ['number'] } },
  actualOverridesByScope: { legacy: { c1: override } },
}, 1)
assert.deepEqual(migratedV1WithActualOverrides.actualOverridesByScope, { legacy: { c1: override } })
const migratedV2 = await migrate({
  activitiesByScope: { legacy: [parent] },
  historyByScope: { legacy: sourceHistory },
  collapsedIdsByScope: { legacy: ['p1'] },
  columnSettingsByScope: { legacy: { order: ['number'], visible: ['number'] } },
  actualOverridesByScope: { legacy: { c1: override } },
}, 2)
assert.deepEqual(migratedV2.actualOverridesByScope, { legacy: { c1: override } })
assert.deepEqual(migratedV2.workflowOverridesByScope, {})
const migratedV3 = await migrate({
  activitiesByScope: { legacy: [parent] },
  historyByScope: { legacy: sourceHistory },
  collapsedIdsByScope: { legacy: ['p1'] },
  columnSettingsByScope: { legacy: { order: ['number'], visible: ['number'] } },
  actualOverridesByScope: { legacy: { c1: override } },
  workflowOverridesByScope: { legacy: { c1: secondWorkflowOverride } },
}, 3)
assert.deepEqual(migratedV3.actualOverridesByScope, { legacy: { c1: override } })
assert.deepEqual(migratedV3.workflowOverridesByScope, { legacy: { c1: secondWorkflowOverride } })

const roundTripOverrides = {
  persisted: {
    c1: {
      activityId: 'c1', actualStartDate: '2026-01-05', actualEndDate: '2026-01-08',
      detachedBy: '王五', detachedAt: '2026-08-18 10:00:00',
    },
  },
}
const roundTripWorkflowOverrides = {
  persisted: {
    c1: {
      activityId: 'c1', status: '已完成', risk: '高',
      detachedBy: '王五', detachedAt: '2026-08-18 10:00:00',
    },
  },
}
const malformedOverrideScopes = {
  actualOverridesByScope: {
    malformed: {
      c1: { activityId: 'wrong', actualStartDate: '2026-01-01', actualEndDate: '2026-01-02', detachedBy: '李四', detachedAt: '2026-08-18 10:00:00' },
      c2: { activityId: 'c2', actualStartDate: 'bad-date', actualEndDate: '', detachedBy: '李四', detachedAt: '2026-08-18 10:00:00' },
    },
  },
  workflowOverridesByScope: {
    malformed: {
      c1: { activityId: 'c1', status: '坏状态', risk: '坏风险', detachedBy: '李四', detachedAt: '2026-08-18 10:00:00' },
      wrongKey: { activityId: 'c2', status: '已完成', detachedBy: '李四', detachedAt: '2026-08-18 10:00:00' },
    },
  },
}
const memoryStorageData = new Map()
const memoryStorage = {
  getItem: key => memoryStorageData.get(key) || null,
  setItem: (key, value) => memoryStorageData.set(key, value),
  removeItem: key => memoryStorageData.delete(key),
}
const hadWindow = Object.prototype.hasOwnProperty.call(globalThis, 'window')
const originalWindow = globalThis.window
globalThis.window = { localStorage: memoryStorage }
try {
  const hydratedStoreModule = loadCommonJsTypeScriptModule(storePath, {
    '@/lib/level3PlanRules': loadCommonJsTypeScriptModule(rulesPath),
    '@/types/level3Plan': loadCommonJsTypeScriptModule(path.join(root, 'src/types/level3Plan.ts')),
  })
  const roundTripState = {
    activitiesByScope: { [storeSourceScope]: [parent, childA] },
    historyByScope: { [storeSourceScope]: sourceHistory },
    collapsedIdsByScope: { [storeSourceScope]: ['p1'] },
    columnSettingsByScope: { [storeSourceScope]: { order: ['number'], visible: ['number'] } },
    actualOverridesByScope: { ...roundTripOverrides, ...malformedOverrideScopes.actualOverridesByScope },
    workflowOverridesByScope: { ...roundTripWorkflowOverrides, ...malformedOverrideScopes.workflowOverridesByScope },
  }
  memoryStorage.setItem(hydratedStoreModule.LEVEL3_PLAN_STORAGE_KEY, JSON.stringify({
    state: roundTripState,
    version: hydratedStoreModule.LEVEL3_PLAN_STORE_VERSION,
  }))
  await hydratedStoreModule.useLevel3PlanStore.persist.rehydrate()
  assert.deepEqual(hydratedStoreModule.useLevel3PlanStore.getState().actualOverridesByScope, roundTripOverrides)
  assert.deepEqual(hydratedStoreModule.useLevel3PlanStore.getState().workflowOverridesByScope, roundTripWorkflowOverrides)
  assert.equal(hydratedStoreModule.useLevel3PlanStore.getState().forkFollowScope(storeSourceScope, 'malformed'), true)
  assert.deepEqual(
    hydratedStoreModule.useLevel3PlanStore.getState().activitiesByScope.malformed.find(item => item.id === 'c1'),
    childA,
    'invalid follower workflow values must not materialize into detached activities',
  )
  const originalDateNow = Date.now
  Date.now = () => 1_786_752_000_000
  try {
    hydratedStoreModule.useLevel3PlanStore.getState().updateFollowWorkflowFields(storeSourceScope, 'rapid', 'c1', { status: '已完成' }, '李四')
    hydratedStoreModule.useLevel3PlanStore.getState().updateFollowWorkflowFields(storeSourceScope, 'rapid', 'c1', { risk: '高' }, '李四')
  } finally {
    Date.now = originalDateNow
  }
  const rapidHistory = hydratedStoreModule.useLevel3PlanStore.getState().historyByScope.rapid
  assert.equal(rapidHistory[0].changes[0].field, 'risk')
  assert.equal(rapidHistory[1].changes[0].field, 'status')
  assert.ok(rapidHistory[0].occurredAt > rapidHistory[1].occurredAt)
  hydratedStoreModule.useLevel3PlanStore.getState().setCollapsedIds(storeSourceScope, ['p1', 'c1'])
  const storedRoundTrip = JSON.parse(memoryStorage.getItem(hydratedStoreModule.LEVEL3_PLAN_STORAGE_KEY))
  assert.equal(storedRoundTrip.version, 3)
  assert.deepEqual(storedRoundTrip.state.actualOverridesByScope, roundTripOverrides)
  assert.deepEqual(storedRoundTrip.state.workflowOverridesByScope.persisted, roundTripWorkflowOverrides.persisted)
  const reloadedStoreModule = loadCommonJsTypeScriptModule(storePath, {
    '@/lib/level3PlanRules': loadCommonJsTypeScriptModule(rulesPath),
    '@/types/level3Plan': loadCommonJsTypeScriptModule(path.join(root, 'src/types/level3Plan.ts')),
  })
  await reloadedStoreModule.useLevel3PlanStore.persist.rehydrate()
  assert.deepEqual(reloadedStoreModule.useLevel3PlanStore.getState().actualOverridesByScope, roundTripOverrides)
  assert.deepEqual(reloadedStoreModule.useLevel3PlanStore.getState().workflowOverridesByScope.persisted, roundTripWorkflowOverrides.persisted)
  assert.deepEqual(reloadedStoreModule.useLevel3PlanStore.getState().historyByScope.rapid.map(log => log.changes[0].field), ['risk', 'status'])
  const reloadedDateNow = Date.now
  Date.now = () => 1_786_752_000_000
  try {
    assert.equal(reloadedStoreModule.useLevel3PlanStore.getState().updateFollowWorkflowFields(
      storeSourceScope, 'rapid', 'c1', { status: '进行中' }, '赵六',
    ), true)
  } finally {
    Date.now = reloadedDateNow
  }
  const rebasedRapidHistory = reloadedStoreModule.useLevel3PlanStore.getState().historyByScope.rapid
  assert.deepEqual(rebasedRapidHistory.map(log => log.changes[0].field), ['status', 'risk', 'status'])
  assert.ok(rebasedRapidHistory[0].occurredAt > rebasedRapidHistory[1].occurredAt)
  assert.deepEqual(rules.mergeLevel3Histories([], rebasedRapidHistory).map(log => log.changes[0].field), ['status', 'risk', 'status'])
  const clockRebasedReloadModule = loadCommonJsTypeScriptModule(storePath, {
    '@/lib/level3PlanRules': loadCommonJsTypeScriptModule(rulesPath),
    '@/types/level3Plan': loadCommonJsTypeScriptModule(path.join(root, 'src/types/level3Plan.ts')),
  })
  await clockRebasedReloadModule.useLevel3PlanStore.persist.rehydrate()
  assert.deepEqual(clockRebasedReloadModule.useLevel3PlanStore.getState().historyByScope.rapid.map(log => log.changes[0].field), ['status', 'risk', 'status'])
} finally {
  if (hadWindow) globalThis.window = originalWindow
  else delete globalThis.window
}

const componentPath = path.join(root, 'src/components/plans/Level3PlanModule.tsx')
assert.ok(fs.existsSync(componentPath), 'src/components/plans/Level3PlanModule.tsx does not exist')
const componentSource = fs.readFileSync(componentPath, 'utf8')
const level3PlanTypeSource = fs.readFileSync(path.join(root, 'src/types/level3Plan.ts'), 'utf8')
const riskColumnIndex = level3PlanTypeSource.indexOf("  'risk',")
const remarkColumnIndex = level3PlanTypeSource.indexOf("  'remark',")
const creatorColumnIndex = level3PlanTypeSource.indexOf("  'creator',")
assert.ok(riskColumnIndex >= 0 && riskColumnIndex < remarkColumnIndex && remarkColumnIndex < creatorColumnIndex, '三级计划备注列必须位于任务风险和创建者之间')
assert.ok(!componentSource.includes('<Alert'), '跟随范围不应显示提示条')
assert.ok(componentSource.includes('shouldShowLevel3CreateButton(readOnly)'), '新增活动按钮未按跟随状态隐藏')
assert.ok(componentSource.includes('selectedScopeKey: string'), '三级计划组件必须接收当前选中范围键')
assert.ok(componentSource.includes('const EMPTY_OVERRIDES: Level3ActualDateOverrideMap = {}'), '三级计划组件必须使用稳定的空实际日期覆盖对象')
assert.ok(componentSource.includes('mergeLevel3ActualDateOverrides(sourceActivities, actualOverrides)'), '展示活动必须先合并跟随范围实际日期覆盖')
assert.ok(componentSource.includes('mergeLevel3WorkflowOverrides('), '展示活动必须在实际日期覆盖后合并状态和风险覆盖')
assert.ok(componentSource.includes('handleInlineWorkflowChange'), '状态和风险必须支持内联保存')
assert.ok(componentSource.includes('updateFollowWorkflowFields(scopeKey, selectedScopeKey, row.id, { [field]: value }, currentUser)'), '跟随范围状态和风险编辑必须写入当前范围覆盖')
assert.ok(componentSource.includes('canInlineEditLevel3ChildField(row, effectiveActivities, permissionContext)'), '状态和风险内联编辑必须受子活动权限控制')
assert.ok(componentSource.includes('onDoubleClick={event => event.stopPropagation()}><Select size="small"'), '状态和风险内联选择器必须阻止双击打开编辑弹窗')
const activityModalStart = componentSource.indexOf('      <Modal')
const activityModalEnd = componentSource.indexOf('      <Drawer', activityModalStart)
assert.ok(activityModalStart >= 0 && activityModalEnd > activityModalStart, '三级活动编辑弹窗边界缺失')
const activityModalSource = componentSource.slice(activityModalStart, activityModalEnd)
for (const label of ['实际开始时间', '实际完成时间', '状态', '任务风险']) {
  assert.ok(!activityModalSource.includes(`label="${label}"`), `活动弹窗不应包含${label}`)
}
const editPatchStart = componentSource.indexOf('      const patch: Partial<Level3Activity> = {')
const editPatchEnd = componentSource.indexOf('      if (activity.parentId)', editPatchStart)
const editPatchSource = componentSource.slice(editPatchStart, editPatchEnd)
for (const field of ['actualStartDate', 'actualEndDate', 'status', 'risk']) {
  assert.ok(!editPatchSource.includes(`${field}:`), `活动编辑补丁不应包含${field}`)
}
const createActivityStart = componentSource.indexOf('    const nextActivity: Level3Activity = {')
const createActivityEnd = componentSource.indexOf('    if (createActivity(', createActivityStart)
const createActivitySource = componentSource.slice(createActivityStart, createActivityEnd)
for (const token of ["actualStartDate: ''", "actualEndDate: ''", "status: '待启动'", "risk: '无'"]) {
  assert.ok(createActivitySource.includes(token), `新增活动必须默认${token}`)
}
assert.ok(componentSource.includes('const rows = useMemo(() => applyLevel3Rollups(effectiveActivities)'), '汇总必须基于合并后的展示活动')
assert.ok(componentSource.includes('updateFollowActualDates(scopeKey, selectedScopeKey, row.id, { [field]: value }, currentUser)'), '跟随范围的内联实际日期编辑必须写入当前范围覆盖')
assert.ok(componentSource.includes('if (readOnly) {'), '内联实际日期变更必须显式区分跟随范围')
assert.ok(componentSource.includes('mergeLevel3Histories(sourceHistory, selectedScopeHistory)'), '跟随范围历史抽屉必须合并来源和当前范围历史')
assert.ok(componentSource.includes('canInlineEditLevel3ActualDate(row, effectiveActivities, permissionContext, false)'), '跟随范围授权子活动实际日期应保持可编辑')
assert.ok(componentSource.includes('!readOnly && (permissions.canEdit || permissions.canAddChild)'), '跟随范围仍须隐藏结构性行操作')
assert.ok(componentSource.includes('!readOnly && getLevel3ActivityPermissions(row, effectiveActivities, permissionContext).canDrag'), '跟随范围仍须禁用拖动排序')
assert.ok(componentSource.includes("{ key: 'remark', title: '备注'"), '三级计划列定义必须包含备注')
assert.ok(componentSource.includes("{ key: 'remark', label: '备注', kind: 'text'"), '三级计划筛选字段必须包含备注')
assert.ok(componentSource.includes("definition.key === 'remark'"), '三级计划必须单独渲染备注单元格')
assert.equal(typeof rules.normalizeLevel3Remark, 'function', '备注规范化必须由规则模块提供纯函数')
assert.equal(typeof rules.getLevel3RemarkDisplay, 'function', '备注展示判断必须由规则模块提供纯函数')
assert.equal(rules.normalizeLevel3Remark('  正常备注  '), '正常备注')
assert.equal(rules.normalizeLevel3Remark('   '), '')
assert.equal(rules.normalizeLevel3Remark(null), '')
assert.deepEqual(rules.getLevel3RemarkDisplay('  正常备注  '), { value: '正常备注', empty: false })
assert.deepEqual(rules.getLevel3RemarkDisplay('   '), { value: '', empty: true })
const filterFieldsStart = componentSource.indexOf('const FILTER_FIELDS: FilterFieldDefinition[] = [')
const filterFieldsEnd = componentSource.indexOf('const FILTER_FIELD_OPTIONS =', filterFieldsStart)
assert.ok(filterFieldsStart >= 0 && filterFieldsEnd > filterFieldsStart, '筛选字段定义边界缺失')
assert.ok(componentSource.slice(filterFieldsStart, filterFieldsEnd).includes("{ key: 'remark', label: '备注', kind: 'text'"), '备注必须参与筛选字段定义')
const remarkRenderStart = componentSource.indexOf("if (definition.key === 'remark')")
const remarkRenderEnd = componentSource.indexOf('    return { ...base, render:', remarkRenderStart)
assert.ok(remarkRenderStart >= 0 && remarkRenderEnd > remarkRenderStart, '备注渲染分支边界缺失')
const remarkRenderSource = componentSource.slice(remarkRenderStart, remarkRenderEnd)
for (const token of ['getLevel3RemarkDisplay(value)', 'Tooltip title={remark}', 'aria-label={remark}', 'title={remark}', 'tabIndex={0}', 'empty ?']) {
  assert.ok(remarkRenderSource.includes(token), `备注渲染分支缺少${token}`)
}
assert.ok(componentSource.includes('remark: normalizeLevel3Remark(rawValues.remark)'), '新增和编辑保存必须先去除备注首尾空格')
assert.ok(componentSource.includes("remark: values.remark || ''"), '编辑补丁必须保存去除空格后的备注')
assert.ok(componentSource.includes('const exportColumns: ExportColumn[] = definitions.map'), '导出必须沿用可见列定义')
const exportHandlerStart = componentSource.indexOf('  const handleExport = (mode: \'current\' | \'all\') => {')
const exportHandlerEnd = componentSource.indexOf('  const handleDragEnd =', exportHandlerStart)
assert.ok(exportHandlerStart >= 0 && exportHandlerEnd > exportHandlerStart, '导出处理函数边界缺失')
const exportHandlerSource = componentSource.slice(exportHandlerStart, exportHandlerEnd)
assert.ok(exportHandlerSource.includes("const exportRows = mode === 'current' ? filteredRows : rows"), '导出必须按当前筛选或全部行取数')
assert.ok(exportHandlerSource.includes("const definitions = mode === 'current' ? visibleDefinitions : LEVEL3_COLUMN_DEFINITIONS"), '当前导出必须使用可见列、全部导出必须使用完整列')
assert.ok(componentSource.includes("className=\"pms-modal pms-level3-activity-modal\""), '三级计划活动弹窗必须使用专属样式类')
assert.ok(componentSource.includes('autoSize={{ minRows: 1, maxRows: 4 }}'), '备注输入框必须使用紧凑自动高度')
const stylesSource = fs.readFileSync(path.join(root, 'src/styles/globals.css'), 'utf8')
for (const token of [
  '.pms-table.pms-level3-table .ant-table-tbody > tr > td.ant-table-cell-fix-left',
  'background: #fff !important;',
  'z-index: 3;',
  '.pms-table.pms-level3-table .pms-level3-parent-row > td.ant-table-cell-fix-left',
]) {
  assert.ok(stylesSource.includes(token), `三级计划固定列防重合样式缺少 ${token}`)
}
assert.ok(stylesSource.includes('.pms-level3-activity-modal .ant-form-item { margin-bottom: 12px; }'), '三级计划弹窗表单项间距必须为12px')
assert.ok(stylesSource.includes('.pms-level3-activity-modal .pms-level3-form-grid { gap: 12px; }'), '三级计划弹窗双列间距必须为12px')
assert.ok(stylesSource.includes('.pms-level3-form-grid { grid-template-columns: 1fr; gap: 0; }'), '三级计划弹窗必须保留响应式单列规则')
assert.ok(stylesSource.includes('.pms-level3-activity-modal .pms-level3-form-grid { gap: 0; }'), '三级计划弹窗移动端必须保留单列间距约束')
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
  'ClickToEditDate', 'handleInlineActualDateChange', 'pms-level3-number-cell',
  'Popconfirm', '删除活动', 'pms-level3-parent-row', 'pms-level3-row-actions', '历史修改记录',
]) {
  assert.ok(componentSource.includes(token), `level3 plan component is missing ${token}`)
}

const containerPath = path.join(root, 'src/containers/ProjectSpaceContainer.tsx')
const containerSource = fs.readFileSync(containerPath, 'utf8')
for (const token of [
  "import Level3PlanModule from '@/components/plans/Level3PlanModule'",
  "{ key: 'level3', label: '三级计划' }",
  '<Level3PlanModule',
  'latestPublishedLevel1Milestones',
  'level3ScopeResolution',
  'resolveLevel3DetachedScopeFork',
  'forkFollowScope',
  'selectedScopeKey={level3ScopeResolution.selectedScopeKey}',
]) {
  assert.ok(containerSource.includes(token), `project-space Level 3 integration is missing ${token}`)
}
const saveTosTypeConfigStart = containerSource.indexOf('  const saveTosTypeConfig = () => {')
const saveMarketConfigStart = containerSource.indexOf('  const getCurrentMarketRows = () => (')
assert.ok(saveTosTypeConfigStart >= 0, 'tOS type save handler is missing')
assert.ok(saveMarketConfigStart > saveTosTypeConfigStart, 'tOS type save handler boundary is missing')
const saveTosTypeConfigSource = containerSource.slice(saveTosTypeConfigStart, saveMarketConfigStart)
for (const token of [
  'const previousTosTypeRows = getCurrentTosTypeRows()',
  'const previousMainTosType = getMainTosType(previousTosTypeRows)',
  'const detachedTosTypes = deriveDetachedTosTypes(previousTosTypeRows, normalizedRows)',
  "kind: 'tosType'",
  'resolveLevel3DetachedScopeFork',
  'forkFollowScope(fork.sourceScopeKey, fork.targetScopeKey)',
]) {
  assert.ok(saveTosTypeConfigSource.includes(token), `tOS type detach integration is missing ${token}`)
}
assert.ok(
  saveTosTypeConfigSource.includes('deriveDetachedTosTypes(previousTosTypeRows, normalizedRows)'),
  'tOS type save must derive detached types from previous and next follow sets',
)
assert.ok(
  saveTosTypeConfigSource.includes('planDetachedTosTypeTransitions('),
  'tOS type save must plan removed follower target states before persistence',
)
assert.ok(
  saveTosTypeConfigSource.includes('detachedScopeForks')
    && saveTosTypeConfigSource.includes('detachedScopeForks.length !== detachedTosTypeTransitions.length'),
  'tOS type save must preflight every detached source/target pair before updating the project',
)
assert.ok(
  saveTosTypeConfigSource.includes('normalizeTosTypeRows(tosTypeDraftRows, previousMainTosType)'),
  'tOS type save must normalize candidate rows against the previous main type',
)
assert.ok(
  saveTosTypeConfigSource.indexOf('if (!updateProject(') < saveTosTypeConfigSource.indexOf('detachedScopeForks.forEach'),
  'tOS type Level 3 forks must run only after the project update succeeds',
)
assert.ok(
  saveTosTypeConfigSource.indexOf('if (!updateProject(') < saveTosTypeConfigSource.indexOf('setTosTypeConfigForProject('),
  'tOS type auxiliary stores must not mutate before the project update succeeds',
)
assert.ok(
  saveTosTypeConfigSource.includes('detachedScopeForks.forEach(fork => forkFollowScope('),
  'tOS type save must apply only preflighted Level 3 forks after project persistence',
)
assert.ok(
  !saveTosTypeConfigSource.includes('updateProject(selectedProject.id, selectedProject, currentLoginUser)'),
  'tOS type save must not roll back through a second audited project update',
)
assert.ok(!containerSource.includes("{ key: 'level2', label: '二级计划' }"), 'project-space still exposes the Level 2 plan tab')
assert.ok(!containerSource.includes("{ key: 'overview', label: '计划总览' }"), 'project-space still exposes the overview plan tab')
assert.ok(
  containerSource.includes('key={`${level3ScopeResolution.scopeKey}:${level3ScopeResolution.selectedScopeKey}:${level3ScopeResolution.readOnly}`}'),
  '切换三级计划来源、当前范围或跟随状态时必须重新挂载，避免跨范围保留弹窗草稿',
)

console.log(`Level 3 plan rule verification passed (${pathToFileURL(rulesPath).pathname})`)
