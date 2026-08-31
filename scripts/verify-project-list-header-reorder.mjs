#!/usr/bin/env node
import assert from 'node:assert/strict'
import { loadTypeScriptModule, projectRoot } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const columnOrder = loadTypeScriptModule(root, 'src/lib/projectListColumnOrder.ts')

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

console.log('project list header reorder model contract passed')
