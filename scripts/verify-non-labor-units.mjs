import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'
import * as XLSX from 'xlsx'
import { createTypeScriptModuleLoader, resolveTypeScriptModule } from './lib/typescript-module-loader.mjs'

let workbookExport
const load = createTypeScriptModuleLoader(new Map([[path.resolve('src/utils/exportExcel.ts'), { exports: {
  exportTimestamp: () => 'units', exportMultiSheet: (sheets, filename) => { workbookExport = { sheets, filename } },
} }]]))
const sheet = load('src/lib/nonLaborSpreadsheet.ts')
const range = { startMonth: '2026-01', endMonth: '2026-02' }
const departments = [{ id: 'software', secondaryDepartment: '软件部', tertiaryDepartment: '驱动开发' }]
const subjects = [{ id: 'flight', secondarySubject: '交通费', tertiarySubject: '机票' }]
const labels = ['软件部', '驱动开发', '交通费', '机票']
const yuanHeaders = ['二级部门', '三级部门', '二级科目', '三级科目', '2026年01月（元）', '2026年02月（元）']
const wanHeaders = yuanHeaders.map(header => header.replace('（元）', '（万元）'))
assert.deepEqual(sheet.nonLaborSpreadsheetColumns(range).map(column => column.title), ['一级部门', ...yuanHeaders])
assert.deepEqual(sheet.nonLaborSpreadsheetColumns(range, '万元').map(column => column.title), ['一级部门', ...wanHeaders])

const units = load('src/lib/nonLaborAmountUnit.ts')
for (const amount of [0, 0.01, 0.29, 1.01, 100, 12345.67, 999999.99]) {
  assert.equal(units.fromNonLaborDisplayAmount(units.toNonLaborDisplayAmount(amount, '万元'), '万元'), amount, 'yuan cents survive display/input round trip')
  assert.equal(units.toNonLaborDisplayAmount(amount), amount, 'legacy defaults remain yuan')
  assert.equal(units.fromNonLaborDisplayAmount(amount), amount)
}
assert.equal(units.formatNonLaborDisplayAmount(12345.67, '万元'), '1.234567')
assert.equal(units.formatNonLaborDisplayAmount(10000, '万元'), '1')
assert.equal(units.formatNonLaborDisplayAmount(0.01, '万元'), '0.000001')
assert.equal(units.formatNonLaborDisplayAmount(10000), '10,000.00')
assert.equal(units.nonLaborAmountPrecision('万元'), 6)
assert.equal(units.nonLaborAmountPrecision(), 2)

const parse = (rows, unit = '元', previous) => sheet.parseNonLaborInvestmentRows(rows, range, subjects, departments, previous, unit)
const excel = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(excel, XLSX.utils.aoa_to_sheet([wanHeaders, [...labels, 1.234567, 0.000001]]), '非人力投入')
const reloaded = XLSX.read(XLSX.write(excel, { type: 'buffer', bookType: 'xlsx' }))
const imported = parse(XLSX.utils.sheet_to_json(reloaded.Sheets['非人力投入'], { header: 1 }), '万元')
assert.deepEqual(imported.items[0].monthlyAmounts, { '2026-01': 12345.67, '2026-02': 0.01 })
assert.equal(parse([yuanHeaders, [...labels, 12345.67, 0]]).items[0].monthlyAmounts['2026-01'], 12345.67)
assert.throws(() => parse([yuanHeaders, [...labels, 1, 0]], '万元'), /表头|模板|单位/)
assert.throws(() => parse([wanHeaders, [...labels, 1, 0]]), /表头|模板|单位/)
assert.throws(() => parse([wanHeaders, [...labels, 0.0000001, 0]], '万元'), /六位小数/)
assert.throws(() => parse([yuanHeaders, [...labels, 0.001, 0]]), /两位小数/)
for (const amount of [Infinity, -1, true, '1,20', 'text']) {
  assert.throws(() => parse([wanHeaders, [...labels, amount, 0]], '万元'), /金额|非负|小数/)
}
const retained = { ...range, items: [{ ...imported.items[0], id: 'retained', monthlyAmounts: { '2025-12': 99.99, '2026-01': 5 } }] }
const retainedBefore = structuredClone(retained)
const replacement = parse([wanHeaders, [...labels, 2.5, 0]], '万元', retained)
assert.equal(replacement.items[0].id, 'retained')
assert.deepEqual(replacement.items[0].monthlyAmounts, { '2025-12': 99.99, '2026-01': 25000, '2026-02': 0 })
assert.deepEqual(retained, retainedBefore, 'import preserves previous domain data immutably')

