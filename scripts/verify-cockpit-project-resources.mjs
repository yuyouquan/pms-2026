import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'
// Isolated storage: exercise the production stores without changing any browser data.
globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = { localStorage }
const load = createTypeScriptModuleLoader(), get = file => load(path.resolve(file))
const data = get('src/components/cockpit/cockpitData.ts')
const { collectCockpitInputs } = get('src/components/cockpit/cockpitSources.ts')
const { cockpitProjectRanking } = get('src/components/cockpit/cockpitRankingData.ts')
const { buildDashboardAnalysis } = get('src/components/project-resources/resourceDashboardData.ts')
const { buildAccountingAnalysis } = get('src/components/project-resources/resourceAccounting.ts')
const { useProjectStore } = get('src/stores/project.ts')
const { usePermissionStore } = get('src/stores/permission.ts')
usePermissionStore.getState().ensurePermissionCenter()
const stores = Object.fromEntries(['Machine', 'Tos', 'Technical', 'Capability'].map(kind => [kind.toLowerCase(), get(`src/stores/hr${kind}.ts`)[`useHr${kind}Store`]]))
Object.values(stores).forEach(store => store.getState().refreshFormalProjects())
const inputs = () => collectCockpitInputs(useProjectStore.getState().projects, Object.fromEntries(Object.entries(stores).map(([key, store]) => [key, store.getState()])), useProjectStore.getState().currentLoginUser)
const dates = { startDate: '2026-01-01', endDate: '2026-12-31' }, today = '2026-10-08'
const facts = () => data.buildCockpitFacts(inputs(), dates, 5, today, () => true)
const close = (a, b, label) => assert.ok(Math.abs(a - b) < 0.00002, `${label}: ${a} != ${b}`)
const initialInputs = inputs(), initialFacts = facts()
const rankings = Object.fromEntries(['budget', 'actual'].map(metric => [metric, Object.fromEntries(['labor', 'cost'].map(mode => [mode, cockpitProjectRanking(initialFacts, metric, mode)]))]))
assert.ok(initialInputs.length >= 8 && initialFacts.length > 0, 'use existing project registry and all four real resource stores')
assert.equal(data.defaultCockpitScope(initialFacts), 'all', 'existing R&D departments remain visible on first entry')
assert.equal(data.defaultCockpitScope([...initialFacts, { primary: '软件工程部' }]), 'software', 'prefer the documented department when its resources are present')
for (const input of initialInputs) {
  const row = data.summarizeCockpit(initialFacts.filter(fact => fact.project.id === input.project.id))
  input.sources.forEach((source, index) => {
    if (!source) return
    const projectView = buildDashboardAnalysis(input.category, source, input.monthly, 5, dates)
    if (!projectView.months.length) return
    for (const mode of ['labor', 'cost']) {
      close(row[['annual', 'estimate', 'budget'][index]][mode], projectView[mode], `${input.project.id} ${source.version.budgetType} ${mode} matches project-space resource overview`)
      if (index === 2) close(rankings.budget[mode].rows.find(row => row.key === input.project.id).value, projectView[mode], `${input.project.id} ${mode} ranking matches independently calculated project budget`)
    }
  })
  if (input.dataset) {
    const projectActual = buildAccountingAnalysis(input.dataset, 5, { ...dates, endDate: today })
    for (const mode of ['labor', 'cost']) {
      close(row.actual[mode], projectActual[mode], `${input.project.id} ${mode} accounting uses same date window and ledger`)
      close(rankings.actual[mode].rows.find(row => row.key === input.project.id).value, projectActual[mode], `${input.project.id} ${mode} ranking uses independently calculated project ledger`)
    }
  }
}
const bound = useProjectStore.getState().projects.filter(project => project.boundFormalProjectId)
assert.ok(bound.length > 0)
assert.ok(bound.every(project => !initialInputs.some(input => input.project.id === project.id)), 'bound annual budget never becomes a second project')
const annualIds = initialInputs.flatMap(input => input.sources[0] ? [input.sources[0].version.id] : [])
assert.equal(new Set(annualIds).size, annualIds.length, 'one official annual budget is counted once')

// Edit a new revision through the real project-resource API, then formalize it.
const input = initialInputs.find(input => input.category === 'capability' && input.sources[2])
assert.ok(input)
const store = stores.capability, source = input.sources[2], ownerId = source.owner.id, scopeId = input.project.id
const before = data.summarizeCockpit(facts())
const firstHalf = { startDate: '2026-01-01', endDate: '2026-06-30' }
const firstHalfFacts = () => data.buildCockpitFacts(inputs(), firstHalf, 5, today, () => true)
const firstHalfBefore = data.summarizeCockpit(firstHalfFacts())
const draftId = store.getState().createResourceVersion(ownerId, 'projectBudget', scopeId, { versionNumber: '90.1', sourceVersionId: source.version.id })
const monthly = () => store.getState().monthlyInvestments.filter(row => row.versionId === draftId && !row.isArchived)
assert.ok(monthly().length)
// Keep the total balanced while moving the allocation to the end of the project.
for (const row of monthly()) {
  const months = Object.keys(row.monthlyData).sort()
  assert.ok(months.length > 1)
  for (const month of months) store.getState().updateResourceMonthlyInvestment(ownerId, draftId, row.id, month, month === months.at(-1) ? row.estimatedTotal : 0, scopeId)
}
close(data.summarizeCockpit(facts()).budget.labor, before.budget.labor, 'draft edits do not change official cockpit totals')
close(cockpitProjectRanking(facts(), 'budget', 'labor').total, before.budget.labor, 'draft cannot change ranking total')
store.getState().setVersionActive(ownerId, draftId, true)
const published = inputs().find(item => item.project.id === scopeId)
assert.equal(published.sources[2].version.id, draftId, 'new official version is immediately selected from the shared store')
const projectAfter = buildDashboardAnalysis('capability', published.sources[2], published.monthly, 5, firstHalf)
const cockpitAfter = data.summarizeCockpit(firstHalfFacts().filter(row => row.project.id === scopeId))
close(cockpitAfter.budget.labor, projectAfter.labor, 'published project-space edit updates cockpit without copied data')
close(cockpitProjectRanking(firstHalfFacts(), 'budget', 'labor').rows.find(row => row.key === scopeId).value, projectAfter.labor, 'formalized allocation updates ranking from shared store')
assert.notEqual(data.summarizeCockpit(firstHalfFacts()).budget.labor, firstHalfBefore.budget.labor, 'published allocation change is reflected in the selected period')
close(data.summarizeCockpit(facts()).actual.labor, before.actual.labor, 'budget revision does not mutate actual worklogs')
console.log(`PASS cockpit uses ${initialInputs.length} real project sources: all-category value parity, project ranking/ledger parity, existing department defaults, bound-budget deduplication, draft isolation and official-version updates`)
