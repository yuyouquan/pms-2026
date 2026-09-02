#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
import { loadTypeScriptModule, projectRoot, readSource } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const rules = loadTypeScriptModule(root, 'src/lib/technicalPlanRules.ts')
const level1Rules = loadTypeScriptModule(root, 'src/lib/level1PlanRules.ts')
const projectSpaceRules = loadTypeScriptModule(root, 'src/lib/projectSpaceLevel1Rules.ts')
assert.deepEqual(rules.TDT_TEMPLATE_SEED, [['规划阶段', ['规划启动', 'charter DCP']], ['概念阶段', ['TDR1']], ['计划阶段', ['TDR2', 'PDCP']], ['开发验证阶段', ['TDR3_X', 'TDCP_X']], ['迁移阶段', ['TDR4', 'EDCP']]], 'TDT seed is complete and ordered')
assert.deepEqual(rules.SUBPROJECT_TEMPLATE_SEED, ['第1版转测', '第2版转测', 'TDR3'], 'subproject seed is ordered')
assert.throws(() => rules.validateTechnicalTemplateDepth('tdt', [{ children: [{ children: [{ children: [] }] }] }]), /depth/i)
assert.throws(() => rules.validateTechnicalTemplateDepth('subproject', [{ children: [{}] }]), /child/i)

const tdtTasks = rules.buildTdtTemplateTasks()
assert.deepEqual(
  tdtTasks.map(task => task.id),
  ['1', '1.1', '1.2', '2', '2.1', '3', '3.1', '3.2', '4', '4.1', '4.2', '5', '5.1', '5.2'],
  'TDT template uses the same hierarchical numeric numbering as whole-machine templates',
)
assert.deepEqual(tdtTasks.filter(task => !task.parentId).map(task => task.taskName), rules.TDT_TEMPLATE_SEED.map(([name]) => name), 'TDT phases use exact order')
for (const [phase, children] of rules.TDT_TEMPLATE_SEED) {
  const parent = tdtTasks.find(task => task.taskName === phase)
  assert.ok(parent, `TDT phase ${phase} exists`)
  assert.deepEqual(tdtTasks.filter(task => task.parentId === parent.id).map(task => task.taskName), children, `${phase} children and order are exact`)
}
assert.equal(rules.validateTechnicalTemplateDepth('tdt', tdtTasks), true, 'TDT seed is valid')

const subprojectTasks = rules.buildSubprojectTemplateTasks()
assert.deepEqual(subprojectTasks.map(task => task.id), ['1', '2', '3'], 'subproject template uses numeric root numbering')
assert.deepEqual(subprojectTasks.map(task => task.taskName), rules.SUBPROJECT_TEMPLATE_SEED, 'subproject seed task order is exact')
assert.ok(subprojectTasks.every(task => !task.parentId), 'subproject seed is single-level')
assert.equal(rules.validateTechnicalTemplateDepth('subproject', subprojectTasks), true, 'subproject seed is valid')

