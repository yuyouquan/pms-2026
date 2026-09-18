#!/usr/bin/env node
import assert from 'node:assert/strict'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage, MOCK_DATASET_VERSION, MOCK_DATASET_VERSION_STORAGE_KEY } from './lib/mock-dataset-storage.mjs'

const names = ['Machine', 'Tos', 'Technical', 'Capability']
const oldResource = {
  projects: [{
    id: 'mp-kp5', name: 'KP5', ipmProjectCode: 'DEMO017', versions: [],
    migrationIssue: '旧年度预算 mp-kp5：正式绑定 DEMO017 不唯一，原记录保留待核对',
  }],
  monthlyInvestments: [], registryMigrationComplete: true,
}
globalThis.localStorage = createCurrentDatasetStorage({
  [MOCK_DATASET_VERSION_STORAGE_KEY]: '2026-09-08-v1',
  'pms-projects': JSON.stringify({ state: { projects: [{ id: 'old-project', name: '旧项目' }] }, version: 10 }),
  'pms-hr-config': JSON.stringify({ state: { data: { hrModel: [{ id: 'old-model' }] } }, version: 2 }),
  ...Object.fromEntries(names.map(name => [
    'pms-hr-' + name.toLowerCase(), JSON.stringify({ state: oldResource, version: 0 }),
  ])),
  'other-app:keep': 'unrelated data',
})
globalThis.window = new EventTarget()
window.localStorage = localStorage
window.sessionStorage = createCurrentDatasetStorage()

const load = createTypeScriptModuleLoader()
const { startHrFormalProjectSync } = load('src/hooks/useHrFormalProjectSync.ts')
const stop = startHrFormalProjectSync(window)
const registry = load('src/stores/project.ts').useProjectStore
const config = load('src/stores/hrConfig.ts').useHrConfigStore
const stores = names.map(name => load('src/stores/hr' + name + '.ts')['useHr' + name + 'Store'])
assert.equal(localStorage.getItem(MOCK_DATASET_VERSION_STORAGE_KEY), MOCK_DATASET_VERSION)
assert.equal(localStorage.getItem('other-app:keep'), 'unrelated data')
assert.ok(!registry.getState().projects.some(p => p.id === 'old-project'))
assert.ok(config.persist.hasHydrated())
assert.ok(config.getState().data.hrModel.length > 1)
assert.ok(!config.getState().data.hrModel.some(model => model.id === 'old-model'))
for (const [index, store] of stores.entries()) {
  assert.ok(store.persist.hasHydrated(), names[index] + ' completes hydration')
  assert.ok(store.getState().projects.length > 1)
  for (const project of store.getState().projects) {
    assert.notEqual(project.id, 'mp-kp5', 'obsolete orphan is replaced, not hidden')
    assert.ok(!project.migrationIssue, names[index] + ' has no ownership warnings')
    assert.ok(!project.legacyHrSnapshot)
    assert.ok(registry.getState().projects.some(p => p.id === project.pmsProjectId))
  }
}

// Exercise a new budget version after the reset, then boot a new module graph.
const { RESOURCE_BUDGET_IDS } = load('src/mock/projectRegistry.ts')
const machine = stores[0]
const budget = machine.getState().projects.find(p => p.pmsProjectId === 'mock-budget-machine-unbound')
assert.notEqual(budget.pmsProjectId, RESOURCE_BUDGET_IDS.machine, 'bound source stays readonly; creation uses the editable unbound budget fixture')
const oldVersions = structuredClone(budget.versions)
const latest = oldVersions.at(-1)
machine.getState().addVersion(budget.id, 'annual', {
  projectLevel: latest.projectLevel, levelCoefficient: latest.levelCoefficient,
  hrModelVersion: latest.hrModelVersion,
  milestones: { ...latest.milestones, lifecycleEnd: '2028-06-15' },
  metadata: { brand: budget.brand, productLine: budget.productLine, marketName: budget.marketName },
})
const after = machine.getState().projects.find(p => p.id === budget.id)
assert.equal(after.versions.length, oldVersions.length + 1)
assert.deepEqual(after.versions.slice(0, -1), oldVersions, 'new version does not overwrite history')
assert.equal(after.versions.at(-1).milestones.lifecycleEnd, '2028-06-15')
const beforeReload = stores.map(store => structuredClone({
  projects: store.getState().projects, monthlyInvestments: store.getState().monthlyInvestments,
}))
stop()
const reload = createTypeScriptModuleLoader()
const stopReload = reload('src/hooks/useHrFormalProjectSync.ts').startHrFormalProjectSync(window)
for (const [index, name] of names.entries()) {
  const store = reload('src/stores/hr' + name + '.ts')['useHr' + name + 'Store']
  assert.deepEqual(store.getState().projects, beforeReload[index].projects)
  assert.deepEqual(store.getState().monthlyInvestments, beforeReload[index].monthlyInvestments)
}
stopReload()
console.log('PASS old registry/models/four resource caches refresh together; no ownership warnings; new versions and monthly edits survive reload')
