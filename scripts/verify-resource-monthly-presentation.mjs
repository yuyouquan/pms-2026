import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'
globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = { localStorage }
const load = createTypeScriptModuleLoader(), get = file => load(path.resolve(file))
const { groupResourceMonths, sumMonthlyRow, resourceInvestmentStages } = get('src/components/project-resources/resourceMonthlyPresentation.ts')
const { buildResourceMonthlyView } = get('src/components/project-resources/resourceVersionViewData.ts')
const phases = [
 { key:'concept', label:'概念阶段', start:'2026-12-01', end:'2027-01-15', color:'green', amount:20 },
 { key:'plan', label:'计划阶段', start:'2027-01-15', end:'2027-03-01', color:'blue', amount:30 },
]
const months = ['2026-12','2027-01','2027-02','2027-03']
const grouped = groupResourceMonths(months, phases)
assert.deepEqual(grouped.flatMap(group=>group.months),months,'every month appears exactly once')
assert.equal(grouped.find(group=>group.months.includes('2027-01')).stageKey,'plan','boundary month belongs to greatest day overlap')
assert.equal(grouped.at(-1).stageKey,'unassigned','outside phase period remains visible')
assert.equal(groupResourceMonths(['2026-04'],[{...phases[0],start:'2026-04-01',end:'2026-04-16'},{...phases[1],start:'2026-04-16',end:'2026-05-01'}])[0].stageKey,'concept','ties use earlier stage')
const row={id:'r',versionId:'v',primaryDepartment:'研发',secondaryDepartment:'产品',estimatedTotal:50,monthlyData:{'2026-12':20,'2027-01':32}}
assert.equal(sumMonthlyRow(row),52)
assert.equal(sumMonthlyRow(row)-row.estimatedTotal,2,'excess does not alter department target')
const year=buildResourceMonthlyView([row],'v','2026-12','2027-02','2027')
assert.equal(year.visibleTotal,32)
assert.equal(year.allocatedTotal,52,'year filter does not conceal cycle imbalance')
assert.equal(sumMonthlyRow(row,['2026-12']),20)
const store=get('src/stores/hrConfig.ts').useHrConfigStore
const registry=get('src/stores/project.ts').useProjectStore
const permissions=get('src/stores/permission.ts').usePermissionStore
assert.equal(store.getState().data.feeRate[0].value,5)
store.getState().setFeeRate(6)
assert.equal(sumMonthlyRow(row)*store.getState().data.feeRate[0].value,312)
await store.persist.rehydrate()
assert.equal(store.getState().data.feeRate[0].value,6,'fee persists')
assert.throws(()=>store.getState().setFeeRate(-1),/非负/)
assert.throws(()=>store.getState().setFeeRate(NaN),/非负/)
assert.equal(store.getState().data.feeRate.length,1)
store.getState().addRecord('feeRate',{value:99})
store.getState().deleteRecord('feeRate','resource-fee-rate')
assert.equal(store.getState().data.feeRate[0].value,6,'generic add/delete cannot bypass singleton')
registry.setState({currentLoginUser:'费率无权限验收用户'})
assert.throws(()=>store.getState().setFeeRate(8),/权限/)
assert.equal(store.getState().data.feeRate[0].value,6)
const capability=resourceInvestmentStages('capability',{departmentInvestments:[{id:'c',estimatedInvestment:12}],projectStartTime:'2026-12-01',projectEndTime:'2027-02-01'})
assert.equal(capability[0].label,'项目周期')
assert.equal(capability[0].amount,12)
console.log('PASS monthly group ownership, year/full-cycle balance, cost rate persistence/permissions/singleton, capability cycle')
