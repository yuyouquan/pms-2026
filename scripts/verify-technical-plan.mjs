#!/usr/bin/env node
import assert from 'node:assert/strict'
import { loadTypeScriptModule, projectRoot } from './lib/source-contract.mjs'

const rules = loadTypeScriptModule(projectRoot(import.meta.url), 'src/lib/technicalPlanRules.ts')
assert.equal(typeof rules.validateTechnicalTemplateDepth, 'function', 'missing validateTechnicalTemplateDepth')
assert.deepEqual(rules.TDT_TEMPLATE_SEED, [['TDR1', ['TDR2']], ['TDR3', []]], 'TDT seed is the approved two-level tuple template')
assert.deepEqual(rules.SUBPROJECT_TEMPLATE_SEED, ['第1版转测', '第2版转测', '第X版转测', 'TDR3'], 'subproject seed is the approved ordered stage list')
assert.throws(() => rules.validateTechnicalTemplateDepth('tdt', [{ name: 'L1', children: [{ name: 'L2', children: [{ name: 'L3' }] }] }]), /depth/i, 'TDT depth greater than two is rejected')
assert.throws(() => rules.validateTechnicalTemplateDepth('subproject', [{ name: 'L1', children: [{ name: 'child' }] }]), /child/i, 'subproject child tasks are rejected')
console.log('technical plan contract passed')
