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

requireContract('src/types/technicalProject.ts', /TechnicalProjectType[\s\S]*?['"]TDT['"][\s\S]*?['"]subproject['"]/, 'Technical-project types must distinguish TDT and subproject records.')
requireContract('src/lib/technicalProjectRules.ts', /export\s+function\s+softDisableTechnicalSubproject\b/, 'Technical subprojects must be soft-disabled through a pure rule.')
requireContract('src/lib/technicalProjectRules.ts', /disabledAt\b/, 'Soft disablement must retain an audit timestamp rather than delete the subproject.')
requireContract('src/stores/technicalProject.ts', /softDisableTechnicalSubproject\b/, 'The technical-project store must apply the soft-disable rule.')

console.log('technical project contract passed')