const exports = load('src/components/project-resources/exportResourceVersion.ts')
const version = { id: 'v1', budgetType: 'annual', versionNumber: 'V1', departmentInvestments: [], estimatedInvestment: 0,
  projectStartTime: '2026-01-01', projectEndTime: '2026-02-28', nonLaborInvestment: imported }
exports.exportResourceVersion('单位验证', version, [], '万元')
let moneySheet = workbookExport.sheets.find(item => item.sheetName === '非人力投入')
assert.equal(moneySheet.rows[0]['2026-01'], 1.234567)
assert.equal(moneySheet.rows[0]['2026-02'], 0.000001)
assert.equal(moneySheet.rows[0].estimatedInvestment, 1.234568)
assert.equal(moneySheet.columns.find(column => column.key === 'estimatedInvestment').title, '合计（万元）')
assert.ok(moneySheet.columns.filter(column => column.key.startsWith('2026')).every(column => column.title.endsWith('（万元）')))
exports.exportResourceVersion('单位验证', version, [])
moneySheet = workbookExport.sheets.find(item => item.sheetName === '非人力投入')
assert.equal(moneySheet.rows[0]['2026-01'], 12345.67)
assert.equal(moneySheet.columns.find(column => column.key === 'estimatedInvestment').title, '合计（元）')

