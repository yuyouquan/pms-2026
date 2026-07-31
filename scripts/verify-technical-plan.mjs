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
  'src/lib/technicalPlanTemplates.ts',
  /export\s+const\s+TDT_PLAN_TEMPLATE\b/,
  'Technical projects require a dedicated TDT plan template.',
)
requireSourceContract(
  'src/lib/technicalPlanTemplates.ts',
  /subprojectTemplateId\b/,
  'Technical-plan templates must retain the parent-to-subproject template hierarchy.',
)

console.log('technical plan contract passed')
