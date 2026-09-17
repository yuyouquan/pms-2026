import assert from 'node:assert/strict'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'
globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = new EventTarget()
window.localStorage = localStorage
const load = createTypeScriptModuleLoader()
const { hrNonLaborMonthRange, withHrNonLaborRange } = load('src/lib/hrNonLaborRange.ts')
const rules = load('src/lib/nonLaborInvestment.ts')
const subjects = [{id:'flight',secondarySubject:'交通费',tertiarySubject:'机票'}]
const departments = [{id:'software',secondaryDepartment:'软件部',tertiaryDepartment:'驱动开发'}]
const data = {startMonth:'2026-12',endMonth:'2027-02',items:[{id:'expense',secondaryDepartment:'软件部',tertiaryDepartment:'驱动开发',subjectId:'flight',secondarySubject:'交通费',tertiarySubject:'机票',monthlyAmounts:{'2026-12':100,'2027-01':200,'2027-02':300}}]}
assert.deepEqual(hrNonLaborMonthRange('machine',{conceptStart:'2026-12-12',str5:'2027-08-31',productLaunch:'2035-01-01',lifecycleEnd:'2036-01-01'}),{startMonth:'2026-12',endMonth:'2028-02'})
assert.deepEqual(hrNonLaborMonthRange('tos',{planningKO:'2026-09-03',maintenanceEnd:'2026-10-31'}),{startMonth:'2026-09',endMonth:'2026-10'})
assert.deepEqual(hrNonLaborMonthRange('technical',{planningStart:'2026-12-12',edcp:'2027-05-03'}),{startMonth:'2026-12',endMonth:'2027-05'})
assert.deepEqual(hrNonLaborMonthRange('capability',{projectStartTime:'2026-12-12',projectEndTime:'2027-03-04'}),{startMonth:'2026-12',endMonth:'2027-03'})
assert.deepEqual(hrNonLaborMonthRange('tos',{planningKO:'2026-02-30',str1:null}),{startMonth:null,endMonth:null})
const shrunk = withHrNonLaborRange(data,'tos',{planningKO:'2027-01-01',maintenanceEnd:'2027-01-31'})
assert.equal(rules.nonLaborTotal(shrunk),200)
assert.equal(shrunk.items[0].monthlyAmounts['2026-12'],100)
assert.deepEqual(rules.validateNonLaborInvestment(shrunk,subjects,data,departments),shrunk)
const editedThenShrunk={...shrunk,items:[{...shrunk.items[0],monthlyAmounts:{...shrunk.items[0].monthlyAmounts,'2026-12':999}}]}
assert.deepEqual(rules.validateNonLaborInvestment(editedThenShrunk,subjects,data,departments),editedThenShrunk,'same-draft edits remain valid after shrinking the range')
assert.deepEqual(rules.validateNonLaborInvestment({...editedThenShrunk,startMonth:null,endMonth:null},subjects,undefined,departments).items,editedThenShrunk.items,'new drafts can retain hidden amounts after clearing dates')
assert.throws(()=>rules.validateNonLaborInvestment({...shrunk,items:[{...shrunk.items[0],monthlyAmounts:{'bad-month':999}}]},subjects,data,departments),/月份格式/)
const cleared = withHrNonLaborRange(shrunk,'tos',{})
assert.deepEqual(rules.validateNonLaborInvestment(cleared,subjects,shrunk,departments),cleared)
assert.equal(rules.nonLaborTotal(cleared),0)
const restored=withHrNonLaborRange(cleared,'tos',{planningKO:'2026-12-01',maintenanceEnd:'2027-02-28'})
assert.equal(rules.nonLaborTotal(restored),600)
const sheet=load('src/lib/nonLaborSpreadsheet.ts')
const imported=sheet.parseNonLaborInvestmentRows([sheet.nonLaborSpreadsheetColumns(shrunk).map(c=>c.title),['软件部','驱动开发','交通费','机票',250]],shrunk,subjects,departments,shrunk)
assert.equal(imported.items[0].id,'expense')
assert.equal(imported.items[0].monthlyAmounts['2026-12'],100)
assert.equal(imported.items[0].monthlyAmounts['2027-01'],250)
assert.equal(imported.items[0].monthlyAmounts['2027-02'],300)
assert.equal(rules.nonLaborTotal(withHrNonLaborRange(imported,'tos',{planningKO:'2026-12-01',maintenanceEnd:'2027-02-28'})),650)
console.log('PASS category milestone ranges, derived six months, partial/empty dates, shrink/restore, hidden amounts and import retention')

