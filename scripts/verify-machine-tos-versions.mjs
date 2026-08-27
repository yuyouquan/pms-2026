#!/usr/bin/env node
import assert from 'node:assert/strict'
import { loadTypeScriptModule, projectRoot, readSource } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const rules = loadTypeScriptModule(root, 'src/lib/machineTosVersions.ts')
const projectInfoRules = loadTypeScriptModule(root, 'src/lib/projectInfoRules.ts')
const projectStore = loadTypeScriptModule(root, 'src/stores/project.ts')
const roadmapStore = loadTypeScriptModule(root, 'src/stores/roadmap.ts')
const roadmapAdapter = loadTypeScriptModule(root, 'src/lib/roadmapProjectAdapter.ts')

const newMachine = {
  id: 'new',
  name: 'X6870',
  type: '整机产品项目',
  productType: '新品',
  firstSaleTosVersion: '14.0.0',
  currentTosVersion: '',
}
const oldMachine = {
  id: 'old',
  name: ' X6870 ',
  type: '整机产品项目',
  productType: '老品',
  firstSaleTosVersion: '',
  currentTosVersion: '15.0.0',
}

assert.equal(rules.normalizeMachineFamilyName('  X6870  '), 'X6870', 'family matching trims surrounding whitespace')
assert.notEqual(rules.normalizeMachineFamilyName('x6870'), rules.normalizeMachineFamilyName('X6870'), 'family matching remains case-sensitive')
assert.ok(rules.compareThreePartVersions('17.10.0', '17.2.0') > 0, 'three-part versions sort numerically')
assert.ok(Number.isNaN(rules.compareThreePartVersions('14.0', '14.0.0')), 'two-part versions are invalid')

assert.deepEqual(rules.resolveMachineTosUpdate([], newMachine), {
  ok: true,
  candidate: { ...newMachine, firstSaleTosVersion: '14.0.0', currentTosVersion: '14.0.0' },
  updates: [],
}, 'new machine initializes current from first sale')

assert.deepEqual(rules.resolveMachineTosUpdate([newMachine], oldMachine), {
  ok: true,
  candidate: { ...oldMachine, firstSaleTosVersion: '14.0.0', currentTosVersion: '15.0.0' },
  updates: [{ id: 'new', currentTosVersion: '15.0.0' }],
}, 'legacy inherits first sale and raises only its unique new machine')

const laterOld = { ...oldMachine, id: 'old-2', name: 'X6870', currentTosVersion: '17.10.0' }
assert.deepEqual(rules.resolveMachineTosUpdate([newMachine, oldMachine], laterOld), {
  ok: true,
  candidate: { ...laterOld, firstSaleTosVersion: '14.0.0', currentTosVersion: '17.10.0' },
  updates: [{ id: 'new', currentTosVersion: '17.10.0' }],
}, 'same-name legacy current uses the semantic maximum without rewriting history')

assert.deepEqual(rules.resolveMachineTosUpdate([], oldMachine), { ok: false, reason: 'missing-new-product' })
assert.deepEqual(
  rules.resolveMachineTosUpdate([newMachine, { ...newMachine, id: 'new-2' }], oldMachine),
  { ok: false, reason: 'duplicate-new-product' },
)
assert.deepEqual(
  rules.resolveMachineTosUpdate([newMachine], { ...newMachine, id: 'new-2' }),
  { ok: false, reason: 'duplicate-new-product' },
  'creating a duplicate same-name new machine is rejected',
)
assert.deepEqual(
  rules.resolveMachineTosUpdate([], { ...newMachine, firstSaleTosVersion: 'bad' }),
  { ok: false, reason: 'invalid-version' },
)

