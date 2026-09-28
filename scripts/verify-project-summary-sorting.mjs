#!/usr/bin/env node
import assert from 'node:assert/strict'
import { loadTypeScriptModule, projectRoot } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const sorting = loadTypeScriptModule(root, 'src/lib/projectSummary.ts')
assert.equal(typeof sorting.sortProjectSummaryRows, 'function', 'project-list sorting must be available before pagination')

const sort = sorting.sortProjectSummaryRows
assert.equal(typeof sorting.resolveProjectSummarySort, 'function', 'hidden or stale project-list sort must be cleared')
assert.deepEqual(
  sorting.resolveProjectSummarySort({ field: 'marketName', direction: 'ascend', variant: 'machine' }, ['brand', 'marketName'], 'machine'),
  { field: 'marketName', direction: 'ascend', variant: 'machine' },
  'visible sort remains active',
)
assert.deepEqual(
  sorting.resolveProjectSummarySort({ field: 'marketName', direction: 'ascend', variant: 'machine' }, ['brand'], 'machine'),
  { field: null, direction: null, variant: 'machine' },
  'hiding the sorted column clears its sort',
)
assert.deepEqual(
  sorting.resolveProjectSummarySort({ field: 'marketName', direction: 'ascend', variant: 'machine' }, ['brand', 'marketName'], 'tos'),
  { field: null, direction: null, variant: 'tos' },
  'changing matrix variants clears a stale sort even if the field key exists in both views',
)
const rows = [
  { key: 'a1', brand: 'TECNO', productLine: 'CAMON', productSeries: '40', marketName: 'TECNO CAMON 40', projectCount: '10', startingRam: '8GB', firstSaleTosVersion: 'tOS 3.10', str5Date: '2026-10-10' },
  { key: 'b1', brand: 'Infinix', productLine: 'NOTE', productSeries: '50', marketName: 'Infinix NOTE 50', projectCount: '2', startingRam: '4GB', firstSaleTosVersion: 'tOS 3.2', str5Date: '2026-10-02' },
  { key: 'a2', brand: 'TECNO', productLine: 'CAMON', productSeries: '40', marketName: 'TECNO CAMON 40 Pro', projectCount: '3', startingRam: '12GB', firstSaleTosVersion: 'tOS 4.0', str5Date: '2026-10-01' },
  { key: 'a3', brand: 'TECNO', productLine: 'POVA', productSeries: '7', marketName: 'TECNO POVA 7', projectCount: '4', startingRam: '6GB', firstSaleTosVersion: 'tOS 2.9', str5Date: '2026-10-05' },
]
const definitions = [
  { key: 'marketName', inputType: 'system' },
  { key: 'projectCount', inputType: 'system' },
  { key: 'startingRam', inputType: 'system' },
  { key: 'firstSaleTosVersion', inputType: 'system' },
  { key: 'str5Date', inputType: 'system' },
]
const keys = values => values.map(row => row.key)

