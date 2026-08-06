#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8')

const projectListSource = read('src/containers/ProjectListContainer.tsx')
const columnSettingsSource = read('src/components/shared/SortableColumnSettings.tsx')
const globalStyles = read('src/styles/globals.css')

assert.match(projectListSource, /const projectCardPageSize = 15/, 'card view paginates 15 projects')
assert.equal((projectListSource.match(/className="pms-project-list-card-column"/g) || []).length, 3, 'all project card variants use the five-column hook')
assert.match(projectListSource, /UnorderedListOutlined/, 'list view exposes an icon')
assert.match(projectListSource, /AppstoreOutlined/, 'card view exposes an icon')
assert.match(projectListSource, /CalendarOutlined/, 'calendar view exposes an icon')
assert.match(projectListSource, /aria-label="全屏展示"[\s\S]{0,120}<FullscreenOutlined/, 'fullscreen is an icon-only accessible action')
assert.doesNotMatch(projectListSource, /aria-label="全屏展示"[\s\S]{0,180}>\s*全屏\s*<\/Button>/, 'fullscreen does not repeat a visible text label')

assert.match(columnSettingsSource, /const commitDraft =/, 'field configuration centralizes immediate commits')
assert.match(columnSettingsSource, /onApply\(normalized\)/, 'field configuration emits normalized settings immediately')
assert.match(columnSettingsSource, /footer=\{null\}/, 'field configuration has no footer actions')
assert.doesNotMatch(columnSettingsSource, />取消<\/Button>/, 'field configuration has no cancel button')
assert.doesNotMatch(columnSettingsSource, />确定<\/Button>/, 'field configuration has no confirm button')

for (const token of [
  '--pms-font-size-compact: 12px',
  '--pms-control-height: 28px',
  '--pms-table-head-height: 32px',
  '--pms-table-row-height: 34px',
]) assert.match(globalStyles, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `missing density token ${token}`)

assert.match(globalStyles, /grid-template-rows:\s*repeat\(6, minmax\(0, 1fr\)\)/, 'calendar divides the viewport into six weeks')
assert.match(globalStyles, /\.pms-project-list-card-column/, 'card columns expose a stable five-column hook')

console.log('compact ui density contract passed')
