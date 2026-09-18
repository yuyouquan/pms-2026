import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'
globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = { localStorage }
const load = createTypeScriptModuleLoader(), get = file => load(path.resolve(file))
const registry = get('src/stores/project.ts').useProjectStore
const rules = get('src/lib/hrProjectRegistry.ts')
for (const [category, kind] of Object.entries({ machine: 'Machine', tos: 'Tos', technical: 'Technical', capability: 'Capability' })) {
  const store = get(`src/stores/hr${kind}.ts`)[`useHr${kind}Store`]
  store.getState().refreshFormalProjects()
  assert.equal(typeof store.getState().createVersionInline, 'function', `${category}: direct creation API`)
  const project = store.getState().projects.find(p => rules.canAccessHrProject(p, true) && p.status === 'active' && p.versions.length && (category !== 'machine' || p.versions.some(v => v.modelSnapshot?.length)))
  assert.ok(project)
  const budget = rules.getHrAllowedBudgetTypes(project)[0]
  const current = () => store.getState().projects.find(p => p.id === project.id)
  const before = structuredClone(current())
  const id = store.getState().createVersionInline(project.id, budget, project.pmsProjectId)
  const read = () => current().versions.find(v => v.id === id)
  assert.ok(read(), `${category}: persists immediately`)
  assert.equal(read().isActive, false)
  assert.equal(read().lockState, 'unlocked')
  assert.equal(read().copiedFromVersionId, undefined)
  assert.deepEqual(current().versions.filter(v => v.id !== id), before.versions)
  const update = patch => store.getState().updateVersionInline(project.id, id, patch, project.pmsProjectId)
  update({ type: 'batch', value: 7 })
  assert.equal(read().batch, 7)
  let saved = JSON.stringify(store.getState())
  assert.throws(() => update({ type: 'batch', value: 99 }))
  assert.equal(JSON.stringify(store.getState()), saved, 'invalid write is atomic')
  assert.throws(() => store.getState().updateVersionInline(project.id, id, { type: 'batch', value: 8 }, 'another-project'))
  if (category === 'capability') {
    update({ type: 'milestone', key: 'projectStartTime', value: null })
    update({ type: 'milestone', key: 'projectEndTime', value: null })
    update({ type: 'milestone', key: 'projectStartTime', value: '2026-01-01' })
    assert.equal(read().projectEndTime, '')
    assert.throws(() => update({ type: 'milestone', key: 'projectEndTime', value: '2025-12-31' }))
    update({ type: 'milestone', key: 'projectEndTime', value: '2026-03-31' })
  } else if (rules.isHrFormalRecord(project)) {
    const key = category === 'technical' ? 'planningStart' : 'conceptStart'
    assert.throws(() => update({ type: 'milestone', key, value: '2035-01-01' }), 'formal source milestone readonly')
  }
  if (category === 'machine') {
    const amount = read().estimatedInvestment
    const coefficient = read().levelCoefficient
    update({ type: 'model', key: 'levelCoefficient', value: coefficient * 2 })
    assert.ok(Math.abs(read().estimatedInvestment - amount * 2) < 0.11)
    assert.throws(() => update({ type: 'model', key: 'levelCoefficient', value: -1 }))
  } else {
    update({ type: 'departments', rows: [{ id: 'inline-dept', primaryDepartment: '', secondaryDepartment: '', estimatedInvestment: 0 }] })
    saved = JSON.stringify(store.getState())
    assert.throws(() => update({ type: 'departments', rows: [{ ...read().departmentInvestments[0], primaryDepartment: 'invalid-parent', secondaryDepartment: 'invalid-child' }] }), 'reject unknown department pair')
    assert.equal(JSON.stringify(store.getState()), saved)
    const pair = Object.values(get('src/stores/hrConfig.ts').useHrConfigStore.getState().data).flat().find(row => row.primaryDepartment && row.secondaryDepartment)
    update({ type: 'departments', rows: [{ ...read().departmentInvestments[0], primaryDepartment: pair.primaryDepartment, secondaryDepartment: pair.secondaryDepartment, ...(category === 'capability' ? { estimatedInvestment: 12 } : { planningPhase: 12 }) }] })
    assert.equal(read().estimatedInvestment, 12)
    assert.ok(store.getState().monthlyInvestments.some(row => row.versionId === id && row.estimatedTotal === 12 && !row.isArchived))
    assert.throws(() => update({ type: 'departments', rows: [read().departmentInvestments[0], { ...read().departmentInvestments[0], id: 'duplicate' }] }))
  }
  const empty = { id: 'inline-expense', secondaryDepartment: '', tertiaryDepartment: '', subjectId: '', secondarySubject: '', tertiarySubject: '', monthlyAmounts: {} }
  update({ type: 'nonLabor', value: { ...read().nonLaborInvestment, items: [empty] } })
  assert.equal(read().nonLaborInvestment.items[0].secondarySubject, '')
  assert.throws(() => store.getState().updateVersion(project.id, id, { nonLaborInvestment: read().nonLaborInvestment }), 'legacy validator remains strict')
  saved = JSON.stringify(store.getState())
  assert.throws(() => update({ type: 'nonLabor', value: { ...read().nonLaborInvestment, items: [{ ...empty, monthlyAmounts: { '2026-01': -1 } }] } }))
  assert.equal(JSON.stringify(store.getState()), saved)
  await store.persist.rehydrate()
  assert.equal(read().nonLaborInvestment.items[0].secondarySubject, '')
  assert.equal(read().batch, 7)
  store.getState().setVersionLocked(project.id, id, true)
  const frozen = structuredClone(read())
  assert.throws(() => update({ type: 'batch', value: 9 }))
  assert.deepEqual(read(), frozen)
  store.setState({ projects: store.getState().projects.map(p => p.id === project.id ? { ...p, versions: [] } : p) })
  const blankId = store.getState().createVersionInline(project.id, budget, project.pmsProjectId)
  const blank = current().versions.find(v => v.id === blankId)
  assert.equal(blank.nonLaborInvestment.items.length, 0, 'new empty project has no invented expense subjects')
  if (category !== 'machine') assert.equal(blank.departmentInvestments.length, 0, 'no arbitrary departments')
  if (category === 'capability') { assert.equal(blank.projectStartTime, ''); assert.equal(blank.projectEndTime, '') }
  if (category === 'tos') { assert.equal(blank.milestones.marketIteration, null); assert.equal(blank.milestones.maintenanceEnd, null) }
  if (category === 'machine') {
    const config = get('src/stores/hrConfig.ts').useHrConfigStore
    const data = config.getState().data
    config.setState({ data: { ...data, hrModel: [] } })
    const before = JSON.stringify(store.getState())
    assert.throws(() => store.getState().createVersionInline(project.id, budget, project.pmsProjectId), /人力模型/)
    assert.equal(JSON.stringify(store.getState()), before, 'no-model creation is atomic')
    config.setState({ data })
    const budgetProject = store.getState().projects.find(p => rules.canAccessHrProject(p, true) && rules.getHrAllowedBudgetTypes(p).includes('annual') && p.status === 'active')
    assert.ok(budgetProject)
    const budgetVersionId = store.getState().createVersionInline(budgetProject.id, 'annual', budgetProject.pmsProjectId)
    const canonical = () => registry.getState().projects.find(p => p.id === budgetProject.pmsProjectId)
    const otherBrand = Object.keys(get('src/lib/roadmapValidation.ts').PRODUCT_LINES_BY_BRAND).find(brand => brand !== canonical().brand)
    store.getState().updateVersionInline(budgetProject.id, budgetVersionId, { type: 'metadata', key: 'brand', value: otherBrand }, budgetProject.pmsProjectId)
    assert.equal(canonical().brand, otherBrand)
    assert.equal(canonical().productLine, '', 'brand change retains incomplete metadata instead of inventing product line')
    store.getState().updateVersionInline(budgetProject.id, budgetVersionId, { type: 'metadata', key: 'marketName', value: 'inline market' }, budgetProject.pmsProjectId)
    assert.equal(canonical().marketName, 'inline market')
  }
  console.log(`PASS ${category}: direct create, scope, atomic validation, partial entry, calculations, persistence, locked snapshot`)
}