const otherNew = { ...newMachine, id: 'other-new', name: 'X6880', firstSaleTosVersion: '16.0.0' }
assert.deepEqual(
  rules.resolveMachineTosUpdate([newMachine, otherNew], { ...otherNew, name: ' X6870 ' }),
  { ok: false, reason: 'duplicate-new-product' },
  'renaming a new machine into another exact trimmed new family is rejected',
)
assert.deepEqual(
  rules.resolveMachineTosUpdate([newMachine, otherNew], oldMachine).updates,
  [{ id: 'new', currentTosVersion: '15.0.0' }],
  'an old-machine save does not update unrelated new machines',
)

const historicalNew = { ...newMachine, firstSaleTosVersion: '13.0.0', currentTosVersion: '17.10.0' }
const editedOld = { ...oldMachine, currentTosVersion: '15.0.0' }
assert.deepEqual(rules.resolveMachineTosUpdate([historicalNew, editedOld], editedOld), {
  ok: true,
  candidate: { ...editedOld, firstSaleTosVersion: '13.0.0', currentTosVersion: '15.0.0' },
  updates: [{ id: 'new', currentTosVersion: '15.0.0' }],
}, 'a retired historical version remains valid while recomputing existing records')

const oldFamilyNew = { ...newMachine, id: 'old-family-new', name: 'OLD', currentTosVersion: '17.10.0' }
const movingOld = { ...oldMachine, id: 'moving', name: 'OLD', firstSaleTosVersion: '14.0.0', currentTosVersion: '17.10.0' }
const renamedOld = { ...movingOld, name: 'X6870', currentTosVersion: '15.0.0' }
assert.deepEqual(rules.resolveMachineTosUpdate([newMachine, oldFamilyNew, movingOld], renamedOld), {
  ok: true,
  candidate: { ...renamedOld, firstSaleTosVersion: '14.0.0', currentTosVersion: '15.0.0' },
  updates: [
    { id: 'old-family-new', currentTosVersion: '14.0.0' },
    { id: 'new', currentTosVersion: '15.0.0' },
  ],
}, 'renaming an old machine recomputes both old and new affected families')

assert.deepEqual(
  projectInfoRules.deriveProjectResponsiblePersons('整机产品项目', { machineSpm: ['李白'] }, ['手填人']),
  ['李白'],
  'whole-machine responsibility derives from SPM',
)
assert.deepEqual(
  projectInfoRules.deriveProjectResponsiblePersons('tOS版本项目', { tosVersionProjectManager: ['李四'] }, ['手填人']),
  ['李四'],
  'tOS responsibility derives from version project manager',
)
assert.deepEqual(
  projectInfoRules.deriveProjectResponsiblePersons('能力建设项目', {}, ['手填人']),
  ['手填人'],
  'capability responsibility stays manual',
)
assert.equal(
  projectInfoRules.deriveProjectTosVersion('tOS版本项目', '  tOS19.0 RC  ', 'old'),
  'tOS19.0 RC',
  'tOS project version reads the trimmed project name verbatim',
)

