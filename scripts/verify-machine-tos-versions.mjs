#!/usr/bin/env node
import assert from 'node:assert/strict'
import { loadTypeScriptModule, projectRoot, readSource } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const rules = loadTypeScriptModule(root, 'src/lib/machineTosVersions.ts')
const projectInfoRules = loadTypeScriptModule(root, 'src/lib/projectInfoRules.ts')
const projectStore = loadTypeScriptModule(root, 'src/stores/project.ts')

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
  rules.resolveMachineTosUpdate([], { ...newMachine, firstSaleTosVersion: 'bad' }),
  { ok: false, reason: 'invalid-version' },
)

const otherNew = { ...newMachine, id: 'other-new', name: 'X6880', firstSaleTosVersion: '16.0.0' }
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
] }, 2)
assert.deepEqual(
  migratedMachineState.projects.map(project => ({
    id: project.id,
    productType: project.productType,
    first: project.firstSaleTosVersionId,
    current: project.currentTosVersion,
    fieldFirst: project.fieldValues?.firstSaleTosVersion,
    fieldCurrent: project.fieldValues?.currentTosVersion,
  })),
  [
    { id: 'persisted-machine', productType: '新品', first: '16.3.0', current: '14.0.0', fieldFirst: '16.3.0', fieldCurrent: '14.0.0' },
    { id: 'persisted-three-part', productType: '新品', first: '17.10.0', current: '17.10.0', fieldFirst: undefined, fieldCurrent: undefined },
    { id: 'persisted-unknown', productType: '新品', first: 'future-version', current: 'future-current', fieldFirst: undefined, fieldCurrent: undefined },
    { id: 'persisted-legacy-product-type', productType: '老品', first: '14.0.0', current: '15.0.0', fieldFirst: undefined, fieldCurrent: undefined },
  ],
  'persisted two-part references migrate to canonical three-part values without clearing unknown display history',
)
assert.deepEqual(
  projectStore.migrateProjectState(migratedMachineState, 3),
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

const deleteFixture = (projects, projectId) => {
  projectStore.useProjectStore.setState({ projects, selectedProject: null })
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

const modalSource = readSource(root, 'src/components/project-info/ProjectInfoModal.tsx')
const addSource = readSource(root, 'src/components/workspace/AddProjectModal.tsx')
const storeSource = readSource(root, 'src/stores/project.ts')
const fieldInputSource = readSource(root, 'src/components/project-info/ProjectInfoFieldInput.tsx')
const infoSectionsSource = readSource(root, 'src/components/project-info/ProjectInfoSections.tsx')
const externalPoolSource = readSource(root, 'src/data/externalProjectPool.ts')
assert.match(modalSource, /projectType\s*!==\s*PROJECT_TYPE_TOS_VERSION[\s\S]*!isMachineProjectType\(projectType\)/, 'machine and tOS forms omit the independent owner input')
assert.match(addSource, /deriveProjectResponsiblePersons/, 'create derives responsibility from category fields')
assert.match(addSource, /deriveProjectTosVersion/, 'tOS create reads version from project name')
assert.match(storeSource, /resolveMachineTosUpdate/, 'project store resolves machine families before committing')
assert.match(storeSource, /set\(state\s*=>[\s\S]*resolution\.updates/, 'candidate and related new-machine patches share one state transaction')
assert.match(fieldInputSource, /formatTosEnumValue/, 'read-only machine version fields display the tOS prefix')
assert.match(infoSectionsSource, /formatTosEnumValue/, 'machine version information displays the tOS prefix')
assert.match(addSource, /sourceBid:\s*payload\.bid/, 'created projects retain their external source identity')
assert.match(addSource, /existingBids/, 'candidate filtering permits distinct source records with the same project name')
assert.ok((externalPoolSource.match(/name:\s*'X6870'/g) || []).length >= 3, 'browser fixtures expose one new and two same-name legacy projects')

console.log('machine tOS versions contract passed')
