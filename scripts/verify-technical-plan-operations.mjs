#!/usr/bin/env node
import assert from 'node:assert/strict'
import { loadTypeScriptModule, projectRoot, readSource } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const memoryStorage = new Map()
globalThis.localStorage = {
  getItem: key => memoryStorage.get(key) ?? null,
  setItem: (key, value) => memoryStorage.set(key, value),
  removeItem: key => memoryStorage.delete(key),
}

const technicalPlan = loadTypeScriptModule(root, 'src/stores/technicalPlan.ts')
const columns = { order: ['taskName'], visible: ['taskName'] }
const task = (id, taskName) => ({
  id, order: 1, taskName, responsible: '负责人', predecessor: '',
  planStartDate: '2026-01-01', planEndDate: '2026-01-02', estimatedDays: 2,
  actualStartDate: '', actualEndDate: '', actualDays: 0, status: '未开始', progress: 0,
  defaultRoadmap: false,
})
const instance = (planKey, templateKind, versions) => ({
  planKey, templateKind, versions, currentVersionId: versions[0].id,
  columnSettings: columns, collapsedRows: [],
})
const version = (id, versionNo, templateType, status, tasks) => ({
  id, versionNo, templateType, status, tasks,
  ...(status === '已发布' ? { publishedAt: `2026-0${versionNo.replace(/\D/g, '') || '1'}-01T00:00:00Z` } : {}),
})

const store = technicalPlan.createTechnicalPlanStore({ plansByKey: {} })
assert.equal(store.clonePublishedVersion, undefined, 'the standalone technical-plan store removes the clone operation')
assert.equal(technicalPlan.useTechnicalPlanStore.getState().clonePublishedVersion, undefined, 'the persisted technical-plan store removes the clone operation')
const firstRevisionStore = technicalPlan.createTechnicalPlanStore({ plansByKey: {} })
assert.deepEqual(
  firstRevisionStore.createRevision({
    scope: { kind: 'tdt', parentProjectId: 'first-revision' },
    templateKind: 'tdt',
    templateTasks: [{ ...task('first-template-task', '首次模板节点'), source: 'template' }],
  }),
  { ok: true, versionId: 'V1-draft' },
  'a first TDT revision is created directly from the latest template',
)
assert.deepEqual(
  firstRevisionStore.getState().plansByKey['first-revision:tdt'].versions[0].tasks.map(item => [item.planStartDate, item.planEndDate, item.actualStartDate, item.actualEndDate]),
  [['', '', '', '']],
  'a first revision also starts template date fields empty',
)
assert.equal(technicalPlan.TECHNICAL_PLAN_STORE_VERSION, 8, 'flat milestone and technical-subproject columns advance the persisted technical-plan shape')
const migratedVersionTwoColumns = technicalPlan.migrateTechnicalPlanState({
  plansByKey: {
    'custom:tdt': {
      planKey: 'custom:tdt', templateKind: 'tdt', currentVersionId: 'custom-v1',
      versions: [version('custom-v1', 'V1', 'tdt', '已发布', [task('custom-task', '保留任务')])],
      columnSettings: { order: ['taskName'], visible: ['taskName'] }, collapsedRows: [],
    },
  },
}, 2)
assert.deepEqual(
  migratedVersionTwoColumns.plansByKey['custom:tdt'].columnSettings.order,
  ['id', 'taskName', 'planStartDate', 'planEndDate', 'estimatedDays', 'actualStartDate', 'actualEndDate', 'actualDays', 'delayStatus'],
  'legacy plan columns migrate to the current flat-plan column contract without resetting the plan',
)
assert.equal(migratedVersionTwoColumns.plansByKey['custom:tdt'].versions[0].tasks[0].taskName, '保留任务')

