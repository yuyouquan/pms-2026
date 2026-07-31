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
  'src/lib/projectRoleSync.ts',
  /export\s+function\s+syncTechnicalProjectRolesToTos\b/,
  'Technical-project roles must synchronize one way into their tOS project.',
)
requireSourceContract(
  'src/lib/projectRoleSync.ts',
  /lastWriteWins\b/,
  'Role synchronization must explicitly preserve the tOS last-write-wins rule.',
)

console.log('project role sync contract passed')
