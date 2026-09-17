import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'
const cwd = process.cwd()
globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = { localStorage }
const firstLoad = createTypeScriptModuleLoader()
const load = file => firstLoad(path.join(cwd, file))
const registry = load('src/stores/project.ts').useProjectStore
const access = load('src/lib/hrProjectRegistry.ts')
const expected = []
for (const kind of ['Tos', 'Technical']) {
 const store = load(`src/stores/hr${kind}.ts`)[`useHr${kind}Store`]
 store.getState().refreshFormalProjects()
 const project = store.getState().projects.find(p => p.versions.length === 0 && access.isHrFormalRecord(p) && access.canAccessHrProject(p, true))
 assert.ok(project, `${kind}: actual empty formal project exists`)
 const seed = store.getState().projects.flatMap(p => p.versions).find(v => v.budgetType === 'projectEstimate')
 const deps = structuredClone(seed.departmentInvestments).map((row, i) => ({ ...row, id: `first-${kind}-${i}`, estimatedInvestment: i === 0 ? 17.1 : 0 }))
 store.getState().addVersion(project.id, { budgetType: 'projectEstimate', milestones: structuredClone(seed.milestones), departmentInvestments: deps })
 const first = store.getState().projects.find(p => p.id === project.id).versions[0]
 assert.ok(first)
 assert.equal(first.estimatedInvestment, 17.1)
 store.getState().setVersionActive(project.id, first.id, true)
 store.getState().copyVersion(project.id, first.id)
 const created = structuredClone(store.getState().projects.find(p => p.id === project.id).versions)
 assert.equal(created.length, 2)
 assert.equal(created[0].versionNumber, 'V0.1')
 assert.equal(created[1].versionNumber, 'V0.2')
 expected.push({ kind, projectId: project.id, pmsProjectId: project.pmsProjectId, versions: created })
 console.log(`PASS ${kind}: first empty-project version and copy created`)
}
// A fresh module graph recreates every Zustand store against the same persisted storage.
for (let restart = 1; restart <= 3; restart++) {
 const freshLoad = createTypeScriptModuleLoader()
 const fresh = file => freshLoad(path.join(cwd, file))
 fresh('src/stores/project.ts')
 for (const { kind, projectId, versions } of expected) {
  const store = fresh(`src/stores/hr${kind}.ts`)[`useHr${kind}Store`]
  const beforeSync = store.getState().projects.find(p => p.id === projectId)
  assert.ok(beforeSync, `${kind}: persisted project present before sync ${restart}`)
  assert.deepEqual(beforeSync.versions, versions, `${kind}: full versions survive fresh load ${restart}`)
  store.getState().refreshFormalProjects()
  assert.deepEqual(store.getState().projects.find(p => p.id === projectId).versions, versions, `${kind}: full versions survive registry sync ${restart}`)
  await store.persist.rehydrate()
  assert.deepEqual(store.getState().projects.find(p => p.id === projectId).versions, versions, `${kind}: full versions survive explicit rehydrate ${restart}`)
  console.log('PASS', kind, 'fresh graph + sync + rehydrate', restart)
 }
}
console.log('PASS empty formal first versions + copy survive 3 independent module graph restarts')
