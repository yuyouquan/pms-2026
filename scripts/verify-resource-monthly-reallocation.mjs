import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'

globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = { localStorage }
const load = createTypeScriptModuleLoader()
const get = file => load(path.resolve(file))
const { getResourceRatioFields, getResourcePhaseRatios } = get('src/lib/resourceRatios.ts')
const sum = row => Math.round(Object.values(row.monthlyData).reduce((a, b) => a + b, 0) * 10) / 10

for (const [category, kind] of Object.entries({ tos: 'Tos', technical: 'Technical', capability: 'Capability', machine: 'Machine' })) {
  const store = get(`src/stores/hr${kind}.ts`)[`useHr${kind}Store`]
  store.getState().refreshFormalProjects()
  const project = store.getState().projects.find(item => item.id.includes(`mock-budget-${category}-unbound`))
  assert.ok(project, `${category}: budget fixture`)
  const source = project.versions.at(-1)
  const id = store.getState().createResourceVersion(project.id, 'annual', project.pmsProjectId, { versionNumber: '月度重算验收', sourceVersionId: source.id })
  const version = () => store.getState().projects.find(item => item.id === project.id).versions.find(item => item.id === id)
  const edit = patch => store.getState().updateVersionInline(project.id, id, patch, project.pmsProjectId)
  if (category === 'tos' || category === 'technical') for (const [index, field] of get('src/lib/resourceInlineEditing.ts').resourceMilestoneFields[category].entries()) edit({ type: 'milestone', key: field.key, value: `2026-${String(index + 1).padStart(2, '0')}-01` })
  const rows = () => store.getState().monthlyInvestments.filter(row => row.versionId === id && !row.isArchived)
  const rowId = rows()[0].id
  const monthly = () => rows().find(row => row.id === rowId)
  const month = Object.keys(monthly().monthlyData)[0]
  assert.ok(month, `${category}: allocated fixture`)
  const editMonth = (row, value) => store.getState().updateResourceMonthlyInvestment(project.id, id, row.id, Object.keys(row.monthlyData)[0], value, project.pmsProjectId)
  const sourceBefore = structuredClone(version())
  editMonth(monthly(), 999)
  assert.equal(monthly().monthlyData[month], 999)
  assert.deepEqual(version(), sourceBefore, `${category}: monthly changes never rewrite department amounts or ratios`)

  // Same source, refresh and persistence must not discard an intentional monthly override.
  store.getState().refreshFormalProjects()
  await store.persist.rehydrate()
  assert.equal(monthly().monthlyData[month], 999, `${category}: manual edits survive unchanged source and reload`)
  if (version().nonLaborInvestment.items.length) edit({ type: 'nonLaborItemTotal', itemId: version().nonLaborInvestment.items[0].id, value: 123.45 })
  assert.equal(monthly().monthlyData[month], 999, `${category}: expense edits do not reset labor`)

  if (category === 'machine') {
    edit({ type: 'model', key: 'levelCoefficient', value: version().levelCoefficient + 0.1 })
    assert.equal(monthly().isEdited, false, 'machine: model amount changes regenerate manual monthly values')
    assert.equal(sum(monthly()), monthly().estimatedTotal, 'machine: model-driven monthly allocation balances')
  } else {
    const department = version().departmentInvestments[0]
    const other = rows().find(row => row.id !== rowId)
    if (other) editMonth(other, 777)
    const otherBefore = other && structuredClone(rows().find(row => row.id === other.id))
    edit({ type: 'departmentTotal', rowId: department.id, value: 10 })
    assert.equal(monthly().isEdited, false, `${category}: upper total change clears obsolete monthly override`)
    assert.equal(sum(monthly()), 10, `${category}: upper total regenerates balanced monthly amounts`)
    if (other) assert.deepEqual(rows().find(row => row.id === other.id), otherBefore, `${category}: another department keeps manual allocation`)
    const fields = getResourceRatioFields(category)
    const ratios = getResourcePhaseRatios(category, version(), version().departmentInvestments[0])
    editMonth(monthly(), 999)
    edit({ type: 'departmentRatio', rowId: department.id, key: fields[0].key, value: ratios[fields[0].key] })
    assert.equal(monthly().monthlyData[month], 999, `${category}: unchanged ratio preserves monthly edits`)
    // Complete all percentages in the next stage (or 50% of capability's single period).
    for (const [index, field] of fields.entries()) edit({ type: 'departmentRatio', rowId: department.id, key: field.key, value: fields.length === 1 ? 50 : index === 1 ? 100 : 0 })
    assert.equal(monthly().isEdited, false, `${category}: ratios regenerate monthly allocation`)
    assert.equal(sum(monthly()), fields.length === 1 ? 5 : 10, `${category}: monthly sum follows actual phase percentages`)
    assert.equal(version().departmentInvestments[0].estimatedInvestment, 10, `${category}: partial allocation preserves upper target`)
    if (fields.length === 1) edit({ type: 'departmentRatio', rowId: department.id, key: fields[0].key, value: 100 })
    // Even a ratio change below the human-month rounding threshold must remove stale overrides.
    editMonth(monthly(), 999)
    edit({ type: 'departmentRatio', rowId: department.id, key: fields[fields.length === 1 ? 0 : 1].key, value: 99.99 })
    assert.equal(monthly().isEdited, false, `${category}: percentage-only change also triggers recalculation`)
    edit({ type: 'departmentRatio', rowId: department.id, key: fields[fields.length === 1 ? 0 : 1].key, value: 100 })
  }
  const regenerated = structuredClone(monthly().monthlyData)
  await store.persist.rehydrate()
  assert.deepEqual(monthly().monthlyData, regenerated, `${category}: regenerated allocation survives reload`)
  editMonth(monthly(), 888)
  const manualAfter = structuredClone(monthly().monthlyData)
  const copyId = store.getState().createResourceVersion(project.id, 'annual', project.pmsProjectId, { versionNumber: '月度重算复制', sourceVersionId: id })
  const copy = store.getState().monthlyInvestments.find(row => row.versionId === copyId && row.primaryDepartment === monthly().primaryDepartment && row.secondaryDepartment === monthly().secondaryDepartment)
  assert.deepEqual(copy.monthlyData, manualAfter, `${category}: copying preserves manual monthly snapshot`)
  store.getState().setVersionLocked(project.id, id, true)
  const locked = structuredClone(monthly())
  assert.throws(() => editMonth(monthly(), 1), /不可编辑/)
  store.getState().refreshFormalProjects()
  await store.persist.rehydrate()
  assert.deepEqual(monthly(), locked, `${category}: locked monthly snapshot remains unchanged`)
  // Simulate persisted locked rows from before allocation baselines existed.
  store.setState({ monthlyInvestments: store.getState().monthlyInvestments.map(row => {
    if (row.versionId !== id) return row
    const old = { ...row }
    delete old.allocationBasis
    return old
  }) })
  await store.persist.rehydrate()
  assert.deepEqual(monthly().monthlyData, locked.monthlyData, `${category}: legacy locked migration preserves amounts`)
  store.getState().setVersionLocked(project.id, id, false)
  if (category === 'machine') edit({ type: 'model', key: 'levelCoefficient', value: version().levelCoefficient + 0.1 })
  else edit({ type: 'departmentTotal', rowId: version().departmentInvestments[0].id, value: 20 })
  assert.equal(monthly().isEdited, false, `${category}: first source edit after legacy unlock regenerates`)
  assert.equal(sum(monthly()), monthly().estimatedTotal, `${category}: legacy unlock allocation balances`)
  console.log(`PASS ${category}: upper-to-monthly recalculation, independent departments, one-way edits, persistence, copy and lock`)
}

