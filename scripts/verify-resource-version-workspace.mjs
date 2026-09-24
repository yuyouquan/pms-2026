import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'

const file = 'src/components/project-resources/resourceVersionViewData.ts'
const api = fs.existsSync(file) ? createTypeScriptModuleLoader()(path.resolve(file)) : {}
assert.equal(typeof api.buildResourceMonthlyView, 'function', 'selected-version monthly view must be implemented')
const rows = [
  { id: 'old', versionId: 'v1', primaryDepartment: '研发', secondaryDepartment: '软件', estimatedTotal: 15, monthlyData: { '2026-12': 4, '2027-01': 6 }, isArchived: false },
  { id: 'new', versionId: 'v2', primaryDepartment: '研发', secondaryDepartment: '软件', estimatedTotal: 99, monthlyData: { '2027-01': 99 } },
  { id: 'removed', versionId: 'v1', primaryDepartment: '研发', secondaryDepartment: '旧部门', estimatedTotal: 70, monthlyData: { '2027-01': 70 }, isArchived: true },
]
const all = api.buildResourceMonthlyView(rows, 'v1', '2026-12', '2027-02')
assert.deepEqual(all.months, ['2026-12', '2027-01', '2027-02'])
assert.deepEqual(all.years, ['2026', '2027'])
assert.equal(all.rows.length, 1)
assert.equal(all.allocatedTotal, 10)
assert.equal(all.estimatedTotal, 15)
assert.equal(all.unallocatedTotal, 5)
assert.deepEqual(all.totals, { '2026-12': 4, '2027-01': 6, '2027-02': 0 })
const year = api.buildResourceMonthlyView(rows, 'v1', '2026-12', '2027-02', '2027')
assert.deepEqual(year.months, ['2027-01', '2027-02'])
assert.equal(year.visibleTotal, 6)
assert.equal(year.allocatedTotal, 10, 'year filtering must not change full version allocation')
assert.equal(year.unallocatedTotal, 5)
assert.equal(api.buildResourceMonthlyView(rows, 'missing').rows.length, 0)
assert.deepEqual(rows[0].monthlyData, { '2026-12': 4, '2027-01': 6 }, 'view is read-only')
assert.deepEqual(api.buildResourceMonthlyView([{...rows[0],monthlyData:{'2027-03':2}}], 'v1', '2026-12','2027-02').months, ['2026-12','2027-01','2027-02','2027-03'], 'retained manual allocations remain visible')
assert.deepEqual(api.RESOURCE_TABS.map(tab => tab.label), ['总览','年度预算','项目概算','项目预算','项目核算'])
assert.equal(api.chooseResourceVersion([{id:'first',minorVersion:1},{id:'last',minorVersion:3}], 'missing')?.id,'last')
assert.equal(api.chooseResourceVersion([{id:'first',minorVersion:1},{id:'last',minorVersion:3}], 'first')?.id,'first','selecting history does not select latest')
console.log('PASS resource workspace: selected-version isolation, archived rows, cross-year view, allocation totals, immutable data, five tabs and selection')

const rangeApi = createTypeScriptModuleLoader()(path.resolve('src/lib/hrNonLaborRange.ts'))
const frozenDates = {str5:'2026-02-01',str5Plus6Months:'2026-12-01'}
assert.equal(rangeApi.hrNonLaborMonthRange('machine',frozenDates,true).endMonth,'2026-12', 'locked view retains saved derived milestone')
assert.equal(rangeApi.hrNonLaborMonthRange('machine',frozenDates).endMonth,'2026-08')
console.log('PASS locked historical milestone view retains snapshot range')

const cancellation = api.buildResourceMonthlyView([
 {...rows[0], estimatedTotal:5, monthlyData:{'2027-01':10}},
 {...rows[0], id:'second', estimatedTotal:5, monthlyData:{'2027-01':0}},
], 'v1')
assert.equal(cancellation.unallocatedTotal,0)
assert.equal(cancellation.remainingTotal,5,'underallocation must not cancel other department excess')
assert.equal(cancellation.excessTotal,5)
console.log('PASS independent department underallocation and excess')
