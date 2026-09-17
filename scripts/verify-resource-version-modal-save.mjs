import assert from 'node:assert/strict'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'
globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = new EventTarget()
window.localStorage = localStorage
const load = createTypeScriptModuleLoader()
const stop = load('src/hooks/useHrFormalProjectSync.ts').startHrFormalProjectSync(window)
const { RESOURCE_BUDGET_IDS } = load('src/mock/projectRegistry.ts')
const { isLatestHrVersion } = load('src/lib/hrVersionRules.ts')
const { isHrFormalRecord } = load('src/lib/hrProjectRegistry.ts')
for (const category of ['Tos','Technical']) {
  const store = load(`src/stores/hr${category}.ts`)[`useHr${category}Store`]
  const project = () => store.getState().projects.find(p => p.pmsProjectId === `mock-budget-${category.toLowerCase()}-unbound`)
  const latest = project().versions.find(v => isLatestHrVersion(project(),v))
  const before = structuredClone(project())
  const fields = category === 'Tos' ? { str5:'2027-09-30',maintenanceEnd:'2029-06-01' } : { tdr2:'2027-05-10',edcp:'2028-02-10' }
  const version = () => project().versions.find(v=>v.id===latest.id)
  const draft = structuredClone(latest.departmentInvestments)
  store.getState().updateVersionDepartmentInvestments(project().id,latest.id,draft,latest.nonLaborInvestment,fields)
  for (const [key,date] of Object.entries(fields)) assert.equal(version().milestones[key],date,category+' saves editable milestone '+key)
  assert.deepEqual(project().versions.filter(v=>v.id!==latest.id),before.versions.filter(v=>v.id!==latest.id),'history stays unchanged')
  const saved = structuredClone(project())
  const invalid = { ...latest.nonLaborInvestment, endMonth:'2000-01' }
  assert.throws(()=>store.getState().updateVersionDepartmentInvestments(project().id,latest.id,draft,invalid,{str5:'2099-01-01'}))
  assert.deepEqual(project(),saved,'invalid non-labor prevents partial milestone save')
  const formal=store.getState().projects.find(p=>isHrFormalRecord(p) && p.versions.some(v=>v.budgetType!=='annual'))
  const fv=formal.versions.find(v=>v.budgetType!=='annual' && isLatestHrVersion(formal,v))
  const locked=category==='Tos'?'str1':'tdr1'
  const manual=category==='Tos'?{maintenanceEnd:'2029-05-20'}:{}
  store.getState().updateVersionDepartmentInvestments(formal.id,fv.id,fv.departmentInvestments,fv.nonLaborInvestment,{[locked]:'2099-01-01',...manual})
  const afterFormal=store.getState().projects.find(p=>p.id===formal.id).versions.find(v=>v.id===fv.id)
  assert.equal(afterFormal.milestones[locked],fv.milestones[locked],'formal plan-owned milestone is protected')
  if(category==='Tos') assert.equal(afterFormal.milestones.maintenanceEnd,'2029-05-20')
  console.log('PASS '+category+' modal date save, history isolation, formal ownership and atomic failure')
}
stop()
