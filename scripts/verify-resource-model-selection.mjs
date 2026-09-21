import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'

globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = { localStorage }
const load = createTypeScriptModuleLoader(), get = file => load(path.resolve(file))
const cfg = get('src/constants/hrConfig.ts')
const records = cfg.MOCK_CONFIG_DATA.hrModel
assert.ok(!cfg.getConfigModelVersions(records, 'S').includes('V2025.4'))
assert.ok(!cfg.getConfigModelVersions(records, 'C').includes('V2026.1'))
assert.deepEqual(cfg.getConfigModelVersions(records, ''), [])
assert.deepEqual(cfg.getConfigModelVersions(records, 'unknown'), [])
const invalid = [
  ...records,
  { ...records[0], id: 'disabled', modelVersion: 'disabled', enabled: false },
  { ...records[0], id: 'partial-valid', modelVersion: 'partial' },
  { id: 'partial-legacy', projectLevel: 'S', modelVersion: 'partial', enabled: true, conceptPhase: 10 },
]
assert.ok(!cfg.getConfigModelVersions(invalid, 'S').includes('disabled'))
assert.ok(!cfg.getConfigModelVersions(invalid, 'S').includes('partial'))
for (const level of ['S', 'A', 'B', 'C', 'D']) {
  assert.ok(cfg.getConfigModelVersions(records, level).length >= 3, `${level}: multiple compatible versions`)
  for (const version of ['V2026.2', 'V2026.3']) {
    const departments = records.filter(r => r.projectLevel === level && r.modelVersion === version)
    assert.equal(departments.length, 3)
    assert.ok(cfg.isHrModelAvailable(records, level, version))
    assert.ok(cfg.calcEstimatedInvestment(records, level, version, 1) > 0)
  }
}
console.log('PASS model options: level-specific, enabled, complete models; five levels with multiple versions/departments')

// Existing config receives new demo version groups exactly once; never replace custom edits or revive deleted rows.
const original = records.filter(r => !cfg.ADDITIONAL_MOCK_HR_MODELS.some(n => n.id === r.id))
const custom = { ...original[0], id: 'custom-model', modelVersion: 'V2026.2', conceptToStr1: 123 }
const previous = { ...cfg.MOCK_CONFIG_DATA, hrModel: [{ ...original[0], conceptToStr1: 77, enabled: false }, ...original.slice(1), custom] }
localStorage.setItem('pms-hr-config', JSON.stringify({ state: { data: previous }, version: 2 }))
const configStore = get('src/stores/hrConfig.ts').useHrConfigStore
assert.deepEqual(configStore.getState().data.hrModel.find(r => r.id === original[0].id), previous.hrModel[0])
assert.deepEqual(configStore.getState().data.hrModel.filter(r => r.modelVersion === 'V2026.2'), [custom], 'existing custom version group preserved')
assert.equal(configStore.getState().data.hrModel.filter(r => r.modelVersion === 'V2026.3').length, 15)
assert.equal(JSON.parse(localStorage.getItem('pms-hr-config')).version, 3)
const migrated = structuredClone(configStore.getState().data)
const deleted = migrated.hrModel.find(r => r.modelVersion === 'V2026.3').id
configStore.setState({ data: { ...migrated, hrModel: migrated.hrModel.filter(r => r.id !== deleted) } })
await configStore.persist.rehydrate()
assert.ok(!configStore.getState().data.hrModel.some(r => r.id === deleted), 'reload does not resurrect deleted fixture')
assert.deepEqual(cfg.supplementMachineModelFixtures([custom]), [custom], 'custom-only data never seeded')
assert.deepEqual(cfg.supplementMachineModelFixtures([]), [])
configStore.setState({ data: structuredClone(cfg.MOCK_CONFIG_DATA) })
console.log('PASS migration: edited/disabled/custom config preserved, new version groups seeded once, deletion preserved')

const store = get('src/stores/hrMachine.ts').useHrMachineStore
store.getState().refreshFormalProjects()
const project = store.getState().projects.find(p => p.id.includes('mock-budget-machine-unbound'))
assert.ok(project)
const id = store.getState().createResourceVersion(project.id, 'annual', project.pmsProjectId, { versionNumber: '等级模型联动验证', sourceVersionId: project.versions.at(-1).id })
const currentProject = () => store.getState().projects.find(p => p.id === project.id)
const version = () => currentProject().versions.find(v => v.id === id)
const edit = patch => store.getState().updateVersionInline(project.id, id, patch, project.pmsProjectId)
edit({ type: 'model', key: 'projectLevel', value: 'S' })
edit({ type: 'model', key: 'hrModelVersion', value: 'V2026.1' })
edit({ type: 'model', key: 'projectLevel', value: 'C' })
assert.equal(version().projectLevel, 'C')
assert.equal(version().hrModelVersion, 'V2025.4', 'switching grade chooses compatible version atomically')
assert.ok(version().modelSnapshot.every(r => r.projectLevel === 'C' && r.modelVersion === 'V2025.4'))
assert.equal(version().estimatedInvestment, cfg.calcEstimatedInvestment(records, 'C', 'V2025.4', version().levelCoefficient))
const log = currentProject().resourceOperationLogs.find(log => log.versionId === id && log.changes.some(c => c.field === '项目等级' && c.after === 'C'))
assert.ok(log.changes.some(c => c.field.includes('项目等级') && c.before === 'S' && c.after === 'C'))
assert.ok(log.changes.some(c => c.before === 'V2026.1' && c.after === 'V2025.4'))
edit({ type: 'model', key: 'hrModelVersion', value: 'V2026.2' })
edit({ type: 'model', key: 'projectLevel', value: 'S' })
assert.equal(version().hrModelVersion, 'V2026.2', 'compatible selection retained')
const monthly = store.getState().monthlyInvestments.filter(r => r.versionId === id && !r.isArchived)
assert.equal(monthly.length, 3)
assert.equal(Math.round(monthly.reduce((n, r) => n + r.estimatedTotal, 0) * 10), Math.round(version().estimatedInvestment * 10))
assert.ok(monthly.every(r => !r.isEdited))
let before = JSON.stringify(store.getState())
assert.throws(() => edit({ type: 'model', key: 'projectLevel', value: 'unknown' }), /暂无可用/)
assert.throws(() => edit({ type: 'model', key: 'hrModelVersion', value: 'V2025.4' }), /有效/)
assert.equal(JSON.stringify(store.getState()), before, 'invalid combination changes no version, log or monthly data')
await store.persist.rehydrate()
assert.equal(version().hrModelVersion, 'V2026.2')
store.getState().setVersionLocked(project.id, id, true)
before = JSON.stringify(store.getState())
assert.throws(() => edit({ type: 'model', key: 'projectLevel', value: 'A' }), /不可编辑/)
assert.equal(JSON.stringify(store.getState()), before)
console.log('PASS resource editing: atomic grade/model switch, retained compatible version, snapshots, audit, monthly sync, invalid/locked guards and reload')