const persistedMachineBase = {
  id: 'persisted-machine',
  name: 'X6870',
  type: '整机产品项目',
  productType: '新品',
}
const migratedMachineState = projectStore.migrateProjectState({ projects: [
  {
    ...persistedMachineBase,
    firstSaleTosVersionId: 'tos-16-3',
    currentTosVersion: 'tOS14.0',
    fieldValues: { firstSaleTosVersion: 'tOS16.3', currentTosVersion: '14.0' },
  },
  {
    ...persistedMachineBase,
    id: 'persisted-three-part',
    firstSaleTosVersionId: 'tOS17.10.0',
    currentTosVersion: 'tOS17.10.0',
  },
  {
    ...persistedMachineBase,
    id: 'persisted-unknown',
    firstSaleTosVersionId: 'future-version',
    currentTosVersion: 'future-current',
  },
  {
    ...persistedMachineBase,
    id: 'persisted-legacy-product-type',
    productType: '升级',
    firstSaleTosVersionId: '14.0',
    currentTosVersion: '15.0',
  },
  {
    id: 'persisted-unique-source-name',
    name: 'tOS19.0',
    type: 'tOS版本项目',
  },
  {
    ...persistedMachineBase,
    id: 'persisted-explicit-source',
    sourceBid: 'EXTERNAL-KEEP',
  },
] }, 2)
assert.deepEqual(
  migratedMachineState.projects
    .filter(project => project.id.startsWith('persisted-'))
    .map(project => ({
    id: project.id,
    productType: project.productType,
    first: project.firstSaleTosVersionId,
    current: project.currentTosVersion,
    fieldFirst: project.fieldValues?.firstSaleTosVersion,
    fieldCurrent: project.fieldValues?.currentTosVersion,
    sourceBid: project.sourceBid,
    })),
  [
    { id: 'persisted-machine', productType: '新品', first: '16.3.0', current: '14.0.0', fieldFirst: '16.3.0', fieldCurrent: '14.0.0', sourceBid: undefined },
    { id: 'persisted-three-part', productType: '新品', first: '17.10.0', current: '17.10.0', fieldFirst: undefined, fieldCurrent: undefined, sourceBid: undefined },
    { id: 'persisted-unknown', productType: '新品', first: 'future-version', current: 'future-current', fieldFirst: undefined, fieldCurrent: undefined, sourceBid: undefined },
    { id: 'persisted-legacy-product-type', productType: '老品', first: '14.0.0', current: '15.0.0', fieldFirst: undefined, fieldCurrent: undefined, sourceBid: undefined },
    { id: 'persisted-unique-source-name', productType: undefined, first: undefined, current: undefined, fieldFirst: undefined, fieldCurrent: undefined, sourceBid: 'EXT-003' },
    { id: 'persisted-explicit-source', productType: '新品', first: undefined, current: undefined, fieldFirst: undefined, fieldCurrent: undefined, sourceBid: 'EXTERNAL-KEEP' },
  ],
  'persisted two-part references migrate to canonical three-part values without clearing unknown display history',
)
assert.deepEqual(
  projectStore.migrateProjectState(migratedMachineState, projectStore.PROJECT_STORE_VERSION),
  migratedMachineState,
  'machine version persistence migration is idempotent',
)

const deleteNew = {
  ...newMachine,
  id: 'delete-new',
  currentTosVersion: '17.10.0',
}
const deleteLegacy15 = {
  ...oldMachine,
  id: 'delete-old-15',
  name: 'X6870',
  firstSaleTosVersion: '14.0.0',
  currentTosVersion: '15.0.0',
}
const deleteLegacy17 = {
  ...oldMachine,
  id: 'delete-old-17',
  name: 'X6870',
  firstSaleTosVersion: '14.0.0',
  currentTosVersion: '17.10.0',
}

const deleteFixture = (projects, projectId, selectedProject = null) => {
  projectStore.useProjectStore.setState({ projects, selectedProject })
  const auditLogs = roadmapStore.useRoadmapStore.getState().changeLogs
  let projectStoreNotifications = 0
  const unsubscribe = projectStore.useProjectStore.subscribe(() => {
    projectStoreNotifications += 1
  })
  const deleted = projectStore.useProjectStore.getState().deleteProject(projectId, '张三')
  unsubscribe()
  return {
    deleted,
    projectStoreNotifications,
    projects: projectStore.useProjectStore.getState().projects,
    selectedProject: projectStore.useProjectStore.getState().selectedProject,
    auditLogsBefore: auditLogs,
    auditLogsAfter: roadmapStore.useRoadmapStore.getState().changeLogs,
  }
}

