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

const rules = 'src/lib/machineTosVersionRules.ts'
requireContract(rules, /export\s+function\s+compareThreePartVersions\b/, 'Three-part tOS versions need a pure numeric comparator.')
requireContract(rules, /export\s+function\s+resolveMachineTosUpdate\b/, 'Whole-machine to tOS version linkage must be resolved by one pure function.')
requireContract(rules, /isNewMachine[\s\S]*?initialize/, 'A new whole-machine project must initialize its linked tOS version.')
requireContract(rules, /isLegacyMachine[\s\S]*?inherit/, 'A legacy whole-machine project must inherit its linked tOS version.')
requireContract(rules, /sameName[\s\S]*?compareThreePartVersions[\s\S]*?max/, 'Same-name tOS versions must select the numerically greatest three-part value.')

console.log('machine tOS versions contract passed')
