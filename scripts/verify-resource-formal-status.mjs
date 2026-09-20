import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'

globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = { localStorage }
const load = createTypeScriptModuleLoader(), get = file => load(path.resolve(file))
const access = get('src/lib/hrProjectRegistry.ts')
const ratios = get('src/lib/resourceRatios.ts')
for (const kind of ['Machine', 'Tos', 'Technical', 'Capability']) {
  const category = kind.toLowerCase()
  const store = get(`src/stores/hr${kind}.ts`)[`useHr${kind}Store`]
  store.getState().refreshFormalProjects()
  const project = store.getState().projects.find(item => access.canAccessHrProject(item, true) && access.getHrAllowedBudgetTypes(item).includes('annual') && item.versions.some(version => version.budgetType === 'annual'))
  assert.ok(project)
  const source = project.versions.find(version => version.budgetType === 'annual')
  const id = store.getState().createResourceVersion(project.id, 'annual', project.pmsProjectId, { versionNumber: '90.1', sourceVersionId: source.id })
  const read = () => store.getState().projects.find(item => item.id === project.id)
  const version = () => read().versions.find(item => item.id === id)
  const monthly = () => store.getState().monthlyInvestments.filter(row => row.versionId === id && !row.isArchived)
  assert.ok(monthly().length)
  // Give this lifecycle test balanced monthly fixtures through actual edit actions.
  for (const row of monthly()) {
    const month = Object.keys(row.monthlyData).sort()[0]
    assert.ok(month)
    store.getState().updateMonthlyInvestment(row.id, { [month]: row.estimatedTotal })
  }
  for (const status of ['active', 'paused', 'cancelled']) {
    if (status === 'cancelled') store.getState().cancelProject(project.id)
    else store.setState({ projects: store.getState().projects.map(item => item.id === project.id ? { ...item, status } : item) })
    const row = monthly()[0], month = Object.keys(row.monthlyData)[0], value = row.monthlyData[month]
    store.getState().updateResourceMonthlyInvestment(project.id, id, row.id, month, Math.round((value + 0.1) * 10) / 10, project.pmsProjectId)
    const beforeMonthlyAttempt = JSON.stringify({ projects: store.getState().projects, rows: store.getState().monthlyInvestments })
    assert.throws(() => store.getState().setVersionActive(project.id, id, true), /月度|分配/, `${kind}/${status}: monthly gate applies to every executable formal transition`)
    assert.equal(JSON.stringify({ projects: store.getState().projects, rows: store.getState().monthlyInvestments }), beforeMonthlyAttempt, 'failed formalization does not change state or append audit')
    store.getState().updateResourceMonthlyInvestment(project.id, id, row.id, month, value, project.pmsProjectId)
    if (kind !== 'Machine') {
      const department = version().departmentInvestments[0]
      const previous = ratios.getResourcePhaseRatios(category, version(), department)
      const key = Object.keys(previous).find(key => previous[key] > 0)
      assert.ok(key)
      store.getState().updateVersionInline(project.id, id, { type: 'departmentRatio', rowId: department.id, key, value: 0 }, project.pmsProjectId)
      const beforeRatioAttempt = JSON.stringify(read())
      assert.throws(() => store.getState().setVersionActive(project.id, id, true), /100/, `${kind}/${status}: ratio gate applies to every executable formal transition`)
      assert.equal(JSON.stringify(read()), beforeRatioAttempt, 'failed ratio gate does not append success audit')
      store.getState().updateVersionInline(project.id, id, { type: 'departmentRatio', rowId: department.id, key, value: previous[key] }, project.pmsProjectId)
    }
    store.getState().setVersionActive(project.id, id, true)
    assert.equal(version().isActive, true, 'balanced version retains existing lifecycle eligibility')
    assert.equal(read().status, status, 'formalization does not change project status')
    store.getState().setVersionActive(project.id, id, false)
    assert.equal(version().isActive, false)
    console.log(`PASS ${kind}/${status}: monthly/ratio gates, atomic rejection, balanced formalization and cancellation`)
  }
}
