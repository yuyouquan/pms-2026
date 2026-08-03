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
assert.doesNotMatch(source, /aria-label="搜索项目名称"/, 'category row no longer carries a duplicate project-name search')
assert.match(source, /className="pms-project-list-view-switch"/, 'card/list switch uses the dedicated labeled segmented style')
assert.doesNotMatch(source, /AppstoreOutlined|UnorderedListOutlined/, 'card/list switch follows the text-only capsule interaction')
assert.match(source, /label:\s*<span[^>]*aria-label="卡片视图"[^>]*>卡片视图<\/span>/, 'card-view segment keeps a visible text label')
assert.match(source, /label:\s*<span[^>]*aria-label="列表视图"[^>]*>列表视图<\/span>/, 'list-view segment keeps a visible text label')
assert.match(source, /className="pms-project-list-category-actions"/, 'project-list actions share the category row')
assert.match(source, /className="pms-project-list-table-actions"/, 'filter and column controls have a host at the right edge of quick filters')
assert.match(source, /toolbarHost=\{projectListTableToolbarHost\}/, 'summary controls render into the quick-filter action host')
assert.match(source, /aria-label="快捷筛选-项目名称"[\s\S]{0,180}placeholder="项目名称"/, 'machine quick filters start with a project-name input')
assert.doesNotMatch(source, /projectListView === 'card'[^\n]*workbenchListState\.showSecondaryCategory/)
assert.match(source, /projectTypeFilter !== PROJECT_CATEGORY_TECH[\s\S]{0,220}workbenchListState\.showStatusQuickFilter/)
assert.match(source, /showQuickFilters=\{false\}/)
assert.match(summarySource, /getProjectListFixedColumnKeys/)
assert.match(summarySource, /fixedColumnKeys\.has\(definition\.key\)/)
assert.match(summarySource, /showQuickFilters\?: boolean/)
assert.match(summarySource, /groupBy\?:/)
assert.match(summarySource, />\s*筛选\s*<\/Button>/, 'advanced filter button exposes visible text')
assert.match(summarySource, />\s*列设置\s*<\/Button>/, 'column settings button exposes visible text')

const styles = fs.readFileSync(path.join(root, 'src/styles/globals.css'), 'utf8')
assert.match(styles, /\.pms-wide-table-toolbar\s*\{[^}]*position:\s*sticky;[^}]*top:/s)
assert.match(styles, /\.pms-project-list-filter-grid\s*\{[^}]*height:\s*142px/s, 'category filter surface keeps one stable height across project types')
assert.match(styles, /\.pms-project-list-view-switch\.ant-segmented\s*\{[^}]*background:\s*#f1f3fb/s, 'card/list switch uses the light capsule rail')
assert.match(styles, /\.pms-project-list-view-switch\.ant-segmented\s*\{[^}]*border:\s*1px solid #dfe3f2/s, 'card/list switch keeps the light capsule border')
assert.match(styles, /\.pms-project-list-view-switch \.ant-segmented-item-selected\s*\{[^}]*background:\s*#fff[^}]*box-shadow:/s, 'selected view uses a raised white capsule')
assert.match(styles, /\.pms-project-summary-table[\s\S]{0,300}th\.ant-table-cell-fix-(?:left|start)[\s\S]{0,160}position:\s*sticky\s*!important/s, 'fixed summary header cells retain sticky positioning instead of relative offsets')
assert.match(styles, /\.pms-table\.pms-project-summary-table \.ant-table-tbody\s*>\s*tr\s*>\s*td\.ant-table-cell-fix-(?:left|start)[^}]*\{[^}]*z-index:\s*3[^}]*background:\s*#fff\s*!important/s, 'fixed summary body cells stay opaque above scrolled cells')
assert.match(styles, /\.pms-table\.pms-project-summary-table \.ant-table-tbody\s*>\s*tr:hover\s*>\s*td\.ant-table-cell-fix-(?:left|start)[^}]*\{[^}]*background:\s*#f4f4ff\s*!important/s, 'fixed summary hover cells use an opaque hover surface')
assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.pms-project-list/s)

console.log('workbench project-list contract passed')
