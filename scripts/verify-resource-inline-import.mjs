import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
const get = createTypeScriptModuleLoader()
const module = get(path.resolve('src/components/project-resources/inlineFieldSession.ts'))
assert.equal(typeof module.createInlineImportSession, 'function', 'imports need explicit owner lifetime validation')
const { createInlineImportSession } = module
for (const leave of ['unmount', 'switch', 'lock', 'change']) {
  const session = createInlineImportSession()
  let version = { id: 'original' }, editable = true, writes = 0
  const original = version
  const canApply = session.capture(() => editable && version === original)
  let resolve
  const pending = new Promise(done => { resolve = done }).then(() => { if (canApply()) writes++ })
  if (leave === 'unmount') session.invalidate()
  if (leave === 'switch') { session.invalidate(); session.activate() }
  if (leave === 'lock') editable = false
  if (leave === 'change') version = { id: 'original' }
  resolve()
  await pending
  assert.equal(writes, 0, `${leave} during parsing rejects stale import`)
}
const session = createInlineImportSession()
let editable = true
const confirmApply = session.capture(() => editable)
assert.equal(confirmApply(), true)
editable = false
assert.equal(confirmApply(), false, 'confirmation rechecks permissions after parsing')
editable = true
assert.equal(confirmApply(), true)
session.invalidate()
assert.equal(confirmApply(), false, 'confirmation after owner unmount remains invalid')
console.log('PASS deferred import leave/switch/lock/content change and delayed confirmation ownership checks')

