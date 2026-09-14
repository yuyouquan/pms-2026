import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'
globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = new EventTarget()
window.localStorage = localStorage
const load = createTypeScriptModuleLoader(), get = file => load(path.resolve(file))
// Match the application entry: sync module loads before containers on a fresh origin.
const { startHrFormalProjectSync } = get('src/hooks/useHrFormalProjectSync.ts')
const stores = ['hrConfig','hrMachine','hrTos','hrTechnical','hrCapability'].map(name => {
  const store = Object.values(get(`src/stores/${name}.ts`)).find(value => value?.persist)
  assert.equal(store.persist.hasHydrated(), true, `${name}: missing storage must complete hydration`)
  return store
})
const stop = startHrFormalProjectSync(window)
const { createConfiguredProject } = get('src/lib/projectRegistry.ts')
for (const [index, type] of ['整机产品项目','tOS版本项目','技术项目','能力建设项目'].entries()) {
  const result = createConfiguredProject({ name: `启动验收-${type}`, type, projectAttribute: 'budget', responsiblePersons: ['演示用户01'] }, '演示用户01')
  assert.equal(result.ok, true)
  const record = () => stores[index + 1].getState().projects.find(p => p.pmsProjectId === result.projectId)
  assert.ok(record(), `${type}: new registry project must immediately have its resource record`)
  assert.equal(record().status, 'active')
  await stores[index + 1].persist.rehydrate()
  assert.ok(record(), `${type}: resource record survives reload`)
}
stop()
console.log('PASS fresh-origin hydration and immediate resource creation for all four project types')
