import assert from 'node:assert/strict'
import { loadTypeScriptModule } from './lib/source-contract.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'

globalThis.window = { localStorage: createCurrentDatasetStorage() }
const { usePlanStore } = loadTypeScriptModule(process.cwd(), 'src/stores/plan.ts')
const before = usePlanStore.getState()
let notifications = 0
const unsubscribe = usePlanStore.subscribe(() => { notifications += 1 })

// Legacy projects can revisit snapshot initialization as missing role defaults
// resolve. An already initialized snapshot must not retrigger the render tree.
for (let attempt = 0; attempt < 60; attempt += 1) {
  usePlanStore.getState().setPublishedSnapshots(previous => previous)
}
assert.equal(notifications, 0, 'unchanged snapshot initialization must not notify subscribers')
assert.equal(usePlanStore.getState(), before, 'no-op initialization preserves the store snapshot')

const tasks = [{ id: 'stability-task', taskName: '保留已有计划' }]
usePlanStore.getState().setPublishedSnapshots(previous => ({ ...previous, stability: tasks }))
assert.equal(notifications, 1, 'a real snapshot change is published exactly once')
assert.equal(usePlanStore.getState().publishedSnapshots.stability, tasks)
usePlanStore.getState().setPublishedSnapshots(usePlanStore.getState().publishedSnapshots)
assert.equal(notifications, 1, 'passing the current snapshot directly is also a no-op')
unsubscribe()
console.log('PASS plan snapshot initialization converges and real changes remain observable')
