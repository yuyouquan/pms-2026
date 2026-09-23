import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
const load = createTypeScriptModuleLoader()
const mocks = load(path.resolve('src/data/mrVersionPlanMocks.ts'))
const api = load(path.resolve('src/stores/mrVersionPlan.ts'))
const seed = mocks.createInitialMrVersionPlanState()
assert.equal(seed.tosInstancesByProjectId['2']?.length, 2, 'tOS16.1 must include dated MR fixtures')
assert.ok(seed.tosInstancesByProjectId['2'].every(row => Object.keys(row.dates).length === 10))
assert.ok(seed.machinePlansByKey['12::16.3.0.140']?.dates['mr-node-test-start'], 'eligible mock rows must not start as empty placeholders')
const old = structuredClone(seed)
old.tosInstancesByProjectId['2'][0].dates = {}
old.tosInstancesByProjectId['19'][0].dates = { 'mr-node-test-start': '2026-04-25' }
old.machinePlansByKey['12::16.3.0.140'].dates = {}
old.machinePlansByKey['1::16.3.0.145'].dates = { 'mr-node-review': '2026-07-04' }
old.machinePlansByKey['17::16.3.0.140'].transferType = 'N/A'
old.machinePlansByKey['17::16.3.0.140'].dates = {}
old.tosInstancesByProjectId['2'].push({ ...structuredClone(old.tosInstancesByProjectId['2'][0]), tosVersion: '16.1.0.999', dates: {} })
delete old.machinePlansByKey['13::16.3.0.145']
const repaired = api.migrateMrVersionPlanState(old, 5)
assert.ok(repaired.tosInstancesByProjectId['2'][0].dates['mr-node-test-start'])
assert.deepEqual(repaired.tosInstancesByProjectId['19'][0].dates, { 'mr-node-test-start': '2026-04-25' }, 'preserve partially entered rows')
assert.ok(repaired.machinePlansByKey['12::16.3.0.140'].dates['mr-node-test-start'])
assert.deepEqual(repaired.machinePlansByKey['1::16.3.0.145'].dates, { 'mr-node-review': '2026-07-04' })
assert.deepEqual(repaired.machinePlansByKey['17::16.3.0.140'].dates, {}, 'N/A stays empty')
assert.deepEqual(repaired.tosInstancesByProjectId['2'].find(row => row.tosVersion === '16.1.0.999').dates, {}, 'custom rows stay untouched')
assert.equal(repaired.machinePlansByKey['13::16.3.0.145'], undefined, 'deleted rows must not resurrect')
assert.deepEqual(repaired.stopReleaseRecords, old.stopReleaseRecords)
assert.deepEqual(repaired.machineRowLocks, old.machineRowLocks)
repaired.machinePlansByKey['12::16.3.0.140'].dates = {}
assert.deepEqual(api.migrateMrVersionPlanState(repaired, api.MR_VERSION_PLAN_STORE_VERSION).machinePlansByKey['12::16.3.0.140'].dates, {}, 'recovery runs once, later user clears persist')
assert.deepEqual(old.tosInstancesByProjectId['2'][0].dates, {}, 'migration does not mutate input')
const recreated = structuredClone(old)
recreated.tosInstancesByProjectId['2'][0].sourceLevel1TaskId = 'user-recreated-task'
assert.deepEqual(api.migrateMrVersionPlanState(recreated, 5).tosInstancesByProjectId['2'][0].dates, {}, 'same-name recreated business nodes do not inherit old sample dates')
console.log('PASS MR mock recovery: dated defaults, old empty rows, edits, N/A, custom rows, deletions, locks and one-shot migration')
