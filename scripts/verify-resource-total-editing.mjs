import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'

globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = { localStorage }
const load = createTypeScriptModuleLoader()
const editing = load(path.resolve('src/lib/resourceInlineEditing.ts'))

assert.equal(typeof editing.allocateLaborTotal, 'function', 'labor total allocation is a domain operation')
assert.equal(typeof editing.allocateNonLaborItemTotal, 'function', 'non-labor total allocation is a domain operation')
assert.equal(typeof editing.resolveMachineDepartmentInvestments, 'function', 'machine rows resolve through saved version overrides')

const rules = [
  { key: 'first', startField: 'start', endField: 'middle' },
  { key: 'second', startField: 'middle', endField: 'end' },
  { key: 'sameDay', startField: 'end', endField: 'same' },
]
assert.deepEqual(
  editing.allocateLaborTotal(1, rules, { start: '2026-01-01', middle: '2026-01-02', end: '2026-01-04', same: '2026-01-04' }),
  { first: 0.3, second: 0.7, sameDay: 0 },
  'calendar-day differences weight all displayed phases and same-day phases have zero weight',
)
assert.deepEqual(
  editing.allocateLaborTotal(0.1, rules.slice(0, 2), { start: '2026-01-01', middle: '2026-01-02', end: '2026-01-03' }),
  { first: 0.1, second: 0 },
  'tenths reconcile exactly and deterministically',
)
assert.deepEqual(editing.allocateLaborTotal(0, rules, {}), { first: 0, second: 0, sameDay: 0 }, 'zero clears even without dates')
assert.throws(() => editing.allocateLaborTotal(1, rules, { start: '2026-01-01' }), /日期/)
assert.throws(() => editing.allocateLaborTotal(1, rules.slice(0, 1), { start: '2026-01-02', middle: '2026-01-01' }), /日期/)
for (const invalid of [-1, Number.NaN, Number.POSITIVE_INFINITY, 1.25]) {
  assert.throws(() => editing.allocateLaborTotal(invalid, rules, {}), /人力投入/)
}

const expense = {
  startMonth: '2026-01', endMonth: '2026-03', items: [{
    id: 'expense', secondaryDepartment: '软件部', tertiaryDepartment: '驱动开发',
    subjectId: 'flight', secondarySubject: '交通费', tertiarySubject: '机票',
    monthlyAmounts: { '2025-12': 99, '2026-01': 1, '2026-02': 2, '2026-03': 3, '2026-04': 88 },
  }],
}
const allocatedExpense = editing.allocateNonLaborItemTotal(expense, 'expense', 10)
assert.deepEqual(allocatedExpense.items[0].monthlyAmounts, {
  '2025-12': 99, '2026-01': 3.34, '2026-02': 3.33, '2026-03': 3.33, '2026-04': 88,
}, 'only displayed months are evenly replaced and hidden amounts survive')
assert.equal(load(path.resolve('src/lib/nonLaborInvestment.ts')).nonLaborTotal(allocatedExpense), 10)
assert.throws(() => editing.allocateNonLaborItemTotal({ ...expense, startMonth: null, endMonth: null }, 'expense', 10), /月份|里程碑/)
for (const invalid of [-1, Number.NaN, Number.POSITIVE_INFINITY, 1.001]) {
  assert.throws(() => editing.allocateNonLaborItemTotal(expense, 'expense', invalid), /非人力投入/)
}

const config = load(path.resolve('src/stores/hrConfig.ts')).useHrConfigStore.getState().data
const model = config.hrModel.filter(row => row.enabled !== false)
const firstModel = model[0]
const version = {
  modelSnapshot: model,
  projectLevel: String(firstModel.projectLevel),
  hrModelVersion: String(firstModel.modelVersion),
  levelCoefficient: 1,
}
const derived = editing.resolveMachineDepartmentInvestments(version)
assert.ok(derived.length > 0)
const manual = derived.map((row, index) => index === 0 ? { ...row, [Object.keys(row).find(key => key.endsWith('ToStr1')) ?? 'conceptToStr1']: 9.9, estimatedInvestment: 9.9 } : row)
assert.deepEqual(editing.resolveMachineDepartmentInvestments({ ...version, machineDepartmentInvestments: manual }), manual)
const legacyManual = [{ id: 'legacy-row', primaryDepartment: '研发中心', secondaryDepartment: '软件部', estimatedInvestment: 6,
  conceptPhase: 1, planningPhase: 1, developmentPhase: 1, validationPhase: 1, launchPhase: 1, lifecycle: 1 }]
assert.deepEqual(
  load(path.resolve('src/lib/resourceAllocation.ts')).resolveMachinePhaseFields({ ...version, machineDepartmentInvestments: legacyManual }).map(field => field.key),
  ['conceptPhase', 'planningPhase', 'developmentPhase', 'validationPhase', 'launchPhase', 'lifecycle'],
  'saved actual-row schema remains authoritative after model metadata changes',
)

