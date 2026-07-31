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
for (const name of ['aggregateWorkbenchTodos', 'filterWorkbenchTodos', 'summarizeWorkbenchTodos']) assert.equal(typeof todos[name], 'function', `missing ${name}`)
const input = {
  currentUser: '张三',
  planTodos: [
    { id: 'plan-overdue', assignee: '张三', dueDate: '2026-07-30', title: '逾期任务', projectId: 'p1', projectName: '项目 A', planLevel: 'level1', planKey: 'level1', versionId: 'v4' },
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
for (const label of [
  '全部', '计划待办', '转维待办',
  '待办总数', '今日到期', '已逾期', '本周完成',
  '搜索待办', '项目筛选', '状态筛选', '开始日期', '结束日期', '清空筛选',
]) {
  assert.match(todoCenterSource, new RegExp(label), `todo center missing visible or accessible contract: ${label}`)
}
requireSource(root, 'src/containers/WorkbenchContainer.tsx', /<TodoCenter\b/, 'workbench must render the classified TodoCenter')
requireSource(root, 'src/containers/WorkbenchContainer.tsx', /useActivateProject\(\)/, 'todo navigation must reuse shared project activation')
assert.doesNotMatch(todoCenterSource, /checklist\.map|tmChecklistItems\.map/, 'todo center must not split transfer checklists into rows')
console.log('todo center contract passed')
