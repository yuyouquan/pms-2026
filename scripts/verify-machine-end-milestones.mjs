import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'

globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = { localStorage }
const load = createTypeScriptModuleLoader(), get = file => load(path.resolve(file))
const registry = get('src/stores/project.ts').useProjectStore
const machine = get('src/stores/hrMachine.ts').useHrMachineStore
const { resolveHrFormalSource } = get('src/lib/hrFormalProjectSource.ts')
const { RESOURCE_FORMAL_IDS } = get('src/mock/projectRegistry.ts')
const formalId = RESOURCE_FORMAL_IDS.machine
const budgetId = 'mock-budget-machine-unbound'
machine.getState().refreshFormalProjects()
const record = id => machine.getState().projects.find(project => project.pmsProjectId === id)
const latest = id => record(id).versions.at(-1)
const model = { projectLevel: 'A', levelCoefficient: 1, hrModelVersion: 'V2026.1' }
const manual = { productLaunch: '2030-10-01', lifecycleEnd: '2031-02-01' }
const edited = { productLaunch: '2031-10-01', lifecycleEnd: '2032-02-01' }
const before = structuredClone(record(formalId).versions)
machine.getState().addVersion(record(formalId).id, 'projectBudget', { ...model, milestones: { ...manual, str2: '2099-01-01' } })
assert.equal(record(formalId).versions.length, before.length + 1)
assert.deepEqual(record(formalId).versions.slice(0, -1), before)
for (const [key, value] of Object.entries(manual)) assert.equal(latest(formalId).milestones[key], value, 'formal version creation retains manual ending dates')
const source = resolveHrFormalSource('machine', null, formalId)
assert.equal(latest(formalId).milestones.str2, source.milestones.str2)
assert.equal(source.milestones.productLaunch, null)
assert.equal(source.milestones.lifecycleEnd, null)
machine.getState().updateVersion(record(formalId).id, latest(formalId).id, { milestones: { ...edited, str2: '2099-02-01' } })
machine.getState().refreshFormalProjects()
await machine.persist.rehydrate()
for (const [key, value] of Object.entries(edited)) assert.equal(latest(formalId).milestones[key], value, 'refresh/reload retains manual endings')
assert.equal(latest(formalId).milestones.str2, source.milestones.str2)
const historyId = latest(formalId).id
machine.getState().addVersion(record(formalId).id, 'projectBudget', model)
for (const [key, value] of Object.entries(edited)) assert.equal(latest(formalId).milestones[key], value, 'new version inherits previous manual dates')
machine.getState().updateVersion(record(formalId).id, historyId, { milestones: manual })
for (const [key, value] of Object.entries(edited)) assert.equal(record(formalId).versions.find(v => v.id === historyId).milestones[key], value, 'historical dates stay immutable')
machine.getState().updateVersion(record(formalId).id, latest(formalId).id, { milestones: { productLaunch: null, lifecycleEnd: null } })
machine.getState().refreshFormalProjects()
assert.equal(latest(formalId).milestones.productLaunch, null)
assert.equal(latest(formalId).milestones.lifecycleEnd, null)
machine.getState().addVersion(record(budgetId).id, 'annual', { ...model, milestones: { ...manual, str2: '2030-02-01' } })
registry.setState({ projects: registry.getState().projects.map(p => p.id === budgetId ? { ...p, boundFormalProjectId: formalId } : p) })
machine.getState().refreshFormalProjects()
await machine.persist.rehydrate()
for (const [key, value] of Object.entries(manual)) assert.equal(latest(budgetId).milestones[key], value, 'binding leaves budget endings independent')
assert.equal(latest(budgetId).milestones.str2, '2030-02-01')
const immutable = structuredClone(record(formalId).versions)
registry.setState({ currentLoginUser: 'unknown' })
machine.getState().updateVersion(record(formalId).id, latest(formalId).id, { milestones: manual })
assert.deepEqual(record(formalId).versions, immutable)
assert.deepEqual(get('src/constants/hrMachine.ts').MILESTONE_FIELDS.map(f => f.label), ['概念启动','STR1','STR2','STR3','STR4','STR4A','STR5','上市结束','生命周期结束'])
console.log('PASS: machine manual endings create/edit/clear/inherit/history/bind/reload/permissions')

