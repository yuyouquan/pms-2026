#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = relativePath => {
  const absolutePath = path.join(root, relativePath)
  return fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, 'utf8') : ''
}
const requireSourceContract = (relativePath, pattern, message) => {
  assert.match(read(relativePath), pattern, message)
}

requireSourceContract(
  'src/lib/workbenchTodos.ts',
  /export\s+function\s+getCurrentUserWorkbenchTodos\b/,
  'A single todo selector must aggregate the current user\'s plan and transfer-maintenance items.',
)
requireSourceContract(
  'src/lib/workbenchTodos.ts',
  /planTasks[\s\S]*transferApplications|transferApplications[\s\S]*planTasks/,
  'Todo aggregation must consume both plan tasks and transfer-maintenance applications.',
)

console.log('todo center contract passed')
