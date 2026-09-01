#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import ts from 'typescript'

const root = process.cwd()
const require = createRequire(import.meta.url)
const moduleCache = new Map()
const assertions = []

function registerAssertion(name, assertion) {
  assertions.push({ name, assertion })
}

function resolveTypeScriptModule(specifier, parentPath = path.join(root, 'index.ts')) {
  const candidate = specifier.startsWith('@/')
    ? path.join(root, 'src', specifier.slice(2))
    : specifier.startsWith('.')
      ? path.resolve(path.dirname(parentPath), specifier)
      : null

  if (!candidate) return require.resolve(specifier)

  for (const extension of ['', '.ts', '.tsx', '.js', '.jsx']) {
    const resolved = `${candidate}${extension}`
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) return resolved
  }

  for (const extension of ['.ts', '.tsx', '.js', '.jsx']) {
    const resolved = path.join(candidate, `index${extension}`)
    if (fs.existsSync(resolved)) return resolved
  }

  throw new Error(`Cannot resolve module "${specifier}" from ${parentPath}`)
}

function loadTypeScriptModule(modulePath) {
  const resolvedPath = path.resolve(modulePath)
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`missing shared helper: ${path.relative(root, resolvedPath)}`)
  }
  if (moduleCache.has(resolvedPath)) return moduleCache.get(resolvedPath).exports

  const module = { exports: {} }
  moduleCache.set(resolvedPath, module)
  const compiled = ts.transpileModule(fs.readFileSync(resolvedPath, 'utf8'), {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: resolvedPath,
  }).outputText
  const localRequire = specifier => {
    const dependencyPath = resolveTypeScriptModule(specifier, resolvedPath)
    if (/\.(?:css|less|scss|sass)$/.test(dependencyPath)) return {}
    return /\.(?:ts|tsx|js|jsx)$/.test(dependencyPath)
      ? loadTypeScriptModule(dependencyPath)
      : require(dependencyPath)
  }
  const wrapper = vm.runInThisContext(
    `(function (exports, require, module, __filename, __dirname) {${compiled}\n})`,
    { filename: resolvedPath },
  )
  wrapper(module.exports, localRequire, module, resolvedPath, path.dirname(resolvedPath))
  return module.exports
}

function loadContracts() {
  const projectSummaryPath = path.join(root, 'src/lib/projectSummary.ts')
  if (!fs.existsSync(projectSummaryPath)) {
    throw new Error('missing shared helper: src/lib/projectSummary.ts')
  }

  const projectSummary = loadTypeScriptModule(projectSummaryPath)
  const projectInfoSchema = loadTypeScriptModule(path.join(root, 'src/constants/projectInfoSchema.ts'))
  const filterConditions = loadTypeScriptModule(path.join(root, 'src/lib/filterConditions.ts'))
  const roadmapUtils = loadTypeScriptModule(path.join(root, 'src/components/roadmap/utils.ts'))
  const planStore = loadTypeScriptModule(path.join(root, 'src/stores/plan.ts'))
  const requiredProjectSummaryExports = [
    'getProjectSummaryFieldDefinitions',
    'getLatestPublishedTemplateTasks',
    'getLevel1SecondLevelTasks',
    'getTemplateTaskFieldDefinitions',
    'getProjectSummaryQuickFilterDefinitions',
    'updateLinkedQuickFilterCondition',
    'getWorkbenchListState',
    'buildProjectSummaryRow',
    'buildProjectSummaryColumns',
    'normalizeStoredProjectSummaryFilters',
  ]

  for (const name of requiredProjectSummaryExports) {
    if (typeof projectSummary[name] !== 'function') {
      throw new Error(`missing shared helper: src/lib/projectSummary.ts (${name})`)
    }
  }
  for (const name of ['MACHINE_PROJECT_INFO_FIELDS', 'TOS_PROJECT_INFO_FIELDS']) {
    if (!Array.isArray(projectInfoSchema[name])) throw new Error(`missing schema export: ${name}`)
  }
  if (typeof filterConditions.applyFilterConditions !== 'function') {
    throw new Error('missing shared helper: src/lib/filterConditions.ts (applyFilterConditions)')
  }
  if (typeof roadmapUtils.migrateLegacySummaryRows !== 'function') {
    throw new Error('missing shared helper: src/components/roadmap/utils.ts (migrateLegacySummaryRows)')
  }
  if (typeof roadmapUtils.getProjectSummaryScopeFilterFields !== 'function') {
    throw new Error('missing shared helper: src/components/roadmap/utils.ts (getProjectSummaryScopeFilterFields)')
  }
  if (typeof planStore.usePlanStore?.getState !== 'function') {
    throw new Error('missing initial plan store contract: src/stores/plan.ts (usePlanStore.getState)')
  }

  return {
    ...projectSummary,
    ...projectInfoSchema,
    ...filterConditions,
    ...roadmapUtils,
    ...planStore,
  }
}

