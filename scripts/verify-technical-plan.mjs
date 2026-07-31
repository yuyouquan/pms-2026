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

const rules = 'src/lib/technicalPlanRules.ts'
requireContract(rules, /export\s+const\s+TDT_TEMPLATE_SEED\b/, 'Technical planning must provide the TDT template seed.')
requireContract(rules, /export\s+const\s+SUBPROJECT_TEMPLATE_SEED\b/, 'Technical planning must provide the subproject template seed.')
requireContract(rules, /export\s+function\s+validateTechnicalPlanDepth\b/, 'Technical planning must validate template depth before persistence.')
requireContract(rules, /TDT_TEMPLATE_SEED[\s\S]*?maxDepth\s*:\s*2/, 'The TDT seed must declare its maximum plan depth.')
requireContract(rules, /SUBPROJECT_TEMPLATE_SEED\s*=\s*\[[\s\S]*?['"]第1版转测['"][\s\S]*?['"]第2版转测['"][\s\S]*?['"]第X版转测['"][\s\S]*?['"]TDR3['"][\s\S]*?\]/, 'The subproject seed must be the approved ordered list of four stage strings.')
requireContract(rules, /validateTechnicalPlanDepth[\s\S]*?subproject[\s\S]*?children[\s\S]*?reject/, 'Depth validation must reject any child task for a subproject.')

console.log('technical plan contract passed')
