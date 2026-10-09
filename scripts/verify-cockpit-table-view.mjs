import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
const load = createTypeScriptModuleLoader()
const { nextCockpitSort, sortCockpitRows, cockpitColumnWidth, resizeCockpitColumn } = load(path.resolve('src/components/cockpit/cockpitTableView.ts'))
const { useCockpitUiStore } = load(path.resolve('src/stores/cockpitUi.ts'))
assert.deepEqual(nextCockpitSort(undefined, 'budget'), { key: 'budget', descending: false })
assert.deepEqual(nextCockpitSort({ key: 'budget', descending: false }, 'budget'), { key: 'budget', descending: true })
assert.equal(nextCockpitSort({ key: 'budget', descending: true }, 'budget'), undefined)
assert.deepEqual(nextCockpitSort({ key: 'name', descending: true }, 'budget'), { key: 'budget', descending: false })
const rows = [{ key: 'missing' }, { key: 'zero', budget: 0 }, { key: 'high', budget: 20 }, { key: 'low', budget: 10 }]
const columns = [{ key: 'budget', value: row => row.budget }]
assert.deepEqual(sortCockpitRows(rows, columns, { key: 'budget', descending: false }).map(row => row.key), ['zero', 'low', 'high', 'missing'])
assert.deepEqual(sortCockpitRows(rows, columns, { key: 'budget', descending: true }).map(row => row.key), ['high', 'low', 'zero', 'missing'])
assert.equal(sortCockpitRows(rows, columns, { key: 'hidden', descending: true }), rows, 'absent sort column uses original order')
assert.equal(rows[0].key, 'missing', 'sorting never mutates facts')
const view = { widths: { name: 450, budget: 190 }, sort: { key: 'budget', descending: true } }
assert.equal(cockpitColumnWidth('name', 270, view, false, true), 450)
assert.equal(cockpitColumnWidth('name', 270, view, true, true), 160, 'narrow fixed column leaves room to read values')
assert.equal(cockpitColumnWidth('budget', 145, view, true, false), 190)
assert.equal(cockpitColumnWidth('name', 270, view, false, true), 450, 'automatic narrow adaptation preserves desktop preference')
assert.equal(resizeCockpitColumn('name', 270, view, true, true, 180), view, 'no-op expansion at compact cap cannot overwrite desktop preference')
assert.equal(resizeCockpitColumn('name', 270, view, true, true, 140).widths.name, 140, 'intentional visible resize saves new preference')
const state = () => useCockpitUiStore.getState()
state().updateOverviewTable('甲', 'project', view)
state().updateOverviewTable('甲', 'category', { widths: { name: 210 } })
state().updateOverviewTable('乙', 'project', { widths: {}, sort: { key: 'annual', descending: false } })
const before = state().preferencesByActor['甲']
state().updatePreferences('甲', { mode: 'cost', dates: ['2026-02-01', '2026-02-28'] })
assert.deepEqual(state().preferencesByActor['甲'].overviewTables.project, view, 'units/date changes preserve table context')
state().resetFilters('甲')
assert.deepEqual(state().preferencesByActor['甲'].overviewTables.project, view, 'filter reset preserves table presentation')
state().updateOverviewTable('甲', 'project', { ...view, sort: undefined })
assert.equal(before.overviewTables.project.sort.key, 'budget', 'previous snapshots stay immutable')
assert.equal(state().preferencesByActor['甲'].overviewTables.category.widths.name, 210, 'tables remain independent')
assert.equal(state().preferencesByActor['乙'].overviewTables.project.sort.key, 'annual', 'actors remain independent')
state().updateOverviewTable('甲', 'project', { widths: {} })
assert.deepEqual(state().preferencesByActor['甲'].overviewTables.project.widths, {}, 'explicit reset restores default widths')
console.log('PASS cockpit table view: sort cycle, missing-last, original order, nonmutation, responsive width and per-actor/per-table navigation memory')
