import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'

globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = { localStorage }
const require = createRequire(import.meta.url)
const load = createTypeScriptModuleLoader()
const get = file => load(path.resolve(file))
const registry = get('src/stores/project.ts').useProjectStore
const ui = get('src/stores/ui.ts').useUiStore
const rules = get('src/lib/hrVersionRules.ts')
const access = get('src/lib/hrProjectRegistry.ts')
const noop = () => {}
let selected, currentStore, hookCursor = 0
// Keep React/AntD rendering as a minimal element harness; execute the actual
// workspace handlers, permission rules, edit guard, and persisted store actions.
const modules = {
  react: { useEffect: noop, useState: initial => { const index = hookCursor++; return index === 2 ? [selected, value => { selected = value }] : [initial, noop] } },
  antd: { App: { useApp: () => ({ message: { success: noop, warning: noop } }) }, ...Object.fromEntries(['Alert', 'Button', 'Empty', 'Popconfirm', 'Select', 'Space', 'Tabs', 'Tooltip'].map(name => [name, name])) },
  '@ant-design/icons': new Proxy({}, { get: (_, key) => String(key) }),
  '@/stores/project': { useProjectStore: noop },
  '@/stores/permission': { usePermissionStore: noop },
  '@/components/project-resources/resourceVersionAdapter': { resourceStore: () => currentStore, useResourceStore: () => currentStore.getState(), resourceProjectName: p => p.name || p.tdtName },
  '@/components/project-resources/ResourceVersionDialogs': { ResourceVersionCreateDialog: 'CreateDialog', ResourceOperationLogDialog: 'LogDialog' },
  '@/components/project-resources/exportResourceVersion': { exportResourceVersion: noop },
  ...Object.fromEntries(['HrSourceLink', 'ResourceVersionViews', 'ResourceInlineDetail', 'ResourceInlineField'].map(name => [`@/components/project-resources/${name}`, { __esModule: true, default: name }])),
}
const module = { exports: {} }
const compiled = ts.transpileModule(fs.readFileSync('src/components/project-resources/ResourceVersionWorkspace.tsx', 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText
new Function('require', 'module', 'exports', compiled)(id => modules[id] ?? (id.startsWith('@/') ? get(`src/${id.slice(2)}.ts`) : require(id)), module, module.exports)
const elements = node => [node, ...[node?.props?.children].flat(Infinity).filter(child => child && typeof child === 'object').flatMap(elements)]

for (const kind of ['Machine', 'Tos', 'Technical', 'Capability']) {
  currentStore = get(`src/stores/hr${kind}.ts`)[`useHr${kind}Store`]
  currentStore.getState().refreshFormalProjects()
  for (const budgetType of ['annual', 'projectEstimate', 'projectBudget']) {
    const fixture = currentStore.getState().projects.find(p => access.canEditHrInScope(p, p.pmsProjectId) && access.getHrAllowedBudgetTypes(p).includes(budgetType) && p.versions.some(v => v.budgetType === budgetType))
    assert.ok(fixture, `${kind}/${budgetType} editable fixture`)
    const project = registry.getState().projects.find(p => p.id === fixture.pmsProjectId)
    const read = () => currentStore.getState().projects.find(p => p.id === fixture.id)
    const versions = () => read().versions.filter(v => v.budgetType === budgetType)
    const first = versions()[0]
    currentStore.getState().copyVersion(fixture.id, first.id)
    const latest = versions().at(-1)
    currentStore.getState().setVersionActive(fixture.id, first.id, true)
    selected = undefined
    const render = () => { hookCursor = 0; return elements(module.exports.default({ project, category: kind.toLowerCase(), budgetType })) }
    const detail = () => render().find(node => node.type === 'ResourceInlineDetail')
    const button = label => render().find(node => node.type === 'Button' && node.props['aria-label'] === label)
    const active = () => rules.getActiveHrVersion(versions(), budgetType)?.id
    assert.equal(detail().props.version.id, latest.id, 'initial selection is newest, independent of active')
    button('设置为正式版本').props.onClick()
    assert.equal(active(), latest.id, 'actual button activates newest and clears older active')
    button('取消设置为正式版本').props.onClick()
    assert.equal(active(), undefined)
    assert.equal(detail().props.version.id, latest.id, 'deactivation retains viewed version')
    currentStore.getState().refreshFormalProjects()
    await currentStore.persist.rehydrate()
    assert.equal(active(), undefined, 'zero active survives refresh and rehydration')
    render().find(node => node.type === 'Tabs').props.onChange(first.id)
    assert.equal(detail().props.version.id, first.id)
    assert.equal(active(), undefined, 'viewing history does not reactivate it')
    ui.getState().setIsEditMode(true)
    button('设置为正式版本').props.onClick()
    assert.equal(active(), undefined, 'guard defers activation')
    assert.equal(ui.getState().showLeaveConfirm, true)
    ui.getState().handleCancelLeave()
    assert.equal(active(), undefined, 'cancel preserves inactive state')
    button('设置为正式版本').props.onClick()
    ui.getState().handleConfirmLeave()
    assert.equal(active(), first.id, 'confirm executes actual activation callback')
    button('锁定').props.onClick()
    const frozen = structuredClone(versions().find(v => v.id === first.id))
    button('取消设置为正式版本').props.onClick()
    assert.equal(active(), undefined, 'actual button deactivates locked version')
    button('设置为正式版本').props.onClick()
    assert.equal(active(), first.id, 'actual button reactivates locked version')
    assert.deepEqual(versions().find(v => v.id === first.id), frozen, 'lock/business snapshot retained')
    console.log(`PASS actual workspace callbacks + real stores ${kind}/${budgetType}: default/select/activate/clear/refresh/rehydrate/guard cancel/confirm/lock`)
  }
}
