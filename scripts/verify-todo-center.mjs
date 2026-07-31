#!/usr/bin/env node
import assert from 'node:assert/strict'
import {
  loadTypeScriptModule,
  projectRoot,
  readSource,
  requireSource,
} from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const todos = loadTypeScriptModule(root, 'src/lib/todoAggregation.ts')
for (const name of [
  'aggregateWorkbenchTodos',
  'filterWorkbenchTodos',
  'summarizeWorkbenchTodos',
  'mapTransferOwnerToPmsUser',
  'resolvePlanTodoNavigation',
]) assert.equal(typeof todos[name], 'function', `missing ${name}`)
const input = {
  currentUser: '张三',
  today: '2026-07-31',
  planTodos: [
    { id: 'plan-overdue', assignee: '张三', dueDate: '2026-07-30', title: '逾期任务', projectId: 'p1', projectName: '项目 A', planLevel: 'level1', planKey: 'level1', versionId: 'v4', market: 'OP', marketKey: 'project::p1::OP::level1::versions' },
    { id: 'plan-today', assignee: '张三', dueDate: '2026-07-31', title: '今日任务', projectId: 'p2', projectName: '项目 B', planLevel: 'level2', planKey: 'plan2', versionId: 'v1', status: 'in_progress' },
    { id: 'plan-done', assignee: '张三', completedAt: '2026-07-30', title: '已完成任务', projectId: 'p1', projectName: '项目 A', planLevel: 'level1', planKey: 'level1', versionId: 'v4' },
    { id: 'plan-other', assignee: '李四' },
  ],
  transferApplications: [
    { id: 'transfer-mine', projectId: 'p1', projectName: '项目 A', activeOwner: '张三', completed: false, title: '转维录入', view: 'entry', checklist: [{ id: 'checklist' }] },
    { id: 'transfer-done', activeOwner: '张三', completed: true },
    { id: 'transfer-other', activeOwner: '李四', completed: false },
  ],
}
const all = todos.aggregateWorkbenchTodos(input)
assert.deepEqual(all.map(item => item.id), ['plan-overdue', 'plan-today', 'plan-done', 'transfer-mine'], 'aggregate excludes other users, completed transfers, and nested checklists')
assert.deepEqual(todos.filterWorkbenchTodos(all, { source: 'transfer' }).map(item => item.id), ['transfer-mine'], 'filters operate on aggregate output')
assert.deepEqual(todos.filterWorkbenchTodos(all, { source: 'plan' }).map(item => item.id), ['plan-overdue', 'plan-today', 'plan-done'], 'source filter counts plan todos separately')
assert.deepEqual(todos.summarizeWorkbenchTodos(all, '2026-07-31'), { total: 4, dueToday: 1, overdue: 1, completedThisWeek: 1 }, 'summary derives today, overdue, and this-week completion from aggregate output')
assert.equal(all[0].route.marketKey, 'project::p1::OP::level1::versions', 'market plan routes preserve their validated market scope key')

const crossDayCandidates = {
  currentUser: '张三',
  planTodos: [
    { id: 'completed-earlier', assignee: '张三', dueDate: '2026-07-01', completed: true, title: '早期已完成', projectId: 'p1', projectName: '项目 A', planLevel: 'level1', planKey: 'level1', versionId: 'v3' },
    { id: 'pending-later', assignee: '张三', dueDate: '2026-07-31', completed: false, title: '稍后待办', projectId: 'p1', projectName: '项目 A', planLevel: 'level1', planKey: 'level1', versionId: 'v3' },
  ],
  transferApplications: [],
}
assert.deepEqual(
  todos.aggregateWorkbenchTodos({ ...crossDayCandidates, today: '2026-07-30' }).map(item => item.id),
  ['completed-earlier', 'pending-later'],
  'before the due date, stable due-date sorting applies without hidden wall-clock reads',
)
assert.deepEqual(
  todos.aggregateWorkbenchTodos({ ...crossDayCandidates, today: '2026-08-01' }).map(item => item.id),
  ['pending-later', 'completed-earlier'],
  'after the due date, explicit today moves overdue work first',
)
assert.deepEqual(
  todos.aggregateWorkbenchTodos({ ...crossDayCandidates, today: '2026-08-01' }),
  todos.aggregateWorkbenchTodos({ ...crossDayCandidates, today: '2026-08-01' }),
  'identical aggregate inputs and today values are deterministic',
)

assert.deepEqual(
  todos.TRANSFER_TO_PMS_USER_MAP.u001,
  { transferUserName: '张明辉', pmsUserName: '张三' },
  'transfer applicant identity maps explicitly into the PMS mock user set',
)
assert.equal(todos.mapTransferOwnerToPmsUser('u001', '张明辉'), '张三')
assert.equal(todos.mapTransferOwnerToPmsUser('u001', '同 ID 的错误姓名'), undefined, 'a mismatched external ID/name pair is not accepted')
assert.equal(todos.mapTransferOwnerToPmsUser('unmapped-user', '未映射用户'), undefined, 'unmapped transfer identities do not fabricate PMS ownership')

