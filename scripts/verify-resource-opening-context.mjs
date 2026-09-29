import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
const load = createTypeScriptModuleLoader(), get = file => load(path.resolve(file))
const { useProjectStore } = get('src/stores/project.ts')
const { useProjectTeamStore } = get('src/stores/projectTeam.ts')
const { usePermissionStore, getSyncedProjectRoles } = get('src/stores/permission.ts')
const { useHrMachineStore } = get('src/stores/hrMachine.ts')
const rules = get('src/lib/hrProjectRegistry.ts')
const context = get('src/lib/resourceMutationContext.ts')
const actor = '演示用户10', admin = '演示用户01'
const project = useProjectStore.getState().projects.find(row => row.id === '1')
useProjectStore.setState({ currentLoginUser: actor, selectedProject: project })
const bind = source => {
 useProjectTeamStore.getState().syncProjects([{ ...project, mockTeamSourceId: source === 'legacy:1' ? source : undefined, sourceBid: source === 'legacy:1' ? undefined : source }])
 const role = getSyncedProjectRoles(project.id).find(row => row.ipmRoleCode === 'RJPM')
 assert.equal(usePermissionStore.getState().toggleProjectRolePermissions(admin, project.id, { source: 'ipm', id: role.id }, ['resource:lockVersion', 'resource:createVersion', 'resource:deleteVersion', 'resource:setOfficialVersion', 'resource:laborEdit', 'resource:nonLaborEdit', 'resource:export'], true).ok, true)
}
bind('legacy:1')
useHrMachineStore.getState().refreshFormalProjects()
const owner = useHrMachineStore.getState().projects.find(row => row.pmsProjectId === project.id)
const version = owner.versions.find(row => row.budgetType === 'projectEstimate' && row.lockState !== 'locked')
assert(version)
const expression = (file, name) => {
 const source = fs.readFileSync(file, 'utf8'), ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
 let found
 const visit = node => { if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) found = node.initializer; ts.forEachChild(node, visit) }; visit(ast)
 assert(found, name)
 return ts.transpileModule(`(${found.getText(ast)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
}
const capture = () => context.captureResourceOpening?.('machine', project.id, owner.id, version.id)
const env = () => ({ ...context, opening: capture(), actionOpening: { current: undefined }, category: 'machine', project, owner, version, budgetType: 'projectEstimate', resourceStore: () => useHrMachineStore, ...rules, guard: fn => fn(), message: { warning() {} } })
const act = vm.runInNewContext(expression('src/components/project-resources/ResourceVersionWorkspace.tsx', 'act'), env())
const before = JSON.stringify(useHrMachineStore.getState())
bind('EXT-001')
act('lockVersion', (state, currentOwner, currentVersion) => state.setVersionLocked(currentOwner.id, currentVersion.id, true))
assert.equal(JSON.stringify(useHrMachineStore.getState()), before, 'production old lock callback must reject rebind even with same grant')
console.log('PASS real resource callback rejects source rebind')
const inlineFile = 'src/components/project-resources/ResourceInlineDetail.tsx'
const workspaceFile = 'src/components/project-resources/ResourceVersionWorkspace.tsx'
const run = (file, name, environment) => vm.runInNewContext(expression(file, name), environment)
const jsxCallback = (attribute, environment) => {
 const source = fs.readFileSync(workspaceFile, 'utf8'), ast = ts.createSourceFile(workspaceFile, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
 let found
 const visit = node => { if (ts.isJsxAttribute(node) && node.name.getText(ast) === attribute) found = node.initializer.expression; ts.forEachChild(node, visit) }; visit(ast)
 assert(found)
 return vm.runInNewContext(ts.transpileModule(`(${found.getText(ast)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, environment)
}
const read = () => useHrMachineStore.getState().projects.find(row => row.id === owner.id).versions.find(row => row.id === version.id)
const freshAct = run(workspaceFile, 'act', env())
freshAct('lockVersion', (state, p, v) => state.setVersionLocked(p.id, v.id, true))
assert.equal(read().lockState, 'locked', 'fresh production operation still succeeds')
freshAct('lockVersion', (state, p, v) => state.setVersionLocked(p.id, v.id, false))
const inlineEnv = () => ({ ...env(), ...get('src/lib/hrVersionRules.ts'), scopeId: project.id, project: owner })
const persist = run(inlineFile, 'persist', inlineEnv())
persist({ type: 'batch', value: 7 })
assert.equal(read().batch, 7, 'fresh production inline handler persists')
const row = useHrMachineStore.getState().monthlyInvestments.find(row => row.versionId === version.id)
assert(row)
const month = Object.keys(row.monthlyData)[0]
const monthly = jsxCallback('onSaveMonth', env())
monthly(row.id, month, 3.2)
assert.equal(useHrMachineStore.getState().monthlyInvestments.find(item => item.id === row.id).monthlyData[month], 3.2)
const createOpening = { current: context.captureResourceOpening('machine', project.id, owner.id) }
const createSubmit = jsxCallback('onCreate', { ...env(), own: owner, createToken: createOpening.current, setSelectedId() {}, setCreateSource() {}, message: { success() {} } })
createSubmit({ versionNumber: 'review-fresh-copy', sourceVersionId: version.id })
assert(useHrMachineStore.getState().projects.find(item => item.id === owner.id).versions.some(item => item.versionNumber === 'Vreview-fresh-copy'), 'fresh production create/copy handler succeeds')
const stale = JSON.stringify(useHrMachineStore.getState())
bind('EXT-006')
for (const patch of [
 { type: 'batch', value: 8 }, { type: 'model', key: 'levelCoefficient', value: 2 },
 { type: 'metadata', key: 'marketName', value: 'stale' }, { type: 'milestone', key: 'str1', value: '2030-01-01' },
 { type: 'milestoneSchedule', dates: {}, modelSnapshot: {} }, { type: 'departments', rows: [] },
 { type: 'departmentTotal', rowId: row.id, value: 30 }, { type: 'departmentRatio', rowId: row.id, key: 'conceptToStr1', value: 30 },
 { type: 'nonLabor', value: { items: [] } }, { type: 'nonLaborItemTotal', itemId: 'x', value: 30 },
]) assert.throws(() => persist(patch), /来源已变化/, patch.type)
assert.throws(() => monthly(row.id, month, 8), /来源已变化/)
// A newer dialog must not replace the token held by an older async validation callback.
createOpening.current = context.captureResourceOpening('machine', project.id, owner.id)
for (const sourceVersionId of [undefined, version.id]) assert.throws(() => createSubmit({ versionNumber: 'stale', sourceVersionId }), /来源已变化/)
for (const action of ['lockVersion', 'setOfficialVersion', 'deleteVersion', 'export']) {
 let reached = false
 freshAct(action, () => { reached = true })
 assert.equal(reached, false, `stale ${action} callback rejected before execution`)
}
assert.equal(JSON.stringify(useHrMachineStore.getState()), stale, 'stale callbacks preserve real data and audit logs')
// A fresh source token does not permit cross-target writes or survive actor/project changes.
const opening = capture()
for (const [target, id] of [[owner.id, 'other-version'], ['other-resource', version.id]]) {
 assert.throws(() => context.withResourceOpening(opening, () => context.assertResourceOpening('machine', target, id)), /版本已变化/)
}
for (const update of [{ currentLoginUser: admin }, { selectedProject: { ...project, id: '2' } }]) {
 const current = useProjectStore.getState()
 useProjectStore.setState(update)
 assert.throws(() => context.withResourceOpening(opening, () => useHrMachineStore.getState().setVersionLocked(owner.id, version.id, true)), /项目或来源已变化/)
 useProjectStore.setState({ currentLoginUser: current.currentLoginUser, selectedProject: current.selectedProject })
}
// Real shared store rejects stale opening before mutation even if a caller skips a UI predicate.
assert.throws(() => context.withResourceOpening({ ...createOpening.current, sourceToken: 'old-source' }, () => useHrMachineStore.getState().setVersionLocked(owner.id, version.id, true)))
assert.equal(JSON.stringify(useHrMachineStore.getState()), stale)
const liveRole = getSyncedProjectRoles(project.id).find(role => role.ipmRoleCode === 'RJPM')
assert.equal(usePermissionStore.getState().toggleProjectRolePermissions(admin, project.id, { source: 'ipm', id: liveRole.id }, ['resource:lockVersion'], false).ok, true)
context.withResourceOpening(capture(), () => useHrMachineStore.getState().setVersionLocked(owner.id, version.id, true))
assert.equal(read().lockState, 'unlocked', 'fresh token never bypasses exact live operation permission')
console.log('PASS production inline/monthly/create/copy callbacks, action matrix, actor/project/target changes and grant revoke')
// Execute actual async parser callbacks with real opening predicates/persistence.
const { createInlineImportSession } = get('src/components/project-resources/inlineFieldSession.ts')
const imports = []
const deferredFile = () => { let resume; return { file: { arrayBuffer: () => new Promise(resolve => { resume = resolve }) }, resume: () => resume(new ArrayBuffer(0)) } }
for (const kind of ['labor', 'nonLabor-read', 'nonLabor-confirm']) {
 bind('EXT-006')
 const saved = read(), started = capture()
 const base = { ...inlineEnv(), opening: started, version: saved }
 const isImportCurrent = run(inlineFile, 'isImportCurrent', base)
 const save = run(inlineFile, 'persist', base)
 let confirmation, successes = 0
 const common = { importSession: createInlineImportSession(), message: { success() { successes++ }, warning() {}, error() {} },
   XLSX: { read: () => ({ SheetNames: ['sheet'], Sheets: { sheet: {} } }), utils: { sheet_to_json: () => [['部门', '子部门', '合计'], ['研发中心', '软件部', 10]] } } }
 const value = { ...(saved.nonLaborInvestment ?? {}), items: kind === 'nonLabor-confirm' ? [{ id: 'existing', monthlyAmounts: {} }] : [] }
 assert.equal(isImportCurrent(kind === 'labor' ? 'laborEdit' : 'nonLaborEdit'), true, 'fresh import eligibility before suspension')
 const handler = kind === 'labor' ? run(inlineFile, 'importDepartments', { ...common, version: saved, currentVersion: { current: saved }, isImportCurrent, phases: [], persist: save })
   : run('src/components/project-resources/NonLaborInvestmentSection.tsx', 'handleImport', {
     ...common, canImport: () => isImportCurrent('nonLaborEdit'), currentValueRef: { current: value }, value, unit: '元', inline: true,
     importPermission: { current: { unit: '元', readOnly: false, canImport: () => true } }, setImporting() {}, subjects: [], departmentRecords: [],
     parseNonLaborInvestmentRows: () => ({ startMonth: '2026-01', endMonth: '2026-02', items: [] }), onChange: next => save({ type: 'nonLabor', value: next }), modal: { confirm(options) { confirmation = options } },
   })
 const before = JSON.stringify(useHrMachineStore.getState()), file = deferredFile(), pending = handler(file.file)
 if (kind !== 'nonLabor-confirm') bind('EXT-001')
 file.resume(); await pending
 if (kind === 'nonLabor-confirm') { assert(confirmation, 'production import opens overwrite dialog'); bind('EXT-001'); confirmation.onOk() }
 assert.equal(JSON.stringify(useHrMachineStore.getState()), before, `${kind}: stale parser/dialog leaves real store and logs unchanged`)
 assert.equal(successes, 0)
 imports.push(kind)
}
console.log('PASS production async labor/nonlabor read and confirmation reject old source context')
// An in-progress field must retain its original save closure across a rerender.
const { createRequire } = await import('node:module')
const require = createRequire(import.meta.url)
const refs = []; let refIndex = 0
const fieldModule = { exports: {} }
const react = { useRef: value => { const i = refIndex++; return refs[i] ??= { current: value } }, useReducer: () => [0, () => {}], useId: () => 'field', useEffect() {} }
const fieldFile = 'src/components/project-resources/ResourceInlineField.tsx'
const js = ts.transpileModule(fs.readFileSync(fieldFile, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText
new Function('require', 'module', 'exports', js)(id => id === 'react' ? react : id === '@/stores/ui' ? { useUiStore: { getState: () => ({ setIsEditMode() {} }) } } : id.startsWith('@/') ? get(`src/${id.slice(2)}.ts`) : require(id), fieldModule, fieldModule.exports)
bind('EXT-006')
const oldPersist = run(inlineFile, 'persist', { ...inlineEnv(), opening: capture() })
let change
const renderField = onSave => { refIndex = 0; return fieldModule.exports.default({ label: 'batch', value: 7, onSave, renderEditor: (_value, update) => { change = update; return null } }) }
const field = renderField(value => oldPersist({ type: 'batch', value }))
field.props.onFocusCapture(); change(8)
bind('EXT-001')
const latestPersist = run(inlineFile, 'persist', { ...inlineEnv(), opening: capture() })
const rerendered = renderField(value => latestPersist({ type: 'batch', value }))
rerendered.props.onKeyDown({ key: 'Enter', target: { closest: () => false }, preventDefault() {}, stopPropagation() {} })
assert.equal(read().batch, 7, 'field cannot replace original authority with a new authorized callback during edit')
assert(refs[0].current.state.error.includes('来源已变化'))
console.log('PASS actual inline field retains opening save callback across rerender')

bind('EXT-006')
let pendingAction
const deferredAct = run(workspaceFile, 'act', { ...env(), guard: callback => { pendingAction = callback } })
deferredAct('lockVersion', (state, p, v) => state.setVersionLocked(p.id, v.id, true))
bind('EXT-001')
const beforeDeferred = JSON.stringify(useHrMachineStore.getState())
pendingAction()
assert.equal(JSON.stringify(useHrMachineStore.getState()), beforeDeferred, 'edit-guard confirmation retains the pre-dialog opening token')
console.log('PASS pending navigation guard preserves original resource authority')
