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
  'src/constants/projectTypes.ts',
  /PROJECT_TYPE_TECHNICAL\s*=\s*['"]技术项目['"]/,
  'Technical projects must be a first-class project type.',
)
requireSourceContract(
  'src/lib/technicalProject.ts',
  /export\s+function\s+softDisableTechnicalSubproject\b/,
  'Technical subprojects must support soft disablement instead of destructive removal.',
)

console.log('technical project contract passed')