// First load of old persisted rows establishes a baseline without losing historical edits.
const { preserveHrMonthlyEdits } = get('src/lib/hrMonthlySync.ts')
const generated = { id: 'row', projectId: 'p', versionId: 'v', primaryDepartment: 'A', secondaryDepartment: 'B', estimatedTotal: 10, monthlyData: { '2026-01': 10 }, isEdited: false, allocationBasis: 'new-source' }
const legacy = { ...generated, monthlyData: { '2026-01': 12 }, isEdited: true }
delete legacy.allocationBasis
const adopted = preserveHrMonthlyEdits([generated], [legacy])[0]
assert.equal(adopted.monthlyData['2026-01'], 12)
assert.equal(adopted.allocationBasis, 'new-source')
assert.equal(preserveHrMonthlyEdits([{ ...generated, allocationBasis: 'changed-source' }], [adopted])[0].monthlyData['2026-01'], 10)
const { preserveLockedHrMonthlyRows } = get('src/lib/hrMonthlySync.ts')
for (const old of [
  { ...legacy, id: 'mi-p-v-dept0' },
  { ...legacy, id: 'mi-old-project-v-source-department' },
  { ...legacy, id: 'saved-id', sourceRowId: 'mi-old-project-v-source-department' },
]) {
  const current = { ...generated, id: 'mi-p-v-source-department' }
  const migrated = preserveLockedHrMonthlyRows([current], [old], [{ versions: [{ id: 'v', lockState: 'locked' }] }])[0]
  assert.equal(migrated.allocationBasis, current.allocationBasis, 'locked legacy identities receive a source baseline')
  assert.deepEqual(migrated.monthlyData, old.monthlyData, 'locked migration never regenerates saved values')
  assert.equal(preserveHrMonthlyEdits([{ ...current, allocationBasis: 'changed-source' }], [migrated])[0].monthlyData['2026-01'], 10)
}
console.log('PASS legacy persistence: adopt baseline, then regenerate only after source changes')
