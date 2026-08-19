#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { loadTypeScriptModule } from './lib/source-contract.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const loadTypescriptModule = async relativePath => {
  const modulePath = path.join(root, relativePath)
  const source = fs.readFileSync(modulePath, 'utf8')
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: modulePath,
  }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`)
}

const level1Rules = await loadTypescriptModule('src/lib/level1PlanRules.ts')
const technicalRules = await loadTypescriptModule('src/lib/technicalPlanRules.ts')
const ganttRules = await loadTypescriptModule('src/lib/planGanttRules.ts')
const projectSpaceLevel1Rules = await loadTypescriptModule('src/lib/projectSpaceLevel1Rules.ts')

const level1RenumberInput = [
  { id: 'root-b', stableId: 'stable-root-b', order: 9, taskName: '阶段B' },
  { id: 'child-b', stableId: 'stable-child-b', parentId: 'root-b', order: 5, taskName: '节点B' },
  { id: 'root-a', stableId: 'stable-root-a', order: 1, taskName: '阶段A' },
  { id: 'child-a', stableId: 'stable-child-a', parentId: 'root-a', order: 7, taskName: '节点A' },
]
const level1RenumberSnapshot = JSON.parse(JSON.stringify(level1RenumberInput))
const level1Renumbered = level1Rules.renumberLevel1Tasks(level1RenumberInput)
assert.deepEqual(level1Renumbered.map(task => [task.id, task.parentId || null, task.order, task.stableId]), [
  ['1', null, 1, 'stable-root-a'], ['1.1', '1', 1, 'stable-child-a'],
  ['2', null, 2, 'stable-root-b'], ['2.1', '2', 1, 'stable-child-b'],
], 'level1 renumbering assigns 1-based IDs, sibling orders, and rewritten parent IDs without changing stable IDs')
assert.deepEqual(level1RenumberInput, level1RenumberSnapshot, 'level1 renumbering does not mutate its input')

const launchStage = { id: 'launch', stableId: 'stage-launch', order: 2, taskName: '上市阶段', source: 'template' }
const machineMrTasks = [
  { id: '1', stableId: 'stage-concept', order: 1, taskName: '概念阶段', source: 'template' },
  { id: '1.1', stableId: 'mr-1', parentId: '1', order: 1, taskName: 'MR1', source: 'template' },
  { ...launchStage },
  { id: '2.1', stableId: 'mr-2', parentId: 'launch', order: 1, taskName: 'MR2', source: 'template' },
]
assert.equal(level1Rules.canAddLevel1CustomChild('整机产品项目', launchStage), false, 'launch-stage additions are reserved for controlled MR insertion')
const firstMrInsert = level1Rules.insertNextMachineMrMilestone(machineMrTasks)
assert.equal(firstMrInsert.ok, true, 'a machine launch stage accepts controlled MR insertion')
assert.equal(firstMrInsert.task.taskName, 'MR4', 'controlled MR insertion starts after MR3 even when only MR1 and MR2 exist')
assert.deepEqual(firstMrInsert.tasks.filter(task => task.parentId === firstMrInsert.tasks.find(task => task.stableId === 'stage-launch').id).map(task => task.taskName), ['MR2', 'MR4'], 'the inserted MR remains a launch-stage sibling')
assert.equal(firstMrInsert.task.source, 'custom', 'controlled MR insertion marks the task custom')
assert.equal(firstMrInsert.task.planStartDate, '', 'controlled MR starts without schedule dates')
assert.equal(firstMrInsert.task.estimatedDays, null, 'controlled MR has no preset duration')
assert.equal(firstMrInsert.task.status, '未开始', 'controlled MR begins unstarted')
assert.equal(firstMrInsert.task.progress, 0, 'controlled MR begins at zero progress')
assert.strictEqual(firstMrInsert.tasks.find(task => task.stableId === firstMrInsert.task.stableId), firstMrInsert.task, 'controlled MR result points into the renumbered output')
assert.equal(level1Rules.canMutateLevel1TaskStructure({ projectType: '整机产品项目', task: firstMrInsert.task, parent: firstMrInsert.tasks.find(task => task.id === firstMrInsert.task.parentId), action: 'rename' }), false, 'controlled MR cannot be renamed')
assert.equal(level1Rules.canMutateLevel1TaskStructure({ projectType: '整机产品项目', task: firstMrInsert.task, parent: firstMrInsert.tasks.find(task => task.id === firstMrInsert.task.parentId), action: 'reorder' }), false, 'controlled MR cannot be reordered')
assert.equal(level1Rules.canMutateLevel1TaskStructure({ projectType: '整机产品项目', task: firstMrInsert.task, parent: firstMrInsert.tasks.find(task => task.id === firstMrInsert.task.parentId), action: 'delete' }), true, 'controlled MR can be deleted')
const secondMrInsert = level1Rules.insertNextMachineMrMilestone(firstMrInsert.tasks)
assert.equal(secondMrInsert.ok, true, 'a second controlled MR can be inserted')
assert.equal(secondMrInsert.task.taskName, 'MR5', 'controlled MR insertion increments the highest existing MR')
const repeatedMrInsert = level1Rules.insertNextMachineMrMilestone(secondMrInsert.tasks.filter(task => task.stableId !== secondMrInsert.task.stableId))
assert.equal(repeatedMrInsert.ok, true, 'deleting a controlled MR permits replacement')
assert.equal(repeatedMrInsert.task.taskName, 'MR5', 'deleting MR5 makes the next controlled insertion MR5 again')
assert.deepEqual(level1Rules.insertNextMachineMrMilestone(machineMrTasks.filter(task => task.stableId !== 'stage-launch')), { ok: false, reason: 'launch-stage-missing' }, 'controlled MR insertion requires a launch stage')
assert.deepEqual(level1Rules.insertNextMachineMrMilestone([...machineMrTasks, { id: 'other.1', stableId: 'existing-mr4', parentId: '1', order: 2, taskName: 'MR4', source: 'custom' }]), { ok: false, reason: 'duplicate-name' }, 'a computed MR name already used outside the launch stage is rejected')
const originalDateNow = Date.now
const originalMathRandom = Math.random
let machineNonceCalls = 0
Date.now = () => { machineNonceCalls += 1; return 1_700_000_000_000 }
Math.random = () => 0.5
try {
  const fixedClockMrFirst = level1Rules.insertNextMachineMrMilestone(machineMrTasks)
  const fixedClockMrSecond = fixedClockMrFirst.ok && level1Rules.insertNextMachineMrMilestone(fixedClockMrFirst.tasks)
  assert.equal(fixedClockMrFirst.ok, true, 'controlled MR insertion works with a fixed nonce clock')
  assert.equal(fixedClockMrSecond.ok, true, 'a second controlled MR insertion works with the same fixed clock')
  assert.notEqual(fixedClockMrFirst.task.stableId, fixedClockMrSecond.task.stableId, 'fixed-clock MR insertions still produce unique stable IDs')
  assert.strictEqual(fixedClockMrSecond.tasks.find(task => task.stableId === fixedClockMrSecond.task.stableId), fixedClockMrSecond.task, 'the second fixed-clock MR result points into its returned tasks')
} finally {
  Date.now = originalDateNow
  Math.random = originalMathRandom
}
assert.equal(machineNonceCalls, 2, 'each controlled MR nonce reads Date.now exactly once')

assert.deepEqual(technicalRules.SUBPROJECT_TEMPLATE_SEED, ['第1版转测', '第2版转测', 'TDR3'], 'subproject seed contains only the two fixed transfer versions and TDR3')
const seededSubprojectTasks = technicalRules.buildSubprojectTemplateTasks()
const firstTransferInsert = technicalRules.insertNextTechnicalSubprojectTransfer(seededSubprojectTasks)
assert.equal(firstTransferInsert.ok, true, 'a configured subproject accepts a controlled transfer version')
assert.equal(firstTransferInsert.task.taskName, '第3版转测', 'the first controlled transfer version is 第3版转测')
assert.deepEqual(firstTransferInsert.tasks.map(task => task.taskName), ['第1版转测', '第2版转测', '第3版转测', 'TDR3'], 'the transfer version is inserted before TDR3')
assert.equal(firstTransferInsert.task.source, 'custom', 'controlled transfer version marks the task custom')
assert.equal(firstTransferInsert.task.responsible, '技术项目负责人', 'controlled transfer version has the technical-project owner')
assert.equal(firstTransferInsert.task.estimatedDays, 0, 'controlled transfer version starts with zero duration')
assert.strictEqual(firstTransferInsert.tasks.find(task => task.stableId === firstTransferInsert.task.stableId), firstTransferInsert.task, 'controlled transfer result points into the renumbered output')
const secondTransferInsert = technicalRules.insertNextTechnicalSubprojectTransfer(firstTransferInsert.tasks)
assert.equal(secondTransferInsert.ok, true, 'a second controlled transfer version can be inserted')
assert.equal(secondTransferInsert.task.taskName, '第4版转测', 'the second controlled transfer version is 第4版转测')
const repeatedTransferInsert = technicalRules.insertNextTechnicalSubprojectTransfer(secondTransferInsert.tasks.filter(task => task.stableId !== secondTransferInsert.task.stableId))
assert.equal(repeatedTransferInsert.ok, true, 'deleting a controlled transfer version permits replacement')
assert.equal(repeatedTransferInsert.task.taskName, '第4版转测', 'deleting 第4版转测 makes the next controlled insertion 第4版转测 again')
assert.deepEqual(technicalRules.insertNextTechnicalSubprojectTransfer(seededSubprojectTasks.filter(task => task.taskName !== 'TDR3')), { ok: false, reason: 'tdr3-missing' }, 'controlled transfer insertion requires TDR3')
assert.deepEqual(technicalRules.insertNextTechnicalSubprojectTransfer([
  ...seededSubprojectTasks,
  { ...seededSubprojectTasks[2], id: 'duplicate-tdr3', stableId: 'duplicate-tdr3', order: 4 },
]), { ok: false, reason: 'tdr3-invalid-position' }, 'duplicate TDR3 milestones reject controlled transfer insertion')
assert.deepEqual(technicalRules.insertNextTechnicalSubprojectTransfer([
  ...seededSubprojectTasks,
  { ...seededSubprojectTasks[0], id: 'after-tdr3', stableId: 'after-tdr3', order: 4, taskName: '第9版转测' },
]), { ok: false, reason: 'tdr3-invalid-position' }, 'a TDR3 tail activity rejects insertion instead of restarting transfer numbering')
const originalTechnicalDateNow = Date.now
const originalTechnicalMathRandom = Math.random
let technicalNonceCalls = 0
Date.now = () => { technicalNonceCalls += 1; return 1_700_000_000_001 }
Math.random = () => 0.5
try {
  const fixedClockTransferFirst = technicalRules.insertNextTechnicalSubprojectTransfer(seededSubprojectTasks)
  const fixedClockTransferSecond = fixedClockTransferFirst.ok && technicalRules.insertNextTechnicalSubprojectTransfer(fixedClockTransferFirst.tasks)
  assert.equal(fixedClockTransferFirst.ok, true, 'controlled transfer insertion works with a fixed nonce clock')
  assert.equal(fixedClockTransferSecond.ok, true, 'a second controlled transfer insertion works with the same fixed clock')
  assert.notEqual(fixedClockTransferFirst.task.stableId, fixedClockTransferSecond.task.stableId, 'fixed-clock transfer insertions still produce unique stable IDs')
  assert.strictEqual(fixedClockTransferSecond.tasks.find(task => task.stableId === fixedClockTransferSecond.task.stableId), fixedClockTransferSecond.task, 'the second fixed-clock transfer result points into its returned tasks')
} finally {
  Date.now = originalTechnicalDateNow
  Math.random = originalTechnicalMathRandom
}
assert.equal(technicalNonceCalls, 2, 'each controlled transfer nonce reads Date.now exactly once')
const historicalSubprojectSeed = [
  { id: '1', stableId: 'first', order: 1, taskName: '第1版转测', role: '自定义角色', responsible: '自定义负责人', planStartDate: '2027-01-02', planEndDate: '2027-01-03' },
  { id: '2', stableId: 'second', order: 2, taskName: '第2版转测' },
  { id: '3', stableId: 'third', order: 3, taskName: '第X版转测' },
  { id: '4', stableId: 'tdr3', order: 4, taskName: 'TDR3' },
]
const historicalSnapshots = { 'template::技术项目::subproject::v3': historicalSubprojectSeed }
const historicalScopes = { 'config-template::技术项目::subproject': { versions: [{ id: 'v3' }], currentVersion: 'v3' } }
const migratedSubprojectSeed = technicalRules.migrateTechnicalSubprojectSeedState({
  configTemplateTasksByType: { [technicalRules.TECHNICAL_TEMPLATE_STORAGE_KEYS.subproject]: historicalSubprojectSeed },
  publishedSnapshots: historicalSnapshots,
  configTemplateVersionScopes: historicalScopes,
})
assert.deepEqual(migratedSubprojectSeed.configTemplateTasksByType[technicalRules.TECHNICAL_TEMPLATE_STORAGE_KEYS.subproject].map(task => task.taskName), ['第1版转测', '第2版转测', 'TDR3'], 'only an untouched legacy subproject config seed migrates')
assert.strictEqual(migratedSubprojectSeed.configTemplateTasksByType[technicalRules.TECHNICAL_TEMPLATE_STORAGE_KEYS.subproject][0], historicalSubprojectSeed[0], 'conservative seed migration keeps the first transfer object and its stable ID')
assert.strictEqual(migratedSubprojectSeed.configTemplateTasksByType[technicalRules.TECHNICAL_TEMPLATE_STORAGE_KEYS.subproject][1], historicalSubprojectSeed[1], 'conservative seed migration keeps the second transfer object and its stable ID')
assert.deepEqual({ ...migratedSubprojectSeed.configTemplateTasksByType[technicalRules.TECHNICAL_TEMPLATE_STORAGE_KEYS.subproject][2], id: '4', order: 4 }, historicalSubprojectSeed[3], 'conservative seed migration keeps every TDR3 field except normalized display ID and order')
assert.deepEqual(migratedSubprojectSeed.configTemplateTasksByType[technicalRules.TECHNICAL_TEMPLATE_STORAGE_KEYS.subproject][0], historicalSubprojectSeed[0], 'conservative seed migration preserves user-owned fields on matching seed tasks')
assert.equal(migratedSubprojectSeed.configTemplateTasksByType[technicalRules.TECHNICAL_TEMPLATE_STORAGE_KEYS.subproject].some(task => task.taskName === '第X版转测'), false, 'conservative seed migration removes only the obsolete transfer placeholder')
assert.strictEqual(migratedSubprojectSeed.publishedSnapshots, historicalSnapshots, 'subproject seed migration leaves published snapshots untouched')
assert.strictEqual(migratedSubprojectSeed.configTemplateVersionScopes, historicalScopes, 'subproject seed migration leaves configuration history untouched')
const pipeNamedCustomSubprojectSeed = [
  { id: '1', stableId: 'custom-first', order: 1, taskName: '第1版转测' },
  { id: '2', stableId: 'custom-second', order: 2, taskName: '第2版转测|第X版转测' },
  { id: '3', stableId: 'custom-tdr3', order: 3, taskName: 'TDR3' },
]
const pipeNamedCustomState = { configTemplateTasksByType: { [technicalRules.TECHNICAL_TEMPLATE_STORAGE_KEYS.subproject]: pipeNamedCustomSubprojectSeed } }
assert.strictEqual(technicalRules.migrateTechnicalSubprojectSeedState(pipeNamedCustomState).configTemplateTasksByType[technicalRules.TECHNICAL_TEMPLATE_STORAGE_KEYS.subproject], pipeNamedCustomSubprojectSeed, 'a custom three-item template containing a seed separator remains untouched')
const customizedSubprojectSeed = technicalRules.migrateTechnicalSubprojectSeedState({
  configTemplateTasksByType: { [technicalRules.TECHNICAL_TEMPLATE_STORAGE_KEYS.subproject]: [{ ...historicalSubprojectSeed[0], taskName: '自定义第1版转测' }] },
})
assert.equal(customizedSubprojectSeed.configTemplateTasksByType[technicalRules.TECHNICAL_TEMPLATE_STORAGE_KEYS.subproject][0].taskName, '自定义第1版转测', 'customized subproject config templates remain untouched')

const hierarchy = [
  { id: 'concept', stableId: 'concept', order: 1, taskName: '概念阶段' },
  { id: 'concept-start', stableId: 'concept-start', parentId: 'concept', order: 1, taskName: '概念启动', planStartDate: '2026-01-01', planEndDate: '2026-01-05' },
  { id: 'str1', stableId: 'str1', parentId: 'concept', order: 2, taskName: 'STR1', planStartDate: '2026-01-02', planEndDate: '2026-01-17', estimatedDays: 99 },
  { id: 'plan', stableId: 'plan', order: 2, taskName: '计划阶段' },
  { id: 'str2', stableId: 'str2', parentId: 'plan', order: 1, taskName: 'STR2', planStartDate: '2026-02-01', planEndDate: '2026-02-10' },
]
const milestones = level1Rules.projectLevel1FlatMilestones(hierarchy, { today: '2026-01-20' })
assert.deepEqual(
  milestones.map(row => [row.sequence, row.stageName, row.milestoneName]),
  [[1, '概念阶段', '概念启动'], [2, '概念阶段', 'STR1'], [3, '计划阶段', 'STR2']],
  'flat milestone projection repeats its stage and excludes stage roots',
)
assert.equal(milestones.find(row => row.id === 'str1')?.estimatedDays, 15, 'valid date pairs override a stale stored milestone duration')

const technicalRows = level1Rules.projectTechnicalSubprojectRows([
  {
    id: '1', stableId: '1', order: 1, taskName: '第1版转测',
    planStartDate: '2026-03-01', planEndDate: '2026-03-15',
    actualStartDate: '2026-03-02', actualEndDate: '2026-03-16',
  },
])
assert.deepEqual(
  technicalRows.map(row => [row.sequence, row.activityName, row.planStartDate, row.planEndDate, row.actualStartDate, row.actualEndDate, row.estimatedDays, row.actualDays]),
  [[1, '第1版转测', '2026-03-01', '2026-03-15', '2026-03-02', '2026-03-16', 14, 14]],
  'technical subproject projection preserves all four dates and computes durations',
)
assert.deepEqual(
  technicalRows.map(row => [row.stageId, row.stageStableId, row.stageName, row.milestoneName]),
  [['', '', '', '']],
  'technical subproject projection leaves stage and milestone fields empty',
)

const invalid = technicalRules.validateTechnicalSubprojectDates([
  { id: '1', order: 1, taskName: '第1版转测', planStartDate: '2026-03-15', planEndDate: '2026-03-01', actualStartDate: '2026-03-16', actualEndDate: '2026-03-02' },
])
assert.equal(invalid.valid, false, 'inverted plan and actual dates are invalid')
assert.match(invalid.byTaskId['1'].planStartDate[0], /不得晚于/, 'plan start has the start-side reason')
assert.match(invalid.byTaskId['1'].planEndDate[0], /不得早于/, 'plan end has the end-side reason')
assert.match(invalid.byTaskId['1'].actualStartDate[0], /不得晚于/, 'actual start has the start-side reason')
assert.match(invalid.byTaskId['1'].actualEndDate[0], /不得早于/, 'actual end has the end-side reason')

const emptyDates = technicalRules.validateTechnicalSubprojectDates([
  { id: 'empty', order: 1, taskName: '空日期' },
  { id: 'partial-plan', order: 2, taskName: '仅计划开始', planStartDate: '2026-03-15' },
  { id: 'partial-actual', order: 3, taskName: '仅实际完成', actualEndDate: '2026-03-02' },
])
assert.equal(emptyDates.valid, true, 'empty and partial date pairs remain valid')
assert.deepEqual(emptyDates.byTaskId, {}, 'empty and partial date pairs add no field errors')

const ganttHierarchy = [
  { id: 'stage-1', stableId: 'stage-1', order: 1, taskName: '概念阶段' },
  { id: 'milestone-1', stableId: 'milestone-1', parentId: 'stage-1', order: 1, taskName: '概念启动', planStartDate: '2026-01-01', planEndDate: '2026-01-05', actualEndDate: '2026-01-06' },
  { id: 'milestone-2', stableId: 'milestone-2', parentId: 'stage-1', order: 2, taskName: 'STR1', planEndDate: '2026-01-16' },
  { id: 'stage-2', stableId: 'stage-2', order: 2, taskName: '计划阶段' },
  { id: 'milestone-3', stableId: 'milestone-3', parentId: 'stage-2', order: 1, taskName: 'STR2', planEndDate: '2026-02-10' },
]
const ganttHierarchySnapshot = JSON.parse(JSON.stringify(ganttHierarchy))
const hierarchicalGanttTasks = ganttRules.buildPlanGanttTasks(ganttHierarchy, { mode: 'hierarchical', editable: true })
assert.deepEqual(hierarchicalGanttTasks.map(task => [task.id, task.type, task.readonly, task.start_date, task.end_date, task.duration]), [
  ['stage-1', 'project', true, '2026-01-01', '2026-01-16', 15],
  ['milestone-1', 'milestone', false, '2026-01-05', '2026-01-05', 0],
  ['milestone-2', 'milestone', false, '2026-01-16', '2026-01-16', 0],
  ['stage-2', 'project', true, '2026-01-17', '2026-02-10', 24],
  ['milestone-3', 'milestone', false, '2026-02-10', '2026-02-10', 0],
], 'hierarchical gantt locks stage projects, renders editable children as zero-day milestones, and carries the previous stage end into later stage bounds')
assert.deepEqual(ganttHierarchy, ganttHierarchySnapshot, 'hierarchical gantt construction does not mutate source tasks')

const sparseStageGanttTasks = ganttRules.buildPlanGanttTasks([
  { id: 'sparse-stage', order: 1, taskName: '空白边界阶段' },
  { id: 'sparse-first', parentId: 'sparse-stage', order: 1, taskName: '空白首节点' },
  { id: 'sparse-date', parentId: 'sparse-stage', order: 2, taskName: '中间里程碑', planEndDate: '2026-01-10' },
  { id: 'sparse-last', parentId: 'sparse-stage', order: 3, taskName: '空白尾节点' },
], { mode: 'hierarchical', editable: true })
assert.deepEqual(sparseStageGanttTasks.find(task => task.id === 'sparse-stage'), {
  id: 'sparse-stage', order: 1, taskName: '空白边界阶段',
  type: 'project', readonly: true, start_date: '2026-01-10', end_date: '2026-01-10', duration: 0,
}, 'stage bounds skip empty edge children and use the first and last scheduled child values')

const technicalGanttTasks = ganttRules.buildPlanGanttTasks([
  { id: 'technical-1', order: 1, taskName: '第1版转测', planStartDate: '2026-03-01', planEndDate: '2026-03-15', estimatedDays: 14 },
], { mode: 'technical-subproject', editable: true })
assert.deepEqual(technicalGanttTasks.map(task => [task.type, task.readonly, task.start_date, task.end_date, task.duration]), [
  ['task', false, '2026-03-01', '2026-03-15', 14],
], 'technical subproject gantt keeps schedule ranges as editable task bars')
const sanitizedTechnicalGanttTasks = ganttRules.buildPlanGanttTasks([
  { id: 'technical-invalid', order: 1, taskName: '非法日期', planStartDate: '2026-02-30', planEndDate: 'bad-date' },
  { id: 'technical-leap', order: 2, taskName: '闰日半空', planStartDate: '2024-02-29', planEndDate: '' },
  { id: 'technical-end-only', order: 3, taskName: '结束半空', planStartDate: '', planEndDate: '2026-03-01' },
], { mode: 'technical-subproject', editable: true })
assert.deepEqual(sanitizedTechnicalGanttTasks.map(task => [task.start_date, task.end_date]), [
  ['', ''],
  ['2024-02-29', ''],
  ['', '2026-03-01'],
], 'technical gantt sanitizes invalid date strings while retaining valid partial schedule dates')
assert.equal(ganttRules.buildPlanGanttTasks(ganttHierarchy, { mode: 'hierarchical', editable: false }).find(task => task.id === 'milestone-1')?.readonly, true, 'non-editable gantts lock milestone nodes')

const milestoneDateChanged = ganttRules.applyPlanGanttDateChange(ganttHierarchy, {
  taskId: 'milestone-1', mode: 'milestone', startDate: '2026-01-12', endDate: '2026-01-12',
})
assert.deepEqual(milestoneDateChanged.find(task => task.id === 'milestone-1'), {
  ...ganttHierarchy[1], planEndDate: '2026-01-12', estimatedDays: 11,
}, 'milestone dragging updates only its plan end and recalculates exclusive estimated days')
assert.deepEqual(ganttHierarchy, ganttHierarchySnapshot, 'milestone dragging does not mutate source tasks or actual dates')

const taskDateChanged = ganttRules.applyPlanGanttDateChange(technicalGanttTasks, {
  taskId: 'technical-1', mode: 'task', startDate: '2026-03-05', endDate: '2026-03-20',
})
assert.deepEqual(taskDateChanged.find(task => task.id === 'technical-1'), {
  ...technicalGanttTasks[0], planStartDate: '2026-03-05', planEndDate: '2026-03-20', estimatedDays: 15,
}, 'task dragging updates both plan dates and recalculates exclusive estimated days')

const datePatchSource = [{
  id: 'patch-1', order: 1, taskName: '日期修订',
  planStartDate: '2026-04-01', planEndDate: '2026-04-10', estimatedDays: 9,
  actualStartDate: '2026-04-02', actualEndDate: '2026-04-06', actualDays: 4,
}]
const actualDatePatched = ganttRules.applyPlanTaskDatePatch(datePatchSource, {
  taskId: 'patch-1', patch: { actualStartDate: '2026-04-03', actualEndDate: '2026-04-08' },
})
assert.deepEqual(actualDatePatched[0], {
  ...datePatchSource[0], actualStartDate: '2026-04-03', actualEndDate: '2026-04-08', actualDays: 5,
}, 'date patches recalculate actual duration from valid actual date pairs')
const invalidActualPatch = ganttRules.applyPlanTaskDatePatch(datePatchSource, {
  taskId: 'patch-1', patch: { actualEndDate: 'invalid-date' },
})
assert.notStrictEqual(invalidActualPatch, datePatchSource, 'invalid non-empty date patches return a cloned result')
assert.notStrictEqual(invalidActualPatch[0], datePatchSource[0], 'invalid non-empty date patches clone the target task')
assert.deepEqual(invalidActualPatch, datePatchSource, 'invalid non-empty date patches leave every target value unchanged')
const invalidDateWithEmptyOtherSide = [{ id: 'invalid-empty', order: 1, taskName: '空端无效日期', actualStartDate: '', actualEndDate: '', actualDays: 7 }]
assert.deepEqual(ganttRules.applyPlanTaskDatePatch(invalidDateWithEmptyOtherSide, {
  taskId: 'invalid-empty', patch: { actualEndDate: 'not-a-date' },
}), invalidDateWithEmptyOtherSide, 'an invalid non-empty date is rejected even when its other date is empty')
assert.deepEqual(ganttRules.applyPlanTaskDatePatch(invalidDateWithEmptyOtherSide, {
  taskId: 'invalid-empty', patch: { actualEndDate: '2026-02-30' },
}), invalidDateWithEmptyOtherSide, 'calendar-impossible ISO dates are rejected even when their other date is empty')
const datePatchSnapshot = JSON.parse(JSON.stringify(datePatchSource))
assert.deepEqual(ganttRules.applyPlanTaskDatePatch(datePatchSource, {
  taskId: 'patch-1', patch: { actualEndDate: '' },
})[0], {
  ...datePatchSource[0], actualEndDate: '', actualDays: 4,
}, 'partial actual date patches apply the entered value while preserving the existing actual duration')
assert.deepEqual(datePatchSource, datePatchSnapshot, 'partial date patches do not mutate source tasks')

const extendedTaskSource = [{
  id: 'extended', order: 1, taskName: '扩展字段任务', defaultRoadmap: true,
  planStartDate: '2026-05-01', planEndDate: '2026-05-03', estimatedDays: 2,
}]
const extendedTaskDrag = ganttRules.applyPlanGanttDateChange(extendedTaskSource, {
  taskId: 'extended', mode: 'task', startDate: '2026-05-02', endDate: '2026-05-05',
})
assert.equal(extendedTaskDrag[0].defaultRoadmap, true, 'gantt date changes preserve task extension fields')
const extendedTaskPatch = ganttRules.applyPlanTaskDatePatch(extendedTaskSource, {
  taskId: 'extended', patch: { planEndDate: '2026-05-04' },
})
assert.equal(extendedTaskPatch[0].defaultRoadmap, true, 'date patches preserve task extension fields')

const ganttHelperSource = fs.readFileSync(path.join(root, 'src/components/shared/PlanHelpers.tsx'), 'utf8')
assert.match(ganttHelperSource, /export interface DHTMLXGanttDateChange/, 'gantt exposes a typed date-change callback contract')
assert.match(ganttHelperSource, /onTaskDateChange\?: \(change: DHTMLXGanttDateChange\) => boolean/, 'gantt accepts an explicit accept-or-revert callback')
assert.match(ganttHelperSource, /nodeType: 'milestone' \| 'task'/, 'gantt date changes expose the dragged node type')
assert.match(ganttHelperSource, /getOnTaskDateChange: \(\) => onTaskDateChangeRef\.current/, 'gantt supplies the controller with the latest date-change callback')
assert.match(ganttHelperSource, /gantt\.config\.readonly_property = 'readonly'/, 'gantt honors per-task readonly state')
assert.match(ganttHelperSource, /type: t\.type \|\| \(t\.parentId \? 'task' : 'project'\)/, 'gantt locks legacy root rows when they do not carry an explicit type')
assert.match(ganttHelperSource, /pms-gantt-\$\{task\.type \|\| 'task'\}/, 'gantt emits a stable class for every task type')
assert.match(ganttHelperSource, /onBeforeTaskDrag/, 'gantt blocks forbidden drag attempts before they change task dates')
assert.match(ganttHelperSource, /onAfterTaskDrag/, 'gantt reports accepted task-date drags')
assert.match(ganttHelperSource, /onBeforeLightbox/, 'gantt blocks project and readonly task editing in the lightbox')
assert.match(ganttHelperSource, /gantt\.detachEvent\(beforeDragHandler\)/, 'gantt detaches date-drag guards during cleanup')
assert.match(ganttHelperSource, /gantt\.detachEvent\(afterDragHandler\)/, 'gantt detaches date-drag callbacks during cleanup')
assert.match(ganttHelperSource, /gantt\.detachEvent\(beforeLightboxHandler\)/, 'gantt detaches lightbox guards during cleanup')
assert.match(ganttHelperSource, /createPlanGanttInteractionController/, 'gantt delegates drag decisions to the tested pure interaction controller')
assert.match(ganttHelperSource, /interactionController\.clear\(\)/, 'gantt clears the controller snapshot during cleanup')
assert.match(fs.readFileSync(path.join(root, 'src/lib/planGanttRules.ts'), 'utf8'), /<Task extends Level1PlanTask>/, 'date updates retain generic task extension types')

const asYmd = value => value instanceof Date ? value.toISOString().slice(0, 10) : String(value)
const updates = []
let currentDateChangeCallback = () => true
const interactionController = ganttRules.createPlanGanttInteractionController({
  readOnly: false,
  getOnTaskDateChange: () => currentDateChangeCallback,
  formatDate: asYmd,
  updateTask: task => updates.push({ id: task.id, start: asYmd(task.start_date), end: asYmd(task.end_date) }),
})
const rootTask = { id: 1, type: 'project', readonly: false, start_date: new Date('2026-06-01T00:00:00Z'), end_date: new Date('2026-06-02T00:00:00Z') }
const readonlyTask = { id: 'readonly', type: 'task', readonly: true, start_date: new Date('2026-06-01T00:00:00Z'), end_date: new Date('2026-06-02T00:00:00Z') }
const editableTask = { id: 'editable', type: 'milestone', readonly: false, start_date: new Date('2026-06-01T00:00:00Z'), end_date: new Date('2026-06-01T00:00:00Z') }
assert.equal(interactionController.beforeDrag(rootTask), false, 'project roots cannot start a drag')
assert.equal(interactionController.beforeDrag(readonlyTask), false, 'readonly tasks cannot start a drag')
assert.equal(interactionController.beforeDrag(editableTask), true, 'editable leaf tasks can start a drag')
let latestCallbackPayload
currentDateChangeCallback = change => { latestCallbackPayload = change; return false }
editableTask.start_date = new Date('2026-06-04T00:00:00Z')
editableTask.end_date = new Date('2026-06-04T00:00:00Z')
interactionController.afterDrag(editableTask)
assert.deepEqual(latestCallbackPayload, { taskId: 'editable', nodeType: 'milestone', startDate: '2026-06-04', endDate: '2026-06-04' }, 'after drag reads the latest callback from its getter and formats controller dates')
assert.equal(asYmd(editableTask.start_date), '2026-06-01', 'a false callback restores the start snapshot')
assert.equal(asYmd(editableTask.end_date), '2026-06-01', 'a false callback restores the end snapshot')
assert.equal(updates.length, 1, 'a false callback updates the restored task exactly once')
currentDateChangeCallback = () => true
assert.equal(interactionController.beforeDrag(editableTask), true, 'a later drag stores a fresh snapshot')
editableTask.start_date = new Date('2026-06-05T00:00:00Z')
editableTask.end_date = new Date('2026-06-05T00:00:00Z')
interactionController.afterDrag(editableTask)
assert.equal(asYmd(editableTask.start_date), '2026-06-05', 'a true callback keeps dragged dates')
assert.equal(updates.length, 1, 'a true callback does not issue a restore update')
currentDateChangeCallback = () => false
editableTask.start_date = new Date('2026-06-06T00:00:00Z')
interactionController.afterDrag(editableTask)
assert.equal(asYmd(editableTask.start_date), '2026-06-06', 'completed drags do not reuse an old snapshot')
assert.equal(updates.length, 1, 'completed drags do not restore a second time')
assert.equal(interactionController.beforeDrag(editableTask), true, 'a drag before clear records a snapshot')
editableTask.start_date = new Date('2026-06-07T00:00:00Z')
interactionController.clear()
interactionController.afterDrag(editableTask)
assert.equal(asYmd(editableTask.start_date), '2026-06-07', 'clear prevents stale snapshots from being restored')
assert.equal(updates.length, 1, 'clear prevents stale restore updates')
assert.equal(interactionController.canOpenLightbox(rootTask), false, 'project roots cannot open the lightbox')
assert.equal(interactionController.canOpenLightbox(readonlyTask), false, 'readonly tasks cannot open the lightbox')
assert.equal(interactionController.canOpenLightbox(editableTask), true, 'editable leaves can open the lightbox')
const globallyReadonlyController = ganttRules.createPlanGanttInteractionController({ readOnly: true, getOnTaskDateChange: () => currentDateChangeCallback, formatDate: asYmd, updateTask: () => {} })
assert.equal(globallyReadonlyController.beforeDrag(editableTask), false, 'global readonly blocks drags')
assert.equal(globallyReadonlyController.canOpenLightbox(editableTask), false, 'global readonly blocks lightbox editing')

const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8')
const projectSpaceSource = read('src/containers/ProjectSpaceContainer.tsx')
for (const label of ['阶段', '里程碑点', '计划开发周期', '实际开发周期', '添加上市阶段 MR 里程碑']) {
  assert.match(projectSpaceSource, new RegExp(label), `project-space flat table contains ${label}`)
}
assert.match(projectSpaceSource, /insertNextMachineMrMilestone/, 'project-space adds controlled whole-machine MR milestones')
assert.match(projectSpaceSource, /projectLevel1FlatMilestones/, 'project-space projects governed plans into flat milestones')
assert.match(projectSpaceSource, /buildPlanGanttTasks/, 'project-space builds typed Gantt tasks')
assert.match(projectSpaceSource, /onTaskDateChange/, 'project-space persists accepted Gantt date changes')
assert.match(projectSpaceSource, /aria-label="计划版本"/, 'project-space version selector has an accessible plan-version label')
assert.match(projectSpaceSource, /const isGovernedLevel1Table = !isLevel2Custom\s*&& projectPlanLevel === 'level1'/, 'all level-one plans retain the existing governance branch')
assert.match(projectSpaceSource, /const isFlatGovernedLevel1Table = isGovernedLevel1Table/, 'flat governed plans use a separate whole-machine/tOS predicate')
assert.match(projectSpaceSource, /if \(isFlatGovernedLevel1Table\)/, 'only the separate flat predicate enters the flat table')
assert.doesNotMatch(projectSpaceSource, /canFullyEdit && !isFlatGovernedLevel1Table/, 'the flat predicate never enables ordinary level-one drag sorting')
const flatDatePatchStart = projectSpaceSource.indexOf('const patchFlatMilestoneDate')
const flatDatePatchEnd = projectSpaceSource.indexOf('const renderFlatDate', flatDatePatchStart)
assert.ok(flatDatePatchStart >= 0 && flatDatePatchEnd > flatDatePatchStart, 'flat table exposes a bounded date-patch path')
assert.doesNotMatch(projectSpaceSource.slice(flatDatePatchStart, flatDatePatchEnd), /validateLevel1MilestoneDates/, 'flat table date patches do not block partial repairs on full-sequence validation')
assert.match(projectSpaceSource, /okText: '确认添加'/, 'controlled MR confirmation uses the required action label')

const liveDraftTasks = [
  { id: '1', stableId: 'stage', order: 1, taskName: '阶段', planEndDate: '2026-01-01' },
  { id: '1.1', stableId: 'target', parentId: '1', order: 1, taskName: '目标', planEndDate: '2026-04-01', actualStartDate: '2026-03-01', actualEndDate: '', actualDays: null },
  { id: '1.2', stableId: 'custom-mr', parentId: '1', order: 2, taskName: 'MR4', source: 'custom', planEndDate: '2026-05-01' },
]
const publishedUpdatedTasks = [
  { id: '1', stableId: 'stage', order: 1, taskName: '阶段', planEndDate: '2026-01-01' },
  { id: '1.1', stableId: 'target', parentId: '1', order: 1, taskName: '目标', planEndDate: '2026-02-01', actualStartDate: '2026-03-02', actualEndDate: '2026-03-09', actualDays: 7 },
]
const mergedActualDraft = projectSpaceLevel1Rules.mergeActualFieldsByStableId(liveDraftTasks, publishedUpdatedTasks, 'target')
assert.deepEqual(mergedActualDraft.map(task => [task.stableId, task.planEndDate, task.actualStartDate || '', task.actualEndDate || '', task.actualDays ?? null]), [
  ['stage', '2026-01-01', '', '', null],
  ['target', '2026-04-01', '2026-03-02', '2026-03-09', 7],
  ['custom-mr', '2026-05-01', '', '', null],
], 'published actual updates merge only actual fields into the divergent live draft and retain custom MR order')
assert.deepEqual(projectSpaceLevel1Rules.mergeActualFieldsByStableId(liveDraftTasks, publishedUpdatedTasks, 'missing'), liveDraftTasks, 'a missing stable ID leaves live draft values unchanged')
assert.equal(liveDraftTasks[1].actualEndDate, '', 'actual-field merge never mutates the live draft input')

const flatFilterRows = [
  { id: '1.1', stableId: 'concept-start', parentId: '1', stageId: '1', sequence: 1, stageName: '概念阶段', milestoneName: '概念启动', status: '未开始', planEndDate: '2026-01-10', estimatedDays: 9, actualEndDate: '', actualDays: null },
  { id: '2.1', stableId: 'plan-str', parentId: '2', stageId: '2', sequence: 2, stageName: '计划阶段', milestoneName: 'STR1', status: '进行中', planEndDate: '2026-02-10', estimatedDays: 8, actualEndDate: '2026-02-11', actualDays: 9 },
]
assert.deepEqual(projectSpaceLevel1Rules.filterFlatLevel1Rows(flatFilterRows, [{ field: 'stageName', operator: 'contains', value: '概念' }]).map(row => row.id), ['1.1'], 'flat filters match displayed stage names')
assert.deepEqual(projectSpaceLevel1Rules.filterFlatLevel1Rows(flatFilterRows, [{ field: 'milestoneName', operator: 'contains', value: 'STR' }]).map(row => row.id), ['2.1'], 'flat filters match displayed milestone names')
assert.deepEqual(projectSpaceLevel1Rules.filterFlatLevel1Rows(flatFilterRows, [{ field: 'sequence', operator: 'equals', value: '2' }]).map(row => row.id), ['2.1'], 'flat filters match displayed sequence values')
const flatHierarchy = [
  { id: '1', stableId: 'stage-1', order: 1, taskName: '概念阶段' },
  { id: '1.1', stableId: 'concept-start', parentId: '1', order: 1, taskName: '概念启动' },
  { id: '2', stableId: 'stage-2', order: 2, taskName: '计划阶段' },
  { id: '2.1', stableId: 'plan-str', parentId: '2', order: 1, taskName: 'STR1' },
]
assert.deepEqual(projectSpaceLevel1Rules.selectFlatGanttHierarchy(flatHierarchy, [flatFilterRows[1]]).map(task => task.stableId), ['stage-2', 'plan-str'], 'flat Gantt filtering keeps matched milestones and their stages in original hierarchy order')
assert.deepEqual(projectSpaceLevel1Rules.selectFlatGanttHierarchy(flatHierarchy, []).map(task => task.id), [], 'flat Gantt filtering returns no hierarchy for no rows')
const openingScope = { projectId: 'machine', scopeKind: 'market', scopeValue: 'OP', versionId: 'v4', currentUser: '张三' }
assert.equal(projectSpaceLevel1Rules.canConfirmMachineMrInsertion({ openingScope, currentScope: openingScope, isMachineProject: true, isCurrentDraft: true, isEditMode: true, canMaintain: true, followedReadOnly: false }), true, 'fresh machine draft scope can insert MR')
assert.equal(projectSpaceLevel1Rules.canConfirmMachineMrInsertion({ openingScope, currentScope: { ...openingScope, scopeValue: 'TR' }, isMachineProject: true, isCurrentDraft: true, isEditMode: true, canMaintain: true, followedReadOnly: false }), false, 'a changed MR scope is rejected before writing')
assert.equal(projectSpaceLevel1Rules.canConfirmMachineMrInsertion({ openingScope, currentScope: openingScope, isMachineProject: true, isCurrentDraft: false, isEditMode: true, canMaintain: true, followedReadOnly: false }), false, 'a no-longer-draft MR scope is rejected before writing')
assert.deepEqual(projectSpaceLevel1Rules.getLevel1MaintainerUsers('', [{ name: '项目经理', members: ['角色经理'] }]), ['角色经理'], 'a project-manager role member is a level-one maintainer even when not listed as SPM')
assert.equal(projectSpaceLevel1Rules.getLevel1MaintainerUsers('', [{ name: '项目经理', members: ['角色经理'] }]).includes('非成员'), false, 'a non-member is not granted level-one maintenance through the project-manager role')
const persistedScopes = projectSpaceLevel1Rules.pickScopedPlanPersistence({ marketPlanData: { OP: {} }, marketFollowVersionMeta: { a: {} }, marketVersionsByKey: { a: [] }, marketCurrentVersionByKey: { a: 'v4' }, tosTypePlanDataByProjectId: { p: {} }, tosTypeVersionsByKey: { a: [] }, tosTypeCurrentVersionByKey: { a: 'v4' }, ignored: true })
assert.deepEqual(Object.keys(persistedScopes).sort(), ['marketCurrentVersionByKey', 'marketFollowVersionMeta', 'marketPlanData', 'marketVersionsByKey', 'tosTypeCurrentVersionByKey', 'tosTypePlanDataByProjectId', 'tosTypeVersionsByKey'], 'scoped plan persistence includes every live market and tOS scope field only')
assert.match(projectSpaceSource, /projectSpaceLevel1Rules|mergeActualFieldsByStableId/, 'project space wires the tested level-one helpers')
assert.match(projectSpaceSource, /rowKey=\{record => record\.stableId \|\| record\.id\}/, 'flat rows use stable IDs for React identity')

const technicalModuleSource = read('src/components/technical-project/TechnicalPlanModule.tsx')
const technicalWorkspaceSource = read('src/lib/technicalPlanWorkspace.ts')

const technicalPlanStoreModule = loadTypeScriptModule(root, 'src/stores/technicalPlan.ts')
const technicalWorkspaceModule = loadTypeScriptModule(root, 'src/lib/technicalPlanWorkspace.ts')
assert.deepEqual(technicalWorkspaceModule.getTechnicalPlanExportColumns('tdt').map(column => column.key), ['sequence', 'stageName', 'milestoneName', 'status', 'planEndDate', 'estimatedDays', 'actualEndDate', 'actualDays'], 'TDT export uses exactly the flat milestone columns')
assert.deepEqual(technicalWorkspaceModule.getTechnicalPlanExportColumns('subproject').map(column => column.key), ['sequence', 'activityName', 'status', 'planStartDate', 'planEndDate', 'estimatedDays', 'actualStartDate', 'actualEndDate', 'actualDays'], 'subproject export uses exactly the activity columns')
const technicalTdtRows = technicalWorkspaceModule.projectTechnicalPlanRows('tdt', flatHierarchy)
assert.deepEqual(technicalTdtRows.map(row => [row.stageName, row.milestoneName]), [['概念阶段', '概念启动'], ['计划阶段', 'STR1']], 'TDT row projection is flat milestones')
const technicalSubprojectRows = technicalWorkspaceModule.projectTechnicalPlanRows('subproject', seededSubprojectTasks)
assert.deepEqual(technicalSubprojectRows.map(row => [row.activityName, row.stageName]), [['第1版转测', ''], ['第2版转测', ''], ['TDR3', '']], 'subproject row projection never creates stage columns')
assert.deepEqual(technicalWorkspaceModule.filterTechnicalPlanGanttTasks(flatHierarchy, 'tdt', [technicalTdtRows[1]]).map(task => task.stableId), ['stage-2', 'plan-str'], 'TDT Gantt filtering retains the matched milestone and its parent stage')
assert.deepEqual(technicalWorkspaceModule.filterTechnicalPlanGanttTasks(seededSubprojectTasks, 'subproject', [technicalSubprojectRows[1]]).map(task => task.stableId), [seededSubprojectTasks[1].stableId], 'subproject Gantt filtering stays one-level')
const publishedActualStore = technicalPlanStoreModule.createTechnicalPlanStore({ plansByKey: {} })
const publishedActualScope = { kind: 'tdt', parentProjectId: 'published-actual' }
const publishedActualTasks = technicalRules.buildTdtTemplateTasks()
assert.equal(publishedActualStore.createRevision({ scope: publishedActualScope, templateKind: 'tdt', templateTasks: publishedActualTasks }).ok, true, 'published-actual fixture creates V1')
assert.equal(publishedActualStore.publishRevision(publishedActualScope, '2026-01-01T00:00:00Z').ok, true, 'published-actual fixture publishes V1')
assert.equal(publishedActualStore.createRevision({ scope: publishedActualScope, templateKind: 'tdt', templateTasks: publishedActualTasks }).ok, true, 'published-actual fixture creates a paired draft')
const publishedActualInstance = publishedActualStore.getState().plansByKey['published-actual:tdt']
const pairedDraft = publishedActualInstance.versions.find(version => version.status === '修订中')
const latestPublished = publishedActualInstance.versions.find(version => version.status === '已发布')
const targetStableId = pairedDraft.tasks[1].stableId
const divergentDraft = [
  ...pairedDraft.tasks.map(task => task.stableId === targetStableId ? { ...task, taskName: '草稿保留名称', planEndDate: '2026-10-01' } : task),
  { ...pairedDraft.tasks[1], id: 'custom-draft', stableId: 'custom-draft', source: 'custom', order: 999, taskName: '草稿自定义节点', parentId: pairedDraft.tasks[0].id },
]
assert.equal(publishedActualStore.updateCurrentTasks(publishedActualScope, divergentDraft, 2).ok, true, 'paired draft accepts divergent plan and custom-task values')
assert.equal(publishedActualStore.setCurrentVersion(publishedActualScope, latestPublished.id), true, 'published-actual fixture selects latest published V1')
const publishedActualWrite = latestPublished.tasks.map(task => task.stableId === targetStableId
  ? { ...task, taskName: '不可覆盖的发布名称', planEndDate: '2026-09-01', actualStartDate: '2026-08-02', actualEndDate: '2026-08-09', actualDays: 999 }
  : task)
assert.equal(publishedActualStore.updateCurrentTasks(publishedActualScope, publishedActualWrite, 2).ok, true, 'latest published version accepts actual-date-only updates')
const afterPublishedActualWrite = publishedActualStore.getState().plansByKey['published-actual:tdt']
const afterPublishedTarget = afterPublishedActualWrite.versions.find(version => version.id === latestPublished.id).tasks.find(task => task.stableId === targetStableId)
const afterDraftTarget = afterPublishedActualWrite.versions.find(version => version.status === '修订中').tasks.find(task => task.stableId === targetStableId)
const afterDraftCustom = afterPublishedActualWrite.versions.find(version => version.status === '修订中').tasks.find(task => task.stableId === 'custom-draft')
assert.deepEqual([afterPublishedTarget.taskName, afterPublishedTarget.planEndDate, afterPublishedTarget.actualStartDate, afterPublishedTarget.actualEndDate, afterPublishedTarget.actualDays], [latestPublished.tasks.find(task => task.stableId === targetStableId).taskName, latestPublished.tasks.find(task => task.stableId === targetStableId).planEndDate, '2026-08-02', '2026-08-09', 7], 'published writes preserve plan fields and recompute actual duration')
assert.deepEqual([afterDraftTarget.taskName, afterDraftTarget.planEndDate, afterDraftTarget.actualStartDate, afterDraftTarget.actualEndDate, afterDraftTarget.actualDays], ['草稿保留名称', '2026-10-01', '2026-08-02', '2026-08-09', 7], 'published writes merge actual fields by stable ID into the paired draft without replacing draft plan fields')
assert.equal(afterDraftCustom?.taskName, '草稿自定义节点', 'published writes retain paired-draft custom tasks')
assert.equal(publishedActualStore.publishRevision(publishedActualScope, '2026-02-01T00:00:00Z').ok, true, 'published-actual fixture publishes V2')
const historicalVersionId = afterPublishedActualWrite.versions.find(version => version.id === latestPublished.id).id
assert.equal(publishedActualStore.setCurrentVersion(publishedActualScope, historicalVersionId), true, 'published-actual fixture selects historical V1')
assert.deepEqual(publishedActualStore.updateCurrentTasks(publishedActualScope, publishedActualWrite, 2), { ok: false, reason: 'historical-published' }, 'historical published versions are immutable')

for (const label of ['阶段', '里程碑点', '活动名称', '添加转测版本', '实际开始时间', '实际完成时间']) {
  assert.match(technicalModuleSource, new RegExp(label), `technical plan contains ${label}`)
}
assert.match(technicalModuleSource, /insertNextTechnicalSubprojectTransfer/, 'technical plan inserts controlled transfer versions')
assert.match(technicalModuleSource, /projectTechnicalSubprojectRows/, 'technical plan projects subproject activities without a fake stage tree')
assert.match(technicalModuleSource, /buildPlanGanttTasks/, 'technical plan builds typed Gantt tasks')
assert.match(technicalModuleSource, /onTaskDateChange/, 'technical plan persists accepted Gantt date changes')
assert.match(technicalModuleSource, /applyPlanTaskDatePatch/, 'technical plan recomputes date durations through the shared patch helper')
assert.match(technicalWorkspaceSource, /TECHNICAL_TDT_EXPORT_COLUMNS/, 'technical workspace exposes TDT export columns')
assert.match(technicalWorkspaceSource, /TECHNICAL_SUBPROJECT_EXPORT_COLUMNS/, 'technical workspace exposes subproject export columns')

const technicalStoreSource = read('src/stores/technicalPlan.ts')
assert.match(technicalStoreSource, /actualStartDate/, 'technical store safely supports published actual-start updates')
assert.match(technicalStoreSource, /actualDays/, 'technical store synchronizes actual duration when actual dates change')

console.log('PASS level1 flat milestone and gantt rules')