const renumberedLegacyTasks = rules.renumberTechnicalTasks([
  { id: 'legacy-parent', order: 1, taskName: '父任务', predecessor: '' },
  { id: 'legacy-child-a', parentId: 'legacy-parent', order: 1, taskName: '子任务A', predecessor: '' },
  { id: 'legacy-child-b', parentId: 'legacy-parent', order: 2, taskName: '子任务B', predecessor: 'legacy-child-a' },
])
assert.deepEqual(renumberedLegacyTasks.map(task => task.id), ['1', '1.1', '1.2'], 'legacy technical IDs are migrated to hierarchical numeric IDs')
assert.equal(renumberedLegacyTasks[2].predecessor, '1.1', 'predecessor references follow migrated task numbering')

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
assert.equal(Number(planSource.match(/PLAN_STORE_VERSION\s*=\s*(\d+)/)?.[1]), 13, 'plan store preserves the V9 level-one migration, retires legacy level-three state, and backfills the workbench revision scope')
assert.match(planSource, /setTechnicalTemplateTasks/, 'plan store exposes a validating technical-template setter')
assert.match(planSource, /validateTechnicalTemplateDepth/, 'plan store enforces technical template depth')
assert.doesNotMatch(configSource, /publishedSnapshots\[versionId\]/, 'config snapshots never fall back across template scopes')
assert.match(configSource, /title:\s*['"]序号['"]/, 'technical templates use the shared numbered task table')
assert.match(configSource, /技术项目负责人/, 'technical template role selector includes the technical project owner role')
assert.match(configSource, /创建非正式版本/, 'config template revisions offer nonformal versions')
assert.match(configSource, /创建正式版本/, 'config template revisions offer formal versions')

const technicalPlanUiSource = readSource(root, 'src/components/technical-project/TechnicalPlanModule.tsx')
const technicalSummarySource = readSource(root, 'src/components/technical-project/TechnicalPlanSummary.tsx')
const technicalInformationSource = readSource(root, 'src/components/technical-project/TechnicalProjectInformationView.tsx')
const projectSpaceContainerSource = readSource(root, 'src/containers/ProjectSpaceContainer.tsx')
assert.match(technicalPlanUiSource, /创建非正式版本/, 'technical project plans offer nonformal revisions')
assert.match(technicalPlanUiSource, /创建正式版本/, 'technical project plans offer formal revisions')
assert.match(technicalPlanUiSource, /revisionKind/, 'technical project plan passes revision kind into its store')
assert.match(technicalSummarySource, /canEditPlan/, 'technical basic-information summary accepts plan-maintenance permission')
assert.match(technicalSummarySource, /updateCurrentTasks/, 'technical basic-information summary writes to the shared plan store')
const summaryVisibilityVersions = [
  { id: 'published', versionNo: 'V1', status: '已发布' },
  { id: 'draft', versionNo: 'V2', status: '修订中' },
]
assert.deepEqual(
  projectSpaceRules.selectLevel1HorizontalVersions(summaryVisibilityVersions, { surface: 'basic-info', includeDraft: false }).map(version => version.id),
  ['published', 'draft'],
  'technical basic-information shows the active revision to users without plan-maintenance permission',
)
assert.deepEqual(
  projectSpaceRules.selectLevel1HorizontalVersions(summaryVisibilityVersions, { surface: 'basic-info', includeDraft: true }).map(version => version.id),
  ['published', 'draft'],
  'technical basic-information shows the same active revision to authorized maintainers',
)
assert.match(technicalSummarySource, /const activeDraft = visibleVersions\.find[\s\S]{0,180}const currentVersion = activeDraft/, 'technical basic-information prioritizes the visible active revision independently of permission')
assert.equal((technicalSummarySource.match(/<ClickToEditDate/g) || []).length, 1, 'technical basic-information keeps all version plan dates read-only and exposes only the actual-date editor')
assert.match(technicalSummarySource, /const canEditActualEnd = canEditPlan &&/, 'technical basic-information gates actual-date edits on plan-maintenance permission')
assert.match(technicalSummarySource, /actualTask && canEditActualEnd[\s\S]{0,240}<ClickToEditDate/, 'technical basic-information actual-date editor also requires a matching published task')
assert.match(technicalInformationSource, /<TechnicalPlanSummary[\s\S]{0,220}canEditPlan=/, 'technical information forwards plan-maintenance permission to the summary')
assert.match(projectSpaceContainerSource, /<TechnicalProjectInformationView[\s\S]{0,420}canEditPlan=\{canGovernLevel1Plan\}/, 'project space uses technical plan permission instead of basic-information permission for plan dates')

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

const technicalProjectModule = loadTypeScriptModule(root, 'src/stores/technicalProject.ts')
const technicalPlanModule = loadTypeScriptModule(root, 'src/stores/technicalPlan.ts')
assert.equal(technicalPlanModule.TECHNICAL_PLAN_STORE_VERSION, 8, 'technical plan persistence declares the controlled-transfer migration version')
const migratedLegacyPlan = technicalPlanModule.migrateTechnicalPlanState({
  plansByKey: {
    '9:tdt': {
      planKey: '9:tdt', templateKind: 'tdt', currentVersionId: 'tech-9-v2-draft',
      versions: [{ id: 'tech-9-v2-draft', versionNo: 'V2', templateType: 'tdt', status: '修订中', tasks: [{ id: 'legacy-only', taskName: '旧默认任务' }] }],
    },
  },
}, 0)
assert.deepEqual(
  migratedLegacyPlan.plansByKey['9:tdt'].versions[0].tasks.map(task => task.taskName),
  tdtTasks.map(task => task.taskName),
  'legacy seeded TDT draft migrates to the complete Task10 TDT template',
)
assert.deepEqual(migratedLegacyPlan.plansByKey['9:tdt'].versions.at(-1).tasks.map(task => task.taskName), tdtTasks.map(task => task.taskName), 'legacy seeded draft is also reset to the complete TDT template')
assert.ok(migratedLegacyPlan.plansByKey['9:tdt'].columnSettings, 'migration backfills per-instance columns')
assert.deepEqual(migratedLegacyPlan.plansByKey['9:tdt'].collapsedRows, [], 'migration backfills collapsed rows')
const orderedTabs = technicalPlanModule.buildTechnicalPlanTabs('9', technicalProjectModule.INITIAL_TECHNICAL_SUBPROJECTS, false)
assert.deepEqual(orderedTabs.map(tab => tab.key), ['9:tdt', '9:subproject:IPM-AI-001', '9:subproject:IPM-AI-002'], 'TDT is first and active children follow IPM order')
assert.equal(orderedTabs[0].label, 'TDT项目计划')
assert.deepEqual(
  technicalPlanModule.buildTechnicalPlanTabs('9', technicalProjectModule.INITIAL_TECHNICAL_SUBPROJECTS, true).map(tab => tab.key),
  ['9:tdt', '9:subproject:IPM-AI-001', '9:subproject:IPM-AI-002', '9:subproject:IPM-AI-003'],
  'history mode includes inactive children in IPM order',
)

const instanceStore = technicalPlanModule.createTechnicalPlanStore({ plansByKey: {} })
const tdtPlanScope = { kind: 'tdt', parentProjectId: '9' }
const childPlanScope = { kind: 'subproject', parentProjectId: '9', subprojectId: 'IPM-AI-001' }
const incompleteChildScope = { kind: 'subproject', parentProjectId: '9', subprojectId: 'IPM-AI-002' }
const inactiveChildScope = { kind: 'subproject', parentProjectId: '9', subprojectId: 'IPM-AI-003' }
const configuredChild = technicalProjectModule.INITIAL_TECHNICAL_SUBPROJECTS[0]
const incompleteChild = {
  ...technicalProjectModule.INITIAL_TECHNICAL_SUBPROJECTS[1],
  configuration: { coreValue: '', developmentMode: '', firstTosVersion: '', firstMachineProjectId: '' },
}
const inactiveChild = technicalProjectModule.INITIAL_TECHNICAL_SUBPROJECTS[2]
assert.deepEqual(instanceStore.createRevision({ scope: tdtPlanScope, templateKind: 'tdt', templateTasks: tdtTasks }), { ok: true, versionId: 'V1-draft' }, 'TDT creates its own first draft')
assert.deepEqual(instanceStore.createRevision({ scope: tdtPlanScope, templateKind: 'tdt', templateTasks: tdtTasks }), { ok: false, reason: 'draft-exists' }, 'one instance allows at most one draft')
assert.equal(instanceStore.publishRevision(tdtPlanScope, '2026-08-01T00:00:00Z').ok, true, 'TDT draft publishes')
assert.deepEqual(instanceStore.createRevision({ scope: childPlanScope, templateKind: 'subproject', templateTasks: subprojectTasks, subproject: configuredChild }), { ok: true, versionId: 'V1-draft' }, 'child has an independent V1 sequence')
assert.equal(instanceStore.getState().plansByKey['9:tdt'].versions.length, 1, 'publishing child does not mutate TDT versions')
assert.deepEqual(instanceStore.createRevision({ scope: inactiveChildScope, templateKind: 'subproject', templateTasks: subprojectTasks, subproject: inactiveChild }), { ok: false, reason: 'inactive' }, 'inactive child is history-only')
assert.deepEqual(instanceStore.createRevision({ scope: incompleteChildScope, templateKind: 'subproject', templateTasks: subprojectTasks, subproject: incompleteChild }), { ok: false, reason: 'incomplete-configuration' }, 'incomplete child cannot create a revision')

const childV1 = instanceStore.getState().plansByKey['9:subproject:IPM-AI-001'].versions[0]
const editedTemplate = subprojectTasks.map((task, index) => ({ ...task, taskName: index === 0 ? '后改模板' : task.taskName }))
assert.equal(instanceStore.publishRevision(childPlanScope, '2026-08-01T01:00:00Z').ok, true)
assert.deepEqual(instanceStore.createRevision({ scope: childPlanScope, templateKind: 'subproject', templateTasks: editedTemplate, subproject: configuredChild }), { ok: true, versionId: 'V2-draft' }, 'next child revision advances only its own sequence')
const childState = instanceStore.getState().plansByKey['9:subproject:IPM-AI-001']
assert.equal(childState.versions[0].tasks[0].taskName, childV1.tasks[0].taskName, 'template edits never mutate existing versions')
assert.equal(childState.versions[1].tasks[0].taskName, '后改模板', 'new draft uses latest matching template snapshot')
assert.notStrictEqual(childState.versions[0].tasks, childState.versions[1].tasks, 'version task snapshots are isolated')
const editedDraftTasks = childState.versions[1].tasks.map((task, index) => index === 0 ? { ...task, actualStartDate: '2026-08-07', actualEndDate: '2026-08-08' } : task)
assert.equal(instanceStore.updateCurrentTasks(childPlanScope, editedDraftTasks, 1).ok, true, 'draft actual dates can be updated')
assert.equal(instanceStore.getState().plansByKey['9:subproject:IPM-AI-001'].versions[0].tasks[0].actualStartDate, '2026-08-07', 'draft actual start synchronizes to paired published version')
assert.equal(instanceStore.getState().plansByKey['9:subproject:IPM-AI-001'].versions[0].tasks[0].actualEndDate, '2026-08-08', 'draft actual completion synchronizes to paired published version')
assert.equal(instanceStore.publishRevision(childPlanScope, '2026-08-09T00:00:00Z').ok, true)
const laterTemplate = editedTemplate.map((task, index) => ({ ...task, taskName: index === 0 ? '不应同步的后续模板' : task.taskName }))
assert.equal(instanceStore.createRevision({ scope: childPlanScope, templateKind: 'subproject', templateTasks: laterTemplate, subproject: configuredChild }).ok, true)
const childV3 = instanceStore.getState().plansByKey['9:subproject:IPM-AI-001'].versions.at(-1)
assert.equal(childV3.tasks[0].taskName, '后改模板', 'later revisions copy the previous published version instead of syncing the latest template')
const publishedV2 = instanceStore.getState().plansByKey['9:subproject:IPM-AI-001'].versions.find(version => version.versionNo === 'V2')
assert.equal(instanceStore.setCurrentVersion(childPlanScope, publishedV2.id), true)
const publishedWrite = publishedV2.tasks.map((task, index) => index === 0 ? { ...task, taskName: '禁止修改名称', planStartDate: '2026-01-01', actualStartDate: '2026-08-17', actualEndDate: '2026-08-18' } : task)
assert.equal(instanceStore.updateCurrentTasks(childPlanScope, publishedWrite, 1).ok, true)
const afterPublishedWrite = instanceStore.getState().plansByKey['9:subproject:IPM-AI-001']
assert.equal(afterPublishedWrite.versions.find(version => version.versionNo === 'V2').tasks[0].taskName, '后改模板', 'published writes only accept actual completion changes')
assert.equal(afterPublishedWrite.versions.find(version => version.versionNo === 'V2').tasks[0].planStartDate, childV1.tasks[0].planStartDate, 'published writes cannot overwrite planned start dates')
assert.equal(afterPublishedWrite.versions.find(version => version.status === '修订中').tasks[0].actualStartDate, '2026-08-17', 'published actual start synchronizes back to the paired draft')
assert.equal(afterPublishedWrite.versions.find(version => version.status === '修订中').tasks[0].actualEndDate, '2026-08-18', 'published actual completion synchronizes back to the paired draft')
assert.deepEqual(instanceStore.getState().plansByKey['9:tdt'].versions.map(version => version.versionNo), ['V1'], 'child actions do not change TDT sequence')
instanceStore.setColumns(childPlanScope, { order: ['taskName'], visible: ['taskName'] })
instanceStore.setCollapsed(childPlanScope, ['subproject-1'])
assert.deepEqual(instanceStore.getState().plansByKey['9:subproject:IPM-AI-001'].columnSettings.visible, ['taskName'], 'columns persist per plan key')
assert.deepEqual(instanceStore.getState().plansByKey['9:subproject:IPM-AI-001'].collapsedRows, ['subproject-1'], 'collapsed rows persist per plan key')
assert.equal(instanceStore.getState().plansByKey['9:tdt'].columnSettings.visible.includes('taskName'), true, 'TDT column state remains independent')

const invalidTdtTasks = [{ ...tdtTasks[0] }, { ...tdtTasks[1] }, { ...tdtTasks[1], id: 'too-deep', parentId: tdtTasks[1].id }]
assert.deepEqual(
  instanceStore.createRevision({ scope: { kind: 'tdt', parentProjectId: 'depth-test' }, templateKind: 'tdt', maxDepth: 2, templateTasks: invalidTdtTasks }),
  { ok: false, reason: 'max-depth' },
  'TDT store rejects revisions deeper than two levels',
)
assert.deepEqual(
  instanceStore.createRevision({ scope: { kind: 'subproject', parentProjectId: '9', subprojectId: 'depth-child' }, templateKind: 'subproject', maxDepth: 1, templateTasks: [{ ...subprojectTasks[0], parentId: 'parent' }], subproject: configuredChild }),
  { ok: false, reason: 'max-depth' },
  'subproject store rejects child tasks',
)
const tdtBeforeInvalidWrite = instanceStore.getState().plansByKey['9:tdt'].versions[0].tasks
assert.equal(instanceStore.createRevision({ scope: tdtPlanScope, templateKind: 'tdt', maxDepth: 2, templateTasks: tdtTasks }).ok, true)
assert.deepEqual(instanceStore.updateCurrentTasks(tdtPlanScope, invalidTdtTasks, 2), { ok: false, reason: 'max-depth' }, 'all task writes enforce maxDepth')
assert.deepEqual(instanceStore.getState().plansByKey['9:tdt'].versions[0].tasks, tdtBeforeInvalidWrite, 'rejected writes are atomic')

const addedTopLevel = rules.insertTechnicalPlanTask(tdtTasks, { ...tdtTasks[0], id: 'new-top', parentId: undefined }, 'tdt', 2)
assert.equal(addedTopLevel.at(-1).id, 'new-top', 'draft editing can add a top-level task')
const addedTdtChild = rules.insertTechnicalPlanTask(tdtTasks, { ...tdtTasks[0], id: 'new-child', parentId: tdtTasks[0].id }, 'tdt', 2)
assert.equal(addedTdtChild.find(task => task.id === 'new-child').parentId, tdtTasks[0].id, 'TDT editing can add a second-level task')
assert.throws(() => rules.insertTechnicalPlanTask(subprojectTasks, { ...subprojectTasks[0], id: 'illegal-child', parentId: subprojectTasks[0].id }, 'subproject', 1), /depth|child/i, 'subproject editing cannot add child tasks')
assert.deepEqual(
  rules.deleteTechnicalPlanTaskCascade(addedTdtChild, tdtTasks[0].id).map(task => task.id),
  tdtTasks.filter(task => task.id !== tdtTasks[0].id && task.parentId !== tdtTasks[0].id).map(task => task.id),
  'deleting a parent cascades through its children',
)

const technicalModuleSource = readSource(root, 'src/components/technical-project/TechnicalPlanModule.tsx')
const technicalWorkspace = loadTypeScriptModule(root, 'src/lib/technicalPlanWorkspace.ts')
const numberedSubprojectTasks = technicalWorkspace.renumberTechnicalSubprojectTasks([
  ...subprojectTasks,
  {
    ...subprojectTasks[0],
    id: 'technical-task-1787125461',
    stableId: 'technical-custom-1',
    source: 'custom',
    order: 4,
    taskName: '新建一级任务',
  },
])
assert.deepEqual(numberedSubprojectTasks.map(task => task.id), ['1', '2', '3', '4'], 'technical subproject activities always expose continuous numeric sequence values')
assert.equal(numberedSubprojectTasks.at(-1).stableId, 'technical-custom-1', 'renumbering keeps the stable identity used for version synchronization')
const controlledSubprojectRoot = numberedSubprojectTasks.at(-1)
assert.equal(level1Rules.canMutateLevel1TaskStructure({ projectType: '技术项目', technicalKind: 'subproject', task: controlledSubprojectRoot, action: 'delete' }), true, 'custom subproject roots remain deletable')
assert.equal(level1Rules.canMutateLevel1TaskStructure({ projectType: '技术项目', technicalKind: 'subproject', task: controlledSubprojectRoot, action: 'rename' }), false, 'custom subproject roots cannot be renamed')
assert.equal(level1Rules.canMutateLevel1TaskStructure({ projectType: '技术项目', technicalKind: 'subproject', task: controlledSubprojectRoot, action: 'reorder' }), false, 'custom subproject roots cannot be reordered')
const planWorkspaceShellPath = 'src/components/plans/PlanWorkspaceShell.tsx'
assert.equal(fs.existsSync(`${root}/${planWorkspaceShellPath}`), true, 'plan workspace provides a shared shell for whole-machine and technical projects')
const planWorkspaceShell = readSource(root, planWorkspaceShellPath)
const parseTsx = (source, fileName) => ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const shellSourceFile = parseTsx(planWorkspaceShell, planWorkspaceShellPath)
const technicalSourceFile = parseTsx(technicalModuleSource, 'TechnicalPlanModule.tsx')
const hasExportModifier = node => node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)
const functionLikeFromDeclaration = declaration => {
  if (ts.isFunctionDeclaration(declaration)) return declaration
  if (ts.isVariableDeclaration(declaration) && declaration.initializer && (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))) return declaration.initializer
  return undefined
}
const findLocalDeclaration = (sourceFile, name) => {
  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name?.text === name) return statement
    if (ts.isVariableStatement(statement)) {
      const declaration = statement.declarationList.declarations.find(item => ts.isIdentifier(item.name) && item.name.text === name)
      if (declaration) return declaration
    }
  }
  return undefined
}
const findExportedFunctionComponent = (sourceFile, name) => {
  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name?.text === name && hasExportModifier(statement)) return { declaration: statement, functionLike: statement }
    if (ts.isVariableStatement(statement) && hasExportModifier(statement)) {
      const declaration = statement.declarationList.declarations.find(item => ts.isIdentifier(item.name) && item.name.text === name)
      const functionLike = declaration && functionLikeFromDeclaration(declaration)
      if (declaration && functionLike) return { declaration, functionLike }
    }
    if (ts.isExportAssignment(statement) && ts.isIdentifier(statement.expression) && statement.expression.text === name) {
      const declaration = findLocalDeclaration(sourceFile, name)
      const functionLike = declaration && functionLikeFromDeclaration(declaration)
      if (declaration && functionLike) return { declaration, functionLike }
    }
    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      const element = statement.exportClause.elements.find(item => item.name.text === name)
      const declaration = element && findLocalDeclaration(sourceFile, element.propertyName?.text || element.name.text)
      const functionLike = declaration && functionLikeFromDeclaration(declaration)
      if (declaration && functionLike) return { declaration, functionLike }
    }
  }
  return undefined
}
const importsComponent = (sourceFile, name, modulePath) => sourceFile.statements.some(statement => {
  if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || statement.moduleSpecifier.text !== modulePath) return false
  const clause = statement.importClause
  if (clause?.name?.text === name) return true
  return Boolean(clause?.namedBindings && ts.isNamedImports(clause.namedBindings) && clause.namedBindings.elements.some(element => element.name.text === name))
})
const collectBindings = sourceFile => {
  const bindings = new Map()
  const walk = node => {
    if (ts.isFunctionDeclaration(node) && node.name) bindings.set(node.name.text, node)
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) bindings.set(node.name.text, node.initializer)
    ts.forEachChild(node, walk)
  }
  walk(sourceFile)
  return bindings
}
const returnedExpressions = functionLike => {
  if (!ts.isBlock(functionLike.body)) return [functionLike.body]
  const returns = []
  const walk = node => {
    if (node !== functionLike.body && ts.isFunctionLike(node)) return
    if (ts.isReturnStatement(node) && node.expression) returns.push(node.expression)
    else ts.forEachChild(node, walk)
  }
  walk(functionLike.body)
  return returns
}
const collectReachableFromRoots = (sourceFile, roots) => {
  const bindings = collectBindings(sourceFile)
  const nodes = []
  const seen = new Set()
  const walk = node => {
    if (!node || seen.has(node)) return
    seen.add(node)
    nodes.push(node)
    if (ts.isIdentifier(node) && bindings.has(node.text)) {
      const binding = bindings.get(node.text)
      if (ts.isFunctionLike(binding)) returnedExpressions(binding).forEach(walk)
      else walk(binding)
    }
    ts.forEachChild(node, walk)
  }
  roots.forEach(walk)
  return nodes
}
const collectReachableNodes = (sourceFile, component) => collectReachableFromRoots(sourceFile, returnedExpressions(component.functionLike))
const findJsxMount = (nodes, sourceFile, name) => nodes.find(node => (
  (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText(sourceFile) === name
))
const jsxAttributeNames = node => new Set(node.attributes.properties.filter(ts.isJsxAttribute).map(attribute => attribute.name.getText()))
const jsxAttribute = (node, name) => node.attributes.properties.find(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText() === name)
const propsMembersForComponent = (sourceFile, component) => {
  let typeNode = component.functionLike.parameters[0]?.type
  if (!typeNode && ts.isVariableDeclaration(component.declaration) && component.declaration.type && ts.isTypeReferenceNode(component.declaration.type)) {
    typeNode = component.declaration.type.typeArguments?.[0]
  }
  const resolveMembers = candidate => {
    if (!candidate) return []
    if (ts.isTypeLiteralNode(candidate)) return candidate.members
    if (ts.isIntersectionTypeNode(candidate)) return candidate.types.flatMap(resolveMembers)
    if (ts.isTypeReferenceNode(candidate)) {
      const typeName = candidate.typeName.getText(sourceFile)
      const declaration = sourceFile.statements.find(statement => (
        (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) && statement.name.text === typeName
      ))
      if (declaration && ts.isInterfaceDeclaration(declaration)) return declaration.members
      if (declaration && ts.isTypeAliasDeclaration(declaration)) return resolveMembers(declaration.type)
    }
    return []
  }
  return new Set(resolveMembers(typeNode).map(member => member.name?.getText(sourceFile)).filter(Boolean))
}
const jsxControlHasLabel = (node, sourceFile, label) => {
  const opening = ts.isJsxElement(node) ? node.openingElement : node
  if ((!ts.isJsxSelfClosingElement(opening) && !ts.isJsxOpeningElement(opening)) || !['Button', 'Tooltip'].includes(opening.tagName.getText(sourceFile))) return false
  const hasAttributeLabel = opening.attributes.properties.some(attribute => {
    if (!ts.isJsxAttribute(attribute) || !['aria-label', 'title'].includes(attribute.name.getText())) return false
    if (attribute.initializer && ts.isStringLiteral(attribute.initializer)) return attribute.initializer.text === label
    return Boolean(attribute.initializer && ts.isJsxExpression(attribute.initializer) && ts.isStringLiteral(attribute.initializer.expression) && attribute.initializer.expression.text === label)
  })
  const hasTextLabel = ts.isJsxElement(node) && node.children.some(child => ts.isJsxText(child) && child.text.trim() === label)
  return hasAttributeLabel || hasTextLabel
}
const rendersLiveCapabilityControl = (nodes, sourceFile, label) => nodes.some(node => (
  (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node))
  && jsxControlHasLabel(node, sourceFile, label)
))
const configuresViewMode = (nodes, sourceFile, mode) => nodes.some(node => (
  ts.isPropertyAssignment(node) && node.name.getText(sourceFile) === 'value' && ts.isStringLiteral(node.initializer) && node.initializer.text === mode
))
const hasViewBranch = (nodes, sourceFile, mode) => nodes.some(node => {
  if (!ts.isBinaryExpression(node) || ![ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken].includes(node.operatorToken.kind)) return false
  const pairs = [[node.left, node.right], [node.right, node.left]]
  return pairs.some(([candidate, value]) => candidate.getText(sourceFile).endsWith('viewMode') && ts.isStringLiteral(value) && value.text === mode)
})