const revisionKindStore = technicalPlan.createTechnicalPlanStore({ plansByKey: {
  'revision-kind:tdt': instance('revision-kind:tdt', 'tdt', [
    version('revision-kind-v1', 'V1', 'tdt', '已发布', [task('1', '正式版本任务')]),
  ]),
} })
assert.deepEqual(
  revisionKindStore.createRevision({
    scope: { kind: 'tdt', parentProjectId: 'revision-kind' }, templateKind: 'tdt',
    revisionKind: 'gray', templateTasks: [task('1', '非正式版本任务')],
  }),
  { ok: true, versionId: 'V1.1-draft' },
  'technical plans can create a nonformal revision after the latest formal version',
)
assert.deepEqual(revisionKindStore.cancelRevision({ kind: 'tdt', parentProjectId: 'revision-kind' }), { ok: true })
assert.deepEqual(
  revisionKindStore.createRevision({
    scope: { kind: 'tdt', parentProjectId: 'revision-kind' }, templateKind: 'tdt',
    revisionKind: 'formal', templateTasks: [task('1', '正式版本任务')],
  }),
  { ok: true, versionId: 'V2-draft' },
  'technical plans can create the next formal revision independently of gray revisions',
)

const previousTdtTasks = [
  { ...task('old-stage-retained', ' 规划阶段 '), stableId: 'old-stage-retained', parentId: undefined, order: 0, source: 'template' },
  { ...task('old-moved-node', ' 共享节点 '), stableId: 'old-moved-node', parentId: 'old-stage-retained', order: 0, source: 'template', planStartDate: '2026-03-01', planEndDate: '2026-03-08', estimatedDays: 8, actualStartDate: '2026-03-02', actualEndDate: '2026-03-07', actualDays: 6 },
  { ...task('old-custom-retained', 'MR1'), stableId: 'custom-mr1', parentId: 'old-stage-retained', order: 1, source: 'custom', planStartDate: '2026-03-09', planEndDate: '2026-03-15' },
  { ...task('old-template-deleted', '已移除模板节点'), stableId: 'old-template-deleted', parentId: 'old-stage-retained', order: 2, source: 'template' },
  { ...task('old-renamed-node', '旧节点名'), stableId: 'same-stable-renamed-node', parentId: 'old-stage-retained', order: 3, source: 'template', planEndDate: '2026-03-20' },
  { ...task('old-stage-deleted', '删除阶段'), stableId: 'old-stage-deleted', parentId: undefined, order: 1, source: 'template' },
  { ...task('old-custom-deleted', 'MR2'), stableId: 'custom-mr2', parentId: 'old-stage-deleted', order: 0, source: 'custom' },
]
const latestTdtTemplate = [
  { ...task('new-stage-retained', '规划阶段'), stableId: 'new-stage-retained', parentId: undefined, order: 0, source: 'template' },
  { ...task('new-renamed-node', '新节点名'), stableId: 'same-stable-renamed-node', parentId: 'new-stage-retained', order: 0, source: 'template' },
  { ...task('new-stage-added', '新增阶段'), stableId: 'new-stage-added', parentId: undefined, order: 1, source: 'template' },
  { ...task('new-moved-node', '共享节点'), stableId: 'new-moved-node', parentId: 'new-stage-added', order: 0, source: 'template' },
  { ...task('new-template-node', '全新节点'), stableId: 'new-template-node', parentId: 'new-stage-added', order: 1, source: 'template' },
]
const taskNameRevisionPlans = {
  'task-name:tdt': instance('task-name:tdt', 'tdt', [
    version('task-name-v7', 'V7', 'tdt', '已发布', previousTdtTasks),
  ]),
  'untouched:tdt': instance('untouched:tdt', 'tdt', [
    version('untouched-v1', 'V1', 'tdt', '已发布', [task('untouched-task', '其他TDT')]),
  ]),
}
const taskNameRevisionStore = technicalPlan.createTechnicalPlanStore({ plansByKey: taskNameRevisionPlans })
assert.deepEqual(
  taskNameRevisionStore.createRevision({
    scope: { kind: 'tdt', parentProjectId: 'task-name' },
    templateKind: 'tdt',
    templateTasks: latestTdtTemplate,
  }),
  { ok: true, versionId: 'V8-draft' },
  'TDT creates the next revision from the latest published template',
)
const taskNameDraft = taskNameRevisionStore.getState().plansByKey['task-name:tdt'].versions.at(-1)
assert.deepEqual(
  taskNameDraft.tasks.filter(item => item.source === 'template').map(item => [item.id, item.parentId, item.taskName]),
  [
    ['new-stage-retained', undefined, '规划阶段'],
    ['new-renamed-node', 'new-stage-retained', '新节点名'],
    ['new-stage-added', undefined, '新增阶段'],
    ['new-moved-node', 'new-stage-added', '共享节点'],
    ['new-template-node', 'new-stage-added', '全新节点'],
  ],
  'latest template ids, order, labels, and parent structure become the revision structure',
)
const movedNode = taskNameDraft.tasks.find(item => item.taskName === '共享节点')
assert.deepEqual(
  [movedNode.planStartDate, movedNode.planEndDate, movedNode.estimatedDays, movedNode.actualStartDate, movedNode.actualEndDate, movedNode.actualDays],
  ['2026-03-01', '2026-03-08', 8, '2026-03-02', '2026-03-07', 6],
  'normalized task-name matching refills all user dates even when stable id and parent stage changed',
)
const retainedCustom = taskNameDraft.tasks.find(item => item.stableId === 'custom-mr1')
assert.ok(retainedCustom, 'a custom task is preserved while its normalized parent stage still exists')
assert.equal(retainedCustom.parentId, 'new-stage-retained', 'a preserved custom task is attached to the latest stage id')
assert.equal(taskNameDraft.tasks.some(item => item.stableId === 'old-template-deleted'), false, 'a template node removed from the latest structure is not retained as a custom task')
assert.equal(taskNameDraft.tasks.some(item => item.stableId === 'custom-mr2'), false, 'custom tasks are dropped when their parent stage was deleted from the template')
assert.equal(taskNameDraft.tasks.find(item => item.taskName === '新节点名').planEndDate, '', 'a renamed template node does not inherit dates merely because its stable id stayed the same')
const newTemplateNode = taskNameDraft.tasks.find(item => item.stableId === 'new-template-node')
assert.deepEqual(
  [newTemplateNode.planStartDate, newTemplateNode.planEndDate, newTemplateNode.actualStartDate, newTemplateNode.actualEndDate],
  ['', '', '', ''],
  'new template nodes start with empty date fields',
)
assert.deepEqual(taskNameRevisionStore.getState().plansByKey['untouched:tdt'], taskNameRevisionPlans['untouched:tdt'], 'another technical plan scope remains unchanged')

