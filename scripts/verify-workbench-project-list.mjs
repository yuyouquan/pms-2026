#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const projectListPath = path.join(root, 'src/containers/ProjectListContainer.tsx')
const source = fs.readFileSync(projectListPath, 'utf8')
const summarySource = fs.readFileSync(path.join(root, 'src/components/project-summary/ProjectSummaryTable.tsx'), 'utf8')
const workTrackerSource = fs.readFileSync(path.join(root, 'src/components/work-tracker/WorkTracker.tsx'), 'utf8')
const matrixSource = fs.readFileSync(path.join(root, 'src/lib/projectListMatrix.ts'), 'utf8')
const calendarMockPath = path.join(root, 'src/data/projectListPlanMocks.ts')

assert.match(source, /ProjectSummaryTable/)
assert.match(source, /getWorkbenchListState/)
assert.ok(fs.existsSync(calendarMockPath), 'project-list calendar has project-scoped plan mock data')
assert.match(source, /buildProjectListMockPlanTasks/)
assert.match(
  source,
  /const mockPlanTasks = buildProjectListMockPlanTasks[\s\S]{0,1200}publishedTasks\.length\s*\?\s*publishedTasks\s*:\s*mockPlanTasks/,
  'calendar/list milestone rows fall back to project-scoped mock plans when no published snapshot exists',
)
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
assert.match(source, /projectListView !== 'card'[\s\S]{0,500}aria-label="全屏展示"[\s\S]{0,120}<FullscreenOutlined/, 'list and calendar expose an accessible icon-only fullscreen action')
assert.match(source, /aria-label="退出全屏"[\s\S]{0,120}<FullscreenExitOutlined/, 'fullscreen mode exposes an accessible icon-only exit action')
assert.match(source, /AppstoreOutlined|CalendarOutlined|UnorderedListOutlined/, 'view switch uses icons with text labels')
assert.match(source, /aria-label="列表视图"><UnorderedListOutlined \/>列表视图<\/span>[\s\S]{0,80}value: 'list'/, 'list is the first icon-and-text option')
assert.match(source, /aria-label="日历视图"><CalendarOutlined \/>日历视图<\/span>[\s\S]{0,80}value: 'calendar'/, 'calendar is the second icon-and-text option')
assert.match(source, /aria-label="卡片视图"><AppstoreOutlined \/>卡片视图<\/span>[\s\S]{0,80}value: 'card'/, 'card is the final icon-and-text option')
assert.match(source, /className="pms-project-list-category-actions"/, 'project-list actions share the category row')
assert.match(source, /className="pms-project-list-category-row"/, 'category filters expose a stable responsive row')
assert.match(source, /className="pms-project-list-table-actions"/, 'filter and column controls share the category action rail')
assert.match(
  source,
  /className="pms-project-list-secondary-row"[\s\S]{0,1800}\{aboutMineControl\}/,
  'whole-product and tOS categories keep about-mine in the secondary-category row',
)
assert.match(
  source,
  /className="pms-project-list-technical-type-row"[\s\S]{0,1200}\{aboutMineControl\}/,
  'technical projects keep about-mine in the project-type row',
)
assert.doesNotMatch(source, /pms-project-list-about-mine-row/, 'about-mine is no longer rendered on a standalone row')
const statusRowIndex = source.indexOf('aria-label="状态快捷筛选"')
const filterSummaryIndex = source.indexOf('className="pms-project-list-filter-summary-row"')
const technicalTypeRowIndex = source.indexOf('aria-label="技术项目类型快捷筛选"')
assert.ok(statusRowIndex >= 0 && filterSummaryIndex > statusRowIndex, 'active filters follow the status row')
assert.ok(technicalTypeRowIndex < 0 || filterSummaryIndex < technicalTypeRowIndex, 'active filters precede the technical project-type row')
assert.match(source, /toolbarHost=\{projectListTableToolbarHost\}/, 'summary controls render into the category action rail')
assert.match(source, /aria-label="新增项目"[\s\S]{0,220}icon=\{<PlusOutlined \/>\}[\s\S]{0,120}\/\>/, 'add project is an accessible icon-only action')
assert.doesNotMatch(source, /projectListView === 'card'[^\n]*workbenchListState\.showSecondaryCategory/)
assert.match(source, /projectTypeFilter === PROJECT_TYPE_TOS_VERSION \|\| projectTypeFilter === PROJECT_CATEGORY_TECH[\s\S]{0,260}进行中[\s\S]{0,120}已完成/)
assert.match(source, /showQuickFilters=\{false\}/)
assert.match(summarySource, /getProjectListFixedColumnKeys/)
assert.match(workTrackerSource, /className="pms-work-tracker-toolbar__content"/, 'work tracker toolbar exposes a stable content wrapper')
assert.match(workTrackerSource, /className="pms-work-tracker-toolbar__lists"/, 'work tracker lists expose a stable responsive wrapper')
assert.match(workTrackerSource, /className="pms-work-tracker-toolbar__controls"/, 'work tracker controls expose a stable responsive wrapper')
assert.match(summarySource, /fixedColumnKeys\.has\(definition\.key\)/)
assert.match(summarySource, /showQuickFilters\?: boolean/)
assert.match(summarySource, /showColumnSettings\?: boolean/)
assert.match(summarySource, /groupBy\?:/)
assert.match(summarySource, />\s*筛选\s*<\/Button>/, 'advanced filter button exposes visible text')
assert.match(summarySource, />\s*字段配置\s*<\/Button>/, 'field configuration button exposes visible text')
assert.match(summarySource, /字段配置[\s\S]{0,900}toolbarTrailingAction/, 'fullscreen renders immediately after field configuration')
assert.match(source, /toolbarTrailingAction=\{projectListFullscreenAction\}/, 'project list passes fullscreen into the shared action row')
assert.doesNotMatch(source, /aria-label="快捷筛选-项目名称"/, 'project list no longer renders quick-filter inputs')
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
  0,
  'calendar keeps the shared field configuration available',
)
assert.match(
  source,
  /projectListView === 'calendar'[\s\S]{0,5200}showTable=\{false\}[\s\S]{0,700}filterSummaryHost=\{projectListFilterSummaryHost\}/,
  'calendar branch mounts a hidden summary controller that keeps filtering and field configuration available',
)
assert.match(matrixSource, /required\('productSeries', '产品系列', 160\)/, 'machine product-series fixed width is 160px')
assert.match(matrixSource, /required\('projectName', '项目名称', 220\)/, 'machine project-name fixed width is 220px')

