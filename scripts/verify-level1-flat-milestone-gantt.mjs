#!/usr/bin/env node
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
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
const versionCompareRules = await loadTypescriptModule('src/lib/versionCompare.ts')

const machineTemplate = level1Rules.buildMachineLevel1Tasks(true)
const machineProjection = level1Rules.projectLevel1Plan(machineTemplate, { mode: 'standard', today: '2026-08-27' })
assert.equal(machineProjection.rows.length, machineTemplate.length, 'the nine-column tree projection preserves every whole-machine task')
assert.deepEqual(
  machineProjection.rows.find(row => row.taskName === '概念启动'),
  {
    ...machineTemplate.find(task => task.taskName === '概念启动'),
    planStartDate: '',
    estimatedDays: null,
    actualStartDate: '',
    actualDays: null,
    delayStatus: '延期',
    manpowerPercent: null,
    isMilestone: true,
  },
  'fixed milestones expose completion points without start dates or durations',
)
assert.equal(machineProjection.rows.find(row => row.taskName === '概念阶段').isMilestone, false, 'stage rows are not milestones')

const businessProjection = level1Rules.projectLevel1Plan([
  { id: 'stage', stableId: 'stage', parentId: null, order: 1, taskName: '业务阶段', nodeKind: 'stage' },
  {
    id: 'period', stableId: 'period', parentId: 'stage', order: 1, taskName: 'MR1', nodeKind: 'business-period',
    planStartDate: '2026-09-01', planEndDate: '2026-09-03', estimatedDays: 99,
    actualStartDate: '2026-09-02', actualEndDate: '2026-09-05', actualDays: 99,
  },
], { mode: 'standard', today: '2026-09-06' })
const businessStage = businessProjection.rows.find(row => row.id === 'stage')
const businessPeriod = businessProjection.rows.find(row => row.id === 'period')
assert.deepEqual(
  [businessPeriod.planStartDate, businessPeriod.planEndDate, businessPeriod.estimatedDays, businessPeriod.actualStartDate, businessPeriod.actualEndDate, businessPeriod.actualDays, businessPeriod.isMilestone],
  ['2026-09-01', '2026-09-03', 3, '2026-09-02', '2026-09-05', 4, false],
  'business periods preserve ranges and use inclusive planned and actual durations',
)
assert.deepEqual(
  [businessStage.planStartDate, businessStage.planEndDate, businessStage.estimatedDays, businessStage.actualStartDate, businessStage.actualEndDate, businessStage.actualDays, businessStage.isMilestone],
  ['2026-09-01', '2026-09-03', 3, '2026-09-02', '2026-09-05', 4, false],
  'stages derive inclusive schedule ranges from their children',
)

const fixedLegacyStartProjection = level1Rules.projectLevel1Plan([
  { id: 'fixed-stage', stableId: 'fixed-stage', parentId: null, order: 1, taskName: '固定节点阶段', nodeKind: 'stage' },
  {
    id: 'fixed-a', stableId: 'fixed-a', parentId: 'fixed-stage', order: 1, taskName: '固定节点A', nodeKind: 'fixed-milestone',
    planStartDate: '2026-01-01', planEndDate: '2026-01-10', actualStartDate: '2026-01-02', actualEndDate: '2026-01-11',
  },
  {
    id: 'fixed-b', stableId: 'fixed-b', parentId: 'fixed-stage', order: 2, taskName: '固定节点B', nodeKind: 'fixed-milestone',
    planEndDate: '2026-01-20', actualEndDate: '2026-01-21',
  },
], { mode: 'standard', today: '2026-01-22' })
const fixedLegacyStartStage = fixedLegacyStartProjection.rows.find(row => row.id === 'fixed-stage')
assert.deepEqual(
  [fixedLegacyStartStage.planStartDate, fixedLegacyStartStage.planEndDate, fixedLegacyStartStage.estimatedDays, fixedLegacyStartStage.actualStartDate, fixedLegacyStartStage.actualEndDate, fixedLegacyStartStage.actualDays],
  ['2026-01-10', '2026-01-20', 11, '2026-01-11', '2026-01-21', 11],
  'fixed milestone stages ignore legacy source starts and aggregate their completion points',
)

const partialBusinessProjection = level1Rules.projectLevel1Plan([
  { id: 'partial-stage', stableId: 'partial-stage', parentId: null, order: 1, taskName: '半填业务阶段', nodeKind: 'stage' },
  {
    id: 'end-only', stableId: 'end-only', parentId: 'partial-stage', order: 1, taskName: '仅完成时间', nodeKind: 'business-period',
    planEndDate: '2026-09-03', actualEndDate: '2026-09-05',
  },
  {
    id: 'start-only', stableId: 'start-only', parentId: 'partial-stage', order: 2, taskName: '仅开始时间', nodeKind: 'business-period',
    planStartDate: '2026-09-07', actualStartDate: '2026-09-08',
  },
], { mode: 'standard', today: '2026-09-10' })
const partialBusinessStage = partialBusinessProjection.rows.find(row => row.id === 'partial-stage')
assert.deepEqual(
  [partialBusinessStage.planStartDate, partialBusinessStage.planEndDate, partialBusinessStage.estimatedDays, partialBusinessStage.actualStartDate, partialBusinessStage.actualEndDate, partialBusinessStage.actualDays],
  ['', '', null, '', '', null],
  'partial business periods do not create a stage range without any complete interval',
)
assert.deepEqual(
  partialBusinessProjection.rows.filter(row => row.parentId).map(row => [row.estimatedDays, row.actualDays]),
  [[null, null], [null, null]],
  'partial business periods keep their own planned and actual durations empty',
)

const unknownBrowserCase = spawnSync(process.execPath, ['screenshots/verify-level1-flat-milestone-gantt-browser.mjs'], {
  cwd: root,
  encoding: 'utf8',
  env: { ...process.env, PMS_BROWSER_CASE: '__typo__' },
})
assert.notEqual(unknownBrowserCase.status, 0, 'an unknown browser case exits nonzero instead of reporting an empty PASS matrix')

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
const tdtDateFixture = [
  { id: 'phase', order: 1, taskName: '概念阶段', planStartDate: '2026-02-11', planEndDate: '2026-03-15' },
  { id: 'tdr1', parentId: 'phase', order: 1, taskName: 'TDR1', planStartDate: '2026-02-11', planEndDate: '2026-03-01', actualEndDate: '2026-03-01' },
  { id: 'tdr1-peer', parentId: 'phase', order: 2, taskName: '同日节点', planStartDate: '2026-02-11', planEndDate: '2026-03-01', actualEndDate: '2026-03-01' },
]
const tdtDateFixtureSnapshot = structuredClone(tdtDateFixture)
assert.equal(technicalRules.validateTechnicalTdtMilestoneDates(tdtDateFixture).valid, true, 'TDT permits same-day child planned and actual completion dates inside their readonly stage range')
assert.deepEqual(tdtDateFixture, tdtDateFixtureSnapshot, 'TDT validation leaves a valid input unchanged')
assert.equal(technicalRules.validateTechnicalTdtMilestoneDates(tdtDateFixture.map(task => task.id === 'tdr1' ? { ...task, planEndDate: '2026-02-10' } : task)).valid, false, 'TDT rejects a milestone before its parent stage range')
assert.equal(technicalRules.validateTechnicalTdtMilestoneDates(tdtDateFixture.map(task => task.id === 'tdr1' ? { ...task, planEndDate: '2026-03-16' } : task)).valid, false, 'TDT rejects a milestone after its parent stage range')
const outOfOrderTdt = tdtDateFixture.map(task => task.id === 'tdr1' ? { ...task, taskName: 'TDR2', planEndDate: '2026-03-20' } : task.id === 'tdr1-peer' ? { ...task, taskName: 'PDCP', planEndDate: '2026-03-10' } : { ...task, planEndDate: '2026-03-31' })
const outOfOrderTdtValidation = technicalRules.validateTechnicalTdtMilestoneDates(outOfOrderTdt)
assert.equal(outOfOrderTdtValidation.valid, false, 'TDT rejects a later sibling whose planned completion is earlier than the preceding milestone')
assert.ok(outOfOrderTdtValidation.byTaskId['tdr1-peer']?.planEndDate?.some(message => message.includes('不得早于前序')), 'the out-of-order TDT milestone identifies its planned completion field')
const outOfOrderTdtActual = tdtDateFixture.map(task => task.id === 'tdr1' ? { ...task, actualEndDate: '2026-03-10' } : task.id === 'tdr1-peer' ? { ...task, actualEndDate: '2026-03-05' } : task)
const outOfOrderTdtActualValidation = technicalRules.validateTechnicalTdtMilestoneDates(outOfOrderTdtActual)
assert.equal(outOfOrderTdtActualValidation.valid, false, 'TDT rejects a later sibling whose actual completion is earlier than the preceding milestone')
assert.ok(outOfOrderTdtActualValidation.byTaskId['tdr1-peer']?.actualEndDate?.some(message => message.includes('不得早于前序')), 'the out-of-order TDT milestone identifies its actual completion field')
const crossStageOutOfOrderTdt = [
  { id: 'phase-1', order: 1, taskName: '阶段一', planStartDate: '2026-02-01', planEndDate: '2026-03-31' },
  { id: 'phase-1.1', parentId: 'phase-1', order: 1, taskName: '阶段一节点', planEndDate: '2026-03-20', actualEndDate: '2026-03-20' },
  { id: 'phase-2', order: 2, taskName: '阶段二', planStartDate: '2026-04-01', planEndDate: '2026-05-31' },
  { id: 'phase-2.1', parentId: 'phase-2', order: 1, taskName: '阶段二节点', planEndDate: '2026-04-10', actualEndDate: '2026-03-10' },
]
const crossStageOutOfOrderValidation = technicalRules.validateTechnicalTdtMilestoneDates(crossStageOutOfOrderTdt)
assert.equal(crossStageOutOfOrderValidation.valid, false, 'TDT rejects a later-stage milestone whose actual completion is earlier in the global display sequence')
assert.ok(crossStageOutOfOrderValidation.byTaskId['phase-2.1']?.actualEndDate?.some(message => message.includes('不得早于前序')), 'cross-stage actual ordering identifies the later milestone field')
const invalidTdtActualDate = tdtDateFixture.map(task => task.id === 'tdr1-peer' ? { ...task, actualEndDate: 'not-a-date' } : task)
const invalidTdtActualValidation = technicalRules.validateTechnicalTdtMilestoneDates(invalidTdtActualDate)
assert.equal(invalidTdtActualValidation.valid, false, 'TDT rejects an invalid actual completion date format')
assert.ok(invalidTdtActualValidation.byTaskId['tdr1-peer']?.actualEndDate?.some(message => message.includes('格式')), 'invalid actual completion dates identify the actual field')
const emptyTdtMilestone = [{ ...tdtDateFixture[1], planStartDate: '', planEndDate: '' }]
const emptyTdtMilestoneBeforeValidation = structuredClone(emptyTdtMilestone)
assert.equal(technicalRules.validateTechnicalTdtMilestoneDates(emptyTdtMilestone).valid, true, 'TDT permits an empty milestone date')
assert.deepEqual(emptyTdtMilestone, emptyTdtMilestoneBeforeValidation, 'TDT validation leaves an empty-date input unchanged')
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
  { id: 'concept-start', stableId: 'concept-start', parentId: 'concept', order: 1, taskName: '概念启动', planStartDate: '2026-01-01', planEndDate: '2026-01-05', actualStartDate: '2026-01-02', actualEndDate: '2026-01-06' },
  { id: 'str1', stableId: 'str1', parentId: 'concept', order: 2, taskName: 'STR1', planStartDate: '2026-01-02', planEndDate: '2026-01-17', estimatedDays: 99, actualStartDate: '2026-01-03', actualEndDate: '2026-01-20', actualDays: 99 },
  { id: 'plan', stableId: 'plan', order: 2, taskName: '计划阶段' },
  { id: 'str2', stableId: 'str2', parentId: 'plan', order: 1, taskName: 'STR2', planStartDate: '2026-02-01', planEndDate: '2026-02-10', actualStartDate: '2026-02-02', actualEndDate: '' },
]
const milestones = level1Rules.projectLevel1FlatMilestones(hierarchy, { today: '2026-01-20' })
assert.deepEqual(
  milestones.map(row => [row.sequence, row.stageName, row.milestoneName]),
  [[1, '概念阶段', '概念启动'], [2, '概念阶段', 'STR1'], [3, '计划阶段', 'STR2']],
  'flat milestone projection repeats its stage and excludes stage roots',
)
assert.equal(milestones.find(row => row.id === 'concept-start')?.estimatedDays, 4, 'the first milestone retains its own start-to-completion duration fallback')
assert.equal(milestones.find(row => row.id === 'concept-start')?.actualDays, 4, 'the first milestone retains its own actual start-to-completion duration fallback')
assert.equal(milestones.find(row => row.id === 'str1')?.estimatedDays, 12, 'a milestone planned duration is its completion date minus the previous milestone completion date')
assert.equal(milestones.find(row => row.id === 'str1')?.actualDays, 14, 'a milestone actual duration is its actual completion date minus the previous milestone actual completion date')
assert.equal(milestones.find(row => row.id === 'str2')?.estimatedDays, 24, 'milestone duration continues across stage boundaries in the flat display order')
assert.equal(milestones.find(row => row.id === 'str2')?.actualDays, null, 'an actual duration remains empty when the current adjacent milestone has no actual completion date')

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

