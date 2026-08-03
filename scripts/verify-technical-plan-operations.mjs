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

const initialPlans = {
  'project-a:tdt': instance('project-a:tdt', 'tdt', [
    version('project-a-v2', 'V2', 'tdt', '已发布', [{ ...task('a-task', '指定源任务'), children: [{ marker: 'nested' }] }]),
    version('project-a-v7', 'V7', 'tdt', '已发布', [task('a-latest', '更高历史版本')]),
  ]),
  'project-b:tdt': instance('project-b:tdt', 'tdt', [
    version('project-b-v3', 'V3', 'tdt', '已发布', [task('b-task', '其他TDT')]),
  ]),
  'project-a:subproject:child-1': instance('project-a:subproject:child-1', 'subproject', [
    version('child-v4', 'V4', 'subproject', '已发布', [task('child-task', '其他子项目')]),
  ]),
}
const store = technicalPlan.createTechnicalPlanStore({ plansByKey: initialPlans })
const untouchedProjectB = store.getState().plansByKey['project-b:tdt']
const untouchedChild = store.getState().plansByKey['project-a:subproject:child-1']

assert.deepEqual(
  store.clonePublishedVersion({
    scope: { kind: 'tdt', parentProjectId: 'project-a' },
    sourceVersionId: 'project-a-v2',
  }),
  { ok: true, versionId: 'V8-draft' },
  'cloning a selected publication creates the next scope-local draft',
)
const clonedState = store.getState()
const clonedInstance = clonedState.plansByKey['project-a:tdt']
const clonedDraft = clonedInstance.versions.find(item => item.id === 'V8-draft')
assert.ok(clonedDraft, 'the cloned draft is stored in the requested scope')
assert.equal(clonedDraft.status, '修订中')
assert.equal(clonedInstance.currentVersionId, 'V8-draft', 'the cloned draft becomes current')
assert.deepEqual(clonedDraft.tasks, initialPlans['project-a:tdt'].versions[0].tasks, 'the selected publication tasks are copied exactly')
assert.notStrictEqual(clonedDraft.tasks, initialPlans['project-a:tdt'].versions[0].tasks, 'the task array is isolated')
assert.notStrictEqual(clonedDraft.tasks[0], initialPlans['project-a:tdt'].versions[0].tasks[0], 'task records are isolated')
assert.notStrictEqual(clonedDraft.tasks[0].children, initialPlans['project-a:tdt'].versions[0].tasks[0].children, 'nested task data is deeply isolated')
assert.deepEqual(clonedState.plansByKey['project-b:tdt'], untouchedProjectB, 'another TDT scope is unchanged')
assert.deepEqual(clonedState.plansByKey['project-a:subproject:child-1'], untouchedChild, 'a child scope is unchanged')
assert.equal(technicalPlan.TECHNICAL_PLAN_STORE_VERSION, 2, 'an action-only change does not churn the persisted data-shape version')

technicalPlan.useTechnicalPlanStore.setState({ plansByKey: initialPlans })
assert.deepEqual(
  technicalPlan.useTechnicalPlanStore.getState().clonePublishedVersion({
    scope: { kind: 'tdt', parentProjectId: 'project-a' }, sourceVersionId: 'project-a-v2',
  }),
  { ok: true, versionId: 'V8-draft' },
  'the persisted Zustand store exposes the same clone operation',
)
assert.deepEqual(
  technicalPlan.useTechnicalPlanStore.getState().plansByKey['project-a:tdt'].versions.slice(0, 2).map(item => item.id),
  ['project-a-v2', 'project-a-v7'],
  'the Zustand action appends without clearing published history',
)

