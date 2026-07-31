#!/usr/bin/env node
import assert from 'node:assert/strict'
import { loadTypeScriptModule, projectRoot } from './lib/source-contract.mjs'

const todos = loadTypeScriptModule(projectRoot(import.meta.url), 'src/lib/todoAggregation.ts')
for (const name of ['aggregateWorkbenchTodos', 'filterWorkbenchTodos', 'summarizeWorkbenchTodos']) assert.equal(typeof todos[name], 'function', `missing ${name}`)
const input = {
  currentUser: '张三',
  planTodos: [{ id: 'plan-mine', assignee: '张三' }, { id: 'plan-other', assignee: '李四' }],
  transferApplications: [
    { id: 'transfer-mine', activeOwner: '张三', completed: false, checklist: [{ id: 'checklist' }] },
    { id: 'transfer-done', activeOwner: '张三', completed: true },
    { id: 'transfer-other', activeOwner: '李四', completed: false },
  ],
}
const all = todos.aggregateWorkbenchTodos(input)
assert.deepEqual(all.map(item => item.id), ['plan-mine', 'transfer-mine'], 'aggregate excludes other users, completed transfers, and nested checklists')
assert.deepEqual(todos.filterWorkbenchTodos(all, { source: 'transfer' }).map(item => item.id), ['transfer-mine'], 'filters operate on aggregate output')
assert.deepEqual(todos.summarizeWorkbenchTodos(all), { total: 2, plan: 1, transfer: 1 }, 'summary is derived from the same aggregate output')
console.log('todo center contract passed')