const styles = fs.readFileSync(path.join(root, 'src/styles/globals.css'), 'utf8')
assert.match(styles, /\.pms-wide-table-toolbar\s*\{[^}]*position:\s*sticky;[^}]*top:/s)
assert.match(styles, /\.pms-project-list-filter-grid\s*\{[^}]*height:\s*142px/s, 'category filter surface keeps one stable height across project types')
assert.match(styles, /\.pms-project-list-view-switch\.ant-segmented\s*\{[^}]*height:\s*36px[^}]*border-radius:\s*999px[^}]*background:\s*#f1f3fb/s, 'view switch uses the pill rail')
assert.match(styles, /\.pms-project-list-view-switch\.ant-segmented\.ant-segmented-sm \.ant-segmented-item\s*\{[^}]*border-radius:\s*999px/s, 'pill item specificity overrides Ant Design small-segment radii')
assert.match(styles, /\.pms-project-list-view-switch\.ant-segmented\.ant-segmented-sm \.ant-segmented-thumb\s*\{[^}]*border-radius:\s*999px/s, 'animated selection thumb remains a pill')
assert.match(styles, /\.pms-project-list-view-switch \.ant-segmented-item-selected\s*\{[^}]*color:\s*var\(--pms-brand-strong\)[^}]*background:\s*#fff[^}]*box-shadow:/s, 'selected view uses the tokenized white capsule')
assert.match(styles, /\.pms-project-list-view-switch \.ant-segmented-item:focus-visible\s*\{[^}]*outline:/s, 'view switch retains a visible keyboard focus')
assert.match(styles, /\.pms-project-list \.pms-project-summary-actions \.ant-btn\s*\{[^}]*height:\s*32px[^}]*min-height:\s*32px\s*!important[^}]*padding-inline:\s*12px/s, 'quick-filter actions keep the same compact height as the filter controls')
assert.match(styles, /\.pms-active-filter-conditions\s*\{/, 'active filters have a dedicated compact surface')
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

const compactStyles = styles.slice(styles.lastIndexOf('@media (max-width: 1024px)'))
assert.match(compactStyles, /\.pms-work-tracker-toolbar\.pms-toolbar\s*\{[^}]*padding:\s*0/s, 'Ant Card toolbar root cannot double-pad at 1024px')
assert.match(compactStyles, /\.pms-work-tracker-toolbar__content\s*\{[^}]*display:\s*grid/s, 'work tracker toolbar stacks into a stable compact grid')
assert.match(compactStyles, /\.pms-work-tracker-toolbar__lists\s*\{[^}]*flex-wrap:\s*wrap/s, 'work tracker list chips wrap without vertical text')
assert.match(compactStyles, /\.pms-work-tracker-toolbar__controls\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:/s, 'work tracker controls keep readable compact columns')
assert.match(compactStyles, /\.pms-project-list-filter-grid\.pms-toolbar\s*\{[^}]*height:\s*auto/s, 'project-list compact filters release the desktop fixed height')
assert.match(compactStyles, /\.pms-project-list-category-row\s*\{[^}]*min-width:\s*0/s, 'project-list category row remains contained')
assert.match(compactStyles, /\.pms-project-list-field-filters\s*\{[^}]*flex-wrap:\s*wrap/s, 'project-list field filters wrap instead of overflowing the page')
assert.match(compactStyles, /\.pms-project-list-table-actions\s*\{[^}]*margin-left:\s*auto/s, 'filter and column actions remain at the responsive row edge')
assert.doesNotMatch(
  compactStyles,
  /\.pms-(?:work-tracker|project-list)[^{]*\{[^}]*(?:display\s*:\s*none|\border\s*:)/s,
  'compact workbench rules must not hide or reorder existing controls',
)

console.log('workbench project-list contract passed')
