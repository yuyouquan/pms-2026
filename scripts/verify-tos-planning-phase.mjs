import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'

globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = { localStorage }
const loader = createTypeScriptModuleLoader()
const load = file => loader(path.resolve(file))
const rules = load('src/lib/level1PlanRules.ts')
const plan = load('src/stores/plan.ts')
const mocks = load('src/data/projectListPlanMocks.ts')
const mrMocks = load('src/data/mrVersionPlanMocks.ts')
const template = rules.buildTosLevel1Tasks(false)
const roots = tasks => tasks.filter(task => !task.parentId).map(task => task.taskName)
const byName = (tasks, name) => tasks.find(task => task.taskName === name)
assert.deepEqual(roots(template), ['规划阶段', '概念阶段', '计划阶段', '开发验证阶段', '上市迭代阶段', '维护阶段'])
assert.deepEqual(template.filter(task => task.parentId === byName(template, '规划阶段').id).map(task => [task.taskName, task.nodeKind]), [['规划KO', 'fixed-milestone'], ['CDCP', 'fixed-milestone']])
assert.ok(template.every(task => !task.planEndDate && !task.actualEndDate))

// A persisted V14 template has five phases; its business data is user-owned.
const oldTemplate = template.filter(task => !['规划阶段', '规划KO', 'CDCP'].includes(task.taskName))
  .map(task => ({ ...task,
    id: task.id.replace(/^\d+/, value => String(Number(value) - 1)),
    parentId: task.parentId?.replace(/^\d+/, value => String(Number(value) - 1)) ?? null,
    order: task.parentId ? task.order : task.order - 1,
  }))
const previous = oldTemplate.map(task => ({ ...task, planEndDate: task.parentId ? '2025-10-20' : '', actualEndDate: '' }))
previous.push({ id: 'custom-work', stableId: 'custom-work', parentId: byName(previous, '概念阶段').id, order: 9, source: 'custom', nodeKind: 'business-period', taskName: '自定义任务', planStartDate: '2025-10-21', planEndDate: '2025-10-25', ownerMemo: '保留' })
byName(previous, 'STR1').predecessor = byName(previous, '概念启动').id
byName(previous, '自定义任务').predecessor = byName(previous, 'STR1').id
const input = {
  configTemplateTasksByType: { 'tOS版本项目': oldTemplate },
  tosTypePlanDataByProjectId: { '2': { Full: { level1Tasks: previous, marker: 'keep' }, Go: { level1Tasks: previous } } },
  publishedSnapshots: {
    'template::tOS版本项目::level1::v3': oldTemplate,
    'project::2::tos-type::Full::level1::v3::snapshot': previous,
    'project::2::level1::v3': previous,
    'project::19::tos-type::Go::level1::v3::snapshot': previous,
    'project::2::tos-type::Full::level2::v3::snapshot': previous,
    'project::1::OP::level1::v3': [{ id: 'machine', taskName: '保持整机计划' }],
  },
}
const original = structuredClone(input)
const upgraded = plan.migratePlanStoreState(input, 14)
assert.deepEqual(input, original)
for (const tasks of [upgraded.configTemplateTasksByType['tOS版本项目'], upgraded.publishedSnapshots['template::tOS版本项目::level1::v3'], upgraded.tosTypePlanDataByProjectId['2'].Full.level1Tasks, upgraded.tosTypePlanDataByProjectId['2'].Go.level1Tasks, upgraded.publishedSnapshots['project::2::tos-type::Full::level1::v3::snapshot'], upgraded.publishedSnapshots['project::19::tos-type::Go::level1::v3::snapshot'], upgraded.publishedSnapshots['project::2::level1::v3']]) {
  assert.deepEqual(roots(tasks), roots(template))
  assert.equal(new Set(tasks.map(task => task.id)).size, tasks.length)
  assert.ok(tasks.every(task => !task.parentId || tasks.some(parent => parent.id === task.parentId)))
}
const updatedProject = upgraded.tosTypePlanDataByProjectId['2'].Full.level1Tasks
assert.equal(byName(updatedProject, '概念启动').planEndDate, '2025-10-20')
assert.ok(byName(updatedProject, '规划KO').planEndDate < byName(updatedProject, 'CDCP').planEndDate)
assert.ok(byName(updatedProject, 'CDCP').planEndDate < '2025-10-20')
assert.equal(byName(updatedProject, 'CDCP').actualEndDate, '')
assert.equal(byName(updatedProject, '自定义任务').ownerMemo, '保留')
assert.equal(byName(previous, 'STR1').predecessor, '1.1')
assert.equal(byName(updatedProject, 'STR1').predecessor, '2.1')
assert.equal(byName(updatedProject, 'STR1').predecessor, byName(updatedProject, '概念启动').id)
assert.equal(byName(updatedProject, '自定义任务').predecessor, byName(updatedProject, 'STR1').id)
assert.equal(upgraded.tosTypePlanDataByProjectId['2'].Full.marker, 'keep')
for (const key of ['project::2::tos-type::Full::level2::v3::snapshot', 'project::1::OP::level1::v3']) assert.deepEqual(upgraded.publishedSnapshots[key], input.publishedSnapshots[key])
assert.deepEqual(plan.migratePlanStoreState(upgraded, plan.PLAN_STORE_VERSION), upgraded)
const compatibilityTasks = [
  ...oldTemplate,
  { id: 'old-planning', stableId: 'tos-stage-planning', parentId: null, order: 0, source: 'custom', nodeKind: 'stage', taskName: '规划阶段' },
  { id: 'old-planning-child', stableId: 'old-planning-child', parentId: 'old-planning', order: 2, source: 'custom', nodeKind: 'business-period', taskName: '保留规划工作', planEndDate: '2025-01-01' },
]
const compatibilityResult = plan.migratePlanStoreState({ configTemplateTasksByType: { 'tOS版本项目': compatibilityTasks } }, 14).configTemplateTasksByType['tOS版本项目']
assert.equal(byName(compatibilityResult, '保留规划工作').parentId, byName(compatibilityResult, '规划阶段').id)
assert.equal(new Set(compatibilityResult.map(task => task.stableId)).size, compatibilityResult.length)
const wrongScopeKey = 'project::1::tos-type::Full::level1::v3::snapshot'
assert.deepEqual(plan.migratePlanStoreState({ publishedSnapshots: { [wrongScopeKey]: previous } }, 14).publishedSnapshots[wrongScopeKey], previous)
const modified = oldTemplate.map(task => ({ ...task, taskName: task.taskName === '概念阶段' ? '自定义概念' : task.taskName }))
assert.deepEqual(plan.migratePlanStoreState({ configTemplateTasksByType: { 'tOS版本项目': modified } }, 14).configTemplateTasksByType['tOS版本项目'], modified)

