import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'
globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = new EventTarget()
window.localStorage = localStorage
const first = createTypeScriptModuleLoader()
const project = first(path.resolve('src/stores/project.ts')).useProjectStore
const ids = first(path.resolve('src/mock/projectRegistry.ts')).RESOURCE_FORMAL_IDS
// Existing deployments can contain formal records created before registry ownership metadata.
project.setState({ projects: project.getState().projects.map(p => {
  if (!Object.values(ids).includes(p.id)) return p
  const { responsiblePersons, createdBy, createdAt, ...legacy } = p
  return legacy
}) })
const load = createTypeScriptModuleLoader(), get = file => load(path.resolve(file))
const sync = get('src/hooks/useHrFormalProjectSync.ts')
const stop = sync.startHrFormalProjectSync(window)
for (const [category, storeFile] of [['machine','hrMachine'],['tos','hrTos'],['technical','hrTechnical'],['capability','hrCapability']]) {
  const store = Object.values(get(`src/stores/${storeFile}.ts`)).find(value => value?.persist)
  assert.equal(store.persist.hasHydrated(), true)
  const record = store.getState().projects.find(p => p.pmsProjectId === ids[category])
  assert.ok(record)
  assert.ok(record.versions.every(v => typeof v.createdBy === 'string' && v.createdBy.length > 0))
  await store.persist.rehydrate()
  assert.ok(store.getState().projects.find(p => p.pmsProjectId === ids[category]))
}
stop()
console.log('PASS existing registries without ownership metadata initialize all four resource stores and survive reload')
