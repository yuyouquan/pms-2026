#!/usr/bin/env node
import assert from 'node:assert/strict'
import { loadTypeScriptModule, projectRoot, readSource } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const rules = loadTypeScriptModule(root, 'src/lib/technicalPlanRules.ts')
assert.deepEqual(rules.TDT_TEMPLATE_SEED, [['规划阶段', ['规划启动', 'charter DCP']], ['概念阶段', ['TDR1']], ['计划阶段', ['TDR2', 'PDCP']], ['开发验证阶段', ['TDR3_X', 'TDCP_X']], ['迁移阶段', ['TDR4', 'EDCP']]], 'TDT seed is complete and ordered')
assert.deepEqual(rules.SUBPROJECT_TEMPLATE_SEED, ['第1版转测', '第2版转测', '第X版转测', 'TDR3'], 'subproject seed is ordered')
assert.throws(() => rules.validateTechnicalTemplateDepth('tdt', [{ children: [{ children: [{ children: [] }] }] }]), /depth/i)
assert.throws(() => rules.validateTechnicalTemplateDepth('subproject', [{ children: [{}] }]), /child/i)

const tdtTasks = rules.buildTdtTemplateTasks()
assert.deepEqual(tdtTasks.filter(task => !task.parentId).map(task => task.taskName), rules.TDT_TEMPLATE_SEED.map(([name]) => name), 'TDT phases use exact order')
for (const [phase, children] of rules.TDT_TEMPLATE_SEED) {
  const parent = tdtTasks.find(task => task.taskName === phase)
  assert.ok(parent, `TDT phase ${phase} exists`)
  assert.deepEqual(tdtTasks.filter(task => task.parentId === parent.id).map(task => task.taskName), children, `${phase} children and order are exact`)
}
assert.equal(rules.validateTechnicalTemplateDepth('tdt', tdtTasks), true, 'TDT seed is valid')

const subprojectTasks = rules.buildSubprojectTemplateTasks()
assert.deepEqual(subprojectTasks.map(task => task.taskName), rules.SUBPROJECT_TEMPLATE_SEED, 'subproject seed task order is exact')
assert.ok(subprojectTasks.every(task => !task.parentId), 'subproject seed is single-level')
assert.equal(rules.validateTechnicalTemplateDepth('subproject', subprojectTasks), true, 'subproject seed is valid')

const nontechnical = [{ id: 'keep', taskName: '保留原模板' }]
const migrated = rules.migrateTechnicalTemplateState({
  configTemplateTasksByType: {
    整机产品项目: nontechnical,
    技术项目: [{ id: 'legacy' }],
    '技术项目::一级计划': [{ id: 'legacy-l1' }],
  },
  publishedSnapshots: {
    'template::整机产品项目::level1::v3': nontechnical,
    'template::技术项目::level1::v3': [{ id: 'legacy-snapshot' }],
  },
  untouched: { value: 1 },
})
assert.strictEqual(migrated.configTemplateTasksByType.整机产品项目, nontechnical, 'migration preserves nontechnical template reference')
assert.deepEqual(migrated.untouched, { value: 1 }, 'migration preserves unrelated persisted state')
assert.deepEqual(migrated.configTemplateTasksByType[rules.TECHNICAL_TEMPLATE_STORAGE_KEYS.tdt], tdtTasks, 'migration resets legacy technical TDT template')
assert.deepEqual(migrated.configTemplateTasksByType[rules.TECHNICAL_TEMPLATE_STORAGE_KEYS.subproject], subprojectTasks, 'migration resets legacy technical subproject template')
assert.deepEqual(migrated.configTemplateTasksByType.技术项目, tdtTasks, 'migration resets legacy technical compatibility key to TDT seed')
assert.equal(migrated.configTemplateTasksByType['技术项目::一级计划'], undefined, 'migration removes legacy technical level key')
assert.strictEqual(migrated.publishedSnapshots['template::整机产品项目::level1::v3'], nontechnical, 'migration preserves nontechnical snapshots')
assert.deepEqual(migrated.publishedSnapshots['template::技术项目::tdt::v3'], tdtTasks, 'migration replaces legacy technical TDT snapshot')
assert.deepEqual(migrated.publishedSnapshots['template::技术项目::subproject::v3'], subprojectTasks, 'migration replaces legacy technical subproject snapshot')
assert.deepEqual(migrated.publishedSnapshots['template::技术项目::level1::v3'], tdtTasks, 'migration resets legacy technical compatibility snapshot')