const equalFixedDates = [
  { id: 'equal-stage', order: 1, taskName: '同日阶段', nodeKind: 'stage' },
  { id: 'equal-a', parentId: 'equal-stage', order: 1, taskName: '同日节点A', nodeKind: 'fixed-milestone', planEndDate: '2026-03-10', actualEndDate: '2026-03-11' },
  { id: 'equal-b', parentId: 'equal-stage', order: 2, taskName: '同日节点B', nodeKind: 'fixed-milestone', planEndDate: '2026-03-10', actualEndDate: '2026-03-11' },
]
assert.equal(level1Rules.validateLevel1ScheduleDates(equalFixedDates).valid, true, 'fixed milestones permit equal planned and actual completion dates')

const equalCrossStageFixedDates = [
  { id: 'equal-stage-1', order: 1, taskName: '同日阶段一', nodeKind: 'stage' },
  { id: 'equal-stage-1-fixed', parentId: 'equal-stage-1', order: 1, taskName: '阶段一固定点', nodeKind: 'fixed-milestone', planEndDate: '2026-03-10', actualEndDate: '2026-03-11' },
  { id: 'equal-stage-2', order: 2, taskName: '同日阶段二', nodeKind: 'stage' },
  { id: 'equal-stage-2-fixed', parentId: 'equal-stage-2', order: 1, taskName: '阶段二固定点', nodeKind: 'fixed-milestone', planEndDate: '2026-03-10', actualEndDate: '2026-03-11' },
]
const equalCrossStageFixedValidation = level1Rules.validateLevel1ScheduleDates(equalCrossStageFixedDates)
assert.equal(equalCrossStageFixedValidation.valid, true, 'fixed milestones permit equal planned and actual completion points across stage boundaries')
assert.deepEqual(equalCrossStageFixedValidation.byTaskId, {}, 'cross-stage equal fixed points add no derived-stage errors')

const reversedFixedDates = [
  { id: 'fixed-stage-1', order: 1, taskName: '固定阶段一', nodeKind: 'stage' },
  { id: 'fixed-a', parentId: 'fixed-stage-1', order: 1, taskName: '固定节点A', nodeKind: 'fixed-milestone', planEndDate: '2026-03-10', actualEndDate: '2026-03-10' },
  { id: 'fixed-b', parentId: 'fixed-stage-1', order: 2, taskName: '固定节点B', nodeKind: 'fixed-milestone', planEndDate: '2026-03-10', actualEndDate: '2026-03-09' },
  { id: 'fixed-stage-2', order: 2, taskName: '固定阶段二', nodeKind: 'stage' },
  { id: 'fixed-c', parentId: 'fixed-stage-2', order: 1, taskName: '固定节点C', nodeKind: 'fixed-milestone', planEndDate: '2026-03-09', actualEndDate: '2026-03-11' },
]
const reversedFixedValidation = level1Rules.validateLevel1ScheduleDates(reversedFixedDates)
assert.equal(reversedFixedValidation.valid, false, 'fixed milestones reject planned and actual reversals in global display order')
assert.ok(reversedFixedValidation.byTaskId['fixed-b']?.actualEndDate?.some(message => message.includes('不得早于上一节点')), 'same-stage actual reversal identifies the later fixed milestone')
assert.ok(reversedFixedValidation.byTaskId['fixed-c']?.planEndDate?.some(message => message.includes('不得早于上一节点')), 'cross-stage planned reversal identifies the later fixed milestone')

const invalidBusinessRange = [{
  id: 'invalid-period', order: 1, taskName: '倒序业务节点', nodeKind: 'business-period',
  planStartDate: '2026-04-10', planEndDate: '2026-04-01',
  actualStartDate: '2026-04-12', actualEndDate: '2026-04-02',
}]
const invalidBusinessRangeValidation = level1Rules.validateLevel1ScheduleDates(invalidBusinessRange)
assert.equal(invalidBusinessRangeValidation.valid, false, 'business periods reject inverted planned and actual ranges')
assert.equal(invalidBusinessRangeValidation.byTaskId['invalid-period'].planStartDate.length > 0, true, 'an inverted planned range marks its start field')
assert.equal(invalidBusinessRangeValidation.byTaskId['invalid-period'].planEndDate.length > 0, true, 'an inverted planned range marks its completion field')
assert.equal(invalidBusinessRangeValidation.byTaskId['invalid-period'].actualStartDate.length > 0, true, 'an inverted actual range marks its start field')
assert.equal(invalidBusinessRangeValidation.byTaskId['invalid-period'].actualEndDate.length > 0, true, 'an inverted actual range marks its completion field')

const overlappingBusinessPeriods = [
  { id: 'period-stage', order: 1, taskName: '业务阶段', nodeKind: 'stage' },
  {
    id: 'period-a', parentId: 'period-stage', order: 1, taskName: '业务节点A', nodeKind: 'business-period',
    planStartDate: '2026-04-01', planEndDate: '2026-04-10',
    actualStartDate: '2026-04-02', actualEndDate: '2026-04-11',
  },
  {
    id: 'period-b', parentId: 'period-stage', order: 2, taskName: '业务节点B', nodeKind: 'business-period',
    planStartDate: '2026-04-10', planEndDate: '2026-04-20',
    actualStartDate: '2026-04-10', actualEndDate: '2026-04-21',
  },
]
const overlappingBusinessValidation = level1Rules.validateLevel1ScheduleDates(overlappingBusinessPeriods)
assert.ok(overlappingBusinessValidation.byTaskId['period-b']?.planStartDate?.some(message => message.includes('重叠')), 'same-day planned business boundaries count as overlap')
assert.ok(overlappingBusinessValidation.byTaskId['period-b']?.actualStartDate?.some(message => message.includes('重叠')), 'actual business periods validate independently from planned periods')

const longRunningBusinessOverlap = [
  { id: 'long-period-stage', order: 1, taskName: '长区间阶段', nodeKind: 'stage' },
  {
    id: 'long-period-a', parentId: 'long-period-stage', order: 1, taskName: '长区间A', nodeKind: 'business-period',
    planStartDate: '2026-04-01', planEndDate: '2026-04-20',
    actualStartDate: '2026-04-02', actualEndDate: '2026-04-21',
  },
  {
    id: 'long-period-b', parentId: 'long-period-stage', order: 2, taskName: '短区间B', nodeKind: 'business-period',
    planStartDate: '2026-04-02', planEndDate: '2026-04-03',
    actualStartDate: '2026-04-03', actualEndDate: '2026-04-04',
  },
  {
    id: 'long-period-c', parentId: 'long-period-stage', order: 3, taskName: '仍在A内的区间C', nodeKind: 'business-period',
    planStartDate: '2026-04-10', planEndDate: '2026-04-11',
    actualStartDate: '2026-04-11', actualEndDate: '2026-04-12',
  },
]
const longRunningBusinessValidation = level1Rules.validateLevel1ScheduleDates(longRunningBusinessOverlap)
assert.ok(longRunningBusinessValidation.byTaskId['long-period-c']?.planStartDate?.some(message => message.includes('重叠')), 'planned overlap detection retains an earlier long-running interval beyond its immediate neighbor')
assert.ok(longRunningBusinessValidation.byTaskId['long-period-c']?.actualStartDate?.some(message => message.includes('重叠')), 'actual overlap detection retains an earlier long-running interval beyond its immediate neighbor')