const withoutMaximumLegacy = deleteFixture(
  [deleteNew, deleteLegacy15, deleteLegacy17],
  deleteLegacy17.id,
)
assert.deepEqual(
  withoutMaximumLegacy.projects.map(project => ({ id: project.id, current: project.currentTosVersion })),
  [
    { id: deleteNew.id, current: '15.0.0' },
    { id: deleteLegacy15.id, current: '15.0.0' },
  ],
  'deleting the greatest legacy version recomputes its unique new machine from remaining legacy history',
)
assert.equal(withoutMaximumLegacy.projectStoreNotifications, 1, 'legacy deletion and new-machine recompute are one project-store transaction')

const withoutLastLegacy = deleteFixture([deleteNew, deleteLegacy15], deleteLegacy15.id)
assert.deepEqual(
  withoutLastLegacy.projects.map(project => ({ id: project.id, current: project.currentTosVersion })),
  [{ id: deleteNew.id, current: '14.0.0' }],
  'deleting the last legacy version resets its unique new machine current to first sale',
)
assert.equal(withoutLastLegacy.projectStoreNotifications, 1, 'last legacy deletion and reset are one project-store transaction')

const withoutNonMaximumLegacy = deleteFixture(
  [deleteNew, deleteLegacy15, deleteLegacy17],
  deleteLegacy15.id,
)
assert.deepEqual(
  withoutNonMaximumLegacy.projects.map(project => ({ id: project.id, current: project.currentTosVersion })),
  [
    { id: deleteNew.id, current: '17.10.0' },
    { id: deleteLegacy17.id, current: '17.10.0' },
  ],
  'deleting a non-maximum legacy version preserves the family maximum',
)
assert.equal(withoutNonMaximumLegacy.projectStoreNotifications, 1, 'non-maximum legacy deletion remains one project-store transaction')

const deletingNewKeepsLegacyHistory = deleteFixture(
  [deleteNew, deleteLegacy15, deleteLegacy17],
  deleteNew.id,
)
assert.deepEqual(
  deletingNewKeepsLegacyHistory.projects.map(project => ({ id: project.id, current: project.currentTosVersion })),
  [
    { id: deleteLegacy15.id, current: '15.0.0' },
    { id: deleteLegacy17.id, current: '17.10.0' },
  ],
  'deleting a new machine preserves legacy history',
)

const beforeUnknownDelete = [deleteNew, deleteLegacy15]
const unknownDelete = deleteFixture(beforeUnknownDelete, 'missing-project')
assert.equal(unknownDelete.deleted, false, 'unknown project deletion still returns false')
assert.equal(unknownDelete.projects, beforeUnknownDelete, 'unknown project deletion keeps the same project collection')
assert.equal(unknownDelete.projectStoreNotifications, 0, 'unknown project deletion does not emit a project-store transaction')

const auditedLegacyToDelete = {
  ...deleteLegacy17,
  id: 'delete-audited-legacy',
  secondaryCategory: '整机-手机',
  projectCode: 'X6870',
  androidVersion: 'Android 18',
  brand: 'TECNO',
  startRam: '8GB',
  versionType: 'Full',
  developMode: '自研',
}
const unknownRemainingLegacy = {
  ...deleteLegacy15,
  id: 'remaining-unknown-legacy',
  currentTosVersion: 'future-current',
}
const invalidHistoryProjects = [deleteNew, auditedLegacyToDelete, unknownRemainingLegacy]
const invalidHistoryDelete = deleteFixture(
  invalidHistoryProjects,
  auditedLegacyToDelete.id,
  deleteNew,
)
assert.equal(invalidHistoryDelete.deleted, false, 'legacy deletion fails when required family recompute contains unknown history')
assert.equal(invalidHistoryDelete.projects, invalidHistoryProjects, 'failed legacy deletion preserves the original project collection')
assert.equal(invalidHistoryDelete.selectedProject, deleteNew, 'failed legacy deletion preserves selected project identity')
assert.equal(invalidHistoryDelete.auditLogsAfter, invalidHistoryDelete.auditLogsBefore, 'failed legacy deletion writes no audit log')
assert.equal(invalidHistoryDelete.projectStoreNotifications, 0, 'failed legacy deletion emits no project-store transaction')

