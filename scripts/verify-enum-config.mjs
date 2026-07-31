#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = relativePath => {
  const file = path.join(root, relativePath)
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
}
const requireContract = (file, pattern, message) => assert.match(read(file), pattern, message)

const configSource = 'src/lib/enumConfig.ts'
requireContract(configSource, /tos-2-part|tOS版本（2位）/, 'Enum configuration must include the fixed tOS two-part version category.')
requireContract(configSource, /tos-3-part|tOS版本（3位）/, 'Enum configuration must include the fixed tOS three-part version category.')
const source = read(configSource)
const categoryIds = [...source.matchAll(/id\s*:\s*['"](tos-[^'"]+)['"]/g)].map(([, id]) => id).sort()
assert.deepEqual(categoryIds, ['tos-2-part', 'tos-3-part'], 'Exactly two tOS version enum categories are allowed.')
requireContract(configSource, /snapshotValue\s*:\s*String\(/, 'Business records must persist an immutable string snapshot of the selected enum value.')
requireContract(configSource, /removeEnumOption[\s\S]*?return\s+\{[\s\S]*?options/, 'Removing an enum option may update configuration options but must not rewrite business records.')

console.log('enum config contract passed')
