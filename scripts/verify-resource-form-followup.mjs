import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'
globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = {localStorage:globalThis.localStorage}
const load=createTypeScriptModuleLoader(), get=p=>load(path.resolve(p))
const registry=get('src/stores/project.ts').useProjectStore
const capability=get('src/stores/hrCapability.ts').useHrCapabilityStore
const machine=get('src/stores/hrMachine.ts').useHrMachineStore
const {getProjectSpaceModules,resolveProjectSpaceModule}=get('src/lib/projectSpaceNavigation.ts')
const formal=registry.getState().projects.find(p=>p.type==='能力建设项目' && p.projectAttribute==='formal')
assert.ok(formal)
assert.deepEqual(getProjectSpaceModules(formal),['resources','permission'])
assert.equal(resolveProjectSpaceModule(formal,'basic'),'resources')
capability.getState().refreshFormalProjects()
const cap=()=>capability.getState().projects.find(p=>p.pmsProjectId===formal.id)
const before=structuredClone(cap().versions)
capability.getState().addVersion(cap().id,{budgetType:'projectBudget',projectStartTime:'2030-02-01',projectEndTime:'2030-10-31',departmentInvestments:[{id:'manual-dept',primaryDepartment:'研发中心',secondaryDepartment:'产品部',estimatedInvestment:12}]})
const newVersion=()=>cap().versions.at(-1)
assert.equal(cap().versions.length,before.length+1)
assert.deepEqual(cap().versions.slice(0,-1),before)
assert.equal(newVersion().projectStartTime,'2030-02-01')
assert.equal(newVersion().projectEndTime,'2030-10-31')
capability.getState().updateVersion(cap().id,newVersion().id,{projectStartTime:'2031-03-01',projectEndTime:'2031-12-31'})
capability.getState().refreshFormalProjects()
await capability.persist.rehydrate()
assert.equal(newVersion().projectStartTime,'2031-03-01')
assert.equal(newVersion().projectEndTime,'2031-12-31')
const latestId=newVersion().id
capability.getState().copyVersion(cap().id,latestId)
capability.getState().updateVersion(cap().id,latestId,{projectStartTime:'2040-01-01'})
assert.equal(cap().versions.find(v=>v.id===latestId).projectStartTime,'2031-03-01','history remains immutable')
assert.equal(newVersion().projectStartTime,'2031-03-01','copy inherits independent dates')
console.log('PASS capability formal manual create/edit/copy/reload dates and latest-version guard')
machine.getState().refreshFormalProjects()
const budget=()=>machine.getState().projects.find(p=>p.pmsProjectId==='mock-budget-machine-unbound')
machine.getState().addVersion(budget().id,'annual',{projectLevel:'A',levelCoefficient:1,hrModelVersion:'V2026.1',milestones:{str2:'2030-03-01',str4a:'2030-10-01'}})
const bv=()=>budget().versions.at(-1)
assert.equal(bv().milestones.str2,'2030-03-01');assert.equal(bv().milestones.str4a,'2030-10-01')
machine.getState().updateVersion(budget().id,bv().id,{milestones:{str2:'2030-03-02',str4a:'2030-10-02'}})
assert.equal(get('src/lib/projectRegistry.ts').updateConfiguredProject('mock-budget-machine-unbound',{boundFormalProjectId:'3'},'演示用户01').ok,true)
machine.getState().refreshFormalProjects();await machine.persist.rehydrate()
assert.equal(bv().milestones.str2,'2030-03-02');assert.equal(bv().milestones.str4a,'2030-10-02')
const source=get('src/lib/hrFormalProjectSource.ts').resolveHrFormalSource('machine',null,'3')
assert.ok(source.milestones.str2);assert.ok(source.milestones.str4a)
const fields=get('src/constants/hrMachine.ts').MILESTONE_FIELDS
assert.deepEqual(fields.map(f=>f.key),['conceptStart','str1','str2','str3','str4','str4a','str5','productLaunch','lifecycleEnd'])
const formalMachine=machine.getState().projects.find(p=>p.pmsProjectId==='3')
const formalVersion=formalMachine.versions.find(v=>v.budgetType==='projectBudget')
if(formalVersion){
 machine.getState().updateVersion(formalMachine.id,formalVersion.id,{milestones:{str2:'2040-01-01',str4a:'2040-12-01'}})
 const synced=machine.getState().projects.find(p=>p.id===formalMachine.id).versions.find(v=>v.id===formalVersion.id)
 assert.notEqual(synced.milestones.str2,'2040-01-01');assert.notEqual(synced.milestones.str4a,'2040-12-01')
}
console.log('PASS STR2/STR4A manual create/edit/bind/reload and formal plan sources')