// Exercise actual component import callbacks with deferred files and real mount cleanup.
const { default: fs } = await import('node:fs')
const { createRequire } = await import('node:module')
const { default: ts } = await import('typescript')
const require = createRequire(import.meta.url)
let cleanups = [], saved, scope = 'p', success = 0, mutation = 0, confirmation
const react = { useRef: value => ({ current: value }), useEffect: effect => { const cleanup = effect(); if (cleanup) cleanups.push(cleanup) }, useState: value => [value, () => {}] }
const emptyExpenses = { startMonth: '2026-01', endMonth: '2026-02', items: [] }
const columns = [{ key: 'estimatedInvestment', label: '预估投入' }]
const state = { projects: [], updateVersionInline: (_project, _version, patch) => { mutation++; saved = { ...saved, ...(patch.type === 'departments' ? { departmentInvestments: patch.rows } : { nonLaborInvestment: patch.value }) }; state.projects = [{ id: 'p', versions: [saved] }] } }
const modules = {
  react,
  antd: new Proxy({ App: { useApp: () => ({ message: { warning: () => {}, error: () => {}, success: () => { success++ } }, modal: { confirm: options => { confirmation = options } } }) } }, { get: (target, key) => target[key] ?? String(key) }),
  '@ant-design/icons': new Proxy({}, { get: (_, key) => String(key) }),
  xlsx: { read: () => ({ SheetNames: ['sheet'], Sheets: { sheet: {} } }), utils: { sheet_to_json: () => [['一级部门', '二级部门', '预估投入'], ['A', 'B', 15]] } },
  '@/components/project-resources/resourceVersionAdapter': { resourceStore: () => ({ getState: () => state }) },
  '@/components/project-resources/ResourceInlineField': { __esModule: true, default: 'InlineField', ResourceInlineControl: 'InlineControl' },
  '@/components/project-resources/inlineFieldSession': module,
  '@/components/project-resources/NonLaborInvestmentSection': { __esModule: true, default: 'Expenses' },
  '@/lib/hrVersionRules': { isHrVersionEditable: (_project, version) => version?.lockState !== 'locked' },
  '@/lib/hrProjectRegistry': { isHrFormalRecord: () => false, getHrRegistryProject: () => ({}), canEditHrInScope: (_project, id) => id === scope },
  '@/lib/resourceInlineEditing': { canEditResourceMilestone: () => true, resourceMilestoneFields: { capability: [] }, resourcePhaseFields: { capability: columns } },
  '@/lib/nonLaborInvestment': get(path.resolve('src/lib/nonLaborInvestment.ts')),
  '@/lib/nonLaborSpreadsheet': { nonLaborSpreadsheetColumns: () => [], parseNonLaborInvestmentRows: () => ({ ...emptyExpenses, items: [] }) },
  '@/lib/hrNonLaborRange': { hrNonLaborMonthRange: () => ({ startMonth: null, endMonth: null }) },
  '@/constants/hrConfig': {}, '@/lib/hrMachinePeriods': { machinePhaseFields: () => [] },
  '@/stores/hrConfig': { useHrConfigStore: fn => fn({ data: { hrModel: [], nonLaborSubject: [], techModuleDept: [] } }) },
  '@/hooks/useHrDepartmentOptions': { useHrDepartmentOptions: () => ({ primaryOptions: [], getSecondaryOptions: () => [] }) },
  '@/components/project-resources/HrReadonlyField': { HrReadonlyField: 'Readonly' },
  '@/lib/roadmapValidation': { PRODUCT_LINES_BY_BRAND: {} }, '@/constants/hrMachine': { formatPersonMonth: String },
  '@/utils/exportExcel': {},
}
function compile(file) {
  const result = { exports: {} }
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText
  new Function('require', 'module', 'exports', js)(id => modules[id] ?? require(id), result, result.exports)
  return result.exports
}
modules['@/components/project-resources/useInlineImportSession'] = compile('src/components/project-resources/useInlineImportSession.ts')
const Detail = compile('src/components/project-resources/ResourceInlineDetail.tsx').default
const Expenses = compile('src/components/project-resources/NonLaborInvestmentSection.tsx').default
function elements(node) { return [node, ...[node?.props?.children].flat(Infinity).filter(item => item && typeof item === 'object').flatMap(elements)] }
function deferredFile() { let resolve; const file = { arrayBuffer: () => new Promise(done => { resolve = done }) }; return { file, resolve: () => resolve(new ArrayBuffer(0)) } }
function mount(Component, props) {
  cleanups = []
  const element = Component(props)
  const owned = [...cleanups]
  return { element, unmount: () => owned.forEach(cleanup => cleanup()) }
}
const makeSaved = () => ({ id: 'v1', lockState: 'unlocked', projectStartTime: '2026-01-01', projectEndTime: '2026-02-01', departmentInvestments: [], nonLaborInvestment: emptyExpenses })
const props = () => ({ category: 'capability', project: { id: 'p' }, version: saved, scopeId: 'p', readOnly: false })
for (const event of ['leave-return-edit', 'lock']) {
  saved = makeSaved(); state.projects = [{ id: 'p', versions: [saved] }]
  const old = mount(Detail, props()), file = deferredFile()
  const importer = elements(old.element).find(node => node.type === 'Upload').props.beforeUpload
  const start = mutation, successBefore = success
  const pending = importer(file.file)
  if (event === 'leave-return-edit') {
    old.unmount(); scope = 'other'; scope = 'p'
    mount(Detail, props())
    state.updateVersionInline('p', 'v1', { type: 'departments', rows: [{ id: 'newer', estimatedInvestment: 99 }] })
  } else { saved = { ...saved, lockState: 'locked' }; state.projects = [{ id: 'p', versions: [saved] }] }
  const expected = JSON.stringify(saved), writes = mutation
  file.resolve(); await pending
  assert.equal(JSON.stringify(saved), expected)
  assert.equal(mutation, writes)
  assert.equal(success, successBefore)
  assert.ok(mutation >= start)
}
for (const event of ['pending-read', 'pending-confirm']) {
  const value = { ...emptyExpenses, items: [{ id: 'row', monthlyAmounts: {} }] }
  let writes = 0
  const view = mount(Expenses, { value, inline: true, canImport: () => true, onChange: () => { writes++ } })
  const importer = elements(view.element).find(node => node.type === 'Upload').props.beforeUpload
  const file = deferredFile(), pending = importer(file.file), successBefore = success
  if (event === 'pending-read') view.unmount()
  file.resolve(); await pending
  if (event === 'pending-confirm') { assert.ok(confirmation); view.unmount(); confirmation.onOk() }
  assert.equal(writes, 0)
  assert.equal(success, successBefore)
}
console.log('PASS actual department/expense import callbacks: delayed read, leave/remount/newer edit, lock and deferred confirmation preserve current data')
