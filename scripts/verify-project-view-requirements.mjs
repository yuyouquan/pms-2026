import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()

const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const parseTsx = (source, fileName) => ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const visit = (node, predicate) => {
  if (predicate(node)) return node
  let found
  ts.forEachChild(node, child => { if (!found) found = visit(child, predicate) })
  return found
}
const hasExportModifier = node => node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)
const exportsComponent = (sourceFile, name) => sourceFile.statements.some(statement => {
  if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name?.text === name) return hasExportModifier(statement)
  if (ts.isVariableStatement(statement) && hasExportModifier(statement)) return statement.declarationList.declarations.some(declaration => ts.isIdentifier(declaration.name) && declaration.name.text === name)
  if (ts.isExportAssignment(statement)) return ts.isIdentifier(statement.expression) && statement.expression.text === name
  if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) return statement.exportClause.elements.some(element => element.name.text === name || element.propertyName?.text === name)
  return false
})
const importsComponent = (sourceFile, name, modulePath) => sourceFile.statements.some(statement => {
  if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || statement.moduleSpecifier.text !== modulePath) return false
  const clause = statement.importClause
  if (clause?.name?.text === name) return true
  return Boolean(clause?.namedBindings && ts.isNamedImports(clause.namedBindings) && clause.namedBindings.elements.some(element => element.name.text === name))
})
const mountsComponent = (sourceFile, name) => Boolean(visit(sourceFile, node => (
  (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText(sourceFile) === name
)))
const importsAndMounts = (sourceFile, name, modulePath) => importsComponent(sourceFile, name, modulePath) && mountsComponent(sourceFile, name)

const checks = [
  {
    name: 'Project type helpers define tOS version projects',
    file: 'src/constants/projectTypes.ts',
    includes: 'tOS版本项目',
  },
  {
    name: 'Project type helpers define independent software projects',
    file: 'src/constants/projectTypes.ts',
    includes: '独立软件产品项目',
  },
  {
    name: 'Project type helpers keep software-project behavior shared',
    file: 'src/constants/projectTypes.ts',
    includes: 'isSoftwareProjectType',
  },
  {
    name: 'Project type helpers infer tOS version projects by name',
    file: 'src/constants/projectTypes.ts',
    includes: 'inferSoftwareProjectTypeFromName',
  },
  {
    name: 'Header uses 项目视图 label',
    file: 'src/containers/AppShell.tsx',
    includes: '项目视图',
  },
  {
    name: 'Project view has summary board tab',
    file: 'src/components/roadmap/RoadmapView.tsx',
    includes: '项目计划汇总看板',
  },
  {
    name: 'Project view keeps old roadmap under tab',
    file: 'src/components/roadmap/RoadmapView.tsx',
    includes: '项目路标视图',
  },
  {
    name: 'Project view card allows sticky controls to escape card clipping',
    file: 'src/components/roadmap/RoadmapView.tsx',
    includes: 'pms-roadmap-view-card',
  },
  {
    name: 'Project view card body keeps overflow visible for sticky controls',
    file: 'src/components/roadmap/RoadmapView.tsx',
    includes: "overflow: 'visible'",
  },
  {
    name: 'Whole-machine basic info has product series',
    file: 'src/constants/projectBasicFields.ts',
    includes: '产品系列',
  },
  {
    name: 'Project basic info supports technical domain',
    file: 'src/containers/ProjectSpaceContainer.tsx',
    includes: '领域',
  },
  {
    name: 'Software project basic info labels OS series as product series',
    file: 'src/containers/ProjectSpaceContainer.tsx',
    includes: '<Descriptions.Item label="产品系列">',
  },
  {
    name: 'Project space status is editable with custom enum options',
    file: 'src/containers/ProjectSpaceContainer.tsx',
    includes: 'PROJECT_SPACE_STATUS_OPTIONS',
  },
  {
    name: 'Project space status options include EOS',
    file: 'src/containers/ProjectSpaceContainer.tsx',
    includes: "{ label: 'EOS', value: 'EOS' }",
  },
  {
    name: 'Project space status uses single-select editing',
    file: 'src/containers/ProjectSpaceContainer.tsx',
    includes: "setEf('status'",
  },
  {
    name: 'Add project defaults to pending approval status',
    file: 'src/components/workspace/AddProjectModal.tsx',
    includes: "status: '待立项'",
  },
  {
    name: 'Summary board component exists',
    file: 'src/components/roadmap/ProjectPlanSummaryBoard.tsx',
    includes: 'ProjectPlanSummaryBoard',
  },
  {
    name: 'Summary board has collapsible product categories',
    file: 'src/components/roadmap/ProjectPlanSummaryBoard.tsx',
    includes: 'collapsedCategories',
  },
  {
    name: 'Summary board has polished category cells',
    file: 'src/components/roadmap/ProjectPlanSummaryBoard.tsx',
    includes: 'pms-summary-category-cell',
  },
  {
    name: 'Summary board supports expand all action',
    file: 'src/components/roadmap/ProjectPlanSummaryBoard.tsx',
    includes: '展开全部',
  },
  {
    name: 'Summary board supports status filter pills',
    file: 'src/components/roadmap/ProjectPlanSummaryBoard.tsx',
    includes: 'STATUS_FILTERS',
  },
  {
    name: 'Summary board shows status counts in filter pills',
    file: 'src/components/roadmap/ProjectPlanSummaryBoard.tsx',
    includes: 'statusStats',
  },
  {
    name: 'Summary board limits data to visible delivery statuses',
    file: 'src/components/roadmap/ProjectPlanSummaryBoard.tsx',
    includes: 'SUMMARY_VISIBLE_STATUSES',
  },
  {
    name: 'Summary board uses a single milestone header column',
    file: 'src/components/roadmap/ProjectPlanSummaryBoard.tsx',
    includes: "dataIndex: 'milestones'",
  },
  {
    name: 'Summary board animates category collapse and expand',
    file: 'src/components/roadmap/ProjectPlanSummaryBoard.tsx',
    includes: 'pms-summary-row-motion',
  },
  {
    name: 'Summary board provides filter drawer',
    file: 'src/components/roadmap/ProjectPlanSummaryBoard.tsx',
    includes: '筛选条件',
  },
  {
    name: 'Summary board provides column settings drawer',
    file: 'src/components/roadmap/ProjectPlanSummaryBoard.tsx',
    includes: '列设置',
  },
  {
    name: 'Summary board reuses roadmap project info columns',
    file: 'src/components/roadmap/ProjectPlanSummaryBoard.tsx',
    includes: 'getFixedColumnsForType',
  },
  {
    name: 'Product category only appears in overall view columns',
    file: 'src/components/roadmap/ProjectPlanSummaryBoard.tsx',
    includes: "scope === 'overall' && isVisible('productCategory')",
  },
  {
    name: 'Roadmap milestone view has overall tab',
    file: 'src/components/roadmap/MilestoneView.tsx',
    includes: "{ key: 'overall'",
  },
  {
    name: 'Roadmap milestone overall view groups by tOS version',
    file: 'src/components/roadmap/MilestoneView.tsx',
    includes: 'tosVersionGroup',
  },
  {
    name: 'Roadmap milestone overall view builds grouped rows',
    file: 'src/components/roadmap/MilestoneView.tsx',
    includes: 'buildRoadmapMilestoneRows',
  },
  {
    name: 'Roadmap milestone overall view merges group cells',
    file: 'src/components/roadmap/MilestoneView.tsx',
    includes: 'computeMilestoneRowSpans',
  },
  {
    name: 'Roadmap milestone overall view repeats machine projects by tOS group',
    file: 'src/components/roadmap/MilestoneView.tsx',
    includes: 'for (const tosGroup of tosGroups)',
  },
  {
    name: 'Machine roadmap milestones use main market',
    file: 'src/components/roadmap/MilestoneView.tsx',
    includes: 'getMainMarket',
  },
  {
    name: 'Project summary board supports export',
    file: 'src/components/roadmap/ProjectPlanSummaryBoard.tsx',
    includes: 'handleExport',
  },
  {
    name: 'Project summary board supports fullscreen',
    file: 'src/components/roadmap/ProjectPlanSummaryBoard.tsx',
    includes: 'isFullscreen',
  },
  {
    name: 'Roadmap milestone view keeps export',
    file: 'src/components/roadmap/MilestoneView.tsx',
    includes: 'handleExport',
  },
  {
    name: 'Roadmap milestone view keeps fullscreen',
    file: 'src/components/roadmap/MilestoneView.tsx',
    includes: 'isFullscreen',
  },
  {
    name: 'Roadmap milestone view keeps snapshot creation',
    file: 'src/components/roadmap/MilestoneView.tsx',
    includes: 'handleCreateSnapshot',
  },
  {
    name: 'Roadmap milestone view keeps compare mode',
    file: 'src/components/roadmap/MilestoneView.tsx',
    includes: 'compareMode',
  },
  {
    name: 'Roadmap milestone table uses summary board table styling',
    file: 'src/components/roadmap/MilestoneView.tsx',
    includes: 'pms-summary-board',
  },
  {
    name: 'Roadmap milestone view uses a single milestone chain column',
    file: 'src/components/roadmap/MilestoneView.tsx',
    includes: "dataIndex: 'milestones'",
  },
  {
    name: 'Roadmap milestone view renders screenshot-style milestone nodes',
    file: 'src/components/roadmap/MilestoneView.tsx',
    includes: 'pms-roadmap-milestone-chain',
  },
  {
    name: 'Roadmap milestone view supports milestone text filtering/export',
    file: 'src/components/roadmap/MilestoneView.tsx',
    includes: 'milestonesText',
  },
  {
    name: 'Roadmap milestone overall view has collapse state',
    file: 'src/components/roadmap/MilestoneView.tsx',
    includes: 'collapsedTosGroups',
  },
  {
    name: 'Roadmap milestone overall view supports expand all action',
    file: 'src/components/roadmap/MilestoneView.tsx',
    includes: 'expandAllTosGroups',
  },
  {
    name: 'Roadmap milestone overall view supports collapse all action',
    file: 'src/components/roadmap/MilestoneView.tsx',
    includes: 'collapseAllTosGroups',
  },
  {
    name: 'Roadmap milestone scoped tabs reuse overall columns without tOS version',
    file: 'src/components/roadmap/MilestoneView.tsx',
    includes: "getFixedColumnsForType('整体')",
  },
  {
    name: 'Project views share one saved-view persistence helper',
    file: 'src/components/roadmap/utils.ts',
    includes: 'saveProjectView',
  },
  {
    name: 'Project views can load saved custom views',
    file: 'src/components/roadmap/utils.ts',
    includes: 'loadProjectViews',
  },
  {
    name: 'Project views can create share URLs',
    file: 'src/components/roadmap/utils.ts',
    includes: 'createProjectViewShareUrl',
  },
  {
    name: 'Project views can parse shared view URLs',
    file: 'src/components/roadmap/utils.ts',
    includes: 'parseProjectViewShare',
  },
  {
    name: 'Project view parent switches to shared roadmap view kind',
    file: 'src/components/roadmap/RoadmapView.tsx',
    includes: 'PROJECT_VIEW_KINDS.roadmapMilestone',
  },
  {
    name: 'Project view parent reads shared view URLs',
    file: 'src/components/roadmap/RoadmapView.tsx',
    includes: 'parseProjectViewShare',
  },
  {
    name: 'Home page opens project view from shared view URLs',
    file: 'src/app/page.tsx',
    includes: 'parseProjectViewShare',
  },
  {
    name: 'Summary board supports custom saved views',
    file: 'src/components/roadmap/ProjectPlanSummaryBoard.tsx',
    includes: 'handleSaveProjectView',
  },
  {
    name: 'Summary board renders saved views on a standalone row',
    file: 'src/components/roadmap/ProjectPlanSummaryBoard.tsx',
    includes: 'pms-project-view-row',
  },
  {
    name: 'Summary board switches saved views with tabs',
    file: 'src/components/roadmap/ProjectPlanSummaryBoard.tsx',
    includes: 'pms-project-view-tabs',
  },
  {
    name: 'Summary board has create view action beside saved-view tabs',
    file: 'src/components/roadmap/ProjectPlanSummaryBoard.tsx',
    includes: '新建视图',
  },
  {
    name: 'Summary board prevents duplicate saved-view names',
    file: 'src/components/roadmap/ProjectPlanSummaryBoard.tsx',
    includes: 'isProjectViewNameDuplicate',
  },
  {
    name: 'Summary board confirms deleting a custom saved-view tab',
    file: 'src/components/roadmap/ProjectPlanSummaryBoard.tsx',
    includes: '确认删除视图',
  },
  {
    name: 'Summary board supports view sharing',
    file: 'src/components/roadmap/ProjectPlanSummaryBoard.tsx',
    includes: 'handleShareProjectView',
  },
  {
    name: 'Summary board supports milestone date range filtering',
    file: 'src/components/roadmap/ProjectPlanSummaryBoard.tsx',
    includes: 'milestoneDateRange',
  },
  {
    name: 'Summary board has recent three-month milestone shortcut',
    file: 'src/components/roadmap/ProjectPlanSummaryBoard.tsx',
    includes: '最近3个月',
  },
  {
    name: 'Summary board has future three-month milestone shortcut',
    file: 'src/components/roadmap/ProjectPlanSummaryBoard.tsx',
    includes: '未来三个月',
  },
  {
    name: 'Summary board supports calendar view mode',
    file: 'src/components/roadmap/ProjectPlanSummaryBoard.tsx',
    includes: 'pms-project-calendar-grid',
  },
  {
    name: 'Summary board adds tOS version after project name',
    file: 'src/components/roadmap/ProjectPlanSummaryBoard.tsx',
    includes: "key: 'tosVersion'",
  },
  {
    name: 'Summary board share payload includes filtered row snapshot',
    file: 'src/components/roadmap/ProjectPlanSummaryBoard.tsx',
    includes: 'sharedRows',
  },
  {
    name: 'Summary board toolbar actions are compact icon buttons',
    file: 'src/components/roadmap/ProjectPlanSummaryBoard.tsx',
    includes: 'pms-summary-icon-button',
  },
  {
    name: 'Summary board status toolbar uses compact scrollable rail',
    file: 'src/components/roadmap/ProjectPlanSummaryBoard.tsx',
    includes: 'pms-summary-status-group::-webkit-scrollbar',
  },
  {
    name: 'Summary board calendar events use one-line milestone project text',
    file: 'src/components/roadmap/ProjectPlanSummaryBoard.tsx',
    includes: 'pms-project-calendar-event-single',
  },
  {
    name: 'Roadmap milestone view supports custom saved views',
    file: 'src/components/roadmap/MilestoneView.tsx',
    includes: 'handleSaveProjectView',
  },
  {
    name: 'Roadmap milestone renders saved views on a standalone row',
    file: 'src/components/roadmap/MilestoneView.tsx',
    includes: 'pms-project-view-row',
  },
  {
    name: 'Roadmap milestone switches saved views with tabs',
    file: 'src/components/roadmap/MilestoneView.tsx',
    includes: 'pms-project-view-tabs',
  },
  {
    name: 'Roadmap milestone has create view action beside saved-view tabs',
    file: 'src/components/roadmap/MilestoneView.tsx',
    includes: '新建视图',
  },
  {
    name: 'Roadmap milestone prevents duplicate saved-view names',
    file: 'src/components/roadmap/MilestoneView.tsx',
    includes: 'isProjectViewNameDuplicate',
  },
  {
    name: 'Roadmap milestone confirms deleting a custom saved-view tab',
    file: 'src/components/roadmap/MilestoneView.tsx',
    includes: '确认删除视图',
  },
  {
    name: 'Roadmap milestone view supports view sharing',
    file: 'src/components/roadmap/MilestoneView.tsx',
    includes: 'handleShareProjectView',
  },
  {
    name: 'Roadmap milestone supports milestone date range filtering',
    file: 'src/components/roadmap/MilestoneView.tsx',
    includes: 'milestoneDateRange',
  },
  {
    name: 'Roadmap milestone has recent three-month milestone shortcut',
    file: 'src/components/roadmap/MilestoneView.tsx',
    includes: '最近3个月',
  },
  {
    name: 'Roadmap milestone has future three-month milestone shortcut',
    file: 'src/components/roadmap/MilestoneView.tsx',
    includes: '未来三个月',
  },
  {
    name: 'Roadmap milestone supports calendar view mode',
    file: 'src/components/roadmap/MilestoneView.tsx',
    includes: 'pms-project-calendar-grid',
  },
  {
    name: 'Roadmap milestone adds row tOS version after project name',
    file: 'src/components/roadmap/utils.ts',
    includes: "{ key: 'tosVersion', title: 'tOS版本'",
  },
  {
    name: 'Roadmap milestone share payload includes filtered row snapshot',
    file: 'src/components/roadmap/MilestoneView.tsx',
    includes: 'sharedRows',
  },
  {
    name: 'Roadmap milestone toolbar actions are compact icon buttons',
    file: 'src/components/roadmap/MilestoneView.tsx',
    includes: 'pms-summary-icon-button',
  },
  {
    name: 'Roadmap milestone status toolbar uses compact scrollable rail',
    file: 'src/components/roadmap/MilestoneView.tsx',
    includes: 'pms-summary-status-group::-webkit-scrollbar',
  },
  {
    name: 'Roadmap milestone calendar events use one-line milestone project text',
    file: 'src/components/roadmap/MilestoneView.tsx',
    includes: 'pms-project-calendar-event-single',
  },
  {
    name: 'Shared project view state carries calendar and date range',
    file: 'src/components/roadmap/utils.ts',
    includes: 'milestoneDateRange',
  },
  {
    name: 'Shared project view state carries filtered row snapshot',
    file: 'src/components/roadmap/utils.ts',
    includes: 'sharedRows',
  },
  {
    name: 'Project type options include tOS version projects',
    file: 'src/data/projects.ts',
    includes: 'PROJECT_TYPE_TOS_VERSION',
  },
  {
    name: 'Project type options include independent software projects',
    file: 'src/data/projects.ts',
    includes: 'PROJECT_TYPE_INDEPENDENT_SOFTWARE',
  },
  {
    name: 'Add project modal can infer tOS version project names',
    file: 'src/components/workspace/AddProjectModal.tsx',
    includes: 'inferSoftwareProjectTypeFromName',
  },
  {
    name: 'Project list filters use current first-level project categories',
    file: 'src/containers/ProjectListContainer.tsx',
    includes: 'PROJECT_CATEGORIES',
  },
  {
    name: 'Project type helpers retain independent software compatibility',
    file: 'src/constants/projectTypes.ts',
    includes: 'PROJECT_TYPE_INDEPENDENT_SOFTWARE',
  },
  {
    name: 'Project space treats split software projects as old software projects',
    file: 'src/containers/ProjectSpaceContainer.tsx',
    includes: 'isSoftwareProjectType',
  },
  {
    name: 'Plan template project types include split software project categories',
    file: 'src/stores/plan.ts',
    includes: 'PROJECT_TYPE_TOS_VERSION',
  },
  {
    name: 'Summary board has tOS version project tab',
    file: 'src/components/roadmap/ProjectPlanSummaryBoard.tsx',
    includes: 'tOS版本项目',
  },
  {
    name: 'Summary board still understands independent software project type for exclusion',
    file: 'src/components/roadmap/ProjectPlanSummaryBoard.tsx',
    includes: 'PROJECT_TYPE_INDEPENDENT_SOFTWARE',
  },
  {
    name: 'Roadmap milestone has tOS version project tab',
    file: 'src/components/roadmap/MilestoneView.tsx',
    includes: 'tOS版本项目',
  },
  {
    name: 'Roadmap milestone still understands independent software project type for exclusion',
    file: 'src/components/roadmap/MilestoneView.tsx',
    includes: 'PROJECT_TYPE_INDEPENDENT_SOFTWARE',
  },
  {
    name: 'Technical basic information mounts the shared information frame',
    file: 'src/components/technical-project/TechnicalProjectInformationView.tsx',
    contract: source => mountsComponent(parseTsx(source, 'TechnicalProjectInformationView.tsx'), 'ProjectInformationFrame'),
  },
  {
    name: 'Technical basic information renders the technical plan summary',
    file: 'src/components/technical-project/TechnicalProjectInformationView.tsx',
    contract: source => mountsComponent(parseTsx(source, 'TechnicalProjectInformationView.tsx'), 'TechnicalPlanSummary'),
  },
  {
    name: 'Shared plan workspace shell exports its component',
    file: 'src/components/plans/PlanWorkspaceShell.tsx',
    contract: source => exportsComponent(parseTsx(source, 'PlanWorkspaceShell.tsx'), 'PlanWorkspaceShell'),
  },
  {
    name: 'Technical plan module imports and mounts the shared plan workspace shell',
    file: 'src/components/technical-project/TechnicalPlanModule.tsx',
    contract: source => importsAndMounts(parseTsx(source, 'TechnicalPlanModule.tsx'), 'PlanWorkspaceShell', '@/components/plans/PlanWorkspaceShell'),
  },
  {
    name: 'Whole-machine project space imports and mounts the shared plan workspace shell',
    file: 'src/containers/ProjectSpaceContainer.tsx',
    contract: source => importsAndMounts(parseTsx(source, 'ProjectSpaceContainer.tsx'), 'PlanWorkspaceShell', '@/components/plans/PlanWorkspaceShell'),
  },
]

const failures = []

for (const check of checks) {
  const fullPath = path.join(root, check.file)
  if (!fs.existsSync(fullPath)) {
    failures.push(`${check.name}: missing file ${check.file}`)
    continue
  }

  const content = read(check.file)
  if (check.contract) {
    if (!check.contract(content)) failures.push(`${check.name}: executable source contract failed in ${check.file}`)
    continue
  }
  if (check.matches && !check.matches.test(content)) {
    failures.push(`${check.name}: missing JSX mount ${check.matches} in ${check.file}`)
    continue
  }
  if (check.exists) continue
  if (!content.includes(check.includes)) {
    failures.push(`${check.name}: missing "${check.includes}" in ${check.file}`)
  }
}

const summaryBoard = read('src/components/roadmap/ProjectPlanSummaryBoard.tsx')
const projectData = read('src/data/projects.ts')
if (projectData.includes("type: '产品项目'")) {
  failures.push('Mock project data should migrate software products away from legacy 产品项目 type')
}
for (const name of ['tOS16.1', 'tOS16.2', 'tOS17.1']) {
  const escapedName = name.replace('.', '\\.')
  const pattern = new RegExp(`name: '${escapedName}'[\\s\\S]{0,220}type: (?:'tOS版本项目'|PROJECT_TYPE_TOS_VERSION)`)
  if (!pattern.test(projectData)) {
    failures.push(`Mock tOS project ${name} should use tOS版本项目 type`)
  }
}
if (!/name: '((?!tOS)\w|HiOS|AI|Launcher|Weather)[\s\S]{0,260}type: (?:'独立软件产品项目'|PROJECT_TYPE_INDEPENDENT_SOFTWARE)/.test(projectData)) {
  failures.push('Mock data should include at least one non-tOS independent software project')
}
const statusFilterBlock = summaryBoard.match(/const STATUS_FILTERS[\s\S]*?\n\]/)?.[0] || ''
const forbiddenStatusFilters = ['筹备中', 'EOL', "key: '维护'", '进行中', '已完成', '已上市', '维护期']
for (const status of forbiddenStatusFilters) {
  if (statusFilterBlock.includes(status)) {
    failures.push(`Summary board status filter should not include ${status.replace('\\\\', '')}`)
  }
}
for (const status of ['在研', '上市', '转维']) {
  if (!statusFilterBlock.includes(status)) {
    failures.push(`Summary board status filter missing ${status}`)
  }
}
if (!summaryBoard.includes("const SUMMARY_VISIBLE_STATUSES: SummaryStatus[] = ['在研', '上市', '转维']")) {
  failures.push('Summary board should only include 在研、上市、转维 statuses')
}
if (!summaryBoard.includes("type SummaryScope = 'overall' | 'machine' | 'tosVersion' | 'tech'")) {
  failures.push('Summary board tabs should exclude 独立软件产品项目')
}
if (!summaryBoard.includes("normalizedProjectType === PROJECT_TYPE_INDEPENDENT_SOFTWARE") || !summaryBoard.includes('continue')) {
  failures.push('Summary board row builder should skip independent software product projects')
}
if (summaryBoard.includes('children: milestoneColumns')) {
  failures.push('Summary board should not render nested milestone table headers')
}
if (summaryBoard.includes('translateY')) {
  failures.push('Summary board collapse animation should not translate table rows')
}
if (!summaryBoard.includes("scope === 'overall' ? '整体视图保留产品分类维度") || !summaryBoard.includes('当前视图不显示产品分类')) {
  failures.push('Summary board should explain product category visibility by tab in column settings')
}
if (!summaryBoard.includes("fixed: scope === 'overall' ? 'left' as const : undefined") || !summaryBoard.includes("fixed: 'left' as const") || !summaryBoard.includes("fixed: 'right' as const")) {
  failures.push('Summary board should fix overall product category plus product series, project name, and action columns in every tab')
}
if (summaryBoard.includes('pms-project-view-select')) {
  failures.push('Summary board saved-view switching should use tabs, not the old select control')
}
if (summaryBoard.includes('已收起 ${row.hiddenProjectCount || 0} 个项目') || summaryBoard.includes('${total} 个项目')) {
  failures.push('Summary board product category column should not show project-count copy')
}
const summaryProductCategoryColumn = summaryBoard.match(/dataIndex: 'productCategory'[\s\S]*?if \(isVisible\('productSeries'\)/)?.[0] || ''
if (summaryProductCategoryColumn.includes('pms-summary-category-dot')) {
  failures.push('Summary board product category column should not show the leading dot')
}
if (!summaryBoard.includes("dataIndex: 'tosVersion'") || summaryBoard.indexOf("dataIndex: 'projectName'") > summaryBoard.indexOf("dataIndex: 'tosVersion'")) {
  failures.push('Summary board should render tOS版本 immediately after project name')
}
if (!summaryBoard.includes('filterMilestonesByDateRange') || !summaryBoard.includes('DatePicker.RangePicker')) {
  failures.push('Summary board should filter milestone nodes with a date range picker')
}
if (!summaryBoard.includes('viewMode') || !summaryBoard.includes("value: 'calendar'")) {
  failures.push('Summary board should switch between table and calendar views')
}
if (!summaryBoard.includes('getDepartmentByFirstSpm')) {
  failures.push('Summary board department should derive from the first SPM person')
}
if (summaryBoard.includes('09:00') || summaryBoard.includes('pms-project-calendar-event-sub')) {
  failures.push('Summary board calendar event should be one compact line without time or second-line metadata')
}
if (!summaryBoard.includes('pms-summary-sticky-region') || !summaryBoard.includes('pms-summary-sticky-offset')) {
  failures.push('Summary board toolbar and filters should be wrapped in a sticky region')
}
if (!summaryBoard.includes('pms-summary-toolbar-shell') || !summaryBoard.includes('pms-summary-control-shell-static')) {
  failures.push('Summary board should only keep the status/action toolbar sticky, with view tabs scrolling normally')
}
if (!summaryBoard.includes('top: 0 !important') || !summaryBoard.includes('margin-bottom: 23px')) {
  failures.push('Summary board real table header should sit immediately below the sticky toolbar without a page-level offset')
}
if (!summaryBoard.includes('TABLE_BODY_SCROLL_Y') || !summaryBoard.includes("scroll={{ x: 'max-content', y: TABLE_BODY_SCROLL_Y }}")) {
  failures.push('Summary board table body should scroll inside the table so the header stays above body rows')
}
if (!summaryBoard.includes('const SUMMARY_STICKY_TOP = 47')) {
  failures.push('Summary board sticky toolbar should sit high enough that its visible bottom meets the table header')
}
if (summaryBoard.includes('sticky={{ offsetHeader: stickyTableOffset }}')) {
  failures.push('Summary board should not use Ant Design sticky holder because it can float below body rows')
}
if (summaryBoard.includes('--pms-summary-table-header-offset')) {
  failures.push('Summary board should not use a page-level table header offset that pushes the header into the table body')
}

const milestoneView = read('src/components/roadmap/MilestoneView.tsx')
const projectSpaceContainer = read('src/containers/ProjectSpaceContainer.tsx')
for (const removedFeature of ['handleSaveView', 'showSaveViewModal', 'buildCompareColumns', 'diffSnapshots']) {
  if (milestoneView.includes(removedFeature)) {
    failures.push(`Roadmap milestone view should remove old view/snapshot implementation: found ${removedFeature}`)
  }
}
if (milestoneView.includes('translateY')) {
  failures.push('Roadmap milestone collapse animation should not translate table rows')
}
if (!milestoneView.includes("fixed: 'left' as const") || !milestoneView.includes("fixed: 'right' as const")) {
  failures.push('Roadmap milestone view should fix tOS version, product category, product series, project name, and action columns')
}
if (!milestoneView.includes("scope === 'overall'") || !milestoneView.includes("col.key !== 'tosVersion'") || !milestoneView.includes("col.key !== 'tosVersionGroup'")) {
  failures.push('Roadmap milestone overall view should hide row tOS version while scoped tabs remove the tOS version group column')
}
if (!milestoneView.includes('pms-summary-collapse-button') || !milestoneView.includes('pms-summary-row-motion')) {
  failures.push('Roadmap milestone overall collapse should use summary board collapse styling')
}
for (const oldColumnPattern of ['for (const ms of sourceMilestones)', 'title: ms.name', 'getMilestoneColumnKey(ms.name)']) {
  if (milestoneView.includes(oldColumnPattern)) {
    failures.push(`Roadmap milestone view should not render one table column per milestone: found ${oldColumnPattern}`)
  }
}
if (!milestoneView.includes('pms-summary-toolbar') || !milestoneView.includes('STATUS_FILTERS')) {
  failures.push('Roadmap milestone view should reuse the summary board toolbar pattern')
}
if (!milestoneView.includes('snapshotPopoverContent') || !milestoneView.includes('title="快照"')) {
  failures.push('Roadmap milestone snapshot controls should live in a compact hover popover')
}
if (!milestoneView.includes('SnapshotDateRange') || !milestoneView.includes('SNAPSHOT_DATE_RANGE_PRESETS') || !milestoneView.includes('pms-roadmap-snapshot-range')) {
  failures.push('Roadmap milestone snapshot popover should support snapshot time range search')
}
if (!milestoneView.includes('createdAtMs') || !milestoneView.includes('Math.random().toString(36)')) {
  failures.push('Roadmap milestone snapshots should use unique ids so selection only highlights one snapshot')
}
if (milestoneView.includes('pms-roadmap-snapshot-select')) {
  failures.push('Roadmap milestone snapshot switching should not occupy toolbar space with a select control')
}
if (milestoneView.includes('pms-project-view-select')) {
  failures.push('Roadmap milestone saved-view switching should use tabs, not the old select control')
}
if (milestoneView.includes('已收起 ${row.hiddenProjectCount || 0} 个项目') || milestoneView.includes('${tosCounts[value] || 0} 个项目')) {
  failures.push('Roadmap milestone tOS version column should not show project-count copy')
}
const roadmapTosVersionColumn = milestoneView.match(/dataIndex: 'tosVersionGroup'[\s\S]*?if \(isVisible\('productCategory'\)/)?.[0] || ''
if (roadmapTosVersionColumn.includes('pms-summary-category-dot')) {
  failures.push('Roadmap milestone tOS version column should not show the leading dot')
}
if (!milestoneView.includes("if (scope === 'overall') return col.key !== 'tosVersion'")) {
  failures.push('Roadmap milestone overall view should not show duplicated row tOS version after project name')
}
if (!milestoneView.includes('filterMilestonesByDateRange') || !milestoneView.includes('DatePicker.RangePicker')) {
  failures.push('Roadmap milestone should filter milestone nodes with a date range picker')
}
if (!milestoneView.includes('viewMode') || !milestoneView.includes("value: 'calendar'")) {
  failures.push('Roadmap milestone should switch between table and calendar views')
}
if (!milestoneView.includes('getDepartmentByFirstSpm')) {
  failures.push('Roadmap milestone department should derive from the first SPM person')
}
if (milestoneView.includes('09:00') || milestoneView.includes('pms-project-calendar-event-sub')) {
  failures.push('Roadmap milestone calendar event should be one compact line without time or second-line metadata')
}
if (!milestoneView.includes('pms-summary-sticky-region') || !milestoneView.includes('pms-summary-sticky-offset')) {
  failures.push('Roadmap milestone toolbar and filters should be wrapped in a sticky region')
}
if (!milestoneView.includes('pms-summary-toolbar-shell') || !milestoneView.includes('pms-summary-control-shell-static')) {
  failures.push('Roadmap milestone should only keep the status/action toolbar sticky, with view tabs scrolling normally')
}
if (!milestoneView.includes('top: 0 !important') || !milestoneView.includes('margin-bottom: 23px')) {
  failures.push('Roadmap milestone real table header should sit immediately below the sticky toolbar without a page-level offset')
}
if (!milestoneView.includes('TABLE_BODY_SCROLL_Y') || !milestoneView.includes("scroll={{ x: 'max-content', y: TABLE_BODY_SCROLL_Y }}")) {
  failures.push('Roadmap milestone table body should scroll inside the table so the header stays above body rows')
}
if (!milestoneView.includes('const SUMMARY_STICKY_TOP = 47')) {
  failures.push('Roadmap milestone sticky toolbar should sit high enough that its visible bottom meets the table header')
}
if (milestoneView.includes('sticky={{ offsetHeader: stickyTableOffset }}')) {
  failures.push('Roadmap milestone should not use Ant Design sticky holder because it can float below body rows')
}
if (milestoneView.includes('--pms-summary-table-header-offset')) {
  failures.push('Roadmap milestone should not use a page-level table header offset that pushes the header into the table body')
}
if (!milestoneView.includes("type RoadmapScope = 'overall' | 'machine' | 'tosVersion' | 'tech'")) {
  failures.push('Roadmap milestone tabs should exclude 独立软件产品项目')
}
if (!milestoneView.includes('const isIndependentSoftwareProject') || !milestoneView.includes('!isIndependentSoftwareProject(project)')) {
  failures.push('Roadmap milestone row builders should skip independent software product projects')
}
for (const status of ['待立项', '在研', '上市', '转维', 'EOS', '暂停', '已取消', '已迁移']) {
  if (!milestoneView.includes(status)) {
    failures.push(`Roadmap milestone view status scope missing ${status}`)
  }
}
for (const oldStatus of ['进行中', '已完成', '已上市', '维护期']) {
  const roadmapStatusBlock = milestoneView.match(/const STATUS_FILTERS[\s\S]*?\n\]/)?.[0] || ''
  if (roadmapStatusBlock.includes(oldStatus)) {
    failures.push(`Roadmap milestone status filter should not include old status ${oldStatus}`)
  }
}

const projectStatusAssignments = Array.from(projectData.matchAll(/status: '([^']+)'/g)).map(match => match[1])
for (const oldStatus of ['进行中', '已完成', '已上市', '维护期', '维护']) {
  if (projectStatusAssignments.includes(oldStatus)) {
    failures.push(`Mock project data should use new project status enum, found ${oldStatus}`)
  }
}
for (const status of ['待立项', '在研', '上市', '转维', 'EOS', '暂停', '已取消', '已迁移']) {
  if (!projectData.includes(`status: '${status}'`)) {
    failures.push(`Mock project data should include ${status} status`)
  }
}
if (!/type: PROJECT_TYPE_TECH,[\s\S]{0,260}status: '已迁移'/.test(projectData)) {
  failures.push('Mock project data should include a technical project with 已迁移 status')
}
if (!projectSpaceContainer.includes("const PROJECT_SPACE_STATUS_OPTIONS") || !projectSpaceContainer.includes("{ label: '已迁移', value: '已迁移' }")) {
  failures.push('Project space should expose 已迁移 in technical-project status options')
}
if (!projectSpaceContainer.includes('getProjectStatusOptions') || !projectSpaceContainer.includes("p.type === PROJECT_TYPE_TECH")) {
  failures.push('Project space status selector should add 已迁移 only for 技术项目')
}

for (const required of [
  'PROJECT_PLAN_CLONE_TEMPLATE_VERSIONS',
  'PROJECT_PLAN_CLONE_MARKET_VERSION_MAP',
  'buildPlanCloneMenuItems',
  'handleClonePlanSource',
  'cloneTasksWithoutActualDates',
  "title: '确认克隆计划'",
  "label: '模板'",
  "label: 'OP'",
  "label: 'TR'",
  "actualStartDate: ''",
  "actualEndDate: ''",
  '克隆',
]) {
  if (!projectSpaceContainer.includes(required)) {
    failures.push(`Project space revision clone feature missing ${required}`)
  }
}
for (const required of [
  'PLAN_REVISION_KIND_OPTIONS',
  '创建非正式版本',
  '创建正式版本',
  'getNextPlanRevisionVersionNo',
  'getPlanVersionId',
  'getPlanRevisionKindFromVersion',
  'comparePlanVersions',
  'renderCreateRevisionButton',
]) {
  if (!projectSpaceContainer.includes(required)) {
    failures.push(`Project space revision kind selection missing ${required}`)
  }
}
for (const required of [
  'newlyFollowedMarkets',
  "status === '修订中' ? { ...version, status: '已取消' } : version",
  "status: '已发布'",
  'setPublishedSnapshots',
  'getMarketFollowVersionKey',
  '市场配置已保存，已为跟随市场发布',
  'setSelectedMarketTab(followPublishPlans[0].market)',
]) {
  if (!projectSpaceContainer.includes(required)) {
    failures.push(`Project space follow-market auto publish missing ${required}`)
  }
}

const configContainer = read('src/containers/ConfigContainer.tsx')
const planStore = read('src/stores/plan.ts')
const level1TemplatePage = read('src/app/config/level1-template/page.tsx')
const level2TemplatePage = read('src/app/config/level2-template/page.tsx')
for (const required of [
  'PLAN_TEMPLATE_ROLE_OPTIONS',
  "{ label: 'SPM', value: 'SPM' }",
  "title: '角色'",
  'options={PLAN_TEMPLATE_ROLE_OPTIONS}',
]) {
  if (!configContainer.includes(required)) {
    failures.push(`Config plan template role editing missing ${required}`)
  }
}
if (configContainer.includes("title: '责任人'")) {
  failures.push('Config plan template should rename the old responsible column to 角色')
}
if (
  configContainer.includes('默认路标')
  || configContainer.includes("{ key: 'defaultRoadmap'")
  || configContainer.includes("visibleColumns.includes('defaultRoadmap')")
) {
  failures.push('Config plan template should not display or edit 默认路标')
}
if (!planStore.includes("responsible: 'SPM'")) {
  failures.push('Level1 template tasks should store SPM as the default template role')
}
for (const [pageName, pageSource] of [
  ['level1 template page', level1TemplatePage],
  ['level2 template page', level2TemplatePage],
]) {
  for (const required of [
    'PLAN_TEMPLATE_ROLE_OPTIONS',
    '>角色</th>',
    '<option key={role} value={role}>{role}</option>',
    "responsible: 'SPM'",
  ]) {
    if (!pageSource.includes(required)) {
      failures.push(`${pageName} should support role-based template editing: missing ${required}`)
    }
  }
  if (pageSource.includes('>责任人</th>')) {
    failures.push(`${pageName} should rename the old responsible column to 角色`)
  }
}
for (const required of [
  'PLAN_TEMPLATE_ROLE_TO_PROJECT_PERMISSION_ROLE',
  "SPM: '项目经理'",
  'initializeProjectPlanTasksFromTemplate',
  'getProjectRoleMembers',
  'getResponsibleNames',
]) {
  if (!projectSpaceContainer.includes(required)) {
    failures.push(`Project-space plan initialization should map template roles to project permission members: missing ${required}`)
  }
}
if (!/handleCreateRevision[\s\S]*initializeProjectPlanTasksFromTemplate/.test(projectSpaceContainer)) {
  failures.push('Project-space revision initialization should resolve template roles into project responsible people')
}

if (failures.length) {
  console.error('Project view requirement verification failed:')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('Project view requirement verification passed.')
