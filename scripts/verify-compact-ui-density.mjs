#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8')

const projectListSource = read('src/containers/ProjectListContainer.tsx')
const projectSummarySource = read('src/components/project-summary/ProjectSummaryTable.tsx')
const columnSettingsSource = read('src/components/shared/SortableColumnSettings.tsx')
const configSource = read('src/containers/ConfigContainer.tsx')
const projectDataSource = read('src/data/projects.ts')
const globalStyles = read('src/styles/globals.css')

assert.equal((projectListSource.match(/className="pms-project-list-card-column"/g) || []).length, 3, 'all project card variants use the five-column hook')
assert.match(projectListSource, /UnorderedListOutlined/, 'list view exposes an icon')
assert.match(projectListSource, /AppstoreOutlined/, 'card view exposes an icon')
assert.match(projectListSource, /CalendarOutlined/, 'calendar view exposes an icon')
assert.match(projectListSource, /aria-label="全屏展示"[\s\S]{0,120}<FullscreenOutlined/, 'fullscreen is an icon-only accessible action')
assert.doesNotMatch(projectListSource, /aria-label="全屏展示"[\s\S]{0,180}>\s*全屏\s*<\/Button>/, 'fullscreen does not repeat a visible text label')
assert.match(projectListSource, /const projectListPageSize = 15/, 'list and card views share a 15-project page size')
assert.match(projectListSource, /tablePageSize=\{projectListPageSize\}/, 'list view enables project pagination')
assert.match(projectListSource, /total=\{cardRows\.length\}/, 'card view always renders a result-aware paginator')
assert.match(projectSummarySource, /tablePageSize\?: number/, 'summary table exposes an opt-in page size')
assert.match(projectSummarySource, /showTotal:\s*total => `共 \$\{total\} 个项目`/, 'list pagination reports the filtered total')
assert.match(projectDataSource, /ADDITIONAL_MACHINE_PROJECTS/, 'mock data includes a dedicated pagination fixture set')
assert.match(projectDataSource, /SPARK 40[\s\S]*HOT 60[\s\S]*NOTE 60/, 'mock projects cover multiple product series across pages')

assert.match(configSource, /<h1>配置中心<\/h1>/, 'config center exposes the same left-aligned title structure as workbench')
assert.match(configSource, /className="pms-workbench-switch pms-config-center-switch"/, 'config modules use the shared capsule switch')
assert.doesNotMatch(configSource, /Config tab navigation[\s\S]{0,500}<Tabs/, 'legacy top-level config tabs are removed')

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
assert.match(globalStyles, /\.pms-project-list-filter-label\s*\{[^}]*padding-left:\s*4px[^}]*flex:\s*0 0 96px/s, 'quick-filter label aligns with the category label column')
assert.match(globalStyles, /\.pms-project-list-field-filters\s*>\s*:where\([^}]*flex:\s*0 0 150px/s, 'project-name and select controls keep equal widths')
assert.match(globalStyles, /\.pms-workbench-header h1\s*\{[^}]*font-size:\s*16px/s, 'workspace titles stay compact while remaining larger than navigation text')
assert.match(globalStyles, /\.pms-workbench-switch\.ant-segmented\s*\{[^}]*height:\s*28px/s, 'workbench and config capsules match the project-list switch height')
assert.match(globalStyles, /\.pms-workbench-switch \.ant-segmented-group,[\s\S]{0,120}display:\s*flex/s, 'shared capsule items remain on one line')

console.log('compact ui density contract passed')
