#!/usr/bin/env node
import assert from 'node:assert/strict'
import { loadTypeScriptModule, projectRoot } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const memory = new Map()
globalThis.localStorage = {
  getItem: key => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value),
  removeItem: key => memory.delete(key),
}
const load = relative => loadTypeScriptModule(root, relative)
let assertions = 0
const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions += 1 }
const { useHrConfigStore: store } = load('src/stores/hrConfig.ts')
const original = store.getState().data
const seed = [
  { id: 'v1-s-rd', modelVersion: 'V1', projectLevel: 'S', primaryDepartment: '研发中心', secondaryDepartment: '软件部', enabled: true },
  { id: 'v1-a-qa', modelVersion: 'V1', projectLevel: 'A', primaryDepartment: '质量中心', secondaryDepartment: '测试部', enabled: true },
  { id: 'v2-s-rd', modelVersion: 'V2', projectLevel: 'S', primaryDepartment: '研发中心', secondaryDepartment: '软件部', enabled: true },
  { id: 'no-version-1', modelVersion: '', projectLevel: 'S', enabled: true },
  { id: 'no-version-2', modelVersion: '', projectLevel: 'A', enabled: true },
]
store.setState({ data: { ...original, hrModel: structuredClone(seed) } })
let updates = 0
const unsubscribe = store.subscribe(() => { updates += 1 })
store.getState().toggleRecordStatus('hrModel', 'v1-s-rd')
eq(store.getState().data.hrModel.map(record => record.enabled), [false, false, true, true, true], 'disabling one model row disables every level and department of only that version')
eq(updates, 1, 'a version toggle is one atomic store update')
store.getState().toggleRecordStatus('hrModel', 'v1-a-qa')
eq(store.getState().data.hrModel.map(record => record.enabled), [true, true, true, true, true], 'enable restores every row of the selected version')
store.getState().toggleRecordStatus('hrModel', 'no-version-1')
eq(store.getState().data.hrModel.slice(3).map(record => record.enabled), [false, true], 'empty model versions never form a batch')
store.getState().toggleRecordStatus('hrModel', 'v1-s-rd')
store.getState().addRecord('hrModel', { modelVersion: 'V1', projectLevel: 'B', primaryDepartment: '研发中心', secondaryDepartment: '产品部' })
eq(store.getState().data.hrModel.at(-1).enabled, false, 'adding to a disabled version inherits its group status')
store.getState().updateRecord('hrModel', 'v2-s-rd', { modelVersion: 'V1', projectLevel: 'C' })
eq(store.getState().data.hrModel.find(record => record.id === 'v2-s-rd').enabled, false, 'moving a row into an existing version inherits target status')
store.getState().updateRecord('hrModel', 'v2-s-rd', { modelVersion: 'V3', projectLevel: 'C' })
eq(store.getState().data.hrModel.find(record => record.id === 'v2-s-rd').enabled, false, 'moving to a new version retains the row status')
store.getState().updateRecord('hrModel', 'v1-s-rd', { conceptPhase: 2.5 })
eq(store.getState().data.hrModel.find(record => record.id === 'v1-s-rd').enabled, false, 'editing model fields retains group status')
store.getState().importRecords('hrModel', [
  { id: 'import-v1', modelVersion: 'V1', projectLevel: 'D', enabled: true },
  { id: 'import-v4-first', modelVersion: 'V4', projectLevel: 'A', enabled: false },
  { id: 'import-v4-second', modelVersion: 'V4', projectLevel: 'B', enabled: true },
])
eq(store.getState().data.hrModel.slice(-3).map(record => record.enabled), [false, false, false], 'imports inherit existing and earlier imported version status')
eq(seed.every(record => store.getState().data.hrModel.some(current => current.id === record.id)), true, 'all preexisting model records survive model changes and imports')
store.setState({ data: { ...store.getState().data, tosPhaseRatio: [{ id: 'other-1', modelVersion: 'V1', enabled: true }, { id: 'other-2', modelVersion: 'V1', enabled: true }] } })
store.getState().toggleRecordStatus('tosPhaseRatio', 'other-1')
eq(store.getState().data.tosPhaseRatio.map(record => record.enabled), [false, true], 'other modules retain single row toggle semantics')
unsubscribe()

