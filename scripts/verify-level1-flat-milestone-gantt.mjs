#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

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

console.log('PASS level1 flat milestone and gantt rules')
