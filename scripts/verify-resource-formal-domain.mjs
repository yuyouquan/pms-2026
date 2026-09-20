import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'
globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = { localStorage }
const load = createTypeScriptModuleLoader(), get = file => load(path.resolve(file))
const registry = get('src/lib/hrProjectRegistry.ts')
const versionRules=get('src/lib/hrVersionRules.ts')
assert.equal(versionRules.normalizeHrVersionSequence([{id:'historic',budgetType:'annual',versionNumber:'V1.0',majorVersion:1,minorVersion:0,createdAt:'2020-01-01'}])[0].versionNumber,'V1.0','existing display name is historical data')
for (const kind of ['Machine','Tos','Technical','Capability']) {
 const store = get(`src/stores/hr${kind}.ts`)[`useHr${kind}Store`]
 assert.equal(typeof store.getState().createResourceVersion, 'function', `${kind}: named creation API`)
 store.getState().refreshFormalProjects()
 if(kind==='Machine') for(const project of store.getState().projects) for(const version of project.versions) {
   if(version.modelSnapshot?.length) assert.ok(version.modelSnapshot.some(row=>String(row.projectLevel)===version.projectLevel),'saved model must not be filtered out by a live source level overwrite')
 }
 const p = store.getState().projects.find(p => registry.canAccessHrProject(p,true) && p.versions.some(v => v.budgetType === 'annual'))
 assert.ok(p)
 const scope = p.pmsProjectId
 const read = () => store.getState().projects.find(item => item.id === p.id)
 const id = store.getState().createResourceVersion(p.id,'annual',scope,{versionNumber:'7.2'})
 const version = () => read().versions.find(v => v.id === id)
 assert.equal(version().versionNumber,'V7.2')
 const dateField=get('src/lib/resourceInlineEditing.ts').resourceMilestoneFields[kind.toLowerCase()][0]
 store.getState().updateVersionInline(p.id,id,{type:'milestone',key:dateField.key,value:'2026-01-01'},scope)
 assert.ok(read().resourceOperationLogs.at(-1).changes.some(change=>change.field.includes(dateField.label) && change.after==='2026-01-01'),'date audit names the changed milestone')
 if(kind !== 'Machine') assert.deepEqual(version().departmentInvestments,[],'blank does not silently copy rows')
 const before = JSON.stringify(store.getState().projects)
 assert.throws(() => store.getState().createResourceVersion(p.id,'annual',scope,{versionNumber:'V7.2'}), /重复|存在/)
 assert.equal(JSON.stringify(store.getState().projects), before)
 const copyId = store.getState().createResourceVersion(p.id,'annual',scope,{versionNumber:'8',sourceVersionId:id})
 assert.equal(read().versions.find(v=>v.id===copyId).copiedFromVersionId,id)
 store.getState().refreshFormalProjects()
 await store.persist.rehydrate()
 assert.equal(version().versionNumber,'V7.2')
 const logCount=read().resourceOperationLogs.length
 store.getState().updateVersionInline(p.id,id,{type:'batch',value:null},scope)
 assert.equal(read().resourceOperationLogs.length,logCount,'no-op must not log')
 if(kind === 'Machine') {
   assert.throws(()=>store.getState().updateVersionInline(p.id,id,{type:'departments',rows:[]},scope),/只读|模型/)
 } else {
   const fields = get('src/lib/resourceRatios.ts').getResourceRatioFields(kind.toLowerCase())
   const row={id:`${id}-department`,primaryDepartment:'',secondaryDepartment:'',estimatedInvestment:0,...Object.fromEntries(fields.filter(f=>f.key!=='projectPeriod').map(f=>[f.key,0]))}
   store.getState().updateVersionInline(p.id,id,{type:'departments',rows:[row]},scope)
   for (let index=0;index<fields.length;index++) store.getState().updateVersionInline(p.id,id,{type:'departmentRatio',rowId:row.id,key:fields[index].key,value:fields.length===1?100:index<2?33.33:index===2?33.34:0},scope)
   store.getState().updateVersionInline(p.id,id,{type:'departmentTotal',rowId:row.id,value:10},scope)
   const actual=version().departmentInvestments[0]
   assert.equal(actual.estimatedInvestment,10)
   const ratioCopyId=store.getState().createResourceVersion(p.id,'annual',scope,{versionNumber:'8.2',sourceVersionId:id})
   const ratioCopy=read().versions.find(v=>v.id===ratioCopyId)
   const copiedRow=ratioCopy.departmentInvestments[0]
   assert.deepEqual(ratioCopy.departmentPhaseRatios[copiedRow.id],version().departmentPhaseRatios[row.id],'copied ratios track remapped row ids')
   assert.notEqual(ratioCopy.departmentPhaseRatios[copiedRow.id],version().departmentPhaseRatios[row.id])
   const ratios=version().departmentPhaseRatios[row.id]
   const importBefore=JSON.stringify(read())
   assert.throws(()=>store.getState().updateVersionInline(p.id,id,{type:'departments',rows:[actual],phaseRatios:{[row.id]:{...ratios,[fields[0].key]:101}}},scope))
   assert.equal(JSON.stringify(read()),importBefore,'invalid ratio import is atomic')
   store.getState().updateVersionInline(p.id,id,{type:'departments',rows:[{...actual,estimatedInvestment:20}],phaseRatios:{[row.id]:ratios}},scope)
   assert.equal(version().departmentInvestments[0].estimatedInvestment,20,'ratio import keeps independent target')
   await store.persist.rehydrate()
   assert.equal(version().departmentInvestments[0].estimatedInvestment,20,'reload keeps independent target')
   if(fields.length>1) {
    store.getState().updateVersionInline(p.id,id,{type:'departmentRatio',rowId:row.id,key:fields[0].key,value:0},scope)
    assert.equal(version().departmentInvestments[0].estimatedInvestment,20,'partial ratio never resets department target')
    assert.throws(()=>store.getState().setVersionActive(p.id,id,true),/100/,'incomplete ratio blocks formalization')
    assert.equal(store.getState().monthlyInvestments.find(item=>item.versionId===id&&!item.isArchived).estimatedTotal,20,'monthly target survives partial ratios')
   }
   if(fields.length>1) assert.equal(Math.round(fields.reduce((sum,f)=>sum+actual[f.key],0)*10)/10,10)
   const previous=JSON.stringify(read())
   for(const value of [-1,101,NaN,1.001]) assert.throws(()=>store.getState().updateVersionInline(p.id,id,{type:'departmentRatio',rowId:row.id,key:fields[0].key,value},scope))
   assert.equal(JSON.stringify(read()),previous)
   // Identity-only row saves must not reinterpret an incomplete ratio or rounded values.
   const beforeIdentity=structuredClone(version().departmentInvestments[0])
   const beforeRatios=structuredClone(version().departmentPhaseRatios)
   const pair=Object.values(get('src/stores/hrConfig.ts').useHrConfigStore.getState().data).flat().find(row=>row.primaryDepartment && row.secondaryDepartment)
   store.getState().updateVersionInline(p.id,id,{type:'departments',rows:[{...beforeIdentity,primaryDepartment:pair.primaryDepartment,secondaryDepartment:pair.secondaryDepartment}]},scope)
   assert.equal(version().departmentInvestments[0].estimatedInvestment,beforeIdentity.estimatedInvestment,'identity edits retain independent target')
   assert.deepEqual(version().departmentPhaseRatios,beforeRatios,'identity edits retain precise, incomplete percentages')
   const legacyRows=version().departmentInvestments.map(row=>({...row,...Object.fromEntries(fields.filter(f=>f.key!=='projectPeriod').map((f,index)=>[f.key,index===0?5:0])),estimatedInvestment:5}))
   store.getState().updateVersionDepartmentInvestments(p.id,id,legacyRows)
   const legacyRatios=get('src/lib/resourceRatios.ts').getResourcePhaseRatios(kind.toLowerCase(),version(),version().departmentInvestments[0])
   assert.equal(legacyRatios[fields[0].key],100,'legacy department action cannot leave stale percentage data')
 }
 // Copy a populated snapshot to exercise actual generated monthly rows and precision guards.
 const source=read().versions.find(v=>v.budgetType==='annual' && v.id!==id && v.id!==copyId)
 assert.ok(source)
 const monthlyId=store.getState().createResourceVersion(p.id,'annual',scope,{versionNumber:'9.1',sourceVersionId:source.id})
 const monthlyVersion=()=>read().versions.find(v=>v.id===monthlyId)
 const monthRow=()=>store.getState().monthlyInvestments.find(row=>row.versionId===monthlyId && !row.isArchived)
 assert.ok(monthRow())
 const range=get('src/lib/hrNonLaborRange.ts').hrNonLaborMonthRange(kind.toLowerCase(),monthlyVersion().milestones??monthlyVersion())
 const month=range.startMonth
 assert.ok(month)
 // Imported history can contain an out-of-range month; it remains editable, while new outside months cannot be added.
 store.setState({monthlyInvestments:store.getState().monthlyInvestments.map(row=>row.id===monthRow().id?{...row,monthlyData:{...row.monthlyData,'2030-01':1},isEdited:true}:row)})
 store.getState().updateResourceMonthlyInvestment(p.id,monthlyId,monthRow().id,'2030-01',0,scope)
 assert.equal(monthRow().monthlyData['2030-01'],0)
 const oldValue=monthRow().monthlyData[month]??0
 store.getState().updateResourceMonthlyInvestment(p.id,monthlyId,monthRow().id,month,oldValue+0.1,scope)
 assert.equal(monthRow().monthlyData[month],Math.round((oldValue+0.1)*10)/10)
 const saved=JSON.stringify(store.getState().projects),savedRows=JSON.stringify(store.getState().monthlyInvestments)
 for(const [testMonth,value,testScope] of [[month,-1,scope],[month,NaN,scope],[month,1.11,scope],['2099-01',1,scope],[month,1,'wrong'],[month,1,'']]) assert.throws(()=>store.getState().updateResourceMonthlyInvestment(p.id,monthlyId,monthRow().id,testMonth,value,testScope))
 assert.equal(JSON.stringify(store.getState().projects),saved)
 assert.equal(JSON.stringify(store.getState().monthlyInvestments),savedRows)
 assert.throws(()=>store.getState().setVersionActive(p.id,monthlyId,true),/合计|分配/)
 const countBeforeRefresh=read().resourceOperationLogs.length
 store.getState().refreshFormalProjects()
 await store.persist.rehydrate()
 assert.equal(read().resourceOperationLogs.length,countBeforeRefresh,'refresh/reload must not fabricate actions')
 assert.equal(monthRow().monthlyData[month],Math.round((oldValue+0.1)*10)/10)
 const expense=monthlyVersion().nonLaborInvestment
 if(expense?.items.length) {
  const item=expense.items[0],expenseMonth=Object.keys(item.monthlyAmounts)[0]
  if(expenseMonth) {
   const oldAmount=item.monthlyAmounts[expenseMonth]
   store.getState().updateVersionInline(p.id,monthlyId,{type:'nonLabor',value:{...expense,items:expense.items.map(row=>row.id===item.id?{...row,monthlyAmounts:{...row.monthlyAmounts,[expenseMonth]:oldAmount+1}}:row)}},scope)
   assert.ok(read().resourceOperationLogs.at(-1).changes.some(change=>change.field.includes(`${expenseMonth} 金额`) && change.field.includes(item.secondarySubject) && change.before===String(oldAmount)),'expense audit includes subject and individual month')
  }
 }
 store.getState().setVersionLocked(p.id,monthlyId,true)
 assert.throws(()=>store.getState().updateResourceMonthlyInvestment(p.id,monthlyId,monthRow().id,month,1,scope))
 assert.ok(read().resourceOperationLogs.find(log=>log.versionId===monthlyId && log.changes.some(change=>change.field.includes(month) && change.before===String(oldValue))))
 store.getState().setVersionLocked(p.id,id,true)
 assert.throws(()=>store.getState().updateVersionInline(p.id,id,{type:'batch',value:1},scope))
 store.getState().setVersionLocked(p.id,id,false)
 store.getState().deleteVersion(p.id,id)
 assert.ok(read().resourceOperationLogs.some(log=>log.versionId===id && /删除/.test(log.action)))
 assert.ok(read().resourceOperationLogs.every(log=>log.changes.every(change=>!change.field.includes('new-dept')&&!change.field.includes('monthlyAmounts'))),'audit exposes business paths rather than technical field keys')
 await store.persist.rehydrate()
 assert.ok(read().resourceOperationLogs.some(log=>log.versionId===id && /删除/.test(log.action)))
 console.log(`PASS ${kind}: named blank/copy, rehydrate, ratios, guards, no-op and durable deletion audit`)
}
