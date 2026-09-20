import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'

globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = { localStorage }
const load = createTypeScriptModuleLoader()
const get = file => load(path.resolve(file))
const rules = get('src/lib/level1PlanRules.ts')
const plan = get('src/stores/plan.ts')
const scheduling = get('src/lib/budgetMilestoneScheduling.ts')
const roots = tasks => tasks.filter(task => !task.parentId).map(task => task.taskName)
assert.deepEqual(roots(rules.buildMachineLevel1Tasks()), ['概念阶段', '计划阶段', '开发阶段', '验证阶段', '上市阶段', '生命周期阶段'])
assert.ok(roots(rules.buildTosLevel1Tasks()).includes('开发验证阶段'), 'tOS retains its combined stage')

// A real V9–V15 machine template with saved edits and custom rows.
const combined = plan.MACHINE_LEVEL1_TEMPLATE_TASKS.filter(task => task.stableId !== 'machine-stage-validation').map(task => ({ ...task }))
const development = combined.find(task => task.stableId === 'machine-stage-development')
development.taskName = '开发验证阶段'
combined.find(task => task.stableId === 'machine-ms-str5').parentId = development.id
combined.find(task => task.stableId === 'machine-ms-str5').order = 2
combined.filter(task => !task.parentId && task.order > development.order).forEach(task => { task.order -= 1 })
const str5 = combined.find(task => task.stableId === 'machine-ms-str5')
Object.assign(str5, { id: 'saved-str5', planEndDate: '2032-08-29', actualEndDate: '', intervalDays: 37, ownerMemo: '保留评审记录' })
combined.push({ id: 'user-42', stableId: 'custom-review', parentId: development.id, order: 3, taskName: '用户验证活动', source: 'custom', planEndDate: '2032-08-27', predecessor: 'saved-str5', ownerMemo: '保留自定义' })
const before = structuredClone(combined)
const input = {
  tasks: combined,
  configTemplateTasksByType: { 整机产品项目: combined, tOS版本项目: plan.TOS_LEVEL1_TEMPLATE_TASKS },
  marketPlanData: { OP: { tasks: combined, marker: 'keep-market' } },
  publishedSnapshots: {
    'template::整机产品项目::level1::v3': combined,
    'project::1::OP::level1::v3': combined,
    'project::user-machine::EU::level1::draft': combined,
    'project::1::level1::v3': combined,
    'project::user-machine::level1::v3': combined,
    'project::user-machine::EU::level2::v3': combined,
    'template::tOS版本项目::level1::v3': plan.TOS_LEVEL1_TEMPLATE_TASKS,
    'template::技术项目::tdt::v3': [{ id: 'tdt', taskName: '开发验证阶段' }],
  },
}
const migrated = plan.migratePlanStoreState(input, 15)
const outputs = [migrated.tasks, migrated.configTemplateTasksByType.整机产品项目, migrated.marketPlanData.OP.tasks,
  ...Object.entries(migrated.publishedSnapshots).filter(([key]) => key in input.publishedSnapshots && !key.includes('level2') && !key.includes('tOS') && !key.includes('技术')).map(([, tasks]) => tasks)]
for (const tasks of outputs) {
  assert.deepEqual(roots(tasks), ['概念阶段', '计划阶段', '开发阶段', '验证阶段', '上市阶段', '生命周期阶段'])
  const validation = tasks.find(task => task.stableId === 'machine-stage-validation')
  const migratedStr5 = tasks.find(task => task.id === 'saved-str5')
  assert.equal(migratedStr5.parentId, validation.id)
  assert.equal(migratedStr5.planEndDate, '2032-08-29')
  assert.equal(migratedStr5.actualEndDate, '')
  assert.equal(migratedStr5.intervalDays, 37)
  assert.equal(migratedStr5.ownerMemo, '保留评审记录')
  assert.deepEqual(tasks.find(task => task.id === 'user-42'), combined.at(-1), 'custom task identity, parent, dates, predecessor and fields survive')
  assert.equal(new Set(tasks.map(task => task.id)).size, tasks.length)
  assert.ok(tasks.every(task => !task.parentId || tasks.some(parent => parent.id === task.parentId)))
}
assert.deepEqual(combined, before, 'migration never mutates input')
assert.deepEqual(migrated.publishedSnapshots['project::user-machine::EU::level2::v3'], combined)
assert.deepEqual(migrated.publishedSnapshots['template::tOS版本项目::level1::v3'], input.publishedSnapshots['template::tOS版本项目::level1::v3'])
assert.deepEqual(migrated.publishedSnapshots['template::技术项目::tdt::v3'], input.publishedSnapshots['template::技术项目::tdt::v3'])
assert.deepEqual(plan.migratePlanStoreState(migrated, 15), migrated, 'repeated migration is idempotent')
const splitV8 = rules.buildMachineLevel1Tasks().map(task => task.stableId === 'machine-ms-str5' ? { ...task, id: 'original-str5' } : task)
const validationV8 = splitV8.find(task => task.stableId === 'machine-stage-validation')
splitV8.push({ id: 'original-custom', parentId: validationV8.id, source: 'custom', stableId: 'custom-kept', taskName: '保留任务', order: 8, predecessor: 'original-str5', ownerMemo: '跨版本保留' })
const upgradedV8 = plan.migratePlanStoreState({ tasks: splitV8 }, 8).tasks
assert.deepEqual(upgradedV8.find(task => task.id === 'original-custom'), splitV8.at(-1), 'old V8 migrations preserve user task IDs, order and references')
assert.ok(upgradedV8.some(task => task.id === 'original-str5'), 'old V8 milestone task IDs remain stable')
const renamedCombined = combined.map(task => task.stableId === 'machine-stage-concept' ? { ...task, taskName: '本项目概念阶段' } : task)
assert.equal(plan.migratePlanStoreState({ tasks: renamedCombined }, 15).tasks.find(task => task.stableId === 'machine-stage-concept').taskName, '本项目概念阶段')
const manualCombined = combined.map(task => task.id === development.id ? { ...task, source: 'manual' } : task)
assert.deepEqual(plan.migratePlanStoreState({ tasks: manualCombined }, 15).tasks, manualCombined, 'unrecognized source content remains exact')
const unknownShape = [{ id: 'unknown-shape', ownerMemo: '未识别数据' }]
assert.deepEqual(rules.splitMachineLevel1DevelopmentStage(unknownShape), unknownShape, 'unrecognized incomplete shapes survive without crashing hydration')
const simpleLegacy = [
  { id: '1', parentId: null, order: 1, taskName: '概念' },
  { id: '1.1', parentId: '1', order: 1, taskName: '概念启动' },
  { id: '1.2', parentId: '1', order: 2, taskName: 'STR1' },
  { id: '2', parentId: null, order: 2, taskName: '计划' },
  { id: '2.1', parentId: '2', order: 1, taskName: 'STR2' },
  { id: '2.2', parentId: '2', order: 2, taskName: 'STR3' },
  { id: '3', parentId: null, order: 3, taskName: '开发验证' },
  { id: '4', parentId: null, order: 4, taskName: '上市保障' },
  { id: 'legacy-custom', parentId: '4', order: 8, taskName: '保留自定义活动', source: 'custom', stableId: 'custom-business', predecessor: '2.2' },
]
const upgradedSimple = plan.migrateLevel1TasksForProjectType(simpleLegacy, '整机产品项目', true)
assert.deepEqual(upgradedSimple.find(task => task.id === 'legacy-custom'), simpleLegacy.at(-1), 'legacy seed upgrades keep custom IDs and their original parent identity')

