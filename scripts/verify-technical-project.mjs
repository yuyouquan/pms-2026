#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
import { loadTypeScriptModule, projectRoot, readSource } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const rules = loadTypeScriptModule(root, 'src/lib/technicalProjectRules.ts')
const constants = loadTypeScriptModule(root, 'src/constants/technicalProject.ts')
for (const name of ['resolveTechnicalProjectFields', 'validateTechnicalProject', 'synchronizeTechnicalSubprojects', 'isTechnicalSubprojectConfigured', 'canCreateSubprojectPlanRevision', 'switchDeliverableMode', 'normalizeTechnicalProjectValues', 'synchronizeTechnicalProjectRecord', 'calculateTechnicalProjectStage', 'resolveLatestPublishedTechnicalProjectStage', 'sanitizeTechnicalDeliverableUrl', 'normalizeTechnicalCustomRoles', 'resolveTechnicalChildSelection']) assert.equal(typeof rules[name], 'function', `missing ${name}`)
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
assert.doesNotThrow(() => rules.validateTechnicalProject({ type: '技术项目前置工作', technicalLead: '李四', preProjectId: '', tmg: '系统应用', subdomain: 'AIOS', projectYear: '2026' }), 'pre-project remains optional for every technical project')
assert.doesNotThrow(() => rules.validateTechnicalProject({ type: '整机产品项目', technicalLead: '李四', preProjectId: '' }), 'other project types do not require preProjectId')
assert.throws(() => rules.validateTechnicalProject({ type: 'tdt', technicalLead: '李四', tmg: '', subdomain: '' }), /tmg/, 'TMG is required')
assert.throws(() => rules.validateTechnicalProject({ type: 'tdt', technicalLead: '李四', tmg: '系统应用', subdomain: '安全' }), /subdomain/, 'subdomain must belong to TMG')
assert.throws(() => rules.validateTechnicalProject({ type: 'tdt', technicalLead: '李四', tmg: '系统应用', subdomain: 'AIOS', projectYear: '26' }), /projectYear/, 'year is four digits')
assert.doesNotThrow(() => rules.validateTechnicalProject({ type: 'tdt', technicalLead: '李四', tmg: '系统应用', subdomain: 'AIOS', projectYear: '2026', technicalTeam: { technicalLead: '李四', technicalProjectManager: '', testRepresentative: '', qualityRepresentative: '', productRepresentative: '', standardizationRepresentative: '' } }), 'five non-lead roles stay optional')
assert.throws(() => rules.validateTechnicalProject({ type: 'tdt', technicalLead: '李四', tmg: '系统应用', subdomain: 'AIOS', projectYear: '2026', deliverables: { kpi: { kind: 'url', url: 'https://a.example', file: { name: 'a.pdf', size: 1, mimeType: 'application/pdf' } } } }), /deliverable/, 'a deliverable cannot contain URL and file together')
assert.throws(() => rules.validateTechnicalProject({ type: 'tdt', technicalLead: '李四', tmg: '系统应用', subdomain: 'AIOS', projectYear: '2026', deliverables: { kpi: { kind: 'url', url: 'not-a-link' } } }), /deliverable/, 'deliverable links must be valid HTTP(S) URLs')
assert.doesNotThrow(() => rules.validateTechnicalProject({ type: 'tdt', technicalLead: '李四', tmg: '系统应用', subdomain: 'AIOS', projectYear: '2026', deliverables: { kpi: { kind: 'file', name: 'kpi.pdf', size: 12, mimeType: 'application/pdf' } } }), 'one file metadata object is accepted')
assert.equal(rules.switchDeliverableMode({ kind: 'file', name: 'kpi.pdf', size: 12, mimeType: 'application/pdf' }, 'url'), null, 'file to URL mode clears to null instead of creating an empty URL object')
assert.equal(rules.switchDeliverableMode({ kind: 'url', url: 'https://a.example/kpi' }, 'file'), null, 'URL to file mode clears to null instead of creating empty file metadata')
assert.equal(rules.switchDeliverableMode(null, 'file'), null, 'switching an empty optional deliverable keeps it null')
assert.deepEqual(rules.switchDeliverableMode({ kind: 'url', url: 'https://a.example/kpi' }, 'url'), { kind: 'url', url: 'https://a.example/kpi' }, 'reselecting the active mode preserves a valid value')
const technicalValues = {
  technicalTrack: 'AIOS', tmg: '系统应用', subdomain: 'AIOS', preProjectId: '', projectYear: '2026', projectValue: '提升体验',
  technicalLead: '李四', technicalProjectManager: '王五', testRepresentative: '', qualityRepresentative: '赵六', productRepresentative: '', standardizationRepresentative: '',
  projectKpi: { kind: 'url', url: 'https://a.example/kpi' }, conceptDesign: null, charterReport: null, pdcpReport: null, tdcpReport: null, edcpReport: null,
}
const createdRecord = rules.synchronizeTechnicalProjectRecord({ id: 'tech-1', name: 'AI项目', type: '技术项目' }, technicalValues, { ipmProjectType: '部门级-技术研发' })
assert.deepEqual(createdRecord.responsiblePersons, ['李四'], 'create derives responsiblePersons from technical lead')
assert.equal(createdRecord.leader, '李四', 'create derives root leader from technical lead')
for (const key of Object.keys(technicalValues)) assert.deepEqual(createdRecord[key], createdRecord.fieldValues[key], `create keeps root and fieldValues consistent for ${key}`)
const editedValues = { ...technicalValues, technicalLead: '张三', technicalProjectManager: '', projectYear: '2027', projectValue: '', projectKpi: null, conceptDesign: { kind: 'file', name: 'design.pdf', size: 30, mimeType: 'application/pdf' } }
const editedRecord = rules.synchronizeTechnicalProjectRecord(createdRecord, editedValues, { ipmProjectType: '部门级-技术研发' })
assert.deepEqual(editedRecord.responsiblePersons, ['张三'], 'edit resynchronizes owner from the changed lead')
assert.equal(editedRecord.leader, '张三', 'edit resynchronizes leader from the changed lead')
for (const key of Object.keys(editedValues)) assert.deepEqual(editedRecord[key], editedRecord.fieldValues[key], `edit keeps root and fieldValues consistent for ${key}`)
assert.equal(editedRecord.projectKpi, null, 'edit can clear a previously selected deliverable')
assert.deepEqual(rules.getPreProjectCandidates([{ id: '1', type: '整机产品项目' }, { id: '2', type: 'tOS版本项目' }, { id: '3', type: '技术项目' }], '2').map(item => item.id), ['1', '3'], 'pre-project candidates include every project type except current')
const existing = [{ id: 'a', parentProjectId: 'tech', name: 'A', active: true, ipmOrder: 1, configuration: { coreValue: '追赶', developmentMode: '自研', firstTosVersion: '', firstMachineProjectId: '' } }, { id: 'b', parentProjectId: 'tech', name: 'B', active: true, ipmOrder: 2, configuration: { coreValue: '人有我有', developmentMode: 'SoC合作', firstTosVersion: '', firstMachineProjectId: '' } }]
const synced = rules.synchronizeTechnicalSubprojects(existing, [{ id: 'a', parentProjectId: 'tech', name: 'A2', ipmOrder: 1 }, { id: 'c', parentProjectId: 'tech', name: 'C', ipmOrder: 3 }], 'tech')
assert.deepEqual(synced, { ok: true, items: [{ id: 'a', parentProjectId: 'tech', name: 'A2', active: true, ipmOrder: 1, configuration: { coreValue: '追赶', developmentMode: '自研', firstTosVersion: '', firstMachineProjectId: '' } }, { id: 'b', parentProjectId: 'tech', name: 'B', active: false, ipmOrder: 2, configuration: { coreValue: '人有我有', developmentMode: 'SoC合作', firstTosVersion: '', firstMachineProjectId: '' } }, { id: 'c', parentProjectId: 'tech', name: 'C', active: true, ipmOrder: 3, configuration: { coreValue: '', developmentMode: '', firstTosVersion: '', firstMachineProjectId: '' } }] }, 'sync preserves stable ids/config, soft-inactivates missing items, and adds new ids')
assert.deepEqual(rules.synchronizeTechnicalSubprojects(synced.items, [{ id: 'b', parentProjectId: 'tech', name: 'B', ipmOrder: 2 }], 'tech').items[1], { id: 'b', parentProjectId: 'tech', name: 'B', active: true, ipmOrder: 2, configuration: { coreValue: '人有我有', developmentMode: 'SoC合作', firstTosVersion: '', firstMachineProjectId: '' } }, 'returning subproject reactivates and preserves config')
assert.deepEqual(rules.synchronizeTechnicalSubprojects(existing, [{ id: 'a', parentProjectId: 'tech', name: 'A', ipmOrder: 1 }, { id: 'a', parentProjectId: 'tech', name: 'A2', ipmOrder: 2 }], 'tech'), { ok: false, reason: 'duplicate-id', items: existing }, 'duplicate batch fails atomically')
const configuredChildren = [{
  id: 'child-a', parentProjectId: 'tech-1', name: 'A', active: true, ipmOrder: 5,
  configuration: { coreValue: '追赶', developmentMode: '自研', firstTosVersion: '16.0', firstMachineProjectId: '1' },
  planInstanceId: 'plan-child-a',
}]
const orderedSync = rules.synchronizeTechnicalSubprojects(configuredChildren, [
  { id: 'child-b', parentProjectId: 'tech-1', name: 'B', ipmOrder: 2 },
  { id: 'child-a', parentProjectId: 'tech-1', name: 'A renamed', ipmOrder: 1 },
], 'tech-1')
assert.equal(orderedSync.ok, true, 'a valid IPM batch synchronizes')
assert.deepEqual(orderedSync.items.map(item => item.id), ['child-a', 'child-b'], 'sync order is deterministic by IPM order then stable ID')
assert.deepEqual(orderedSync.items[0].configuration, configuredChildren[0].configuration, 'IPM updates preserve PMS-owned configuration')
assert.equal(orderedSync.items[0].planInstanceId, 'plan-child-a', 'IPM updates preserve plan references')
assert.deepEqual(orderedSync.items[1].configuration, { coreValue: '', developmentMode: '', firstTosVersion: '', firstMachineProjectId: '' }, 'new children start pending configuration')
assert.deepEqual(rules.synchronizeTechnicalSubprojects(configuredChildren, [{ id: '', parentProjectId: 'tech-1', name: 'Broken', ipmOrder: 1 }], 'tech-1'), { ok: false, reason: 'invalid-payload', items: configuredChildren }, 'invalid payload fails atomically')
assert.deepEqual(rules.synchronizeTechnicalSubprojects(configuredChildren, [{ id: 'x', parentProjectId: 'other', name: 'Wrong parent', ipmOrder: 1 }], 'tech-1'), { ok: false, reason: 'invalid-payload', items: configuredChildren }, 'wrong-parent payload fails atomically')
for (const payload of [
  [{ id: 'missing-parent', name: 'Missing parent', ipmOrder: 1 }],
  [{ id: 'empty-name', parentProjectId: 'tech-1', name: '   ', ipmOrder: 1 }],
]) {
  assert.deepEqual(rules.synchronizeTechnicalSubprojects(configuredChildren, payload, 'tech-1'), { ok: false, reason: 'invalid-payload', items: configuredChildren }, 'missing or empty identity fields reject the whole batch')
}
for (const payload of [
  [{ id: 123, parentProjectId: 'tech-1', name: 'Numeric id', ipmOrder: 1 }],
  [{ id: 'numeric-name', parentProjectId: 'tech-1', name: 456, ipmOrder: 1 }],
  [{ id: 'numeric-parent', parentProjectId: 789, name: 'Numeric parent', ipmOrder: 1 }],
]) {
  assert.doesNotThrow(() => rules.synchronizeTechnicalSubprojects(configuredChildren, payload, 'tech-1'), 'wrong-type identity fields return a result instead of throwing')
  assert.deepEqual(rules.synchronizeTechnicalSubprojects(configuredChildren, payload, 'tech-1'), { ok: false, reason: 'invalid-payload', items: configuredChildren }, 'wrong-type identity fields reject atomically')
}
assert.deepEqual(rules.synchronizeTechnicalSubprojects(configuredChildren, [{ id: 'wrong-trimmed-parent', parentProjectId: ' tech-2 ', name: 'Wrong trimmed parent', ipmOrder: 1 }], 'tech-1'), { ok: false, reason: 'invalid-payload', items: configuredChildren }, 'trimmed parent identity must exactly match the requested parent')
assert.deepEqual(configuredChildren, [{ id: 'child-a', parentProjectId: 'tech-1', name: 'A', active: true, ipmOrder: 5, configuration: { coreValue: '追赶', developmentMode: '自研', firstTosVersion: '16.0', firstMachineProjectId: '1' }, planInstanceId: 'plan-child-a' }], 'all rejected payloads leave the existing input untouched')
assert.equal(rules.isTechnicalSubprojectConfigured(orderedSync.items[1]), false, 'missing required configuration is pending')
assert.equal(rules.canCreateSubprojectPlanRevision(orderedSync.items[1]), false, 'pending configuration blocks plan revision')
assert.equal(rules.canCreateSubprojectPlanRevision(orderedSync.items[0]), true, 'active configured child permits plan revision')
assert.equal(rules.canCreateSubprojectPlanRevision({ ...orderedSync.items[0], active: false }), false, 'inactive child cannot create a plan revision')
orderedSync.items[0].configuration.coreValue = '人有我有'
assert.equal(configuredChildren[0].configuration.coreValue, '追赶', 'successful sync deep-clones PMS configuration instead of sharing input references')
const nestedReferenceInput = [{ ...configuredChildren[0], planReferences: { versions: [{ id: 'v1' }] } }]
const nestedReferenceSync = rules.synchronizeTechnicalSubprojects(nestedReferenceInput, [{ id: 'child-a', parentProjectId: 'tech-1', name: 'A', ipmOrder: 1 }], 'tech-1')
nestedReferenceSync.items[0].planReferences.versions[0].id = 'changed'
assert.equal(nestedReferenceInput[0].planReferences.versions[0].id, 'v1', 'successful sync deep-clones nested plan references')
const localStorageData = new Map()
globalThis.localStorage = {
  getItem: key => localStorageData.get(key) ?? null,
  setItem: (key, value) => { localStorageData.set(key, value) },
  removeItem: key => { localStorageData.delete(key) },
}
const technicalStoreModule = loadTypeScriptModule(root, 'src/stores/technicalProject.ts')
const technicalStore = technicalStoreModule.createTechnicalProjectStore({ subprojects: configuredChildren })
let fixtureNotifications = 0
const unsubscribeFixture = technicalStore.subscribe(() => { fixtureNotifications += 1 })
const beforeFailedStoreSync = technicalStore.getState().subprojects
for (const malformedBatch of [null, { id: 'not-an-array' }, [null]]) {
  assert.doesNotThrow(() => technicalStore.synchronizeSubprojects('tech-1', malformedBatch), 'fixture store returns an error for malformed batches instead of throwing')
  assert.deepEqual(technicalStore.synchronizeSubprojects('tech-1', malformedBatch), { ok: false, reason: 'invalid-payload', items: beforeFailedStoreSync }, 'fixture store rejects malformed batches atomically')
}
assert.equal(fixtureNotifications, 0, 'malformed fixture batches emit no notifications')
assert.deepEqual(technicalStore.getState().subprojects, beforeFailedStoreSync, 'malformed fixture batches leave state unchanged')
assert.equal(technicalStore.synchronizeSubprojects('tech-1', [{ id: 'dup', parentProjectId: 'tech-1', name: 'One', ipmOrder: 1 }, { id: 'dup', parentProjectId: 'tech-1', name: 'Two', ipmOrder: 2 }]).ok, false, 'store rejects duplicate IDs')
assert.deepEqual(technicalStore.getState().subprojects, beforeFailedStoreSync, 'failed store sync is atomic')
assert.deepEqual(technicalStore.synchronizeSubprojects('', [{ id: 'x', parentProjectId: 'tech-1', name: 'Wrong scope', ipmOrder: 1 }]), { ok: false, reason: 'invalid-payload', items: beforeFailedStoreSync }, 'empty parent scope rejects atomically')
const crossParentStore = technicalStoreModule.createTechnicalProjectStore({ subprojects: [...configuredChildren, { id: 'shared-id', parentProjectId: 'tech-2', name: 'Other child', active: true, ipmOrder: 1, configuration: { coreValue: '', developmentMode: '', firstTosVersion: '', firstMachineProjectId: '' } }] })
const beforeCrossParentConflict = crossParentStore.getState().subprojects
assert.deepEqual(crossParentStore.synchronizeSubprojects('tech-1', [{ id: 'shared-id', parentProjectId: 'tech-1', name: 'Conflicting child', ipmOrder: 1 }]), { ok: false, reason: 'duplicate-id', items: beforeCrossParentConflict }, 'stable IPM IDs stay globally unique across TDT parents')
assert.deepEqual(crossParentStore.getState().subprojects, beforeCrossParentConflict, 'cross-parent ID conflict is atomic')
assert.equal(typeof technicalStore.deleteSubproject, 'undefined', 'store intentionally exposes no manual child deletion action')
const beforeInactiveFixtureSave = technicalStore.getState().subprojects
assert.deepEqual(technicalStore.synchronizeSubprojects('tech-1', []), { ok: true, items: [{ ...configuredChildren[0], active: false }] }, 'empty successful IPM batch soft-deactivates the child')
fixtureNotifications = 0
const beforeRejectedFixtureSaves = technicalStore.getState().subprojects
assert.deepEqual(technicalStore.updateConfiguration('child-a', { coreValue: '人有我有' }), { ok: false, reason: 'inactive' }, 'fixture store rejects stale saves for inactive children')
assert.equal(fixtureNotifications, 0, 'inactive fixture save emits no notification')
assert.deepEqual(technicalStore.getState().subprojects, beforeRejectedFixtureSaves, 'inactive fixture save leaves state unchanged')
assert.notDeepEqual(technicalStore.getState().subprojects, beforeInactiveFixtureSave, 'only the preceding synchronization changed fixture state')
assert.deepEqual(technicalStore.updateConfiguration('missing', { coreValue: '人有我有' }), { ok: false, reason: 'missing' }, 'fixture store rejects missing children')
assert.equal(fixtureNotifications, 0, 'missing fixture save emits no notification')
unsubscribeFixture()
const activeTechnicalStore = technicalStoreModule.createTechnicalProjectStore({ subprojects: configuredChildren })
assert.equal(activeTechnicalStore.updateConfiguration('child-a', { coreValue: '人无我有', developmentMode: '谷歌合作', firstTosVersion: '17.2', firstMachineProjectId: '2' }).ok, true, 'PMS configuration can be saved')
assert.equal(activeTechnicalStore.getState().subprojects[0].configuration.coreValue, '人无我有', 'configuration save commits all draft fields')