const planSource = readSource(root, 'src/stores/plan.ts')
const configSource = readSource(root, 'src/containers/ConfigContainer.tsx')
assert.match(planSource, /PLAN_STORE_VERSION\s*=\s*\d+/, 'plan store declares a persistence version')
assert.match(planSource, /setTechnicalTemplateTasks/, 'plan store exposes a validating technical-template setter')
assert.match(planSource, /validateTechnicalTemplateDepth/, 'plan store enforces technical template depth')
assert.doesNotMatch(configSource, /publishedSnapshots\[versionId\]/, 'config snapshots never fall back across template scopes')

const memoryStorage = new Map()
globalThis.localStorage = {
  getItem: key => memoryStorage.get(key) ?? null,
  setItem: (key, value) => memoryStorage.set(key, value),
  removeItem: key => memoryStorage.delete(key),
}
const planModule = loadTypeScriptModule(root, 'src/stores/plan.ts')
const planStore = planModule.usePlanStore
const tdtScope = rules.getTemplateConfigScopeKey('技术项目', 'tdt')
const subprojectScope = rules.getTemplateConfigScopeKey('技术项目', 'subproject')
const tdtInitial = planStore.getState().configTemplateVersionScopes[tdtScope]
const subprojectInitial = planStore.getState().configTemplateVersionScopes[subprojectScope]
assert.ok(tdtInitial && subprojectInitial, 'both technical template version scopes are seeded')
assert.notStrictEqual(tdtInitial.versions, subprojectInitial.versions, 'technical tabs do not share version arrays')

planStore.getState().setConfigTemplateVersions(tdtScope, previous => [
  ...previous,
  { id: 'v-tdt-only', versionNo: 'V-TDT', status: '修订中' },
])
assert.equal(planStore.getState().setConfigTemplateCurrentVersion(tdtScope, 'v-tdt-only'), true, 'TDT can select its own revision')
assert.equal(planStore.getState().setConfigTemplateCurrentVersion(subprojectScope, 'v-tdt-only'), false, 'subproject rejects a nonexistent TDT version')
assert.equal(planStore.getState().configTemplateVersionScopes[subprojectScope].versions.some(version => version.id === 'v-tdt-only'), false, 'TDT revision never appears in subproject')

planStore.getState().setConfigTemplateVersions(subprojectScope, previous => [
  ...previous,
  { id: 'v-subproject-only', versionNo: 'V-SUB', status: '修订中' },
])
assert.equal(planStore.getState().setConfigTemplateCurrentVersion(subprojectScope, 'v-subproject-only'), true, 'subproject can select its own revision')
planStore.getState().setConfigTemplateVersions(tdtScope, previous => previous.map(version => (
  version.id === 'v-tdt-only' ? { ...version, status: '已发布' } : version
)))
planStore.getState().setConfigTemplateVersions(subprojectScope, previous => previous.map(version => (
  version.id === 'v-subproject-only' ? { ...version, status: '已发布' } : version
)))
assert.equal(planStore.getState().configTemplateVersionScopes[tdtScope].currentVersion, 'v-tdt-only', 'switching back restores TDT current version')
assert.equal(planStore.getState().configTemplateVersionScopes[subprojectScope].currentVersion, 'v-subproject-only', 'subproject current version remains independent')

assert.equal(planStore.getState().setConfigTemplateCompareVersions(tdtScope, 'v3', 'v-tdt-only'), true, 'TDT compare selects only versions in its scope')
assert.equal(planStore.getState().setConfigTemplateCompareVersions(subprojectScope, 'v3', 'v-tdt-only'), false, 'subproject compare rejects a TDT-only version')