const validMachineFields = {
  type: '整机产品项目',
  secondaryCategory: '整机-手机',
  status: '待立项',
  androidVersion: 'Android 18',
  brand: 'TECNO',
  startRam: '8GB',
  versionType: 'Full',
  developMode: '自研',
}
const validSourceNew = {
  ...validMachineFields,
  id: 'source-new',
  sourceBid: 'BID-NEW',
  name: 'SOURCE-X',
  projectCode: 'SOURCE-X',
  productType: '新品',
  firstSaleTosVersion: '14.0.0',
  currentTosVersion: '14.0.0',
}
const validSourceLegacy = {
  ...validMachineFields,
  id: 'source-old',
  sourceBid: 'BID-OLD',
  name: 'SOURCE-X',
  projectCode: 'SOURCE-X',
  productType: '老品',
  firstSaleTosVersion: '14.0.0',
  currentTosVersion: '15.0.0',
}

projectStore.useProjectStore.setState({ projects: [validSourceNew], selectedProject: validSourceNew })
let selectedSyncNotifications = 0
const unsubscribeSelectedSync = projectStore.useProjectStore.subscribe(() => {
  selectedSyncNotifications += 1
})
assert.equal(
  projectStore.useProjectStore.getState().addProject(validSourceLegacy, '张三', { allowedFirstSaleTosValues: ['14.0.0', '15.0.0'] }),
  true,
  'different source BIDs may create same-name linked new and legacy projects',
)
unsubscribeSelectedSync()
const selectedSyncState = projectStore.useProjectStore.getState()
const linkedNewAfterLegacy = selectedSyncState.projects.find(project => project.id === validSourceNew.id)
assert.equal(linkedNewAfterLegacy?.currentTosVersion, '15.0.0', 'legacy add recomputes its linked new machine')
assert.equal(selectedSyncState.selectedProject, linkedNewAfterLegacy, 'legacy add synchronizes selectedProject to the updated new project object')
assert.equal(selectedSyncNotifications, 1, 'legacy add and selectedProject synchronization are atomic')

const duplicateBidCandidate = {
  ...validSourceNew,
  id: 'duplicate-bid-candidate',
  name: 'OTHER-X',
  projectCode: 'OTHER-X',
}
const beforeDuplicateBidProjects = selectedSyncState.projects
let duplicateBidNotifications = 0
const unsubscribeDuplicateBid = projectStore.useProjectStore.subscribe(() => {
  duplicateBidNotifications += 1
})
assert.equal(
  projectStore.useProjectStore.getState().addProject(duplicateBidCandidate, '张三', { allowedFirstSaleTosValues: ['14.0.0'] }),
  false,
  'addProject rejects a reused non-empty source BID',
)
unsubscribeDuplicateBid()
assert.equal(projectStore.useProjectStore.getState().projects, beforeDuplicateBidProjects, 'duplicate BID add preserves projects identity')
assert.equal(duplicateBidNotifications, 0, 'duplicate BID add emits no project-store transaction')

const updateBidFixture = {
  ...validSourceNew,
  id: 'update-bid-fixture',
  sourceBid: 'BID-OTHER',
  name: 'UPDATE-X',
  projectCode: 'UPDATE-X',
}
projectStore.useProjectStore.setState({ projects: [validSourceNew, updateBidFixture], selectedProject: updateBidFixture })
const beforeDuplicateBidUpdate = projectStore.useProjectStore.getState().projects
assert.equal(
  projectStore.useProjectStore.getState().updateProject(updateBidFixture.id, { sourceBid: 'BID-NEW' }, '张三', { allowedFirstSaleTosValues: ['14.0.0'] }),
  null,
  'updateProject rejects another project source BID',
)
assert.equal(projectStore.useProjectStore.getState().projects, beforeDuplicateBidUpdate, 'duplicate BID update is atomic')

