#!/usr/bin/env node
import assert from 'node:assert/strict'
import { loadTypeScriptModule, projectRoot } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const { getMissingProjectInfoFields, buildProjectInfoTodos } = loadTypeScriptModule(root, 'src/lib/projectInfoCompletion.ts')
const { aggregateWorkbenchTodos, resolveWorkbenchDefaultSelection, filterWorkbenchTodos } = loadTypeScriptModule(root, 'src/lib/todoAggregation.ts')
const owner = '演示用户01'
const base = { id: 'tech', name: '基础信息测试', type: '技术项目', projectAttribute: 'formal', responsiblePersons: [owner, '演示用户02'], status: '进行中', healthStatus: 'normal', createdAt: '2026-09-14T01:00:00.000Z', fieldValues: { technicalLead: [owner] } }
const missing = getMissingProjectInfoFields(base)
assert.ok(missing.some(field => field.key === 'tmg'))
assert.ok(missing.some(field => field.key === 'projectYear'))
assert.ok(!missing.some(field => field.key === 'technicalTrack'), 'read-only source fields cannot create unactionable tasks')
const complete = { ...base, fieldValues: { ...base.fieldValues, ...Object.fromEntries(missing.map(field => [field.key, field.key === 'projectYear' ? '2026' : '已填写'])) } }
assert.deepEqual(getMissingProjectInfoFields(complete), [])
assert.ok(getMissingProjectInfoFields({ ...complete, fieldValues: { ...complete.fieldValues, projectValue: '  ' } }).some(field => field.key === 'projectValue'))
console.log('PASS required fields, complete projects and whitespace')

const machine = { ...base, id: 'machine', type: '整机产品项目', fieldValues: { machineSpm: [owner], developmentMode: '自研' } }
assert.ok(!getMissingProjectInfoFields(machine).some(field => field.key === 'isTwoStage'))
assert.ok(getMissingProjectInfoFields({ ...machine, fieldValues: { ...machine.fieldValues, developmentMode: 'ODC' } }).some(field => field.key === 'isTwoStage'))
const roadmap = { ...machine, projectAttribute: 'roadmap' }
for (const key of ['brand', 'marketName', 'productLine', 'str5Date', 'launchDate', 'androidVersion', 'startingRam']) assert.ok(getMissingProjectInfoFields(roadmap).some(field => field.key === key), key)
assert.ok(!getMissingProjectInfoFields(roadmap).some(field => field.key === 'softwareProjectLevel'), 'roadmaps use their original form contract')
const legacy = { ...complete }; delete legacy.projectAttribute
assert.deepEqual(getMissingProjectInfoFields(legacy), [])
console.log('PASS roadmap, conditional and legacy project rules')

const build = (projects, user = owner, canEdit = () => true) => buildProjectInfoTodos({ projects, currentUser: user, canEditProjectInfo: canEdit })
assert.equal(build([base, complete]).length, 1)
assert.equal(build([base], '演示用户02').length, 1, 'each responsible user receives one task')
assert.equal(build([base], '演示用户03').length, 0, 'unrelated users receive no tasks')
assert.equal(build([base], owner, () => false).length, 0, 'permission removal hides task contents')
assert.equal(build([base], '').length, 0)
assert.equal(build([]).length, 0, 'deleted project has no stale task')
assert.equal(build([{ ...base, responsiblePersons: ['演示用户02'] }]).length, 0, 'reassignment removes former owner task')
console.log('PASS ownership, permissions, deletion and reassignment')

for (const type of ['整机产品项目', 'tOS版本项目', '技术项目', '能力建设项目']) {
  assert.equal(build([{ ...base, type, projectAttribute: 'budget', fieldValues: {} }]).length, 0, `${type} budget never appears in basic-info todos`)
  assert.equal(build([{ ...base, type, projectAttribute: 'budget', boundFormalProjectId: 'formal', fieldValues: { fanTrialEnabled: '是' } }]).length, 0, 'binding and missing fan-trial details do not create budget todos')
}
assert.equal(build([roadmap]).length, 1, 'incomplete roadmaps retain their tasks')
console.log('PASS budget exclusion across all types; formal and roadmap tasks remain')

