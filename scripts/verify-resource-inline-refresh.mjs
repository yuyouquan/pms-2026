import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'

globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = { localStorage }
const graph = () => {
  const loader = createTypeScriptModuleLoader()
  return file => loader(path.resolve(file))
}
const load = graph()
const access = load('src/lib/hrProjectRegistry.ts')
const config = load('src/stores/hrConfig.ts').useHrConfigStore.getState().data
const expense = load('src/lib/nonLaborInvestment.ts')
const pair = expense.nonLaborDepartmentPairs(config.techModuleDept)[0]
const subject = config.nonLaborSubject.find(item => item.enabled !== false)
assert.ok(pair && subject, 'configured expense choices exist')
const cases = []

for (const [category, kind] of Object.entries({ machine: 'Machine', tos: 'Tos', technical: 'Technical', capability: 'Capability' })) {
  const store = load(`src/stores/hr${kind}.ts`)[`useHr${kind}Store`]
  store.getState().refreshFormalProjects()
  const project = store.getState().projects.find(item => access.canAccessHrProject(item, true) && item.status === 'active' && item.versions.length && (category !== 'machine' || item.versions.some(version => version.modelSnapshot?.length)))
  assert.ok(project, `${category}: editable project exists`)
  const id = store.getState().createVersionInline(project.id, access.getHrAllowedBudgetTypes(project)[0], project.pmsProjectId)
  const current = () => store.getState().projects.find(item => item.id === project.id).versions.find(version => version.id === id)
  const edit = patch => store.getState().updateVersionInline(project.id, id, patch, project.pmsProjectId)
  if (category === 'capability') {
    edit({ type: 'milestone', key: 'projectStartTime', value: null })
    edit({ type: 'milestone', key: 'projectEndTime', value: null })
    edit({ type: 'milestone', key: 'projectStartTime', value: '2027-02-10' })
  }
  edit({ type: 'nonLabor', value: { ...current().nonLaborInvestment, items: [{
    id: `refresh-${category}`, secondaryDepartment: pair.secondaryDepartment, tertiaryDepartment: '',
    secondarySubject: '', tertiarySubject: '', subjectId: '', monthlyAmounts: {},
  }] } })
  cases.push({ category, kind, projectId: project.id, scopeId: project.pmsProjectId, versionId: id, expected: structuredClone(current()) })
}

// A fresh module graph is stronger than re-reading the same live store: constructor,
// persisted-state merge and canonical project synchronization all run again.
const fresh = graph()
fresh('src/stores/project.ts')
for (const scenario of cases) {
  const { category, kind, projectId, scopeId, versionId, expected } = scenario
  const store = fresh(`src/stores/hr${kind}.ts`)[`useHr${kind}Store`]
  const owner = () => store.getState().projects.find(item => item.id === projectId)
  const current = () => owner().versions.find(item => item.id === versionId)
  const edit = patch => store.getState().updateVersionInline(projectId, versionId, patch, scopeId)
  store.getState().refreshFormalProjects()
  await store.persist.rehydrate()
  assert.deepEqual(current(), expected, `${category}: partial fields survive fresh graph + source sync + rehydrate`)
  if (category === 'capability') {
    assert.equal(current().projectStartTime, '2027-02-10')
    assert.equal(current().projectEndTime, '')
    edit({ type: 'milestone', key: 'projectEndTime', value: '2027-04-30' })
    assert.equal(current().nonLaborInvestment.endMonth, '2027-04')
  }
  const updateItem = patch => edit({ type: 'nonLabor', value: { ...current().nonLaborInvestment, items: [{ ...current().nonLaborInvestment.items[0], ...patch }] } })
  updateItem({ tertiaryDepartment: pair.tertiaryDepartment })
  updateItem({ secondarySubject: String(subject.secondarySubject) })
  updateItem({ subjectId: subject.id, tertiarySubject: String(subject.tertiarySubject) })
  const month = current().nonLaborInvestment.startMonth
  if (month) {
    updateItem({ monthlyAmounts: { [month]: 123.45 } })
    assert.equal(expense.nonLaborTotal(current().nonLaborInvestment), 123.45)
  }
  const before = structuredClone(store.getState().projects)
  assert.throws(() => updateItem({ tertiaryDepartment: 'invalid-unconfigured-department' }))
  assert.deepEqual(store.getState().projects, before, 'mismatched configured department rejects atomically')
  store.getState().setVersionLocked(projectId, versionId, true)
  const locked = structuredClone(current())
  assert.throws(() => edit({ type: 'batch', value: 2 }))
  store.getState().copyVersion(projectId, versionId)
  const copy = owner().versions.at(-1)
  assert.notEqual(copy.id, versionId)
  assert.equal(copy.lockState, 'unlocked')
  assert.equal(copy.isActive, false)
  store.getState().updateVersionInline(projectId, copy.id, { type: 'batch', value: 2 }, scopeId)
  store.getState().refreshFormalProjects()
  assert.deepEqual(current(), locked, 'editing a copy cannot mutate locked source')
  assert.equal(owner().versions.find(item => item.id === copy.id).batch, 2)
  console.log(`PASS independent ${category}: partial refresh/resume, configured-pair atomicity, expense totals, lock and copy isolation`)
}
