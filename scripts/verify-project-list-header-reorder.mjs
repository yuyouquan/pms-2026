#!/usr/bin/env node
import assert from 'node:assert/strict'
import { loadTypeScriptModule, projectRoot, readSource } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const columnOrder = loadTypeScriptModule(root, 'src/lib/projectListColumnOrder.ts')
const tableSource = readSource(root, 'src/components/project-summary/ProjectSummaryTable.tsx')
const headerSource = readSource(root, 'src/components/project-summary/SortableProjectListHeader.tsx')
const globalStyles = readSource(root, 'src/styles/globals.css')

const definitions = [
  { key: 'projectName', title: '项目名', defaultVisible: true, hideable: false, fixed: 'left', source: 'system' },
  { key: 'brand', title: '品牌', defaultVisible: true, hideable: false, source: 'system' },
  { key: 'milestone::STR1', title: 'STR1', defaultVisible: true, hideable: false, source: 'templateTask' },
  { key: 'milestone::STR2', title: 'STR2', defaultVisible: true, hideable: false, source: 'templateTask' },
  { key: 'status', title: '状态', defaultVisible: true, hideable: true, source: 'projectInfo' },
]

const units = columnOrder.buildProjectListColumnUnits(definitions)
assert.deepEqual(
  units.map(unit => unit.key),
  ['projectName', 'brand', 'milestone', 'status'],
  'template-task leaves collapse to one display unit at their earliest position',
)
assert.deepEqual(
  columnOrder.getProjectListUnitLeafKeys(units, 'milestone'),
  ['milestone::STR1', 'milestone::STR2'],
  'milestone unit preserves template-internal leaf order',
)
assert.equal(units.find(unit => unit.key === 'milestone')?.title, '里程碑')
assert.equal(units.find(unit => unit.key === 'milestone')?.kind, 'milestone')
assert.equal(units.find(unit => unit.key === 'milestone')?.hideable, true)

const migrated = columnOrder.normalizeProjectListUnitSettings(units, {
  order: ['projectName', 'milestone::STR2', 'status', 'milestone::STR1', 'brand'],
  visible: definitions.map(item => item.key),
})
assert.deepEqual(
  migrated.order,
  ['projectName', 'milestone', 'status', 'brand'],
  'legacy milestone leaves migrate as one block at the earliest legacy leaf position',
)
assert.deepEqual(
  migrated.visible,
  ['projectName', 'brand', 'milestone', 'status'],
  'legacy leaf visibility migrates to unit visibility',
)

const hiddenMilestone = columnOrder.normalizeProjectListUnitSettings(units, {
  order: definitions.map(item => item.key),
  visible: ['projectName', 'brand', 'status'],
})
assert.equal(hiddenMilestone.visible.includes('milestone'), false, 'milestone is hidden when all legacy leaves are hidden')

const expanded = columnOrder.expandProjectListUnitSettings(units, {
  order: ['projectName', 'status', 'milestone', 'brand'],
  visible: ['projectName', 'milestone', 'brand'],
})
assert.deepEqual(expanded.order, [
  'projectName', 'status', 'milestone::STR1', 'milestone::STR2', 'brand',
])
assert.deepEqual(expanded.visible, [
  'projectName', 'brand', 'milestone::STR1', 'milestone::STR2',
])

const changedTemplateUnits = columnOrder.buildProjectListColumnUnits([
  definitions[0],
  definitions[1],
  definitions[2],
  { key: 'milestone::STR3', title: 'STR3', defaultVisible: true, hideable: false, source: 'templateTask' },
  definitions[4],
])
const changedTemplateSettings = columnOrder.normalizeProjectListUnitSettings(changedTemplateUnits, migrated)
assert.deepEqual(changedTemplateSettings.order, migrated.order, 'template leaf add/remove does not disturb unit order')
assert.deepEqual(
  columnOrder.expandProjectListUnitSettings(changedTemplateUnits, changedTemplateSettings).order,
  ['projectName', 'milestone::STR1', 'milestone::STR3', 'status', 'brand'],
  'expanded block follows the current template order after template changes',
)

const fixedNormalized = columnOrder.normalizeProjectListUnitSettings(units, {
  order: ['status', 'milestone', 'brand', 'projectName'],
  visible: ['status', 'milestone', 'brand', 'projectName'],
})
assert.deepEqual(
  fixedNormalized.order,
  ['projectName', 'status', 'milestone', 'brand'],
  'fixed units remain before reorderable units',
)

assert.match(
  tableSource,
  /const leafColumnDefinitions = useMemo/,
  'project summary table must distinguish leaf definitions from display units',
)
assert.match(
  tableSource,
  /const columnUnitDefinitions = useMemo[\s\S]*buildProjectListColumnUnits\(leafColumnDefinitions\)/,
  'project summary table must build atomic display units',
)
assert.match(
  tableSource,
  /normalizeProjectListUnitSettings\(\s*columnUnitDefinitions/,
  'stored preferences must migrate through the unit normalizer',
)
assert.match(
  tableSource,
  /expandProjectListUnitSettings\(\s*columnUnitDefinitions,\s*columnSettings/,
  'table rendering must expand the canonical unit settings',
)
assert.match(
  tableSource,
  /<SortableColumnSettings[\s\S]*definitions=\{columnUnitDefinitions\}[\s\S]*value=\{columnSettings\}/,
  'field configuration must consume the same canonical unit settings',
)
assert.match(headerSource, /DndContext/, 'sortable header must provide a drag context')
assert.match(headerSource, /horizontalListSortingStrategy/, 'sortable header must constrain sorting horizontally')
assert.match(
  headerSource,
  /useSensor\(PointerSensor,\s*\{[\s\S]*activationConstraint:\s*\{\s*distance:\s*6\s*\}/,
  'sortable header must require six pixels of pointer movement',
)
assert.match(headerSource, /useSortable\(\{[\s\S]*disabled:\s*locked/, 'fixed headers must disable sorting')
assert.match(headerSource, /data-project-list-column-unit=\{unitKey\}/, 'sortable header must expose its display unit')
assert.match(tableSource, /const handleHeaderDragEnd[\s\S]*moveColumnSetting\(/, 'one handler must reorder ordinary and milestone headers')
assert.match(tableSource, /active\.data\.current\?\.unitKey/, 'header drag must map leaf and grouped headers to their display unit')
assert.match(tableSource, /components=\{\{[\s\S]*header:[\s\S]*SortableProjectListHeader/, 'Ant table must render the sortable header cell')
assert.match(tableSource, /applyColumnSettings/, 'header and field settings must share one update function')
assert.match(globalStyles, /\.pms-project-list-sortable-header\s*\{[\s\S]*cursor:\s*grab/, 'draggable headers need grab affordance')
assert.match(globalStyles, /\.pms-project-list-sortable-header\.is-dragging/, 'dragging headers need visual feedback')
assert.match(globalStyles, /\.pms-project-list-sortable-header\.is-locked/, 'fixed headers need a locked visual state')

console.log('project list header reorder model contract passed')
