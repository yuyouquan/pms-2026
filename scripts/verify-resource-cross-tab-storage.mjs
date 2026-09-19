import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'

const values = new Map([['pms:mock-dataset-version', '2026-09-15-v1']])
const windows = []
const eventQueue = []
const writes = []
let activeTab = -1

const storage = {
  get length() { return values.size },
  key: index => [...values.keys()][index] ?? null,
  getItem: key => values.get(key) ?? null,
  setItem(key, input) {
    const value = String(input)
    const oldValue = values.get(key) ?? null
    values.set(key, value)
    writes.push({ tab: activeTab, key, changed: oldValue !== value })
    if (activeTab < 0 || oldValue === value) return
    windows.forEach((target, index) => {
      if (target && index !== activeTab) eventQueue.push({ target, index, key, oldValue, newValue: value })
    })
  },
  removeItem(key) { values.delete(key) },
}
globalThis.localStorage = storage

function inTab(index, action) {
  const previousWindow = globalThis.window
  const previousTab = activeTab
  globalThis.window = windows[index]
  activeTab = index
  try { return action() } finally {
    globalThis.window = previousWindow
    activeTab = previousTab
  }
}

function createTab(index) {
  windows[index] = new EventTarget()
  windows[index].localStorage = storage
  return inTab(index, () => {
    const load = createTypeScriptModuleLoader()
    const get = file => load(path.resolve(file))
    const machine = get('src/stores/hrMachine.ts').useHrMachineStore
    const stores = ['Machine', 'Tos', 'Technical', 'Capability'].map(name => get(`src/stores/hr${name}.ts`)[`useHr${name}Store`])
    const stop = get('src/hooks/useHrFormalProjectSync.ts').startHrFormalProjectSync(windows[index])
    return { load, machine, stores, registry: get('src/stores/project.ts').useProjectStore, stop }
  })
}

function flushEvents(limit = 100) {
  let delivered = 0
  while (eventQueue.length && delivered < limit) {
    const next = eventQueue.shift()
    delivered += 1
    inTab(next.index, () => {
      const event = new Event('storage')
      Object.assign(event, { key: next.key, oldValue: next.oldValue, newValue: next.newValue, storageArea: storage })
      next.target.dispatchEvent(event)
    })
  }
  return delivered
}

function settle(label, limit = 100) {
  const delivered = flushEvents(limit)
  assert.equal(eventQueue.length, 0, `${label}: storage events must converge within ${limit} deliveries`)
  return delivered
}

const a = createTab(0)
const b = createTab(1)
const initEvents = settle('initial hydration')

writes.length = 0
inTab(0, () => {
  a.machine.getState().setActiveTab('historyVersion')
  a.machine.getState().setSelectedProjectId('tab-a-selection')
})
inTab(1, () => {
  b.machine.getState().setActiveTab('monthlyInvestment')
  b.machine.getState().setSelectedProjectId('tab-b-selection')
})
const uiEvents = settle('tab-local UI changes')
assert.equal(uiEvents, 0, 'tab-local UI changes do not change durable storage')
assert.equal(a.machine.getState().activeTab, 'historyVersion')
assert.equal(b.machine.getState().activeTab, 'monthlyInvestment')
for (const key of ['pms-hr-machine', 'pms-hr-tos', 'pms-hr-technical', 'pms-hr-capability']) {
  assert.deepEqual(Object.keys(JSON.parse(storage.getItem(key)).state).sort(), ['monthlyInvestments', 'projects', 'registryMigrationComplete'])
}

writes.length = 0
inTab(0, () => a.stores.forEach(store => store.getState().refreshFormalProjects()))
assert.equal(writes.length, 0, 'unchanged refresh does not call persisted set')

const project = () => a.machine.getState().projects.find(item => item.pmsProjectId === 'mock-budget-machine-unbound')
const version = () => project().versions.at(-1)
const original = structuredClone(version())
const actualRows = a.load(path.resolve('src/lib/resourceAllocation.ts')).resolveMachineDepartmentInvestments(version())
const row = actualRows[0]
inTab(0, () => a.machine.getState().updateVersionInline(project().id, version().id, {
  type: 'departmentTotal', rowId: row.id, value: Math.round((row.estimatedInvestment + 1.1) * 10) / 10,
}, project().pmsProjectId))
const editEvents = settle('actual investment edit')
const edited = version()
const remoteEdited = b.machine.getState().projects.find(item => item.id === project().id).versions.find(item => item.id === edited.id)
assert.equal(remoteEdited.estimatedInvestment, edited.estimatedInvestment)
assert.deepEqual(remoteEdited.machineDepartmentInvestments, edited.machineDepartmentInvestments)
assert.notDeepEqual(edited.machineDepartmentInvestments, original.machineDepartmentInvestments, 'phase allocation changed with the total')