const liveStore = technicalStoreModule.useTechnicalProjectStore
liveStore.setState({ subprojects: [{ ...configuredChildren[0], active: false }] })
let liveNotifications = 0
const unsubscribeLive = liveStore.subscribe(() => { liveNotifications += 1 })
const beforeRejectedLiveSaves = liveStore.getState().subprojects
for (const malformedBatch of [null, { id: 'not-an-array' }, [null]]) {
  assert.doesNotThrow(() => liveStore.getState().synchronizeSubprojects('tech-1', malformedBatch), 'persisted store returns an error for malformed batches instead of throwing')
  assert.deepEqual(liveStore.getState().synchronizeSubprojects('tech-1', malformedBatch), { ok: false, reason: 'invalid-payload', items: beforeRejectedLiveSaves }, 'persisted store rejects malformed batches atomically')
}
assert.equal(liveNotifications, 0, 'malformed persisted-store batches emit no notifications')
assert.deepEqual(liveStore.getState().subprojects, beforeRejectedLiveSaves, 'malformed persisted-store batches leave state unchanged')
assert.deepEqual(liveStore.getState().updateConfiguration('child-a', { coreValue: '人有我有' }), { ok: false, reason: 'inactive' }, 'persisted store rejects stale saves for inactive children')
assert.deepEqual(liveStore.getState().updateConfiguration('missing', { coreValue: '人有我有' }), { ok: false, reason: 'missing' }, 'persisted store rejects missing children')
assert.equal(liveNotifications, 0, 'rejected persisted-store saves emit no notification')
assert.deepEqual(liveStore.getState().subprojects, beforeRejectedLiveSaves, 'rejected persisted-store saves leave state unchanged')
liveStore.setState({ subprojects: configuredChildren })
liveNotifications = 0
assert.equal(liveStore.getState().updateConfiguration('child-a', { coreValue: '人无我有' }).ok, true, 'active persisted child can be configured')
assert.equal(liveNotifications, 1, 'successful persisted-store save emits exactly one notification')
unsubscribeLive()

