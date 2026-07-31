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
  'src/lib/machineTosVersions.ts',
  /export\s+function\s+syncMachineTosVersions\b/,
  'Whole-machine projects need a dedicated version-linkage function for tOS versions.',
)
requireSourceContract(
  'src/lib/machineTosVersions.ts',
  /machineVersions[\s\S]*tosVersions|tosVersions[\s\S]*machineVersions/,
  'The version-linkage function must reconcile whole-machine and tOS version collections.',
)

console.log('machine tOS versions contract passed')
