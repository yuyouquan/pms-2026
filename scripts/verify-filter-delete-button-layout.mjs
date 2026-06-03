import assert from 'node:assert/strict'
import fs from 'node:fs'

const checks = [
  {
    file: 'src/components/roadmap/MilestoneView.tsx',
    fieldOptionMarker: 'filterFieldOptions, tempFilters, condition.id',
  },
  {
    file: 'src/containers/ProjectSpaceContainer.tsx',
    fieldOptionMarker: 'planFilterFieldOptions, tempLevel1PlanFilters, condition.id',
  },
]

for (const { file, fieldOptionMarker } of checks) {
  const source = fs.readFileSync(file, 'utf8')
  const fieldOptionIndex = source.indexOf(fieldOptionMarker)
  assert.notEqual(fieldOptionIndex, -1, `${file} should render filter field options`)

  const rowStart = source.lastIndexOf('gridTemplateColumns', fieldOptionIndex)
  const inputStart = source.indexOf('{!isValuelessFilterOperator(condition.operator)', fieldOptionIndex)
  const deleteButtonIndex = source.indexOf('icon={<DeleteOutlined />}', fieldOptionIndex)

  assert.notEqual(rowStart, -1, `${file} should have a first-row grid for each filter condition`)
  assert.notEqual(inputStart, -1, `${file} should keep the value input in the second row`)
  assert.notEqual(deleteButtonIndex, -1, `${file} should render a delete button for each filter condition`)
  assert.ok(
    deleteButtonIndex < inputStart,
    `${file} should place the delete button in the first row before the value input row`,
  )
  assert.ok(
    source.slice(rowStart, inputStart).includes("gridTemplateColumns: 'minmax(0, 1fr) 116px 40px'"),
    `${file} should reserve a first-row column for the delete button`,
  )
}

console.log('filter delete buttons are placed in the first row')
