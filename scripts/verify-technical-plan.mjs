#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
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

const technicalProjectModule = loadTypeScriptModule(root, 'src/stores/technicalProject.ts')
const technicalPlanModule = loadTypeScriptModule(root, 'src/stores/technicalPlan.ts')
assert.ok(technicalPlanModule.TECHNICAL_PLAN_STORE_VERSION >= 2, 'technical plan persistence declares a migration version')
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
const incompleteChild = technicalProjectModule.INITIAL_TECHNICAL_SUBPROJECTS[1]
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
const planWorkspaceShellPath = 'src/components/plans/PlanWorkspaceShell.tsx'
assert.equal(fs.existsSync(`${root}/${planWorkspaceShellPath}`), true, 'plan workspace provides a shared shell for whole-machine and technical projects')
const planWorkspaceShell = readSource(root, planWorkspaceShellPath)
for (const capability of ['创建修订', '克隆计划', '筛选', '列设置', '全部展开', '全部收起', '版本对比', '分享计划', 'vertical', 'horizontal', 'gantt']) {
  assert.match(planWorkspaceShell, new RegExp(capability), `shared plan workspace shell supports ${capability}`)
}
assert.match(technicalModuleSource, /PlanWorkspaceShell/, 'technical plan module consumes the shared plan workspace shell')
assert.match(technicalModuleSource, /TDT项目计划/, 'technical plan UI renders the fixed TDT tab')
assert.match(technicalModuleSource, /显示已停用/, 'technical plan UI exposes history mode')
assert.match(technicalModuleSource, /SettingOutlined/, 'child plan tabs expose configuration')
assert.match(technicalModuleSource, /compareVersionsForTable/, 'technical plans reuse version comparison')
assert.match(technicalModuleSource, /exportSheet/, 'technical plans reuse Excel export')
assert.match(technicalModuleSource, /SortableRow/, 'technical plans reuse sortable task rows')
assert.match(technicalModuleSource, /getInvalidTechnicalTaskFields/, 'technical plans enforce plan date validation')
assert.match(technicalModuleSource, /maxDepthByKind/, 'technical plan depth is a component input')
assert.match(technicalModuleSource, /handleAddTopLevelTask/, 'drafts can add top-level tasks')
assert.match(technicalModuleSource, /handleAddChildTask/, 'TDT drafts can add second-level tasks')
assert.match(technicalModuleSource, /handleDeleteTask/, 'drafts can delete tasks with cascade handling')
assert.match(technicalModuleSource, /SortableColumnSettings/, 'column settings reuse sortable staged apply/cancel interaction')
assert.match(technicalModuleSource, /canImport/, 'technical plan import has a dedicated permission input')
assert.match(technicalModuleSource, /canExport/, 'technical plan export has a dedicated permission input')
const projectSpaceSource = readSource(root, 'src/containers/ProjectSpaceContainer.tsx')
assert.match(projectSpaceSource, /PlanWorkspaceShell/, 'whole-machine project space consumes the shared plan workspace shell')
assert.match(projectSpaceSource, /canDo\('plan:导入'\)/, 'project space passes technical import permission')
assert.match(projectSpaceSource, /canDo\('plan:导出'\)/, 'project space passes technical export permission')

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