let contracts
try {
  contracts = loadContracts()
} catch (error) {
  console.error(`FAIL project summary shared contracts`)
  console.error(`  ${error instanceof Error ? error.stack || error.message : String(error)}`)
  console.error('\nProject summary contract failed: 1 assertion(s)')
  process.exit(1)
}

const {
  getProjectSummaryFieldDefinitions,
  getLatestPublishedTemplateTasks,
  getLevel1SecondLevelTasks,
  getTemplateTaskFieldDefinitions,
  getProjectSummaryQuickFilterDefinitions,
  updateLinkedQuickFilterCondition,
  getWorkbenchListState,
  buildProjectSummaryRow,
  buildProjectSummaryColumns,
  normalizeStoredProjectSummaryFilters,
  MACHINE_PROJECT_INFO_FIELDS,
  TOS_PROJECT_INFO_FIELDS,
  applyFilterConditions,
  migrateLegacySummaryRows,
  getProjectSummaryScopeFilterFields,
  usePlanStore,
  TEMPLATE_PROJECT_TYPES,
  getTemplateSnapshotKey,
} = contracts

registerAssertion('project-info summary fields preserve each schema order', () => {
  const projectInfoKeys = projectType => getProjectSummaryFieldDefinitions(projectType)
    .filter(field => field.source === 'projectInfo')
    .map(field => field.key)

  assert.deepEqual(projectInfoKeys('整机产品项目'), MACHINE_PROJECT_INFO_FIELDS.map(field => field.key))
  assert.deepEqual(projectInfoKeys('tOS版本项目'), TOS_PROJECT_INFO_FIELDS.map(field => field.key))
})

registerAssertion('latest published template ignores the current draft', () => {
  const versions = [
    { id: 'v2', versionNo: 'V2', status: '已发布' },
    { id: 'v4', versionNo: 'V4', status: '修订中' },
    { id: 'v3', versionNo: 'V3', status: '已发布' },
    { id: 'v99', versionNo: 'V99', status: '已发布' },
  ]
  const snapshots = {
    'template::整机产品项目::level1::v2': [{ id: 'old', taskName: '旧节点' }],
    'template::整机产品项目::level1::v3': [{ id: 'new', taskName: '新节点' }],
    v99: [{ id: 'polluted-tech', taskName: '技术项目计划' }],
  }

  assert.equal(
    getLatestPublishedTemplateTasks('整机产品项目', versions, snapshots, 'v4', [])[0]?.id,
    'polluted-tech',
  )
  assert.equal(
    getLatestPublishedTemplateTasks(
      '整机产品项目',
      versions,
      { v99: snapshots.v99 },
      'v99',
      [{ id: 'polluted-current', taskName: '当前技术项目计划' }],
      { namespacedOnly: true },
    ).length,
    0,
  )
  assert.equal(
    getLatestPublishedTemplateTasks(
      '整机产品项目',
      versions,
      { v99: snapshots.v99 },
      'v99',
      [],
    )[0]?.id,
    'polluted-tech',
  )
})

registerAssertion('latest published template uses the last snapshot when version numbers tie', () => {
  const versions = [
    { id: 'v3-old', versionNo: 'V3', status: '已发布' },
    { id: 'v2', versionNo: 'V2', status: '已发布' },
    { id: 'v3-new', versionNo: 'V3', status: '已发布' },
  ]
  const snapshots = {
    'template::整机产品项目::level1::v3-old': [{ id: 'old', taskName: '旧快照' }],
    'template::整机产品项目::level1::v3-new': [{ id: 'new', taskName: '最后更新快照' }],
  }

  assert.equal(
    getLatestPublishedTemplateTasks(
      '整机产品项目',
      versions,
      snapshots,
      'v3-new',
      [],
      { namespacedOnly: true },
    )[0]?.id,
    'new',
  )
})