const { createHrDepartmentOptions } = load('src/lib/hrDepartments.ts')
const configRecords = [
  { primaryDepartment: '研发中心', secondaryDepartment: '软件部', enabled: false },
  { primaryDepartment: '研发中心', secondaryDepartment: '软件部' },
  { primaryDepartment: '研发中心', secondaryDepartment: '产品部' },
  { primaryDepartment: '市场中心', secondaryDepartment: '产品部' },
  { secondaryDepartment: '二级映射', tertiaryDepartment: '三级映射' },
  { primaryDepartment: '空部门', secondaryDepartment: ' ' },
  { primaryDepartment: '', secondaryDepartment: '孤立部门' },
]
const projectGroups = [
  [{ versions: [{ departmentInvestments: [{ primaryDepartment: '历史部门', secondaryDepartment: '旧团队' }] }, { departmentInvestments: [{ primaryDepartment: '研发中心', secondaryDepartment: '测试部' }] }] }],
  [{ versions: [{ departmentInvestments: [{ primaryDepartment: '技术中心', secondaryDepartment: '预研部' }, { primaryDepartment: '研发中心', secondaryDepartment: '软件部' }] }] }],
  [{ versions: [{ departmentInvestments: [{ primaryDepartment: '能力中心', secondaryDepartment: '培训部' }] }] }],
]
const options = createHrDepartmentOptions(configRecords, projectGroups)
eq(options.primaryOptions.map(option => option.value), ['研发中心', '市场中心', '历史部门', '技术中心', '能力中心'], 'options preserve observed primary order, history and disabled values with stable deduplication')
eq(options.getSecondaryOptions('研发中心').map(option => option.value), ['软件部', '产品部', '测试部'], 'secondary options combine exact pairs across all sources without duplicates')
eq(options.getSecondaryOptions('市场中心').map(option => option.value), ['产品部'], 'secondary departments are isolated to their primary')
eq(options.getSecondaryOptions('二级映射'), [], 'secondary/tertiary mappings never masquerade as primary/secondary pairs')
eq(options.isValidPair('市场中心', '软件部'), false, 'cross-primary pair is invalid')
eq(options.isValidPair('历史部门', '旧团队'), true, 'historical pairs remain editable')
eq(options.isValidPair('研发中心', '软件部'), true, 'disabled config pairs remain selectable')
eq(options.isValidPair('', ''), false, 'empty pairs are invalid')
eq(options.getSecondaryOptions('不存在'), [], 'unknown primaries have no secondary options')

const { summarizeHrModels } = load('src/lib/hrModelStatistics.ts')
const stats = summarizeHrModels([
  { id: 's1', modelVersion: 'V1', projectLevel: 'S', enabled: true, conceptPhase: 0.1, planningPhase: 1.1, developmentPhase: 2.1, validationPhase: 3.1, launchPhase: 4.1, lifecycle: 5.1 },
  { id: 's2', modelVersion: 'V1', projectLevel: 'S', enabled: true, conceptPhase: 0.2, planningPhase: 1.2, developmentPhase: 2.2, validationPhase: 3.2, launchPhase: 4.2, lifecycle: 5.2 },
  { id: 'a1', modelVersion: 'V1', projectLevel: 'A', enabled: true, conceptPhase: 1, planningPhase: 2, developmentPhase: 3, validationPhase: 4, launchPhase: 5, lifecycle: 6 },
  { id: 'v2s', modelVersion: 'V2', projectLevel: 'S', enabled: false, conceptPhase: 10, planningPhase: 20, developmentPhase: 30, validationPhase: 40, launchPhase: 50, lifecycle: 60 },
])
eq(stats.map(row => [row.modelVersion, row.projectLevel]), [['V1', 'S'], ['V1', 'A'], ['V2', 'S']], 'statistics group by model version and project level')
eq([stats[0].conceptPhase, stats[0].planningPhase, stats[0].developmentPhase, stats[0].validationPhase, stats[0].launchPhase, stats[0].lifecycle, stats[0].total], [0.3, 2.3, 4.3, 6.3, 8.3, 10.3, 31.8], 'all six phases and total sum every department without floating artifacts')
eq(stats[1].total, 21, 'another project level has an independent total')
eq([stats[2].status, stats[2].total], ['disabled', 210], 'disabled model versions remain included with their status')
eq(stats[0].recordCount, 2, 'statistics expose the full department row count')
const unnamedStats = summarizeHrModels([{ id: 'legacy-1', modelVersion: '', projectLevel: 'S', conceptPhase: 1 }, { id: 'legacy-2', modelVersion: '', projectLevel: 'S', conceptPhase: 2 }])
eq(unnamedStats.map(row => [row.modelVersion, row.projectLevel, row.total]), [['', 'S', 3]], 'statistics group legacy empty values by the same version and level fields')
store.setState({ data: original })
console.log(`HR model configuration: ${assertions} assertions passed`)
