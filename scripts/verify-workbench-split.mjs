#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8')
const requireSourceContract = (relativePath, pattern, message) => {
  assert.match(read(relativePath), pattern, message)
}

requireSourceContract(
  'src/containers/WorkspaceContainer.tsx',
  /<WorkbenchTodoCenter\b/,
  'WorkspaceContainer must render the standalone workbench todo center instead of mixing todo ownership into the project list.',
)
requireSourceContract(
  'src/components/workspace/WorkspaceModule.tsx',
  /onOpenProjectSource\b/,
  'Project-list rows must expose an explicit source-return action so users can return to the originating project context.',
)

console.log('workbench split contract passed')