assert.deepEqual(keys(sort(rows, 'projectCount', 'ascend', definitions)), ['b1', 'a2', 'a3', 'a1'], 'numeric count sort uses number order')
assert.deepEqual(keys(sort(rows, 'startingRam', 'ascend', definitions)), ['b1', 'a3', 'a1', 'a2'], 'RAM sort uses capacity order')
assert.deepEqual(keys(sort(rows, 'firstSaleTosVersion', 'ascend', definitions)), ['a3', 'b1', 'a1', 'a2'], 'tOS sort uses semantic version order')
assert.deepEqual(keys(sort(rows, 'str5Date', 'ascend', definitions)), ['a2', 'b1', 'a3', 'a1'], 'date sort uses calendar order')
assert.deepEqual(keys(sort(rows, 'marketName', 'descend', definitions)), ['a3', 'b1', 'a2', 'a1'], 'text descending follows visible market labels')
assert.deepEqual(keys(sort([
  { key: 'z', brand: 'Infinix', marketName: 'Infinix Zeta' },
  { key: 'a', brand: 'TECNO', marketName: 'TECNO Alpha' },
], 'marketName', 'ascend', definitions)), ['a', 'z'], 'market names sort by their visible label')
assert.deepEqual(keys(sort(rows, 'projectCount', null, definitions)), ['a1', 'b1', 'a2', 'a3'], 'clearing sort restores source order')
assert.deepEqual(keys(sort(rows, 'projectCount', 'ascend', definitions, { machineHierarchy: true })), ['a3', 'a1', 'a2', 'b1'], 'machine sorting retains contiguous brand, line and series groups')
assert.deepEqual(keys(sort(rows, 'projectCount', 'descend', definitions, { machineHierarchy: true })), ['a1', 'a2', 'a3', 'b1'], 'machine descending sorts complete groups before rows')
const countRows = [
  { key: 'single', brand: 'TECNO', productLine: 'POVA', productSeries: '7' },
  { key: 'pair-1', brand: 'Infinix', productLine: 'NOTE', productSeries: '50' },
  { key: 'pair-2', brand: 'Infinix', productLine: 'NOTE', productSeries: '50' },
]
assert.deepEqual(keys(sort(countRows, 'projectCount', 'descend', definitions, { machineHierarchy: true })), ['pair-1', 'pair-2', 'single'], 'project count sorts by filtered series size, even when source rows have no count field')
const missingGroupRows = [
  { key: 'missing-a', brand: '-', productLine: '-', productSeries: '-', projectName: 'Z' },
  { key: 'named', brand: 'TECNO', productLine: 'CAMON', productSeries: '40', projectName: 'M' },
  { key: 'missing-b', brand: '', productLine: '', productSeries: '', projectName: 'A' },
]
assert.deepEqual(keys(sort(missingGroupRows, 'projectName', 'ascend', definitions, { machineHierarchy: true })), ['missing-b', 'missing-a', 'named'], 'blank and dash hierarchy labels form one contiguous group')
const technicalRows = [
  { key: 'tdt-a-2', targetProjectId: 'tdt-a', projectName: 'Z' },
  { key: 'tdt-b-1', targetProjectId: 'tdt-b', projectName: 'M' },
  { key: 'tdt-a-1', targetProjectId: 'tdt-a', projectName: 'A' },
]
assert.deepEqual(keys(sort(technicalRows, 'projectName', 'ascend', definitions, { parentField: 'targetProjectId' })), ['tdt-a-1', 'tdt-a-2', 'tdt-b-1'], 'technical children stay under their TDT parent when sorted')
assert.deepEqual(keys(rows), ['a1', 'b1', 'a2', 'a3'], 'sorting never mutates store rows')

const market = loadTypeScriptModule(root, 'src/lib/marketNameDisplay.ts')
assert.equal(market.formatMarketName('TECNO CAMON 40', 'TECNO'), 'CAMON 40')
assert.equal(market.formatMarketName('Infinix NOTE 50'), 'NOTE 50', 'known brand prefixes are removable without an explicit brand')
assert.equal(market.formatMarketName('CUSTOM Alpha', 'CUSTOM'), 'Alpha', 'row brand is a valid display prefix')
assert.equal(market.formatMarketName('TECNO-CAMON 40', 'TECNO'), 'CAMON 40', 'punctuation can delimit a leading brand')
assert.equal(market.formatMarketName('MY TECNO CAMON 40', 'TECNO'), 'MY TECNO CAMON 40', 'middle words remain')
assert.equal(market.formatMarketName('TECNOCAMON 40', 'TECNO'), 'TECNOCAMON 40', 'partial brand prefixes remain')
assert.equal(market.formatMarketName('TECNO', 'TECNO'), 'TECNO', 'brand-only market names remain readable')

console.log('project summary sorting and market display: passed')