const registryRules = load(path.resolve('src/lib/hrProjectRegistry.ts'))
const projectStore = load(path.resolve('src/stores/project.ts')).useProjectStore
const stores = { machine: 'Machine', tos: 'Tos', technical: 'Technical', capability: 'Capability' }
const phaseKeys = {
  machine: ['conceptToStr1', 'str1ToStr2', 'str2ToStr3', 'str3ToStr4', 'str4ToStr4a', 'str4aToStr5', 'str5ToSixMonths'],
  tos: ['planningPhase', 'conceptPhase', 'planningPhase2', 'developmentValidationPhase', 'marketIterationPhase', 'maintenancePhase'],
  technical: ['planningPhase', 'conceptPhase', 'planPhase', 'developmentPhase', 'migrationPhase'],
  capability: [],
}

for (const [category, kind] of Object.entries(stores)) {
  const store = load(path.resolve(`src/stores/hr${kind}.ts`))[`useHr${kind}Store`]
  store.getState().refreshFormalProjects()
  const project = store.getState().projects.find(item => item.id.includes(`mock-budget-${category}-unbound`))
  assert.ok(project && registryRules.canEditHrInScope(project, project.pmsProjectId), `${category}: editable unbound budget fixture`)
  const currentProject = () => store.getState().projects.find(item => item.id === project.id)
  const currentVersion = () => currentProject().versions.find(item => item.id === versionId)
  const versionId = project.versions.at(-1).id
  const scopeId = project.pmsProjectId
  const edit = patch => store.getState().updateVersionInline(project.id, versionId, patch, scopeId)
  if (category === 'tos') edit({ type: 'milestone', key: 'maintenanceEnd', value: '2028-01-01' })
  const row = category === 'machine'
    ? editing.resolveMachineDepartmentInvestments(currentVersion())[0]
    : currentVersion().departmentInvestments[0]
  assert.ok(row)
  let snapshot = JSON.stringify(store.getState())
  assert.throws(() => store.getState().updateVersionInline(project.id, versionId, { type: 'departmentTotal', rowId: row.id, value: 10 }, 'wrong-scope'), /不可编辑/)
  assert.equal(JSON.stringify(store.getState()), snapshot, `${category}: scope failure is atomic`)
  edit({ type: 'departmentTotal', rowId: row.id, value: 10 })
  const savedRow = category === 'machine'
    ? currentVersion().machineDepartmentInvestments.find(item => item.id === row.id)
    : currentVersion().departmentInvestments.find(item => item.id === row.id)
  assert.equal(savedRow.estimatedInvestment, 10, `${category}: saved row total`)
  if (category !== 'capability') {
    assert.equal(Math.round(phaseKeys[category].reduce((sum, key) => sum + savedRow[key], 0) * 10) / 10, 10, `${category}: phases reverse-sum to total`)
  }
  const expectedVersionTotal = (category === 'machine' ? currentVersion().machineDepartmentInvestments : currentVersion().departmentInvestments)
    .reduce((sum, item) => sum + item.estimatedInvestment, 0)
  assert.equal(currentVersion().estimatedInvestment, Math.round(expectedVersionTotal * 10) / 10, `${category}: version aggregate follows rows`)
  assert.equal(currentProject().annualBudget, currentVersion().estimatedInvestment, `${category}: active summary follows edited version total`)
  const monthly = store.getState().monthlyInvestments.find(item => item.versionId === versionId && item.sourceRowId?.endsWith(row.id) || item.versionId === versionId && item.id.endsWith(row.id))
  assert.equal(monthly?.estimatedTotal, 10, `${category}: monthly source row uses edited total`)

  if (category === 'machine' && monthly) {
    const manualMonthly = { ...monthly.monthlyData, [Object.keys(monthly.monthlyData)[0]]: 7.7 }
    store.getState().updateMonthlyInvestment(monthly.id, manualMonthly)
    edit({ type: 'departmentTotal', rowId: row.id, value: 10.1 })
    assert.deepEqual(store.getState().monthlyInvestments.find(item => item.id === monthly.id).monthlyData, manualMonthly, 'machine: manual monthly allocation survives total regeneration')
  }

  if (category !== 'capability') {
    const firstPhase = phaseKeys[category][0]
    const rows = category === 'machine' ? currentVersion().machineDepartmentInvestments : currentVersion().departmentInvestments
    edit({ type: 'departments', rows: rows.map(item => item.id === row.id ? { ...item, [firstPhase]: 4.4 } : item) })
    const reversed = (category === 'machine' ? currentVersion().machineDepartmentInvestments : currentVersion().departmentInvestments).find(item => item.id === row.id)
    assert.equal(reversed.estimatedInvestment, Math.round(phaseKeys[category].reduce((sum, key) => sum + reversed[key], 0) * 10) / 10, `${category}: phase edit recalculates row total`)
  }

  const expenseItem = currentVersion().nonLaborInvestment.items[0]
  edit({ type: 'nonLaborItemTotal', itemId: expenseItem.id, value: 12.34 })
  assert.equal(load(path.resolve('src/lib/nonLaborInvestment.ts')).nonLaborTotal({ ...currentVersion().nonLaborInvestment, items: [currentVersion().nonLaborInvestment.items[0]] }), 12.34, `${category}: saved expense item total`)

  if (category === 'machine') {
    const rowsBeforeModel = structuredClone(currentVersion().machineDepartmentInvestments)
    edit({ type: 'model', key: 'levelCoefficient', value: currentVersion().levelCoefficient + 0.01 })
    assert.deepEqual(currentVersion().machineDepartmentInvestments, rowsBeforeModel, 'machine: explicit model metadata changes preserve actual rows')
    const beforeRows = structuredClone(currentVersion().machineDepartmentInvestments)
    edit({ type: 'milestone', key: 'str4a', value: '2027-07-20' })
    assert.deepEqual(currentVersion().machineDepartmentInvestments, beforeRows, 'machine: unrelated date edits preserve actual rows')
    const tampered = beforeRows.map((item, index) => index ? item : { ...item, secondaryDepartment: '篡改部门' })
    snapshot = JSON.stringify(store.getState())
    assert.throws(() => edit({ type: 'departments', rows: tampered }), /部门|来源/)
    assert.equal(JSON.stringify(store.getState()), snapshot, 'machine: source identity rejection is atomic')
    store.getState().refreshFormalProjects()
    assert.deepEqual(currentVersion().machineDepartmentInvestments, beforeRows, 'machine: unlocked source sync preserves actual rows')
    const exported = load(path.resolve('src/components/project-resources/exportResourceVersion.ts')).buildResourceVersionExportData(project.name, currentVersion(), store.getState().monthlyInvestments)
    assert.deepEqual(exported.departments, currentVersion().machineDepartmentInvestments, 'machine: export resolves saved actual rows')
  }

  const administrator = projectStore.getState().currentLoginUser
  projectStore.getState().setCurrentLoginUser('无权限用户')
  snapshot = JSON.stringify(store.getState())
  assert.throws(() => edit({ type: 'departmentTotal', rowId: row.id, value: 8.8 }), /不可编辑/)
  assert.equal(JSON.stringify(store.getState()), snapshot, `${category}: no-permission write is atomic`)
  projectStore.getState().setCurrentLoginUser(administrator)
  edit({ type: 'departmentTotal', rowId: row.id, value: 8.8 })
  assert.equal((category === 'machine' ? currentVersion().machineDepartmentInvestments : currentVersion().departmentInvestments).find(item => item.id === row.id).estimatedInvestment, 8.8, `${category}: same valid write succeeds after restoring administrator`)

  const frozen = structuredClone(currentVersion())
  store.getState().setVersionLocked(project.id, versionId, true)
  assert.throws(() => edit({ type: 'departmentTotal', rowId: row.id, value: 8 }), /不可编辑/)
  store.getState().copyVersion(project.id, versionId)
  const copy = currentProject().versions.at(-1)
  if (category === 'machine') {
    assert.deepEqual(copy.machineDepartmentInvestments, currentVersion().machineDepartmentInvestments, 'machine: copy preserves actual rows')
    const sourceRows = structuredClone(currentVersion().machineDepartmentInvestments)
    store.getState().updateVersionInline(project.id, copy.id, { type: 'departmentTotal', rowId: copy.machineDepartmentInvestments[0].id, value: 7.7 }, scopeId)
    assert.deepEqual(currentVersion().machineDepartmentInvestments, sourceRows, 'machine: editing the copy cannot mutate its locked source')
    assert.equal(currentProject().versions.find(item => item.id === copy.id).machineDepartmentInvestments[0].estimatedInvestment, 7.7)
  }
  assert.notEqual(copy.id, versionId)
  assert.equal(currentVersion().lockState, 'locked')
  await store.persist.rehydrate()
  store.getState().refreshFormalProjects()
  assert.deepEqual(currentVersion().nonLaborInvestment, frozen.nonLaborInvestment, `${category}: locked expense snapshot survives reload/sync`)
  if (category === 'machine') assert.deepEqual(currentVersion().machineDepartmentInvestments, frozen.machineDepartmentInvestments, 'machine: locked actual rows survive reload/sync')
  console.log(`PASS ${category}: total/phase reverse calculation, monthly, expense, scope, lock, copy and reload`)
}

console.log('PASS resource totals: labor duration allocation, expense month allocation and machine override resolution')
