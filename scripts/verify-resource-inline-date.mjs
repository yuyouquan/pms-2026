import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
const get = createTypeScriptModuleLoader()
const { createInlineFieldSession, inlineDateInputHandlers } = get(path.resolve('src/components/project-resources/inlineFieldSession.ts'))
assert.equal(typeof inlineDateInputHandlers, 'function', 'date text must be captured before DatePicker final onChange')
const session = createInlineFieldSession(() => {})
let saved = '2026-12-31'
const persist = value => {
  if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(value).toISOString().slice(0, 10) !== value)) throw new Error('请选择有效日期')
  saved = value
}
const handlers = inlineDateInputHandlers(session.change)
session.begin(saved)
handlers.onInputCapture({ target: { tagName: 'INPUT', value: '2027-01-31' } })
assert.equal(session.leave(false, persist), true)
assert.equal(saved, '2027-01-31', 'outside save receives actual typed text without waiting for DatePicker onChange')
session.begin(saved)
handlers.onInputCapture({ target: { tagName: 'INPUT', value: '2026-02-31' } })
assert.equal(session.leave(false, persist), false)
assert.equal(session.state.editing, true)
assert.equal(session.state.value, '2026-02-31')
assert.equal(saved, '2027-01-31')
assert.match(session.state.error, /日期/)
session.cancel()
session.begin(saved)
handlers.onInputCapture({ target: { tagName: 'INPUT', value: '' } })
assert.equal(session.save(persist), true)
assert.equal(saved, null, 'clearing date remains intentionally blank')
console.log('PASS typed date outside save, invalid raw date retention, cancellation and blank date')

// Render the production detail's actual editor, not a manually constructed DatePicker prop bag.
const { default: fs } = await import('node:fs')
const { createRequire } = await import('node:module')
const { default: ts } = await import('typescript')
const require = createRequire(import.meta.url)
const sessionModule = get(path.resolve('src/components/project-resources/inlineFieldSession.ts'))
const modules = {
  react: { useRef: value => ({ current: value }) },
  antd: { App: { useApp: () => ({ message: {} }) }, DatePicker: function DatePicker() {}, Descriptions: 'Descriptions', Input: 'Input', InputNumber: 'InputNumber', Select: 'Select', Space: 'Space', Table: 'Table', Tooltip: 'Tooltip', Upload: 'Upload', Button: 'Button' },
  '@ant-design/icons': new Proxy({}, { get: (_, key) => String(key) }),
  '@/components/project-resources/resourceVersionAdapter': { resourceStore: () => ({ getState: () => ({}) }) },
  '@/components/project-resources/ResourceInlineField': { __esModule: true, default: 'InlineField' },
  '@/components/project-resources/useInlineImportSession': { useInlineImportSession: () => sessionModule.createInlineImportSession() },
  '@/components/project-resources/inlineFieldSession': sessionModule,
  '@/components/project-resources/NonLaborInvestmentSection': { __esModule: true, default: 'Expenses' },
  '@/lib/hrVersionRules': { isHrVersionEditable: () => true },
  '@/lib/hrProjectRegistry': { isHrFormalRecord: () => false, getHrRegistryProject: () => ({}), canEditHrInScope: () => true },
  '@/lib/resourceInlineEditing': { canEditResourceMilestone: () => true, resourceMilestoneFields: { capability: [{ key: 'projectStartTime', label: '项目开始时间' }] }, resourcePhaseFields: { capability: [] } },
  '@/lib/nonLaborInvestment': { cloneNonLaborInvestment: value => value },
  '@/constants/hrConfig': {}, '@/lib/hrMachinePeriods': { machinePhaseFields: () => [] },
  '@/stores/hrConfig': { useHrConfigStore: fn => fn({ data: { hrModel: [] } }) },
  '@/hooks/useHrDepartmentOptions': { useHrDepartmentOptions: () => ({ primaryOptions: [], getSecondaryOptions: () => [] }) },
  '@/components/project-resources/HrReadonlyField': { HrReadonlyField: 'Readonly' },
  '@/lib/roadmapValidation': { PRODUCT_LINES_BY_BRAND: {} }, '@/constants/hrMachine': { formatPersonMonth: String }, '@/utils/exportExcel': {},
}
const compiled = { exports: {} }
const source = ts.transpileModule(fs.readFileSync('src/components/project-resources/ResourceInlineDetail.tsx', 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText
new Function('require', 'module', 'exports', source)(id => modules[id] ?? require(id), compiled, compiled.exports)
const tree = compiled.exports.default({ category: 'capability', project: { id: 'p' }, version: { id: 'v', projectStartTime: '2026-12-31', projectEndTime: '2027-12-31', departmentInvestments: [] }, scopeId: 'p', readOnly: false })
function elements(node) { return [node, ...[node?.props?.children].flat(Infinity).filter(item => item && typeof item === 'object').flatMap(elements)] }
const field = elements(tree).find(node => node.type === 'InlineField' && node.props.label === '项目开始时间')
assert.ok(field)
saved = '2026-12-31'
for (const [raw, valid] of [['2027-01-31', true], ['2026-02-31', false]]) {
  session.begin(saved)
  const editor = field.props.renderEditor(session.state.value, session.change, () => null)
  assert.ok(typeof editor.type === 'string' && /^[a-z]/.test(editor.type), 'input capture must be installed on a native DOM wrapper, not a DatePicker that discards it')
  assert.equal(typeof editor.props.onInputCapture, 'function')
  assert.equal(editor.props.children.type, modules.antd.DatePicker)
  assert.equal(editor.props.children.props.onInputCapture, undefined, 'do not rely on DatePicker forwarding input capture')
  editor.props.onInputCapture({ target: { tagName: 'INPUT', value: raw } })
  assert.equal(session.leave(false, persist), valid)
  if (valid) assert.equal(saved, raw)
  else { assert.equal(session.state.value, raw); assert.equal(session.state.editing, true); assert.match(session.state.error, /日期/) }
}
console.log('PASS production date editor native wrapper captures valid/invalid input before outside commit')
