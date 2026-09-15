#!/usr/bin/env node
import assert from 'node:assert/strict'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'
globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = new EventTarget()
window.localStorage = localStorage
const load = createTypeScriptModuleLoader()
const rules = load('src/lib/nonLaborInvestment.ts')
const subjects = [{ id:'travel-flight', secondarySubject:'差旅费', tertiarySubject:'机票' }]
const departments = [
  { id:'dept-software', secondaryDepartment:'软件部', tertiaryDepartment:'驱动开发' },
  { id:'dept-hardware', secondaryDepartment:'硬件部', tertiaryDepartment:'电源设计' },
]
const value = { startMonth:'2026-12', endMonth:'2027-02', items:[
  { id:'row-1', secondaryDepartment:'软件部', tertiaryDepartment:'驱动开发', subjectId:'travel-flight', secondarySubject:'差旅费', tertiarySubject:'机票', monthlyAmounts:{'2026-12':2.5,'2027-01':3,'2027-02':0.5} },
] }
assert.deepEqual(rules.nonLaborMonths(value), ['2026-12','2027-01','2027-02'])
assert.equal(rules.nonLaborTotal(value), 6)
assert.deepEqual(rules.validateNonLaborInvestment(value, subjects, undefined, departments), value)
const otherDepartment = {...value,items:[...value.items,{...value.items[0],id:'row-2',secondaryDepartment:'硬件部',tertiaryDepartment:'电源设计'}]}
assert.equal(rules.validateNonLaborInvestment(otherDepartment, subjects, undefined, departments).items.length, 2, 'different departments may share the same subject')
assert.throws(() => rules.validateNonLaborInvestment({...value,items:[...value.items,{...value.items[0],id:'row-2'}]},subjects,undefined,departments),/重复/)
assert.throws(() => rules.validateNonLaborInvestment({...value,items:[{...value.items[0],tertiaryDepartment:'电源设计'}]},subjects,undefined,departments),/部门/)
assert.throws(() => rules.validateNonLaborInvestment({...value,items:[{...value.items[0],secondaryDepartment:''}]},subjects,undefined,departments),/部门/)
assert.throws(() => rules.validateNonLaborInvestment({...value,endMonth:'2026-11'},subjects),/时间范围/)
assert.throws(() => rules.validateNonLaborInvestment({...value,items:[{...value.items[0],monthlyAmounts:{'2026-12':-1}}]},subjects,undefined,departments),/非负/)
assert.throws(() => rules.validateNonLaborInvestment(value, [], undefined, departments),/科目/)
assert.deepEqual(rules.validateNonLaborInvestment(value, [], value, []), value, 'retired department and subject snapshots remain editable in their saved version')
const clone=rules.cloneNonLaborInvestment(value)
clone.items[0].monthlyAmounts['2026-12']=99
assert.equal(value.items[0].monthlyAmounts['2026-12'],2.5)
console.log('PASS monthly range, totals, duplicate and invalid input guards, retired subject snapshots and independent copies')

const { seedExistingMockNonLabor, mockNonLaborInvestment } = load('src/mock/nonLaborInvestment.ts')
const legacyId = 'hr-resource-machine-fixture-annual-1'
const legacyValue = { startMonth:'2026-12', endMonth:'2027-02', items:[
  {id:legacyId+'-transport',subjectId:'non-labor-transport-flight',secondarySubject:'交通费',tertiarySubject:'机票',monthlyAmounts:{'2026-12':1.2,'2027-01':3.5,'2027-02':0}},
  {id:legacyId+'-hotel',subjectId:'non-labor-travel-hotel',secondarySubject:'差旅费',tertiarySubject:'住宿费',monthlyAmounts:{'2026-12':2,'2027-01':1.5,'2027-02':1}},
]}
const upgraded = seedExistingMockNonLabor([{versions:[{id:legacyId,minorVersion:1,nonLaborInvestment:legacyValue}]}])[0].versions[0].nonLaborInvestment
assert.deepEqual(upgraded,mockNonLaborInvestment(legacyId,1),'untouched shipped mock values gain departments and currency amounts')
const userEdited = structuredClone(legacyValue)
userEdited.items[0].monthlyAmounts['2026-12']=42.5
for(const preserved of [userEdited,rules.emptyNonLaborInvestment()]) {
  assert.deepEqual(seedExistingMockNonLabor([{versions:[{id:legacyId,minorVersion:1,nonLaborInvestment:preserved}]}])[0].versions[0].nonLaborInvestment,preserved,'user edits and deliberately empty versions are not replaced')
}
assert.equal(rules.cloneNonLaborInvestment(userEdited).items[0].secondaryDepartment,'','legacy user data asks for department selection instead of guessing')
console.log('PASS mock-only refresh preserves user amounts and cleared data')