const shellComponent = findExportedFunctionComponent(shellSourceFile, 'PlanWorkspaceShell')
assert.ok(shellComponent, 'shared plan workspace shell resolves to an exported live function component')
const shellProps = propsMembersForComponent(shellSourceFile, shellComponent)
const shellReachableNodes = collectReachableNodes(shellSourceFile, shellComponent)
for (const prop of ['versionControls', 'primaryActions', 'utilityActions', 'viewMode', 'onViewModeChange', 'children']) {
  assert.equal(shellProps.has(prop), true, `the exported shell props declare live structure slot ${prop}`)
}
for (const label of ['计划版本操作', '计划工具', '计划内容']) {
  assert.ok(shellReachableNodes.some(node => (
    (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
    && node.attributes.properties.some(attribute => ts.isJsxAttribute(attribute)
      && attribute.name.getText() === 'aria-label'
      && attribute.initializer
      && ts.isStringLiteral(attribute.initializer)
      && attribute.initializer.text === label)
  )), `the exported shell return tree renders its ${label} structure`)
}
assert.equal(importsComponent(shellSourceFile, 'PlanViewModeSwitcher', '@/components/plans/PlanViewModeSwitcher'), true, 'the exported shell imports the canonical view-mode switcher')
assert.ok(findJsxMount(shellReachableNodes, shellSourceFile, 'PlanViewModeSwitcher'), 'the exported shell return tree mounts its canonical view-mode switcher')
assert.equal(importsComponent(technicalSourceFile, 'PlanWorkspaceShell', '@/components/plans/PlanWorkspaceShell'), true, 'technical plan module imports the shared shell from its canonical module')
const technicalComponent = findExportedFunctionComponent(technicalSourceFile, 'TechnicalPlanModule')
assert.ok(technicalComponent, 'technical plan module resolves to its exported live function component')
const technicalReachableNodes = collectReachableNodes(technicalSourceFile, technicalComponent)
const technicalShellMount = findJsxMount(technicalReachableNodes, technicalSourceFile, 'PlanWorkspaceShell')
assert.ok(technicalShellMount, 'technical plan module mounts the imported shared plan workspace shell')
const technicalShellProps = jsxAttributeNames(technicalShellMount)
const shellCapabilities = [
  ['创建修订', 'primaryActions'],
  ['计划克隆', 'primaryActions'],
  ['筛选', 'utilityActions'],
  ['字段配置', 'utilityActions'],
  ['全部展开', 'utilityActions'],
  ['全部收起', 'utilityActions'],
  ['版本对比', 'utilityActions'],
]
for (const slot of ['primaryActions', 'utilityActions']) assert.equal(technicalShellProps.has(slot), true, `technical plan fills the shared shell ${slot} slot`)
for (const [label, slot] of shellCapabilities) {
  const slotAttribute = jsxAttribute(technicalShellMount, slot)
  assert.ok(slotAttribute?.initializer && ts.isJsxExpression(slotAttribute.initializer) && slotAttribute.initializer.expression, `technical plan passes a live ${slot} expression for ${label}`)
  const slotNodes = collectReachableFromRoots(technicalSourceFile, [slotAttribute.initializer.expression])
  assert.equal(rendersLiveCapabilityControl(slotNodes, technicalSourceFile, label), true, `technical plan's ${slot} slot renders an actual ${label} control`)
}
const utilitySlotAttribute = jsxAttribute(technicalShellMount, 'utilityActions')
assert.ok(utilitySlotAttribute?.initializer && ts.isJsxExpression(utilitySlotAttribute.initializer) && utilitySlotAttribute.initializer.expression, 'technical plan exposes live utility actions')
const utilitySlotNodes = collectReachableFromRoots(technicalSourceFile, [utilitySlotAttribute.initializer.expression])
for (const hiddenLabel of ['导入', '分享计划']) {
  assert.equal(rendersLiveCapabilityControl(utilitySlotNodes, technicalSourceFile, hiddenLabel), false, `technical projects hide the ${hiddenLabel} control in project space`)
}
const viewSwitcherSource = readSource(root, 'src/components/plans/PlanViewModeSwitcher.tsx')
const viewSwitcherSourceFile = parseTsx(viewSwitcherSource, 'PlanViewModeSwitcher.tsx')
const viewSwitcherComponent = findExportedFunctionComponent(viewSwitcherSourceFile, 'PlanViewModeSwitcher')
assert.ok(viewSwitcherComponent, 'canonical plan view-mode switcher resolves to its exported live component')
const viewSwitcherReachableNodes = collectReachableNodes(viewSwitcherSourceFile, viewSwitcherComponent)
for (const mode of ['vertical', 'horizontal', 'gantt']) {
  assert.equal(configuresViewMode(viewSwitcherReachableNodes, viewSwitcherSourceFile, mode), true, `the live canonical view switcher configures the ${mode} view option`)
  assert.equal(hasViewBranch(technicalReachableNodes, technicalSourceFile, mode), true, `the exported technical plan renders a real ${mode} view branch`)
}
assert.equal(technicalShellProps.has('viewMode'), true, 'technical plan passes its current view mode into the shell')
assert.equal(technicalShellProps.has('onViewModeChange'), true, 'technical plan passes its view-mode handler into the shell')
assert.match(technicalModuleSource, /TDT项目计划/, 'technical plan UI renders the fixed TDT tab')
assert.doesNotMatch(technicalModuleSource, /显示已停用|showInactive|Switch/, 'technical plan UI hides inactive subprojects instead of exposing history mode')
assert.match(technicalModuleSource, /SettingOutlined/, 'child plan tabs expose configuration')
assert.match(technicalModuleSource, /compareVersionsForTable/, 'technical plans reuse version comparison')
assert.match(technicalModuleSource, /exportSheet/, 'technical plans reuse Excel export')
assert.match(technicalModuleSource, /maxDepthByKind:\s*Readonly<Record<TechnicalTemplateKind, number>>/, 'technical plan exposes the max-depth input')
assert.match(technicalModuleSource, /maxDepthByKind\[tab\?\.templateKind \|\| 'tdt'\]/, 'technical plan derives writes from the active template max depth')
assert.doesNotMatch(technicalModuleSource, /handleAddChildTask/, 'TDT has no structure-add handler')
assert.match(technicalModuleSource, /const canEditTaskStructure = canMaintain && tab\?\.templateKind === 'subproject' && viewMode === 'vertical'/, 'only editable subproject drafts expose custom-delete structure actions')
const renderDateStart = technicalModuleSource.indexOf('const renderDate')
const renderDateEnd = technicalModuleSource.indexOf('const tdtColumns', renderDateStart)
assert.ok(renderDateStart >= 0 && renderDateEnd > renderDateStart, 'date renderer is bounded for readonly-error inspection')
const renderDateSource = technicalModuleSource.slice(renderDateStart, renderDateEnd)
assert.match(renderDateSource, /const content = editable\(row\)[\s\S]{0,320}return reasons\.length \? <Tooltip title=\{reasons\.join\('；'\)\}>\{content\}<\/Tooltip> : content/, 'invalid date reasons wrap both editable and readonly cells outside the editable branch')
for (const label of ['阶段', '里程碑点', '活动名称', '添加转测版本', '实际开始时间', '实际完成时间']) assert.match(technicalModuleSource, new RegExp(label), `technical flat plan contains ${label}`)
assert.match(technicalModuleSource, /validateTechnicalSubprojectDates/, 'subproject validates all four date fields')
assert.match(technicalModuleSource, /insertNextTechnicalSubprojectTransfer/, 'subproject only supports controlled transfer insertion')
assert.match(technicalModuleSource, /handleDeleteTask/, 'custom subproject activities can be deleted')
assert.doesNotMatch(technicalModuleSource, /handleAddTopLevelTask|reorderTechnicalSubprojectCustomTasks|canRenameTechnicalTask/, 'technical flat plans do not allow generic add, reorder, or rename')
assert.match(technicalModuleSource, /canImport/, 'technical plan import has a dedicated permission input')
assert.match(technicalModuleSource, /canExport/, 'technical plan export has a dedicated permission input')
for (const field of ['actualStartDate', 'actualEndDate', 'actualDays']) {
  assert.match(technicalModuleSource, new RegExp(`dataIndex: '${field}'`), `technical plan vertical table exposes its visible ${field} field`)
}
assert.match(technicalModuleSource, /canViewTechnicalPlan/, 'technical plan accepts only its L1 technical view capability')
assert.doesNotMatch(technicalModuleSource, /isResponsibleForTechnicalPlanTasks/, 'technical draft visibility does not retain the obsolete task-responsibility shortcut')
assert.doesNotMatch(technicalModuleSource, /effectiveTasks|level2PlanTasks|projectPlanLevel/, 'technical plan never reads whole-machine or level-2 plan state')
assert.match(technicalModuleSource, /visibleVersions/, 'all technical plan version surfaces share one visible-version selector')
assert.match(technicalModuleSource, /navigateWithEditGuard\([^,]+,\s*Boolean\(isDraft\)\)/s, 'scope and version switches use the current draft state for edit guarding')
assert.match(technicalModuleSource, /buildPlanGanttTasks[\s\S]{0,300}editable:\s*canMaintain[\s\S]{0,260}onTaskDateChange/, 'technical Gantt is typed and writes validated dates')
assert.match(technicalModuleSource, /scrollIntoView/, 'publish validation moves focus to the first invalid row')
assert.match(technicalModuleSource, /firstInvalidTaskId[\s\S]{0,320}setCollapsed\(scope, \[\]\)[\s\S]{0,320}requestAnimationFrame/, 'publish validation exposes the first invalid flat row')
assert.match(technicalModuleSource, /const publishedVersions = useMemo\([\s\S]{0,160}canViewTechnicalPlan/, 'published versions remain inaccessible without technical-plan view permission')
assert.match(technicalModuleSource, /canShareTechnicalPlan/, 'technical plan sharing accepts its dedicated L1 share capability')
assert.match(technicalModuleSource, /const handleShare = \(\) => \{\s*if \(!canViewTechnicalPlan \|\| !canShareTechnicalPlan\) return/, 'sharing has strict view and share permission guards')
assert.match(technicalModuleSource, /编辑模式[\s\S]{0,180}自动保存/, 'technical drafts expose the same edit-mode guidance as whole-machine plans')
assert.match(technicalModuleSource, /key:\s*['"]sequence['"][^\n]*fixed:\s*['"]left['"]/, 'the flat sequence column stays fixed')
assert.match(technicalModuleSource, /key:\s*['"]activityName['"][^\n]*fixed:\s*['"]left['"]/, 'the subproject activity column stays fixed')
assert.match(technicalModuleSource, /key:\s*['"]actions['"][^\n]*fixed:\s*['"]right['"]/, 'the technical operation column stays fixed on horizontal scroll')
assert.match(technicalModuleSource, /className=[^\n]*technical-plan-vertical-table/, 'the technical vertical plan table has a stable layout scope')
assert.match(technicalModuleSource, /renumberTechnicalSubprojectTasks/, 'custom subproject deletes normalize visible sequence numbers')
assert.doesNotMatch(technicalModuleSource, /canManageStructure/, 'technical structure rules no longer depend on the former global-admin-only prop')
assert.doesNotMatch(readSource(root, 'src/containers/ProjectSpaceContainer.tsx'), /canManageStructure=\{level1GlobalAdmins\.includes/, 'the project container no longer grants a global structure bypass')
assert.match(technicalModuleSource, /icon=\{<CopyOutlined\s*\/>\}[^>]*aria-label="计划克隆"[^>]*\/>/, 'technical plan clone uses the same icon-only draft action as whole-machine plans')
assert.match(technicalModuleSource, /icon=\{<SaveOutlined\s*\/>\}[^>]*aria-label="发布"[^>]*\/>/, 'technical plan publish uses the same icon-only draft action as whole-machine plans')
assert.doesNotMatch(
  technicalModuleSource,
  /<Table[\s\S]{0,260}technical-horizontal-plan-table/,
  'technical horizontal plans no longer use the divergent Ant Design table renderer',
)
assert.match(
  technicalModuleSource,
  /<table[^>]*className="pms-level1-horizontal-table technical-horizontal-plan-table"/,
  'technical horizontal plans reuse the whole-machine two-row table visual contract',
)
assert.match(technicalModuleSource, /TECHNICAL_STAGE_COLORS/, 'technical horizontal stages use the same ordered color accents as whole-machine plans')
assert.match(technicalModuleSource, /<EditOutlined[^>]*aria-label="修订中"/, 'technical revisions use the same compact edit icon as whole-machine plans')
assert.equal((technicalModuleSource.match(/<ClickToEditDate\s+align="center"/g) || []).length >= 2, true, 'technical planned and actual completion dates use the same centered click-to-edit treatment')
assert.match(technicalModuleSource, /technical-horizontal-current/, 'the latest technical version uses the same highlighted-row treatment')
assert.match(technicalModuleSource, /technical-horizontal-actual/, 'the technical actual row uses the same highlighted-row treatment')
assert.doesNotMatch(technicalModuleSource, /横版只读/, 'technical horizontal revisions do not show the redundant read-only label')
const technicalHorizontalHeaderStart = technicalModuleSource.indexOf('{groups.map(({ stage, colSpan }, index) => {')
const technicalHorizontalHeaderEnd = technicalModuleSource.indexOf('</thead>', technicalHorizontalHeaderStart)
assert.ok(technicalHorizontalHeaderStart >= 0 && technicalHorizontalHeaderEnd > technicalHorizontalHeaderStart, 'technical horizontal stage header slice is present')
const technicalHorizontalHeaderSource = technicalModuleSource.slice(technicalHorizontalHeaderStart, technicalHorizontalHeaderEnd)
assert.match(technicalHorizontalHeaderSource, /stage\.estimatedDays == null \? '-' : `\$\{stage\.estimatedDays\}天`/, 'technical horizontal stages show estimated duration')
assert.doesNotMatch(technicalHorizontalHeaderSource, /manpowerPercent|planStartDate|planEndDate|~/, 'technical horizontal stage headers omit percentages and date ranges')
const technicalSummaryHeaderStart = technicalSummarySource.indexOf('{groups.map((group, index) => {')
const technicalSummaryHeaderEnd = technicalSummarySource.indexOf('</thead>', technicalSummaryHeaderStart)
assert.ok(technicalSummaryHeaderStart >= 0 && technicalSummaryHeaderEnd > technicalSummaryHeaderStart, 'technical summary stage header slice is present')
const technicalSummaryHeaderSource = technicalSummarySource.slice(technicalSummaryHeaderStart, technicalSummaryHeaderEnd)
assert.match(technicalSummaryHeaderSource, /group\.stage\.estimatedDays == null \? '-' : `\$\{group\.stage\.estimatedDays\}天`/, 'technical basic-information stages show estimated duration')
assert.doesNotMatch(technicalSummaryHeaderSource, /manpowerPercent|planStartDate|planEndDate|~/, 'technical basic-information stage headers omit percentages and date ranges')
const globalStylesSource = readSource(root, 'src/styles/globals.css')
assert.match(globalStylesSource, /\.pms-table \.ant-table-thead\s*>\s*tr\s*>\s*th\.ant-table-cell-fix-(?:start|end)[\s\S]{0,900}position:\s*sticky\s*!important/s, 'fixed technical-plan headers remain aligned with fixed body cells')
assert.match(technicalModuleSource, /rowKey=\{getTechnicalPlanRowKey\}/, 'flat technical rows use the shared stable row-key helper')
assert.match(technicalModuleSource, /getTechnicalPlanRowKey\(invalidTask\)/, 'publish validation scrolls with the same row-key helper as the table')
assert.match(technicalModuleSource, /getTechnicalPlanFilterFields\(tab\?\.templateKind \|\| 'tdt',\s*projectedTasks\)/, 'table filters select the visible columns and current rows for the active technical template kind')
assert.doesNotMatch(technicalModuleSource, /const TECHNICAL_FILTER_FIELDS/, 'technical filters are not a one-size-fits-all legacy field list')
assert.match(technicalModuleSource, /hasPermission\(latestUser, latestProject\.id, 'plan:一级计划-查看'\)/, 'transfer confirmation rechecks current view permission')
assert.match(technicalModuleSource, /hasPermission\(latestUser, latestProject\.id, 'plan:一级计划-编辑'\)/, 'transfer confirmation rechecks current edit permission')
assert.match(technicalModuleSource, /selectedProject/, 'transfer confirmation resolves the currently selected project rather than a stale project closure')
assert.match(technicalModuleSource, /onOpenChange=\{open => \{ if \(open\) setDeleteOpening/, 'delete confirmation captures an opening token before the popconfirm can become stale')
assert.match(technicalModuleSource, /if \(!updated\.ok\) \{ message\.error\('删除活动失败，请重试'\); return \}/, 'delete reports success only after the latest write succeeds')
assert.match(technicalModuleSource, /viewMode === 'gantt' && tab\?\.templateKind === 'tdt'/, 'expand and collapse controls only appear for hierarchical TDT gantt')
assert.match(technicalModuleSource, /const filteredHierarchyTasks = useMemo\([\s\S]{0,260}filterTechnicalPlanGanttTasks/, 'all plan visualizations derive a single filtered task hierarchy')
assert.match(technicalModuleSource, /<TechnicalHorizontalPlanTable[\s\S]{0,120}tasks=\{filteredHierarchyTasks\}/, 'horizontal plan columns use the current filtered hierarchy')
assert.match(technicalModuleSource, /<TechnicalHorizontalPlanTable[\s\S]{0,180}templateKind=\{tab\?\.templateKind \|\| 'tdt'\}/, 'horizontal plan mode follows the active template kind instead of task depth')
assert.match(technicalModuleSource, /function TechnicalHorizontalPlanTable\([\s\S]{0,240}templateKind[\s\S]{0,420}const mode = templateKind === 'subproject' \? 'technical-subproject' : 'standard'/, 'root-only TDT plans retain the grouped standard header mode')
assert.match(technicalSummarySource, /const projectionMode = scope\.kind === 'subproject' \? 'technical-subproject' : 'standard'/, 'technical summary mode follows its canonical scope kind instead of task depth')
for (const [surfaceName, source] of [
  ['technical plan workspace horizontal view', technicalModuleSource],
  ['technical basic-information summary', technicalSummarySource],
]) {
  assert.match(source, /Object\.fromEntries\([^\n]+map\([^\n]+\[getTechnicalPlanRowKey\([^)]*\),/, `${surfaceName} keys version dates by stable activity identity`)
  assert.match(source, /endDatesByTaskId\[getTechnicalPlanRowKey\([^)]*\)\]/, `${surfaceName} reads version dates by stable activity identity`)
  assert.match(source, /scope="col"/, `${surfaceName} identifies activity headers as columns`)
  assert.match(source, /scope="colgroup"/, `${surfaceName} identifies grouped stage headers as column groups`)
}
assert.match(technicalSummarySource, /projectionMode === 'technical-subproject'[\s\S]{0,180}版本活动[\s\S]{0,180}版本阶段里程碑/, 'technical summary exposes an accurate single-level table label')
assert.match(technicalModuleSource, /buildPlanHorizontalStageGroups\([\s\S]{0,120}filteredHierarchyTasks/, 'current horizontal export uses the same filtered hierarchy')
assert.doesNotMatch(technicalModuleSource, /technicalDraft|isResponsibleForTechnicalPlanTasks|toggleCollapsedTask/, 'obsolete technical-plan state and helpers are removed')
assert.match(readSource(root, 'src/stores/technicalPlan.ts'), /DEFAULT_COLUMNS[\s\S]{0,420}actualStartDate[\s\S]{0,120}actualEndDate[\s\S]{0,120}actualDays/, 'technical plan persisted defaults include actual-date columns')

const publishedVersion = { id: 'v1', versionNo: 'V1', status: '已发布', templateType: 'tdt', tasks: [] }
const draftVersion = { id: 'v2', versionNo: 'V2', status: '修订中', templateType: 'tdt', tasks: [] }
const planWorkspace = loadTypeScriptModule(root, 'src/lib/planWorkspace.ts')
assert.deepEqual(
  technicalWorkspace.getTechnicalPlanFilterFields('tdt').map(field => field.key),
  ['sequence', 'stageName', 'milestoneName', 'status', 'planEndDate', 'estimatedDays', 'actualEndDate', 'actualDays'],
  'TDT filters expose exactly the eight visible flat columns',
)
assert.deepEqual(
  technicalWorkspace.getTechnicalPlanFilterFields('subproject').map(field => field.key),
  ['sequence', 'activityName', 'status', 'planStartDate', 'planEndDate', 'estimatedDays', 'actualStartDate', 'actualEndDate', 'actualDays'],
  'subproject filters expose exactly the nine visible flat columns',
)
assert.equal(technicalWorkspace.getTechnicalPlanRowKey({ id: '2', stableId: 'custom-transfer' }), 'custom-transfer', 'table and validation scrolling share the stable technical row key')
assert.equal(technicalWorkspace.getTechnicalPlanRowKey({ id: '2' }), '2', 'row-key helper falls back to the visible ID when stable ID is absent')
const tdtStatusOptions = technicalWorkspace.getTechnicalPlanFilterFields('tdt', [
  { status: '进行中' }, { status: '已完成' }, { status: '进行中' }, { status: '' },
]).find(field => field.key === 'status').options
assert.deepEqual(tdtStatusOptions, [{ label: '进行中', value: '进行中' }, { label: '已完成', value: '已完成' }], 'TDT status filter options are current nonempty unique row statuses')
const subprojectStatusOptions = technicalWorkspace.getTechnicalPlanFilterFields('subproject', [
  { status: '未开始' }, { status: '进行中' },
]).find(field => field.key === 'status').options
assert.deepEqual(subprojectStatusOptions, [{ label: '未开始', value: '未开始' }, { label: '进行中', value: '进行中' }], 'subproject status filter options are current nonempty unique row statuses')
assert.ok(technicalWorkspace.getTechnicalPlanFilterFields('subproject', []).find(field => field.key === 'status').options.length > 0, 'status filter has a nonempty fallback when the current projection has no status values')
const tdtFilteredRows = planWorkspace.applyPlanWorkspaceFilters([
  { id: 'row-1', sequence: 1, stageName: '规划阶段', milestoneName: '规划启动', status: '进行中', planEndDate: '2026-01-01', estimatedDays: 1, actualEndDate: '', actualDays: null },
  { id: 'row-2', sequence: 2, stageName: '概念阶段', milestoneName: 'TDR1', status: '已完成', planEndDate: '2026-02-01', estimatedDays: 2, actualEndDate: '2026-02-02', actualDays: 1 },
], [
  { id: 'filter-stage', field: 'stageName', operator: 'equals', value: '规划阶段' },
  { id: 'filter-milestone', field: 'milestoneName', operator: 'contains', value: '启动' },
  { id: 'filter-status', field: 'status', operator: 'equals', value: '进行中' },
], technicalWorkspace.getTechnicalPlanFilterFields('tdt'))
assert.deepEqual(tdtFilteredRows.map(row => row.id), ['row-1'], 'TDT stage, milestone, and status filters share the flat row projection')
const subprojectFilteredRows = planWorkspace.applyPlanWorkspaceFilters([
  { id: 'activity-1', sequence: 1, activityName: '第1版转测', status: '未开始', planStartDate: '', planEndDate: '2026-01-01', estimatedDays: 1, actualStartDate: '', actualEndDate: '', actualDays: null },
  { id: 'activity-2', sequence: 2, activityName: 'TDR3', status: '进行中', planStartDate: '2026-01-02', planEndDate: '2026-01-03', estimatedDays: 2, actualStartDate: '', actualEndDate: '', actualDays: null },
], [{ id: 'filter-subproject-status', field: 'status', operator: 'equals', value: '进行中' }], technicalWorkspace.getTechnicalPlanFilterFields('subproject'))
assert.deepEqual(subprojectFilteredRows.map(row => row.id), ['activity-2'], 'subproject status filtering uses the same dynamic visible-column definitions')
assert.equal(technicalWorkspace.getTechnicalPlanFilterFields('tdt').some(field => field.key === 'planStartDate' || field.key === 'actualStartDate' || field.key === 'delayStatus'), false, 'TDT filter menu excludes hidden start and delay fields')
assert.equal(technicalWorkspace.getTechnicalPlanFilterFields('subproject').some(field => field.key === 'stageName' || field.key === 'milestoneName' || field.key === 'delayStatus'), false, 'subproject filter menu excludes hidden stage, milestone, and delay fields')
const technicalMutationOpening = { projectId: 'p1', tabId: 'p1:subproject:s1', scopeKey: 'p1:subproject:s1', versionId: 'v2-draft', user: '技术负责人' }
const canConfirmTechnicalMutation = overrides => technicalWorkspace.canConfirmTechnicalSubprojectMutation({
  opening: technicalMutationOpening,
  current: { ...technicalMutationOpening, ...(overrides.current || {}) },
  isCurrentDraft: true,
  isEditMode: true,
  canView: true,
  canEdit: true,
  canMaintain: true,
  ...overrides,
})
assert.equal(canConfirmTechnicalMutation({}), true, 'matching latest subproject context can mutate')
assert.equal(canConfirmTechnicalMutation({ canView: false }), false, 'revoked latest view permission rejects a stale mutation')
assert.equal(canConfirmTechnicalMutation({ canEdit: false }), false, 'revoked latest edit permission rejects a stale mutation')
assert.equal(canConfirmTechnicalMutation({ current: { projectId: 'p2' } }), false, 'a changed selected project rejects a stale mutation')
assert.equal(canConfirmTechnicalMutation({ current: { tabId: 'p1:subproject:s2' } }), false, 'a changed tab rejects a stale deletion')
assert.equal(canConfirmTechnicalMutation({ current: { versionId: 'v3-draft' } }), false, 'a changed version rejects a stale deletion')
assert.equal(canConfirmTechnicalMutation({ canMaintain: false }), false, 'lost maintainability rejects a stale deletion before any update')
assert.deepEqual(technicalWorkspace.selectVisibleTechnicalPlanVersions([publishedVersion, draftVersion], false).map(version => version.id), ['v1'], 'read-only users never receive a draft technical version')
assert.deepEqual(technicalWorkspace.selectVisibleTechnicalPlanVersions([publishedVersion, draftVersion], true).map(version => version.id), ['v1', 'v2'], 'draft-capable users retain technical drafts')

const hierarchy = [
  { id: 'p1', order: 1, taskName: '阶段1' },
  { id: 'c1', parentId: 'p1', order: 2, taskName: '节点1' },
  { id: 'p2', order: 3, taskName: '阶段2' },
  { id: 'c2', parentId: 'p2', order: 4, taskName: '节点2' },
]
assert.deepEqual(technicalWorkspace.includeTechnicalPlanAncestors(hierarchy, [hierarchy[1]]).map(task => task.id), ['p1', 'c1'], 'a child filter result retains its parent context')
assert.deepEqual(technicalWorkspace.reorderTechnicalTasksWithinParent(hierarchy, 'c1', 'c2').map(task => task.id), hierarchy.map(task => task.id), 'dragging across parents cannot corrupt the technical hierarchy')

const imported = technicalWorkspace.parseTechnicalPlanImportRows([
  { ID: 'p1', '父任务ID': '', '任务名称': '阶段', '责任人': '甲', '前置任务': '', '计划开始': '2026-01-01', '计划完成': '2026-01-10', '预估工期': 10, '实际开始': '2026-01-02', '实际完成': '2026-01-09', '实际工期': 8, '状态': '已完成', '进度': 100 },
  { ID: 'c1', '父任务ID': 'p1', '任务名称': '节点', '责任人': '乙', '前置任务': 'p1', '计划开始': '2026-01-02', '计划完成': '2026-01-08', '预估工期': 7, '实际开始': '2026-01-03', '实际完成': '2026-01-07', '实际工期': 5, '状态': '进行中', '进度': 80 },
])
assert.deepEqual(imported.map(task => [task.id, task.parentId, task.actualEndDate, task.actualDays, task.progress]), [['p1', undefined, '2026-01-09', 8, 100], ['c1', 'p1', '2026-01-07', 5, 80]], 'technical import preserves hierarchy and every exported actual/progress field')
for (const title of ['序号', '阶段/里程碑节点', '计划开始时间', '计划完成时间', '预估工期', '实际开始时间', '实际结束时间', '实际工期', '是否延期']) {
  assert.equal(technicalWorkspace.TECHNICAL_PLAN_EXPORT_COLUMNS.some(column => column.title === title), true, `technical export includes ${title}`)
}
for (const title of ['责任人', '前置任务', '状态', '进度']) {
  assert.equal(technicalWorkspace.TECHNICAL_PLAN_EXPORT_COLUMNS.some(column => column.title === title), false, `technical export omits ${title}`)
}
const horizontalRows = technicalWorkspace.buildTechnicalHorizontalRows([{
  ...publishedVersion,
  tasks: [{ ...hierarchy[0], planStartDate: '2026-01-01', planEndDate: '2026-01-10', actualStartDate: '2026-01-02', actualEndDate: '2026-01-09' }],
}], 'v1')
assert.equal(horizontalRows[0].rowType, 'version', 'horizontal plan includes a version row')
assert.equal(horizontalRows.at(-1).rowType, 'actual', 'horizontal plan includes a final actual row')
assert.equal(horizontalRows[0].cycleDays, 9, 'single-level subproject plans preserve their date-derived development cycle')
const governedCycleRows = technicalWorkspace.buildTechnicalHorizontalRows([{
  ...publishedVersion,
  id: 'governed-cycle',
  tasks: [
    { id: 'stage-1', order: 1, taskName: '阶段1' },
    { id: 'stage-1-a', parentId: 'stage-1', order: 1, taskName: '节点1', planEndDate: '2026-01-01' },
    { id: 'stage-1-b', parentId: 'stage-1', order: 2, taskName: '节点2', planEndDate: '2026-01-11' },
    { id: 'stage-2', order: 2, taskName: '阶段2' },
    { id: 'stage-2-a', parentId: 'stage-2', order: 1, taskName: '节点3', planEndDate: '2026-01-20' },
    { id: 'stage-2-b', parentId: 'stage-2', order: 2, taskName: '节点4', planEndDate: '2026-02-01' },
  ],
}], 'governed-cycle')
assert.equal(governedCycleRows[0].cycleDays, 30, 'technical horizontal development cycle sums the governed stage estimated durations')
assert.throws(
  () => technicalWorkspace.parseTechnicalPlanImportRows([{ ID: 'same', '任务名称': 'A' }, { ID: 'same', '任务名称': 'B' }]),
  /duplicate-id/,
  'technical import rejects duplicate IDs',
)
assert.throws(
  () => technicalWorkspace.parseTechnicalPlanImportRows([{ ID: '', '任务名称': 'A' }], [imported[0]]),
  /missing-id/,
  'an ID-based technical import rejects blank IDs',
)
const idMatchedFallback = technicalWorkspace.parseTechnicalPlanImportRows(
  [{ ID: 'c1', '任务名称': '节点更新' }, { ID: 'p1', '任务名称': '阶段更新' }],
  imported,
)
assert.deepEqual(idMatchedFallback.map(task => [task.id, task.responsible]), [['c1', '乙'], ['p1', '甲']], 'ID-based imports match fallback fields by ID instead of row index')
assert.deepEqual(
  technicalWorkspace.parseTechnicalPlanImportRows([{ '任务名称': '旧文件阶段' }], [imported[0]]).map(task => task.id),
  ['p1'],
  'legacy files without an ID column alone may fall back by row index',
)
const actualVersionRows = technicalWorkspace.buildTechnicalHorizontalRows([
  { ...publishedVersion, id: 'selected', tasks: [{ ...imported[0], actualEndDate: '2026-01-09' }] },
  { ...publishedVersion, id: 'later', tasks: [{ ...imported[0], actualEndDate: '2026-02-09' }] },
], 'selected')
assert.equal(actualVersionRows.at(-1).endDatesByTaskId.p1, '2026-01-09', 'horizontal actual row explicitly follows the selected version')
const reorderedStableRows = technicalWorkspace.buildTechnicalHorizontalRows([
  { ...publishedVersion, id: 'before-reorder', tasks: [{ ...imported[0], id: '1', stableId: 'activity-a', planEndDate: '2026-01-09' }] },
  { ...publishedVersion, id: 'after-reorder', tasks: [{ ...imported[0], id: '2', stableId: 'activity-a', planEndDate: '2026-02-09' }] },
], 'after-reorder')
assert.equal(reorderedStableRows[0].endDatesByTaskId['activity-a'], '2026-01-09', 'historical horizontal dates remain aligned after visible IDs are renumbered')
assert.equal(reorderedStableRows[1].endDatesByTaskId['activity-a'], '2026-02-09', 'current horizontal dates use the same stable activity identity after reorder')
const projectSpaceSource = readSource(root, 'src/containers/ProjectSpaceContainer.tsx')
const projectSpaceSourceFile = parseTsx(projectSpaceSource, 'ProjectSpaceContainer.tsx')
assert.equal(importsComponent(projectSpaceSourceFile, 'PlanWorkspaceShell', '@/components/plans/PlanWorkspaceShell'), true, 'whole-machine project space imports the shared shell from its canonical module')
const projectSpaceComponent = findExportedFunctionComponent(projectSpaceSourceFile, 'ProjectSpaceContainer')
assert.ok(projectSpaceComponent, 'whole-machine project space resolves to its exported live function component')
assert.ok(findJsxMount(collectReachableNodes(projectSpaceSourceFile, projectSpaceComponent), projectSpaceSourceFile, 'PlanWorkspaceShell'), 'whole-machine project space mounts the imported shared shell in its live return tree')
assert.match(projectSpaceSource, /canDo\('plan:导入'\)/, 'project space passes technical import permission')
assert.match(projectSpaceSource, /canDo\('plan:导出'\)/, 'project space passes technical export permission')
assert.match(projectSpaceSource, /<TechnicalPlanModule[\s\S]{0,620}canViewTechnicalPlan=\{canViewLevel1Plan\}/, 'project space passes only the technical L1 view capability')
assert.match(projectSpaceSource, /const canShareTechnicalPlan = canDo\('plan:一级计划-分享'\)/, 'project space resolves the dedicated L1 share capability')
assert.match(projectSpaceSource, /<TechnicalPlanModule[\s\S]{0,620}canShareTechnicalPlan=\{canShareTechnicalPlan\}/, 'project space passes the technical L1 share capability')
assert.doesNotMatch(projectSpaceSource.match(/<TechnicalPlanModule[\s\S]{0,520}\/>/)?.[0] || '', /canViewDraft|effectiveTasks|level2PlanTasks|projectPlanLevel/, 'technical draft access never depends on whole-machine or level-2 plan state')

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
const repairedEmptyLevel1Mocks = planModule.migratePlanStoreState({
  tasks: [],
  configTemplateTasksByType: {
    '整机产品项目': [],
    'tOS版本项目': [],
  },
  publishedSnapshots: {
    'template::整机产品项目::level1::v3': [],
    'project::1::OP::level1::v3': [],
  },
  marketPlanData: {},
}, 6)
assert.ok(repairedEmptyLevel1Mocks.tasks.length > 0, 'v6 empty global level-one tasks recover the standard mock plan')
assert.ok(repairedEmptyLevel1Mocks.configTemplateTasksByType['整机产品项目'].length > 0, 'v6 empty machine template recovers its standard milestones')
assert.ok(repairedEmptyLevel1Mocks.configTemplateTasksByType['tOS版本项目'].length > 0, 'v6 empty tOS template recovers its standard milestones')
assert.ok(repairedEmptyLevel1Mocks.publishedSnapshots['template::整机产品项目::level1::v3'].length > 0, 'v6 empty standard template snapshot is repaired')
assert.ok(repairedEmptyLevel1Mocks.publishedSnapshots['project::1::OP::level1::v3'].length > 0, 'v6 empty known project-market snapshot is repaired')
assert.deepEqual(Object.keys(repairedEmptyLevel1Mocks.marketPlanData).sort(), ['OP', 'RU', 'TR'], 'v6 missing market scopes recover the three demo market plans')
assert.ok(Object.values(repairedEmptyLevel1Mocks.marketPlanData).every(entry => entry.tasks.length > 0), 'every recovered demo market has visible level-one tasks')
const preservedNonemptyLevel1Mocks = planModule.migratePlanStoreState({
  tasks: [{ id: 'custom-global', taskName: '自定义全局计划' }],
  configTemplateTasksByType: { '整机产品项目': [{ id: 'custom-template', taskName: '自定义模板' }] },
  publishedSnapshots: { 'project::mock-machine::OP::level1::v3': [{ id: 'custom-snapshot', taskName: '自定义快照' }] },
  marketPlanData: { OP: { tasks: [{ id: 'custom-market', taskName: '自定义市场计划' }], level2Tasks: [], createdLevel2Plans: [] } },
}, 6)
assert.equal(preservedNonemptyLevel1Mocks.tasks[0].taskName, '自定义全局计划', 'nonempty global plans remain user-owned')
assert.equal(preservedNonemptyLevel1Mocks.configTemplateTasksByType['整机产品项目'][0].taskName, '自定义模板', 'nonempty standard templates remain user-owned')
assert.equal(preservedNonemptyLevel1Mocks.publishedSnapshots['project::mock-machine::OP::level1::v3'][0].taskName, '自定义快照', 'nonempty project snapshots remain user-owned')
assert.equal(preservedNonemptyLevel1Mocks.marketPlanData.OP.tasks[0].taskName, '自定义市场计划', 'nonempty market plans remain user-owned')
const v8TechnicalSnapshot = [{ id: 'technical-v8-exact', taskName: '技术历史快照', nested: { keep: true } }]
const v8TechnicalState = {
  publishedSnapshots: {
    'template::技术项目::level1::v9': v8TechnicalSnapshot,
    'template::技术项目::tdt::v9': v8TechnicalSnapshot,
    'project::9::technical::level1::v9': v8TechnicalSnapshot,
    'project::user-created-tech::technical::level1::v9': planModule.TOS_LEVEL1_TASKS,
  },
  configTemplateTasksByType: {
    [rules.TECHNICAL_TEMPLATE_STORAGE_KEYS.tdt]: v8TechnicalSnapshot,
  },
}
const migratedV8TechnicalState = planModule.migratePlanStoreState(v8TechnicalState, 7)
assert.deepEqual(migratedV8TechnicalState.publishedSnapshots['template::技术项目::level1::v9'], v8TechnicalSnapshot, 'V8 migration leaves technical compatibility snapshots exact')
assert.deepEqual(migratedV8TechnicalState.publishedSnapshots['template::技术项目::tdt::v9'], v8TechnicalSnapshot, 'V8 migration leaves scoped technical snapshots exact')
assert.deepEqual(migratedV8TechnicalState.publishedSnapshots['project::9::technical::level1::v9'], v8TechnicalSnapshot, 'V8 migration leaves technical project snapshots exact')
assert.deepEqual(migratedV8TechnicalState.publishedSnapshots['project::user-created-tech::technical::level1::v9'], planModule.TOS_LEVEL1_TASKS, 'unknown user-created technical snapshot keys remain exact instead of defaulting to machine markets')
assert.deepEqual(migratedV8TechnicalState.configTemplateTasksByType[rules.TECHNICAL_TEMPLATE_STORAGE_KEYS.tdt], v8TechnicalSnapshot, 'V8 migration does not rewrite technical store template data')
assert.deepEqual(v8TechnicalState.publishedSnapshots['template::技术项目::tdt::v9'], v8TechnicalSnapshot, 'V8 technical migration does not mutate its input')
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
const legacySubprojectTemplate = [
  { ...subprojectTasks[0], taskName: '第1版转测' },
  { ...subprojectTasks[1], taskName: '第2版转测' },
  { ...subprojectTasks[2], taskName: '第X版转测' },
  { ...subprojectTasks[2], id: '4', stableId: 'TDR3', order: 4, taskName: 'TDR3' },
]
const historicalSubprojectSnapshots = { 'template::技术项目::subproject::v3': legacySubprojectTemplate }
const historicalSubprojectScopes = { [subprojectScope]: { versions: [{ id: 'v3', versionNo: 'V3', status: '已发布' }], currentVersion: 'v3' } }
const migratedControlledSubprojectSeed = planModule.migratePlanStoreState({
  configTemplateTasksByType: { [rules.TECHNICAL_TEMPLATE_STORAGE_KEYS.subproject]: legacySubprojectTemplate },
  publishedSnapshots: historicalSubprojectSnapshots,
  configTemplateVersionScopes: historicalSubprojectScopes,
}, 5)
assert.deepEqual(migratedControlledSubprojectSeed.configTemplateTasksByType[rules.TECHNICAL_TEMPLATE_STORAGE_KEYS.subproject].map(task => task.taskName), ['第1版转测', '第2版转测', 'TDR3'], 'v5 migrates only the untouched subproject template seed')
assert.deepEqual(migratedControlledSubprojectSeed.publishedSnapshots['template::技术项目::subproject::v3'], historicalSubprojectSnapshots['template::技术项目::subproject::v3'], 'v5 controlled seed migration preserves published snapshots')
assert.deepEqual(migratedControlledSubprojectSeed.configTemplateVersionScopes[subprojectScope], historicalSubprojectScopes[subprojectScope], 'v5 controlled seed migration preserves config version history')
delete globalThis.localStorage

assert.match(configSource, /TDT项目计划/, 'technical config exposes TDT project plan tab')
assert.match(configSource, /子项目计划/, 'technical config exposes subproject plan tab')
assert.match(configSource, /isTechnicalTemplate/, 'technical config branches from generic templates')
assert.match(configSource, /setTechnicalTemplateTasks/, 'technical config writes through validated store action')
const seededTechnicalPlans = technicalPlanModule.INITIAL_TECHNICAL_PLANS
assert.equal(Object.keys(seededTechnicalPlans).filter(key => key.endsWith(':tdt')).length, 8, 'technical plan seeds include eight TDT instances')
assert.equal(Object.keys(seededTechnicalPlans).filter(key => key.includes(':subproject:')).length, 10, 'technical plan seeds include ten active child instances')
assert.ok(Object.entries(seededTechnicalPlans).every(([key, plan]) => key === plan.planKey), 'technical plan seed keys match their stable instance keys')
const seededVersionIds = Object.values(seededTechnicalPlans).flatMap(plan => plan.versions.map(version => version.id))
assert.equal(new Set(seededVersionIds).size, seededVersionIds.length, 'technical plan version IDs are unique across seed instances')
assert.ok(Object.values(seededTechnicalPlans).every(plan => plan.versions.some(version => version.status === '已发布')), 'every seeded technical plan instance has a published version')
assert.equal(seededTechnicalPlans['9:tdt'].currentVersionId, 'tech-9-v2-draft', 'AI TDT seed keeps its V2 draft selected')
assert.equal(seededTechnicalPlans['9:subproject:IPM-AI-001'].versions.find(version => version.status === '已发布').tasks.at(-1).planEndDate, '2026-07-15', 'subproject mock scheduling reaches the project end after the three-item seed change')
const preservedLegacySubprojectVersion = technicalPlanModule.migrateTechnicalPlanState({ plansByKey: {
  'custom:subproject:legacy': {
    planKey: 'custom:subproject:legacy', templateKind: 'subproject', currentVersionId: 'legacy-v1',
    versions: [{ id: 'legacy-v1', versionNo: 'V1', templateType: 'subproject', status: '已发布', tasks: legacySubprojectTemplate }],
  },
} }, 7)
assert.deepEqual(preservedLegacySubprojectVersion.plansByKey['custom:subproject:legacy'].versions[0].tasks.map(task => task.taskName), ['第1版转测', '第2版转测', '第X版转测', 'TDR3'], 'v7 existing valid subproject versions retain the historical transfer seed')
assert.ok(Object.entries(seededTechnicalPlans).filter(([key]) => key !== '9:tdt').every(([, plan]) => plan.versions.find(version => version.id === plan.currentVersionId)?.status === '已发布'), 'non-AI seeds select their published version')
const customizedPlanSeed = seededTechnicalPlans['9:tdt']
const migratedV5Plans = technicalPlanModule.migrateTechnicalPlanState({ plansByKey: {
  '9:tdt': { ...customizedPlanSeed, versions: customizedPlanSeed.versions.map(version => ({ ...version, tasks: version.tasks.map(task => ({ ...task, taskName: `${task.taskName}-自定义` })) })) },
} }, 5)
assert.equal(Object.keys(migratedV5Plans.plansByKey).length, 18, 'v5 technical plan migration appends missing seed instances')
assert.match(migratedV5Plans.plansByKey['9:tdt'].versions[0].tasks[0].taskName, /自定义$/, 'v5 technical plan migration preserves customized same-key plan instances')
assert.equal(Object.keys(technicalPlanModule.migrateTechnicalPlanState({ plansByKey: { '9:tdt': customizedPlanSeed } }, 4).plansByKey).length, 18, 'skipped v4 technical plan migration appends every missing seed instance')
assert.equal(Object.keys(technicalPlanModule.migrateTechnicalPlanState({ plansByKey: { 'custom:tdt': { ...customizedPlanSeed, planKey: 'custom:tdt' } } }, 6).plansByKey).length, 19, 'v6 governance migration appends refreshed seed instances')
assert.deepEqual(Object.keys(technicalPlanModule.migrateTechnicalPlanState({ plansByKey: { 'custom:tdt': { ...customizedPlanSeed, planKey: 'custom:tdt' } } }, technicalPlanModule.TECHNICAL_PLAN_STORE_VERSION).plansByKey), ['custom:tdt'], 'current technical plan migration remains idempotent')
console.log('technical plan contract passed')
