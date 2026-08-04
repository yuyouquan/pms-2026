#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const projectListPath = path.join(root, 'src/containers/ProjectListContainer.tsx')
const source = fs.readFileSync(projectListPath, 'utf8')
const summarySource = fs.readFileSync(path.join(root, 'src/components/project-summary/ProjectSummaryTable.tsx'), 'utf8')
const matrixSource = fs.readFileSync(path.join(root, 'src/lib/projectListMatrix.ts'), 'utf8')

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
assert.match(source, /UnorderedListOutlined/, 'list view segment has a semantic icon')
assert.match(source, /AppstoreOutlined/, 'card view segment has a semantic icon')
assert.match(source, /CalendarOutlined/, 'calendar view segment has a semantic icon')
assert.match(source, /aria-label="卡片视图"[\s\S]{0,100}<AppstoreOutlined \/>[\s\S]{0,60}<span>卡片视图<\/span>/, 'card-view segment keeps icon and visible text')
assert.match(source, /aria-label="列表视图"[\s\S]{0,100}<UnorderedListOutlined \/>[\s\S]{0,60}<span>列表视图<\/span>/, 'list-view segment keeps icon and visible text')
assert.match(source, /className="pms-project-list-category-actions"/, 'project-list actions share the category row')
assert.match(source, /className="pms-project-list-table-actions"/, 'filter and column controls have a host at the right edge of quick filters')
assert.match(source, /toolbarHost=\{projectListTableToolbarHost\}/, 'summary controls render into the quick-filter action host')
assert.match(source, /aria-label="快捷筛选-项目名称"[\s\S]{0,180}placeholder="项目名称"/, 'machine quick filters start with a project-name input')
assert.doesNotMatch(source, /projectListView === 'card'[^\n]*workbenchListState\.showSecondaryCategory/)
assert.match(source, /projectTypeFilter === PROJECT_TYPE_TOS_VERSION \|\| projectTypeFilter === PROJECT_CATEGORY_TECH[\s\S]{0,260}进行中[\s\S]{0,120}已完成/)
assert.match(source, /showQuickFilters=\{false\}/)
assert.match(summarySource, /getProjectListFixedColumnKeys/)
assert.match(summarySource, /fixedColumnKeys\.has\(definition\.key\)/)
assert.match(summarySource, /showQuickFilters\?: boolean/)
assert.match(summarySource, /showColumnSettings\?: boolean/)
assert.match(summarySource, /groupBy\?:/)
assert.match(summarySource, />\s*筛选\s*<\/Button>/, 'advanced filter button exposes visible text')
assert.match(summarySource, />\s*列设置\s*<\/Button>/, 'column settings button exposes visible text')
assert.equal(
  [...source.matchAll(/<Input\s+size="small"[\s\S]{0,180}aria-label="快捷筛选-项目名称"/g)].length,
  2,
  'machine and technical project-name quick filters use the compact input size',
)
assert.match(
  source,
  /<Select\s+size="small"[\s\S]{0,220}aria-label=\{`快捷筛选-\$\{definition\.label\}`\}/,
  'standard project-list quick filters use compact selects',
)
assert.match(
  source,
  /<Select\s+size="small"[\s\S]{0,220}aria-label=\{`快捷筛选-\$\{label\}`\}/,
  'technical project-list quick filters use compact selects',
)
assert.match(summarySource, /const compactControlSize = matrixVariant \? 'small' : 'middle'/)
assert.match(summarySource, /const \[selectedRowKey, setSelectedRowKey\] = useState\(''\)/)
assert.match(summarySource, /rowClassName=\{row =>/)
assert.match(
  summarySource,
  /width:\s*fieldWidth[\s\S]{0,160}minWidth:\s*fieldWidth[\s\S]{0,160}maxWidth:\s*fieldWidth/,
  'summary cells lock header and body sizing to the field-definition width',
)
assert.match(summarySource, /className=\{`pms-project-series-toggle \$\{isCollapsed \? '' : 'is-expanded'\}`\.trim\(\)\}/)
assert.match(summarySource, /<Tooltip title=\{groupKey\}>/)
assert.match(summarySource, /pms-project-name-cell/, 'project-name header and body share a semantic sizing class')
assert.match(summarySource, /pms-project-name-text/, 'project-name content has an explicit one-line text wrapper')
assert.match(summarySource, /pms-filter-condition-list \$\{matrixVariant \? 'is-compact' : ''\}/)
assert.match(summarySource, /showColumnSettings\s*&&\s*\(\s*<SortableColumnSettings/)
assert.equal(
  [...source.matchAll(/showColumnSettings=\{false\}/g)].length,
  2,
  'calendar mounts standard and technical filter controllers without column settings',
)
assert.match(
  source,
  /projectListView === 'calendar'[\s\S]{0,5200}showTable=\{false\}[\s\S]{0,500}showColumnSettings=\{false\}/,
  'calendar branch mounts a hidden summary controller that keeps advanced filtering available',
)
assert.match(matrixSource, /required\('productSeries', '产品系列', 160\)/, 'machine product-series fixed width is 160px')
assert.match(matrixSource, /required\('projectName', '项目名称', 220\)/, 'machine project-name fixed width is 220px')

const styles = fs.readFileSync(path.join(root, 'src/styles/globals.css'), 'utf8')
assert.match(styles, /\.pms-wide-table-toolbar\s*\{[^}]*position:\s*sticky;[^}]*top:/s)
assert.match(styles, /\.pms-project-list-filter-grid\s*\{[^}]*height:\s*142px/s, 'category filter surface keeps one stable height across project types')
assert.match(styles, /\.pms-project-list-view-switch\.ant-segmented\s*\{[^}]*height:\s*36px[^}]*border-radius:\s*10px[^}]*background:\s*#eef0ff/s, 'view switch uses the compact rounded rail')
assert.match(styles, /\.pms-project-list-view-switch \.ant-segmented-item-selected\s*\{[^}]*color:\s*#fff[^}]*background:\s*linear-gradient/s, 'selected view uses a clear purple gradient')
assert.match(styles, /\.pms-project-list \.pms-project-summary-actions \.ant-btn\s*\{[^}]*height:\s*32px[^}]*min-height:\s*32px\s*!important[^}]*padding-inline:\s*12px/s, 'quick-filter actions keep the same compact height as the filter controls')
assert.match(styles, /\.pms-project-list-field-filters\s*\{[^}]*padding:\s*0 4px/s, 'quick-filter row does not add vertical padding that overflows the fixed filter surface')
assert.match(styles, /\.pms-project-summary-table[\s\S]{0,300}th\.ant-table-cell-fix-(?:left|start)[\s\S]{0,160}position:\s*sticky\s*!important/s, 'fixed summary header cells retain sticky positioning instead of relative offsets')
assert.match(styles, /\.pms-table\.pms-project-summary-table \.ant-table-tbody\s*>\s*tr\s*>\s*td\.ant-table-cell-fix-(?:left|start)[^}]*\{[^}]*z-index:\s*3[^}]*background:\s*#fff\s*!important/s, 'fixed summary body cells stay opaque above scrolled cells')
assert.match(styles, /\.pms-table\.pms-project-summary-table \.ant-table-tbody\s*>\s*tr:hover\s*>\s*td\.ant-table-cell-fix-(?:left|start)[^}]*\{[^}]*background:\s*#f4f4ff\s*!important/s, 'fixed summary hover cells use an opaque hover surface')
assert.match(styles, /\.pms-project-summary-table \.pms-project-summary-row\.is-selected/)
assert.match(styles, /\.pms-project-series-cell\.is-expanded/)
assert.match(styles, /\.pms-project-summary-table \.ant-table-cell\s*\{[^}]*box-sizing:\s*border-box/s)
assert.match(styles, /\.pms-table\.pms-project-summary-table \.ant-table-tbody\s*>\s*tr\s*>\s*td\.pms-project-series-cell\s*\{[^}]*padding:\s*0\s*!important/s, 'series group cell defeats the later global table padding')
assert.match(styles, /\.pms-project-summary-table \.pms-project-series-toggle\s*\{[^}]*box-sizing:\s*border-box[^}]*width:\s*100%[^}]*height:\s*100%/s, 'series toggle fills its merged cell')
assert.match(styles, /\.pms-project-summary-table \.ant-table-cell\.pms-project-name-cell\s*\{[^}]*padding-inline:\s*16px\s*!important/s, 'project-name header and body use identical horizontal padding')
assert.match(styles, /\.pms-project-name-text\s*\{[^}]*white-space:\s*nowrap[^}]*text-overflow:\s*ellipsis/s, 'project names stay on one line and truncate accessibly')
assert.match(
  styles,
  /\.pms-filter-condition-list\.is-compact \.pms-filter-condition-row[\s\S]{0,900}min-height:\s*24px/s,
  'project-list advanced filters override the legacy 40px control height',
)
assert.match(styles, /\.pms-table \.ant-table-tbody\s*>\s*tr\.ant-table-measure-row\s*>\s*td\s*\{[^}]*padding:\s*0\s*!important[^}]*height:\s*0\s*!important[^}]*border:\s*0\s*!important/s, 'Ant Design measurement rows stay invisible and cannot create a blank row or distort body widths')
assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.pms-project-list/s)

console.log('workbench project-list contract passed')
