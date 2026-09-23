import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'
globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = { localStorage }
const load = createTypeScriptModuleLoader()
const rules = load(path.resolve('src/lib/level1PlanRules.ts'))
const machine = rules.buildMachineLevel1Tasks()
const before = structuredClone(machine)
const projected = rules.projectLevel1Plan(machine).rows
assert.equal(projected.find(t => t.taskName === '验证阶段').displaySequence, '4', 'stage display numbering must not expose internal identity')
assert.equal(projected.find(t => t.taskName === 'STR5').displaySequence, '4.1')
assert.equal(projected.find(t => t.taskName === '上市阶段').displaySequence, '5')
assert.equal(projected.find(t => t.taskName === '生命周期阶段').displaySequence, '6')
assert.deepEqual(machine, before, 'display numbering must not change saved IDs or references')
for (const [type, tasks] of [['整机产品项目', machine], ['tOS版本项目', rules.buildTosLevel1Tasks()]]) {
 for (const stage of tasks.filter(t => rules.isBusinessStage(type,t))) {
  assert.equal(rules.getLevel1StructurePermissions({projectType:type,isDraft:false,isLatestPublished:true,isSuperAdmin:false,isSpm:true,parent:stage}).canAddChild,type === 'tOS版本项目','only tOS latest published business stages allow maintainers to add children')
  assert.equal(rules.getLevel1StructurePermissions({projectType:type,isDraft:true,isLatestPublished:false,isSuperAdmin:true,isSpm:true,parent:stage}).canAddChild,false,'business nodes cannot be manually added in a draft')
  assert.equal(rules.getLevel1StructurePermissions({projectType:type,isDraft:false,isLatestPublished:false,isSuperAdmin:true,isSpm:false,parent:stage}).canAddChild,false,'historical snapshots stay read only')
  assert.equal(rules.getLevel1StructurePermissions({projectType:type,isDraft:false,isLatestPublished:true,isSuperAdmin:false,isSpm:false,parent:stage}).canAddChild,false,'viewers cannot edit')
 }
 assert.equal(rules.getLevel1StructurePermissions({projectType:type,isDraft:false,isLatestPublished:true,isSuperAdmin:true,isSpm:false,parent:tasks[0]}).canAddChild,false,'other published stages remain locked')
}
const shared = load(path.resolve('src/lib/level1SharedBusinessTasks.ts'))
const stage = machine.find(t=>t.taskName==='上市阶段')
const child = {id:'5.1',stableId:'shared-a',parentId:stage.id,order:0,taskName:'MR1',nodeKind:'business-period',source:'custom',planStartDate:'2027-01-01',planEndDate:'2027-01-10'}
const draft = [...machine,child]
const sharedTasks = shared.captureLevel1BusinessTasks('整机产品项目',draft)
const published = machine.map(t=>({...t,planEndDate:t.taskName==='STR1'?'2026-01-01':t.planEndDate}))
const next = shared.applyLevel1BusinessTasks('整机产品项目',published,sharedTasks)
assert.equal(next.find(t=>t.stableId==='shared-a').taskName,'MR1')
assert.equal(next.find(t=>t.taskName==='STR1').planEndDate,'2026-01-01','sharing must not copy unrelated draft milestone dates')
assert.deepEqual(published,machine.map(t=>({...t,planEndDate:t.taskName==='STR1'?'2026-01-01':t.planEndDate})),'historical source is immutable')
const cleared = shared.captureLevel1BusinessTasks('整机产品项目',next.filter(t=>t.stableId!=='shared-a'))
assert.equal(shared.applyLevel1BusinessTasks('整机产品项目',draft,cleared).some(t=>t.stableId==='shared-a'),false,'deletion must not resurrect on draft restore')
const changedParent = published.map(t=>({...t,id:t.id===stage.id?'new-stage-id':t.id}))
const remapped = shared.applyLevel1BusinessTasks('整机产品项目',changedParent,sharedTasks)
assert.equal(remapped.find(t=>t.stableId==='shared-a').parentId,'new-stage-id','template renumbering preserves parent links')
const seededB = shared.selectLevel1BusinessSeedTasks({projectType:'整机产品项目',hasDraft:true,liveTasks:draft,latestPublishedTasks:published,projectSeedTasks:machine})
assert.equal(seededB.some(t=>t.stableId==='shared-a'),false,'unscoped legacy machine draft cannot seed another project')
assert.deepEqual(shared.selectLevel1BusinessSeedTasks({projectType:'tOS版本项目',hasDraft:true,liveTasks:draft,latestPublishedTasks:published,projectSeedTasks:machine}),published,'initial shared tOS business data comes from the latest publication')
const marketRules = load(path.resolve('src/lib/marketRules.ts'))
const follower = [...machine, {...child,stableId:'own-tr',id:'tr-own',taskName:'MR9',planStartDate:'2027-02-01'}]
const followed = marketRules.mergeFollowMarketActualDates(draft, follower)
assert.equal(followed.some(task => task.stableId === 'shared-a'),false,'following market must not copy main business children')
assert.equal(followed.find(task => task.stableId === 'own-tr').planStartDate,'2027-02-01','following market retains own MR dates')
assert.equal(marketRules.mergeFollowMarketActualDates(draft, machine).some(task => task.stableId === 'shared-a'),false,'empty local business collection stays empty on follow')
for (const type of ['整机产品项目','tOS版本项目']) {
 for (const [isDraft, isLatestPublished, isSuperAdmin, isSpm, expected] of [
  [false, true, true, false, true], [false, true, false, true, true],
  [false, true, false, false, false], [true, false, true, true, false], [false, false, true, true, false],
 ]) {
  assert.equal(rules.canEditLevel1BusinessActualDates({projectType:type,isDraft,isLatestPublished,isSuperAdmin,isSpm}),expected,'MR actual editing is latest-published and maintainer only')
 }
 for (const isDraft of [false,true]) {
  assert.equal(rules.canMaintainLevel1BusinessTasks({projectType:type,isDraft,isLatestPublished:!isDraft,isSuperAdmin:true,isSpm:false}),type==='tOS版本项目' && !isDraft)
 }
}
const planModule = load(path.resolve('src/stores/plan.ts'))
const legacy = {marketPlanData:{OP:{tasks:draft}},publishedSnapshots:{},level1BusinessTasksByScope:{}}
const migrated = planModule.migratePlanStoreState(legacy,16)
assert.deepEqual(migrated.legacyUnscopedMarketTasksByMarket.OP,draft,'unassigned legacy tasks must be archived without losing dates or fields')
assert.deepEqual(planModule.migratePlanStoreState({...migrated,marketPlanData:{OP:{tasks:machine}}},17).legacyUnscopedMarketTasksByMarket.OP,draft,'archive must not be overwritten on later migrations')
const versionList = [{id:'v3',versionNo:'V3',status:'已发布'},{id:'v4',versionNo:'V4',status:'修订中'}]
const uniqueLegacy = {marketPlanData:{OP:{tasks:[...machine,{...child,taskName:'MR2',planEndDate:'2027-01-12'}]}},marketVersionsByKey:{'project::B::OP::level1::versions':versionList},publishedSnapshots:{'project::B::OP::level1::v3':draft,'project::B::OP::level1::v2':draft}}
const restored = planModule.migratePlanStoreState(uniqueLegacy,16)
const restoredKey = shared.getLevel1BusinessScopeKey('B','market','OP')
assert.equal(restored.level1BusinessTasksByScope?.[restoredKey]?.[stage.stableId]?.[0].taskName,'MR2','uniquely owned legacy business changes remain visible')
assert.equal(restored.publishedSnapshots['project::B::OP::level1::v3'].find(t=>t.stableId==='shared-a').planEndDate,'2027-01-12','legacy restoration updates only current published projection')
assert.equal(restored.publishedSnapshots['project::B::OP::level1::v2'].find(t=>t.stableId==='shared-a').taskName,'MR1','historical snapshot stays immutable during migration')
const ambiguous = planModule.migratePlanStoreState({...uniqueLegacy,marketVersionsByKey:{...uniqueLegacy.marketVersionsByKey,'project::C::OP::level1::versions':versionList},publishedSnapshots:{...uniqueLegacy.publishedSnapshots,'project::C::OP::level1::v3':draft}},16)
assert.equal(Object.keys(ambiguous.level1BusinessTasksByScope || {}).length,0,'ambiguous legacy identities must not be assigned to any project')
const store = planModule.usePlanStore
store.setState({publishedSnapshots:{latest:published,history:published},level1BusinessTasksByScope:{},legacyUnscopedMarketTasksByMarket:migrated.legacyUnscopedMarketTasksByMarket})
store.getState().setLevel1BusinessTasks('machine:p1:OP','整机产品项目',draft,'latest')
assert.equal(store.getState().publishedSnapshots.latest.some(t=>t.stableId==='shared-a'),true)
assert.equal(store.getState().publishedSnapshots.history.some(t=>t.stableId==='shared-a'),false)
store.getState().setLevel1BusinessTasks('machine:p2:OP','整机产品项目',machine)
assert.equal(shared.applyLevel1BusinessTasks('整机产品项目',machine,store.getState().level1BusinessTasksByScope['machine:p1:OP']).some(t=>t.stableId==='shared-a'),true,'other scopes cannot overwrite shared tasks')
const persisted = JSON.parse(localStorage.getItem('pms-plan-store') || '{}')
assert.equal(persisted.state.level1BusinessTasksByScope['machine:p1:OP'][stage.stableId][0].taskName,'MR1','shared edits are persisted')
assert.deepEqual(persisted.state.legacyUnscopedMarketTasksByMarket.OP,draft,'legacy archive survives persistence')
console.log('PASS level-one numbering, latest-only permissions, shared edits, deletion, parent remapping, snapshots and scope isolation')
process.exit(0)