const { startHrFormalProjectSync } = load('src/hooks/useHrFormalProjectSync.ts')
const stop = startHrFormalProjectSync(window)
const { useHrConfigStore: config } = load('src/stores/hrConfig.ts')
const { useProjectStore: registry } = load('src/stores/project.ts')
const { RESOURCE_BUDGET_IDS } = load('src/mock/projectRegistry.ts')
const { canEditHrInScope } = load('src/lib/hrProjectRegistry.ts')
const names = ['Machine','Tos','Technical','Capability']
const stores = names.map(name => load('src/stores/hr' + name + '.ts')['useHr' + name + 'Store'])
const initialRegistry = structuredClone(registry.getState().projects)
for (const [index, store] of stores.entries()) {
  const category = names[index].toLowerCase()
  const project = () => store.getState().projects.find(p => p.pmsProjectId === RESOURCE_BUDGET_IDS[category])
  const before = structuredClone(project().versions)
  const seed = before.at(-1)
  assert.ok(seed.nonLaborInvestment.items.length > 0)
  const nonLaborInvestment = rules.cloneNonLaborInvestment(seed.nonLaborInvestment)
  nonLaborInvestment.items[0].monthlyAmounts['2026-12'] = 9.9
  const form = { ...seed, nonLaborInvestment }
  if (index === 0) store.getState().addVersion(project().id, 'annual', {
    ...form, metadata:{brand:project().brand,productLine:project().productLine,marketName:project().marketName},
  })
  else store.getState().addVersion(project().id, form)
  assert.equal(project().versions.length, before.length + 1)
  assert.deepEqual(project().versions.slice(0,-1), before, 'creation preserves history')
  const latest = project().versions.at(-1)
  assert.equal(latest.nonLaborInvestment.items[0].monthlyAmounts['2026-12'],9.9)
  nonLaborInvestment.items[0].monthlyAmounts['2026-12'] = 777
  assert.equal(project().versions.at(-1).nonLaborInvestment.items[0].monthlyAmounts['2026-12'],9.9, 'store owns its copy')
  const edit = rules.cloneNonLaborInvestment(latest.nonLaborInvestment)
  edit.items[0].monthlyAmounts['2026-12'] = 4.4
  if (index === 0) store.getState().updateVersion(project().id,latest.id,{ nonLaborInvestment:edit })
  else store.getState().updateVersionDepartmentInvestments(project().id,latest.id,latest.departmentInvestments,edit)
  assert.equal(project().versions.at(-1).nonLaborInvestment.items[0].monthlyAmounts['2026-12'],4.4)
  const frozen = structuredClone(project().versions[0])
  store.getState().updateVersion(project().id,frozen.id,{nonLaborInvestment:edit})
  assert.deepEqual(project().versions[0],frozen,'history remains readonly')
  const snapshot = structuredClone(project().versions)
  const invalid={...edit,items:[...edit.items,{...edit.items[0],id:'duplicate-row'}]}
  if (index === 0) assert.throws(()=>store.getState().updateVersion(project().id,latest.id,{nonLaborInvestment:invalid}),/重复/)
  else assert.throws(()=>store.getState().updateVersionDepartmentInvestments(project().id,latest.id,[],invalid),/重复/)
  assert.deepEqual(project().versions,snapshot,'invalid non-labor data cannot partially save human investment')
  const canonical = registry.getState().projects.find(p=>p.id===project().pmsProjectId)
  assert.equal(canEditHrInScope(project(),canonical.boundFormalProjectId),false,'linked annual remains readonly in formal scope')
  console.log('PASS ' + category + ' creation, latest editing, history, independent snapshots and atomic validation')
}
assert.deepEqual(registry.getState().projects,initialRegistry)
const machineProject = () => stores[0].getState().projects.find(p => p.pmsProjectId === RESOURCE_BUDGET_IDS.machine)
const modelBefore = structuredClone(machineProject().versions.at(-1))
const savedModels = config.getState().data.hrModel
config.setState({ data: { ...config.getState().data, hrModel: savedModels.filter(row => row.modelVersion !== modelBefore.hrModelVersion) } })
const afterRetirement = structuredClone(machineProject().versions.at(-1))
assert.equal(afterRetirement.hrModelVersion, modelBefore.hrModelVersion)
assert.equal(afterRetirement.projectLevel, modelBefore.projectLevel)
stores[0].getState().updateVersion(machineProject().id, modelBefore.id, { nonLaborInvestment: modelBefore.nonLaborInvestment, projectLevel: undefined, hrModelVersion: undefined, levelCoefficient: undefined })
assert.deepEqual(machineProject().versions.at(-1), afterRetirement, 'non-labor-only editing cannot replace the retired model or alter the synchronized human investment')
assert.throws(() => stores[0].getState().updateVersion(machineProject().id, modelBefore.id, { hrModelVersion: 'missing-model' }), /模型/)
config.setState({ data: { ...config.getState().data, hrModel: savedModels } })
console.log('PASS editing non-labor values preserves retired machine models; explicit invalid model changes are rejected')
const snapshots = stores.map(store=>structuredClone(store.getState().projects))
config.getState().deleteRecord('nonLaborSubject','non-labor-transport-flight')
for (const [index, store] of stores.entries()) {
  assert.deepEqual(store.getState().projects,snapshots[index],'deleting a subject does not rewrite budget data')
  const project=store.getState().projects.find(p=>p.pmsProjectId===RESOURCE_BUDGET_IDS[names[index].toLowerCase()])
  const latest=project.versions.at(-1)
  store.getState().updateVersion(project.id,latest.id,{nonLaborInvestment:latest.nonLaborInvestment})
}
assert.throws(()=>config.getState().addRecord('nonLaborSubject',{secondarySubject:'差旅费',tertiarySubject:'住宿费'}),/相同三级科目/)
assert.throws(()=>config.getState().addRecord('nonLaborSubject',{secondarySubject:' ',tertiarySubject:' ' }),/请输入/)
const beforeSubjectEdit = stores.map(store=>structuredClone(store.getState().projects))
config.getState().updateRecord('nonLaborSubject','non-labor-travel-hotel',{tertiarySubject:'酒店住宿'})
config.getState().importRecords('nonLaborSubject', [{id:'trimmed-import', secondarySubject:'  测试差旅  ', tertiarySubject:'  车船费  '}])
config.getState().updateRecord('nonLaborSubject','trimmed-import',{tertiarySubject:'  交通补贴  '})
const editedSubject=config.getState().data.nonLaborSubject.find(row=>row.id==='trimmed-import')
assert.equal(editedSubject.secondarySubject,'测试差旅')
assert.equal(editedSubject.tertiarySubject,'交通补贴')
assert.deepEqual(stores.map(store=>store.getState().projects),beforeSubjectEdit,'configuration edits retain all stored investment snapshots')
registry.setState({currentLoginUser:'演示用户02'})
const configBefore=JSON.stringify(config.getState().data)
config.getState().addRecord('nonLaborSubject',{secondarySubject:'无权修改',tertiarySubject:'无权修改'})
assert.equal(JSON.stringify(config.getState().data),configBefore,'configuration edit requires permission')
registry.setState({currentLoginUser:'演示用户01'})
const durable=stores.map(store=>structuredClone(store.getState().projects))
stop()
const reload=createTypeScriptModuleLoader()
const stopReload=reload('src/hooks/useHrFormalProjectSync.ts').startHrFormalProjectSync(window)
for (const [index,name] of names.entries()) {
  assert.deepEqual(reload('src/stores/hr'+name+'.ts')['useHr'+name+'Store'].getState().projects,durable[index])
}
assert.ok(!reload('src/stores/hrConfig.ts').useHrConfigStore.getState().data.nonLaborSubject.some(row=>row.id==='non-labor-transport-flight'))
stopReload()
console.log('PASS deleted subjects and existing versions survive reload; configuration duplicate validation and RBAC enforced')
