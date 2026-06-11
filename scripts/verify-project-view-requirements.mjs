import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

const checks = [
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
    name: 'Project basic info supports OS series',
    file: 'src/containers/ProjectSpaceContainer.tsx',
    includes: 'OS系列',
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
]

const failures = []

for (const check of checks) {
  const fullPath = path.join(root, check.file)
  if (!fs.existsSync(fullPath)) {
    failures.push(`${check.name}: missing file ${check.file}`)
    continue
  }

  const content = read(check.file)
  if (!content.includes(check.includes)) {
    failures.push(`${check.name}: missing "${check.includes}" in ${check.file}`)
  }
}

const summaryBoard = read('src/components/roadmap/ProjectPlanSummaryBoard.tsx')
const statusFilterBlock = summaryBoard.match(/const STATUS_FILTERS[\s\S]*?\n\]/)?.[0] || ''
const forbiddenStatusFilters = ['筹备中', 'EOL', "key: '维护'"]
for (const status of forbiddenStatusFilters) {
  if (statusFilterBlock.includes(status)) {
    failures.push(`Summary board status filter should not include ${status.replace('\\\\', '')}`)
  }
}
for (const status of ['进行中', '已完成', '已上市', '维护期']) {
  if (!statusFilterBlock.includes(status)) {
    failures.push(`Summary board status filter missing ${status}`)
  }
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

const milestoneView = read('src/components/roadmap/MilestoneView.tsx')
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
if (!milestoneView.includes("scope === 'overall'") || !milestoneView.includes("col.key !== 'tosVersionGroup'")) {
  failures.push('Roadmap milestone scoped tabs should use overall fields with tOS version removed')
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
if (milestoneView.includes('pms-project-view-select')) {
  failures.push('Roadmap milestone saved-view switching should use tabs, not the old select control')
}
for (const status of ['待立项', '进行中', '已完成', '暂停', '已取消', '已上市', '维护期']) {
  if (!milestoneView.includes(status)) {
    failures.push(`Roadmap milestone view status scope missing ${status}`)
  }
}

if (failures.length) {
  console.error('Project view requirement verification failed:')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('Project view requirement verification passed.')