const compatibility = loadTypeScriptModule(root, 'src/lib/projectTemplateCompatibility.ts')
const compare = loadTypeScriptModule(root, 'src/lib/versionCompare.ts')
const tdtPublishedTasks = [{ ...tdtTasks[0], taskName: 'TDT独立发布' }]
const subprojectPublishedTasks = [{ ...subprojectTasks[0], taskName: '子项目独立发布' }]
planStore.getState().setPublishedSnapshots(previous => ({
  ...previous,
  [compatibility.getTemplateSnapshotKey('技术项目', 'v-tdt-only', 'tdt')]: tdtPublishedTasks,
  [compatibility.getTemplateSnapshotKey('技术项目', 'v-subproject-only', 'subproject')]: subprojectPublishedTasks,
}))
const snapshots = planStore.getState().publishedSnapshots
assert.deepEqual(compatibility.getTemplateSnapshotForProjectType(snapshots, '技术项目', 'v-tdt-only', 'tdt'), tdtPublishedTasks, 'TDT publish stays in TDT snapshot scope')
assert.deepEqual(compatibility.getTemplateSnapshotForProjectType(snapshots, '技术项目', 'v-subproject-only', 'subproject'), subprojectPublishedTasks, 'subproject publish stays in subproject snapshot scope')
assert.equal(compatibility.getTemplateSnapshotForProjectType(snapshots, '技术项目', 'v-tdt-only', 'subproject'), undefined, 'subproject cannot read a TDT publication')
assert.equal(compare.compareVersionsForTable(tdtTasks, tdtPublishedTasks).some(row => row.changeType !== '未变更'), true, 'TDT compare uses its scoped publication')
assert.equal(compare.compareVersionsForTable(subprojectTasks, subprojectPublishedTasks).some(row => row.changeType !== '未变更'), true, 'subproject compare uses its scoped publication')

const machineScope = rules.getTemplateConfigScopeKey('整机产品项目', 'level1')
const migratedPlan = planModule.migratePlanStoreState({
  versions: [{ id: 'legacy-v', versionNo: 'V88', status: '已发布' }],
  currentVersion: 'legacy-v',
  configTemplateVersionScopes: {
    [machineScope]: {
      versions: [{ id: 'machine-v', versionNo: 'V99', status: '已发布' }],
      currentVersion: 'machine-v',
    },
  },
})
assert.deepEqual(migratedPlan.configTemplateVersionScopes[machineScope], {
  versions: [{ id: 'machine-v', versionNo: 'V99', status: '已发布' }],
  currentVersion: 'machine-v',
}, 'migration preserves an existing nontechnical version scope')
const editedTdt = [{ ...tdtTasks[0], taskName: '用户已编辑TDT模板' }]
const migratedFromTask10 = planModule.migratePlanStoreState({
  configTemplateTasksByType: {
    [rules.TECHNICAL_TEMPLATE_STORAGE_KEYS.tdt]: editedTdt,
  },
  publishedSnapshots: {
    'template::技术项目::tdt::v5': editedTdt,
  },
}, 1)
assert.deepEqual(migratedFromTask10.configTemplateTasksByType[rules.TECHNICAL_TEMPLATE_STORAGE_KEYS.tdt], editedTdt, 'v1 to v2 migration preserves edited TDT templates')
assert.deepEqual(migratedFromTask10.publishedSnapshots['template::技术项目::tdt::v5'], editedTdt, 'v1 to v2 migration preserves technical publications')
delete globalThis.localStorage

assert.match(configSource, /TDT项目计划/, 'technical config exposes TDT project plan tab')
assert.match(configSource, /子项目计划/, 'technical config exposes subproject plan tab')
assert.match(configSource, /isTechnicalTemplate/, 'technical config branches from generic templates')
assert.match(configSource, /setTechnicalTemplateTasks/, 'technical config writes through validated store action')
console.log('technical plan contract passed')
