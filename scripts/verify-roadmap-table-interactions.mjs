#!/usr/bin/env node
import assert from 'node:assert/strict'
import { loadTypeScriptModule, projectRoot } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const React = loadTypeScriptModule(root, 'node_modules/react/index.js')
const { renderToStaticMarkup } = loadTypeScriptModule(root, 'node_modules/react-dom/server.node.js')
const { default: RoadmapTableView, formatRoadmapTableValue } = loadTypeScriptModule(root, 'src/components/roadmap/RoadmapTableView.tsx')
const { formatEvolutionCardTitle, formatRoadmapCardValue } = loadTypeScriptModule(root, 'src/components/roadmap/RoadmapProjectCard.tsx')
const { useRoadmapStore, createInitialRoadmapState, partializeRoadmapState, sanitizeRoadmapCurrentState } = loadTypeScriptModule(root, 'src/stores/roadmap.ts')
const noop = () => {}
const marketRow = { marketName: 'TECNO CAMON 40', brand: 'TECNO', projectCode: 'TEST40', source: 'normal', productType: '新品', androidVersion: 'Android 16' }
assert.equal(formatRoadmapTableValue('marketName', marketRow, []), 'CAMON 40')
assert.equal(formatRoadmapCardValue('marketName', marketRow, []), 'CAMON 40')
assert.equal(formatEvolutionCardTitle(marketRow), 'CAMON 40（TEST40）')
assert.equal(marketRow.marketName, 'TECNO CAMON 40', 'market display must not mutate saved values')
const markup = renderToStaticMarkup(React.createElement(RoadmapTableView, {
  rows: [], conflicts: [], versions: [], selectedTosVersionId: null,
  columnOrder: ['firstSaleTosVersionId', 'brand', 'marketName'],
  visibleColumns: ['firstSaleTosVersionId', 'brand', 'marketName'],
  sort: { field: null, direction: null }, canEdit: false,
  onViewProject: noop, onSortChange: noop, onOpenProjectHistory: noop,
  onOpenConflict: noop, onEditPlannedProject: noop, onDeletePlannedProject: noop,
  collapsedTargetVersionIds: new Set(), onToggleTarget: noop,
}))
assert.ok(markup.includes('aria-label="调整市场名列宽"'), 'roadmap market header must expose a resize handle')
assert.ok(markup.includes('aria-label="拖动市场名调整列顺序"'), 'roadmap market header must expose draggable column interaction')

useRoadmapStore.setState(createInitialRoadmapState())
useRoadmapStore.getState().setColumnWidth('marketName', 260)
useRoadmapStore.getState().setColumnWidth('brand', -10)
useRoadmapStore.getState().setColumnWidth('remark', 10000)
const persisted = partializeRoadmapState(useRoadmapStore.getState())
assert.deepEqual(persisted.columnWidths, { marketName: 260, brand: 80, remark: 600 })
const restored = sanitizeRoadmapCurrentState({ ...persisted, columnWidths: { ...persisted.columnWidths, removedColumn: 123, chipCode: 'bad' } })
assert.deepEqual(restored.columnWidths, { marketName: 260, brand: 80, remark: 600 }, 'refresh keeps valid widths and discards invalid/unknown data')
assert.deepEqual(sanitizeRoadmapCurrentState({}).columnWidths, {}, 'old preferences without widths remain compatible')

const state = useRoadmapStore.getState()
state.setColumnSettings({ order: ['firstSaleTosVersionId', 'marketName', 'brand'], visible: ['firstSaleTosVersionId', 'marketName', 'brand'] })
state.setViewMode('evolution')
state.setViewMode('table')
assert.deepEqual(useRoadmapStore.getState().columnOrder.slice(0, 3), ['firstSaleTosVersionId', 'marketName', 'brand'])
assert.equal(useRoadmapStore.getState().columnWidths.marketName, 260, 'view switching retains table widths')
console.log('PASS roadmap drag/resize controls, width persistence/sanitization and view switching')
