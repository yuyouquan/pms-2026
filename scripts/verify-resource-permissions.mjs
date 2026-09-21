import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'
globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = { localStorage }
const load = createTypeScriptModuleLoader(), get = file => load(path.resolve(file))
const { useProjectStore } = get('src/stores/project.ts')
const { usePermissionStore } = get('src/stores/permission.ts')
const { canResourceAction, canAccessHrProject, isHrVersionVisible } = get('src/lib/hrProjectRegistry.ts')
const { RESOURCE_PERMISSION_KEYS } = get('src/constants/permissions.ts')
const { resourceMilestoneFields } = get('src/lib/resourceInlineEditing.ts')
const admin = useProjectStore.getState().currentLoginUser
const member = '资源权限测试成员'
const actor = user => useProjectStore.setState({ currentLoginUser: user })
const grant = (scope, keys) => usePermissionStore.setState(state => ({
  rolesByProject: { ...state.rolesByProject, [scope]: [{ id: `resource-test-${scope}`, name: '测试成员', isFixed: false, members: [member] }] },
  rolePermissionsByProject: { ...state.rolePermissionsByProject, [scope]: { 测试成员: Object.fromEntries([...RESOURCE_PERMISSION_KEYS, 'basicInfo:查看', 'basicInfo:编辑'].map(key => [key, keys.includes(key)])) } },
}))
const basic = ['resource:view', 'resource:laborEdit', 'resource:nonLaborEdit']
for (const [category, kind] of Object.entries({ machine: 'Machine', tos: 'Tos', technical: 'Technical', capability: 'Capability' })) {
  actor(admin)
  const store = get(`src/stores/hr${kind}.ts`)[`useHr${kind}Store`]
  store.getState().refreshFormalProjects()
  const source = store.getState().projects.find(p => p.id.includes(`mock-budget-${category}-unbound`))
  assert.ok(source)
  const scope = source.pmsProjectId
  const id = store.getState().createResourceVersion(source.id, 'annual', scope, { versionNumber: '权限验收', sourceVersionId: source.versions.at(-1).id })
  const project = () => store.getState().projects.find(p => p.id === source.id)
  const version = () => project().versions.find(v => v.id === id)
  const rows = () => store.getState().monthlyInvestments.filter(r => r.versionId === id && !r.isArchived)
  const edit = patch => store.getState().updateVersionInline(source.id, id, patch, scope)
  const snapshot = () => JSON.stringify({ p: project(), m: rows(), registry: useProjectStore.getState().projects.find(p => p.id === scope) })
  const denied = (fn, title) => { const before = snapshot(); try { fn() } catch (e) { assert.match(e.message, /权限|不可|只读|来源/) } assert.equal(snapshot(), before, `${category}: ${title} is atomic`) }
  grant(scope, basic); actor(member)
  assert.equal(canResourceAction(project(), 'view'), true)
  assert.equal(canAccessHrProject(project(), true), false, 'resource editing never grants project status administration')
  for (const action of ['createVersion', 'lockVersion', 'setOfficialVersion', 'deleteVersion', 'export']) assert.equal(canResourceAction(project(), action), false)
  denied(() => store.getState().createResourceVersion(source.id, 'annual', scope, { versionNumber: '不允许' }), 'member creation')
  denied(() => store.getState().copyVersion(source.id, id), 'member legacy copy')
  denied(() => store.getState().setVersionLocked(source.id, id, true), 'member locking')
  denied(() => store.getState().setVersionActive(source.id, id, true), 'member formal')
  denied(() => store.getState().deleteVersion(source.id, id), 'member delete')
  denied(() => store.getState().cancelProject(source.id), 'member project cancellation')
  const field = resourceMilestoneFields[category][0]
  denied(() => edit({ type: 'milestone', key: field.key, value: '2026-01-01' }), 'member milestone')
  if (category === 'machine') denied(() => edit({ type: 'model', key: 'levelCoefficient', value: 2 }), 'member model')
  else {
    const row = version().departmentInvestments[0]
    edit({ type: 'departmentTotal', rowId: row.id, value: 12 })
    assert.equal(version().departmentInvestments[0].estimatedInvestment, 12)
  }
  const expense = version().nonLaborInvestment.items[0]
  assert.ok(expense)
  edit({ type: 'nonLaborItemTotal', itemId: expense.id, value: 123.45 })
  assert.equal(Math.round(Object.values(version().nonLaborInvestment.items[0].monthlyAmounts).reduce((a, b) => a + b, 0) * 100), 12345)
  const monthly = rows()[0], month = Object.keys(monthly.monthlyData)[0]
  assert.ok(month)
  const beforeMonthlyVersion = structuredClone(version())
  store.getState().updateResourceMonthlyInvestment(source.id, id, monthly.id, month, 7.1, scope)
  assert.equal(rows().find(r => r.id === monthly.id).monthlyData[month], 7.1)
  assert.deepEqual(version(), beforeMonthlyVersion, 'monthly values never change upper resource version')
  grant(scope, ['resource:view', 'resource:laborEdit'])
  denied(() => edit({ type: 'nonLaborItemTotal', itemId: expense.id, value: 321 }), 'labor-only expense')
  const badExpense = structuredClone(version().nonLaborInvestment); badExpense.items[0].monthlyAmounts[month] = 999
  denied(() => store.getState().updateVersion(source.id, id, { nonLaborInvestment: badExpense, estimatedInvestment: 100 }), 'mixed bulk payload')
  if (category !== 'machine') {
    const changed = structuredClone(version().departmentInvestments); changed[0].estimatedInvestment += 1
    const dates = category === 'capability' ? { projectStartTime: '2025-01-01', projectEndTime: '2026-12-01' } : { [field.key]: '2025-01-01' }
    denied(() => store.getState().updateVersionDepartmentInvestments(source.id, id, changed, version().nonLaborInvestment, dates), 'department bulk with setup change')
  }
  grant(scope, ['resource:view', 'resource:nonLaborEdit'])
  denied(() => store.getState().updateMonthlyInvestment(monthly.id, { [month]: 3 }), 'expense-only legacy monthly')
  denied(() => store.getState().updateResourceMonthlyInvestment(source.id, id, monthly.id, month, 3, scope), 'expense-only monthly')
  denied(() => store.getState().updateVersion(source.id, id, { isActive: true, lockState: 'unlocked' }), 'forged lifecycle fields')
  if (category === 'capability') {
    const changed = structuredClone(version().departmentInvestments); changed[0].estimatedInvestment += 100
    denied(() => store.getState().updateVersionDepartmentInvestments(source.id, id, changed, version().nonLaborInvestment, {
      projectStartTime: version().projectStartTime, projectEndTime: version().projectEndTime, departmentInvestments: version().departmentInvestments,
    }), 'forged dates masking labor changes')
  }
  // Setup manager without basic-info edit must still save the narrow resource metadata path.
  grant(scope, ['resource:view', 'resource:createVersion'])
  if (category === 'machine') {
    denied(() => edit({ type: 'model', key: 'isActive', value: true }), 'forged inline official flag')
    denied(() => edit({ type: 'model', key: 'lockState', value: 'locked' }), 'forged inline lock flag')
    edit({ type: 'metadata', key: 'marketName', value: '权限独立维护市场名' })
    assert.equal(useProjectStore.getState().projects.find(p => p.id === scope).marketName, '权限独立维护市场名')
    const previous = snapshot()
    assert.equal(useProjectStore.getState().updateProject(scope, { leader: member }, undefined, { resourceMetadata: { kind: 'edit', versionId: id } }), null)
    assert.equal(snapshot(), previous)
  }
  else edit({ type: 'milestone', key: field.key, value: '2025-01-01' })
  const created = store.getState().createResourceVersion(source.id, 'annual', scope, { versionNumber: '独立新建授权', sourceVersionId: id })
  assert.ok(project().versions.find(v => v.id === created))
  // Independent delete/lock grants must work without either investment-edit grant.
  grant(scope, ['resource:view', 'resource:lockVersion'])
  store.getState().setVersionLocked(source.id, id, true); assert.equal(version().lockState, 'locked')
  grant(scope, RESOURCE_PERMISSION_KEYS)
  denied(() => edit({ type: 'nonLaborItemTotal', itemId: expense.id, value: 99 }), 'locked edit')
  denied(() => store.getState().deleteVersion(source.id, id), 'locked deletion')
  if (category === 'machine') {
    const metadata = { marketName: '直接元数据写入拒绝' }
    for (const context of [true, { kind: 'edit', versionId: id }, { kind: 'create', budgetType: 'annual' }]) {
      assert.equal(useProjectStore.getState().updateProject(scope, metadata, undefined, { resourceMetadata: context }), null, 'canonical resource metadata requires a validated live resource action')
    }
  }
  store.getState().setVersionLocked(source.id, id, false); assert.equal(version().lockState, 'unlocked')
  if (category === 'machine') denied(() => edit({ type: 'departments', rows: [] }), 'machine config labor read-only')
  grant(scope, ['resource:view', 'resource:deleteVersion'])
  store.getState().deleteVersion(source.id, created); assert.equal(project().versions.some(v => v.id === created), false)
  grant(scope, [])
  assert.equal(canResourceAction(project(), 'view'), false)
  denied(() => edit({ type: 'nonLaborItemTotal', itemId: expense.id, value: 98 }), 'revoked access')
  actor('非空间用户'); assert.equal(canResourceAction(project(), 'view'), false)
  actor(member); grant(scope, basic)
  denied(() => store.getState().updateVersionInline(source.id, id, { type: 'nonLaborItemTotal', itemId: expense.id, value: 98 }, 'another-space'), 'cross-scope write')
  assert.equal(canResourceAction(project(), 'view', 'another-space'), false)
  // The source budget may be viewed in the bound formal space without membership in its source space.
  actor(admin)
  const bound = store.getState().projects.find(p => useProjectStore.getState().projects.find(r => r.id === p.pmsProjectId)?.boundFormalProjectId && p.versions.some(v => v.budgetType === 'annual'))
  assert.ok(bound)
  const formalId = useProjectStore.getState().projects.find(p => p.id === bound.pmsProjectId).boundFormalProjectId
  grant(formalId, RESOURCE_PERMISSION_KEYS); grant(bound.pmsProjectId, []); actor(member)
  assert.equal(canResourceAction(bound, 'view'), false)
  assert.equal(isHrVersionVisible(bound, 'annual', formalId), true)
  assert.equal(canResourceAction(bound, 'export', formalId), true)
  for (const action of ['createVersion', 'lockVersion', 'setOfficialVersion', 'deleteVersion', 'laborEdit', 'nonLaborEdit']) assert.equal(canResourceAction(bound, action, formalId), false)
  console.log(`PASS ${category}: independent grants, direct store guards, atomic mixed writes, locks, metadata scope and linked budget`)
}
actor(admin)
const machine = useProjectStore.getState().projects.find(p => p.id === '1')
assert.ok(machine)
const saved = useProjectStore.getState().updateProject(machine.id, { spm: '演示用户08' })
assert.ok(saved, 'established machine SPM is updated through canonical basic-info mutation')
assert.deepEqual(usePermissionStore.getState().rolesByProject[machine.id].find(r => r.name === 'SPM').members, ['演示用户08'], 'SPM authority synchronizes immediately')
console.log('PASS resource permissions domain verification, including immediate SPM authority synchronization')
