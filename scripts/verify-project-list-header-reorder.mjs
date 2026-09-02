#!/usr/bin/env node
import assert from 'node:assert/strict'
import { loadTypeScriptModule, projectRoot, readSource } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const columnOrder = loadTypeScriptModule(root, 'src/lib/projectListColumnOrder.ts')
const columnWidth = loadTypeScriptModule(root, 'src/lib/projectListColumnWidth.ts')
const tableSource = readSource(root, 'src/components/project-summary/ProjectSummaryTable.tsx')
const headerSource = readSource(root, 'src/components/project-summary/SortableProjectListHeader.tsx')
const globalStyles = readSource(root, 'src/styles/globals.css')

assert.equal(columnWidth.PROJECT_LIST_COLUMN_WIDTH_MIN, 80)
assert.equal(columnWidth.PROJECT_LIST_COLUMN_WIDTH_MAX, 600)
assert.deepEqual(
  columnWidth.normalizeProjectListColumnWidths(
    [{ key: 'projectName', width: 200 }, { key: 'milestone::STR1', width: 132 }],
    { projectName: 40, 'milestone::STR1': 1000, removed: 120, invalid: 'wide' },
  ),
  { projectName: 80, 'milestone::STR1': 600 },
  'stored widths keep only current leaf keys and clamp to the supported range',
)
assert.equal(columnWidth.resizeProjectListColumnWidth(200, 45), 245)
assert.equal(columnWidth.resizeProjectListColumnWidth(100, -100), 80)
assert.equal(columnWidth.getProjectListColumnWidth('projectName', 200, { projectName: 260 }), 260)
assert.equal(columnWidth.getProjectListColumnWidth('status', 112, {}), 112)

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

assert.equal(
  typeof columnOrder.canDropProjectListUnit,
  'function',
  'project-list unit model must expose fixed-target rejection',
)
assert.equal(
  columnOrder.canDropProjectListUnit(units, 'status', 'projectName'),
  false,
  'fixed units must not be valid drop targets for non-fixed units',
)
assert.equal(
  columnOrder.canDropProjectListUnit(units, 'status', 'brand'),
  true,
  'ordinary non-fixed units remain valid drop targets',
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
assert.match(headerSource, /disabled:\s*unitKey\s*\?\s*\{\s*draggable:\s*locked/, 'fixed headers must disable dragging')
assert.match(headerSource, /data-project-list-column-unit=\{unitKey\}/, 'sortable header must expose its display unit')
assert.match(headerSource, /DragOverlay/, 'sortable header must render one drag overlay for the active display unit')
assert.match(headerSource, /activeUnitKey/, 'sortable header context must track the active display unit')
assert.match(headerSource, /onDragOver/, 'sortable header context must track the live Feishu-style insertion target')
assert.match(headerSource, /dropEdge:\s*'before'\s*\|\s*'after'/, 'column dragging must expose an explicit before or after insertion edge')
assert.match(headerSource, /onDragStateChange/, 'table body and header must share one live drag state')
assert.match(headerSource, /--pms-project-list-drop-x/, 'live target geometry must drive one continuous table insertion line')
assert.match(headerSource, /is-unit-dragging/, 'every header in the active milestone unit must share one placeholder state')
assert.match(
  headerSource,
  /const holdHeaderPosition = Boolean\(activeUnitKey\)/,
  'all header cells must stay in their original positions while a drag is active',
)
assert.match(
  headerSource,
  /transform:\s*holdHeaderPosition\s*\?\s*undefined/,
  'dnd transforms must be suppressed until the pointer is released',
)
assert.match(headerSource, /droppable:\s*false/, 'locked headers must stay measurable as explicit rejected drop targets')
assert.match(headerSource, /aria-label=\{!locked\s*&&\s*unitKey\s*\?\s*`拖动\$\{unitLabel\}调整列顺序`/, 'header drag handles need Chinese unit labels')
assert.match(headerSource, /已开始拖动\$\{getUnitLabel\(active\)\}/, 'keyboard announcements need Chinese unit labels')
assert.match(headerSource, /canDrop\(getUnitKey\(active\),\s*getUnitKey\(over\)\)/, 'drop announcements must use the shared validity predicate')
assert.match(headerSource, /未移动\$\{getUnitLabel\(active\)\}：[^`]*不可作为放置位置/, 'rejected keyboard drops need explicit Chinese feedback')
assert.doesNotMatch(headerSource, /Draggable item/, 'header announcements must not expose technical drag ids')
assert.match(tableSource, /const handleHeaderDragEnd[\s\S]*moveColumnSetting\(/, 'one handler must reorder ordinary and milestone headers')
assert.match(tableSource, /active\.data\.current\?\.unitKey/, 'header drag must map leaf and grouped headers to their display unit')
assert.match(tableSource, /const canDropHeaderUnit = useCallback\([\s\S]*canDropProjectListUnit/, 'table must expose one shared header drop predicate')
assert.match(tableSource, /if \(!canDropHeaderUnit\(activeUnitKey, overUnitKey\)\) return/, 'header state updates must use the shared drop predicate')
assert.match(tableSource, /canDrop=\{canDropHeaderUnit\}/, 'announcements must receive the same drop predicate')
assert.match(tableSource, /components=\{\{[\s\S]*header:[\s\S]*SortableProjectListHeader/, 'Ant table must render the sortable header cell')
assert.match(tableSource, /applyColumnSettings/, 'header and field settings must share one update function')
assert.match(tableSource, /columnWidths\?:\s*Record<string, number>/, 'stored preferences must persist leaf column widths')
assert.match(tableSource, /normalizeProjectListColumnWidths/, 'stored widths must be normalized against live leaf definitions')
assert.match(tableSource, /getProjectListColumnWidth/, 'rendered columns must consume persisted widths')
assert.match(tableSource, /pms-project-list-column-drag-source/, 'source unit must highlight its complete body columns')
assert.match(tableSource, /pms-project-list-column-drop-\$\{headerDragState\.dropEdge\}/, 'drop target must expose a body-wide insertion edge')
assert.match(tableSource, /onDragStateChange=\{setHeaderDragState\}/, 'table body must receive drag state from the sortable header context')
assert.match(globalStyles, /\.pms-project-list-sortable-header\s*\{[\s\S]*cursor:\s*grab/, 'draggable headers need grab affordance')
assert.match(globalStyles, /\.pms-project-list-sortable-header\.is-dragging/, 'dragging headers need visual feedback')
assert.match(globalStyles, /\.pms-project-list-sortable-header\.is-locked/, 'fixed headers need a locked visual state')
assert.match(globalStyles, /\.pms-project-list-column-drag-source/, 'Feishu-style dragging must tint the entire source column')
assert.match(globalStyles, /\.pms-project-list-column-drop-before/, 'Feishu-style dragging must draw a full-height before edge')
assert.match(globalStyles, /\.pms-project-list-column-drop-after/, 'Feishu-style dragging must draw a full-height after edge')
assert.match(globalStyles, /data-column-drop-active="true"\]\:\:after/, 'Feishu-style insertion line must span the complete table shell')
assert.match(
  globalStyles,
  /data-column-drop-active="true"\]\:\:after\s*\{[\s\S]*?width:\s*2px;/,
  'the continuous insertion line must use the approved thin two-pixel width',
)
assert.doesNotMatch(
  globalStyles,
  /pms-project-list-column-drop-(?:before|after)[\s\S]{0,180}(?:border-(?:left|right)|box-shadow):[^;]*4px/,
  'header and body drop edges must not render four-pixel bars',
)

console.log('project list header reorder model contract passed')
