import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
const load = createTypeScriptModuleLoader()
const { nonLaborSpreadsheetColumns, parseNonLaborInvestmentRows } = load('src/lib/nonLaborSpreadsheet.ts')
const range = { startMonth:'2026-12', endMonth:'2027-02' }
const departments = [
  { id:'software', secondaryDepartment:'软件部', tertiaryDepartment:'驱动开发' },
  { id:'hardware', secondaryDepartment:'硬件部', tertiaryDepartment:'电源设计' },
]
const subjects = [{ id:'flight', secondarySubject:'交通费', tertiarySubject:'机票' }]
const headers = ['二级部门','三级部门','二级科目','三级科目','2026年12月（元）','2027年01月（元）','2027年02月（元）']
assert.deepEqual(nonLaborSpreadsheetColumns(range).map(column=>column.title), ['一级部门', ...headers])
const rows = [headers, [' 软件部 ','驱动开发','交通费','机票',1200.5,'2,500.00',''], ['硬件部','电源设计','交通费','机票',500,0,0]]
const sheet = XLSX.utils.aoa_to_sheet(rows)
const workbook = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(workbook, sheet, '非人力投入')
const reloaded = XLSX.read(XLSX.write(workbook, {type:'buffer',bookType:'xlsx'}))
const parsed = parseNonLaborInvestmentRows(XLSX.utils.sheet_to_json(reloaded.Sheets['非人力投入'],{header:1}),range,subjects,departments)
assert.equal(parsed.items.length,2)
assert.equal(parsed.items[0].secondaryDepartment,'软件部')
assert.equal(parsed.items[0].monthlyAmounts['2027-01'],2500)
assert.equal(parsed.items[0].monthlyAmounts['2027-02'],0)
assert.notEqual(parsed.items[0].id,parsed.items[1].id)
const parse = rows => parseNonLaborInvestmentRows(rows, range, subjects, departments)
assert.throws(()=>parse([headers,rows[1],rows[1]]),/重复/)
assert.throws(()=>parse([headers,['软件部','电源设计','交通费','机票',0,0,0]]),/第 2 行.*部门/)
assert.throws(()=>parse([headers,['软件部','驱动开发','差旅费','机票',0,0,0]]),/第 2 行.*科目/)
for (const amount of ['abc',-1,Infinity,1.001,true,'1,20']) {
  assert.throws(()=>parse([headers,['软件部','驱动开发','交通费','机票',amount,0,0]]),/金额|非负|小数/)
}
assert.throws(()=>parse([headers.slice(0,-1),rows[1]]),/模板|表头|月份/)
assert.throws(()=>parse([headers.map(h=>h==='2026年12月（元）'?'2026年11月（元）':h),rows[1]]),/模板|表头|月份/)
assert.throws(()=>parse([headers,[]]),/有效数据/)
assert.equal(rows[1][0],' 软件部 ', 'import must not mutate the original sheet data')
console.log('PASS non-labor Excel round trip, yuan values, departments, four-field duplicates, invalid files and atomic parsing')