const { calcDepartmentMonthlySplit } = get('src/constants/hrConfig.ts')
const rows = [{ id: 'lifecycle-only', projectLevel: 'S', modelVersion: 'TEST', primaryDepartment: '研发中心', secondaryDepartment: '软件部', lifecycle: 10 }]
const split = dates => calcDepartmentMonthlySplit(rows, 'S', 'TEST', 1, { conceptStart: null, str1: null, str3: null, str4: null, str5: null, productLaunch: '2030-01-01', ...dates })[0]
assert.deepEqual(split({ lifecycleEnd: '2030-01-31' }).monthlyData, { '2030-01': 10 }, 'explicit ending controls monthly lifecycle allocation')
assert.deepEqual(split({ lifecycleEnd: null }).monthlyData, {}, 'clearing new ending leaves lifecycle unallocated')
assert.deepEqual(split({ lifecycleEnd: '2029-12-01' }).monthlyData, {}, 'inverted dates do not allocate lifecycle investment')
const legacy = split({}).monthlyData
assert.equal(Object.keys(legacy).at(-1), '2030-06', 'legacy dates retain their 180-day calculation')
assert.equal(Math.round(Object.values(legacy).reduce((a,b) => a+b, 0)*10), 100)
assert.equal(split({ lifecycleEnd: null }).estimatedTotal, 10, 'unallocated investment is preserved in total')
console.log('PASS: lifecycle monthly split uses manual ending and retains legacy compatibility')

registry.setState({ currentLoginUser: get('src/stores/project.ts').DEFAULT_LOGIN_USER })
const config = get('src/stores/hrConfig.ts').useHrConfigStore
config.setState({ data: { ...config.getState().data, hrModel: [{ ...rows[0], projectLevel: source.projectLevel }] } })
const legacyVersion = structuredClone(latest(formalId))
// Legacy records predate per-version model snapshots as well as explicit lifecycle endings.
delete legacyVersion.modelSnapshot
legacyVersion.projectLevel = source.projectLevel
legacyVersion.hrModelVersion = 'TEST'
legacyVersion.levelCoefficient = 1
legacyVersion.milestones.productLaunch = '2030-01-01'
delete legacyVersion.milestones.lifecycleEnd
machine.setState({ projects: machine.getState().projects.map(p => p.pmsProjectId === formalId
  ? { ...p, versions: p.versions.map(v => v.id === legacyVersion.id ? legacyVersion : v) } : p), monthlyInvestments: [] })
const legacyAllocation = machine.getState().calculateMonthlySplit(legacyVersion)[0].monthlyData
for (const operation of ['refresh', 'reload']) {
  if (operation === 'refresh') machine.getState().refreshFormalProjects()
  else await machine.persist.rehydrate()
  assert.equal(latest(formalId).milestones.lifecycleEnd, undefined, `${operation} preserves legacy missing ending`)
  assert.deepEqual(machine.getState().monthlyInvestments.find(row => row.versionId === legacyVersion.id).monthlyData, legacyAllocation, `${operation} preserves legacy monthly allocation`)
}
machine.getState().addVersion(record(formalId).id, 'projectBudget', { ...model, hrModelVersion: 'TEST', milestones: { lifecycleEnd: undefined } })
assert.notEqual(latest(formalId).id, legacyVersion.id)
assert.equal(latest(formalId).milestones.lifecycleEnd, null, 'new versions explicitly initialize ending, including legacy seeds')
assert.deepEqual(machine.getState().monthlyInvestments.find(row => row.versionId === latest(formalId).id).monthlyData, {}, 'new empty ending does not use the legacy allocation')
console.log('PASS: formal legacy allocation survives refresh/reload; new versions use explicit endings')