const items = build([base])
assert.equal(items[0].route.kind, 'basicInfo')
assert.equal(items[0].generatedAt, '2026-09-14')
assert.ok(items[0].taskContent.includes('项目年份'))
const aggregated = aggregateWorkbenchTodos({ currentUser: owner, today: '2026-09-14', planTodos: [], transferApplications: [], projectInfoTodos: items })
assert.equal(aggregated.length, 1)
assert.deepEqual(resolveWorkbenchDefaultSelection(aggregated), { source: 'basicInfo', status: 'pending' })
assert.deepEqual(resolveWorkbenchDefaultSelection([]), { source: 'basicInfo', status: 'all' })
assert.equal(filterWorkbenchTodos(aggregated, { source: 'basicInfo', search: '项目年份', projectId: 'tech' }).length, 1)
assert.equal(filterWorkbenchTodos(aggregated, { status: 'completed' }).length, 0)
console.log('PASS aggregation, category priority and filters')

const { RESOURCE_REGISTRY_PROJECTS } = loadTypeScriptModule(root, 'src/mock/projectRegistry.ts')
const pendingSample = RESOURCE_REGISTRY_PROJECTS.find(project => project.id === 'mock-budget-technical-info-pending')
const completedSample = RESOURCE_REGISTRY_PROJECTS.find(project => project.id === 'mock-budget-technical-info-complete')
assert.deepEqual(getMissingProjectInfoFields(pendingSample).map(field => field.key), ['projectValue'])
assert.deepEqual(getMissingProjectInfoFields(completedSample), [])
assert.equal(build([pendingSample, completedSample]).length, 0, 'both incomplete and complete budget mocks are excluded')
const roadmapSample = RESOURCE_REGISTRY_PROJECTS.find(project => project.id === 'mock-roadmap-incomplete')
assert.deepEqual(getMissingProjectInfoFields(roadmapSample).map(field => field.key), ['str5Date', 'launchDate'])
const { buildManualProjectSpaceUpdate } = loadTypeScriptModule(root, 'src/lib/manualProjectCompletion.ts')
const saved = buildManualProjectSpaceUpdate(roadmapSample, {
  infoValues: { str5Date: '2026-10-01', launchDate: '2026-11-01' }, responsiblePersons: roadmapSample.responsiblePersons,
  healthStatus: roadmapSample.healthStatus, projectStatus: roadmapSample.status, projectSecondaryCategory: roadmapSample.secondaryCategory,
})
assert.equal(build([saved]).length, 0, 'the actual manual save payload completes the task')
const partial = buildManualProjectSpaceUpdate(roadmapSample, {
  infoValues: { str5Date: '2026-10-01' }, responsiblePersons: roadmapSample.responsiblePersons,
  healthStatus: roadmapSample.healthStatus, projectStatus: roadmapSample.status, projectSecondaryCategory: roadmapSample.secondaryCategory,
})
assert.equal(build([partial]).length, 1, 'saving another field cannot complete missing information')
assert.ok(getMissingProjectInfoFields({ ...base, type: 'tOS版本项目', projectAttribute: 'budget', fieldValues: {} }).some(field => field.key === 'firstLaunchProjects'))
assert.deepEqual(getMissingProjectInfoFields({ ...base, type: '能力建设项目' }), [], 'capability projects have no additional required schema fields')
console.log('PASS fresh mocks, real save payload, partial completion and all project types')

const { useUiStore } = loadTypeScriptModule(root, 'src/stores/ui.ts')
useUiStore.getState().setProjectInfoNavigationIntent({ projectId: base.id, currentUser: owner })
useUiStore.getState().enterProjectSpace({ module: 'workbench', workbenchTab: 'todo' })
assert.equal(useUiStore.getState().projectInfoNavigationIntent.projectId, base.id)
useUiStore.getState().returnFromProjectSpace()
assert.equal(useUiStore.getState().activeModule, 'workbench')
assert.equal(useUiStore.getState().projectInfoNavigationIntent, null, 'returning cannot leak an edit intent into another project')
console.log('PASS project-space return and stale intent cleanup')
