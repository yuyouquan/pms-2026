import assert from 'node:assert/strict'
import fs from 'node:fs'

const checks = [
  {
    file: 'src/components/roadmap/MilestoneView.tsx',
    fieldOptionMarker: 'filterFieldOptions, tempFilters, condition.id',
    valueMarker: ': renderFilterValueControl(condition)',
  },
  {
    file: 'src/containers/ProjectSpaceContainer.tsx',
    fieldOptionMarker: 'planFilterFieldOptions, tempLevel1PlanFilters, condition.id',
    valueMarker: '<FilterConditionValue',
  },
]

for (const { file, fieldOptionMarker, valueMarker } of checks) {
  const source = fs.readFileSync(file, 'utf8')
  const fieldOptionIndex = source.indexOf(fieldOptionMarker)
  assert.notEqual(fieldOptionIndex, -1, `${file} should render filter field options`)

  const rowStart = source.lastIndexOf('className="pms-filter-condition-row"', fieldOptionIndex)
  const rowEnd = source.indexOf('</div>', fieldOptionIndex)
  const inputStart = source.indexOf(valueMarker, fieldOptionIndex)
  const deleteButtonIndex = source.indexOf('icon={<DeleteOutlined />}', fieldOptionIndex)

  assert.notEqual(rowStart, -1, `${file} uses the shared responsive filter grid`)
  assert.notEqual(inputStart, -1, `${file} renders a value control`)
  assert.notEqual(deleteButtonIndex, -1, `${file} should render a delete button for each filter condition`)
  assert.ok(
    inputStart < deleteButtonIndex && deleteButtonIndex < rowEnd,
    `${file} places the delete action after the value control inside the same grid row`,
  )
}

const styles = fs.readFileSync('src/styles/globals.css', 'utf8')
assert.match(styles, /\.pms-filter-condition-row\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:[^;]*40px;/s, 'desktop filter rows reserve a final column for deletion')
assert.match(styles, /@media \(max-width: 720px\)[\s\S]{0,600}\.pms-filter-condition-row > :nth-child\(4\)\s*\{[^}]*grid-column:\s*3;[^}]*grid-row:\s*1;/s, 'narrow filter rows keep the delete action in the first row')
console.log('responsive filter delete button layout passed')