const duplicateDeleteNew = { ...deleteNew, id: 'duplicate-delete-new' }
const duplicateFamilyProjects = [deleteNew, duplicateDeleteNew, auditedLegacyToDelete]
const duplicateFamilyDelete = deleteFixture(
  duplicateFamilyProjects,
  auditedLegacyToDelete.id,
  deleteNew,
)
assert.equal(duplicateFamilyDelete.deleted, false, 'legacy deletion fails when the retained family has multiple new machines')
assert.equal(duplicateFamilyDelete.projects, duplicateFamilyProjects, 'duplicate-new deletion failure preserves projects identity')
assert.equal(duplicateFamilyDelete.selectedProject, deleteNew, 'duplicate-new deletion failure preserves selected project')
assert.equal(duplicateFamilyDelete.auditLogsAfter, duplicateFamilyDelete.auditLogsBefore, 'duplicate-new deletion failure writes no audit')
assert.equal(duplicateFamilyDelete.projectStoreNotifications, 0, 'duplicate-new deletion failure emits no project-store transaction')

const configurableSnapshotProject = {
  ...validSourceNew,
  id: 'configurable-snapshot-project',
  sourceBid: 'BID-CONFIG-SNAPSHOT',
  name: 'CONFIG-X',
  projectCode: 'CONFIG-X',
  versionType: '配置版本型',
  developMode: '实验室联合开发',
}
assert.deepEqual(
  {
    versionType: roadmapAdapter.adaptNormalProject(configurableSnapshotProject, [])?.versionType,
    developMode: roadmapAdapter.adaptNormalProject(configurableSnapshotProject, [])?.developMode,
  },
  { versionType: '配置版本型', developMode: '实验室联合开发' },
  'roadmap adaptation accepts current configured strings without a compile-time membership gate',
)
projectStore.useProjectStore.setState({ projects: [], selectedProject: null })
assert.equal(
  projectStore.useProjectStore.getState().addProject(configurableSnapshotProject, '张三', { allowedFirstSaleTosValues: ['14.0.0'] }),
  true,
  'machine create persists current configured version and development strings through the actual project store gate',
)
assert.deepEqual(
  projectStore.useProjectStore.getState().projects.map(project => ({ versionType: project.versionType, developMode: project.developMode })),
  [{ versionType: '配置版本型', developMode: '实验室联合开发' }],
  'machine create stores configured string snapshots unchanged',
)
const retiredSnapshotUpdate = projectStore.useProjectStore.getState().updateProject(
  configurableSnapshotProject.id,
  { versionType: '已停用版本型', developMode: '已停用开发模式' },
  '张三',
  { allowedFirstSaleTosValues: ['14.0.0'] },
)
assert.deepEqual(
  retiredSnapshotUpdate && {
    versionType: retiredSnapshotUpdate.versionType,
    developMode: retiredSnapshotUpdate.developMode,
  },
  { versionType: '已停用版本型', developMode: '已停用开发模式' },
  'machine update preserves unchanged retired string snapshots through the actual project store gate',
)
assert.deepEqual(
  retiredSnapshotUpdate && {
    versionType: roadmapAdapter.adaptNormalProject(retiredSnapshotUpdate, [])?.versionType,
    developMode: roadmapAdapter.adaptNormalProject(retiredSnapshotUpdate, [])?.developMode,
  },
  { versionType: '已停用版本型', developMode: '已停用开发模式' },
  'roadmap adaptation does not silently rewrite retired custom strings',
)
const unrelatedRetiredUpdate = projectStore.useProjectStore.getState().updateProject(
  configurableSnapshotProject.id,
  { projectManager: '李四' },
  '张三',
  { allowedFirstSaleTosValues: ['14.0.0'] },
)
assert.deepEqual(
  unrelatedRetiredUpdate && {
    versionType: unrelatedRetiredUpdate.versionType,
    developMode: unrelatedRetiredUpdate.developMode,
  },
  { versionType: '已停用版本型', developMode: '已停用开发模式' },
  'an unrelated update saves unchanged retired snapshots without a membership gate',
)
assert.equal(
  roadmapAdapter.adaptNormalProject({ ...configurableSnapshotProject, versionType: '   ' }, []),
  null,
  'widening version snapshots does not loosen the nonempty requirement',
)
assert.equal(
  roadmapAdapter.adaptNormalProject({ ...configurableSnapshotProject, developMode: '' }, []),
  null,
  'widening development snapshots does not loosen the nonempty requirement',
)
for (const [index, configuredDevelopMode] of ['联合开发', '外研'].entries()) {
  const exactDevelopModeProject = {
    ...configurableSnapshotProject,
    id: `exact-develop-mode-${index}`,
    sourceBid: `BID-EXACT-DEVELOP-${index}`,
    name: `EXACT-DEVELOP-${index}`,
    projectCode: `EXACT-DEVELOP-${index}`,
    developMode: configuredDevelopMode,
  }
  assert.equal(
    roadmapAdapter.adaptNormalProject(exactDevelopModeProject, [])?.developMode,
    configuredDevelopMode,
    `roadmap adaptation preserves the configured ${configuredDevelopMode} snapshot exactly`,
  )
  projectStore.useProjectStore.setState({ projects: [], selectedProject: null })
  assert.equal(
    projectStore.useProjectStore.getState().addProject(exactDevelopModeProject, '张三', { allowedFirstSaleTosValues: ['14.0.0'] }),
    true,
    `machine create accepts the configured ${configuredDevelopMode} snapshot through the actual store gate`,
  )
  assert.equal(
    roadmapAdapter.adaptNormalProject(projectStore.useProjectStore.getState().projects[0], [])?.developMode,
    configuredDevelopMode,
    `machine create keeps ${configuredDevelopMode} unchanged when the saved snapshot re-enters the runtime adapter`,
  )
  const exactDevelopModeUpdate = projectStore.useProjectStore.getState().updateProject(
    exactDevelopModeProject.id,
    { developMode: configuredDevelopMode },
    '张三',
    { allowedFirstSaleTosValues: ['14.0.0'] },
  )
  assert.equal(
    exactDevelopModeUpdate?.developMode,
    configuredDevelopMode,
    `machine update persists the configured ${configuredDevelopMode} snapshot exactly`,
  )
}

