#!/usr/bin/env node
import assert from 'node:assert/strict'
import { loadTypeScriptModule, projectRoot, readSource } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const rules = loadTypeScriptModule(root, 'src/lib/technicalProjectRules.ts')
const constants = loadTypeScriptModule(root, 'src/constants/technicalProject.ts')
for (const name of ['resolveTechnicalProjectFields', 'validateTechnicalProject', 'synchronizeTechnicalSubprojects', 'isTechnicalSubprojectConfigured', 'canCreateSubprojectPlanRevision', 'switchDeliverableMode', 'normalizeTechnicalProjectValues', 'synchronizeTechnicalProjectRecord', 'calculateTechnicalProjectStage', 'resolveLatestPublishedTechnicalProjectStage']) assert.equal(typeof rules[name], 'function', `missing ${name}`)
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

const overview = readSource(root, 'src/components/technical-project/TechnicalProjectOverview.tsx')
assert.match(overview, /项目价值/, 'technical overview renders the full-width project value')
assert.match(overview, /TECHNICAL_TEAM_FIELDS/, 'technical overview renders the exact six fixed team roles from the shared schema')
assert.deepEqual(constants.TECHNICAL_TEAM_FIELDS.map(field => field.label), ['技术项目负责人', '技术项目经理', '测试代表', '质量代表', '产品代表', '标准化代表'], 'technical overview fixed team labels remain exact')
assert.match(overview, /TECHNICAL_DELIVERABLE_FIELDS/, 'technical overview renders all deliverables from the shared schema')
assert.deepEqual(constants.TECHNICAL_DELIVERABLE_FIELDS.map(field => field.label), ['项目KPI文件', '概设', 'charter报告', 'PDCP报告', 'TDCP报告', 'EDCP报告'], 'technical deliverable labels remain exact')
const basicInfo = readSource(root, 'src/components/technical-project/TechnicalProjectBasicInfo.tsx')
assert.match(basicInfo, /显示已停用/, 'technical basic information can reveal inactive children')
assert.match(basicInfo, /SubprojectConfigModal/, 'active child tabs mount the configuration modal')
assert.doesNotMatch(basicInfo, /TDT项目计划/, 'TDT is not a technical basic-information tab')
const projectSpace = readSource(root, 'src/containers/ProjectSpaceContainer.tsx')
assert.match(projectSpace, /<TechnicalProjectOverview/, 'project space mounts the focused technical overview')
assert.match(projectSpace, /<TechnicalProjectBasicInfo/, 'project space mounts focused child-only basic information')
console.log('technical project contract passed')