// Read the actual component's controls and invoke its write/import callbacks.
const require = createRequire(import.meta.url)
const react = require('react')
const Table = () => null
Table.Summary = { Row: 'SummaryRow', Cell: 'SummaryCell' }
let confirmation, warnings = [], changes = [], totalChanges = []
const modules = {
  react: { ...react, useState: value => [value, () => {}], useRef: current => ({ current }), useEffect: () => {} },
  antd: new Proxy({ Table, App: { useApp: () => ({ modal: { confirm: options => { confirmation = options } }, message: { warning: text => warnings.push(text), error: text => warnings.push(text), success: () => {} } }) } }, { get: (target, key) => target[key] ?? String(key) }),
  '@ant-design/icons': new Proxy({}, { get: (_, key) => String(key) }),
  '@/stores/hrConfig': { useHrConfigStore: selector => selector({ data: { nonLaborSubject: subjects, techModuleDept: departments } }) },
  '@/components/project-resources/ResourceInlineField': { ResourceInlineControl: 'InlineControl' },
  '@/components/project-resources/HrReadonlyField': { HrReadonlyField: 'Readonly' },
  '@/components/project-resources/useInlineImportSession': { useInlineImportSession: () => ({ capture: predicate => predicate }) },
}
const file = 'src/components/project-resources/NonLaborInvestmentSection.tsx'
const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText
const component = { exports: {} }
new Function('require', 'module', 'exports', compiled)(id => modules[id] ?? (id.startsWith('@/') ? load(resolveTypeScriptModule(id, path.resolve(file))) : require(id)), component, component.exports)
const Section = component.exports.default
const elements = node => [node, ...[node?.props?.children].flat(Infinity).filter(item => item && typeof item === 'object').flatMap(elements)]
const props = { value: imported, onChange: next => changes.push(next), onItemTotalChange: (...args) => totalChanges.push(args) }
const rendered = Section({ ...props, unit: '万元' })
const table = elements(rendered).find(node => node.type === Table)
const first = imported.items[0]
const totalControl = table.props.columns.find(column => column.key === 'total').render(null, first)
const monthControl = table.props.columns.find(column => column.key === '2026-01').render(null, first)
assert.equal(totalControl.props.value, 1.234568)
assert.equal(monthControl.props.value, 1.234567)
assert.equal(monthControl.props.precision, 6)
assert.match(monthControl.props['aria-label'], /万元/)
assert.equal(monthControl.props.formatter(1, { userTyping: false, input: '1.000000' }), '1')
assert.equal(monthControl.props.formatter(1, { userTyping: true, input: '1.00' }), '1.00', 'typing preserves the unfinished decimal input')
monthControl.props.onChange(2.345678)
assert.equal(changes.at(-1).items[0].monthlyAmounts['2026-01'], 23456.78)
totalControl.props.onChange(3.000001)
assert.deepEqual(totalChanges.at(-1), [first.id, 30000.01])
const summary = elements(table.props.summary()).filter(node => node.type === 'SummaryCell')
assert.equal(summary[1].props.children, '1.234568')
assert.equal(summary[2].props.children, '1.234567')
const readonly = Section({ ...props, unit: '万元', readOnly: true })
const readonlyTable = elements(readonly).find(node => node.type === Table)
assert.equal(readonlyTable.props.columns.find(column => column.key === '2026-01').render(null, first), '1.234567')
const legacy = elements(Section(props)).find(node => node.type === Table).props.columns.find(column => column.key === '2026-01').render(null, first)
assert.equal(legacy.props.value, 12345.67)
assert.equal(legacy.props.precision, 2)
assert.match(legacy.props['aria-label'], /（元）/)
assert.equal(legacy.props.formatter(80, { userTyping: false, input: '80' }), '80.00')
assert.equal(legacy.props.formatter(0, { userTyping: false, input: '' }), '0.00')
assert.equal(legacy.props.formatter(80, { userTyping: true, input: '80.' }), '80.', 'yuan typing retains an unfinished decimal')
legacy.props.onChange(123.45)
assert.equal(changes.at(-1).items[0].monthlyAmounts['2026-01'], 123.45, 'yuan input saves without multiplying or dividing')
const yuanPanel = Section({ ...props, unit: '元', showSummary: false })
assert.equal(elements(yuanPanel).some(node => node.type === 'Alert'), false, 'embedded panel has no duplicate cost banner')
const yuanTable = elements(yuanPanel).find(node => node.type === Table)
assert.equal(yuanTable.props.columns.find(column => column.key === 'total').title, '预估投入合计')
assert.equal(elements(yuanTable.props.summary()).filter(node => node.type === 'SummaryCell')[1].props.children, '12,345.68')
const yuanReadonly = elements(Section({ ...props, unit: '元', readOnly: true })).find(node => node.type === Table)
assert.equal(yuanReadonly.props.columns.find(column => column.key === '2026-01').render(null, first), '12,345.67')
elements(yuanPanel).find(node => node.props?.['aria-label']?.startsWith('下载非人力投入模板')).props.onClick()
assert.deepEqual(workbookExport.sheets[0].columns.map(column => column.title), ['一级部门', ...yuanHeaders])
elements(rendered).find(node => node.props?.['aria-label']?.startsWith('下载非人力投入模板')).props.onClick()
assert.match(workbookExport.filename, /万元/)
assert.deepEqual(workbookExport.sheets[0].columns.map(column => column.title), ['一级部门', ...wanHeaders])
await elements(rendered).find(node => node.type === 'Upload').props.beforeUpload({ arrayBuffer: async () => XLSX.write(excel, { type: 'buffer', bookType: 'xlsx' }) })
assert.ok(confirmation)
confirmation.onOk()
assert.equal(changes.at(-1).items[0].monthlyAmounts['2026-01'], 12345.67)
assert.deepEqual(warnings, [])
console.log('PASS non-labor yuan/wan-yuan conversion, cent precision, template/header guards, Excel round trip, component input/summary/import and resource exports')

assert.equal(yuanTable.props.columns[0].key, 'primaryDepartment')
for (const readonly of [false, true]) {
  const view = elements(Section({ ...props, inline: true, readOnly: readonly })).find(node => node.type === Table)
  const subjectCell = view.props.columns.find(column => column.key === 'tertiarySubject').render(null, first)
  assert.equal(elements(subjectCell).filter(node => node.props?.['aria-label'] === '科目说明：机票').length, 1)
  const tooltip = elements(subjectCell).find(node => node.type === 'Tooltip')
  assert.deepEqual(tooltip.props.trigger, ['hover', 'focus'])
  assert.equal(tooltip.props.title.props.children, '暂无科目说明')
  if (!readonly) assert.ok(elements(subjectCell).some(node => node.type === 'InlineControl'), 'help icon must not bypass inline saving')
}
console.log('PASS primary column order and subject help in editable/readonly inline cells')
