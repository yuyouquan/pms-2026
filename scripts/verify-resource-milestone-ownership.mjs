import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'

globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = { localStorage }
const load = createTypeScriptModuleLoader(), get = file => load(path.resolve(file))
const registry = get('src/stores/project.ts').useProjectStore
const tos = get('src/stores/hrTos.ts').useHrTosStore
const { resolveHrFormalSource } = get('src/lib/hrFormalProjectSource.ts')
const { mergeHrFormalMilestones } = get('src/lib/hrMilestoneOwnership.ts')
const { TOS_MILESTONE_FIELDS } = get('src/constants/hrTos.ts')
assert.deepEqual(TOS_MILESTONE_FIELDS.map(field => field.label), ['规划KO', 'CDCP', '概念启动', 'STR1', 'STR2', 'STR3', 'STR4', 'STR4A', 'STR5', '上市迭代结束', '维护结束'])
const formal = registry.getState().projects.find(project => project.type === 'tOS版本项目' && project.projectAttribute === 'formal')
const budget = registry.getState().projects.find(project => project.id === 'mock-budget-tos-unbound')
assert.ok(formal && budget)
tos.getState().refreshFormalProjects()
const record = id => tos.getState().projects.find(project => project.pmsProjectId === id)
const latest = id => record(id).versions.at(-1)
const source = resolveHrFormalSource('tos', null, formal.id)
for (const key of ['cdcp', 'str2', 'str4', 'str4a']) assert.ok(source.milestones[key], `published ${key} is sourced`)
assert.equal(source.milestones.marketIteration, null)
assert.equal(source.milestones.maintenanceEnd, null)
const manual = { marketIteration: '2031-10-01', maintenanceEnd: '2032-06-01' }
const changed = { marketIteration: '2032-10-01', maintenanceEnd: '2033-06-01' }
const departments = [{ id: 'date-owner-dept', primaryDepartment: '研发中心', secondaryDepartment: '产品部', estimatedInvestment: 21, planningPhase: 1, conceptPhase: 2, planningPhase2: 3, developmentValidationPhase: 4, marketIterationPhase: 5, maintenancePhase: 6 }]
const before = structuredClone(record(formal.id).versions)
tos.getState().addVersion(record(formal.id).id, { budgetType: 'projectBudget', milestones: { ...manual, str2: '2040-01-01' }, departmentInvestments: departments })
assert.equal(record(formal.id).versions.length, before.length + 1)
assert.deepEqual(record(formal.id).versions.slice(0, -1), before)
for (const [key, value] of Object.entries(manual)) assert.equal(latest(formal.id).milestones[key], value, 'creation saves manual formal end dates')
assert.equal(latest(formal.id).milestones.str2, source.milestones.str2)
tos.getState().updateVersion(record(formal.id).id, latest(formal.id).id, { milestones: { ...changed, cdcp: '2040-01-01', str4a: '2040-01-02' } })
tos.getState().refreshFormalProjects()
await tos.persist.rehydrate()
for (const [key, value] of Object.entries(changed)) assert.equal(latest(formal.id).milestones[key], value, 'refresh and reload preserve manual ends')
assert.equal(latest(formal.id).milestones.cdcp, source.milestones.cdcp)
assert.equal(latest(formal.id).milestones.str4a, source.milestones.str4a)
const originalId = latest(formal.id).id
tos.getState().copyVersion(record(formal.id).id, originalId)
tos.getState().setVersionLocked(record(formal.id).id, originalId, true)
assert.notEqual(latest(formal.id).id, originalId)
for (const [key, value] of Object.entries(changed)) assert.equal(latest(formal.id).milestones[key], value, 'copy inherits manual ends')
tos.getState().updateVersion(record(formal.id).id, originalId, { milestones: manual })
for (const [key, value] of Object.entries(changed)) assert.equal(record(formal.id).versions.find(version => version.id === originalId).milestones[key], value, 'locked historical end dates are immutable')
tos.getState().updateVersion(record(formal.id).id, latest(formal.id).id, { milestones: { marketIteration: null, maintenanceEnd: null } })
tos.getState().refreshFormalProjects()
assert.equal(latest(formal.id).milestones.marketIteration, null, 'clearing is not undone by synchronization')
assert.equal(latest(formal.id).milestones.maintenanceEnd, null)
const planChange = mergeHrFormalMilestones('tos', { ...source.milestones, str2: '2034-04-01', marketIteration: '2099-01-01' }, manual)
assert.equal(planChange.str2, '2034-04-01')
assert.equal(planChange.marketIteration, manual.marketIteration)
const budgetDates = { ...manual, cdcp: '2030-02-01', str2: '2030-04-01', str4: '2030-06-01', str4a: '2030-07-01' }
tos.getState().addVersion(record(budget.id).id, { budgetType: 'annual', milestones: budgetDates, departmentInvestments: departments })
registry.setState({ projects: registry.getState().projects.map(project => project.id === budget.id ? { ...project, boundFormalProjectId: formal.id } : project) })
tos.getState().refreshFormalProjects()
await tos.persist.rehydrate()
for (const [key, value] of Object.entries(budgetDates)) assert.equal(latest(budget.id).milestones[key], value, 'binding leaves all budget dates independent')
const noPermissionBefore = structuredClone(record(formal.id).versions)
registry.setState({ currentLoginUser: 'unknown' })
tos.getState().updateVersion(record(formal.id).id, latest(formal.id).id, { milestones: manual })
assert.deepEqual(record(formal.id).versions, noPermissionBefore, 'date exceptions do not bypass permission guards')
console.log('PASS: tOS added plan milestones and manual endings create/edit/clear/copy/history/bind/reload/permission rules')