const overlappingStages = [
  { id: 'overlap-stage-1', order: 1, taskName: '重叠阶段一', nodeKind: 'stage' },
  { id: 'overlap-period-1', parentId: 'overlap-stage-1', order: 1, taskName: '阶段一业务节点', nodeKind: 'business-period', planStartDate: '2026-05-01', planEndDate: '2026-05-10' },
  { id: 'overlap-stage-2', order: 2, taskName: '重叠阶段二', nodeKind: 'stage' },
  { id: 'overlap-period-2', parentId: 'overlap-stage-2', order: 1, taskName: '阶段二业务节点', nodeKind: 'business-period', planStartDate: '2026-05-10', planEndDate: '2026-05-20' },
]
const overlappingStageValidation = level1Rules.validateLevel1ScheduleDates(overlappingStages)
assert.ok(overlappingStageValidation.byTaskId['overlap-period-2']?.planStartDate?.some(message => message.includes('阶段') && message.includes('重叠')), 'derived stage overlap maps to the editable child boundary field')
assert.equal(overlappingStageValidation.byTaskId['overlap-stage-2'], undefined, 'derived stage overlap does not mark the readonly stage row')

const longRunningStageOverlap = [
  { id: 'long-stage-a', order: 1, taskName: '长阶段A', nodeKind: 'stage' },
  {
    id: 'long-stage-period-a', parentId: 'long-stage-a', order: 1, taskName: '阶段A业务节点', nodeKind: 'business-period',
    planStartDate: '2026-01-01', planEndDate: '2026-01-30',
    actualStartDate: '2026-02-01', actualEndDate: '2026-02-28',
  },
  { id: 'short-stage-b', order: 2, taskName: '短阶段B', nodeKind: 'stage' },
  {
    id: 'short-stage-period-b', parentId: 'short-stage-b', order: 1, taskName: '阶段B业务节点', nodeKind: 'business-period',
    planStartDate: '2026-01-02', planEndDate: '2026-01-03',
    actualStartDate: '2026-02-02', actualEndDate: '2026-02-03',
  },
  { id: 'short-stage-c', order: 3, taskName: '仍在A内的阶段C', nodeKind: 'stage' },
  {
    id: 'short-stage-period-c', parentId: 'short-stage-c', order: 1, taskName: '阶段C业务节点', nodeKind: 'business-period',
    planStartDate: '2026-01-04', planEndDate: '2026-01-05',
    actualStartDate: '2026-02-04', actualEndDate: '2026-02-05',
  },
]
const longRunningStageValidation = level1Rules.validateLevel1ScheduleDates(longRunningStageOverlap)
assert.ok(longRunningStageValidation.byTaskId['short-stage-period-c']?.planStartDate?.some(message => message.includes('阶段') && message.includes('重叠')), 'planned stage overlap retains an earlier long-running stage beyond its immediate neighbor')
assert.ok(longRunningStageValidation.byTaskId['short-stage-period-c']?.actualStartDate?.some(message => message.includes('阶段') && message.includes('重叠')), 'actual stage overlap retains an earlier long-running stage beyond its immediate neighbor')

const unorderedStageBoundaryTasks = [
  { id: 'unordered-stage-a', order: 1, taskName: '乱序边界阶段A', nodeKind: 'stage' },
  {
    id: 'unordered-long-period', parentId: 'unordered-stage-a', order: 1, taskName: '长业务区间', nodeKind: 'business-period',
    planStartDate: '2026-01-01', planEndDate: '2026-01-30',
    actualStartDate: '2026-02-01', actualEndDate: '2026-02-28',
  },
  {
    id: 'unordered-later-fixed', parentId: 'unordered-stage-a', order: 2, taskName: '后置较早固定点', nodeKind: 'fixed-milestone',
    planEndDate: '2026-01-10', actualEndDate: '2026-02-10',
  },
  { id: 'unordered-stage-b', order: 2, taskName: '乱序边界阶段B', nodeKind: 'stage' },
  {
    id: 'unordered-next-period', parentId: 'unordered-stage-b', order: 1, taskName: '仍落在A内的后阶段', nodeKind: 'business-period',
    planStartDate: '2026-01-20', planEndDate: '2026-01-25',
    actualStartDate: '2026-02-20', actualEndDate: '2026-02-25',
  },
]
const unorderedStageBoundaryValidation = level1Rules.validateLevel1ScheduleDates(unorderedStageBoundaryTasks)
assert.ok(unorderedStageBoundaryValidation.byTaskId['unordered-next-period']?.planStartDate?.some(message => message.includes('阶段') && message.includes('重叠')), 'planned stage overlap uses the maximum valid child end instead of the last displayed child')
assert.ok(unorderedStageBoundaryValidation.byTaskId['unordered-next-period']?.actualStartDate?.some(message => message.includes('阶段') && message.includes('重叠')), 'actual stage overlap uses the maximum valid child end instead of the last displayed child')

const strictInvalidDates = [
  { id: 'strict-stage', order: 1, taskName: '严格日期阶段', nodeKind: 'stage' },
  { id: 'strict-fixed', parentId: 'strict-stage', order: 1, taskName: '非法固定节点', nodeKind: 'fixed-milestone', planEndDate: '2026-02-30' },
  { id: 'strict-period', parentId: 'strict-stage', order: 2, taskName: '非法业务节点', nodeKind: 'business-period', actualStartDate: 'not-a-date' },
]
const strictInvalidValidation = level1Rules.validateLevel1ScheduleDates(strictInvalidDates)
assert.ok(strictInvalidValidation.byTaskId['strict-fixed']?.planEndDate?.some(message => message.includes('格式')), 'calendar-impossible ISO dates are rejected')
assert.ok(strictInvalidValidation.byTaskId['strict-period']?.actualStartDate?.some(message => message.includes('格式')), 'non-ISO actual dates are rejected')

const partialScheduleDates = [
  { id: 'partial-neutral-stage', order: 1, taskName: '半填阶段', nodeKind: 'stage' },
  { id: 'partial-neutral-fixed', parentId: 'partial-neutral-stage', order: 1, taskName: '空固定节点', nodeKind: 'fixed-milestone' },
  { id: 'partial-neutral-plan', parentId: 'partial-neutral-stage', order: 2, taskName: '仅计划开始', nodeKind: 'business-period', planStartDate: '2026-06-01' },
  { id: 'partial-neutral-actual', parentId: 'partial-neutral-stage', order: 3, taskName: '仅实际完成', nodeKind: 'business-period', actualEndDate: '2026-06-10' },
]
const partialScheduleSnapshot = structuredClone(partialScheduleDates)
const partialScheduleValidation = level1Rules.validateLevel1ScheduleDates(partialScheduleDates)
assert.equal(partialScheduleValidation.valid, true, 'empty and partial schedule input remains neutral')
assert.deepEqual(partialScheduleValidation.byTaskId, {}, 'empty and partial schedule input adds no field errors')
assert.deepEqual(partialScheduleDates, partialScheduleSnapshot, 'unified schedule validation leaves nested task input unchanged')
assert.deepEqual(level1Rules.validateLevel1MilestoneDates(equalFixedDates), level1Rules.validateLevel1ScheduleDates(equalFixedDates), 'the milestone validator remains a compatibility alias for unified schedule validation')

const mixedGanttSource = [
  { id: 'mixed-stage', stableId: 'mixed-stage', order: 1, taskName: '混合阶段', nodeKind: 'stage' },
  {
    id: 'mixed-fixed', stableId: 'mixed-fixed', parentId: 'mixed-stage', order: 1, taskName: '固定点', nodeKind: 'fixed-milestone',
    planStartDate: '2026-03-01', planEndDate: '2026-03-31', estimatedDays: 99,
  },
  {
    id: 'mixed-period', stableId: 'mixed-period', parentId: 'mixed-stage', order: 2, taskName: 'MR1', nodeKind: 'business-period',
    planStartDate: '2026-04-01', planEndDate: '2026-04-10', estimatedDays: 99,
    actualStartDate: '2026-04-02', actualEndDate: '2026-04-11', actualDays: 99,
  },
  { id: 'partial-gantt-stage', stableId: 'partial-gantt-stage', order: 2, taskName: '半填阶段', nodeKind: 'stage' },
  {
    id: 'partial-gantt-period', stableId: 'partial-gantt-period', parentId: 'partial-gantt-stage', order: 1, taskName: '半填业务条', nodeKind: 'business-period',
    planStartDate: '2026-04-15', planEndDate: '',
  },
]
const mixedGanttSnapshot = structuredClone(mixedGanttSource)
const mixedGanttTasks = ganttRules.buildPlanGanttTasks(mixedGanttSource, { mode: 'hierarchical', editable: true })
assert.equal(mixedGanttTasks.find(task => task.id === 'mixed-stage')?.type, 'project', 'hierarchical gantt emits readonly project stages')
assert.equal(mixedGanttTasks.find(task => task.id === 'mixed-stage')?.readonly, true, 'hierarchical gantt stages remain readonly')
assert.deepEqual(
  mixedGanttTasks.filter(task => ['mixed-fixed', 'mixed-period'].includes(task.id)).map(task => [task.id, task.type, task.start_date, task.end_date, task.duration]),
  [
    ['mixed-fixed', 'milestone', '2026-03-31', '2026-03-31', 0],
    ['mixed-period', 'task', '2026-04-01', '2026-04-10', 10],
  ],
  'hierarchical gantt emits fixed completion points and inclusive business-period bars',
)
assert.deepEqual(
  mixedGanttTasks.find(task => task.id === 'partial-gantt-period'),
  { ...mixedGanttSource[4], type: 'task', readonly: false, start_date: '', end_date: '', duration: 0 },
  'an incomplete business period does not fabricate a gantt bar',
)
assert.deepEqual(mixedGanttSource, mixedGanttSnapshot, 'mixed gantt construction leaves source tasks deeply unchanged')

const fixedPointMoved = ganttRules.applyPlanGanttDateChange(mixedGanttSource, {
  taskId: 'mixed-fixed', mode: 'milestone', startDate: '2026-04-05', endDate: '2026-04-05',
})
assert.deepEqual(fixedPointMoved.find(task => task.id === 'mixed-fixed'), {
  ...mixedGanttSource[1], planEndDate: '2026-04-05',
}, 'fixed-point dragging patches only its planned completion field')