const registry=load('src/stores/project.ts').useProjectStore
const permissions=load('src/lib/hrProjectRegistry.ts')
const { updateConfiguredProject }=load('src/lib/projectRegistry.ts')
const { RESOURCE_BUDGET_IDS }=load('src/mock/projectRegistry.ts')
registry.setState({currentLoginUser:'演示用户01'})
const stop=load('src/hooks/useHrFormalProjectSync.ts').startHrFormalProjectSync(window)
const durable=[]
for(const name of ['Machine','Tos','Technical','Capability']) {
  const category=name.toLowerCase()
  const store=load('src/stores/hr'+name+'.ts')['useHr'+name+'Store']
  const id=RESOURCE_BUDGET_IDS[category]
  const project=()=>store.getState().projects.find(p=>p.pmsProjectId===id)
  const latest=()=>project().versions.at(-1)
  const bound=registry.getState().projects.find(p=>p.id===id).boundFormalProjectId
  assert.ok(bound)
  assert.equal(permissions.canAccessHrProject(project()),true)
  assert.equal(permissions.canAccessHrProject(project(),true),false)
  assert.equal(permissions.canEditHrInScope(project(),id),false)
  const snapshot=structuredClone(project())
  const seed=latest()
  const add=()=>category==='machine'?store.getState().addVersion(project().id,'annual',{...seed}):store.getState().addVersion(project().id,{...seed})
  add()
  store.getState().updateVersion(project().id,seed.id,{estimatedInvestment:99999,nonLaborInvestment:data,batch:9})
  if(store.getState().copyVersion)store.getState().copyVersion(project().id,seed.id)
  if(store.getState().updateVersionDepartmentInvestments)store.getState().updateVersionDepartmentInvestments(project().id,seed.id,[],data)
  store.getState().deleteVersion(project().id,seed.id)
  assert.deepEqual(project(),snapshot,'bound budgets reject mutations even for administrators')
  assert.equal(updateConfiguredProject(id,{boundFormalProjectId:null},'演示用户01').ok,true)
  assert.equal(permissions.canEditHrInScope(project(),id),true)
  const expense=rules.cloneNonLaborInvestment(latest().nonLaborInvestment)
  const month=expense.startMonth
  expense.items[0].monthlyAmounts[month]=123.45
  store.getState().updateVersion(project().id,latest().id,{nonLaborInvestment:expense})
  assert.equal(latest().nonLaborInvestment.items[0].monthlyAmounts[month],123.45)
  const beforeDates=category==='capability'?{projectStartTime:latest().projectStartTime,projectEndTime:latest().projectEndTime}:{milestones:structuredClone(latest().milestones)}
  const nextDates=category==='capability'?{projectStartTime:'2030-01-01',projectEndTime:'2030-02-01'}:{milestones:Object.fromEntries(Object.keys(latest().milestones).map(key=>[key,'2030-01-01']))}
  store.getState().updateVersion(project().id,latest().id,nextDates)
  assert.equal(latest().nonLaborInvestment.items[0].monthlyAmounts[month],123.45)
  assert.equal(rules.nonLaborTotal(latest().nonLaborInvestment),0)
  await store.persist.rehydrate()
  store.getState().updateVersion(project().id,latest().id,beforeDates)
  assert.equal(latest().nonLaborInvestment.items[0].monthlyAmounts[month],123.45)
  const count=project().versions.length
  const createSeed=latest()
  if(category==='machine')store.getState().addVersion(project().id,'annual',{...createSeed})
  else store.getState().addVersion(project().id,{...createSeed})
  assert.equal(project().versions.length,count+1,'unbound budgets can create versions again')
  assert.equal(updateConfiguredProject(id,{boundFormalProjectId:bound},'演示用户01').ok,true)
  assert.equal(permissions.canAccessHrProject(project(),true),false)
  assert.equal(latest().nonLaborInvestment.items[0].monthlyAmounts[month],123.45)
  durable.push([name,structuredClone(project())])
  console.log('PASS '+category+' binding lock, unlink restoration, version creation, date shrink/restore and data retention')
}
stop()
const reload=createTypeScriptModuleLoader()
const stopReload=reload('src/hooks/useHrFormalProjectSync.ts').startHrFormalProjectSync(window)
for(const [name,expected] of durable){
  const store=reload('src/stores/hr'+name+'.ts')['useHr'+name+'Store']
  assert.deepEqual(store.getState().projects.find(p=>p.id===expected.id),expected)
}
stopReload()
const ui=load('src/lib/projectManagementUi.ts')
const records=registry.getState().projects
const filtered=ui.filterConfigurationProjects(records,{name:'示例',projectCode:'',boundFormalProjectName:'',projectTypes:[],projectAttributes:[]})
const rows=ui.buildProjectConfigurationExportRows(filtered,records)
assert.equal(rows.length,filtered.length)
assert.ok(rows.every(row=>['正式项目','预算项目','路标项目'].includes(row.projectAttribute)))
const boundRow=rows.find(row=>row.name===records.find(p=>p.id===RESOURCE_BUDGET_IDS.tos).name)
assert.equal(boundRow.boundFormalProject,records.find(p=>p.id===records.find(p=>p.id===RESOURCE_BUDGET_IDS.tos).boundFormalProjectId).name)
assert.equal(ui.buildProjectConfigurationExportRows(records,records).length,records.length)
console.log('PASS persistence across fresh store reload and full/current export rows with readable attributes and binding names')
