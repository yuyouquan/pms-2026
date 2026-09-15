import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'
globalThis.localStorage = createCurrentDatasetStorage()
const windows = [new EventTarget(), new EventTarget()]
windows.forEach(w => { w.localStorage = globalThis.localStorage })
function tab(index) {
  globalThis.window = windows[index]
  const load = createTypeScriptModuleLoader(), get = p => load(path.resolve(p))
  const registry = get('src/stores/project.ts').useProjectStore
  const machine = get('src/stores/hrMachine.ts').useHrMachineStore
  get('src/hooks/useHrFormalProjectSync.ts').startHrFormalProjectSync(windows[index])
  return { registry, machine, config: get('src/stores/hrConfig.ts').useHrConfigStore, configure: get('src/lib/projectRegistry.ts').updateConfiguredProject, helpers: get('src/lib/hrProjectRegistry.ts') }
}
const a = tab(0), b = tab(1), id = 'mock-budget-machine-unbound'
const resource = t => t.machine.getState().projects.find(p => p.pmsProjectId === id)
const before = structuredClone(resource(a).versions)
a.machine.getState().addVersion(resource(a).id, 'annual', { projectLevel: 'A', levelCoefficient: 1.75, hrModelVersion: 'V2026.1', milestones: { str5: '2029-08-12' } })
const expected = structuredClone(resource(a).versions)
assert.equal(expected.length, before.length + 1)
assert.deepEqual(expected.slice(0,-1), before)
function changed(target, key) { const e = new Event('storage'); Object.assign(e, { key, storageArea: globalThis.localStorage, newValue: globalThis.localStorage.getItem(key) }); target.dispatchEvent(e) }
changed(windows[1], 'pms-hr-machine')
assert.deepEqual(resource(b).versions, expected, 'another tab must receive the appended version before binding')
const source = b.registry.getState().projects.find(p => p.id === '3')
assert.equal(b.configure(id, { boundFormalProjectId: source.id }, '演示用户01').ok, true)
assert.deepEqual(resource(b).versions, expected, 'binding must preserve every budget version and manual milestone')
changed(windows[0], 'pms-projects')
assert.equal(a.registry.getState().projects.find(p => p.id === id).boundFormalProjectId, source.id)
assert.ok(a.helpers.isHrVersionVisible(resource(a), 'annual', source.id))
assert.equal(a.helpers.canEditHrInScope(resource(a), source.id), false)
assert.deepEqual(resource(a).versions, expected)
assert.equal(b.configure(id, { boundFormalProjectId: null }, '演示用户01').ok, true)
changed(windows[0], 'pms-projects')
assert.equal(a.helpers.isHrVersionVisible(resource(a), 'annual', source.id), false)
assert.deepEqual(resource(a).versions, expected)
console.log('PASS cross-tab append, bind, linked readonly annual budgets and unlink preserve all version data')
// A model edit must reach the receiving tab before versions are recalculated.
const model = a.config.getState().data.hrModel.find(row => row.modelVersion === 'V2026.1' && row.projectLevel === 'A')
assert.ok(model)
b.config.getState().setEditingId(model.id)
b.config.getState().setShowEditModal(true)
const localConfigData = b.config.getState().data
changed(windows[1], 'pms-projects')
assert.equal(b.config.getState().data, localConfigData, 'unchanged data keeps references used by form drafts')
a.config.getState().updateRecord('hrModel', model.id, { conceptToStr1: Number(model.conceptToStr1) + 1000 })
a.machine.getState().addVersion(resource(a).id, 'annual', { projectLevel: 'A', levelCoefficient: 1.75, hrModelVersion: 'V2026.1' })
const modelUpdatedVersions = structuredClone(resource(a).versions)
assert.equal(modelUpdatedVersions.at(-1).estimatedInvestment, expected.at(-1).estimatedInvestment + 1750, 'the current seven-period model edit changes the new version total')
changed(windows[1], 'pms-hr-machine')
assert.deepEqual(resource(b).versions, modelUpdatedVersions, 'model source and dependent resource totals must agree across tabs')
assert.equal(b.config.getState().editingId, model.id)
assert.equal(b.config.getState().showEditModal, true, 'source synchronization must not close another tab editor')
console.log('PASS model and resource consistency without resetting local configuration editor')
