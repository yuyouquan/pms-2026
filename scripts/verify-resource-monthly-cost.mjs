import assert from 'node:assert/strict'
import path from 'node:path'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'

const load = createTypeScriptModuleLoader()
const { buildResourceMonthlyView } = load(path.resolve('src/components/project-resources/resourceVersionViewData.ts'))
const { buildResourceMonthlyCostView, sumResourceCost } = load(path.resolve('src/components/project-resources/resourceMonthlyCost.ts'))
const rows = [
  { id: 'labor', versionId: 'v', primaryDepartment: '研发中心', secondaryDepartment: '软件部', estimatedTotal: 100, monthlyData: { '2026-09': 12.3, '2026-12': 27.3, '2027-01': 58.7, '2028-01': 1.7 } },
  { id: 'archived', versionId: 'v', isArchived: true, estimatedTotal: 900, monthlyData: { '2026-09': 900 } },
  { id: 'other-version', versionId: 'other', estimatedTotal: 800, monthlyData: { '2026-09': 800 } },
]
const expense = { startMonth: '2026-09', endMonth: '2028-01', items: [
  { id: 'travel', secondaryDepartment: '软件部', monthlyAmounts: { '2026-09': 100000, '2029-01': 999999 } },
] }
const original = JSON.stringify({ rows, expense })
const labor = buildResourceMonthlyView(rows, 'v', '2026-09', '2028-01')
const costs = buildResourceMonthlyCostView(labor, expense, 5, 100)
assert.equal(costs.allocatedTotal, 510, '100 person months × 5 + 100,000 yuan = 510 ten-thousand yuan')
assert.equal(costs.estimatedTotal, 510)
assert.equal(costs.totals['2026-09'], 71.5)
assert.equal(sumResourceCost(costs.totals, labor.months.filter(month => month.startsWith('2026-'))), 208)
assert.equal(sumResourceCost(costs.totals, labor.months.filter(month => month.startsWith('2027-'))), 293.5)
assert.equal(costs.rows.length, 2, 'archived and other-version labor rows are excluded')
assert.equal(costs.rows.find(row => row.isNonLabor).monthlyData['2026-09'], 10)
assert.equal(sumResourceCost(costs.rows.find(row => row.isNonLabor).monthlyData), 10, 'hidden expenses do not enter totals')
for (const month of labor.months) assert.equal(costs.totals[month], sumResourceCost(Object.fromEntries(costs.rows.map(row => [row.id, row.monthlyData[month] ?? 0]))))
assert.equal(JSON.stringify({ rows, expense }), original, 'projection never mutates saved inputs')
assert.equal(labor.allocatedTotal, 100, 'non-labor costs do not change person months')

const changed = structuredClone(expense)
changed.items.push({ id: 'only-non-labor', secondaryDepartment: '无对应人力的部门', monthlyAmounts: { '2027-01': 12345.67 } })
const updated = buildResourceMonthlyCostView(labor, changed, 6.25, 100)
assert.equal(updated.allocatedTotal, 636.234567, 'expenses are included even without a matching labor department')
assert.equal(updated.totals['2027-01'], 368.109567)
assert.equal(buildResourceMonthlyCostView(labor, changed, 0, 100).allocatedTotal, 11.234567, 'zero labor rate retains expenses')
assert.equal(buildResourceMonthlyCostView(labor, changed, NaN, 100).allocatedTotal, 11.234567)

const duplicateLabor = buildResourceMonthlyView([...rows, { ...rows[0], id: 'second', estimatedTotal: 1, monthlyData: { '2026-09': 1 } }], 'v')
assert.equal(buildResourceMonthlyCostView(duplicateLabor, expense, 5, 101).allocatedTotal, 515, 'same department does not duplicate non-labor cost')
const over = buildResourceMonthlyView([{ ...rows[0], monthlyData: { '2026-09': 102 } }], 'v')
const overCosts = buildResourceMonthlyCostView(over, expense, 5, 100)
assert.equal(overCosts.allocatedTotal - overCosts.estimatedTotal, 10, 'expense does not hide labor imbalance')

const pennies = { startMonth: '2026-09', endMonth: '2026-09', items: Array.from({ length: 100 }, (_, id) => ({ id: `penny-${id}`, monthlyAmounts: { '2026-09': 0.01 } })) }
assert.equal(buildResourceMonthlyCostView(buildResourceMonthlyView([], 'v'), pennies, 5, 0).allocatedTotal, 0.0001, 'preserve cents before final display rounding')
assert.equal(buildResourceMonthlyCostView(labor, { ...expense, startMonth: null, endMonth: null }, 5, 100).allocatedTotal, 500, 'cleared range excludes retained hidden amounts')
assert.equal(buildResourceMonthlyCostView(labor, undefined, 5, 100).rows.length, 1)
const expenseOnlyAxis = buildResourceMonthlyView([], 'v', undefined, undefined, 'all', ['2027-01', '2027-02'])
assert.deepEqual(expenseOnlyAxis.years, ['2027'])
assert.equal(expenseOnlyAxis.visibleTotal, 0)
assert.equal(buildResourceMonthlyCostView(expenseOnlyAxis, { startMonth: '2027-01', endMonth: '2027-02', items: [{ id: 'only', monthlyAmounts: { '2027-02': 100000 } }] }, 5, 0).totals['2027-02'], 10, 'expense-only months remain visible without labor rows')
console.log('PASS resource monthly cost: full cycle/year/month totals, version isolation, hidden ranges, non-labor-only departments, zero/changed rate, cents, one-way projection and balance')