const resolvedMarketNavigation = todos.resolvePlanTodoNavigation({
  projectId: 'p1',
  projectMarkets: ['OP', 'TR'],
  todoMarket: 'OP',
  route: all[0].route,
  baseVersions: [
    { id: 'v1', versionNo: 'V1', status: '已发布' },
    { id: 'v4', versionNo: 'V4', status: '修订中' },
  ],
  marketVersionsByKey: {
    'project::p1::OP::level1::versions': [
      { id: 'v1', versionNo: 'V1', status: '已发布' },
      { id: 'v4', versionNo: 'V4', status: '修订中' },
    ],
    'project::p1::TR::level1::versions': [{ id: 'v1', versionNo: 'V1', status: '已发布' }],
  },
  marketCurrentVersionByKey: { 'project::p1::TR::level1::versions': 'v1' },
  baseCurrentVersion: 'v1',
})
assert.deepEqual(
  resolvedMarketNavigation,
  { usesMarketVersion: true, market: 'OP', marketKey: 'project::p1::OP::level1::versions', versionId: 'v4' },
  'a market todo restores its own market/version even after another market was selected',
)
assert.equal(todos.resolvePlanTodoNavigation({
  projectId: 'p1',
  projectMarkets: ['OP', 'TR'],
  todoMarket: 'TR',
  route: all[0].route,
  baseVersions: [],
  marketVersionsByKey: {},
  marketCurrentVersionByKey: {},
  baseCurrentVersion: 'v1',
}), null, 'mismatched market keys are rejected instead of faking successful navigation')

assert.deepEqual(
  todos.filterWorkbenchTodos(all, {
    source: 'all',
    search: '项目 a',
    projectId: 'p1',
    status: 'all',
    dueDateFrom: '2026-07-30',
    dueDateTo: '2026-08-01',
  }).map(item => item.id),
  ['plan-overdue'],
  'search, project, and inclusive date filters compose on the same dataset',
)
assert.deepEqual(
  todos.filterWorkbenchTodos(all, { status: 'completed' }).map(item => item.id),
  ['plan-done'],
  'status filtering includes completed plan work without treating completed transfers as active todos',
)
assert.deepEqual(
  todos.summarizeWorkbenchTodos([
    ...all,
    { ...all[0], id: 'done-sunday', status: 'completed', completedAt: '2026-07-26', dueDate: '2026-07-01' },
    { ...all[0], id: 'done-monday', status: 'completed', completedAt: '2026-07-27', dueDate: '2026-07-01' },
  ], '2026-07-31'),
  { total: 6, dueToday: 1, overdue: 1, completedThisWeek: 2 },
  'completed items are never overdue and natural-week completion starts on Monday',
)

const todoCenterSource = readSource(root, 'src/components/workspace/TodoCenter.tsx')
const aggregationSource = readSource(root, 'src/lib/todoAggregation.ts')
const workbenchSource = readSource(root, 'src/containers/WorkbenchContainer.tsx')
for (const label of [
  '全部', '计划待办', '转维待办',
  '待办总数', '今日到期', '已逾期', '本周完成',
  '搜索待办', '项目筛选', '状态筛选', '开始日期', '结束日期', '清空筛选',
]) {
  assert.match(todoCenterSource, new RegExp(label), `todo center missing visible or accessible contract: ${label}`)
}
requireSource(root, 'src/containers/WorkbenchContainer.tsx', /<TodoCenter\b/, 'workbench must render the classified TodoCenter')
requireSource(root, 'src/containers/WorkbenchContainer.tsx', /useActivateProject\(\)/, 'todo navigation must reuse shared project activation')
assert.doesNotMatch(aggregationSource, /new Date\(\)/, 'todo aggregation must not read the process wall clock')
assert.match(workbenchSource, /TRANSFER_TO_PMS_USER_MAP|mapTransferOwnerToPmsUser/, 'transfer ownership must use the explicit mock identity bridge')
assert.match(workbenchSource, /application\.applicantId/, 'entry ownership must start from the authoritative transfer applicant identity')
assert.doesNotMatch(workbenchSource, /linkedProject\?\.leader/, 'entry ownership must never fall back to the project leader')
assert.match(workbenchSource, /setMarketCurrentVersionByKey[\s\S]*?setMarketCurrentVersion/, 'market plan navigation must update market-scoped current version state')
assert.doesNotMatch(todoCenterSource, /checklist\.map|tmChecklistItems\.map/, 'todo center must not split transfer checklists into rows')
console.log('todo center contract passed')
