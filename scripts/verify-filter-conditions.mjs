import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'

const modulePath = path.resolve('src/lib/filterConditions.ts')

if (!fs.existsSync(modulePath)) {
  throw new Error(`Missing shared filter module: ${modulePath}`)
}

const source = fs.readFileSync(modulePath, 'utf8')
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
})

const sandbox = {
  exports: {},
  module: { exports: {} },
}
sandbox.module.exports = sandbox.exports
vm.runInNewContext(outputText, sandbox, { filename: modulePath })

const {
  DATE_FILTER_OPERATORS,
  ENUM_FILTER_OPERATORS,
  FILTER_OPERATORS,
  applyFilterConditions,
  createFilterCondition,
  getFieldOptionsWithDuplicateDisabled,
  getDefaultFilterOperator,
  isFilterConditionActive,
  isMultiValueFilterOperator,
  isValuelessFilterOperator,
  normalizeFilterConditions,
} = sandbox.module.exports

const plain = (value) => JSON.parse(JSON.stringify(value))

assert.deepEqual(
  plain(FILTER_OPERATORS.map((item) => item.label)),
  ['等于', '不等于', '包含', '不包含', '为空', '不为空'],
)
assert.deepEqual(
  plain(ENUM_FILTER_OPERATORS.map((item) => item.label)),
  ['等于', '不等于', '包含', '不包含', '为空', '不为空'],
)
assert.deepEqual(
  plain(DATE_FILTER_OPERATORS.map((item) => item.label)),
  ['等于', '不等于', '早于', '晚于'],
)
assert.equal(createFilterCondition().operator, 'contains')
assert.equal(getDefaultFilterOperator('text'), 'contains')
assert.equal(getDefaultFilterOperator('enum'), 'contains')
assert.equal(getDefaultFilterOperator('date'), 'equals')
assert.equal(isMultiValueFilterOperator('contains', 'enum'), true)
assert.equal(isMultiValueFilterOperator('notContains', 'enum'), true)
assert.equal(isMultiValueFilterOperator('equals', 'enum'), false)

assert.equal(isValuelessFilterOperator('isEmpty'), true)
assert.equal(isValuelessFilterOperator('isNotEmpty'), true)
assert.equal(isValuelessFilterOperator('contains'), false)

assert.equal(isFilterConditionActive({ id: 'a', field: 'owner', operator: 'isEmpty', value: '' }), true)
assert.equal(isFilterConditionActive({ id: 'a', field: 'owner', operator: 'contains', value: '' }), false)

const rows = [
  { name: 'Alpha', owner: '张三', status: '进行中', note: '' },
  { name: 'Beta', owner: '李四', status: '已完成', note: null },
  { name: 'Gamma', owner: '', status: '未开始', note: 'ready' },
  { name: 'Delta', owner: '王五', status: '未开始', note: '-', dueDate: '-' },
  { name: 'Epsilon', owner: '赵六', status: '未开始', note: '—', dueDate: '—' },
]

assert.deepEqual(
  plain(applyFilterConditions(rows, [{ id: '1', field: 'owner', operator: 'notEquals', value: '张三' }]).map((row) => row.name)),
  ['Beta', 'Gamma', 'Delta', 'Epsilon'],
)

const enumDefinitions = [{
  key: 'status',
  label: '状态',
  kind: 'enum',
  options: [
    { label: '进行中', value: '进行中' },
    { label: '未开始', value: '未开始' },
  ],
}]
assert.deepEqual(
  plain(applyFilterConditions(
    rows,
    [{ id: 'enum-contains', field: 'status', operator: 'contains', value: ['进行中', '已完成'] }],
    enumDefinitions,
  ).map(row => row.name)),
  ['Alpha', 'Beta'],
  'enum contains must match any selected option',
)
assert.deepEqual(
  plain(applyFilterConditions(
    rows,
    [{ id: 'enum-not-contains', field: 'status', operator: 'notContains', value: ['进行中', '已完成'] }],
    enumDefinitions,
  ).map(row => row.name)),
  ['Gamma', 'Delta', 'Epsilon'],
  'enum notContains must reject every selected option',
)
assert.deepEqual(
  plain(normalizeFilterConditions(
    [{ id: 'legacy-any', field: 'status', operator: 'equalsAny', value: ['进行中', '已完成'] }],
    enumDefinitions,
  )),
  [{ id: 'legacy-any', field: 'status', operator: 'contains', value: ['进行中', '已完成'] }],
  'legacy equalsAny must migrate to enum contains',
)
assert.deepEqual(
  plain(applyFilterConditions(rows, [{ id: '1', field: 'note', operator: 'isEmpty', value: '' }]).map((row) => row.name)),
  ['Alpha', 'Beta', 'Delta', 'Epsilon'],
)
assert.deepEqual(
  plain(applyFilterConditions(rows, [{ id: '1', field: 'note', operator: 'isNotEmpty', value: '' }]).map((row) => row.name)),
  ['Gamma'],
)

assert.deepEqual(
  plain(applyFilterConditions(
    [
      ...rows,
      { name: 'Zeta', dueDate: '2026-08-01' },
    ],
    [{ id: '1', field: 'dueDate', operator: 'before', value: '2026-09-01' }],
    [{ key: 'dueDate', label: '计划完成日期', kind: 'date' }],
  ).map((row) => row.name)),
  ['Zeta'],
  'missing-value sentinels must not participate in date comparisons',
)

const paddedRows = [{ name: ' Alpha ' }]
assert.deepEqual(
  plain(applyFilterConditions(paddedRows, [{ id: 'legacy-equals', field: 'name', operator: 'equals', value: 'Alpha' }])),
  [],
  'legacy equals must preserve actual-value whitespace',
)
assert.deepEqual(
  plain(applyFilterConditions(paddedRows, [{ id: 'legacy-not-equals', field: 'name', operator: 'notEquals', value: 'Alpha' }])),
  paddedRows,
  'legacy notEquals must preserve actual-value whitespace',
)
assert.deepEqual(
  plain(applyFilterConditions(
    paddedRows,
    [{ id: 'typed-equals', field: 'name', operator: 'equals', value: 'Alpha' }],
    [{ key: 'name', label: '项目名', kind: 'text' }],
  )),
  paddedRows,
  'typed roadmap filters may normalize actual-value whitespace',
)

assert.deepEqual(
  plain(normalizeFilterConditions([
    { id: '1', field: 'owner', operator: 'contains', value: '张' },
    { id: '2', field: 'owner', operator: 'equals', value: '李四' },
    { id: '3', field: 'note', operator: 'isEmpty', value: 'will-clear' },
  ])),
  [
    { id: '1', field: 'owner', operator: 'contains', value: '张' },
    { id: '3', field: 'note', operator: 'isEmpty', value: '' },
  ],
)

assert.deepEqual(
  plain(getFieldOptionsWithDuplicateDisabled(
    [
      { value: 'owner', label: '责任人' },
      { value: 'status', label: '状态' },
    ],
    [
      { id: '1', field: 'owner', operator: 'equals', value: '张三' },
      { id: '2', field: '', operator: 'equals', value: '' },
    ],
    '2',
  )),
  [
    { value: 'owner', label: '责任人', disabled: true },
    { value: 'status', label: '状态', disabled: false },
  ],
)

console.log('filter condition checks passed')