inTab(0, () => a.machine.getState().copyVersion(project().id, edited.id))
const copyEvents = settle('copy version')
const copy = project().versions.at(-1)
const remoteCopy = b.machine.getState().projects.find(item => item.id === project().id).versions.find(item => item.id === copy.id)
assert.deepEqual(remoteCopy.machineDepartmentInvestments, copy.machineDepartmentInvestments)
assert.equal(remoteCopy.copiedFromVersionId, edited.id)
inTab(1, () => {
  b.machine.persist.rehydrate()
  b.machine.getState().refreshFormalProjects()
})
assert.deepEqual(b.machine.getState().projects.find(item => item.id === project().id).versions.find(item => item.id === copy.id), copy)

const canonicalId = project().pmsProjectId
const canonical = a.registry.getState().projects.find(item => item.id === canonicalId)
const renamed = `${canonical.name}-跨标签同步`
inTab(0, () => a.registry.getState().setProjects(projects => projects.map(item => item.id === canonicalId ? { ...item, name: renamed } : item)))
const canonicalEvents = settle('canonical project update')
assert.equal(project().name, renamed)
assert.equal(b.machine.getState().projects.find(item => item.id === project().id).name, renamed)
// Activation must converge in both directions without resurrecting a cleared version.
const access = a.load(path.resolve('src/lib/hrProjectRegistry.ts'))
for (let index = 0; index < a.stores.length; index++) {
  const left = a.stores[index], right = b.stores[index]
  for (const type of ['annual', 'projectEstimate', 'projectBudget']) {
    const own = left.getState().projects.find(p => access.canAccessHrProject(p, true) && access.getHrAllowedBudgetTypes(p).includes(type) && p.versions.some(v => v.budgetType === type))
    assert.ok(own)
    const target = own.versions.find(v => v.budgetType === type)
    const remoteActive = () => right.getState().projects.find(p => p.id === own.id).versions.filter(v => v.budgetType === type && v.isActive).map(v => v.id)
    inTab(0, () => left.getState().setVersionActive(own.id, target.id, true))
    settle('activation replication')
    assert.deepEqual(remoteActive(), [target.id])
    inTab(1, () => right.getState().setVersionActive(own.id, target.id, false))
    settle('deactivation replication')
    assert.deepEqual(remoteActive(), [])
    assert.deepEqual(left.getState().projects.find(p => p.id === own.id).versions.filter(v => v.budgetType === type && v.isActive), [])
    inTab(0, () => { left.persist.rehydrate(); left.getState().refreshFormalProjects() })
    settle('zero active reload')
    assert.deepEqual(left.getState().projects.find(p => p.id === own.id).versions.filter(v => v.budgetType === type && v.isActive), [])
    console.log(`PASS cross-tab activation/remote-deactivation/reload: ${['Machine','Tos','Technical','Capability'][index]}/${type}`)
  }
}

a.stop()
b.stop()
windows[0] = null
windows[1] = null
const hrKeys = ['pms-hr-machine', 'pms-hr-tos', 'pms-hr-technical', 'pms-hr-capability']
const durableCounts = hrKeys.map(key => JSON.parse(storage.getItem(key)).state.projects.length)
for (const key of hrKeys) {
  const durable = JSON.parse(storage.getItem(key))
  durable.state = { ...durable.state, activeTab: 'historyVersion', selectedProjectId: 'legacy-selection', showNewVersionModal: true, filters: { projectName: ['旧UI'] } }
  storage.setItem(key, JSON.stringify(durable))
}
const legacy = createTab(2)
legacy.stores.forEach((store, index) => {
  assert.equal(store.getState().activeTab, 'projectList', `${hrKeys[index]} legacy UI does not replace current tab UI`)
  assert.equal(store.getState().selectedProjectId, null)
  assert.equal(store.getState().projects.length, durableCounts[index], `${hrKeys[index]} keeps legacy durable projects`)
})
assert.ok(legacy.machine.getState().projects.some(item => item.versions.some(candidate => candidate.id === copy.id)), 'legacy full payload keeps durable versions')
legacy.stop()

console.log(`PASS cross-tab storage converges: init=${initEvents}, ui=${uiEvents}, edit=${editEvents}, copy=${copyEvents}, canonical=${canonicalEvents}, unchanged-refresh-writes=0`)
