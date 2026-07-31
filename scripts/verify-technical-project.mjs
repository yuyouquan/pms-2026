#!/usr/bin/env node
import assert from 'node:assert/strict'
import { loadTypeScriptModule, projectRoot, readSource } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const rules = loadTypeScriptModule(root, 'src/lib/technicalProjectRules.ts')
const constants = loadTypeScriptModule(root, 'src/constants/technicalProject.ts')
for (const name of ['resolveTechnicalProjectFields', 'validateTechnicalProject', 'synchronizeTechnicalSubprojects']) assert.equal(typeof rules[name], 'function', `missing ${name}`)
assert.deepEqual(constants.SUBDOMAINS_BY_DOMAIN, {
  基础架构TMG: ['无'], 性能TMG: ['无'], 'DFX TMG': ['无'], 'UX TMG': ['无'],
  系统应用: ['AIOS', '应用', '图形', '内核', '多媒体'],
  底软通信: ['器件', '蜂窝', '短距', '功耗'],
  集成维护: ['三方体验', 'GMS'], 其他: ['安全', 'AIOT'],
}, 'approved TMG/subdomain mapping must remain exact')
assert.deepEqual(rules.resolveTechnicalProjectFields({ ipm: { projectName: 'AI项目', category: '系统', secondaryCategory: '应用', technicalTrack: 'AIOS' }, tmg: '系统应用', technicalLead: '李四' }, { tmgSubdomains: { 系统应用: ['AIOS', '应用', '图形', '内核', '多媒体'] } }), { projectName: 'AI项目', category: '系统', secondaryCategory: '应用', technicalTrack: 'AIOS', tmg: '系统应用', subdomains: ['AIOS', '应用', '图形', '内核', '多媒体'], technicalLead: '李四', responsiblePersons: ['李四'] }, 'IPM copies only project fields; lead derives persons and system application maps subdomains')
for (const tmg of ['基础架构TMG', '性能TMG', 'DFX TMG', 'UX TMG']) {
  const resolved = rules.resolveTechnicalProjectFields({ tmg, technicalLead: '李四' }, { tmgSubdomains: {} })
  assert.deepEqual(resolved.subdomains, ['无'], `${tmg} has the explicit no-subdomain value`)
  assert.equal(resolved.subdomainDisabled, true, `${tmg} disables subdomain editing`)
}
assert.throws(() => rules.validateTechnicalProject({ type: 'tdt', technicalLead: '' }), /technicalLead/, 'technical lead is required')
assert.throws(() => rules.validateTechnicalProject({ type: '技术项目前置工作', technicalLead: '李四', preProjectId: '' }), /preProjectId/, 'technical predecessor-work projects require preProjectId')
assert.doesNotThrow(() => rules.validateTechnicalProject({ type: '整机产品项目', technicalLead: '李四', preProjectId: '' }), 'other project types do not require preProjectId')
assert.throws(() => rules.validateTechnicalProject({ type: 'tdt', technicalLead: '李四', tmg: '', subdomain: '' }), /tmg/, 'TMG is required')
assert.throws(() => rules.validateTechnicalProject({ type: 'tdt', technicalLead: '李四', tmg: '系统应用', subdomain: '安全' }), /subdomain/, 'subdomain must belong to TMG')
assert.throws(() => rules.validateTechnicalProject({ type: 'tdt', technicalLead: '李四', tmg: '系统应用', subdomain: 'AIOS', projectYear: '26' }), /projectYear/, 'year is four digits')
assert.doesNotThrow(() => rules.validateTechnicalProject({ type: 'tdt', technicalLead: '李四', tmg: '系统应用', subdomain: 'AIOS', projectYear: '2026', technicalTeam: { technicalLead: '李四', technicalProjectManager: '', testRepresentative: '', qualityRepresentative: '', productRepresentative: '', standardizationRepresentative: '' } }), 'five non-lead roles stay optional')
assert.throws(() => rules.validateTechnicalProject({ type: 'tdt', technicalLead: '李四', tmg: '系统应用', subdomain: 'AIOS', deliverables: { kpi: { kind: 'url', url: 'https://a.example', file: { name: 'a.pdf', size: 1, mimeType: 'application/pdf' } } } }), /deliverable/, 'a deliverable cannot contain URL and file together')
assert.throws(() => rules.validateTechnicalProject({ type: 'tdt', technicalLead: '李四', tmg: '系统应用', subdomain: 'AIOS', deliverables: { kpi: { kind: 'url', url: 'not-a-link' } } }), /deliverable/, 'deliverable links must be valid HTTP(S) URLs')
assert.doesNotThrow(() => rules.validateTechnicalProject({ type: 'tdt', technicalLead: '李四', tmg: '系统应用', subdomain: 'AIOS', deliverables: { kpi: { kind: 'file', name: 'kpi.pdf', size: 12, mimeType: 'application/pdf' } } }), 'one file metadata object is accepted')
assert.deepEqual(rules.getPreProjectCandidates([{ id: '1', type: '整机产品项目' }, { id: '2', type: 'tOS版本项目' }, { id: '3', type: '技术项目' }], '2').map(item => item.id), ['1', '3'], 'pre-project candidates include every project type except current')
const existing = [{ id: 'a', name: 'A', active: true, config: { owner: '张三' } }, { id: 'b', name: 'B', active: true, config: { owner: '李四' } }]
const synced = rules.synchronizeTechnicalSubprojects(existing, [{ id: 'a', name: 'A2' }, { id: 'c', name: 'C' }])
assert.deepEqual(synced, { ok: true, items: [{ id: 'a', name: 'A2', active: true, config: { owner: '张三' } }, { id: 'b', name: 'B', active: false, config: { owner: '李四' } }, { id: 'c', name: 'C', active: true }] }, 'sync preserves stable ids/config, soft-inactivates missing items, and adds new ids')
assert.deepEqual(rules.synchronizeTechnicalSubprojects(synced.items, [{ id: 'b', name: 'B' }]).items[1], { id: 'b', name: 'B', active: true, config: { owner: '李四' } }, 'returning subproject reactivates and preserves config')
assert.deepEqual(rules.synchronizeTechnicalSubprojects(existing, [{ id: 'a' }, { id: 'a' }]), { ok: false, reason: 'duplicate-id', items: existing }, 'duplicate batch fails atomically')
const modal = readSource(root, 'src/components/project-info/ProjectInfoModal.tsx')
assert.match(modal, /TechnicalProjectCreateFields/, 'project modal renders focused technical fields')
assert.doesNotMatch(modal, /projectType === ['"]技术项目['"][\s\S]{0,200}name="responsiblePersons"/, 'technical project must not render the generic owner input')
assert.match(readSource(root, 'src/components/workspace/AddProjectModal.tsx'), /technicalLead/, 'create maps technical lead to persisted project data')
const sourcePool = readSource(root, 'src/data/externalProjectPool.ts')
assert.match(sourcePool, /ipmProjectCategoryName: '技术项目前置工作'/, 'mock IPM pool exposes the conditional predecessor-work path')
assert.match(sourcePool, /technicalTrack: 'AIOS'/, 'technical track is supplied by IPM and not manually entered')
console.log('technical project contract passed')
