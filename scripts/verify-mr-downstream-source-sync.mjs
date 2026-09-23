import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'

const load = createTypeScriptModuleLoader()
const { createMrVersionPlanStore, partializeMrVersionPlanState, migrateMrVersionPlanState, MR_VERSION_PLAN_STORE_VERSION } = load(path.resolve('src/stores/mrVersionPlan.ts'))
const candidate = (value, id = 'source-a') => ({ value, label: value, sourceLevel1TaskId: id, planStartDate: '', planEndDate: '', disabled: true })
const oldVersion = '16.1.0.120'
const newVersion = '16.1.0.125'
const planKey = version => `machine::${version}`
const marketKey = version => `${planKey(version)}::TR`
const lockKey = version => `machine::tos::${version}`
function setup() {
  const store = createMrVersionPlanStore({ initialState: { tosInstancesByProjectId: {}, machinePlansByKey: {}, marketOverridesByKey: {}, machineRowLocks: {} } })
  store.getState().syncTosInstancesFromLevel1('tos', [candidate(oldVersion)])
  const instance = store.getState().tosInstancesByProjectId.tos[0]
  const leaf = instance.activities.find(row => row.parentId !== null).id
  store.setState({
    machinePlansByKey: { [planKey(oldVersion)]: { projectId: 'machine', tosProjectId: 'tos', tosVersion: oldVersion, transferType: '3', dates: { [leaf]: '2027-01-04' }, updatedBy: 'tester', updatedAt: '2026-09-23' } },
    marketOverridesByKey: { [marketKey(oldVersion)]: { projectId: 'machine', tosVersion: oldVersion, market: 'TR', mainMarket: 'OP', dates: { [leaf]: '2027-01-05' } } },
    machineRowLocks: { [lockKey(oldVersion)]: { key: lockKey(oldVersion), projectId: 'machine', tosProjectId: 'tos', tosVersion: oldVersion, lockedBy: 'tester', lockedAt: '2026-09-23' } },
  })
  return { store, leaf }
}
function assertRetained(state, leaf, version) {
  assert.equal(state.machinePlansByKey[planKey(version)]?.dates[leaf], '2027-01-04', 'same source rename preserves downstream dates before another page opens')
  assert.equal(state.machinePlansByKey[planKey(version)]?.transferType, '3', 'transfer type is preserved')
  assert.equal(state.marketOverridesByKey[marketKey(version)]?.dates[leaf], '2027-01-05', 'market override moves to the renamed source')
  assert.equal(state.machineRowLocks[lockKey(version)]?.key, lockKey(version), 'lock identity moves to the renamed source')
}
{
  const { store, leaf } = setup()
  store.getState().syncTosInstancesFromLevel1('tos', [candidate(newVersion)])
  assertRetained(store.getState(), leaf, newVersion)
  assert.equal(store.getState().machinePlansByKey[planKey(oldVersion)], undefined)
  const persisted = partializeMrVersionPlanState(store.getState())
  assertRetained(migrateMrVersionPlanState(persisted, MR_VERSION_PLAN_STORE_VERSION), leaf, newVersion)
  const before = store.getState()
  store.getState().syncTosInstancesFromLevel1('tos', [candidate(newVersion)])
  assert.equal(store.getState(), before, 'unchanged reconciliation does not trigger store writes')
}
for (const replacement of [[], [candidate(oldVersion, 'replacement-source')]]) {
  const { store } = setup()
  store.getState().syncTosInstancesFromLevel1('tos', replacement)
  assert.deepEqual(store.getState().machinePlansByKey, {}, 'deleted source data is removed synchronously, even with a same-name replacement')
  assert.deepEqual(store.getState().marketOverridesByKey, {})
  assert.deepEqual(store.getState().machineRowLocks, {})
  store.getState().syncTosInstancesFromLevel1('tos', [candidate(oldVersion, 'new-source')])
  assert.deepEqual(store.getState().machinePlansByKey, {}, 'recreating the same version cannot inherit deleted machine data')
}
{
  const { store, leaf } = setup()
  store.getState().syncTosInstancesFromLevel1('tos', [], 'Slim')
  const persisted = partializeMrVersionPlanState(store.getState())
  store.setState(migrateMrVersionPlanState(persisted, MR_VERSION_PLAN_STORE_VERSION))
  store.getState().syncTosInstancesFromLevel1('tos', [candidate(newVersion)], 'Full')
  assertRetained(store.getState(), leaf, newVersion)
}
{
  const { store, leaf } = setup()
  const before = partializeMrVersionPlanState(store.getState())
  store.getState().syncTosInstancesFromLevel1('other-tos', [candidate('17.1.0.120')])
  store.getState().syncTosInstancesFromLevel1('other-tos', [])
  assertRetained(store.getState(), leaf, oldVersion)
  assert.deepEqual(store.getState().machinePlansByKey, before.machinePlansByKey, 'unrelated tOS projects stay isolated')
}
console.log('PASS downstream rename, immediate deletion, same-name recreation, archived type rename and persisted dates/overrides/locks')
process.exit(0)
