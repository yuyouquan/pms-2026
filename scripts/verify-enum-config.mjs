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
  'src/constants/projectEnums.ts',
  /export\s+const\s+PROJECT_ENUM_CONFIGS\s*=\s*\[[\s\S]*?项目类型[\s\S]*?项目状态/,
  'Enum configuration must define exactly the fixed project-type and project-status categories.',
)
requireSourceContract(
  'src/constants/projectEnums.ts',
  /stringSnapshots\s*:\s*true/,
  'Fixed enum values must preserve string snapshot semantics for historical project display.',
)

console.log('enum config contract passed')