registerAssertion('initial plan store seeds isolated V3 template snapshots', () => {
  const state = usePlanStore.getState()
  assert.equal(
    state.versions.some(version => (
      version.id === 'v3' && version.status === '已发布'
    )),
    true,
  )

  const snapshots = TEMPLATE_PROJECT_TYPES.map(projectType => {
    const key = getTemplateSnapshotKey(projectType, 'v3')
    const snapshot = state.publishedSnapshots[key]
    const configuredTasks = state.configTemplateTasksByType[projectType]
    assert.ok(Array.isArray(snapshot) && snapshot.length > 0, `${projectType} missing V3 snapshot`)
    assert.deepEqual(snapshot, configuredTasks)
    assert.notStrictEqual(snapshot, configuredTasks)
    snapshot.forEach((task, index) => {
      assert.notStrictEqual(task, configuredTasks[index])
    })
    assert.ok(
      getLatestPublishedTemplateTasks(
        projectType,
        state.versions,
        state.publishedSnapshots,
        state.currentVersion,
        configuredTasks,
        { namespacedOnly: true },
      ).length > 0,
      `${projectType} strict template lookup is empty`,
    )
    return snapshot
  })

  snapshots.forEach((snapshot, index) => {
    snapshots.slice(index + 1).forEach(otherSnapshot => {
      assert.notStrictEqual(snapshot, otherSnapshot)
      assert.notStrictEqual(snapshot[0], otherSnapshot[0])
    })
  })
})

registerAssertion('level-one summary includes only direct second-level tasks', () => {
  const tasks = [
    { id: '2.1', parentId: '2', order: 1, taskName: '第二阶段直属二级任务' },
    { id: '2', order: 2, taskName: '第二阶段' },
    { id: '1.2', parentId: '1', order: 2, taskName: '第一阶段第二个直属二级任务' },
    { id: '1.1.1', parentId: '1.1', taskName: '三级任务' },
    { id: '1.1', parentId: '1', order: 1, taskName: '第一阶段第一个直属二级任务' },
    { id: '1', order: 1, taskName: '第一阶段' },
  ]

  assert.deepEqual(getLevel1SecondLevelTasks(tasks).map(task => task.id), ['1.1', '1.2', '2.1'])
})

registerAssertion('top-level tasks without order use their top-level sequence index', () => {
  const tasks = [
    { id: 'a', order: 2, taskName: '显式排序阶段' },
    { id: 'a1', parentId: 'a', taskName: '显式排序阶段任务' },
    { id: 'b', taskName: '缺省排序阶段' },
    { id: 'b1', parentId: 'b', taskName: '缺省排序阶段任务' },
  ]

  assert.deepEqual(getLevel1SecondLevelTasks(tasks).map(task => task.id), ['b1', 'a1'])
})

registerAssertion('summary rows map project info and real template task dates', () => {
  const tasks = [
    { id: '1', order: 1, taskName: '第一阶段' },
    { id: '1.1', parentId: '1', order: 1, taskName: '节点 A' },
    { id: '2', order: 2, taskName: '第二阶段' },
    { id: '2.1', parentId: '2', order: 1, taskName: '节点 B' },
  ]
  const project = {
    id: 'p1',
    name: 'Demo',
    type: '整机产品项目',
    status: '在研',
    developMode: 'ODC',
  }
  const planTasks = [{ id: '1.1', planEndDate: '2026-08-01' }]
  const definitions = [
    ...getProjectSummaryFieldDefinitions('整机产品项目'),
    ...getTemplateTaskFieldDefinitions('整机产品项目', tasks),
  ]
  const row = buildProjectSummaryRow(project, definitions, planTasks)

  assert.equal(row.projectName, 'Demo')
  assert.equal(row.developmentMode, 'ODC')
  assert.equal(row['templateTask::整机产品项目::1.1'], '2026-08-01')
  assert.equal(row['templateTask::整机产品项目::2.1'], '-')
  assert.equal(buildProjectSummaryColumns(definitions).at(0)?.fixed, 'left')
})