for (const projectId of ['2', '6', '19']) {
  const tasks = mocks.buildProjectListMockPlanTasks(projectId, template, { projectType: 'tOS版本项目', projectName: 'tOS16.3' })
  const old = mocks.buildProjectListMockPlanTasks(projectId, oldTemplate, { projectType: 'tOS版本项目', projectName: 'tOS16.3' })
  for (const name of ['概念启动', 'STR1', 'STR5']) assert.equal(byName(tasks, name).planEndDate, byName(old, name).planEndDate)
  assert.ok(byName(tasks, '规划KO').planEndDate < byName(tasks, 'CDCP').planEndDate)
  assert.ok(byName(tasks, 'CDCP').planEndDate < byName(tasks, '概念启动').planEndDate)
  assert.ok(byName(tasks, 'STR5').planEndDate < byName(tasks, '16.3.0.110').planStartDate)
}
const acceptance = mrMocks.createMrAcceptancePlanScopeSeed()
const tosSnapshots = Object.entries(acceptance.publishedSnapshots).filter(([key]) => key.includes('::tos-type::') && key.includes('::level1::'))
assert.ok(tosSnapshots.some(([key]) => key.includes('project::19::tos-type::Full::')))
assert.ok(tosSnapshots.some(([key]) => key.includes('project::6::tos-type::Slim::')))
for (const [key, tasks] of tosSnapshots) {
  assert.ok(byName(tasks, '规划KO').planEndDate, key)
  assert.ok(byName(tasks, '规划KO').planEndDate < byName(tasks, 'CDCP').planEndDate, key)
  assert.ok(byName(tasks, 'CDCP').planEndDate < byName(tasks, '概念启动').planEndDate, key)
}
console.log('PASS: tOS planning hierarchy, safe V14 migration, custom tasks, scoped snapshots and ordered mock dates')