const businessPeriodMoved = ganttRules.applyPlanGanttDateChange(mixedGanttSource, {
  taskId: 'mixed-period', mode: 'task', startDate: '2026-04-02', endDate: '2026-04-11',
})
assert.deepEqual(businessPeriodMoved.find(task => task.id === 'mixed-period'), {
  ...mixedGanttSource[2], planStartDate: '2026-04-02', planEndDate: '2026-04-11', estimatedDays: 10,
}, 'business-period dragging patches both planned boundaries and recalculates an inclusive duration')
const businessActualPatched = ganttRules.applyPlanTaskDatePatch(mixedGanttSource, {
  taskId: 'mixed-period', patch: { actualStartDate: '2026-04-03', actualEndDate: '2026-04-12' },
})
assert.deepEqual(businessActualPatched.find(task => task.id === 'mixed-period'), {
  ...mixedGanttSource[2], actualStartDate: '2026-04-03', actualEndDate: '2026-04-12', actualDays: 10,
}, 'business-period actual patches retain actual semantics and recalculate an inclusive duration')
assert.strictEqual(ganttRules.applyPlanGanttDateChange(mixedGanttSource, {
  taskId: 'mixed-period', mode: 'task', startDate: '2026-04-12', endDate: '2026-04-11',
}), mixedGanttSource, 'an inverted gantt change returns the original input unchanged')
assert.strictEqual(ganttRules.applyPlanGanttDateChange(mixedGanttSource, {
  taskId: 'mixed-period', mode: 'task', startDate: '', endDate: '',
}), mixedGanttSource, 'an empty gantt change returns the original input unchanged')
assert.deepEqual(mixedGanttSource, mixedGanttSnapshot, 'mixed gantt date changes leave source tasks deeply unchanged')

const separatedBusinessStages = [
  { id: 'business-stage-a', order: 1, taskName: '业务阶段A', nodeKind: 'stage' },
  {
    id: 'business-stage-a-period', parentId: 'business-stage-a', order: 1, taskName: '业务阶段A区间', nodeKind: 'business-period',
    planStartDate: '2026-01-01', planEndDate: '2026-01-10',
  },
  { id: 'business-stage-b', order: 2, taskName: '业务阶段B', nodeKind: 'stage' },
  {
    id: 'business-stage-b-period', parentId: 'business-stage-b', order: 1, taskName: '业务阶段B区间', nodeKind: 'business-period',
    planStartDate: '2026-01-20', planEndDate: '2026-01-25',
  },
]
const separatedBusinessGantt = ganttRules.buildPlanGanttTasks(separatedBusinessStages, { mode: 'hierarchical', editable: true })
assert.equal(separatedBusinessGantt.find(task => task.id === 'business-stage-b')?.start_date, '2026-01-20', 'a later stage with a complete business interval keeps its own natural planned start')