registerAssertion('workbench summary keeps option projects and plan tasks independent from row filters', () => {
  const workspacePath = path.join(root, 'src/containers/ProjectListContainer.tsx')
  const tablePath = path.join(root, 'src/components/project-summary/ProjectSummaryTable.tsx')
  const workspaceSource = fs.readFileSync(workspacePath, 'utf8')
  const tableSource = fs.readFileSync(tablePath, 'utf8')

  assert.match(
    workspaceSource,
    /const visibleProjects\s*=\s*projects/,
  )
  assert.match(
    workspaceSource,
    /const categoryBaseProjects[\s\S]{0,500}matchesProjectTypeFilter/,
  )
  assert.match(
    workspaceSource,
    /optionProjects=\{categoryBaseProjects\}/,
  )
  assert.match(
    workspaceSource,
    /planTasksByProjectId=\{projectSummaryPlanTasksByProjectId\}/,
  )
  assert.match(
    tableSource,
    /getProjectSummaryQuickFilterDefinitions\(projectType,\s*optionProjects\)/,
  )
  assert.match(
    tableSource,
    /buildProjectSummaryRow\([\s\S]{0,180}planTasksByProjectId\[project\.id\]/,
  )
})

registerAssertion('workbench list state follows the selected category', () => {
  assert.equal(getWorkbenchListState('all').kind, 'select-category')
  assert.deepEqual(getWorkbenchListState('整机产品项目'), {
    kind: 'table',
    showSecondaryCategory: true,
    showStatusQuickFilter: true,
  })
  assert.deepEqual(getWorkbenchListState('tOS版本项目'), {
    kind: 'table',
    showSecondaryCategory: false,
    showStatusQuickFilter: false,
  })
  assert.deepEqual(getWorkbenchListState('技术项目'), {
    kind: 'table',
    showSecondaryCategory: false,
    showStatusQuickFilter: false,
  })
})

registerAssertion('quick filters expose the expected linked project-info fields', () => {
  assert.deepEqual(
    getProjectSummaryQuickFilterDefinitions('整机产品项目', []).map(field => field.key),
    ['firstSaleTosVersion', 'chipCode', 'brand', 'productSeries', 'productType'],
  )
  assert.deepEqual(
    getProjectSummaryQuickFilterDefinitions('tOS版本项目', []).map(field => field.key),
    [],
  )
  assert.deepEqual(
    getProjectSummaryQuickFilterDefinitions('整机产品项目', [
      { id: 'machine', name: 'X6870', type: '整机产品项目', firstSaleTosVersion: '17.0.0' },
    ]).find(field => field.key === 'firstSaleTosVersion')?.options,
    [{ label: 'tOS17.0.0', value: 'tOS17.0.0' }],
  )
})

registerAssertion('linked quick filters add and clear enum contains conditions', () => {
  const updated = updateLinkedQuickFilterCondition([], 'brand', ['TECNO', 'Infinix'])
  assert.equal(updated.length, 1)
  assert.equal(updated[0].field, 'brand')
  assert.equal(updated[0].operator, 'contains')
  assert.deepEqual(updated[0].value, ['TECNO', 'Infinix'])
  assert.deepEqual(updateLinkedQuickFilterCondition(updated, 'brand', []), [])
})

registerAssertion('enum contains linked quick filters compose with AND semantics', () => {
  const rows = [
    { id: '1', brand: 'TECNO', productType: '新品' },
    { id: '2', brand: 'Infinix', productType: '老品' },
    { id: '3', brand: 'itel', productType: '新品' },
  ]
  const filtered = applyFilterConditions(rows, [
    { id: 'brand', field: 'brand', operator: 'contains', value: ['TECNO', 'Infinix'] },
    { id: 'productType', field: 'productType', operator: 'contains', value: ['新品'] },
  ])

  assert.deepEqual(filtered.map(row => row.id), ['1'])
})

registerAssertion('stored summary filters reject malformed data and migrate linked fields', () => {
  const fieldDefinitions = [
    { key: 'brand', label: '品牌', kind: 'enum', multiple: true },
    { key: 'status', label: '状态', kind: 'text' },
  ]

  for (const malformed of [
    null,
    [null],
    [{}],
    [{ id: 'bad', field: 'brand', operator: 'equals', value: 123 }],
  ]) {
    assert.doesNotThrow(() => normalizeStoredProjectSummaryFilters(
      malformed,
      fieldDefinitions,
    ))
    assert.deepEqual(
      normalizeStoredProjectSummaryFilters(malformed, fieldDefinitions),
      [],
    )
  }

  assert.deepEqual(
    normalizeStoredProjectSummaryFilters([
      { id: 'legacy', field: 'brand', operator: 'equals', value: ' TECNO ' },
    ], fieldDefinitions),
    [{ id: 'legacy', field: 'brand', operator: 'equals', value: 'TECNO' }],
  )
  assert.deepEqual(
    normalizeStoredProjectSummaryFilters([
      {
        id: 'empty',
        field: 'brand',
        operator: 'isEmpty',
        value: 'ignored legacy value',
      },
    ], fieldDefinitions),
    [{ id: 'empty', field: 'brand', operator: 'isEmpty', value: '' }],
  )
  assert.deepEqual(
    normalizeStoredProjectSummaryFilters([
      {
        id: 'linked',
        field: 'brand',
        operator: 'equalsAny',
        value: [' TECNO ', 'Infinix', 'TECNO'],
      },
    ], fieldDefinitions),
    [{
      id: 'linked',
      field: 'brand',
      operator: 'contains',
      value: ['TECNO', 'Infinix'],
    }],
  )
})

registerAssertion('shared summary table composes only the approved reusable controls', () => {
  const componentPath = path.join(root, 'src/components/project-summary/ProjectSummaryTable.tsx')
  assert.equal(fs.existsSync(componentPath), true, 'missing shared ProjectSummaryTable')
  const source = fs.readFileSync(componentPath, 'utf8')

  assert.match(source, /mode="multiple"/)
  assert.match(source, /FloatingFilterPanel/)
  assert.match(source, /SortableColumnSettings/)
  assert.match(source, /applyFilterConditions/)
  assert.match(source, /getLinkedQuickFilterValues/)
  assert.match(
    source,
    /getLatestPublishedTemplateTasks\([\s\S]{0,500}namespacedOnly:\s*true/,
  )
  assert.match(
    source,
    /aria-label=\{`快捷筛选-\$\{definition\.label\}`\}/,
    'quick filters must expose the stable browser label prefix',
  )
  assert.doesNotMatch(source, /导出|分享|全屏|savedProjectView|calendar/)
})

registerAssertion('legacy shared milestone rows migrate safely to stable template keys', () => {
  const definitions = [
    {
      key: 'templateTask::整机产品项目::1.1',
      title: '概念启动',
      source: 'templateTask',
    },
    {
      key: 'templateTask::整机产品项目::2.1',
      title: '计划 / 评审',
      parentTaskName: '计划',
      source: 'templateTask',
    },
    {
      key: 'templateTask::整机产品项目::3.1',
      title: '验证 / 评审',
      parentTaskName: '验证',
      source: 'templateTask',
    },
  ]
  const legacyRows = [{
    key: 'machine-1',
    projectType: '整机产品项目',
    milestones: [
      { name: '概念启动', date: '2026/1/1' },
      { name: '计划 / 评审', date: '2026/2/1' },
      { name: '无法识别', date: 'not-a-date' },
    ],
  }]

  const [migrated] = migrateLegacySummaryRows(legacyRows, definitions)
  assert.equal(migrated['templateTask::整机产品项目::1.1'], '2026/1/1')
  assert.equal(migrated['templateTask::整机产品项目::2.1'], '2026/2/1')
  assert.equal(migrated['templateTask::整机产品项目::3.1'], '-')
  assert.deepEqual(migrated.milestones, legacyRows[0].milestones)
  assert.doesNotThrow(() => migrateLegacySummaryRows([
    { key: 'machine-2', milestonesText: 'legacy free text only' },
    null,
  ], definitions))
})

registerAssertion('technical summary exposes only its legacy aggregate date filter', () => {
  const baseFields = [
    { key: 'projectName', label: '项目名称', kind: 'text' },
    { key: 'milestones', label: '里程碑节点', kind: 'text' },
  ]
  assert.deepEqual(getProjectSummaryScopeFilterFields('tech', baseFields), [
    { key: 'projectName', label: '项目名称', kind: 'text' },
    { key: 'milestonesText', label: '里程碑节点', kind: 'date' },
  ])
  assert.deepEqual(getProjectSummaryScopeFilterFields('machine', baseFields), [
    { key: 'projectName', label: '项目名称', kind: 'text' },
    { key: 'nodeDateRange', label: '节点日期范围', kind: 'date' },
  ])
  assert.deepEqual(getProjectSummaryScopeFilterFields('overall', [baseFields[0]]), [
    { key: 'projectName', label: '项目名称', kind: 'text' },
    { key: 'nodeDateRange', label: '节点日期范围', kind: 'date' },
  ])
})

registerAssertion('summary board consumes schema and template definitions through every data path', () => {
  const boardPath = path.join(root, 'src/components/roadmap/ProjectPlanSummaryBoard.tsx')
  const source = fs.readFileSync(boardPath, 'utf8')

  assert.match(source, /getProjectSummaryFieldDefinitions/)
  assert.match(source, /getTemplateTaskFieldDefinitions/)
  assert.match(
    source,
    /getLatestPublishedTemplateTasks\([\s\S]{0,500}namespacedOnly:\s*true/,
  )
  assert.doesNotMatch(source, /MACHINE_MILESTONE_NAMES/)
  assert.doesNotMatch(source, /TOS_VERSION_MILESTONE_NAMES/)
  assert.match(
    source,
    /TECHNICAL_MILESTONE_COLUMN[\s\S]{0,180}key:\s*['"]milestones['"][\s\S]{0,100}title:\s*['"]里程碑节点['"]/,
  )
  assert.doesNotMatch(source, /TECH_NODE_DEFINITIONS/)
  assert.match(source, /activeProjectSummaryDefinitions/)
  assert.match(source, /filterFieldDefinitions/)
  assert.match(
    source,
    /project\.type === PROJECT_TYPE_TECH[\s\S]{0,900}milestones,\s*[\r\n]+\s*milestonesText:/,
  )
  assert.match(
    source,
    /getRowNodeMilestones[\s\S]{0,900}getSafeRowMilestones\(row\.milestones\)/,
  )
  assert.match(
    source,
    /applyMilestoneDateRange[\s\S]{0,1800}row\.projectType === PROJECT_TYPE_TECH[\s\S]{0,350}milestones,\s*[\r\n]+\s*milestonesText:/,
  )
  assert.match(source, /migrateLegacySummaryRows/)
  assert.ok(
    (source.match(/getProjectSummaryScopeFilterFields/g) || []).length >= 3,
    'current and saved/share filter definitions must use the shared scope contract',
  )
  assert.match(
    source,
    /isMilestoneDateFilter[\s\S]{0,260}MILESTONE_FILTER_FIELD[\s\S]{0,160}TECH_MILESTONE_FILTER_FIELD/,
  )
  assert.match(
    source,
    /milestoneFilterField\s*=\s*milestoneCondition\?\.field\s*\?\?/,
  )
  assert.match(
    source,
    /filterFieldDefinitions\?\.some\([\s\S]{0,180}TECH_MILESTONE_FILTER_FIELD[\s\S]{0,220}createMilestoneDateFilter/,
  )
  assert.match(source, /buildExportColumns[\s\S]{0,700}definition\.key/)
  assert.match(source, /definition\.key === ['"]milestones['"][\s\S]{0,100}['"]milestonesText['"]/)
  assert.match(source, /buildCurrentProjectViewState[\s\S]{0,500}columnSettings\.order/)
  assert.match(source, /calendarEvents[\s\S]{0,1200}getRowNodeMilestones/)
  assert.match(source, /orderVisibleDefinitions\(columnDefinitions,\s*columnSettings\)/)
})

let failureCount = 0
for (const { name, assertion } of assertions) {
  try {
    assertion()
    console.log(`PASS ${name}`)
  } catch (error) {
    failureCount += 1
    console.error(`FAIL ${name}`)
    console.error(`  ${error instanceof Error ? error.message : String(error)}`)
  }
}

if (failureCount) {
  console.error(`\nProject summary contract failed: ${failureCount} assertion(s)`)
  process.exitCode = 1
} else {
  console.log('\nProject summary contract passed')
}
