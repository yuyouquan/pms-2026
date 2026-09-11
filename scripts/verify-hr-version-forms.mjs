#!/usr/bin/env node
import assert from 'node:assert/strict'
import path from 'node:path'
import fs from 'node:fs'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'
globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = { localStorage }
const loader = createTypeScriptModuleLoader(), load = file => loader(path.resolve(file))
const { useProjectStore: registry } = load('src/stores/project.ts')
const { usePermissionStore: permission, migratePermissionState, PERMISSION_STORAGE_KEY, hasGlobalPermission } = load('src/stores/permission.ts')
const { useHrConfigStore: config } = load('src/stores/hrConfig.ts')
const { calcMachineDepartmentInvestments } = load('src/constants/hrConfig.ts')
const stores = ['Machine', 'Tos', 'Technical', 'Capability'].map(name => load(`src/stores/hr${name}.ts`)[`useHr${name}Store`])
const types = ['整机产品项目', 'tOS版本项目', '技术项目', '能力建设项目']
let checks = 0
const check = async (label, fn) => { await fn(); checks++; console.log(`PASS ${label}`) }
const base = registry.getState().projects[0]
registry.setState({ currentLoginUser: '演示用户01', projects: types.map((type, i) => ({ ...base, id: `forms-${i}`, projectAttribute: 'budget', sourceBid: undefined, projectCode: '', name: `版本表单${i}`, type, boundFormalProjectId: null, brand: '', productLine: '', marketName: '', fieldValues: {} })) })
for (const store of stores) { store.setState({ projects: [], monthlyInvestments: [], registryMigrationComplete: true }); store.getState().refreshFormalProjects() }
const getRecord = i => stores[i].getState().projects.find(p => p.pmsProjectId === `forms-${i}`)
const meta = { projectLevel: 'S', hrModelVersion: 'V2026.1', levelCoefficient: 1.25, metadata: { brand: '示例品牌A', productLine: '示例系列F', marketName: '测试市场' } }
const dept = { id: 'dept', primaryDepartment: '研发中心', secondaryDepartment: '软件部', estimatedInvestment: 21, planningPhase: 1, conceptPhase: 2, planningPhase2: 3, developmentValidationPhase: 4, marketIterationPhase: 5, maintenancePhase: 6, planPhase: 3, developmentPhase: 7, migrationPhase: 8 }
await check('Machine validates entire version before metadata write; synchronous registry refresh retains new version and dates', () => {
  const before = structuredClone(registry.getState().projects)
  for (const invalid of [{ ...meta, hrModelVersion: 'missing' }, { ...meta, levelCoefficient: -1 }, { ...meta, metadata: { ...meta.metadata, marketName: '' } }, { ...meta, metadata: { ...meta.metadata, productLine: '示例系列A' } }]) {
    assert.throws(() => stores[0].getState().addVersion(getRecord(0).id, 'annual', invalid))
    assert.deepEqual(registry.getState().projects, before)
    assert.equal(getRecord(0).versions.length, 0)
  }
  const unsubscribe = registry.subscribe(() => stores.forEach(store => store.getState().refreshFormalProjects()))
  stores[0].getState().addVersion(getRecord(0).id, 'annual', { ...meta, milestones: { conceptStart: '2028-01-01', str5: '2028-12-01' } })
  unsubscribe()
  assert.equal(getRecord(0).versions.length, 1)
  assert.equal(getRecord(0).versions[0].milestones.str5, '2028-12-01')
  assert.equal(registry.getState().projects[0].marketName, '测试市场')
  assert.equal(getRecord(0).brand, '示例品牌A')
})
await check('All category creation payloads retain manual dates, reuse source seeds, protect history and persist reload', async () => {
  for (let i = 1; i < 4; i++) {
    const milestones = i === 1 ? { planningKO: '2028-01-02', conceptStart: '2028-02-02', str1: '2028-03-02', str3: '2028-04-02', str5: '2028-05-02', marketIteration: '2028-06-02', maintenanceEnd: '2028-07-02' } : { planningStart: '2028-01-02', charterDCP: '2028-02-02', tdr1: '2028-03-02', pdcp: '2028-04-02', tdcpx: '2028-05-02', edcp: '2028-06-02' }
    stores[i].getState().addVersion(getRecord(i).id, { budgetType: 'annual', departmentInvestments: [dept], milestones, projectStartTime: '2028-01-02', projectEndTime: '2028-12-02' })
    assert.deepEqual(i === 3 ? { start: getRecord(i).versions[0].projectStartTime, end: getRecord(i).versions[0].projectEndTime } : getRecord(i).versions[0].milestones, i === 3 ? { start: '2028-01-02', end: '2028-12-02' } : milestones)
  }
  for (let i = 0; i < 4; i++) {
    const before = structuredClone(getRecord(i).versions)
    await stores[i].persist.rehydrate()
    assert.deepEqual(getRecord(i).versions, before)
  }
})
await check('Machine configured preview and canonical version totals agree across levels, versions and fractional coefficients', () => {
  for (const [level, model, coefficient] of [['S', 'V2026.1', 1], ['A', 'V2026.1', 0.33], ['C', 'V2025.4', 2]]) {
    const rows = calcMachineDepartmentInvestments(config.getState().data.hrModel, level, model, coefficient)
    stores[0].getState().addVersion(getRecord(0).id, 'annual', { ...meta, projectLevel: level, hrModelVersion: model, levelCoefficient: coefficient })
    assert.equal(getRecord(0).versions.at(-1).estimatedInvestment, Math.round(rows.reduce((total, row) => total + row.estimatedTotal, 0) * 10) / 10)
    rows.forEach(row => assert.equal(Math.round(Object.values(row.phases).reduce((a,b) => a+b,0)*10)/10, row.estimatedTotal))
  }
})
await check('All four canonical formal projects create without source codes or published plans; provided manual dates cannot override own plan', () => {
  registry.setState({ projects: [...registry.getState().projects, ...types.map((type, i) => ({ ...base, id: `formal-empty-${i}`, type, name: `正式空编码${i}`, projectAttribute: 'formal', sourceBid: '', projectCode: '', fieldValues: { softwareProjectLevel: 'S' }, markets: [], versionTypes: [] }))] })
  stores.forEach((store, i) => {
    store.getState().refreshFormalProjects()
    const project = store.getState().projects.find(p => p.pmsProjectId === `formal-empty-${i}`)
    assert.equal(project.ipmProjectCode, null, 'empty actual code never displays a source ID')
    // Explicitly exercise null external-code compatibility; canonical ID supplies ownership.
    store.setState({ projects: store.getState().projects.map(p => p.id === project.id ? { ...p, ipmProjectCode: null } : p) })
    if (i === 0) store.getState().addVersion(project.id, 'projectEstimate', { ...meta, milestones: { conceptStart: '2040-01-01' } })
    else store.getState().addVersion(project.id, { budgetType: 'projectEstimate', departmentInvestments: [dept], milestones: { conceptStart: '2040-01-01', planningStart: '2040-01-01' }, projectStartTime: '2040-01-01', projectEndTime: '2040-12-01' })
    const version = store.getState().projects.find(p => p.id === project.id).versions[0]
    assert.ok(version, `${types[i]} can create with no external code`)
    if (i === 3) { assert.equal(version.projectStartTime, ''); assert.equal(version.projectEndTime, '') }
    else assert.ok(Object.values(version.milestones).every(value => value === null))
  })
})
await check('Canonical display uses actual project code while legacy lookup retains source identity', () => {
  const { hrFormalProjectCode, hrFormalDisplayCode } = load('src/lib/hrFormalProjectSource.ts')
  const formal = { ...base, id: 'display-code', projectAttribute: 'formal', sourceBid: 'EXTERNAL-SOURCE-ID', projectCode: 'ACTUAL-CODE', fieldValues: {} }
  registry.setState({ projects: [...registry.getState().projects, formal] })
  stores[0].getState().refreshFormalProjects()
  assert.equal(hrFormalProjectCode(formal), 'EXTERNAL-SOURCE-ID')
  assert.equal(hrFormalDisplayCode(formal), 'ACTUAL-CODE')
  assert.equal(stores[0].getState().projects.find(p => p.pmsProjectId === formal.id).ipmProjectCode, 'ACTUAL-CODE')
})
await check('Bound machine budgets accept partial or empty readonly formal metadata without changing sources or manual milestone dates', () => {
  const store = stores[0]
  for (const [caseName, sourceMetadata] of Object.entries({ empty: { brand: '', productLine: '', marketName: '' }, partial: { brand: '示例品牌A', productLine: '', marketName: '' } })) {
    const source = { ...base, id: `bound-source-${caseName}`, type: types[0], name: `来源-${caseName}`, projectAttribute: 'formal', sourceBid: '', projectCode: '', ...sourceMetadata, fieldValues: {} }
    const budget = { ...source, id: `bound-budget-${caseName}`, name: `预算-${caseName}`, projectAttribute: 'budget', boundFormalProjectId: source.id, brand: '预算原品牌', productLine: '预算原产品线', marketName: '预算原市场' }
    registry.setState({ projects: [...registry.getState().projects, source, budget] })
    store.getState().refreshFormalProjects()
    const record = () => store.getState().projects.find(p => p.pmsProjectId === budget.id)
    assert.deepEqual({ brand: record().brand, productLine: record().productLine, marketName: record().marketName }, sourceMetadata)
    const canonicalBefore = structuredClone(registry.getState().projects)
    const milestones = { conceptStart: '2032-02-01', str5: '2032-11-01' }
    assert.doesNotThrow(() => store.getState().addVersion(record().id, 'annual', { ...meta, metadata: sourceMetadata, milestones }))
    assert.equal(record().versions.length, 1)
    assert.equal(record().versions[0].milestones.conceptStart, milestones.conceptStart)
    assert.equal(record().versions[0].milestones.str5, milestones.str5)
    store.getState().addVersion(record().id, 'annual', { ...meta, metadata: sourceMetadata })
    assert.equal(record().versions.length, 2)
    assert.equal(record().versions[1].milestones.str5, milestones.str5)
    assert.deepEqual(registry.getState().projects, canonicalBefore)
  }
})
await check('Permission migration handles custom roles, explicit denies, malformed grants and legacy absent globals', async () => {
  const migrated = migratePermissionState({ globalRoles: [{ name: '模型组', members: ['tester'] }], globalRolePerms: { 模型组: { 'configCenter:planEdit': true, unknown: true }, 独立: { 'configCenter:planEdit': true, 'configCenter:hrModelEdit': false }, 损坏: { 'configCenter:planEdit': 'true' } } }, 2)
  assert.equal(migrated.globalRolePerms.模型组['configCenter:hrModelEdit'], true)
  assert.equal(migrated.globalRolePerms.独立['configCenter:hrModelEdit'], false)
  assert.equal(migrated.globalRolePerms.模型组.unknown, undefined)
  assert.equal(migrated.globalRolePerms.损坏['configCenter:hrModelEdit'], false)
  assert.equal(migratePermissionState({}, 2).globalRoles, undefined)
  assert.equal(migratePermissionState({}, 2).globalRolePerms, undefined)
  const defaults = structuredClone(permission.getState().globalRoles)
  localStorage.setItem(PERMISSION_STORAGE_KEY, JSON.stringify({ state: { rolesByProject: {}, rolePermissionsByProject: {} }, version: 2 }))
  await permission.persist.rehydrate()
  assert.deepEqual(permission.getState().globalRoles, defaults)
})
await check('Model stores deny seed editor/viewer; explicit custom grants permit all writes and survive actual reload independently', async () => {
  for (const actor of ['演示用户02', '演示用户05', 'unknown']) {
    registry.setState({ currentLoginUser: actor })
    assert.equal(hasGlobalPermission(actor, 'configCenter:hrModelEdit'), false)
    const before = structuredClone(config.getState().data.hrModel), id = before[0].id
    config.getState().addRecord('hrModel', { projectLevel: 'S', modelVersion: 'DENIED' })
    config.getState().updateRecord('hrModel', id, { lifecycle: 999 })
    config.getState().toggleRecordStatus('hrModel', id)
    config.getState().deleteRecord('hrModel', id)
    config.getState().importRecords('hrModel', [{ id: 'denied' }])
    assert.deepEqual(config.getState().data.hrModel, before)
  }
  permission.getState().setGlobalRoles([...permission.getState().globalRoles, { name: '模型组', members: ['tester'] }])
  permission.getState().setGlobalRolePerms(previous => ({ ...previous, 模型组: { 'configCenter:planEdit': true } }))
  permission.getState().setGlobalRolePerms(previous => ({ ...previous, 模型组: { ...previous.模型组, 'configCenter:planEdit': false } }))
  await permission.persist.rehydrate()
  const fresh = createTypeScriptModuleLoader()(path.resolve('src/stores/permission.ts')).usePermissionStore.getState()
  assert.equal(fresh.globalRolePerms.模型组['configCenter:hrModelEdit'], true)
  assert.equal(fresh.globalRolePerms.模型组['configCenter:planEdit'], false)
  assert.deepEqual(fresh.globalRoles.find(role => role.name === '模型组').members, ['tester'])
  registry.setState({ currentLoginUser: 'tester' })
  config.getState().addRecord('hrModel', { projectLevel: 'S', modelVersion: 'TEST-MODEL' })
  const added = config.getState().data.hrModel.at(-1)
  assert.equal(added.modelVersion, 'TEST-MODEL')
  config.getState().updateRecord('hrModel', added.id, { lifecycle: 3 }); assert.equal(config.getState().data.hrModel.at(-1).lifecycle, 3)
  config.getState().toggleRecordStatus('hrModel', added.id, false); assert.equal(config.getState().data.hrModel.at(-1).enabled, false)
  config.getState().importRecords('hrModel', [{ id: 'custom-import', modelVersion: 'IMPORT' }]); assert.ok(config.getState().data.hrModel.some(row => row.id === 'custom-import'))
  config.getState().deleteRecord('hrModel', 'custom-import'); assert.ok(!config.getState().data.hrModel.some(row => row.id === 'custom-import'))
})
await check('Forms and navigation wire shared readonly milestones, three-column layout, permission guards and existing model data', () => {
  const source = file => fs.readFileSync(file, 'utf8')
  for (const category of ['machine', 'tos', 'technical', 'capability']) {
    assert.match(source(`src/components/hr-${category}/NewVersionModal.tsx`), /pms-hr-version-form/)
    assert.match(source(`src/components/hr-${category}/${category === 'machine' ? 'MachineVersionDetailModal' : 'VersionDetailModal'}.tsx`), /HrVersionMilestoneDetails/)
  }
  assert.doesNotMatch(source('src/constants/hrPipeline.ts'), /key: 'config\/hr-model'/)
  assert.match(source('src/containers/ConfigContainer.tsx'), /HrConfigContent moduleKey="hrModel"/)
  assert.match(source('src/components/hr-config/ConfigTablePanel.tsx'), /canEdit \? actionColumn : \[\]/)
})
console.log(`HR version forms and model permissions passed (${checks} groups).`)
