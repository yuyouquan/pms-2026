#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const read = relativePath => {
  const file = path.join(root, relativePath)
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
}
const requireContract = (file, pattern, message) => assert.match(read(file), pattern, message)

const fixture = {
  currentUser: '张三',
  planTasks: [{ id: 'plan-owner', responsiblePersons: ['张三'] }, { id: 'plan-other', responsiblePersons: ['李四'] }],
  transferApplications: [{ id: 'transfer-active', status: '处理中', handler: '张三', checklistItems: [{ id: 'checklist-1', handler: '李四' }] }],
}
const todoSource = 'src/lib/todoAggregation.ts'
requireContract(todoSource, /export\s+function\s+aggregateCurrentUserTodos\b/, 'Todo aggregation must expose one pure current-user selector.')
requireContract(todoSource, /currentUser\b/, 'The selector must receive the current user rather than return every user\'s work.')
requireContract(todoSource, /responsiblePersons\.includes\(currentUser\)/, 'Only plan tasks owned by the current user may enter the todo center.')
requireContract(todoSource, /handler\s*===\s*currentUser/, 'Only active transfer nodes handled by the current user may enter the todo center.')
requireContract(todoSource, /status\s*!==\s*['"]已完成['"]/, 'Completed transfer nodes must be excluded from the active todo center.')
assert.doesNotMatch(read(todoSource), /checklistItems\.map\(/, 'Checklist items must remain nested under their transfer todo and must not be split into rows.')

const output = ts.transpileModule(read(todoSource), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const loaded = { exports: {} }
new Function('module', 'exports', output)(loaded, loaded.exports)
const todos = loaded.exports.aggregateCurrentUserTodos(fixture)
assert.deepEqual(todos.map(todo => todo.id), ['plan-owner', 'transfer-active'], 'Only the current user\'s responsible plan task and active transfer node are returned; checklist items stay nested.')

console.log('todo center contract passed')
