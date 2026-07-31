#!/usr/bin/env node
import assert from 'node:assert/strict'
import { loadTypeScriptModule, projectRoot } from './lib/source-contract.mjs'

const todos = loadTypeScriptModule(projectRoot(import.meta.url), 'src/lib/todoAggregation.ts')
for (const name of ['aggregateWorkbenchTodos', 'filterWorkbenchTodos', 'summarizeWorkbenchTodos']) assert.equal(typeof todos[name], 'function', `missing ${name}`)
const input = {
  currentUser: '张三',
  planTodos: [{ id: 'plan-overdue', assignee: '张三', dueDate: '2026-07-30' }, { id: 'plan-today', assignee: '张三', dueDate: '2026-07-31' }, { id: 'plan-done', assignee: '张三', completedAt: '2026-07-30' }, { id: 'plan-other', assignee: '李四' }],
  transferApplications: [
    { id: 'transfer-mine', activeOwner: '张三', completed: false, checklist: [{ id: 'checklist' }] },
    { id: 'transfer-done', activeOwner: '张三', completed: true },
    { id: 'transfer-other', activeOwner: '李四', completed: false },
  ],
}
const all = todos.aggregateWorkbenchTodos(input)
assert.deepEqual(all.map(item => item.id), ['plan-overdue', 'plan-today', 'plan-done', 'transfer-mine'], 'aggregate excludes other users, completed transfers, and nested checklists')
assert.deepEqual(todos.filterWorkbenchTodos(all, { source: 'transfer' }).map(item => item.id), ['transfer-mine'], 'filters operate on aggregate output')
assert.deepEqual(todos.filterWorkbenchTodos(all, { source: 'plan' }).map(item => item.id), ['plan-overdue', 'plan-today', 'plan-done'], 'source filter counts plan todos separately')
assert.deepEqual(todos.summarizeWorkbenchTodos(all, '2026-07-31'), { total: 4, dueToday: 1, overdue: 1, completedThisWeek: 1 }, 'summary derives today, overdue, and this-week completion from aggregate output')
console.log('todo center contract passed')