const configuredChild = {
  id: 'child-1', parentProjectId: 'project-a', name: '子项目', active: true, ipmOrder: 1,
  configuration: { coreValue: '追赶', developmentMode: '自研', firstTosVersion: '', firstMachineProjectId: '' },
}
const childOnlyPlans = {
  'project-a:subproject:child-1': instance('project-a:subproject:child-1', 'subproject', [
    version('child-published', 'V1', 'subproject', '已发布', [task('child-task', '子项目发布任务')]),
  ]),
}
assert.deepEqual(
  technicalPlan.createTechnicalPlanStore({ plansByKey: childOnlyPlans }).clonePublishedVersion({
    scope: { kind: 'subproject', parentProjectId: 'project-a', subprojectId: 'child-1' },
    sourceVersionId: 'child-published',
    subproject: { ...configuredChild, active: false },
  }),
  { ok: false, reason: 'inactive' },
  'inactive child plans are history-only and cannot be cloned',
)
assert.deepEqual(
  technicalPlan.createTechnicalPlanStore({ plansByKey: childOnlyPlans }).clonePublishedVersion({
    scope: { kind: 'subproject', parentProjectId: 'project-a', subprojectId: 'child-1' },
    sourceVersionId: 'child-published',
    subproject: {
      ...configuredChild,
      active: false,
      configuration: { ...configuredChild.configuration, coreValue: '' },
    },
  }),
  { ok: false, reason: 'inactive' },
  'inactive takes precedence because the whole child scope is history-only',
)
assert.deepEqual(
  technicalPlan.createTechnicalPlanStore({ plansByKey: childOnlyPlans }).clonePublishedVersion({
    scope: { kind: 'subproject', parentProjectId: 'project-a', subprojectId: 'child-1' },
    sourceVersionId: 'child-published',
    subproject: { ...configuredChild, configuration: { ...configuredChild.configuration, coreValue: '' } },
  }),
  { ok: false, reason: 'incomplete-configuration' },
  'unconfigured child plans cannot be cloned',
)
assert.deepEqual(
  technicalPlan.createTechnicalPlanStore({ plansByKey: childOnlyPlans }).clonePublishedVersion({
    scope: { kind: 'subproject', parentProjectId: 'project-a', subprojectId: 'child-1' },
    sourceVersionId: 'child-published',
    subproject: { ...configuredChild, id: 'another-child' },
  }),
  { ok: false, reason: 'incomplete-configuration' },
  'configuration from a different child cannot authorize this scope',
)
assert.deepEqual(
  technicalPlan.createTechnicalPlanStore({ plansByKey: childOnlyPlans }).clonePublishedVersion({
    scope: { kind: 'subproject', parentProjectId: 'project-a', subprojectId: 'child-1' },
    sourceVersionId: 'child-published',
  }),
  { ok: false, reason: 'incomplete-configuration' },
  'child cloning requires configuration for the exact requested scope',
)

const draftStore = technicalPlan.createTechnicalPlanStore({ plansByKey: {
  'project-a:tdt': instance('project-a:tdt', 'tdt', [
    version('published', 'V1', 'tdt', '已发布', [task('published-task', '发布任务')]),
    version('draft', 'V2', 'tdt', '修订中', [task('draft-task', '草稿任务')]),
  ]),
} })
assert.deepEqual(
  draftStore.clonePublishedVersion({ scope: { kind: 'tdt', parentProjectId: 'project-a' }, sourceVersionId: 'published' }),
  { ok: false, reason: 'draft-exists' },
  'a scope with a draft rejects another clone',
)
assert.deepEqual(
  technicalPlan.createTechnicalPlanStore({ plansByKey: {} }).clonePublishedVersion({
    scope: { kind: 'tdt', parentProjectId: 'missing' }, sourceVersionId: 'published',
  }),
  { ok: false, reason: 'missing-instance' },
  'a missing scope returns a non-sensitive missing-instance result',
)
const unpublishedStore = technicalPlan.createTechnicalPlanStore({ plansByKey: {
  'project-a:tdt': instance('project-a:tdt', 'tdt', [
    version('retired', 'V1', 'tdt', '已废弃', [task('retired-task', '非发布任务')]),
  ]),
} })
assert.deepEqual(
  unpublishedStore.clonePublishedVersion({ scope: { kind: 'tdt', parentProjectId: 'project-a' }, sourceVersionId: 'retired' }),
  { ok: false, reason: 'missing-source' },
  'only a published source version may be cloned',
)

const malformedScopePlans = {
  'project-a:subproject:undefined': instance('project-a:subproject:undefined', 'subproject', [
    version('trap', 'V1', 'subproject', '已发布', [task('trap-task', '不应访问')]),
  ]),
}
assert.deepEqual(
  technicalPlan.createTechnicalPlanStore({ plansByKey: malformedScopePlans }).clonePublishedVersion({
    scope: { kind: 'subproject', parentProjectId: 'project-a' }, sourceVersionId: 'trap', subproject: configuredChild,
  }),
  { ok: false, reason: 'missing-instance' },
  'a child scope without subprojectId is rejected before key lookup',
)
assert.deepEqual(
  technicalPlan.createTechnicalPlanStore({ plansByKey: malformedScopePlans }).clonePublishedVersion({
    scope: { kind: 'unsupported', parentProjectId: 'project-a' }, sourceVersionId: 'trap', subproject: configuredChild,
  }),
  { ok: false, reason: 'missing-instance' },
  'an illegal kind is rejected before key lookup',
)

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

const sharePageSource = readSource(root, 'src/app/share/plan/page.tsx')
assert.match(sharePageSource, /searchParams\.get\(['"]technical['"]\)/, 'share route branches only on the explicit technical flag')
assert.match(sharePageSource, /useTechnicalPlanStore/, 'share route reads the persisted technical plan store')
assert.match(sharePageSource, /resolveTechnicalSharePlan/, 'share route uses the scope-safe pure resolver')

console.log('technical plan operation checks passed')
