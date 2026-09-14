import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'

globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = { localStorage: globalThis.localStorage }
const load = createTypeScriptModuleLoader()
const get = file => load(path.resolve(file))
const plan = get('src/stores/plan.ts').usePlanStore
const technical = get('src/stores/technicalPlan.ts').useTechnicalPlanStore

function receive(store, change) {
  const key = store.persist.getOptions().name
  const saved = JSON.parse(localStorage.getItem(key))
  change(saved.state)
  localStorage.setItem(key, JSON.stringify(saved))
  store.persist.rehydrate()
}

const versions = plan.getState().versions
const templateScope = Object.keys(plan.getState().configTemplateVersionScopes)[0]
const marketKey = 'review-project::OP'
const tosKey = 'review-project::Full::level1'
plan.setState(state => ({
  currentVersion: 'v4',
  marketVersionsByKey: { ...state.marketVersionsByKey, [marketKey]: versions },
  marketCurrentVersionByKey: { ...state.marketCurrentVersionByKey, [marketKey]: 'v4' },
  tosTypeVersionsByKey: { ...state.tosTypeVersionsByKey, [tosKey]: versions },
  tosTypeCurrentVersionByKey: { ...state.tosTypeCurrentVersionByKey, [tosKey]: 'v4' },
  configTemplateVersionScopes: { ...state.configTemplateVersionScopes, [templateScope]: { versions, currentVersion: 'v4' } },
  configTemplateCompareScopes: { ...state.configTemplateCompareScopes, [templateScope]: { versionA: 'v2', versionB: 'v3' } },
  ganttEditingTask: { id: 'unsaved-editor' },
}))
const localPlan = plan.getState()
receive(plan, saved => {
  saved.currentVersion = 'v1'
  saved.marketCurrentVersionByKey[marketKey] = 'v1'
  saved.tosTypeCurrentVersionByKey[tosKey] = 'v1'
  saved.configTemplateVersionScopes[templateScope].currentVersion = 'v1'
  saved.configTemplateCompareScopes[templateScope] = { versionA: 'v1', versionB: 'v2' }
  saved.publishedSnapshots['review-remote-snapshot'] = [{ id: 'review-task', taskName: '远端发布计划' }]
})
assert.equal(plan.getState().currentVersion, 'v4', 'external version navigation must not leave the local draft')
assert.equal(plan.getState().marketCurrentVersionByKey[marketKey], 'v4')
assert.equal(plan.getState().tosTypeCurrentVersionByKey[tosKey], 'v4')
assert.equal(plan.getState().configTemplateVersionScopes[templateScope].currentVersion, 'v4')
assert.deepEqual(plan.getState().configTemplateCompareScopes[templateScope], { versionA: 'v2', versionB: 'v3' })
assert.equal(plan.getState().publishedSnapshots['review-remote-snapshot'][0].taskName, '远端发布计划')
assert.equal(plan.getState().marketPlanData, localPlan.marketPlanData, 'unchanged plan data must preserve its reference')
assert.equal(plan.getState().ganttEditingTask, localPlan.ganttEditingTask)
const afterPlan = plan.getState()
receive(plan, () => {})
assert.equal(plan.getState().publishedSnapshots, afterPlan.publishedSnapshots)
receive(plan, saved => {
  saved.versions = saved.versions.filter(version => version.id !== 'v4')
  saved.currentVersion = 'v1'
})
assert.equal(plan.getState().currentVersion, 'v1', 'deleted selections must fall back to the received valid selection')

const scope = { kind: 'tdt', parentProjectId: '9' }
technical.getState().setCurrentVersion(scope, 'tech-9-v1')
technical.getState().setCollapsed(scope, ['1'])
technical.getState().setColumns(scope, { order: ['id', 'taskName'], visible: ['id', 'taskName'] })
const localTechnical = technical.getState().plansByKey
receive(technical, saved => {
  const remotePlan = saved.plansByKey['9:tdt']
  remotePlan.currentVersionId = 'tech-9-v2-draft'
  remotePlan.collapsedRows = []
  remotePlan.columnSettings = { order: ['id'], visible: ['id'] }
  remotePlan.versions[1].tasks[0].taskName = '远端修订任务'
})
const receivedTechnical = technical.getState().plansByKey
assert.equal(receivedTechnical['9:tdt'].currentVersionId, 'tech-9-v1', 'rehydration must not force an existing draft over the local selection')
assert.equal(receivedTechnical['9:tdt'].collapsedRows, localTechnical['9:tdt'].collapsedRows)
assert.equal(receivedTechnical['9:tdt'].columnSettings, localTechnical['9:tdt'].columnSettings)
assert.equal(receivedTechnical['9:tdt'].versions[1].tasks[0].taskName, '远端修订任务')
assert.equal(receivedTechnical['4:tdt'], localTechnical['4:tdt'], 'an unrelated plan must preserve its reference')
receive(technical, () => {})
assert.equal(technical.getState().plansByKey, receivedTechnical)
const restartedLoad = createTypeScriptModuleLoader()
const restartedPlan = restartedLoad(path.resolve('src/stores/plan.ts')).usePlanStore
const restartedTechnical = restartedLoad(path.resolve('src/stores/technicalPlan.ts')).useTechnicalPlanStore
assert.equal(restartedPlan.getState().currentVersion, 'v1', 'first hydration must retain the original persisted selection behavior')
assert.equal(restartedTechnical.getState().plansByKey['9:tdt'].currentVersionId, 'tech-9-v2-draft', 'first hydration must retain the original draft-default migration')
receive(technical, saved => {
  saved.plansByKey['9:tdt'].versions = saved.plansByKey['9:tdt'].versions.filter(version => version.id !== 'tech-9-v1')
})
assert.equal(technical.getState().plansByKey['9:tdt'].currentVersionId, 'tech-9-v2-draft')
console.log('PASS plan source hydration imports business changes, preserves local UI and unchanged references, and recovers deleted selections')
