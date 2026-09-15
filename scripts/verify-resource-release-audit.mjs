import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader, resolveTypeScriptModule } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'
globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = { localStorage }
const load = createTypeScriptModuleLoader(), get = file => load(path.resolve(file))
const React = load(resolveTypeScriptModule('react'))
const { renderToStaticMarkup } = load(resolveTypeScriptModule('react-dom/server'))
const Notice = get('src/components/hr-shared/MonthlyAllocationNotice.tsx').default
const capability = get('src/stores/hrCapability.ts').useHrCapabilityStore
capability.getState().refreshFormalProjects()
const p = capability.getState().projects.find(p => p.pmsProjectId === 'mock-budget-capability-unbound')
const department = { id: 'release-department', primaryDepartment: '研发中心', secondaryDepartment: '软件部', estimatedInvestment: 12 }
capability.getState().addVersion(p.id, { budgetType: 'annual', projectStartTime: '2027-01-01', projectEndTime: '2027-02-28', departmentInvestments: [department] })
const v = capability.getState().projects.find(row => row.id === p.id).versions.at(-1)
const monthly = () => capability.getState().monthlyInvestments.find(row => row.versionId === v.id && !row.isArchived)
capability.getState().updateMonthlyInvestment(monthly().id, { '2027-01': 8, '2027-02': 4 })
capability.getState().updateVersionDepartmentInvestments(p.id, v.id, [{ ...department, estimatedInvestment: 6 }])
await capability.persist.rehydrate()
assert.equal(monthly().estimatedTotal, 6)
assert.deepEqual(monthly().monthlyData, { '2027-01': 8, '2027-02': 4 }, 'never discard manual allocation')
const markup = records => renderToStaticMarkup(React.createElement(Notice, { records }))
assert.match(markup([monthly()]), /超出预估 6 人月/, 'lowering investment must expose the excess after reload')
assert.match(markup([monthly(), { estimatedTotal: 6, monthlyData: {} }]), /超出预估 6 人月/, 'underallocation on another row cannot cancel excess')
assert.match(markup([monthly(), { estimatedTotal: 6, monthlyData: {} }]), /6 人月待分配/)
assert.equal(markup([{ estimatedTotal: 0.3, monthlyData: { Jan: 0.1, Feb: 0.2 } }]), '')
console.log('PASS: manual allocation excess remains visible after total changes and reload')

const machine = get('src/stores/hrMachine.ts').useHrMachineStore
const config = get('src/stores/hrConfig.ts').useHrConfigStore
const { calcMachineDepartmentInvestments } = get('src/constants/hrConfig.ts')
machine.getState().refreshFormalProjects()
const mp = machine.getState().projects.find(p => p.pmsProjectId === 'mock-budget-machine-unbound')
const meta = { projectLevel: 'S', levelCoefficient: 1, hrModelVersion: 'V2026.1' }
machine.getState().addVersion(mp.id, 'annual', meta)
const versions = () => machine.getState().projects.find(p => p.id === mp.id).versions
const first = structuredClone(versions().at(-1))
machine.getState().addVersion(mp.id, 'annual', meta)
const configRow = config.getState().data.hrModel.find(row => row.projectLevel === 'S' && row.modelVersion === 'V2026.1')
config.getState().updateRecord('hrModel', configRow.id, { conceptToStr1: Number(configRow.conceptToStr1) + 10 })
machine.getState().refreshFormalProjects()
await machine.persist.rehydrate()
const history = versions().find(v => v.id === first.id), latest = versions().at(-1)
assert.deepEqual(history, first, 'model changes never mutate history')
assert.ok(history.modelSnapshot, 'each created version saves its model details')
const total = version => calcMachineDepartmentInvestments(version.modelSnapshot, version.projectLevel, version.hrModelVersion, version.levelCoefficient).reduce((sum, row) => sum + row.estimatedTotal, 0)
assert.equal(total(history), first.estimatedInvestment)
assert.equal(total(latest), latest.estimatedInvestment)
assert.equal(latest.estimatedInvestment, first.estimatedInvestment + 10)
config.getState().toggleRecordStatus('hrModel', configRow.id, false)
machine.getState().refreshFormalProjects()
assert.deepEqual(versions().find(v => v.id === first.id), first, 'retiring the model retains historical details')
console.log('PASS: model edits and retirement update latest only and preserve historical department snapshots')