const configuredChild = {
  id: 'child-1', parentProjectId: 'project-a', name: '子项目', active: true, ipmOrder: 1,
  configuration: { coreValue: '追赶', developmentMode: '自研', firstTosVersion: '', firstMachineProjectId: '' },
}
const childOnlyPlans = {
  'project-a:subproject:child-1': instance('project-a:subproject:child-1', 'subproject', [
    version('child-published', 'V1', 'subproject', '已发布', [task('old-child-task', ' 子项目模板任务 ')]),
  ]),
}
const subprojectRevisionStore = technicalPlan.createTechnicalPlanStore({ plansByKey: childOnlyPlans })
assert.deepEqual(
  subprojectRevisionStore.createRevision({
    scope: { kind: 'subproject', parentProjectId: 'project-a', subprojectId: 'child-1' },
    templateKind: 'subproject', templateTasks: [task('new-child-task', '子项目模板任务')], subproject: configuredChild,
  }),
  { ok: true, versionId: 'V2-draft' },
  'subproject creates a draft from its latest published version',
)
const subprojectDraft = subprojectRevisionStore.getState().plansByKey['project-a:subproject:child-1'].versions.find(item => item.id === 'V2-draft')
assert.deepEqual(
  [subprojectDraft.tasks[0].planStartDate, subprojectDraft.tasks[0].planEndDate],
  ['2026-01-01', '2026-01-02'],
  'subproject revision retains planned start and end dates for gantt task move and resize',
)
const transferRevisionStore = technicalPlan.createTechnicalPlanStore({ plansByKey: {
  'project-a:subproject:transfer-child': instance('project-a:subproject:transfer-child', 'subproject', [
    version('transfer-child-v1', 'V1', 'subproject', '已发布', [
      { ...task('old-transfer-1', '第1版转测'), order: 1, source: 'template' },
      { ...task('old-transfer-custom', '第3版转测'), stableId: 'custom-transfer-3', order: 2, source: 'custom' },
      { ...task('old-transfer-tdr3', 'TDR3'), order: 3, source: 'template' },
    ]),
  ]),
} })
const transferChild = { ...configuredChild, id: 'transfer-child' }
assert.equal(transferRevisionStore.createRevision({
  scope: { kind: 'subproject', parentProjectId: 'project-a', subprojectId: 'transfer-child' },
  templateKind: 'subproject',
  templateTasks: [
    { ...task('new-transfer-1', '第1版转测'), order: 1, source: 'template' },
    { ...task('new-transfer-tdr3', 'TDR3'), order: 2, source: 'template' },
  ],
  subproject: transferChild,
}).ok, true, 'a subproject revision is created from its latest template')
const transferDraftTasks = transferRevisionStore.getState().plansByKey['project-a:subproject:transfer-child'].versions.at(-1).tasks
assert.deepEqual(transferDraftTasks.map(item => item.taskName), ['第1版转测', '第3版转测', 'TDR3'], 'custom transfer versions remain before TDR3 across template-based revisions')
assert.equal(transferDraftTasks[1].stableId, 'custom-transfer-3', 'a preserved transfer version keeps its durable identity')
const wrongInstanceKindPlans = {
  'project-a:tdt': instance('project-a:tdt', 'subproject', [
    version('wrong-instance-source', 'V1', 'subproject', '已发布', [task('wrong-instance-task', '错配实例')]),
  ]),
}
const wrongSourceKindPlans = {
  'project-a:tdt': instance('project-a:tdt', 'tdt', [
    version('wrong-source-kind', 'V1', 'subproject', '已发布', [task('wrong-source-task', '错配来源')]),
  ]),
}
const reverseWrongKindPlans = {
  'project-a:subproject:child-1': instance('project-a:subproject:child-1', 'subproject', [
    version('reverse-wrong-source', 'V1', 'tdt', '已发布', [task('reverse-wrong-task', '反向错配来源')]),
  ]),
}
const sharePlans = {
  'project-a:tdt': instance('project-a:tdt', 'tdt', [
    version('tdt-v9', 'V9', 'tdt', '已发布', [task('tdt-v9-task', 'TDT V9')]),
    version('tdt-v10', 'V10', 'tdt', '已发布', [task('tdt-v10-task', 'TDT V10')]),
    version('tdt-v99-draft', 'V99', 'tdt', '修订中', [task('secret-draft', '绝不公开的草稿')]),
  ]),
  'project-a:subproject:child-1': instance('project-a:subproject:child-1', 'subproject', [
    version('child-v3', 'V3', 'subproject', '已发布', [task('child-public', '子项目发布任务')]),
    version('child-v4-draft', 'V4', 'subproject', '修订中', [task('child-secret', '子项目草稿')]),
  ]),
  'project-a:subproject:undefined': instance('project-a:subproject:undefined', 'subproject', [
    version('trap-published', 'V100', 'subproject', '已发布', [task('trap-public', '不应读取的陷阱计划')]),
  ]),
}
const tdtShare = technicalPlan.resolveTechnicalSharePlan(sharePlans, {
  technical: '1', kind: 'tdt', projectId: 'project-a',
})
assert.equal(tdtShare.ok, true, 'a complete technical TDT query resolves')
assert.equal(tdtShare.ok && tdtShare.version.id, 'tdt-v10', 'semantic V10 wins over V9 while V99 draft stays hidden')
assert.deepEqual(tdtShare.ok && tdtShare.version.tasks.map(item => item.taskName), ['TDT V10'])
assert.notStrictEqual(tdtShare.ok && tdtShare.version.tasks, sharePlans['project-a:tdt'].versions[1].tasks, 'public resolution returns a detached task snapshot')
if (tdtShare.ok) tdtShare.version.tasks[0].taskName = '只改读取副本'
assert.equal(sharePlans['project-a:tdt'].versions[1].tasks[0].taskName, 'TDT V10', 'public consumers cannot mutate persisted plan data')
const childShare = technicalPlan.resolveTechnicalSharePlan(sharePlans, {
  technical: '1', kind: 'subproject', projectId: 'project-a', subprojectId: 'child-1',
})
assert.equal(childShare.ok, true, 'a complete technical child query resolves')
assert.equal(childShare.ok && childShare.version.id, 'child-v3', 'a child query reads only its exact published scope')
assert.deepEqual(childShare.ok && childShare.version.tasks.map(item => item.taskName), ['子项目发布任务'])
assert.deepEqual(
  technicalPlan.resolveTechnicalSharePlan(sharePlans, { technical: '1', kind: 'subproject', projectId: 'project-a' }),
  { ok: false, reason: 'invalid-query' },
  'a child query without subprojectId is rejected instead of reading an undefined-key trap',
)
assert.deepEqual(
  technicalPlan.resolveTechnicalSharePlan(sharePlans, { technical: '1', kind: 'unsupported', projectId: 'project-a', subprojectId: 'child-1' }),
  { ok: false, reason: 'invalid-query' },
  'an illegal technical plan kind is rejected',
)
assert.deepEqual(
  technicalPlan.resolveTechnicalSharePlan(sharePlans, { technical: '1', kind: 'tdt', projectId: '' }),
  { ok: false, reason: 'invalid-query' },
  'a missing project is rejected without exposing available scopes',
)
assert.deepEqual(
  technicalPlan.resolveTechnicalSharePlan(sharePlans, { technical: '1', kind: 'subproject', projectId: 'project-a', subprojectId: 'missing' }),
  { ok: false, reason: 'missing-published' },
  'a valid but unpublished scope returns a non-sensitive empty result',
)
assert.deepEqual(
  technicalPlan.resolveTechnicalSharePlan({
    'project-a:tdt': instance('project-a:tdt', 'tdt', [version('only-draft', 'V1', 'tdt', '修订中', [task('only-draft-task', '草稿')])]),
  }, { technical: '1', kind: 'tdt', projectId: 'project-a' }),
  { ok: false, reason: 'missing-published' },
  'a draft-only scope returns the same non-sensitive empty result',
)
assert.deepEqual(
  technicalPlan.resolveTechnicalSharePlan(wrongInstanceKindPlans, { technical: '1', kind: 'tdt', projectId: 'project-a' }),
  { ok: false, reason: 'missing-published' },
  'public sharing rejects an instance whose kind conflicts with its TDT scope',
)
assert.deepEqual(
  technicalPlan.resolveTechnicalSharePlan(wrongSourceKindPlans, { technical: '1', kind: 'tdt', projectId: 'project-a' }),
  { ok: false, reason: 'missing-published' },
  'public sharing rejects a published source whose kind conflicts with its TDT instance',
)
assert.deepEqual(
  technicalPlan.resolveTechnicalSharePlan(reverseWrongKindPlans, {
    technical: '1', kind: 'subproject', projectId: 'project-a', subprojectId: 'child-1',
  }),
  { ok: false, reason: 'missing-published' },
  'public sharing enforces the same source-kind rule in the subproject direction',
)

const sharePageSource = readSource(root, 'src/app/share/plan/page.tsx')
assert.match(sharePageSource, /searchParams\.get\(['"]technical['"]\)/, 'share route branches only on the explicit technical flag')
assert.match(sharePageSource, /useTechnicalPlanStore/, 'share route reads the persisted technical plan store')
assert.match(sharePageSource, /resolveTechnicalSharePlan/, 'share route uses the scope-safe pure resolver')
assert.match(sharePageSource, /useProjectStore\(state\s*=>\s*state\.projects\)/, 'share route reads persisted runtime projects')
assert.match(sharePageSource, /projects\.find\([^)]*\.id\s*===\s*projectId\)/, 'dynamic projects can resolve a technical share link')
assert.doesNotMatch(sharePageSource, /initialProjects\.find/, 'technical share project resolution never falls back to static seed lookup')

console.log('technical plan operation checks passed')