const unorderedStageBoundaryGantt = ganttRules.buildPlanGanttTasks(unorderedStageBoundaryTasks, { mode: 'hierarchical', editable: true })
assert.deepEqual(
  unorderedStageBoundaryGantt.filter(task => task.id === 'unordered-stage-a').map(task => [task.start_date, task.end_date]),
  [['2026-01-01', '2026-01-30']],
  'a gantt parent stage spans the minimum valid child start through the maximum valid child end',
)

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
const ganttStyles = fs.readFileSync(path.join(root, 'src/styles/globals.css'), 'utf8')
assert.match(ganttHelperSource, /export interface DHTMLXGanttDateChange/, 'gantt exposes a typed date-change callback contract')
assert.match(ganttHelperSource, /onTaskDateChange\?: \(change: DHTMLXGanttDateChange\) => boolean/, 'gantt accepts an explicit accept-or-revert callback')
assert.match(ganttHelperSource, /nodeType: 'milestone' \| 'task'/, 'gantt date changes expose the dragged node type')
assert.match(ganttHelperSource, /getOnTaskDateChange: \(\) => onTaskDateChangeRef\.current/, 'gantt supplies the controller with the latest date-change callback')
assert.match(ganttHelperSource, /gantt\.config\.readonly_property = 'readonly'/, 'gantt honors per-task readonly state')
assert.match(ganttHelperSource, /gantt\.config\.drag_links = false/, 'plan gantt disables dependency-link dragging so milestone hit targets are not covered')
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
assert.match(ganttStyles, /\.gantt_task_line\.pms-gantt-milestone\s*\{[^}]*width:\s*14px !important;[^}]*transform:\s*rotate\(45deg\)/s, 'milestones render a 14px diamond hitbox')
assert.match(ganttStyles, /\.gantt_task_line\.pms-gantt-milestone\s+\.gantt_task_content\s*\{[^}]*display:\s*none/s, 'milestone hitbox does not render task-bar content')
assert.doesNotMatch(ganttStyles, /\.gantt_task_line\.pms-gantt-task-editable\s*\{[^}]*pointer-events:\s*none/s, 'task bars retain pointer interactions for move and resize')
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
const browserSource = read('screenshots/verify-level1-flat-milestone-gantt-browser.mjs')
const loadExportedConstFromSource = async (sourceText, exportName) => {
  const file = ts.createSourceFile('ProjectSpaceContainer.tsx', sourceText, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)
  let initializer = null
  const visit = node => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === exportName) initializer = node.initializer
    ts.forEachChild(node, visit)
  }
  visit(file)
  assert.ok(initializer, `project space exports ${exportName}`)
  const moduleSource = `export const ${exportName} = ${initializer.getText(file)}`
  const output = ts.transpileModule(moduleSource, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: 'ProjectSpaceContainer-helper.ts',
  }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`)
}
const projectSpaceActualPatch = await loadExportedConstFromSource(projectSpaceSource, 'applyIncrementalActualFieldPatch')
const projectSpaceFocusToken = await loadExportedConstFromSource(projectSpaceSource, 'createLevel1FocusScopeToken')
const projectSpaceFocusRetry = await loadExportedConstFromSource(projectSpaceSource, 'createLevel1FocusRetryController')
const projectSpaceFollowSync = await loadExportedConstFromSource(projectSpaceSource, 'preserveDetachedFollowMarketActualsAfterSync')
const projectSpaceFollowScope = await loadExportedConstFromSource(projectSpaceSource, 'isLevel1MarketFollowActualScope')
const projectSpaceHorizontalGroups = await loadExportedConstFromSource(projectSpaceSource, 'mergeLevel1HorizontalStageGroups')
const projectSpaceHorizontalCells = await loadExportedConstFromSource(projectSpaceSource, 'resolveLevel1HorizontalVersionCells')
const projectSpaceTosComparisonTasks = await loadExportedConstFromSource(projectSpaceSource, 'resolveTosComparisonVersionTasks')
const projectSpaceLevel1SurfaceState = await loadExportedConstFromSource(projectSpaceSource, 'deriveLevel1SurfaceVersionState')
const task7BrowserRouting = await loadExportedConstFromSource(browserSource, 'shouldRunTask7FocusedBrowserCase')
const mergedHorizontalGroups = projectSpaceHorizontalGroups.mergeLevel1HorizontalStageGroups([
  {
    stageGroups: [
      {
        stage: { id: '9', stableId: 'stage-launch', taskName: '上市阶段（新）' },
        milestones: [{ id: '9.1', stableId: 'mr-1', taskName: 'MR1（新）' }],
      },
    ],
  },
  {
    stageGroups: [
      {
        stage: { id: '5', stableId: 'stage-launch', taskName: '上市阶段（旧）' },
        milestones: [
          { id: '5.1', stableId: 'mr-1', taskName: 'MR1（旧）' },
          { id: '5.2', stableId: 'mr-old', taskName: '历史MR' },
        ],
      },
      {
        stage: { id: '6', stableId: 'stage-lifecycle', taskName: '生命周期阶段' },
        milestones: [],
      },
    ],
  },
])
assert.deepEqual(
  mergedHorizontalGroups.map(group => ({
    stage: group.stage.taskName,
    milestones: group.milestones.map(task => task.taskName),
  })),
  [
    { stage: '上市阶段（新）', milestones: ['MR1（新）', '历史MR'] },
    { stage: '生命周期阶段', milestones: [] },
  ],
  'horizontal stage columns use stable identity, prefer the newest snapshot labels, and retain historical-only stages/nodes',
)
const horizontalV4Rows = [
  { id: '4.1', stableId: 'mr-1', taskName: 'MR1（V4）', planEndDate: '2026-04-01', status: '已完成', estimatedDays: 1 },
  { id: '4.4', stableId: 'mr-4', taskName: 'MR4', planEndDate: '2026-04-04', status: '进行中', estimatedDays: 4 },
]
const horizontalV3Rows = [
  { id: '3.1', stableId: 'mr-1', taskName: 'MR1（V3）', planEndDate: '2026-03-01', status: '已完成', estimatedDays: 1 },
]
const horizontalHeaders = [...horizontalV4Rows]
const horizontalV3Cells = projectSpaceHorizontalCells.resolveLevel1HorizontalVersionCells(horizontalHeaders, horizontalV3Rows)
assert.equal(horizontalV3Cells[0], horizontalV3Rows[0], 'a historical horizontal cell resolves its own snapshot row by stable identity')
assert.equal(horizontalV3Cells[1], null, 'V3 keeps the V4-only MR4 column empty instead of falling back to the merged header row')
assert.deepEqual(
  [horizontalV3Cells[1]?.planEndDate || '-', horizontalV3Cells[1]?.status || '-', horizontalV3Cells[1]?.estimatedDays ?? '-'],
  ['-', '-', '-'],
  'a missing historical MR4 exposes no date, status, or duration from another version',
)
const horizontalActualV3Rows = [
  { id: '3.1', stableId: 'mr-1', taskName: 'MR1（V3）', actualEndDate: '2026-03-02', status: '已完成', actualDays: 1 },
]
const horizontalActualV3Cells = projectSpaceHorizontalCells.resolveLevel1HorizontalVersionCells(horizontalHeaders, horizontalActualV3Rows)
assert.equal(horizontalActualV3Cells[0], horizontalActualV3Rows[0], 'the horizontal actual row resolves the latest published snapshot by stable identity')
assert.equal(horizontalActualV3Cells[1], null, 'the V3 actual row keeps a V4-draft-only MR4 cell empty')
assert.deepEqual(
  [horizontalActualV3Cells[1]?.actualEndDate || '-', horizontalActualV3Cells[1]?.status || '-', horizontalActualV3Cells[1]?.actualDays ?? '-'],
  ['-', '-', '-'],
  'a V4-draft-only MR4 leaks no actual date, status, or duration into the published V3 actual row',
)
const horizontalActualUiStart = projectSpaceSource.indexOf("const actualProjection = recencyVersionProjections.find(entry => entry.version.status === '已发布')?.projection", projectSpaceSource.indexOf('const renderHorizontalTable = () =>'))
const horizontalActualUiEnd = projectSpaceSource.indexOf('// ═══════ renderActionButtons', horizontalActualUiStart)
const horizontalActualUiSource = projectSpaceSource.slice(horizontalActualUiStart, horizontalActualUiEnd)
assert.match(horizontalActualUiSource, /const actualMilestones = resolveLevel1HorizontalVersionCells\(allMilestones, actualRows\)/, 'horizontal UI resolves the actual row once from the latest published projection')
assert.match(horizontalActualUiSource, /actualMilestones\.map\(/, 'horizontal UI renders actual cells from the resolved latest-published list')
assert.doesNotMatch(horizontalActualUiSource, /actualRows\.find\([\s\S]{0,180}\)\s*\|\|\s*m/, 'horizontal UI never falls back from a missing published actual row to a draft/header task')
assert.deepEqual(projectSpaceLevel1SurfaceState.deriveLevel1SurfaceVersionState({
  versions: [
    { id: 'market-v2', versionNo: 'V2', status: '已发布' },
    { id: 'market-v3', versionNo: 'V3', status: '已发布' },
  ],
  currentVersionId: 'market-v3',
  canGovern: true,
  followedReadOnly: false,
  scopeUnavailable: false,
}), {
  currentVersionData: { id: 'market-v3', versionNo: 'V3', status: '已发布' },
  isDraft: false,
  isLatestPublished: true,
  canMaintain: true,
}, 'basic-information horizontal state is derived only from the scoped L1 version and permission inputs')
assert.equal(projectSpaceLevel1SurfaceState.deriveLevel1SurfaceVersionState({
  versions: [
    { id: 'market-v3.9', versionNo: 'V3.9', status: '已发布' },
    { id: 'market-v3.10', versionNo: 'V3.10', status: '已发布' },
  ],
  currentVersionId: 'market-v3.10',
  canGovern: true,
  followedReadOnly: false,
  scopeUnavailable: false,
}).isLatestPublished, true, 'V3.10 sorts after V3.9 when deciding whether scoped L1 actual dates are maintainable')
const horizontalUiStateSource = projectSpaceSource.slice(projectSpaceSource.indexOf('const renderHorizontalTable = () =>'), projectSpaceSource.indexOf('// ═══════ renderActionButtons'))
for (const stateName of ['level1SurfaceIsDraft', 'level1SurfaceIsLatestPublished', 'level1SurfaceCanMaintain', 'setLevel1SurfaceTasks']) {
  assert.match(horizontalUiStateSource, new RegExp(stateName), `basic-information horizontal UI uses dedicated ${stateName}`)
}
assert.doesNotMatch(horizontalUiStateSource, /\bisCurrentDraft\b|\bisLatestPublished\b|\bcanMaintainCurrentPlan\b|\bsetEffectiveTasks\b/, 'basic-information horizontal UI never reads global plan-level version, permission, or task setters')
const tosLiveV3Draft = [
  { id: '3.1', stableId: 'tos-concept-start', taskName: '概念启动', planEndDate: '2026-03-01' },
  { id: '3.2', stableId: 'tos-draft-only', taskName: '16.1.0.005', planEndDate: '2026-04-01' },
]
const missingTosV2Tasks = projectSpaceTosComparisonTasks.resolveTosComparisonVersionTasks({
  version: { id: 'tos-v2', status: '已发布' },
  currentVersionId: 'tos-v3',
  snapshot: undefined,
  currentScopedTasks: tosLiveV3Draft,
})
assert.deepEqual(missingTosV2Tasks, [], 'a missing V2 tOS snapshot stays empty instead of borrowing the current V3 draft')
const currentTosV3Tasks = projectSpaceTosComparisonTasks.resolveTosComparisonVersionTasks({
  version: { id: 'tos-v3', status: '修订中' },
  currentVersionId: 'tos-v3',
  snapshot: undefined,
  currentScopedTasks: tosLiveV3Draft,
})
assert.deepEqual(currentTosV3Tasks, tosLiveV3Draft, 'the exact current tOS draft remains available without making it a historical fallback')
assert.deepEqual(
  versionCompareRules.compareVersionsForTable(missingTosV2Tasks, currentTosV3Tasks).map(row => row.changeType),
  ['新增', '新增'],
  'missing V2 versus current V3 draft reports additions instead of a polluted zero-difference comparison',
)
assert.deepEqual(
  versionCompareRules.compareVersionsForTable(currentTosV3Tasks, missingTosV2Tasks).map(row => row.changeType),
  ['删除', '删除'],
  'reversing the missing-snapshot comparison reports deletions instead of a polluted zero-difference comparison',
)
for (const focusedCase of ['machine-surface', 'machine-summary', 'machine-follow-actual', 'tos-surface']) {
  assert.equal(task7BrowserRouting.shouldRunTask7FocusedBrowserCase('all', focusedCase), true, `browser all routes through ${focusedCase}`)
  assert.equal(task7BrowserRouting.shouldRunTask7FocusedBrowserCase(focusedCase, focusedCase), true, `${focusedCase} remains directly runnable`)
}
assert.equal(task7BrowserRouting.shouldRunTask7FocusedBrowserCase('machine-summary', 'tos-surface'), false, 'an exact focused route never selects an unrelated case')
for (const focusedCase of ['machine-surface', 'machine-summary', 'machine-follow-actual', 'tos-surface']) {
  assert.match(
    browserSource,
    new RegExp(`shouldRunTask7FocusedBrowserCase\\(ONLY_CASE, '${focusedCase}'\\)`),
    `the live browser matrix uses the shared all-route decision for ${focusedCase}`,
  )
}
for (const label of ['序号', '阶段/节点', '计划开始时间', '计划完成时间', '预估工期', '实际开始时间', '实际完成时间', '实际工期', '是否延期']) {
  assert.match(projectSpaceSource, new RegExp(label), `project-space tree table contains ${label}`)
}
assert.match(projectSpaceSource, /insertLevel1BusinessNode/, 'project-space adds validated machine and tOS business nodes')
assert.match(projectSpaceSource, /projectLevel1Plan/, 'project-space projects governed plans into the standard tree rows')
assert.match(projectSpaceSource, /buildPlanGanttTasks/, 'project-space builds typed Gantt tasks')
assert.match(projectSpaceSource, /onTaskDateChange/, 'project-space persists accepted Gantt date changes')
assert.match(projectSpaceSource, /aria-label="计划版本"/, 'project-space version selector has an accessible plan-version label')
assert.match(projectSpaceSource, /const isGovernedLevel1Table = !isLevel2Custom\s*&& projectPlanLevel === 'level1'/, 'all level-one plans retain the existing governance branch')
assert.doesNotMatch(projectSpaceSource, /isFlatGovernedLevel1Table|pms-level1-flat-milestone-table|pms-level1-flat-date-invalid/, 'governed project plans have no special flat-table branch or naming')
assert.match(projectSpaceSource, /filterLevel1TreeRows\(/, 'table and Gantt filtering share the hierarchy-preserving helper')
assert.match(projectSpaceSource, /rowKey=\{record => record\.stableId \|\| record\.id\}/, 'tree rows use stable IDs for React and DOM identity')
assert.match(projectSpaceSource, /expandedRowKeys[,}]/, 'the vertical table uses real Ant table expanders')
assert.match(projectSpaceSource, /validateLevel1ScheduleDates\(tableTasks/, 'date validation runs on unprojected tasks')
assert.match(projectSpaceSource, /pms-level1-date-input-invalid/, 'invalid DatePickers expose the scoped red error class')
assert.match(projectSpaceSource, /\[data-field/, 'publish focus resolves the first invalid field through a stable cell selector')
assert.match(projectSpaceSource, /setProjectPlanViewMode\('table'\)/, 'publish failure always restores the governed vertical table')
assert.match(projectSpaceSource, /setLevel1PlanFilters\(\[\]\)/, 'publish failure clears filters that can hide the invalid row')
assert.match(projectSpaceSource, /focusLevel1Violation[\s\S]*remainingAttempts/, 'publish focus retries until the vertical invalid cell is mounted')
assert.match(projectSpaceSource, /level1FocusRetryRef/, 'publish focus keeps its retry controller in a component ref')
assert.match(projectSpaceSource, /level1FocusRetryRef\.current\?\.stop\(\)/, 'scope changes and unmount stop pending focus retries')
assert.match(projectSpaceSource, /readCurrentLevel1FocusToken/, 'every focus attempt re-reads the live project, scope, and version token')
assert.match(projectSpaceSource, /readCurrentLevel1FocusToken[\s\S]*scopeKind:\s*'ordinary'[\s\S]*versionId:\s*latestPlan\.currentVersion/, 'ordinary L1 focus reads the live default version through the shared token builder')
assert.match(projectSpaceSource, /focusLevel1Violation[\s\S]*createLevel1FocusScopeToken\(/, 'focus opening and live reading use the same token builder')
for (const tokenField of ['currentUser', 'editMode', 'planLevel']) {
  assert.match(projectSpaceSource, new RegExp(`left\\.${tokenField} === right\\.${tokenField}`), `focus retry token compares live ${tokenField}`)
}
assert.match(projectSpaceSource, /`\$\{record\.taskName\}：\$\{reason\}`/, 'invalid tooltip text prefixes every reason with the task name')
assert.match(projectSpaceSource, /getLevel1StructurePermissions/, 'render and confirmation paths use centralized structure permissions')
assert.doesNotMatch(projectSpaceSource, /source === 'custom'\s*&& getStructurePermissions\(record\)\.canDelete/, 'super-admin fixed-template deletion is not hidden behind a custom-source gate')
assert.match(projectSpaceSource, /parentStableId/, 'structure confirmation tokens bind the selected parent')
for (const tokenField of ['projectId', 'scopeKind', 'scopeValue', 'versionId', 'currentUser', 'parentStableId', 'editMode', 'draft']) {
  assert.match(projectSpaceSource, new RegExp(`${tokenField}[:;,]`), `structure token covers ${tokenField}`)
}
assert.match(projectSpaceSource, /getLatestLevel1MutationContext\(dialog\.token\)/, 'confirmation revalidates the full live structure token before mutation')
assert.match(projectSpaceSource, /phase:\s*'confirm'/, 'business insertion starts with a confirmation-only phase')
assert.match(projectSpaceSource, /是否添加 MR 里程碑？/, 'machine insertion first asks whether to add')
assert.match(projectSpaceSource, /是否添加 tOS 版本？/, 'tOS insertion first asks whether to add')
assert.match(projectSpaceSource, /输入 MR 里程碑名称/, 'machine insertion collects its name only in the second dialog')
assert.match(projectSpaceSource, /输入 tOS 版本名称/, 'tOS insertion collects its name only in the second dialog')
assert.match(projectSpaceSource, /level1ReorderDialog/, 'tree reorder is held in controlled confirmation state')
assert.match(projectSpaceSource, /确认调整节点顺序？/, 'tree reorder requires explicit confirmation')
assert.match(projectSpaceSource, /getLatestLevel1MutationContext\(dialog\.token\)/, 'reorder confirmation revalidates its live token')
assert.match(projectSpaceSource, /添加MR里程碑/, 'machine plans expose the controlled MR action')
assert.match(projectSpaceSource, /添加tOS版本/, 'tOS plans expose the controlled version action')
assert.match(projectSpaceSource, /change\.nodeType === 'milestone' \? 'milestone' : 'task'/, 'one Gantt callback persists both fixed points and business bars')
assert.match(projectSpaceSource, /validateLevel1ScheduleDates\(next\)/, 'Gantt candidates are validated before they are written')

const liveDraftTasks = [
  { id: '1', stableId: 'stage', order: 1, taskName: '阶段', planEndDate: '2026-01-01' },
  { id: '1.1', stableId: 'target', parentId: '1', order: 1, taskName: '草稿保留名称', planEndDate: '2026-10-01', actualStartDate: '2026-07-20', actualEndDate: '2026-09-01', actualDays: 43 },
  { id: '1.2', stableId: 'custom-mr', parentId: '1', order: 2, taskName: 'MR4', source: 'custom', planEndDate: '2026-05-01' },
]
const publishedTasks = [
  { id: '1', stableId: 'stage', order: 1, taskName: '阶段', planEndDate: '2026-01-01' },
  { id: '1.1', stableId: 'target', parentId: '1', order: 1, taskName: '发布名称', planEndDate: '2026-02-01', actualStartDate: '2026-08-01', actualEndDate: '2026-08-10', actualDays: 9 },
]
const snapshotStartPatched = projectSpaceActualPatch.applyIncrementalActualFieldPatch(publishedTasks, 'target', 'actualStartDate', '2026-08-02')
const draftStartPatched = projectSpaceActualPatch.applyIncrementalActualFieldPatch(liveDraftTasks, 'target', 'actualStartDate', '2026-08-02')
assert.deepEqual(snapshotStartPatched.find(task => task.stableId === 'target'), {
  ...publishedTasks[1], actualStartDate: '2026-08-02', actualEndDate: '2026-08-10', actualDays: 8,
}, 'published actual-start patch changes only that field and recomputes snapshot duration')
assert.deepEqual(draftStartPatched.map(task => [task.stableId, task.taskName, task.planEndDate, task.actualStartDate || '', task.actualEndDate || '', task.actualDays ?? null]), [
  ['stage', '阶段', '2026-01-01', '', '', null],
  ['target', '草稿保留名称', '2026-10-01', '2026-08-02', '2026-09-01', 30],
  ['custom-mr', 'MR4', '2026-05-01', '', '', null],
], 'paired draft actual-start merge preserves its other actual field, plan/name/custom node/order')
const snapshotEndPatched = projectSpaceActualPatch.applyIncrementalActualFieldPatch(publishedTasks, 'target', 'actualEndDate', '2026-08-12')
const draftEndPatched = projectSpaceActualPatch.applyIncrementalActualFieldPatch(liveDraftTasks, 'target', 'actualEndDate', '2026-08-12')
assert.deepEqual(snapshotEndPatched.find(task => task.stableId === 'target'), {
  ...publishedTasks[1], actualStartDate: '2026-08-01', actualEndDate: '2026-08-12', actualDays: 11,
}, 'published actual-end patch changes only that field and recomputes snapshot duration')
assert.deepEqual(draftEndPatched.find(task => task.stableId === 'target'), {
  ...liveDraftTasks[1], actualStartDate: '2026-07-20', actualEndDate: '2026-08-12', actualDays: 23,
}, 'paired draft actual-end merge preserves its divergent actual start and non-actual fields')
assert.deepEqual(projectSpaceActualPatch.applyIncrementalActualFieldPatch(liveDraftTasks, 'missing', 'actualEndDate', '2026-08-12'), liveDraftTasks, 'a missing stable ID leaves the draft values unchanged')
assert.deepEqual(liveDraftTasks[1], { id: '1.1', stableId: 'target', parentId: '1', order: 1, taskName: '草稿保留名称', planEndDate: '2026-10-01', actualStartDate: '2026-07-20', actualEndDate: '2026-09-01', actualDays: 43 }, 'incremental actual patches never mutate their inputs')
const detachedFollowPatch = projectSpaceActualPatch.applyIncrementalActualFieldPatch([
  { ...publishedTasks[1], nodeKind: 'business-period', actualTimeDetachedFromMain: false },
], 'target', 'actualEndDate', '2026-08-12', true)
assert.deepEqual(detachedFollowPatch[0], {
  ...publishedTasks[1], nodeKind: 'business-period', actualStartDate: '2026-08-01', actualEndDate: '2026-08-12', actualDays: 12, actualTimeDetachedFromMain: true,
}, 'a follow-market live/snapshot patch recomputes duration and marks the task detached from main actual time')
assert.doesNotMatch(projectSpaceSource, /mergeActualFieldsByStableId/, 'project-space published writes never use the legacy two-field merge')
assert.match(projectSpaceSource, /updateCurrentTosTypeData[\s\S]{0,600}applyIncrementalActualFieldPatch/, 'tOS paired drafts receive the same single-field actual patch')
assert.match(projectSpaceSource, /setMarketPlanData[\s\S]{0,800}applyIncrementalActualFieldPatch/, 'market paired drafts receive the same single-field actual patch')
assert.match(projectSpaceSource, /pairedVersion\s*\|\|\s*\(isLevel1MarketTable\s*&&\s*currentMarketIsFollow\)/, 'a follow-market latest-published edit updates live scope even without a paired draft')

const scheduledFocusCallbacks = new Map()
const cancelledFocusHandles = []
let nextFocusHandle = 0
const capabilityFocusToken = projectSpaceFocusToken.createLevel1FocusScopeToken({
  projectId: 'capability-project',
  scopeKind: 'ordinary',
  versionId: 'v4',
  currentUser: '张三',
  editMode: true,
  planLevel: 'level1',
})
const independentSoftwareFocusToken = projectSpaceFocusToken.createLevel1FocusScopeToken({
  projectId: 'independent-software-project',
  scopeKind: 'ordinary',
  versionId: 'v4',
  currentUser: '张三',
  editMode: true,
  planLevel: 'level1',
})
assert.deepEqual(capabilityFocusToken, {
  projectId: 'capability-project', scopeKind: 'ordinary', scopeValue: 'default', versionId: 'v4', currentUser: '张三', editMode: true, planLevel: 'level1',
}, 'a capability-building ordinary L1 plan creates a default-scope focus token')
assert.deepEqual(independentSoftwareFocusToken, {
  projectId: 'independent-software-project', scopeKind: 'ordinary', scopeValue: 'default', versionId: 'v4', currentUser: '张三', editMode: true, planLevel: 'level1',
}, 'an independent-software ordinary L1 plan creates the same default-scope token shape')
let currentFocusToken = capabilityFocusToken
let focusAttempts = 0
const focusController = projectSpaceFocusRetry.createLevel1FocusRetryController({
  schedule: callback => {
    const handle = ++nextFocusHandle
    scheduledFocusCallbacks.set(handle, callback)
    return handle
  },
  cancel: handle => {
    cancelledFocusHandles.push(handle)
    scheduledFocusCallbacks.delete(handle)
  },
  readCurrentToken: () => currentFocusToken,
  tryFocus: () => {
    focusAttempts += 1
    return focusAttempts >= 2
  },
})
const runNextFocusCallback = () => {
  const entry = scheduledFocusCallbacks.entries().next().value
  assert.ok(entry, 'focus retry has a scheduled callback')
  scheduledFocusCallbacks.delete(entry[0])
  entry[1]()
}
focusController.start(currentFocusToken, 3)
runNextFocusCallback()
assert.equal(focusAttempts, 1, 'a matching ordinary capability-project token performs its first focus attempt')
assert.equal(scheduledFocusCallbacks.size, 1, 'a missing DOM target schedules another bounded attempt')
currentFocusToken = independentSoftwareFocusToken
runNextFocusCallback()
assert.equal(focusAttempts, 1, 'switching from a capability to independent-software project cancels the stale focus attempt')
assert.equal(scheduledFocusCallbacks.size, 0, 'a stale ordinary project token stops without another retry')
focusController.start(independentSoftwareFocusToken, 3)
currentFocusToken = { ...independentSoftwareFocusToken, versionId: 'v5' }
runNextFocusCallback()
assert.equal(focusAttempts, 1, 'switching an ordinary L1 version cancels the stale focus attempt')
assert.equal(scheduledFocusCallbacks.size, 0, 'a stale ordinary version token stops without another retry')
focusController.start(currentFocusToken, 3)
focusController.start({ ...currentFocusToken, currentUser: '李四' }, 3)
assert.equal(cancelledFocusHandles.length, 1, 'a new ordinary focus round cancels the previous pending timer')
focusController.stop()
assert.equal(scheduledFocusCallbacks.size, 0, 'unmount/scope cleanup cancels a pending retry timer')

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
assert.match(projectSpaceSource, /rowKey=\{record => record\.stableId \|\| record\.id\}/, 'tree rows use stable IDs for React identity')
assert.match(ganttStyles, /\.pms-level1-tree-table \.pms-level1-date-input-invalid/s, 'invalid picker styling is scoped to the governed tree table')
assert.match(ganttStyles, /\.pms-level1-tree-table \.pms-level1-row-level-0/s, 'level-zero emphasis is scoped to the governed tree table')
assert.doesNotMatch(ganttStyles, /\.pms-level1-flat-(?:milestone-table|date-invalid|gantt)/, 'legacy project-space flat CSS is removed')

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
const transferOpening = { projectId: 'p1', tabId: 'p1:subproject:s1', scopeKey: 'p1:subproject:s1', versionId: 'v2', user: '技术负责人' }
assert.equal(technicalWorkspaceModule.canConfirmTechnicalSubprojectTransfer({ opening: transferOpening, current: { ...transferOpening }, isCurrentDraft: true, isEditMode: true, canView: true, canEdit: true, canMaintain: true }), true, 'a matching technical lead can confirm a transfer insertion')
assert.equal(technicalWorkspaceModule.canConfirmTechnicalSubprojectTransfer({ opening: transferOpening, current: { ...transferOpening, user: '已换用户' }, isCurrentDraft: true, isEditMode: true, canView: true, canEdit: true, canMaintain: true }), false, 'switching users rejects a stale transfer confirmation')
assert.equal(technicalWorkspaceModule.canConfirmTechnicalSubprojectTransfer({ opening: transferOpening, current: { ...transferOpening, tabId: 'p1:subproject:s2' }, isCurrentDraft: true, isEditMode: true, canView: true, canEdit: true, canMaintain: true }), false, 'switching tabs rejects a stale transfer confirmation')
assert.equal(technicalWorkspaceModule.canConfirmTechnicalSubprojectTransfer({ opening: transferOpening, current: { ...transferOpening, versionId: 'v3' }, isCurrentDraft: true, isEditMode: true, canView: true, canEdit: true, canMaintain: true }), false, 'switching versions rejects a stale transfer confirmation')
assert.equal(technicalWorkspaceModule.canConfirmTechnicalSubprojectTransfer({ opening: transferOpening, current: { ...transferOpening }, isCurrentDraft: true, isEditMode: true, canView: true, canEdit: true, canMaintain: false }), false, 'revoked maintainer access rejects a stale transfer confirmation')
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
assert.match(technicalModuleSource, /transferConfirmation && \(/, 'technical transfer confirmation is controlled by component state')
assert.match(technicalModuleSource, /title="确认添加转测版本？"/, 'technical transfer confirmation uses the required title')
assert.match(technicalModuleSource, /okText="确认添加"/, 'technical transfer confirmation uses the required action label')
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

const versionCompareSource = read('src/lib/versionCompare.ts')
const compareModalSource = read('src/components/plans/PlanVersionCompareModal.tsx')
const comparisonSnapshotsSource = read('src/lib/versionComparisonSnapshots.ts')
assert.match(comparisonSnapshotsSource, /getProjectMarketSnapshotKey/, 'published comparisons resolve a whole-machine version through its market snapshot key')
assert.match(comparisonSnapshotsSource, /if \(scope\.kind === 'market'\) \{\s*return publishedSnapshots\[comparisonSnapshotKey\(scope, version\.id\)\] \|\| effectiveTasks/, 'market comparison never falls through to an unscoped or another-market snapshot')
assert.match(versionCompareSource, /stageName/, 'version compare preserves flat stage names')
assert.match(versionCompareSource, /milestoneName/, 'version compare preserves flat milestone names')
assert.match(versionCompareSource, /activityName/, 'version compare preserves technical activity names')
assert.match(compareModalSource, /hierarchical-flat/, 'version compare modal supports flat hierarchy columns')
assert.match(compareModalSource, /technical-subproject/, 'version compare modal supports technical subproject columns')
for (const label of ['阶段', '里程碑点', '活动名称']) {
  assert.match(compareModalSource, new RegExp(label), `version compare modal contains ${label}`)
}
assert.match(compareModalSource, /const renderLegacyDaysCell[\s\S]*value > 0/, 'legacy history keeps a zero-day duration as a dash')
assert.match(compareModalSource, /legacyColumns[\s\S]*renderLegacyDaysCell/, 'legacy duration columns use the legacy zero-day formatter')
assert.match(compareModalSource, /const renderFlatDaysCell[\s\S]*typeof value === 'number'/, 'flat history formats zero-day durations as 0天')
assert.match(compareModalSource, /hierarchicalFlatColumns[\s\S]*renderFlatDaysCell/, 'hierarchical-flat duration columns use the flat formatter')
assert.match(compareModalSource, /technicalSubprojectColumns[\s\S]*renderFlatDaysCell/, 'technical-subproject duration columns use the flat formatter')
const compareModule = loadTypeScriptModule(root, 'src/lib/versionCompare.ts')
const comparisonSnapshotsModule = loadTypeScriptModule(root, 'src/lib/versionComparisonSnapshots.ts')
const marketRulesModule = loadTypeScriptModule(root, 'src/lib/marketRules.ts')
const marketPlansBeforeMainSync = {
  OP: {
    tasks: [{ ...publishedTasks[1], nodeKind: 'business-period', actualStartDate: '2026-08-01', actualEndDate: '2026-08-30', actualDays: 30 }],
    level2Tasks: [],
    createdLevel2Plans: [],
  },
  TR: {
    tasks: detachedFollowPatch,
    level2Tasks: [],
    createdLevel2Plans: [],
  },
}
const marketRowsForMainSync = [
  { id: 'market-op', market: 'OP', isMain: true, followsMain: false },
  { id: 'market-tr', market: 'TR', isMain: false, followsMain: true },
]
const detachedFollowAfterMainSync = projectSpaceFollowSync.preserveDetachedFollowMarketActualsAfterSync(
  marketRulesModule.syncFollowMarketPlans(marketPlansBeforeMainSync, marketRowsForMainSync),
  marketPlansBeforeMainSync,
  marketRowsForMainSync,
)
assert.deepEqual(detachedFollowAfterMainSync.TR.tasks[0], detachedFollowPatch[0], 'main-market publishing preserves a detached follow-market actual field, duration, and detach flag')
const staleIndependentFollow = {
  ...marketPlansBeforeMainSync,
  TR: {
    ...marketPlansBeforeMainSync.TR,
    tasks: [{ ...detachedFollowPatch[0], actualEndDate: '2026-08-08', actualDays: 8, actualTimeDetachedFromMain: false }],
  },
}
const restoredHistoricalFollow = projectSpaceFollowSync.preserveDetachedFollowMarketActualsAfterSync(
  staleIndependentFollow,
  marketPlansBeforeMainSync,
  marketRowsForMainSync,
)
const detachedFollowAfterRefollow = projectSpaceFollowSync.preserveDetachedFollowMarketActualsAfterSync(
  marketRulesModule.syncFollowMarketPlans(restoredHistoricalFollow, marketRowsForMainSync),
  restoredHistoricalFollow,
  marketRowsForMainSync,
)
assert.deepEqual(detachedFollowAfterRefollow.TR.tasks[0], detachedFollowPatch[0], 're-follow snapshot generation restores detached actual fields from the published snapshot before main-plan merging')
assert.equal(projectSpaceFollowScope.isLevel1MarketFollowActualScope(false, { sourceMarket: 'OP', sourceVersionId: 'v4' }), true, 'a persisted scoped follow-version source preserves follow actual semantics after same-context reopen')
assert.equal(projectSpaceFollowScope.isLevel1MarketFollowActualScope(false, undefined), false, 'an explicitly detached market without a scoped follow-version source remains independent')
assert.equal(projectSpaceFollowScope.isLevel1MarketFollowActualScope(true, undefined), true, 'the live market configuration remains the primary follow signal')
assert.match(projectSpaceSource, /newlyFollowedMarkets[\s\S]{0,1800}publishedSnapshots\[getProjectMarketSnapshotKey/, 're-follow materialization consults the latest published market snapshot for detached actual fields')
const marketComparisonEffective = [{ id: 'effective', taskName: '当前市场', planEndDate: '2026-03-20' }]
const marketComparisonV2 = [{ id: 'concept', taskName: '概念启动', actualEndDate: '2026-02-26' }]
const marketComparisonOtherMarket = [{ id: 'concept', taskName: '概念启动', actualEndDate: '2099-12-31' }]
const marketComparisonSnapshots = {
  [marketRulesModule.getProjectMarketSnapshotKey('machine', 'OP', 'v2')]: marketComparisonV2,
  [marketRulesModule.getProjectMarketSnapshotKey('machine', 'TR', 'v2')]: marketComparisonOtherMarket,
  v2: marketComparisonOtherMarket,
}
assert.equal(comparisonSnapshotsModule.resolveComparisonVersionTasks({
  version: { id: 'v2', status: '已发布' },
  effectiveTasks: marketComparisonEffective,
  publishedSnapshots: marketComparisonSnapshots,
  scope: { kind: 'market', projectId: 'machine', market: 'OP' },
}), marketComparisonV2, 'market comparison reads only the selected market published snapshot')
assert.equal(comparisonSnapshotsModule.resolveComparisonVersionTasks({
  version: { id: 'v2', status: '修订中' },
  effectiveTasks: marketComparisonEffective,
  publishedSnapshots: marketComparisonSnapshots,
  scope: { kind: 'market', projectId: 'machine', market: 'OP' },
}), marketComparisonEffective, 'draft comparison remains on the current live scope')
const marketComparisonSeeded = comparisonSnapshotsModule.ensurePublishedComparisonSnapshots({
  publishedSnapshots: {
    [marketRulesModule.getProjectMarketSnapshotKey('machine', 'TR', 'v2')]: marketComparisonOtherMarket,
  },
  versions: [{ id: 'v1', status: '已发布' }, { id: 'v2', status: '已发布' }, { id: 'v3', status: '修订中' }],
  scope: { kind: 'market', projectId: 'machine', market: 'OP' },
  seedTasks: marketComparisonV2,
})
assert.equal(marketComparisonSeeded[marketRulesModule.getProjectMarketSnapshotKey('machine', 'OP', 'v1')]?.[0]?.actualEndDate, '2026-02-26', 'missing historical snapshots are seeded in the selected market scope')
assert.equal(marketComparisonSeeded[marketRulesModule.getProjectMarketSnapshotKey('machine', 'OP', 'v2')]?.[0]?.actualEndDate, '2026-02-26', 'every published selected-market version receives its own baseline snapshot')
assert.equal(marketComparisonSeeded[marketRulesModule.getProjectMarketSnapshotKey('machine', 'TR', 'v2')], marketComparisonOtherMarket, 'seeding the selected market never replaces another market snapshot')
const publishedBaselineWithoutMr4 = [{ id: 'concept', taskName: '概念启动' }]
const currentDraftWithMr4 = [...publishedBaselineWithoutMr4, { id: 'mr4', taskName: 'MR4' }]
const historicalSeed = comparisonSnapshotsModule.ensurePublishedComparisonSnapshots({
  publishedSnapshots: {},
  versions: [{ id: 'v1', status: '已发布' }, { id: 'v2', status: '已发布' }],
  scope: { kind: 'market', projectId: 'machine', market: 'OP' },
  seedTasks: publishedBaselineWithoutMr4,
})
assert.equal(historicalSeed[marketRulesModule.getProjectMarketSnapshotKey('machine', 'OP', 'v2')]?.some(task => task.id === 'mr4'), false, 'missing historical snapshots seed from the published baseline, never the current draft')
assert.equal(currentDraftWithMr4.some(task => task.id === 'mr4'), true, 'draft fixture retains MR4 so the baseline assertion cannot pass vacuously')
const stableCompare = compareModule.compareVersionsForTable(
  [{ ...milestones[1], id: '1.2', stableId: 'str1', sequence: 2, planEndDate: '2026-01-16' }],
  [{ ...milestones[1], id: '1.1', stableId: 'str1', sequence: 1, planEndDate: '2026-01-20' }],
)
assert.equal(stableCompare.length, 1, 'stable task identity produces one comparison row after display-id renumbering')
assert.equal(stableCompare[0].changeType, '修改', 'a stable task with a changed milestone date is modified, not added or deleted')
assert.equal(stableCompare[0].taskId, '1.1', 'matched comparisons display the new task ID')
assert.equal(stableCompare[0].stageName, '概念阶段', 'matched comparisons retain the flat stage name')
const renumberedOnlyCompare = compareModule.compareVersionsForTable(
  [{ ...milestones[1], id: '1.2', stableId: 'str1', sequence: 2 }],
  [{ ...milestones[1], id: '1.1', stableId: 'str1', sequence: 1 }],
)
assert.equal(renumberedOnlyCompare[0].changeType, '未变更', 'display-ID and sequence renumbering alone are not content changes')
assert.equal(renumberedOnlyCompare[0].key, JSON.stringify(['stable', 'str1', 1]), 'stable task identity uses a namespaced React comparison key')
const flatNameCompare = compareModule.compareVersionsForTable(
  [{ ...milestones[1], stableId: 'flat-name', stageName: '旧阶段', milestoneName: '旧里程碑', activityName: '旧活动' }],
  [{ ...milestones[1], stableId: 'flat-name', stageName: '新阶段', milestoneName: '新里程碑', activityName: '新活动' }],
)
assert.equal(flatNameCompare[0].changeType, '修改', 'a flat display-name change is a version change even when task IDs are stable')
assert.deepEqual(flatNameCompare[0].fieldDiffs.filter(diff => ['stageName', 'milestoneName', 'activityName'].includes(diff.field)).map(diff => diff.field), ['stageName', 'milestoneName', 'activityName'], 'all flat display-name fields preserve their old/new values')
const stageOnlyNameCompare = compareModule.compareVersionsForTable(
  [{ ...milestones[1], stableId: 'stage-only', stageName: '旧阶段' }],
  [{ ...milestones[1], stableId: 'stage-only', stageName: '新阶段' }],
)
assert.equal(stageOnlyNameCompare[0].changeType, '修改', 'a stage-name-only change is never hidden as unchanged')
const nullUndefinedDurationCompare = compareModule.compareVersionsForTable(
  [{ ...milestones[1], stableId: 'duration-empty', estimatedDays: null, actualDays: undefined }],
  [{ ...milestones[1], stableId: 'duration-empty', estimatedDays: undefined, actualDays: null }],
)
assert.equal(nullUndefinedDurationCompare[0].changeType, '未变更', 'null and undefined duration values are both treated as an empty duration')
const nullToZeroDurationCompare = compareModule.compareVersionsForTable(
  [{ ...milestones[1], stableId: 'duration-zero', estimatedDays: null, actualDays: null }],
  [{ ...milestones[1], stableId: 'duration-zero', estimatedDays: 0, actualDays: 0 }],
)
assert.deepEqual(nullToZeroDurationCompare[0].fieldDiffs.filter(diff => ['estimatedDays', 'actualDays'].includes(diff.field)).map(diff => [diff.field, diff.oldValue, diff.newValue]), [['estimatedDays', '-', '0天'], ['actualDays', '-', '0天']], 'null-to-zero duration changes remain visible for planned and actual durations')
const addedFlatRow = compareModule.compareVersionsForTable([], [{ ...milestones[1], id: 'added-flat', stableId: 'added-flat', sequence: 7, stageName: '新增阶段', milestoneName: '新增里程碑', activityName: '新增活动' }])[0]
assert.deepEqual([addedFlatRow.key, addedFlatRow.taskId, addedFlatRow.sequence, addedFlatRow.stageName, addedFlatRow.milestoneName, addedFlatRow.activityName], [JSON.stringify(['stable', 'added-flat', 1]), 'added-flat', 7, '新增阶段', '新增里程碑', '新增活动'], 'added flat rows retain stable keys and every display field')
const deletedFlatRow = compareModule.compareVersionsForTable([{ ...milestones[1], id: 'deleted-flat', stableId: 'deleted-flat', sequence: 8, stageName: '删除阶段', milestoneName: '删除里程碑', activityName: '删除活动' }], [])[0]
assert.deepEqual([deletedFlatRow.key, deletedFlatRow.taskId, deletedFlatRow.sequence, deletedFlatRow.stageName, deletedFlatRow.milestoneName, deletedFlatRow.activityName], [JSON.stringify(['stable', 'deleted-flat', 1]), 'deleted-flat', 8, '删除阶段', '删除里程碑', '删除活动'], 'deleted flat rows retain stable keys and every display field')
const duplicateStableSameIdCompare = compareModule.compareVersionsForTable(
  [{ ...milestones[1], id: 'duplicate-id', stableId: 'duplicate-stable', taskName: '任务A' }, { ...milestones[1], id: 'duplicate-id', stableId: 'duplicate-stable', taskName: '任务B' }],
  [{ ...milestones[1], id: 'duplicate-id', stableId: 'duplicate-stable', taskName: '任务A' }, { ...milestones[1], id: 'duplicate-id', stableId: 'duplicate-stable', taskName: '任务B' }],
)
assert.equal(duplicateStableSameIdCompare.length, 2, 'duplicate stable IDs and display IDs never overwrite comparison rows')
assert.equal(new Set(duplicateStableSameIdCompare.map(row => row.key)).size, 2, 'duplicate stable IDs produce unique React comparison keys')
const duplicateStableDifferentIdCompare = compareModule.compareVersionsForTable(
  [{ ...milestones[1], id: 'old-1', stableId: 'duplicate-stable' }, { ...milestones[1], id: 'old-2', stableId: 'duplicate-stable' }],
  [{ ...milestones[1], id: 'new-1', stableId: 'duplicate-stable' }, { ...milestones[1], id: 'new-2', stableId: 'duplicate-stable' }],
)
assert.equal(duplicateStableDifferentIdCompare.length, 2, 'duplicate stable IDs pair by occurrence even when display IDs are renumbered')
assert.deepEqual(duplicateStableDifferentIdCompare.map(row => row.taskId), ['new-1', 'new-2'], 'duplicate stable-ID matches display each new task ID')
const changedStableSameIdCompare = compareModule.compareVersionsForTable(
  [{ ...milestones[1], id: '1.1', stableId: 'old-stable' }],
  [{ ...milestones[1], id: '1.1', stableId: 'new-stable' }],
)
assert.deepEqual(changedStableSameIdCompare.map(row => row.changeType).sort(), ['删除', '新增'], 'different stable IDs never match solely because their display IDs match')
const collidingDisplayIdCompare = compareModule.compareVersionsForTable(
  [
    { ...milestones[1], id: 'x#1', stableId: undefined },
    { ...milestones[1], id: 'x', stableId: undefined },
    { ...milestones[1], id: 'x', stableId: undefined },
  ],
  [
    { ...milestones[1], id: 'x#1', stableId: undefined },
    { ...milestones[1], id: 'x', stableId: undefined },
    { ...milestones[1], id: 'x', stableId: undefined },
  ],
)
assert.equal(collidingDisplayIdCompare.length, 3, 'a literal x#1 ID cannot collide with repeated x identities')
assert.equal(new Set(collidingDisplayIdCompare.map(row => row.key)).size, 3, 'namespaced indexed ID keys remain unique for collision-prone display IDs')

const governedHistoryBase = {
  ...milestones[1],
  id: '2.3',
  stableId: 'governed-history-node',
  order: 3,
  sequence: 3,
  taskName: '旧节点',
  planStartDate: '2026-01-01',
  planEndDate: '2026-01-02',
  actualStartDate: '2026-01-03',
  actualEndDate: '2026-01-04',
}
const governedReorderOnly = compareModule.compareVersionsForTable(
  [governedHistoryBase],
  [{ ...governedHistoryBase, id: '8.9', order: 99, sequence: 99 }],
)
assert.deepEqual(governedReorderOnly.map(row => row.changeType), ['未变更'], 'pure display reorder is not a governed history change when stable identity is unchanged')
const governedRenameAndDates = compareModule.compareVersionsForTable(
  [governedHistoryBase],
  [{
    ...governedHistoryBase,
    id: '1.1',
    taskName: '新节点',
    planStartDate: '2026-02-01',
    planEndDate: '2026-02-02',
    actualStartDate: '2026-02-03',
    actualEndDate: '2026-02-04',
  }],
)
assert.equal(governedRenameAndDates[0].changeType, '修改', 'a governed node rename and date edits stay on one stable history row')
assert.deepEqual(
  governedRenameAndDates[0].fieldDiffs.filter(diff => ['taskName', 'planStartDate', 'planEndDate', 'actualStartDate', 'actualEndDate'].includes(diff.field)).map(diff => diff.field),
  ['taskName', 'planStartDate', 'planEndDate', 'actualStartDate', 'actualEndDate'],
  'governed history exposes the node rename and all four date changes',
)
const governedAddDelete = compareModule.compareVersionsForTable(
  [governedHistoryBase, { ...governedHistoryBase, id: 'old-only', stableId: 'old-only', taskName: '删除节点' }],
  [governedHistoryBase, { ...governedHistoryBase, id: 'new-only', stableId: 'new-only', taskName: '新增节点' }],
)
assert.deepEqual(governedAddDelete.filter(row => row.changeType !== '未变更').map(row => row.changeType).sort(), ['删除', '新增'], 'governed add/delete nodes remain visible')

console.log('PASS level1 flat milestone and gantt rules')