const modalSource = readSource(root, 'src/components/project-info/ProjectInfoModal.tsx')
const addSource = readSource(root, 'src/components/workspace/AddProjectModal.tsx')
const storeSource = readSource(root, 'src/stores/project.ts')
const fieldInputSource = readSource(root, 'src/components/project-info/ProjectInfoFieldInput.tsx')
const infoSectionsSource = readSource(root, 'src/components/project-info/ProjectInfoSections.tsx')
const externalPoolSource = readSource(root, 'src/data/externalProjectPool.ts')
const machineRulesSource = readSource(root, 'src/lib/machineTosVersions.ts')
const schemaSource = readSource(root, 'src/constants/projectInfoSchema.ts')
const projectSpaceSource = readSource(root, 'src/containers/ProjectSpaceContainer.tsx')
assert.match(modalSource, /projectType\s*!==\s*PROJECT_TYPE_TOS_VERSION[\s\S]*!isMachineProjectType\(projectType\)/, 'machine and tOS forms omit the independent owner input')
assert.match(addSource, /deriveProjectResponsiblePersons/, 'create derives responsibility from category fields')
assert.match(addSource, /deriveProjectTosVersion/, 'tOS create reads version from project name')
assert.match(storeSource, /resolveMachineTosUpdate/, 'project store resolves machine families before committing')
assert.match(storeSource, /set\(state\s*=>[\s\S]*resolution\.updates/, 'candidate and related new-machine patches share one state transaction')
assert.match(fieldInputSource, /formatTosEnumValue/, 'read-only machine version fields display the tOS prefix')
assert.match(infoSectionsSource, /formatTosEnumValue/, 'machine version information displays the tOS prefix')
assert.match(addSource, /sourceBid:\s*payload\.bid/, 'created projects retain their external source identity')
assert.match(addSource, /existingBids/, 'candidate filtering permits distinct source records with the same project name')
assert.doesNotMatch(addSource, /legacyExistingNames/, 'unlinked historical names do not reserve every external source BID in that family')
assert.match(modalSource, /mode\s*===\s*'create'[\s\S]*currentTosVersion/, 'new-machine create initializes current from first sale without applying that rule to edit mode')
assert.match(modalSource, /resolveMachineTosUpdate/, 'new-machine edit resolves its linked current version from the complete existing family')
assert.match(machineRulesSource, /readonly\s+T\[\]/, 'machine family resolver accepts readonly project arrays')
assert.ok((externalPoolSource.match(/name:\s*'X6870'/g) || []).length >= 3, 'browser fixtures expose one new and two same-name legacy projects')

const expectedMachineEnumTypes = {
  firstSaleTosVersion: 'first-sale-tos', currentTosVersion: 'first-sale-tos',
  healthStatus: 'machine-health-status', versionType: 'version-type',
  softwareProjectLevel: 'software-project-level', productSeries: 'product-series',
  researchMode: 'research-mode', developmentMode: 'machine-development-mode',
  dimensionUpgradeStrategy: 'upgrade-strategy', systemType: 'system-type',
  kernelVersion: 'kernel-version', memorySize: 'memory-size',
}
for (const [field, type] of Object.entries(expectedMachineEnumTypes)) {
  assert.match(modalSource, new RegExp(`${field}[\\s\\S]{0,260}['"]${type}['"]|['"]${type}['"][\\s\\S]{0,260}${field}`), `${field} consumes ${type} rows`)
}
assert.doesNotMatch(schemaSource, /const softwareProjectLevels|const dimensionUpgradeStrategies|options:\s*\['Full',\s*'Slim'|options:\s*\['32bit'/, 'configured machine fields have no schema-local option registry')
assert.doesNotMatch(fieldInputSource, /FREE_TEXT_OPTIONS/, 'configured select suggestions have no component-local fallback registry')
assert.doesNotMatch(addSource, /useTosEnumOptions|versionType:\s*\['Full'|developmentMode:\s*\['自研'/, 'create delegates all machine enum options to the self-contained form')
assert.match(modalSource, /buildChipOptions|useChipOptions/, 'chip code selects one atomic configured row')
assert.match(modalSource, /resolveChipRow/, 'chip selection resolves all three snapshots from one row ID')
assert.match(modalSource, /setFieldsValue\(\{\s*chipCode[^}]*chipModel[^}]*chipPlatform/s, 'one form update writes the complete chip tuple')
assert.doesNotMatch(projectSpaceSource, /const versionTypeChoices\s*=\s*\['Full'|const systemTypeChoices\s*=\s*\[/, 'project-space editing has no hard-coded machine option arrays')
for (const roadmapConsumerPath of [
  'src/components/roadmap/RoadmapProjectCard.tsx',
  'src/components/roadmap/RoadmapProjectDetailsModal.tsx',
]) {
  const roadmapConsumerSource = readSource(root, roadmapConsumerPath)
  assert.match(
    roadmapConsumerSource,
    /VERSION_TYPE_TAG_COLORS\[[^\]]+\]\s*\?\?\s*['"]default['"]|VERSION_TYPE_TAG_COLORS\[[^\]]+\]\s*\|\|\s*['"]default['"]/,
    `${roadmapConsumerPath} keeps known colors and gives configurable snapshots a neutral fallback`,
  )
}

console.log('machine tOS versions contract passed')
