import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'
assert.ok(fs.existsSync('src/lib/templateIntervals.ts'), 'template interval calculation must exist')
const load = createTypeScriptModuleLoader()
const { calculateTemplateIntervals, updateTemplateInterval, withTemplateIntervalSummary } = load(path.resolve('src/lib/templateIntervals.ts'))
const tasks = [{id:'1',intervalDays:999},{id:'1.1',parentId:'1',intervalDays:10},{id:'1.2',parentId:'1',intervalDays:20},{id:'2'},{id:'2.1',parentId:'2',intervalDays:30},{id:'2.2',parentId:'2'},{id:'3'}]
const original = structuredClone(tasks)
const result = calculateTemplateIntervals(tasks)
assert.equal(result.totalDays,60,'parent values must not double-count milestone days')
assert.deepEqual(result.byId['1'],{intervalDays:30,intervalRatio:50,editable:false})
assert.deepEqual(result.byId['1.1'],{intervalDays:10,intervalRatio:100/6,editable:true})
assert.deepEqual(result.byId['2.2'],{intervalDays:null,intervalRatio:null,editable:true})
assert.deepEqual(result.byId['3'],{intervalDays:0,intervalRatio:0,editable:false})
const edited = updateTemplateInterval(tasks,'1.1',0)
assert.equal(calculateTemplateIntervals(edited).totalDays,50)
assert.equal(calculateTemplateIntervals(edited).byId['1'].intervalRatio,40)
const cleared = updateTemplateInterval(edited,'1.2',null)
assert.equal(calculateTemplateIntervals(cleared).totalDays,30)
assert.equal(calculateTemplateIntervals(cleared).byId['1.2'].intervalDays,null)
assert.throws(()=>updateTemplateInterval(tasks,'1',20),/里程碑/)
for(const invalid of [-1,NaN,Infinity,'3']) assert.throws(()=>updateTemplateInterval(tasks,'1.1',invalid))
assert.deepEqual(tasks,original,'edits and invalid updates preserve input snapshot')
assert.equal(calculateTemplateIntervals(tasks.filter(t=>t.id!=='2.1')).totalDays,30,'deleting a milestone recalculates denominator')
assert.equal(calculateTemplateIntervals([{id:'1'},{id:'1.1',parentId:'1',intervalDays:0}]).byId['1.1'].intervalRatio,0,'zero denominator is safe')
assert.equal(calculateTemplateIntervals([{id:'1'},{id:'orphan',parentId:'missing',intervalDays:10}]).totalDays,0)
assert.equal(calculateTemplateIntervals([{id:'1'},{id:'1.1',parentId:'1',intervalDays:0.1},{id:'1.2',parentId:'1',intervalDays:0.2}]).totalDays,0.3)
const compare = load(path.resolve('src/lib/versionCompare.ts')).compareVersionsForTable
const diff = compare(withTemplateIntervalSummary(tasks),withTemplateIntervalSummary(updateTemplateInterval(tasks,'1.1',40)))
assert.equal(diff.find(row=>row.taskId==='1.1').changeType,'修改')
assert.ok(diff.find(row=>row.taskId==='1').fieldDiffs.some(field=>field.field==='intervalDays'))
assert.ok(diff.find(row=>row.taskId==='2.1').fieldDiffs.some(field=>field.field==='intervalRatio'),'denominator-only percentage changes are visible')

globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = {localStorage}
const store = load(path.resolve('src/stores/plan.ts')).usePlanStore
const rules = load(path.resolve('src/lib/technicalPlanRules.ts'))
for(const scope of ['整机产品项目','tOS版本项目','能力建设项目',rules.TECHNICAL_TEMPLATE_STORAGE_KEYS.tdt]) {
 store.getState().setConfigTemplateTasksByType(previous=>({...previous,[scope]:structuredClone(edited)}))
 const key = `template::${scope}::level1::interval-test`
 store.getState().setPublishedSnapshots(previous=>({...previous,[key]:structuredClone(edited)}))
}
const fresh=createTypeScriptModuleLoader()(path.resolve('src/stores/plan.ts')).usePlanStore
await fresh.persist.rehydrate()
for(const scope of ['整机产品项目','tOS版本项目','能力建设项目',rules.TECHNICAL_TEMPLATE_STORAGE_KEYS.tdt]) {
 assert.equal(calculateTemplateIntervals(fresh.getState().configTemplateTasksByType[scope]).totalDays,50)
 assert.equal(calculateTemplateIntervals(fresh.getState().publishedSnapshots[`template::${scope}::level1::interval-test`]).totalDays,50)
}
console.log('PASS template intervals: stage/global totals, ratios, zero/clear/delete/decimal, invalid writes, snapshots, persistence and comparison')
