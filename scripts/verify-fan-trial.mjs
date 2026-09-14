#!/usr/bin/env node
import assert from 'node:assert/strict'
import { loadTypeScriptModule, projectRoot } from './lib/source-contract.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'
globalThis.window = { localStorage: createCurrentDatasetStorage() }
const root = projectRoot(import.meta.url)
const { validateFanTrial, selectFanTrialCountries } = loadTypeScriptModule(root, 'src/lib/fanTrial.ts')
const valid = { fanTrialEnabled: '是', fanTrialCountries: [{ country: '尼日利亚', quantity: 20 }, { country: '肯尼亚', quantity: 10 }] }
assert.equal(validateFanTrial({}), null, 'legacy records default to no')
assert.equal(validateFanTrial({ fanTrialEnabled: '否' }), null)
assert.ok(validateFanTrial({ fanTrialEnabled: '' }))
assert.ok(validateFanTrial({ fanTrialEnabled: '是', fanTrialCountries: [] }))
for (const quantity of [null, 0, -1, 1.5, '20', Infinity, Number.MAX_SAFE_INTEGER + 1]) {
  assert.ok(validateFanTrial({ ...valid, fanTrialCountries: [{ country: '尼日利亚', quantity }] }), String(quantity))
}
assert.equal(validateFanTrial(valid, ['尼日利亚', '肯尼亚']), null)
assert.ok(validateFanTrial(valid, ['肯尼亚']), 'new selection must come from live configuration')
assert.equal(validateFanTrial(valid, ['肯尼亚'], valid.fanTrialCountries), null, 'saved retired country is preserved')
assert.ok(validateFanTrial({ ...valid, fanTrialCountries: [valid.fanTrialCountries[0], valid.fanTrialCountries[0]] }))
assert.deepEqual(selectFanTrialCountries(['肯尼亚', '印度'], valid.fanTrialCountries), [{ country: '肯尼亚', quantity: 10 }, { country: '印度', quantity: null }])
console.log('PASS conditional requirements, positive integers, uniqueness, enum lifecycle and quantity preservation')
const { getProjectInfoValue, mergeProjectInfoValues, formatProjectInfoValue } = loadTypeScriptModule(root, 'src/lib/projectInfoValues.ts')
const base = { id: 'fan-test', name: '测试项目', type: '整机产品项目', projectAttribute: 'budget', fieldValues: {} }
assert.equal(getProjectInfoValue(base, 'fanTrialEnabled'), '否')
const saved = mergeProjectInfoValues(base, valid)
assert.deepEqual(saved.fieldValues.fanTrialCountries, valid.fanTrialCountries)
assert.equal(formatProjectInfoValue(valid.fanTrialCountries), '尼日利亚：20台、肯尼亚：10台')
const { getProjectInfoModalSubmitValues, validateProjectInfoValues } = loadTypeScriptModule(root, 'src/lib/projectInfoRules.ts')
assert.deepEqual(getProjectInfoModalSubmitValues(base.type, { ...valid, fanTrialEnabled: '否' }).fanTrialCountries, valid.fanTrialCountries, 'turning off preserves configuration')
const { getMissingProjectInfoFields } = loadTypeScriptModule(root, 'src/lib/projectInfoCompletion.ts')
assert.ok(!getMissingProjectInfoFields(base).some(field => field.key.startsWith('fanTrial')))
for (const projectAttribute of ['formal', 'budget', 'roadmap']) {
  assert.ok(getMissingProjectInfoFields({ ...base, projectAttribute, fieldValues: { fanTrialEnabled: '是' } }).some(field => field.key === 'fanTrialCountries'))
}
const { createInitialEnumRows } = loadTypeScriptModule(root, 'src/lib/enumValues.ts')
const { migrateEnumState, ENUM_STORE_VERSION } = loadTypeScriptModule(root, 'src/stores/enums.ts')
assert.ok(migrateEnumState({ rowsByType: {} }, 4).rowsByType['fan-trial-country'].length > 0)
assert.ok(migrateEnumState({ rowsByType: { 'fan-trial-country': [] } }, 4).rowsByType['fan-trial-country'].length > 0, 'legacy empty configuration gets the requested one-time mock refresh')
assert.deepEqual(migrateEnumState({ rowsByType: { 'fan-trial-country': [] } }, ENUM_STORE_VERSION).rowsByType['fan-trial-country'], [], 'deletion after the mock refresh stays durable')
assert.ok(createInitialEnumRows()['fan-trial-country'].some(row => row.value === '尼日利亚'))
assert.ok(validateProjectInfoValues(base.type, { ...valid, fanTrialCountries: [{country: '尼日利亚', quantity: null}] }, { fieldKeys: new Set(['fanTrialEnabled', 'fanTrialCountries']) }).some(error => error.fieldKey === 'fanTrialCountries'), 'collapsed sections still enforce per-country quantities at submission')
console.log('PASS defaults, saved payload, display text, completion tasks and enum migration')

const { useProjectStore: projects } = loadTypeScriptModule(root, 'src/stores/project.ts')
const { useEnumStore: enums } = loadTypeScriptModule(root, 'src/stores/enums.ts')
const { createConfiguredProject } = loadTypeScriptModule(root, 'src/lib/projectRegistry.ts')
const { buildProjectRegistryHistoryRows } = loadTypeScriptModule(root, 'src/lib/projectManagementUi.ts')
enums.setState({ hasHydrated: true, hydrationError: null })
for (const projectAttribute of ['budget', 'roadmap']) {
  const result = createConfiguredProject({ projectAttribute, type: '整机产品项目', name: `粉丝试用${projectAttribute}`, responsiblePersons: ['演示用户01'] }, '演示用户01')
  assert.equal(result.ok, true)
  const id = result.projectId
  const current = () => projects.getState().projects.find(project => project.id === id)
  assert.equal(current().fieldValues.fanTrialEnabled, '否')
  const save = (data, actor = '演示用户01') => projects.getState().updateProject(id, { fieldValues: { ...current().fieldValues, ...data } }, actor)
  assert.equal(save({ fanTrialEnabled: '是', fanTrialCountries: [] }), null)
  assert.equal(save(valid, '无权限人员'), null)
  assert.ok(save(valid))
  assert.deepEqual(JSON.parse(JSON.stringify(current())).fieldValues.fanTrialCountries, valid.fanTrialCountries)
  const history = buildProjectRegistryHistoryRows(projects.getState().registryHistory.filter(entry => entry.projectId === id), projects.getState().projects)
  assert.ok(history.some(row => row.field === '粉丝试用国家' && row.after.includes('尼日利亚：20台')))
  assert.ok(save({ fanTrialEnabled: '否' }))
  assert.deepEqual(current().fieldValues.fanTrialCountries, valid.fanTrialCountries)
}
const formal = projects.getState().projects.find(project => project.id === '1')
assert.ok(formal)
assert.equal(projects.getState().updateProject('1', { fieldValues: { ...formal.fieldValues, fanTrialEnabled: '是', fanTrialCountries: [{ country: '尼日利亚', quantity: 0 }] } }, '演示用户01'), null)
assert.ok(projects.getState().updateProject('1', { fieldValues: { ...formal.fieldValues, ...valid } }, '演示用户01'))
console.log('PASS formal/budget/roadmap persistence, store validation, permissions and readable history')
process.exit(0)
