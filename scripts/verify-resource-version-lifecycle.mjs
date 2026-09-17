import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'
globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = { localStorage }
const load = createTypeScriptModuleLoader(), get = file => load(path.resolve(file))
const registry = get('src/stores/project.ts').useProjectStore
const actor = registry.getState().currentLoginUser
for (const kind of ['Machine', 'Tos', 'Technical', 'Capability']) {
 const store = get(`src/stores/hr${kind}.ts`)[`useHr${kind}Store`]
 assert.equal(typeof store.getState().setVersionActive, 'function', `${kind} active action exists`)
 assert.equal(typeof store.getState().setVersionLocked, 'function')
 assert.equal(typeof store.getState().copyVersion, 'function')
}
console.log('PASS lifecycle API')
const rules = get('src/lib/hrVersionRules.ts')
const { preserveLockedHrMonthlyRows } = get('src/lib/hrMonthlySync.ts')
const historicRow = { id: 'r', projectId: 'p', versionId: 'v', primaryDepartment: 'A', secondaryDepartment: 'B', estimatedTotal: 5, monthlyData: { '2026-01': 5 }, isEdited: true, isArchived: true }
assert.equal(preserveLockedHrMonthlyRows([{ ...historicRow, isArchived: false }], [historicRow], [{ versions: [{ id: 'v', lockState: 'locked' }] }])[0].isArchived, false, 'legacy latest-only archival is restored for locked source-present rows')
const legacy = [1, 2, 3].map(n => ({ id: String(n), budgetType: 'annual', majorVersion: 0, minorVersion: n, versionNumber: `V0.${n}`, createdAt: '2026-01-01', lockState: n === 2 ? 'locked' : 'unlocked' }))
assert.deepEqual(rules.normalizeHrVersionSequence(legacy).map(v => v.isActive), [false, false, true])
const cleared = rules.normalizeHrVersionSequence(legacy).map(v => ({ ...v, isActive: false }))
assert.deepEqual(rules.normalizeHrVersionSequence(cleared), cleared, 'explicit zero active is idempotent')
assert.deepEqual(rules.normalizeHrVersionSequence(legacy.map(v => ({ ...v, isActive: true }))).map(v => v.isActive), [false, false, true])
for (const kind of ['Machine', 'Tos', 'Technical', 'Capability']) {
 const store = get(`src/stores/hr${kind}.ts`)[`useHr${kind}Store`]
 store.getState().refreshFormalProjects()
 const project = store.getState().projects.find(p => p.versions.some(v => ['projectEstimate', 'projectBudget'].includes(v.budgetType)) && get('src/lib/hrProjectRegistry.ts').canAccessHrProject(p, true))
 assert.ok(project, `${kind}: editable fixture`)
 const read = () => store.getState().projects.find(p => p.id === project.id)
 const initial = read().versions.find(v => ['projectEstimate', 'projectBudget'].includes(v.budgetType))
 const budgetType = initial.budgetType
 const countBeforeCreate = read().versions.length
 const activeBeforeCreate = read().versions.filter(v => v.isActive).map(v => v.id)
 if (kind === 'Machine') store.getState().addVersion(project.id, initial.budgetType, { projectLevel: initial.projectLevel, levelCoefficient: initial.levelCoefficient, hrModelVersion: initial.hrModelVersion, milestones: initial.milestones })
 else store.getState().addVersion(project.id, { budgetType: initial.budgetType, milestones: initial.milestones, departmentInvestments: initial.departmentInvestments, projectStartTime: initial.projectStartTime, projectEndTime: initial.projectEndTime })
 assert.equal(read().versions.length, countBeforeCreate + 1, `${kind}: creates version`)
 assert.equal(read().versions.at(-1).isActive, false, `${kind}: new version is inactive`)
 assert.deepEqual(read().versions.filter(v => v.isActive).map(v => v.id), activeBeforeCreate, `${kind}: creation preserves activation`)

 store.getState().copyVersion(project.id, initial.id)
 store.getState().copyVersion(project.id, initial.id)
 const versions = read().versions.filter(v => v.budgetType === budgetType)
 const second = versions.at(-2), third = versions.at(-1)
 assert.equal(second.isActive, false)
 assert.equal(third.isActive, false)
 const otherBefore = structuredClone(read().versions.filter(v => v.budgetType !== budgetType).map(v => [v.id, v.isActive]))
 store.getState().setVersionActive(project.id, second.id, true)
 assert.equal(rules.getActiveHrVersion(read().versions, budgetType).id, second.id)
 store.getState().setVersionActive(project.id, third.id, true)
 assert.equal(read().versions.find(v => v.id === second.id).isActive, false)
 assert.deepEqual(read().versions.filter(v => v.budgetType !== budgetType).map(v => [v.id, v.isActive]), otherBefore)
 store.getState().setVersionActive(project.id, third.id, false)
 await store.persist.rehydrate()
 assert.equal(rules.getActiveHrVersion(read().versions, budgetType), undefined, `${kind}: clear survives reload`)
 assert.equal(read()[budgetType], 0)
 store.getState().updateVersion(project.id, initial.id, { batch: 7 })
 assert.equal(read().versions.find(v => v.id === initial.id).batch, 7, `${kind}: unlocked history edits`)
 const monthly = store.getState().monthlyInvestments.find(row => row.versionId === initial.id && !row.isArchived)
 assert.ok(monthly, `${kind}: historical monthly rows retained`)
 store.getState().updateMonthlyInvestment(monthly.id, { '2035-01': 123.4 })
 store.getState().setVersionLocked(project.id, initial.id, true)
 const frozen = structuredClone(read().versions.find(v => v.id === initial.id))
 const frozenRows = structuredClone(store.getState().monthlyInvestments.filter(row => row.versionId === initial.id))
 store.getState().updateVersion(project.id, initial.id, { batch: 8, estimatedInvestment: 999, milestones: { conceptStart: '2099-01-01' }, nonLaborInvestment: { items: [], startMonth: '', endMonth: '' } })
 store.getState().deleteVersion(project.id, initial.id)
 store.getState().updateMonthlyInvestment(monthly.id, { '2035-01': 8 })
 if (store.getState().updateVersionDepartmentInvestments) store.getState().updateVersionDepartmentInvestments(project.id, initial.id, [])
 store.getState().refreshFormalProjects()
 await store.persist.rehydrate()
 assert.deepEqual(read().versions.find(v => v.id === initial.id), frozen, `${kind}: locked snapshot frozen`)
 assert.deepEqual(store.getState().monthlyInvestments.filter(row => row.versionId === initial.id), frozenRows, `${kind}: locked monthly snapshot frozen`)
 store.getState().setVersionActive(project.id, initial.id, true)
 assert.equal(rules.getActiveHrVersion(read().versions, budgetType).id, initial.id, `${kind}: locked activation allowed`)
 const sourceBeforeCopy = structuredClone(read().versions.find(v => v.id === initial.id))
 store.getState().copyVersion(project.id, initial.id)
 const copy = read().versions.at(-1)
 assert.equal(copy.copiedFromVersionId, initial.id)
 assert.equal(copy.copiedFromVersionNumber, initial.versionNumber)
 assert.equal(copy.batch, 7)
 assert.equal(copy.lockState, 'unlocked')
 assert.equal(copy.isActive, false)
 assert.deepEqual(copy.operationLogs, [])
 assert.deepEqual(read().versions.find(v => v.id === initial.id), sourceBeforeCopy, 'copy never mutates source logs')
 const copyMonthly = store.getState().monthlyInvestments.find(row => row.versionId === copy.id && row.isEdited)
 assert.deepEqual(copyMonthly.monthlyData, { '2035-01': 123.4 })
 assert.notEqual(copyMonthly.monthlyData, store.getState().monthlyInvestments.find(row => row.id === monthly.id).monthlyData)
 assert.notEqual(copy.nonLaborInvestment, read().versions.find(v => v.id === initial.id).nonLaborInvestment)
 store.getState().refreshFormalProjects()
 assert.deepEqual(store.getState().monthlyInvestments.find(row => row.id === copyMonthly.id).monthlyData, { '2035-01': 123.4 }, 'copy allocation survives sync')
 store.getState().setVersionLocked(project.id, initial.id, false)
 store.getState().updateVersion(project.id, initial.id, { batch: 9 })
 assert.equal(read().versions.find(v => v.id === initial.id).batch, 9)
 // Freeze the actual newest version and change its dependencies, not only a historical row.
 const latestId = read().versions.at(-1).id
 store.getState().setVersionLocked(project.id, latestId, true)
 const latestFrozen = structuredClone(read().versions.at(-1))
 const config = get('src/stores/hrConfig.ts').useHrConfigStore
 const configBefore = structuredClone(config.getState().data)
 config.setState({ data: { ...configBefore, hrModel: [] } })
 const plans = get(kind === 'Technical' ? 'src/stores/technicalPlan.ts' : 'src/stores/plan.ts')[kind === 'Technical' ? 'useTechnicalPlanStore' : 'usePlanStore']
 const planBefore = plans.getState()
 const shiftDates = value => Array.isArray(value) ? value.map(shiftDates) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, field]) => [key, ['planStartDate', 'planEndDate'].includes(key) && typeof field === 'string' && field ? '2099-01-01' : shiftDates(field)])) : value
 plans.setState(shiftDates(planBefore))
 store.getState().refreshFormalProjects()
 await store.persist.rehydrate()
 assert.deepEqual(read().versions.find(v => v.id === latestId), latestFrozen, `${kind}: latest lock rejects model/config refresh`)
 store.getState().copyVersion(project.id, latestId)
 const dependencyCopy = structuredClone(read().versions.at(-1))
 store.getState().refreshFormalProjects()
 await store.persist.rehydrate()
 assert.deepEqual(read().versions.find(v => v.id === dependencyCopy.id), dependencyCopy, `${kind}: copied snapshot survives changed dependencies and reload`)
 assert.deepEqual(read().versions.find(v => v.id === latestId), latestFrozen, `${kind}: copying with changed dependencies leaves source intact`)
 if (kind === 'Machine') {
   store.getState().updateVersion(project.id, dependencyCopy.id, { projectLevel: dependencyCopy.projectLevel, hrModelVersion: dependencyCopy.hrModelVersion, levelCoefficient: dependencyCopy.levelCoefficient, batch: 4 })
   assert.equal(read().versions.find(v => v.id === dependencyCopy.id).estimatedInvestment, dependencyCopy.estimatedInvestment, 'unrelated save with unchanged model fields preserves snapshot')
 }
 config.setState({ data: configBefore })
 plans.setState(planBefore)
 if (kind === 'Machine') {
   const coefficient = dependencyCopy.levelCoefficient + 1
   store.getState().updateVersion(project.id, dependencyCopy.id, { levelCoefficient: coefficient })
   const edited = structuredClone(read().versions.find(v => v.id === dependencyCopy.id))
   assert.notEqual(edited.estimatedInvestment, dependencyCopy.estimatedInvestment, 'explicit model option change recalculates')
   assert.equal(edited.levelCoefficient, coefficient)
   store.getState().refreshFormalProjects()
   await store.persist.rehydrate()
   assert.deepEqual(read().versions.find(v => v.id === dependencyCopy.id), edited, 'explicitly recaptured copied snapshot survives refresh')
 }

 const protectedState = structuredClone(read())
 registry.setState({ currentLoginUser: 'unknown' })
 store.getState().setVersionActive(project.id, third.id, true)
 store.getState().setVersionLocked(project.id, initial.id, true)
 store.getState().copyVersion(project.id, initial.id)
 store.getState().deleteVersion(project.id, initial.id)
 store.getState().updateVersion(project.id, initial.id, { batch: 20 })
 assert.deepEqual(read(), protectedState, `${kind}: actor permissions cover all writes`)
 registry.setState({ currentLoginUser: actor })
 const bound = store.getState().projects.find(p => get('src/lib/hrProjectRegistry.ts').getHrRegistryProject(p)?.boundFormalProjectId && p.versions.length)
 if (bound) {
   const before = structuredClone(bound), id = bound.versions[0].id
   store.getState().setVersionActive(bound.id, id, true)
   store.getState().setVersionLocked(bound.id, id, true)
   store.getState().copyVersion(bound.id, id)
   store.getState().updateVersion(bound.id, id, { batch: 20 })
   assert.deepEqual(store.getState().projects.find(p => p.id === bound.id), before, `${kind}: bound source protected`)
 }
 console.log(`PASS ${kind}: active/clear/reload, history edit, lock/write/sync, copy isolation/monthly, permissions`)
}
