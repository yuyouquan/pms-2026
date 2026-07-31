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
  'src/constants/projectListColumnMatrix.ts',
  /export\s+const\s+PROJECT_LIST_REQUIRED_COLUMNS\b/,
  'Project-list views need a dedicated required-column matrix for figures 6 through 9.',
)
requireSourceContract(
  'src/constants/projectListColumnMatrix.ts',
  /图6[\s\S]*图7[\s\S]*图8[\s\S]*图9/,
  'The required-column matrix must cover every figure from 6 through 9.',
)

console.log('project list matrix contract passed')