const combinedSource = scheduling.BUDGET_SCHEDULE_SOURCES.machine
const weighted = scheduling.withDefaultBudgetScheduleIntervals('machine', combined)
weighted.find(task => task.id === 'saved-str5').intervalDays = 37
const model = scheduling.resolvePublishedBudgetScheduleModel({
  configTemplateVersionScopes: { [combinedSource.scopeKey]: { versions: [{ id: 'old', versionNo: 'V7', status: '已发布' }] } },
  publishedSnapshots: { [combinedSource.snapshotKey('old')]: weighted },
}, 'machine')
// Simulate an old saved snapshot independently of the resolver's new grouping.
const oldModel = structuredClone(model)
const developmentStage = oldModel.stages.find(stage => stage.milestones.some(m => m.fieldKey === 'str4'))
const validationStage = oldModel.stages.find(stage => stage.milestones.some(m => m.fieldKey === 'str5'))
if (validationStage !== developmentStage) {
  developmentStage.milestones.push(...validationStage.milestones)
  oldModel.stages = oldModel.stages.filter(stage => stage !== validationStage)
}
developmentStage.label = '开发验证阶段'
oldModel.milestones.find(m => m.fieldKey === 'str5').stageId = developmentStage.templateTaskId
developmentStage.milestones.find(m => m.fieldKey === 'str5').stageId = developmentStage.templateTaskId
const oldModelBefore = structuredClone(oldModel)
const normalized = scheduling.normalizeMachineBudgetScheduleStages(oldModel)
assert.deepEqual(normalized.stages.map(stage => stage.label), ['概念阶段', '计划阶段', '开发阶段', '验证阶段'])
assert.deepEqual(normalized.milestones.map(({ stageId, ...milestone }) => milestone), oldModel.milestones.map(({ stageId, ...milestone }) => milestone), 'snapshot interval weights and milestone IDs are unchanged')
assert.equal(normalized.totalModelDays, 117)
assert.equal(normalized.templateVersionId, 'old')
assert.deepEqual(oldModel, oldModelBefore)
assert.deepEqual(scheduling.normalizeMachineBudgetScheduleStages(normalized), normalized)
assert.doesNotThrow(() => scheduling.validateBudgetScheduleSnapshot('machine', normalized))
assert.deepEqual(scheduling.createBudgetMilestoneSchedule(normalized, '2026-01-01', '2026-12-31'), scheduling.createBudgetMilestoneSchedule(oldModel, '2026-01-01', '2026-12-31'), 'regrouping never reschedules saved dates')
assert.deepEqual(scheduling.normalizeMachineBudgetScheduleStages({ ...oldModel, category: 'tos' }), { ...oldModel, category: 'tos' }, 'tOS snapshots remain combined')

const store = get('src/stores/hrMachine.ts').useHrMachineStore
const project = store.getState().projects.find(item => item.versions.length)
const version = { ...structuredClone(project.versions[0]), scheduleModelSnapshot: oldModel, lockState: 'locked' }
const savedProjects = [{ ...project, versions: [version] }]
localStorage.setItem('pms-hr-machine', JSON.stringify({ version: 12, state: { projects: savedProjects, monthlyInvestments: [], registryMigrationComplete: true } }))
await store.persist.rehydrate()
const reloaded = store.getState().projects.find(item => item.id === project.id).versions[0]
assert.deepEqual(reloaded.scheduleModelSnapshot, normalized, 'locked resource snapshots migrate their grouping on hydration')
assert.deepEqual(reloaded.milestones, version.milestones, 'locked resource dates are unchanged')
assert.deepEqual(reloaded.modelSnapshot, version.modelSnapshot, 'investment model data is unchanged')
assert.equal(reloaded.lockState, 'locked')
console.log('PASS machine stage split: canonical templates, all persisted plan scopes, custom data and locked resource snapshots')