const migrated = technicalStoreModule.migrateTechnicalProjectState({ subprojects: [
  { id: ' good ', parentProjectId: ' parent ', name: ' Child ', active: true, ipmOrder: 2, configuration: { coreValue: '人无我有', developmentMode: '谷歌合作', firstTosVersion: '99.9', firstMachineProjectId: 'machine-old' }, planInstanceId: 'plan-1' },
  { id: 'good', parentProjectId: 'duplicate-parent', name: 'Duplicate', active: true, ipmOrder: 1 },
  { id: '', parentProjectId: 'parent', name: 'Broken', active: true, ipmOrder: 1 },
  { id: 'legacy', parentProjectId: 'parent', name: 'Legacy', ipmOrder: 'bad', config: { coreValue: '人有我有', developmentMode: 'SoC合作', firstTosVersion: '17.2', firstMachineProjectId: '1' } },
] }, 1)
assert.deepEqual(migrated.subprojects.map(item => item.id), ['good', 'legacy'], 'migration trims stable IDs, removes malformed/duplicate records, and keeps valid legacy rows')
assert.equal(migrated.subprojects[0].configuration.firstTosVersion, '99.9', 'migration preserves historical enum string references')
assert.equal(migrated.subprojects[0].planInstanceId, 'plan-1', 'migration preserves valid plan references')
assert.deepEqual(migrated.subprojects[1].configuration, { coreValue: '人有我有', developmentMode: 'SoC合作', firstTosVersion: '17.2', firstMachineProjectId: '1' }, 'migration upgrades the legacy config shape')
localStorage.setItem(technicalStoreModule.TECHNICAL_PROJECT_STORAGE_KEY, JSON.stringify({ state: { subprojects: [{ id: 'rehydrated', parentProjectId: 'tech-r', name: 'Recovered', active: true, ipmOrder: null, configuration: { coreValue: 'invalid', developmentMode: '自研', firstTosVersion: 16, firstMachineProjectId: null } }] }, version: 1 }))
await liveStore.persist.rehydrate()
assert.deepEqual(liveStore.getState().subprojects, [{ id: 'rehydrated', parentProjectId: 'tech-r', name: 'Recovered', active: true, ipmOrder: 1, configuration: { coreValue: '', developmentMode: '自研', firstTosVersion: '', firstMachineProjectId: '' } }], 'persist rehydrate sanitizes malformed fields without throwing or replacing the stable ID')
const modal = readSource(root, 'src/components/project-info/ProjectInfoModal.tsx')
assert.match(modal, /TechnicalProjectCreateFields/, 'project modal renders focused technical fields')
assert.doesNotMatch(modal, /projectType === ['"]技术项目['"][\s\S]{0,200}name="responsiblePersons"/, 'technical project must not render the generic owner input')
assert.match(modal, /useOverlayInteraction/, 'project modal reuses the shared overlay submission guard')
assert.match(modal, /const handleSubmit = async \(\) => \{\s*if \(isCreateDraftInteractionBlocked\) return\s*if \(!tryBeginSubmit\(\)\) return\s*setSubmitting\(true\)\s*try \{/, 'project submit locks synchronously before asynchronous validation')
assert.match(modal, /await form\.validateFields\(\)/, 'project submit still uses asynchronous Ant form validation')
assert.match(modal, /finally \{[\s\S]{0,180}setSubmitting\(false\)[\s\S]{0,120}releaseSubmission\(\)/, 'all validation, business, and submit exits release the shared lock')
const submissionGuardModule = loadTypeScriptModule(root, 'src/lib/submissionGuard.ts')
const sameTickGuard = submissionGuardModule.createSubmissionGuard()
assert.equal(sameTickGuard.tryBeginSubmit(), true, 'first same-tick submit acquires the lock')
assert.equal(sameTickGuard.tryBeginSubmit(), false, 'second same-tick submit is rejected')
sameTickGuard.releaseSubmission()
assert.equal(sameTickGuard.tryBeginSubmit(), true, 'explicit error-path release permits correction and retry')
sameTickGuard.releaseSubmission(true)
assert.equal(sameTickGuard.tryBeginSubmit(), false, 'deferred successful release stays locked in the current tick')
await new Promise(resolve => setTimeout(resolve, 0))
assert.equal(sameTickGuard.tryBeginSubmit(), true, 'deferred release opens on the next task')
sameTickGuard.dispose()
assert.match(readSource(root, 'src/components/workspace/AddProjectModal.tsx'), /synchronizeTechnicalProjectRecord/, 'create synchronizes technical root, fields, and owner through the executable adapter')
const sourcePool = readSource(root, 'src/data/externalProjectPool.ts')
assert.match(sourcePool, /ipmProjectCategoryName: '技术项目前置工作'/, 'mock IPM pool exposes the conditional predecessor-work path')
assert.match(sourcePool, /technicalTrack: 'AIOS'/, 'technical track is supplied by IPM and not manually entered')
assert.match(sourcePool, /subprojects:\s*\[/, 'IPM fixture includes derived child rows')
const configModal = readSource(root, 'src/components/technical-project/SubprojectConfigModal.tsx')
assert.match(configModal, /核心价值/, 'configuration modal renders core value')
assert.match(configModal, /开发模式/, 'configuration modal renders development mode')
assert.match(configModal, /valuesByType\[['"]tos-2-part['"]\]/, 'first tOS choices come from current two-part enum values')
assert.match(configModal, /showSearch/, 'first machine project is searchable')
assert.doesNotMatch(configModal, /删除/, 'subproject configuration has no delete action')
assert.match(configModal, /useOverlayInteraction/, 'subproject modal reuses the shared focus and submission guard')
assert.match(configModal, /if\s*\(!tryBeginSubmit\(\)\)\s*return/, 'subproject confirm is guarded in the same event-loop tick')
assert.match(configModal, /confirmLoading=\{submitting\}/, 'subproject confirm exposes loading feedback')
assert.match(configModal, /form\.resetFields\(\)[\s\S]*?onCancel\(\)/, 'cancel discards the subproject draft before closing')
assert.match(configModal, /className="pms-scroll-modal"/, 'long subproject modal scrolls internally')

const validStages = [
  { id: 'phase-1', name: '规划阶段', parentId: null, planStartDate: '2026-01-01', planEndDate: '2026-01-31', order: 1 },
  { id: 'child-ignored', name: '规划启动', parentId: 'phase-1', planStartDate: '2026-01-01', planEndDate: '2026-01-03', order: 1 },
  { id: 'phase-2', name: '概念阶段', parentId: null, planStartDate: '2026-02-01', planEndDate: '2026-02-28', order: 2 },
]
assert.equal(rules.calculateTechnicalProjectStage(validStages, '2025-12-31'), '未开始', 'date before first phase is not started')
assert.equal(rules.calculateTechnicalProjectStage(validStages, '2026-01-15'), '规划阶段', 'date inside a unique top-level phase uses its name')
assert.equal(rules.calculateTechnicalProjectStage(validStages, '2026-03-01'), '已完成', 'date after all phases is complete')
assert.equal(rules.calculateTechnicalProjectStage([{ ...validStages[0], planStartDate: '' }], '2026-01-15'), '-', 'missing phase dates are invalid')
assert.equal(rules.calculateTechnicalProjectStage([validStages[0], { ...validStages[2], planStartDate: '2026-02-02' }], '2026-02-01'), '-', 'date in a phase gap is indeterminate')
assert.equal(rules.calculateTechnicalProjectStage([validStages[0], { ...validStages[2], planStartDate: '2026-01-20' }], '2026-01-25'), '-', 'overlapping phases are indeterminate')
const stageVersions = [
  { id: 'published-old', templateType: 'tdt', status: '已发布', publishedAt: '2026-01-01T00:00:00Z', tasks: validStages },
  { id: 'draft-new', templateType: 'tdt', status: '修订中', publishedAt: '2026-04-01T00:00:00Z', tasks: [{ ...validStages[0], name: '草稿阶段' }] },
  { id: 'published-new', templateType: 'tdt', status: '已发布', publishedAt: '2026-02-01T00:00:00Z', tasks: [{ ...validStages[0], name: '最新规划阶段' }, validStages[2]] },
  { id: 'child-plan', templateType: 'subproject', status: '已发布', publishedAt: '2026-03-01T00:00:00Z', tasks: [{ ...validStages[0], name: '子项目阶段' }] },
]
assert.equal(rules.resolveLatestPublishedTechnicalProjectStage(stageVersions, '2026-01-15'), '最新规划阶段', 'only the latest published TDT version determines stage; drafts and child plans are ignored')
assert.equal(rules.resolveLatestPublishedTechnicalProjectStage(stageVersions, '2026-01-15', '父项目阶段'), '父项目阶段', 'child rows inherit the already resolved parent stage')
assert.equal(rules.resolveLatestPublishedTechnicalProjectStage([
  { id: 'v1-10', templateType: 'tdt', status: '已发布', versionNo: 'V1.10', publishedAt: '2027-01-01T00:00:00Z', tasks: [{ ...validStages[0], name: 'V1.10阶段' }] },
  { id: 'v2', templateType: 'tdt', status: '已发布', versionNo: 'V2', tasks: [{ ...validStages[0], name: 'V2阶段' }] },
], '2026-01-15'), 'V2阶段', 'plan version semantics outrank mixed or missing publication dates')
assert.equal(rules.resolveLatestPublishedTechnicalProjectStage([
  { id: 'older-date', templateType: 'tdt', status: '已发布', versionNo: 'V2', publishedAt: '2026-01-01T00:00:00Z', tasks: [{ ...validStages[0], name: '旧发布时间' }] },
  { id: 'newer-date', templateType: 'tdt', status: '已发布', versionNo: 'V2', publishedAt: '2026-02-01T00:00:00Z', tasks: [{ ...validStages[0], name: '新发布时间' }] },
], '2026-01-15'), '新发布时间', 'publication time is only a same-version tie-break')
assert.equal(rules.sanitizeTechnicalDeliverableUrl('https://a.example/file'), 'https://a.example/file', 'HTTPS deliverables remain clickable')
assert.equal(rules.sanitizeTechnicalDeliverableUrl('javascript:alert(1)'), null, 'dangerous deliverable protocols are non-clickable')
assert.equal(rules.sanitizeTechnicalDeliverableUrl('data:text/html,bad'), null, 'data URLs are non-clickable')
assert.deepEqual(rules.normalizeTechnicalCustomRoles([
  { name: ' 技术项目负责人 ', members: ['恶意重复'] },
  { name: '架构顾问', members: ['张三', ' 张三 '] },
  { name: ' 架构顾问 ', members: ['李四'] },
  { name: '临时角色', members: ['王五'], isFixed: true },
], constants.TECHNICAL_TEAM_FIELDS.map(field => field.label)), [{ name: '架构顾问', members: ['张三', '李四'], isFixed: false }], 'custom roles normalize, merge duplicates, and exclude fixed role names and fixed records')
assert.equal(rules.resolveTechnicalChildSelection(['child-a', 'child-b'], 'child-b', false), 'child-b', 'stable child selection is preserved within one project')
assert.equal(rules.resolveTechnicalChildSelection(['child-a', 'child-b'], 'child-b', true), 'child-a', 'project changes reset selection to the first IPM child')
assert.equal(typeof rules.resolveTechnicalInformationModules, 'function', 'technical information exposes a pure tab-module resolver')
assert.deepEqual(rules.resolveTechnicalInformationModules({ kind: 'tdt' }), { plan: true, basic: false, readOnly: false }, 'TDT information shows plan only')
assert.deepEqual(rules.resolveTechnicalInformationModules({ kind: 'subproject', active: true }), { plan: true, basic: true, readOnly: false }, 'active subproject information shows plan and editable basic details')
assert.deepEqual(rules.resolveTechnicalInformationModules({ kind: 'subproject', active: false }), { plan: true, basic: true, readOnly: true }, 'inactive subproject information remains visible and read-only')
assert.equal(typeof rules.resolveTechnicalPlanSummary, 'function', 'technical plan summaries expose an executable published-only resolver')
const publishedSummary = rules.resolveTechnicalPlanSummary([
  { id: 'draft-v3', templateType: 'tdt', status: '修订中', versionNo: 'V3', tasks: [{ ...validStages[0], actualStartDate: '2026-01-01', actualEndDate: '2026-01-31' }] },
  { id: 'published-v2-early', templateType: 'tdt', status: '已发布', versionNo: 'V2', publishedAt: '2026-02-01T00:00:00Z', tasks: validStages },
  { id: 'published-v1-late', templateType: 'tdt', status: '已发布', versionNo: 'V1', publishedAt: '2026-12-01T00:00:00Z', tasks: validStages },
  {
    id: 'published-v2-latest', templateType: 'tdt', status: '已发布', versionNo: 'V2', publishedAt: '2026-03-01T00:00:00Z',
    tasks: [
      { ...validStages[0], actualStartDate: '2026-01-02', actualEndDate: '2026-01-18' },
      { ...validStages[1], actualStartDate: '2026-01-03', actualEndDate: '2026-01-20' },
    ],
  },
])
assert.deepEqual(publishedSummary.versions.map(version => version.id), ['published-v2-latest', 'published-v2-early', 'published-v1-late'], 'summary excludes drafts and orders published versions by semantic version then publication time')
assert.equal(publishedSummary.latestVersion.id, 'published-v2-latest', 'the latest published version owns summary headers and actual data')
assert.equal(publishedSummary.actualRow.cycleDays, 18, 'actual cycle spans the latest published actual start and completion dates')
assert.equal(publishedSummary.actualRow.endDatesByTaskId['child-ignored'], '2026-01-20', 'actual row exposes milestone actual completion dates')
assert.equal(rules.resolveTechnicalPlanSummary([{ id: 'empty', templateType: 'tdt', status: '已发布', versionNo: 'V1', tasks: [] }]).hasTaskData, false, 'published versions without tasks produce the no-plan-data state')
assert.equal(rules.resolveTechnicalPlanSummary([{ id: 'draft-only', templateType: 'tdt', status: '修订中', versionNo: 'V9', tasks: validStages }]).latestVersion, undefined, 'draft-only scopes produce the no-published-version state')

assert.deepEqual(constants.TECHNICAL_TEAM_FIELDS.map(field => field.label), ['技术项目负责人', '技术项目经理', '测试代表', '质量代表', '产品代表', '标准化代表'], 'technical information fixed team labels remain exact')
assert.deepEqual(constants.TECHNICAL_DELIVERABLE_FIELDS.map(field => field.label), ['项目KPI文件', '概设', 'charter报告', 'PDCP报告', 'TDCP报告', 'EDCP报告'], 'technical deliverable labels remain exact')
const technicalInformationViewPath = 'src/components/technical-project/TechnicalProjectInformationView.tsx'
assert.equal(fs.existsSync(`${root}/${technicalInformationViewPath}`), true, 'technical information uses the shared information-frame component')
const technicalInformationView = readSource(root, technicalInformationViewPath)
const parseTsx = (source, fileName) => ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const technicalInformationSourceFile = parseTsx(technicalInformationView, technicalInformationViewPath)
const hasExportModifier = node => node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)
const findExportedFunction = (sourceFile, name) => sourceFile.statements.find(statement => (
  ts.isFunctionDeclaration(statement) && statement.name?.text === name && hasExportModifier(statement)
))
const importsComponent = (sourceFile, name, modulePath) => sourceFile.statements.some(statement => {
  if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || statement.moduleSpecifier.text !== modulePath) return false
  const clause = statement.importClause
  if (clause?.name?.text === name) return true
  return Boolean(clause?.namedBindings && ts.isNamedImports(clause.namedBindings) && clause.namedBindings.elements.some(element => element.name.text === name))
})
const collectBindings = sourceFile => {
  const bindings = new Map()
  const walk = node => {
    if (ts.isFunctionDeclaration(node) && node.name) bindings.set(node.name.text, node)
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) bindings.set(node.name.text, node.initializer)
    ts.forEachChild(node, walk)
  }
  walk(sourceFile)
  return bindings
}
const returnedExpressions = functionLike => {
  if (!ts.isBlock(functionLike.body)) return [functionLike.body]
  const returns = []
  const walk = node => {
    if (node !== functionLike.body && ts.isFunctionLike(node)) return
    if (ts.isReturnStatement(node) && node.expression) returns.push(node.expression)
    else ts.forEachChild(node, walk)
  }
  walk(functionLike.body)
  return returns
}
const collectReachableFromRoots = (sourceFile, roots) => {
  const bindings = collectBindings(sourceFile)
  const nodes = []
  const seen = new Set()
  const walk = node => {
    if (!node || seen.has(node)) return
    seen.add(node)
    nodes.push(node)
    if (ts.isIdentifier(node) && bindings.has(node.text)) {
      const binding = bindings.get(node.text)
      if (ts.isFunctionLike(binding)) returnedExpressions(binding).forEach(walk)
      else walk(binding)
    }
    ts.forEachChild(node, walk)
  }
  roots.forEach(walk)
  return nodes
}
const collectReachableNodes = (sourceFile, component) => collectReachableFromRoots(sourceFile, returnedExpressions(component))
const jsxTagName = (node, sourceFile) => {
  if (ts.isJsxElement(node)) return node.openingElement.tagName.getText(sourceFile)
  if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) return node.tagName.getText(sourceFile)
  return ''
}
const liveJsxMounts = (nodes, sourceFile, name) => nodes.filter(node => (
  (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && jsxTagName(node, sourceFile) === name
))
const jsxAttribute = (node, name) => node.attributes.properties.find(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText() === name)
const staticJsxAttributeText = attribute => {
  if (!attribute?.initializer) return ''
  if (ts.isStringLiteral(attribute.initializer)) return attribute.initializer.text
  if (ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression) return attribute.initializer.expression.getText()
  return ''
}
const containsCall = (node, methodName) => {
  let found = false
  const walk = child => {
    if (ts.isCallExpression(child) && ts.isPropertyAccessExpression(child.expression) && child.expression.name.text === methodName) found = true
    if (!found) ts.forEachChild(child, walk)
  }
  walk(node)
  return found
}
const activeComponent = findExportedFunction(technicalInformationSourceFile, 'TechnicalProjectInformationView')
assert.ok(activeComponent, 'technical information checks bind to the exported live component')
const technicalInformationReachableNodes = collectReachableNodes(technicalInformationSourceFile, activeComponent)
for (const [name, modulePath] of [
  ['ProjectInformationFrame', '@/components/project-info/ProjectInformationFrame'],
  ['TechnicalPlanSummary', '@/components/technical-project/TechnicalPlanSummary'],
  ['SubprojectConfigModal', '@/components/technical-project/SubprojectConfigModal'],
]) {
  assert.equal(importsComponent(technicalInformationSourceFile, name, modulePath), true, `technical information imports ${name} from its canonical module`)
  assert.equal(liveJsxMounts(technicalInformationReachableNodes, technicalInformationSourceFile, name).length, 1, `the live technical information return tree mounts ${name}`)
}
const basicInfoMounts = liveJsxMounts(technicalInformationReachableNodes, technicalInformationSourceFile, 'TechnicalProjectBasicInfo')
const inlineBasicInfoMounts = technicalInformationReachableNodes.filter(node => (
  (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node))
  && staticJsxAttributeText(jsxAttribute(node, 'data-section')) === 'technical-basic-information'
))
assert.equal(basicInfoMounts.length + inlineBasicInfoMounts.length, 1, 'technical information has exactly one live basic-information region')
if (basicInfoMounts.length) {
  assert.equal(basicInfoMounts.length, 1, 'technical information mounts one basic-information child')
  assert.equal(importsComponent(technicalInformationSourceFile, 'TechnicalProjectBasicInfo', '@/components/technical-project/TechnicalProjectBasicInfo'), true, 'technical information imports its mounted basic-information child from the canonical module')
  const basicInfoSource = readSource(root, 'src/components/technical-project/TechnicalProjectBasicInfo.tsx')
  const basicInfoSourceFile = parseTsx(basicInfoSource, 'TechnicalProjectBasicInfo.tsx')
  const basicInfoComponent = findExportedFunction(basicInfoSourceFile, 'TechnicalProjectBasicInfo')
  assert.ok(basicInfoComponent, 'mounted technical basic information resolves to its exported live component')
  const basicReachableNodes = collectReachableNodes(basicInfoSourceFile, basicInfoComponent)
  assert.equal(importsComponent(basicInfoSourceFile, 'CollapsibleInformationSection', '@/components/project-info/CollapsibleInformationSection'), true, 'mounted basic information imports the shared collapsible section canonically')
  assert.equal(liveJsxMounts(basicReachableNodes, basicInfoSourceFile, 'CollapsibleInformationSection').length, 1, 'mounted basic information renders its collapsible section')
  assert.ok(basicReachableNodes.some(node => node.getText(basicInfoSourceFile).includes('pms-project-info-display-grid')), 'mounted basic information reuses the whole-machine field grid')
  assert.doesNotMatch(basicInfoSource, /该子任务已停用/, 'inactive-only feedback is removed with the inactive display feature')
} else {
  assert.equal(inlineBasicInfoMounts.length, 1, 'inline basic information exposes one live technical-basic-information region')
}
const basicInfoMount = basicInfoMounts[0] || inlineBasicInfoMounts[0]
const subprojectGuard = (() => {
  let node = basicInfoMount.parent
  while (node && node !== activeComponent) {
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      const left = node.left
      if (ts.isBinaryExpression(left) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken].includes(left.operatorToken.kind)) {
        const pairs = [[left.left, left.right], [left.right, left.left]]
        if (pairs.some(([field, value]) => field.getText(technicalInformationSourceFile) === 'activeTab.kind' && ts.isStringLiteral(value) && value.text === 'subproject')) return node
      }
    }
    node = node.parent
  }
  return undefined
})()
assert.ok(subprojectGuard, 'the sole live basic-information mount is structurally guarded by activeTab.kind === subproject')
for (const title of ['团队信息', '交付物信息']) {
  assert.ok(technicalInformationReachableNodes.some(node => (
    (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node))
    && jsxTagName(node, technicalInformationSourceFile) === 'CollapsibleInformationSection'
    && staticJsxAttributeText(jsxAttribute(node, 'title')) === title
  )), `${title} is carried by a live collapsible information section`)
}
assert.match(technicalInformationView, /label:\s*'项目名称'[\s\S]*label:\s*'项目分类'[\s\S]*label:\s*'技术赛道'[\s\S]*label:\s*'TMG及技术领域'[\s\S]*label:\s*'子领域'[\s\S]*label:\s*'项目阶段'[\s\S]*label:\s*'项目年份'[\s\S]*label:\s*'项目价值'/, 'technical core fields retain their approved order')
assert.doesNotMatch(technicalInformationView, /label:\s*'前置项目'/, 'optional predecessor is editable but excluded from the core information block')
assert.match(technicalInformationView, /label:\s*'项目价值'[^\n]*fullWidth:\s*true/, 'technical project value owns a full-width row')
assert.match(technicalInformationView, /sessionStorage\.getItem\(['"]pms:technical-project-list-target-child['"]\)/, 'technical information consumes workbench child targeting')
assert.match(technicalInformationView, /const targetChildId[\s\S]{0,360}sessionStorage\.removeItem\(['"]pms:technical-project-list-target-child['"]\)[\s\S]{0,160}if \(!target\) return/, 'technical information consumes the one-shot workbench target even when it does not belong to this project')
assert.match(technicalInformationView, /aria-label="技术信息分类"/, 'technical information tab classification has a stable accessible label')
assert.match(technicalInformationView, /aria-label="技术信息内容"/, 'technical information content has a stable accessible label')
assert.match(technicalInformationView, /className="pms-project-info-empty">未配置</, 'empty team roles use the shared unconfigured wording')
const technicalPlanSummary = readSource(root, 'src/components/technical-project/TechnicalPlanSummary.tsx')
assert.match(technicalPlanSummary, /useTechnicalPlanStore/, 'technical plan summary reads the scoped plan instance')
assert.match(technicalPlanSummary, /title=\{[\s\S]{0,180}计划信息/, 'technical summary uses the same plan-information card title as whole-machine projects')
assert.doesNotMatch(technicalPlanSummary, /计划摘要/, 'technical plan header no longer prefixes the active tab name')
assert.match(technicalPlanSummary, /暂无计划版本/, 'technical plan summary uses one empty state when no published version exists')
assert.match(technicalPlanSummary, /暂无计划数据/, 'technical plan summary does not render an empty milestone table')
assert.match(technicalPlanSummary, /actualRow[\s\S]*actualEndDate|actualEndDate[\s\S]*actualRow/, 'technical plan summary renders the published actual completion row')
assert.match(technicalPlanSummary, /TECHNICAL_STAGE_COLORS[\s\S]*borderBottom:[\s\S]*stageColor/, 'technical plan summary reuses the whole-machine colored stage header treatment')
assert.match(technicalPlanSummary, /technical-plan-summary-sticky-version[\s\S]*technical-plan-summary-sticky-cycle/, 'technical plan summary keeps version and cycle columns fixed like whole-machine plan information')
assert.doesNotMatch(technicalPlanSummary, /<Tag|已发布<\/Tag>/, 'technical plan summary does not add status tags absent from the whole-machine summary')
assert.match(technicalPlanSummary, /const displayCycle = \(days: number \| null\) => days === null \? '-' : days/, 'technical plan summary displays cycle values without a divergent unit suffix')
assert.doesNotMatch(technicalPlanSummary, /createRevision|创建修订|编辑/, 'technical plan summary is read-only and cannot create or edit plans')
const projectInformationFrame = readSource(root, 'src/components/project-info/ProjectInformationFrame.tsx')
assert.match(projectInformationFrame, /resolveProjectInformationCoreColumnCount\(coreFields\)/, 'the live shared frame derives columns from non-full-width fields')
assert.match(projectInformationFrame, /Math\.min\(8, Math\.max\(1, fields\.filter\(field => !field\.fullWidth\)\.length\)\)/, 'the live shared frame excludes full-width fields and bounds desktop columns at eight')
assert.doesNotMatch(projectInformationFrame, /repeat\(\$\{coreFields\.length\}/, 'the live shared frame does not count full-width fields as desktop columns')
const globalStyles = readSource(root, 'src/styles/globals.css')
assert.match(globalStyles, /grid-template-columns:\s*repeat\(var\(--pms-project-info-core-columns/, 'the core grid consumes the bounded live column count')
assert.doesNotMatch(technicalInformationView, /显示已停用|showInactive|Switch/, 'technical basic information no longer exposes inactive children')
assert.doesNotMatch(technicalInformationView, /暂无交付物/, 'deliverable cards do not append a redundant empty state')
const configButton = technicalInformationReachableNodes.find(node => (
  (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node))
  && jsxTagName(node, technicalInformationSourceFile) === 'Button'
  && staticJsxAttributeText(jsxAttribute(node, 'aria-label')).includes('配置子任务')
))
assert.ok(configButton, 'the live technical information tree renders the child configuration button')
const configClick = jsxAttribute(configButton, 'onClick')
assert.ok(configClick?.initializer && ts.isJsxExpression(configClick.initializer) && configClick.initializer.expression, 'child configuration button owns a concrete click handler')
const configHandler = configClick.initializer.expression
const configHandlerReachableNodes = collectReachableFromRoots(technicalInformationSourceFile, [configHandler])
assert.equal(configHandlerReachableNodes.some(node => containsCall(node, 'preventDefault')), true, 'child configuration click prevents tab activation')
assert.equal(configHandlerReachableNodes.some(node => containsCall(node, 'stopPropagation')), true, 'child configuration click stops tab propagation')
assert.ok(configHandlerReachableNodes.some(node => node.getText(technicalInformationSourceFile).includes('setConfiguringChild')), 'child configuration click opens the mounted modal state')
const configModalMount = liveJsxMounts(technicalInformationReachableNodes, technicalInformationSourceFile, 'SubprojectConfigModal')[0]
assert.ok(staticJsxAttributeText(jsxAttribute(configModalMount, 'open')).includes('configuringChild'), 'mounted configuration modal consumes the state opened by its button')
const createFields = readSource(root, 'src/components/technical-project/TechnicalProjectCreateFields.tsx')
assert.match(createFields, /Input\.TextArea[\s\S]{0,220}onPressEnter=\{event\s*=>\s*event\.stopPropagation\(\)\}/, 'Enter inside project-value textarea cannot bubble into modal submit')
const technicalPlan = readSource(root, 'src/components/technical-project/TechnicalPlanModule.tsx')
assert.doesNotMatch(technicalPlan, /显示已停用|showInactive|Switch/, 'technical plan scope tabs also omit inactive subprojects')
const planViewModeSwitcher = readSource(root, 'src/components/plans/PlanViewModeSwitcher.tsx')
const planVersionCompareModal = readSource(root, 'src/components/plans/PlanVersionCompareModal.tsx')
const planHelpers = readSource(root, 'src/components/shared/PlanHelpers.tsx')
assert.match(planHelpers, /<Tooltip\s+title="拖拽排序"/, 'drag icon exposes its action in a tooltip')
assert.match(planHelpers, /<button[^>]*aria-label="拖拽排序"/, 'drag icon is a named native control')
assert.match(technicalPlan, /event\.preventDefault\(\)[\s\S]{0,100}event\.stopPropagation\(\)[\s\S]{0,120}setConfiguringChild/, 'plan tab configuration is isolated from tab activation')
for (const label of ['新增二级任务', '删除任务', '版本对比']) {
  assert.match(technicalPlan, new RegExp(`aria-label=[^\\n]{0,80}${label}`), `${label} icon control has an accessible name`)
  assert.match(technicalPlan, new RegExp(`<Tooltip\\s+title=[^\\n]{0,80}${label}`), `${label} icon control has a tooltip`)
}
for (const label of ['竖版表格', '横版表格', '甘特图']) {
  assert.match(planViewModeSwitcher, new RegExp(`label:\\s*['"]${label}['"]`), `${label} is configured in the shared view switcher`)
}
assert.match(planViewModeSwitcher, /aria-label=\{option\.label\}/, 'shared view icon controls derive their accessible names from the configured labels')
assert.match(planViewModeSwitcher, /<Tooltip\s+title=\{title\}/, 'shared view icon controls expose their labels in tooltips')
assert.match(technicalPlan, /<PlanWorkspaceShell\b/, 'technical plan delegates the wide toolbar to the shared workspace shell')
assert.match(technicalPlan, /当前账号无计划编辑权限，仅可查看计划/, 'technical plan explains read-only permission state')
assert.match(planVersionCompareModal, /scroll=\{\{\s*x:\s*1200,\s*y:\s*420\s*\}\}/, 'shared version comparison table scrolls internally')
const overlayInteraction = readSource(root, 'src/hooks/useOverlayInteraction.ts')
assert.match(overlayInteraction, /tryBeginSubmit/, 'shared overlay helper provides a synchronous submission lock')
assert.match(overlayInteraction, /restoreTriggerFocus/, 'shared overlay helper restores focus to its opener')
const projectSpace = readSource(root, 'src/containers/ProjectSpaceContainer.tsx')
assert.match(projectSpace, /<TechnicalProjectInformationView\b/, 'project space mounts the shared-frame technical information view')
assert.doesNotMatch(projectSpace, /<TechnicalProjectOverview\b/, 'technical overview no longer duplicates information-page ownership')
assert.match(projectSpace, /useTechnicalPlanStore/, 'project stage subscribes to real keyed technical-plan state')
assert.doesNotMatch(projectSpace, /selectedProject[^\n]*technicalPlanVersions|technicalPlanVersions[^\n]*selectedProject/, 'project objects are not used as an imaginary technical-plan state source')
assert.equal(fs.existsSync(`${root}/src/stores/technicalPlan.ts`), true, 'technical plan keyed store exists')
const technicalPlanStore = loadTypeScriptModule(root, 'src/stores/technicalPlan.ts')
assert.equal(technicalPlanStore.getTechnicalPlanKey({ kind: 'tdt', parentProjectId: '9' }), '9:tdt', 'TDT plan key is stable and Task11-compatible')
const latestTdt = technicalPlanStore.selectLatestPublishedTechnicalPlanVersion(technicalPlanStore.INITIAL_TECHNICAL_PLANS, '9')
assert.equal(latestTdt?.status, '已发布', 'selector exposes a representative real published TDT plan')
assert.notEqual(technicalPlanStore.selectTechnicalProjectStage(technicalPlanStore.INITIAL_TECHNICAL_PLANS, '9', '2026-07-15'), '-', 'real keyed plan state drives a visible stage')
console.log('technical project contract passed')
