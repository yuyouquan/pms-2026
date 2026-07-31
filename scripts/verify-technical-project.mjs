#!/usr/bin/env node
import assert from 'node:assert/strict'
import { loadTypeScriptModule, projectRoot } from './lib/source-contract.mjs'

const rules = loadTypeScriptModule(projectRoot(import.meta.url), 'src/lib/technicalProjectRules.ts')
for (const name of ['resolveTechnicalProjectFields', 'validateTechnicalProject']) assert.equal(typeof rules[name], 'function', `missing ${name}`)
assert.deepEqual(rules.resolveTechnicalProjectFields({ ipm: '王五', tmg: '影像', technicalLead: '李四' }, { tmgSubdomains: { 影像: ['相机'] } }), { ipm: '王五', projectManager: '王五', tmg: '影像', subdomains: ['相机'], technicalLead: '李四', responsiblePersons: ['李四'] }, 'IPM maps manager, lead derives persons, and TMG maps subdomains')
assert.deepEqual(rules.resolveTechnicalProjectFields({ tmg: '未知', technicalLead: '李四' }, { tmgSubdomains: {} }).subdomains, [], 'unknown TMG does not auto-fill')
assert.throws(() => rules.validateTechnicalProject({ type: 'tdt', technicalLead: '' }), /technicalLead/, 'technical lead is required')
assert.throws(() => rules.validateTechnicalProject({ type: 'tdt', technicalLead: '李四', predecessor: { type: 'technical', work: '' } }), /predecessor/, 'technical predecessor requires work')
assert.doesNotThrow(() => rules.validateTechnicalProject({ type: 'tdt', technicalLead: '李四', predecessor: { type: 'machine', work: '' } }), 'nontechnical predecessor work is optional')
console.log('technical project contract passed')
