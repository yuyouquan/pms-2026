import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'
globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = { localStorage }
const load = createTypeScriptModuleLoader(), get = file => load(path.resolve(file))
const registry = get('src/stores/project.ts').useProjectStore
const machine = get('src/stores/hrMachine.ts').useHrMachineStore
const { resolveHrFormalSource } = get('src/lib/hrFormalProjectSource.ts')
const { withMachineDerivedMilestones } = get('src/lib/hrMachinePeriods.ts')
const { RESOURCE_FORMAL_IDS } = get('src/mock/projectRegistry.ts')
const formalId = RESOURCE_FORMAL_IDS.machine, budgetId = 'mock-budget-machine-unbound'
machine.getState().refreshFormalProjects()
const record = id => machine.getState().projects.find(project => project.pmsProjectId === id)
const latest = id => record(id).versions.at(-1)
const model = { projectLevel: 'A', levelCoefficient: 1, hrModelVersion: 'V2026.1' }
const before = structuredClone(record(formalId).versions)
machine.getState().addVersion(record(formalId).id, 'projectBudget', { ...model, milestones: { str5: '2099-08-31', str5Plus6Months: '2100-12-01' } })
assert.equal(record(formalId).versions.length,before.length+1)
assert.deepEqual(record(formalId).versions.slice(0,-1),before)
const source=resolveHrFormalSource('machine',null,formalId)
assert.equal(latest(formalId).milestones.str5,source.milestones.str5)
const expected=withMachineDerivedMilestones(source.milestones).str5Plus6Months
assert.equal(latest(formalId).milestones.str5Plus6Months,expected)
machine.getState().updateVersion(record(formalId).id,latest(formalId).id,{milestones:{str5:'2100-01-01',str5Plus6Months:'2101-01-01',productLaunch:'2102-01-01',lifecycleEnd:'2103-01-01'}})
machine.getState().refreshFormalProjects()
await machine.persist.rehydrate()
assert.equal(latest(formalId).milestones.str5,source.milestones.str5)
assert.equal(latest(formalId).milestones.str5Plus6Months,expected)
const history=structuredClone(latest(formalId))
machine.getState().addVersion(record(formalId).id,'projectBudget',model)
machine.getState().updateVersion(record(formalId).id,history.id,{milestones:{str5:'2100-01-01'}})
assert.deepEqual(record(formalId).versions.find(v=>v.id===history.id),history)
machine.getState().addVersion(record(budgetId).id,'annual',{...model,milestones:{str5:'2027-08-31',str5Plus6Months:'2099-01-01'}})
assert.equal(latest(budgetId).milestones.str5Plus6Months,'2028-02-29')
registry.setState({projects:registry.getState().projects.map(p=>p.id===budgetId?{...p,boundFormalProjectId:formalId}:p)})
machine.getState().refreshFormalProjects()
assert.equal(latest(budgetId).milestones.str5,'2027-08-31')
assert.equal(latest(budgetId).milestones.str5Plus6Months,'2028-02-29')
machine.getState().updateVersion(record(budgetId).id,latest(budgetId).id,{milestones:{str5:'2026-08-31',str5Plus6Months:'2099-01-01'}})
await machine.persist.rehydrate()
assert.equal(latest(budgetId).milestones.str5Plus6Months,'2027-02-28')
machine.getState().updateVersion(record(budgetId).id,latest(budgetId).id,{milestones:{str5:null}})
assert.equal(latest(budgetId).milestones.str5Plus6Months,null)
const immutable=structuredClone(record(budgetId).versions)
registry.setState({currentLoginUser:'unknown'})
machine.getState().updateVersion(record(budgetId).id,latest(budgetId).id,{milestones:{str5:'2100-01-01'}})
assert.deepEqual(record(budgetId).versions,immutable)
console.log('PASS: derived endpoint create/edit/clear/formal-plan/budget-binding/history/reload/permission rules')