// Exercise the actual component's year/mode transitions and table/chart projections.
const require = createRequire(import.meta.url)
const states = ['all', 'labor']
let cursor = 0
const Table = Object.assign(() => {}, { Summary: { Row: 'SummaryRow', Cell: 'SummaryCell' } })
const modules = {
  react: { useState: () => { const i = cursor++; return [states[i], value => { states[i] = value }] } },
  antd: { Empty: Object.assign(() => {}, { PRESENTED_IMAGE_SIMPLE: '' }), InputNumber: 'InputNumber', Table, Tabs: 'Tabs' },
  '@/stores/hrConfig': { useHrConfigStore: selector => selector({ data: { feeRate: [{ value: 5 }] } }) },
  '@/constants/hrMachine': { formatPersonMonth: value => value.toFixed(1) },
  '@/lib/hrNonLaborRange': { hrNonLaborMonthRange: () => ({ startMonth: '2026-09', endMonth: '2028-01' }) },
  '@/components/project-resources/ResourceInlineField': { __esModule: true, default: 'Inline' },
  '@/components/project-resources/resourceMonthlyPresentation': {
    resourceInvestmentStages: () => [],
    groupResourceMonths: months => [{ months, color: 'purple' }],
    summarizeResourceMonths: view => ({ total: view.visibleTotal, average: view.visibleTotal / view.months.length, peak: 0, stages: [] }),
    sumMonthlyRow: (row, months) => sumResourceCost(row.monthlyData, months),
  },
}
const module = { exports: {} }
const compiled = ts.transpileModule(fs.readFileSync(process.env.RESOURCE_MONTHLY_COMPONENT_PATH ?? 'src/components/project-resources/ResourceVersionViews.tsx', 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText
new Function('require', 'module', 'exports', compiled)(id => modules[id] ?? (id.startsWith('@/') ? load(path.resolve('src', `${id.slice(2)}.ts`)) : require(id)), module, module.exports)
const children = node => [node?.props?.children].flat(Infinity).filter(value => value != null)
const elements = node => typeof node === 'object' ? [node, ...children(node).flatMap(elements)] : []
const text = node => typeof node === 'object' ? children(node).map(text).join('') : String(node)
const props = { category: 'machine', version: { id: 'v', estimatedInvestment: 100, versionNumber: 'V成本验收', nonLaborInvestment: expense }, rows, readOnly: false, onSaveMonth: () => assert.fail('cost cells must not save') }
const render = () => { cursor = 0; return elements(module.exports.default(props)) }
let tree = render()
const card = () => children(tree.find(node => node.props?.className === 'pms-resource-view-stats'))[0]
assert.match(text(card()), /510\.00/)
assert.equal(tree.find(node => node.type === Table).props.dataSource.length, 1, 'labor mode has no expense row')
assert.ok(tree.find(node => node.type === 'Tabs' && node.props.className).props.items.find(item => item.key === '2026').label.includes('208.00 万元'))
tree.find(node => node.type === 'Tabs' && !node.props.className).props.onChange('cost')
tree = render()
let table = tree.find(node => node.type === Table)
assert.equal(table.props.dataSource.length, 2)
assert.equal(table.props.columns.find(column => column.key === '2026-09').render(null, table.props.dataSource[0]), '61.50')
assert.equal(table.props.columns.find(column => column.key === '2026-09').render(null, table.props.dataSource[1]), '10.00')
assert.match(text(table.props.summary()), /71\.50/)
assert.match(text(table.props.summary()), /510\.00\/510\.00/)
assert.ok(tree.some(node => node.type === 'title' && text(node) === '2026-09：71.50 万元'))
assert.equal(tree.some(node => node.type === 'Inline'), false)
tree.find(node => node.type === 'Tabs' && node.props.className).props.onChange('2027')
tree = render()
assert.match(text(card()), /2027 年总投入293\.50/)
table = tree.find(node => node.type === Table)
assert.ok(!table.props.columns.some(column => column.key === '2026-09'))
assert.match(text(table.props.summary()), /510\.00\/510\.00/, 'year filter keeps full-cycle balance')
props.version.nonLaborInvestment = { ...expense, items: [...expense.items, { id: 'new', monthlyAmounts: { '2027-01': 20000 } }] }
tree = render()
assert.match(text(card()), /295\.50/, 'editing expense updates selected-year card immediately')
assert.ok(tree.some(node => node.type === 'title' && text(node) === '2027-01：295.50 万元'))
tree.find(node => node.type === 'Tabs' && !node.props.className).props.onChange('labor')
tree = render()
assert.ok(tree.some(node => node.type === 'title' && text(node) === '2027-01：58.7 人月'))
assert.equal(tree.find(node => node.type === Table).props.dataSource.length, 1)
console.log('PASS actual monthly component: total/year cards, expense summary row, chart/table parity, read-only costs, reactive edits and unchanged labor mode')
