#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const projectListPath = path.join(root, 'src/containers/ProjectListContainer.tsx')
const source = fs.readFileSync(projectListPath, 'utf8')
const summarySource = fs.readFileSync(path.join(root, 'src/components/project-summary/ProjectSummaryTable.tsx'), 'utf8')

assert.match(source, /ProjectSummaryTable/)
assert.match(source, /getWorkbenchListState/)
assert.match(source, /该项目分类暂未配置/)
assert.doesNotMatch(source, /label:\s*'全部',\s*value:\s*'all'\s*\},\s*\.\.\.PROJECT_CATEGORIES/)
assert.match(source, /technicalActiveType === 'tdt'/)
assert.match(source, /TECHNICAL_PROJECT_TYPE_OPTIONS\.map/)
assert.doesNotMatch(source, /technicalTypeVisibility\.showBoth/)
assert.match(source, /'technical-tdt'/)
assert.match(source, /'technical-subproject'/)
assert.match(source, /technicalFilters/)
assert.match(source, /controlledFilters=\{technicalFilters\}/)
assert.match(source, /projectTypeFilter === PROJECT_CATEGORY_CAPABILITY[\s\S]{0,160}Empty/)
assert.doesNotMatch(source, /columns=\{\[\s*\{\s*title:\s*'项目名称'/)

for (const label of [
  '项目二级分类快捷筛选',
  '状态快捷筛选',
  '卡片视图',
  '列表视图',
]) {
  assert.match(source, new RegExp(`aria-label=["']${label}["']`))
}

assert.match(source, /storageNamespace="workbench-project-list"/)
assert.match(source, /versions=\{versions\}/)
assert.match(source, /currentVersion=\{currentVersion\}/)
assert.match(source, /publishedSnapshots=\{publishedSnapshots\}/)
assert.match(source, /getTemplateTasksForProjectType\(\s*configTemplateTasksByType,\s*projectTypeFilter/)
assert.match(source, /className="pms-project-list"/, 'project list owns a scoped polish shell')
assert.match(source, /className="pms-project-list-toolbar pms-wide-table-toolbar"/, 'wide project list keeps its toolbar visible')
assert.match(source, /<Tooltip\s+title="卡片视图"/, 'card-view icon has a tooltip')
assert.match(source, /<Tooltip\s+title="列表视图"/, 'list-view icon has a tooltip')
assert.match(source, /className="pms-project-list-category-actions"/, 'project-list actions share the category row')
assert.doesNotMatch(source, /projectListView === 'card'[^\n]*workbenchListState\.showSecondaryCategory/)
assert.match(source, /projectTypeFilter !== PROJECT_CATEGORY_TECH[\s\S]{0,220}workbenchListState\.showStatusQuickFilter/)
assert.match(source, /showQuickFilters=\{false\}/)
assert.match(summarySource, /getProjectListFixedColumnKeys/)
assert.match(summarySource, /fixedColumnKeys\.has\(definition\.key\)/)
assert.match(summarySource, /showQuickFilters\?: boolean/)
assert.match(summarySource, /groupBy\?:/)

const styles = fs.readFileSync(path.join(root, 'src/styles/globals.css'), 'utf8')
assert.match(styles, /\.pms-wide-table-toolbar\s*\{[^}]*position:\s*sticky;[^}]*top:/s)
assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.pms-project-list/s)

console.log('workbench project-list contract passed')
