#!/usr/bin/env node
import assert from 'node:assert/strict'
import { loadTypeScriptModule, projectRoot } from './lib/source-contract.mjs'

const rules = loadTypeScriptModule(projectRoot(import.meta.url), 'src/lib/technicalProjectRules.ts')
for (const name of ['resolveTechnicalProjectFields', 'validateTechnicalProject']) assert.equal(typeof rules[name], 'function', `missing ${name}`)
assert.deepEqual(rules.resolveTechnicalProjectFields({ ipm: { projectName: 'AI项目', category: '系统', secondaryCategory: '应用', technicalTrack: 'AIOS' }, tmg: '系统应用', technicalLead: '李四' }, { tmgSubdomains: { 系统应用: ['AIOS', '应用', '图形', '内核', '多媒体'] } }), { projectName: 'AI项目', category: '系统', secondaryCategory: '应用', technicalTrack: 'AIOS', tmg: '系统应用', subdomains: ['AIOS', '应用', '图形', '内核', '多媒体'], technicalLead: '李四', responsiblePersons: ['李四'] }, 'IPM copies only project fields; lead derives persons and system application maps subdomains')
for (const tmg of ['基础架构TMG', '性能TMG', 'DFX TMG', 'UX TMG']) {
  const resolved = rules.resolveTechnicalProjectFields({ tmg, technicalLead: '李四' }, { tmgSubdomains: {} })
  assert.deepEqual(resolved.subdomains, ['无'], `${tmg} has the explicit no-subdomain value`)
  assert.equal(resolved.subdomainDisabled, true, `${tmg} disables subdomain editing`)
}
assert.throws(() => rules.validateTechnicalProject({ type: 'tdt', technicalLead: '' }), /technicalLead/, 'technical lead is required')
assert.throws(() => rules.validateTechnicalProject({ type: '技术项目前置工作', technicalLead: '李四', preProjectId: '' }), /preProjectId/, 'technical predecessor-work projects require preProjectId')
assert.doesNotThrow(() => rules.validateTechnicalProject({ type: '整机产品项目', technicalLead: '李四', preProjectId: '' }), 'other project types do not require preProjectId')
console.log('technical project contract passed')
