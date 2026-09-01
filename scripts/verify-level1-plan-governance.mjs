import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { loadTypeScriptModule } from './lib/source-contract.mjs'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const rulesPath = path.join(root, 'src/lib/level1PlanRules.ts')
const versioningPath = path.join(root, 'src/lib/planVersioning.ts')
const projectMockPath = path.join(root, 'src/data/projectListPlanMocks.ts')

if (!fs.existsSync(rulesPath)) throw new Error('src/lib/level1PlanRules.ts does not exist')

const source = fs.readFileSync(rulesPath, 'utf8')
const transpiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  fileName: rulesPath,
}).outputText
const rules = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`)
const loadTypescriptModule = async modulePath => {
  const moduleSource = fs.readFileSync(modulePath, 'utf8')
  const moduleOutput = ts.transpileModule(moduleSource, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: modulePath,
  }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(moduleOutput).toString('base64')}`)
}
const versioning = await loadTypescriptModule(versioningPath)
const projectMocks = await loadTypescriptModule(projectMockPath)
const projectSpaceRules = loadTypeScriptModule(root, 'src/lib/projectSpaceLevel1Rules.ts')

assert.equal(
  typeof projectSpaceRules.shouldAutoEnablePlanEditMode,
  'function',
  'project-space plan entry must expose one deterministic draft edit-mode rule',
)
assert.equal(projectSpaceRules.shouldAutoEnablePlanEditMode({
  activeModule: 'projectSpace',
  projectSpaceModule: 'plan',
  isCurrentDraft: true,
  followedReadOnly: false,
}), true, 'entering the plan module on a revision enables editing immediately')
assert.equal(projectSpaceRules.shouldAutoEnablePlanEditMode({
  activeModule: 'projectSpace',
  projectSpaceModule: 'basic',
  isCurrentDraft: true,
  followedReadOnly: false,
}), false, 'a revision must not keep project-space non-plan modules in plan edit mode')
assert.equal(projectSpaceRules.shouldAutoEnablePlanEditMode({
  activeModule: 'projectSpace',
  projectSpaceModule: 'plan',
  isCurrentDraft: true,
  followedReadOnly: true,
}), false, 'followed tOS plans remain read-only even when the selected version is a revision')

const horizontalVersions = [
  { id: 'v1', versionNo: 'V1', status: '已发布' },
  { id: 'v2', versionNo: 'V2', status: '已发布' },
  { id: 'v3', versionNo: 'V3', status: '修订中' },
]
for (const stageName of ['上市阶段', '生命周期阶段']) {
  assert.equal(
    rules.isBusinessStage('整机产品项目', rules.buildMachineLevel1Tasks(true).find(task => task.taskName === stageName)),
    true,
    `whole-machine ${stageName} hides its horizontal duration badge`,
  )
}
for (const stageName of ['上市迭代阶段', '维护阶段']) {
  assert.equal(
    rules.isBusinessStage('tOS版本项目', rules.buildTosLevel1Tasks(true).find(task => task.taskName === stageName)),
    true,
    `tOS ${stageName} hides its horizontal duration badge`,
  )
}
assert.equal(
  rules.isBusinessStage('整机产品项目', rules.buildMachineLevel1Tasks(true).find(task => task.taskName === '概念阶段')),
  false,
  'fixed stages retain their horizontal duration badge',
)
assert.deepEqual(
  versioning.getDisplayPlanVersionsForHorizontalPlan(horizontalVersions).map(version => version.id),
  ['v1', 'v2'],
  'read-only horizontal plans only expose published versions',
)
assert.deepEqual(
  versioning.getDisplayPlanVersionsForHorizontalPlan(horizontalVersions, { includeDraft: true }).map(version => version.id),
  ['v1', 'v2', 'v3'],
  'maintainers can see the current revision in the horizontal plan',
)
assert.deepEqual(
  projectSpaceRules.selectLevel1HorizontalVersions(horizontalVersions, { surface: 'basic-info', includeDraft: false }).map(version => version.id),
  ['v2'],
  'basic information exposes only the latest published level-one version',
)
assert.deepEqual(
  projectSpaceRules.selectLevel1HorizontalVersions(horizontalVersions, { surface: 'basic-info', includeDraft: true }).map(version => version.id),
  ['v2'],
  'basic information ignores maintainer draft visibility and stays identical for every permission level',
)
assert.deepEqual(
  projectSpaceRules.selectLevel1HorizontalVersions(horizontalVersions, { surface: 'project-plan', includeDraft: true }).map(version => version.id),
  ['v1', 'v2', 'v3'],
  'the project-plan horizontal surface retains published history and maintainer-visible revisions',
)
assert.deepEqual(
  projectSpaceRules.selectLevel1HorizontalVersions([
    { id: 'draft-only', versionNo: 'V2', status: '修订中' },
    { id: 'broken', versionNo: 'latest', status: '已发布' },
  ], { surface: 'basic-info', includeDraft: true }),
  [],
  'basic information returns a stable empty result when no valid published version exists',
)
assert.deepEqual(
  projectSpaceRules.selectLevel1HorizontalVersions([
    { id: 'v3.9', versionNo: 'V3.9', status: '已发布' },
    { id: 'v3.10', versionNo: 'V3.10', status: '已发布' },
  ], { surface: 'basic-info' }).map(version => version.id),
  ['v3.10'],
  'basic information compares numeric version segments instead of sorting them lexically',
)
assert.deepEqual(
  projectSpaceRules.selectLevel1HorizontalVersions([
    { id: 'legacy-no-status', versionNo: 'V1' },
  ], { surface: 'basic-info' }),
  [],
  'basic information rejects a version whose publication status is missing',
)
assert.deepEqual(
  projectSpaceRules.selectLevel1HorizontalVersions([
    { id: 'legacy-no-status', versionNo: 'V1' },
  ], { surface: 'project-plan', includeDraft: true }),
  [],
  'project plan rejects a version whose publication status is missing instead of treating it differently from basic information',
)
assert.equal(
  projectSpaceRules.canEditLevel1HorizontalActualProjection({
    versions: horizontalVersions,
    currentVersionId: 'v3',
    actualVersionId: 'v2',
    canMaintain: true,
  }),
  true,
  'a maintainer can edit the latest published actual projection while the selected version is a revision',
)
assert.equal(
  projectSpaceRules.canEditLevel1HorizontalActualProjection({
    versions: horizontalVersions,
    currentVersionId: 'v3',
    actualVersionId: 'v1',
    canMaintain: true,
  }),
  false,
  'an older published actual projection is not editable while a newer publication exists',
)
assert.deepEqual(
  projectSpaceRules.resolveLevel1HorizontalActualProjectionAccess({
    versions: horizontalVersions,
    currentVersionId: 'v3',
    actualVersionId: 'v2',
    canMaintain: true,
  }),
  { canEdit: true, targetPublishedVersionId: 'v2' },
  'a selected revision keeps the actual row editable while explicitly targeting the latest published snapshot',
)
assert.equal(
  projectSpaceRules.sumLevel1StageEstimatedDays([
    { id: '1', parentId: null, estimatedDays: 10 },
    { id: '1.1', parentId: '1', estimatedDays: 500 },
    { id: '2', estimatedDays: 70 },
    { id: '2.1', parentId: '2', estimatedDays: 600 },
    { id: '3', parentId: '', estimatedDays: 20 },
  ]),
  100,
  'horizontal development cycle sums root-stage durations without double-counting child values',
)
assert.equal(
  projectSpaceRules.sumLevel1StageEstimatedDays([
    { id: '1', parentId: null, estimatedDays: null },
    { id: '2', parentId: null, estimatedDays: Number.NaN },
    { id: '3', parentId: null, estimatedDays: -1 },
    { id: '3.1', parentId: '3', estimatedDays: 20 },
  ]),
  null,
  'horizontal development cycle stays empty when every root-stage duration is empty or invalid',
)
assert.equal(
  projectSpaceRules.canEditLevel1HorizontalDateCell({ id: '4', nodeKind: 'stage', parentId: null }),
  false,
  'an empty business-stage placeholder is never an editable horizontal date cell',
)
assert.equal(
  projectSpaceRules.canEditLevel1HorizontalDateCell({ id: '4.1', nodeKind: 'business-period', parentId: '4' }),
  true,
  'a second-level business period remains an editable horizontal date cell',
)
assert.equal(
  projectSpaceRules.canEditLevel1HorizontalDateCell({ id: 'legacy-root', parentId: null }),
  false,
  'a legacy root row without nodeKind also remains readonly',
)

assert.deepEqual(projectSpaceRules.LEVEL1_TREE_FILTER_FIELDS.map(field => field.label), [
  '序号',
  '阶段/节点',
  '计划开始时间',
  '计划完成时间',
  '预估工期',
  '实际开始时间',
  '实际完成时间',
  '实际工期',
  '是否延期',
], 'tree filters expose exactly the visible nine-column workspace fields in display order')
assert.deepEqual(
  projectSpaceRules.LEVEL1_TREE_FILTER_FIELDS.map(field => field.key),
  ['id', 'taskName', 'planStartDate', 'planEndDate', 'estimatedDays', 'actualStartDate', 'actualEndDate', 'actualDays', 'delayStatus'],
  'tree filters use the governed row-model keys and omit hidden legacy fields',
)

const treeRows = [
  {
    id: '1', stableId: 'stage-concept', parentId: null, taskName: '概念阶段',
    planStartDate: '2026-01-01', planEndDate: '2026-03-31', estimatedDays: 90,
    actualStartDate: '2026-01-03', actualEndDate: '2026-04-01', actualDays: 89, delayStatus: '',
  },
  {
    id: '1.1', stableId: 'milestone-kickoff', parentId: 'stage-concept', taskName: '概念启动',
    planStartDate: '', planEndDate: '2026-01-15', estimatedDays: null,
    actualStartDate: '', actualEndDate: '2026-01-15', actualDays: null, delayStatus: '按时',
  },
  {
    id: '1.2', stableId: 'milestone-str1', parentId: '1', taskName: 'STR1',
    planStartDate: '', planEndDate: '2026-03-31', estimatedDays: null,
    actualStartDate: '', actualEndDate: '2026-04-01', actualDays: null, delayStatus: '延期',
  },
  {
    id: '2', stableId: 'stage-planning', parentId: null, taskName: '计划阶段',
    planStartDate: '2026-04-01', planEndDate: '2026-06-30', estimatedDays: 91,
    actualStartDate: '', actualEndDate: '', actualDays: null, delayStatus: '',
  },
  {
    id: '2.1', stableId: 'milestone-str2', parentId: '2', taskName: 'STR2',
    planStartDate: '', planEndDate: '2026-05-01', estimatedDays: null,
    actualStartDate: '', actualEndDate: '', actualDays: null, delayStatus: '-',
  },
  {
    id: 'orphan', stableId: 'orphan', parentId: 'missing-parent', taskName: '孤立节点',
    planStartDate: '2026-07-01', planEndDate: '2026-07-02', estimatedDays: 2,
    actualStartDate: '', actualEndDate: '', actualDays: null, delayStatus: '-',
  },
]
const treeRowsInput = structuredClone(treeRows)
assert.deepEqual(
  projectSpaceRules.filterLevel1TreeRows(treeRows, [{ field: 'taskName', operator: 'contains', value: 'STR1' }]).map(row => row.taskName),
  ['概念阶段', 'STR1'],
  'a matching child keeps its parent and original row order',
)
assert.deepEqual(
  projectSpaceRules.filterLevel1TreeRows(treeRows, [{ field: 'taskName', operator: 'contains', value: '概念阶段' }]).map(row => row.taskName),
  ['概念阶段', '概念启动', 'STR1'],
  'a matching parent keeps all children linked by stable or display parent IDs',
)
assert.deepEqual(
  projectSpaceRules.filterLevel1TreeRows(treeRows, [
    { field: 'taskName', operator: 'contains', value: 'STR' },
    { field: 'delayStatus', operator: 'equals', value: '延期' },
  ]).map(row => row.taskName),
  ['概念阶段', 'STR1'],
  'multiple tree-filter conditions retain existing AND semantics across stages',
)
assert.deepEqual(
  projectSpaceRules.filterLevel1TreeRows(treeRows, [{ field: 'planEndDate', operator: 'before', value: '2026-02-01' }]).map(row => row.taskName),
  ['概念阶段', '概念启动'],
  'date filtering reuses the strict date operator and expands a matching child hierarchy',
)
assert.deepEqual(
  projectSpaceRules.filterLevel1TreeRows(treeRows, [{ field: 'estimatedDays', operator: 'equals', value: '91' }]).map(row => row.taskName),
  ['计划阶段', 'STR2'],
  'numeric row values remain compatible with exact text filtering',
)
assert.deepEqual(
  projectSpaceRules.filterLevel1TreeRows(treeRows, [{ field: 'delayStatus', operator: 'equals', value: '按时' }]).map(row => row.taskName),
  ['概念阶段', '概念启动'],
  'enum equality keeps the matched child and its parent',
)
const emptyDelayStatusRows = [
  { id: '1', stableId: 'empty-delay-stage', parentId: null, taskName: '空延期阶段', delayStatus: '' },
  { id: '1.1', stableId: 'on-time-child', parentId: 'empty-delay-stage', taskName: '按时子节点', delayStatus: '按时' },
  { id: '2', stableId: 'null-delay-stage', parentId: null, taskName: '空值阶段', delayStatus: null },
  { id: '3', stableId: 'undefined-delay-stage', parentId: null, taskName: '未定义阶段' },
]
assert.deepEqual(
  projectSpaceRules.filterLevel1TreeRows(emptyDelayStatusRows, [{ field: 'delayStatus', operator: 'equals', value: '-' }]).map(row => row.taskName),
  ['空延期阶段', '按时子节点', '空值阶段', '未定义阶段'],
  "displayed '-' delay filtering matches empty stage values and keeps a matched parent's children",
)
assert.deepEqual(
  projectSpaceRules.filterLevel1TreeRows(emptyDelayStatusRows, [{ field: 'delayStatus', operator: 'contains', value: '-' }]),
  [],
  'delay display normalization does not change contains behavior',
)
assert.deepEqual(
  projectSpaceRules.filterLevel1TreeRows(treeRows, [{ field: 'taskName', operator: 'contains', value: '孤立' }]).map(row => row.taskName),
  ['孤立节点'],
  'a matching orphan is never dropped when its parent cannot be resolved',
)
const unfilteredTreeRows = projectSpaceRules.filterLevel1TreeRows(treeRows, [])
assert.deepEqual(unfilteredTreeRows, treeRows, 'empty tree filters retain every row in original order')
assert.equal(unfilteredTreeRows.every((row, index) => row !== treeRows[index]), true, 'empty tree filters clone every returned row')
assert.deepEqual(treeRows, treeRowsInput, 'tree filtering never mutates its input rows')

const stablePriorityRows = [
  { id: 'display-parent', stableId: 'shared-parent', parentId: null, taskName: '稳定父节点' },
  { id: 'shared-parent', stableId: 'other-parent', parentId: null, taskName: '显示ID冲突父节点' },
  { id: 'child', stableId: 'stable-child', parentId: 'shared-parent', taskName: '稳定子节点' },
]
assert.deepEqual(
  projectSpaceRules.filterLevel1TreeRows(stablePriorityRows, [{ field: 'taskName', operator: 'equals', value: '稳定子节点' }]).map(row => row.taskName),
  ['稳定父节点', '稳定子节点'],
  'stable parent identity wins over a colliding display ID',
)

const summaryVersions = [
  { id: 'v9', versionNo: 'V9', status: '已发布' },
  { id: 'v11', versionNo: 'V11', status: '修订中' },
  { id: 'v10', versionNo: 'V10', status: '已发布' },
]
const summarySnapshots = {
  v9: [{ planStartDate: '2025-01-01', planEndDate: '2025-12-31', actualStartDate: '2025-01-02', actualEndDate: '2026-01-02' }],
  v10: [
    { planStartDate: '2026-03-01', planEndDate: '2026-09-30', actualStartDate: '2026-03-03', actualEndDate: '2026-10-02' },
    { planStartDate: '2026-01-01', planEndDate: '2026-12-31', actualStartDate: '2026-01-03', actualEndDate: '2027-01-02' },
    { planStartDate: '2024-02-30', planEndDate: '2030-13-01', actualStartDate: 'not-a-date', actualEndDate: '2035-02-29' },
  ],
  v11: [{ planStartDate: '1900-01-01', planEndDate: '2099-12-31', actualStartDate: '1900-01-01', actualEndDate: '2099-12-31' }],
}
const summaryVersionsInput = structuredClone(summaryVersions)
const summarySnapshotsInput = structuredClone(summarySnapshots)
const snapshotCalls = []
const latestPublishedSummary = projectSpaceRules.selectLatestPublishedLevel1Summary({
  versions: summaryVersions,
  getSnapshot: versionId => {
    snapshotCalls.push(versionId)
    return summarySnapshots[versionId]
  },
})
assert.deepEqual(latestPublishedSummary, {
  versionId: 'v10',
  planStartDate: '2026-01-01',
  planEndDate: '2026-12-31',
  actualStartDate: '2026-01-03',
  actualEndDate: '2027-01-02',
}, 'the latest real published version supplies min/max valid ISO summary dates')
assert.deepEqual(snapshotCalls, ['v10'], 'snapshot lookup only reads the selected latest published version and never a draft')
assert.deepEqual(summaryVersions, summaryVersionsInput, 'latest-published selection never mutates versions')
assert.deepEqual(summarySnapshots, summarySnapshotsInput, 'summary aggregation never mutates snapshots')
latestPublishedSummary.planStartDate = 'mutated-result'
assert.equal(projectSpaceRules.selectLatestPublishedLevel1Summary({
  versions: summaryVersions,
  getSnapshot: versionId => summarySnapshots[versionId],
}).planStartDate, '2026-01-01', 'summary calls return independent result objects')

const emptyLevel1Summary = {
  versionId: null,
  planStartDate: '',
  planEndDate: '',
  actualStartDate: '',
  actualEndDate: '',
}
assert.deepEqual(
  projectSpaceRules.selectLatestPublishedLevel1Summary({ versions: summaryVersions, getSnapshot: () => undefined }),
  emptyLevel1Summary,
  'a missing latest-published snapshot returns the empty summary without a live fallback',
)
assert.deepEqual(
  projectSpaceRules.selectLatestPublishedLevel1Summary({ versions: summaryVersions, getSnapshot: () => [] }),
  emptyLevel1Summary,
  'an empty latest-published snapshot returns the empty summary',
)
let draftOnlySnapshotCalls = 0
assert.deepEqual(
  projectSpaceRules.selectLatestPublishedLevel1Summary({
    versions: [{ id: 'draft', versionNo: 'V99', status: '修订中' }],
    getSnapshot: () => {
      draftOnlySnapshotCalls += 1
      return summarySnapshots.v11
    },
  }),
  emptyLevel1Summary,
  'draft-only scopes return the empty summary',
)
assert.equal(draftOnlySnapshotCalls, 0, 'draft-only scopes never read a snapshot')

const linkedMockTemplate = [
  { id: 'stage', taskName: '阶段', order: 0 },
  { id: 'node-a', parentId: 'stage', taskName: '节点A', order: 0 },
  { id: 'node-b', parentId: 'stage', taskName: '节点B', order: 1 },
  { id: 'empty-stage', taskName: '空阶段', order: 1 },
]
const linkedMockA = projectMocks.buildProjectListMockPlanTasks('project-a', linkedMockTemplate)
const linkedMockB = projectMocks.buildProjectListMockPlanTasks('project-b', linkedMockTemplate)
const linkedPrimaryProject = projectMocks.buildProjectListMockPlanTasks('1', linkedMockTemplate)
assert.equal(linkedMockA.length, linkedMockTemplate.length)
const linkedMockParent = linkedMockA.find(task => task.id === 'stage')
const linkedMockEmptyParent = linkedMockA.find(task => task.id === 'empty-stage')
const linkedMockChildren = linkedMockA.filter(task => task.parentId === 'stage')
assert.deepEqual(
  [linkedMockParent.planStartDate, linkedMockParent.planEndDate, linkedMockParent.actualEndDate],
  ['', '', ''],
  'project mock parent dates remain empty so the Level 1 projection can aggregate them',
)
assert.deepEqual(
  [linkedMockEmptyParent.planStartDate, linkedMockEmptyParent.planEndDate, linkedMockEmptyParent.actualEndDate],
  ['', '', ''],
  'an empty top-level activity also remains aggregation-only mock data',
)
assert.equal(linkedMockChildren.every(task => task.planStartDate === ''), true, 'second-level mock tasks do not invent plan start dates')
assert.equal(linkedMockChildren.every(task => task.planEndDate), true, 'second-level mock tasks contain plan completion dates')
assert.equal(
  linkedMockChildren.every((task, index) => index === 0 || task.planEndDate > linkedMockChildren[index - 1].planEndDate),
  true,
  'second-level mock completion dates are strictly increasing',
)
assert.deepEqual(
  linkedPrimaryProject.filter(task => task.parentId === 'stage').map(task => task.planEndDate),
  ['2026-02-26', '2026-03-17'],
  'the primary X6877 project uses the same baseline milestone dates as its project-space plan',
)
assert.notDeepEqual(
  linkedMockChildren.map(task => task.planEndDate),
  linkedMockB.filter(task => task.parentId === 'stage').map(task => task.planEndDate),
  'project mock plans are scoped by project id',
)

const describeTemplate = tasks => {
  const stableIdById = new Map(tasks.map(task => [task.id, task.stableId]))
  return tasks.map(task => [
    task.stableId,
    task.parentId ? stableIdById.get(task.parentId) : null,
    task.taskName,
    task.nodeKind,
  ])
}

const machineTemplateTasks = rules.buildLevel1TasksForProjectType('整机产品项目', true)
assert.deepEqual(
  describeTemplate(machineTemplateTasks),
  [
    ['machine-stage-concept', null, '概念阶段', 'stage'],
    ['machine-ms-concept-kickoff', 'machine-stage-concept', '概念启动', 'fixed-milestone'],
    ['machine-ms-str1', 'machine-stage-concept', 'STR1', 'fixed-milestone'],
    ['machine-stage-planning', null, '计划阶段', 'stage'],
    ['machine-ms-str2', 'machine-stage-planning', 'STR2', 'fixed-milestone'],
    ['machine-ms-str3', 'machine-stage-planning', 'STR3', 'fixed-milestone'],
    ['machine-stage-development', null, '开发验证阶段', 'stage'],
    ['machine-ms-str4', 'machine-stage-development', 'STR4', 'fixed-milestone'],
    ['machine-ms-str4a', 'machine-stage-development', 'STR4A', 'fixed-milestone'],
    ['machine-ms-str5', 'machine-stage-development', 'STR5', 'fixed-milestone'],
    ['machine-stage-launch', null, '上市阶段', 'stage'],
    ['machine-stage-lifecycle', null, '生命周期阶段', 'stage'],
  ],
  'whole-machine templates keep explicit stable IDs, parent links, names, and node kinds',
)
assert.equal(
  machineTemplateTasks.some(task => ['上市阶段', '生命周期阶段'].includes(task.taskName)
    && machineTemplateTasks.some(child => child.parentId === task.id)),
  false,
  'whole-machine business stages start empty',
)

const tosTemplateTasks = rules.buildLevel1TasksForProjectType('tOS版本项目', true)
assert.deepEqual(
  describeTemplate(tosTemplateTasks),
  [
    ['tos-stage-concept', null, '概念阶段', 'stage'],
    ['tos-ms-concept-kickoff', 'tos-stage-concept', '概念启动', 'fixed-milestone'],
    ['tos-ms-str1', 'tos-stage-concept', 'STR1', 'fixed-milestone'],
    ['tos-stage-plan', null, '计划阶段', 'stage'],
    ['tos-ms-str2', 'tos-stage-plan', 'STR2', 'fixed-milestone'],
    ['tos-ms-str3', 'tos-stage-plan', 'STR3', 'fixed-milestone'],
    ['tos-stage-development-validation', null, '开发验证阶段', 'stage'],
    ['tos-ms-str4', 'tos-stage-development-validation', 'STR4', 'fixed-milestone'],
    ['tos-ms-str4a', 'tos-stage-development-validation', 'STR4A', 'fixed-milestone'],
    ['tos-ms-str5', 'tos-stage-development-validation', 'STR5', 'fixed-milestone'],
    ['tos-stage-launch-iteration', null, '上市迭代阶段', 'stage'],
    ['tos-stage-maintenance', null, '维护阶段', 'stage'],
  ],
  'tOS templates keep explicit stable IDs, parent links, names, and node kinds',
)
assert.equal(tosTemplateTasks.some(task => ['规划阶段', '规划KO', 'CDCP'].includes(task.taskName)), false, 'tOS V9 templates remove every legacy planning node')
assert.equal(
  tosTemplateTasks.some(task => ['上市迭代阶段', '维护阶段'].includes(task.taskName)
    && tosTemplateTasks.some(child => child.parentId === task.id)),
  false,
  'tOS business stages start empty',
)
assert.deepEqual(rules.buildStandardLevel1Tasks(true), machineTemplateTasks, 'the standard builder remains a whole-machine compatibility alias')

const machineUndatedTemplate = rules.buildLevel1TasksForProjectType('整机产品项目', false)
const tosUndatedTemplate = rules.buildLevel1TasksForProjectType('tOS版本项目', false)
assert.equal(machineUndatedTemplate.every(task => !task.planStartDate && !task.planEndDate && !task.actualStartDate && !task.actualEndDate), true, 'machine configuration templates contain no mock dates')
assert.equal(tosUndatedTemplate.every(task => !task.planStartDate && !task.planEndDate && !task.actualStartDate && !task.actualEndDate), true, 'tOS configuration templates contain no mock dates')
const capabilityTemplateTasks = rules.buildLevel1TasksForProjectType('能力建设项目', false)
assert.deepEqual(
  capabilityTemplateTasks.filter(task => !task.parentId).map(task => task.taskName),
  ['概念阶段', '计划阶段', '开发阶段', '验证阶段', '上市阶段', '生命周期阶段'],
  'capability projects retain their existing six-stage structure',
)
assert.notDeepEqual(describeTemplate(capabilityTemplateTasks), describeTemplate(machineUndatedTemplate), 'capability projects never fall through to the machine five-stage template')
const capabilityDatedTasks = rules.buildLevel1TasksForProjectType('能力建设项目', true)
assert.equal(
  capabilityDatedTasks.filter(task => task.parentId).every(task => task.planEndDate && task.actualEndDate),
  true,
  'capability project mocks retain the completion dates from their existing six-stage behavior',
)

const machineProjectMock = projectMocks.buildProjectListMockPlanTasks('1', machineUndatedTemplate, {
  projectType: '整机产品项目',
  projectName: 'X6877-D8400_H991',
})
const machineBusinessMocks = machineProjectMock.filter(task => task.nodeKind === 'business-period')
assert.deepEqual(machineBusinessMocks.map(task => task.taskName), ['MR1', 'MR2'], 'machine project mocks add one launch and one lifecycle business period')
assert.equal(machineBusinessMocks.every(task => task.source === 'custom' && task.stableId?.includes('mock-1-business-')), true, 'machine business mocks use stable project-scoped custom identities')
assert.equal(machineBusinessMocks[0].planEndDate < machineBusinessMocks[1].planStartDate, true, 'machine planned business periods never overlap')
assert.equal(machineBusinessMocks[0].actualEndDate < machineBusinessMocks[1].actualStartDate, true, 'machine actual business periods never overlap')
const offsetMachineMock = projectMocks.buildProjectListMockPlanTasks('3', machineUndatedTemplate, {
  projectType: '整机产品项目',
  projectName: 'X6855_H8917',
})
const offsetMachineStr5 = offsetMachineMock.find(task => task.taskName === 'STR5')
const offsetMachineMr1 = offsetMachineMock.find(task => task.taskName === 'MR1')
assert.equal(offsetMachineStr5.planEndDate < offsetMachineMr1.planStartDate, true, 'project offsets never make STR5 overlap the first planned machine business period')
assert.equal(offsetMachineStr5.actualEndDate < offsetMachineMr1.actualStartDate, true, 'project offsets never make STR5 overlap the first actual machine business period')

const tosProjectMock = projectMocks.buildProjectListMockPlanTasks('19', tosUndatedTemplate, {
  projectType: 'tOS版本项目',
  projectName: 'tOS16.3',
})
const tosBusinessMocks = tosProjectMock.filter(task => task.nodeKind === 'business-period')
assert.deepEqual(tosBusinessMocks.map(task => task.taskName), ['16.3.0.110', '16.3.0.115'], 'tOS project mocks derive both business versions from the real project name')
assert.equal(tosBusinessMocks.every(task => task.actualStartDate && task.actualEndDate), true, 'tOS project-list business mocks carry both actual boundaries into project-space initialization')
assert.equal(tosBusinessMocks[0].planEndDate < tosBusinessMocks[1].planStartDate, true, 'tOS planned business periods never overlap')
assert.equal(tosBusinessMocks[0].actualEndDate < tosBusinessMocks[1].actualStartDate, true, 'tOS actual business periods never overlap')
const tosProjectMockAgain = projectMocks.buildProjectListMockPlanTasks('19', tosProjectMock, {
  projectType: 'tOS版本项目',
  projectName: 'tOS16.3',
})
assert.deepEqual(
  tosProjectMockAgain.filter(task => task.nodeKind === 'business-period').map(task => task.stableId),
  tosBusinessMocks.map(task => task.stableId),
  'rebuilding a project mock never duplicates its business rows or changes their stable identities',
)
assert.deepEqual(
  tosProjectMockAgain.filter(task => task.nodeKind === 'business-period'),
  tosBusinessMocks,
  'rebuilding a project mock preserves every existing business-period field',
)

assert.deepEqual(
  rules.parseTosProjectVersionPrefix('tOS17.0项目'),
  { major: '17', minor: '0', prefix: '17.0.0' },
  'tOS project names expose a normalized three-part business-version prefix',
)
assert.deepEqual(
  rules.parseTosProjectVersionPrefix('tOS16.3'),
  { major: '16', minor: '3', prefix: '16.3.0' },
  'tOS project names do not require a project-name suffix',
)
assert.equal(rules.parseTosProjectVersionPrefix('无版本项目'), null, 'project names without a tOS version do not produce a prefix')

assert.deepEqual(
  rules.validateTosBusinessVersionName('无版本项目', '16.3.0.125'),
  { valid: false, message: '无法从项目名称解析 tOS 版本前缀' },
  'tOS business names explain when the project prefix cannot be parsed',
)
assert.deepEqual(
  rules.validateTosBusinessVersionName('tOS16.3', '16.3.0.125'),
  { valid: true, message: '' },
  'tOS business names accept the project prefix and a three-digit suffix ending in 0 or 5',
)
for (const invalidName of ['16.3.0.126', '16.4.0.125', '16.3.0.25', '16.3.0.1125']) {
  assert.deepEqual(
    rules.validateTosBusinessVersionName('tOS16.3', invalidName),
    { valid: false, message: '版本号必须符合 16.3.0.XXX，且尾号最后一位为0或5' },
    `tOS business name ${invalidName} is rejected by the exact prefix and suffix rule`,
  )
}

const machineBusinessInput = rules.buildMachineLevel1Tasks(false)
const machineBusinessSnapshot = structuredClone(machineBusinessInput)
assert.equal(typeof rules.renameLevel1BusinessNode, 'function', 'business-node rename is exposed as an executable governance helper')
const machineInsert = rules.insertLevel1BusinessNode(machineBusinessInput, {
  projectType: '整机产品项目',
  parentStableId: 'machine-stage-launch',
  taskName: 'MR1',
  now: 1,
})
assert.equal(machineInsert.ok, true, 'whole-machine business periods can be inserted under the launch stage')
assert.equal(machineInsert.task.nodeKind, 'business-period')
assert.deepEqual(
  {
    source: machineInsert.task.source,
    planStartDate: machineInsert.task.planStartDate,
    planEndDate: machineInsert.task.planEndDate,
    estimatedDays: machineInsert.task.estimatedDays,
    actualStartDate: machineInsert.task.actualStartDate,
    actualEndDate: machineInsert.task.actualEndDate,
    actualDays: machineInsert.task.actualDays,
  },
  {
    source: 'custom',
    planStartDate: '',
    planEndDate: '',
    estimatedDays: null,
    actualStartDate: '',
    actualEndDate: '',
    actualDays: null,
  },
  'new business periods start with four empty dates and two empty durations',
)
assert.equal(machineInsert.parent.stableId, 'machine-stage-launch')
assert.equal(machineInsert.task.parentId, machineInsert.parent.id, 'the inserted node follows its renumbered parent display ID')
assert.deepEqual(machineBusinessInput, machineBusinessSnapshot, 'business insertion does not mutate the input task array')
for (const original of machineBusinessSnapshot) {
  assert.equal(
    machineInsert.tasks.find(task => task.stableId === original.stableId)?.stableId,
    original.stableId,
    `business insertion preserves fixed stable ID ${original.stableId}`,
  )
}

const collidingInsert = rules.insertLevel1BusinessNode(machineInsert.tasks, {
  projectType: '整机产品项目',
  parentStableId: 'machine-stage-lifecycle',
  taskName: 'MR2',
  now: 1,
})
assert.equal(collidingInsert.ok, true, 'whole-machine business periods can also be inserted under lifecycle')
assert.equal(
  collidingInsert.task.stableId,
  `${machineInsert.task.stableId}-2`,
  'stable-ID collisions use deterministic numeric suffixes',
)

const machineSecondInsert = rules.insertLevel1BusinessNode(machineInsert.tasks, {
  projectType: '整机产品项目',
  parentStableId: 'machine-stage-launch',
  taskName: 'MR2',
  now: 20,
})
assert.equal(machineSecondInsert.ok, true)
const renameInputSnapshot = structuredClone(machineSecondInsert.tasks)
const renamedMachineNode = rules.renameLevel1BusinessNode(machineSecondInsert.tasks, {
  projectType: '整机产品项目',
  taskStableId: machineSecondInsert.task.stableId,
  taskName: 'MR20',
})
assert.equal(renamedMachineNode.ok, true, 'a custom machine business period accepts a valid MR name')
assert.equal(
  renamedMachineNode.tasks.find(task => task.stableId === machineSecondInsert.task.stableId)?.taskName,
  'MR20',
  'business-node rename updates only the requested stable task',
)
assert.deepEqual(machineSecondInsert.tasks, renameInputSnapshot, 'successful business-node rename is immutable')

for (const invalidName of ['mr20', 'MR 20', 'MR', '版本20']) {
  const snapshot = structuredClone(machineSecondInsert.tasks)
  const result = rules.renameLevel1BusinessNode(machineSecondInsert.tasks, {
    projectType: '整机产品项目',
    taskStableId: machineSecondInsert.task.stableId,
    taskName: invalidName,
  })
  assert.deepEqual({ ok: result.ok, code: result.code }, { ok: false, code: 'invalid-name' }, `rename rejects invalid MR name ${invalidName}`)
  assert.deepEqual(machineSecondInsert.tasks, snapshot, 'failed MR rename leaves the input untouched')
}

const duplicateMachineRename = rules.renameLevel1BusinessNode(machineSecondInsert.tasks, {
  projectType: '整机产品项目',
  taskStableId: machineSecondInsert.task.stableId,
  taskName: 'MR1',
})
assert.deepEqual(
  { ok: duplicateMachineRename.ok, code: duplicateMachineRename.code },
  { ok: false, code: 'duplicate-name' },
  'rename rejects a duplicate name within the same business stage',
)
const sameNameAcrossMachineStages = rules.renameLevel1BusinessNode(collidingInsert.tasks, {
  projectType: '整机产品项目',
  taskStableId: collidingInsert.task.stableId,
  taskName: 'MR1',
})
assert.equal(sameNameAcrossMachineStages.ok, true, 'rename duplicate validation is scoped to siblings in the same stage')

for (const invalidMrName of ['MR0', 'MR01']) {
  const result = rules.insertLevel1BusinessNode(machineBusinessInput, {
    projectType: '整机产品项目',
    parentStableId: 'machine-stage-launch',
    taskName: invalidMrName,
    now: 2,
  })
  assert.deepEqual(
    { ok: result.ok, code: result.code, message: result.message },
    { ok: false, code: 'invalid-name', message: '格式：MR+正整数，不允许前导0；示例：MR1、MR2。' },
    `whole-machine name ${invalidMrName} rejects zero and leading-zero MR numbers`,
  )
}

for (const invalidMrName of ['mr1', 'MR 1', 'MR', '里程碑1']) {
  const result = rules.insertLevel1BusinessNode(machineBusinessInput, {
    projectType: '整机产品项目',
    parentStableId: 'machine-stage-launch',
    taskName: invalidMrName,
    now: 2,
  })
  assert.equal(result.ok, false, `whole-machine alias ${invalidMrName} is rejected`)
  assert.equal(result.code, 'invalid-name')
  assert.match(result.message, /MR/)
}

const tosBusinessInput = rules.buildTosLevel1Tasks(false)
const tosInsert = rules.insertLevel1BusinessNode(tosBusinessInput, {
  projectType: 'tOS版本项目',
  projectName: 'tOS17.0项目',
  parentStableId: 'tos-stage-maintenance',
  taskName: '17.0.0.115',
  now: 2,
})
assert.equal(tosInsert.ok, true, 'tOS business versions can be inserted under maintenance')
assert.equal(tosInsert.parent.stableId, 'tos-stage-maintenance')
assert.equal(tosInsert.task.nodeKind, 'business-period')

const renamedTosNode = rules.renameLevel1BusinessNode(tosInsert.tasks, {
  projectType: 'tOS版本项目',
  projectName: 'tOS17.0项目',
  taskStableId: tosInsert.task.stableId,
  taskName: '17.0.0.120',
})
assert.equal(renamedTosNode.ok, true, 'tOS rename accepts the project prefix and a suffix ending in 0')
for (const invalidName of ['17.0.0.121', '17.1.0.120', '17.0.0.20']) {
  const result = rules.renameLevel1BusinessNode(tosInsert.tasks, {
    projectType: 'tOS版本项目',
    projectName: 'tOS17.0项目',
    taskStableId: tosInsert.task.stableId,
    taskName: invalidName,
  })
  assert.deepEqual({ ok: result.ok, code: result.code }, { ok: false, code: 'invalid-name' }, `tOS rename rejects ${invalidName}`)
}

const renameRejectedCases = [
  {
    label: 'template source',
    tasks: machineSecondInsert.tasks.map(task => task.stableId === machineSecondInsert.task.stableId ? { ...task, source: 'template' } : task),
    code: 'task-not-custom-business',
  },
  {
    label: 'non-business kind',
    tasks: machineSecondInsert.tasks.map(task => task.stableId === machineSecondInsert.task.stableId ? { ...task, nodeKind: 'fixed-milestone' } : task),
    code: 'task-not-custom-business',
  },
  {
    label: 'dangling parent',
    tasks: machineSecondInsert.tasks.map(task => task.stableId === machineSecondInsert.task.stableId ? { ...task, parentId: 'missing-parent' } : task),
    code: 'parent-missing',
  },
  {
    label: 'non-stage parent',
    tasks: machineSecondInsert.tasks.map(task => task.stableId === 'machine-stage-launch'
      ? { ...task, parentId: '1', nodeKind: 'fixed-milestone' }
      : task),
    code: 'parent-not-stage',
  },
]
for (const testCase of renameRejectedCases) {
  const snapshot = structuredClone(testCase.tasks)
  const result = rules.renameLevel1BusinessNode(testCase.tasks, {
    projectType: '整机产品项目',
    taskStableId: machineSecondInsert.task.stableId,
    taskName: 'MR20',
  })
  assert.deepEqual({ ok: result.ok, code: result.code }, { ok: false, code: testCase.code }, `rename rejects ${testCase.label}`)
  assert.deepEqual(testCase.tasks, snapshot, `rename rejection for ${testCase.label} is immutable`)
}

const invalidTosNameInsert = rules.insertLevel1BusinessNode(tosBusinessInput, {
  projectType: 'tOS版本项目',
  projectName: 'tOS17.0项目',
  parentStableId: 'tos-stage-maintenance',
  taskName: '17.0.0.116',
  now: 3,
})
assert.deepEqual(
  invalidTosNameInsert,
  { ok: false, code: 'invalid-name', message: '版本号必须符合 17.0.0.XXX，且尾号最后一位为0或5' },
  'tOS insertion rejects a suffix whose last digit is not 0 or 5',
)

const unparsedTosProjectInsert = rules.insertLevel1BusinessNode(tosBusinessInput, {
  projectType: 'tOS版本项目',
  projectName: '无版本项目',
  parentStableId: 'tos-stage-maintenance',
  taskName: '17.0.0.115',
  now: 3,
})
assert.deepEqual(
  unparsedTosProjectInsert,
  { ok: false, code: 'invalid-name', message: '无法从项目名称解析 tOS 版本前缀' },
  'tOS insertion rejects a project name without a parseable version prefix',
)

const duplicateTosInsert = rules.insertLevel1BusinessNode(tosInsert.tasks, {
  projectType: 'tOS版本项目',
  projectName: 'tOS17.0项目',
  parentStableId: 'tos-stage-maintenance',
  taskName: '17.0.0.115',
  now: 3,
})
assert.deepEqual(
  { ok: duplicateTosInsert.ok, code: duplicateTosInsert.code },
  { ok: false, code: 'duplicate-name' },
  'duplicate business names are rejected within the same parent',
)

const sameNameOtherTosStage = rules.insertLevel1BusinessNode(tosInsert.tasks, {
  projectType: 'tOS版本项目',
  projectName: 'tOS17.0项目',
  parentStableId: 'tos-stage-launch-iteration',
  taskName: '17.0.0.115',
  now: 4,
})
assert.deepEqual(
  { ok: sameNameOtherTosStage.ok, code: sameNameOtherTosStage.code },
  { ok: false, code: 'duplicate-name' },
  'business names remain globally unique across different business parents',
)

const missingParentInsert = rules.insertLevel1BusinessNode(machineBusinessInput, {
  projectType: '整机产品项目',
  parentStableId: 'machine-stage-missing',
  taskName: 'MR1',
  now: 5,
})
assert.deepEqual(
  { ok: missingParentInsert.ok, code: missingParentInsert.code },
  { ok: false, code: 'parent-missing' },
  'business insertion reports a missing stable parent',
)

const nonBusinessParentInsert = rules.insertLevel1BusinessNode(machineBusinessInput, {
  projectType: '整机产品项目',
  parentStableId: 'machine-stage-development',
  taskName: 'MR1',
  now: 6,
})
assert.deepEqual(
  { ok: nonBusinessParentInsert.ok, code: nonBusinessParentInsert.code },
  { ok: false, code: 'parent-not-business-stage' },
  'business insertion rejects a fixed template stage',
)

const legacyStageInput = [
  ...machineBusinessInput,
  { ...machineBusinessInput[0], id: 'legacy-launch', stableId: 'stage-launch', taskName: '上市阶段' },
]
const legacyParentInsert = rules.insertLevel1BusinessNode(legacyStageInput, {
  projectType: '整机产品项目',
  parentStableId: 'stage-launch',
  taskName: 'MR1',
  now: 7,
})
assert.deepEqual(
  { ok: legacyParentInsert.ok, code: legacyParentInsert.code },
  { ok: false, code: 'parent-not-business-stage' },
  'legacy stage-launch aliases are not business stages in the refreshed template',
)

const displayOnlyRenumberInput = [
  {
    id: 'other-root-old',
    parentId: undefined,
    order: 1,
    taskName: '其它阶段',
    nodeKind: 'stage',
    planStartDate: undefined,
    planEndDate: null,
    estimatedDays: undefined,
    actualStartDate: null,
    actualEndDate: undefined,
    actualDays: null,
  },
  {
    id: 'launch-old',
    stableId: 'machine-stage-launch',
    parentId: null,
    order: 9,
    taskName: '上市阶段',
    source: null,
    nodeKind: 'stage',
    planEndDate: undefined,
    estimatedDays: null,
    actualEndDate: null,
    actualDays: undefined,
  },
  {
    id: 'existing-period-old',
    stableId: 'existing-period-stable',
    parentId: 'launch-old',
    order: 7,
    taskName: 'MR9',
    source: undefined,
    nodeKind: 'business-period',
    planStartDate: null,
    planEndDate: undefined,
    estimatedDays: null,
    actualStartDate: undefined,
    actualEndDate: null,
    actualDays: undefined,
  },
]
const displayOnlyRenumberSnapshot = structuredClone(displayOnlyRenumberInput)
const displayOnlyRenumberInsert = rules.insertLevel1BusinessNode(displayOnlyRenumberInput, {
  projectType: '整机产品项目',
  parentStableId: 'machine-stage-launch',
  taskName: 'MR10',
  now: 10,
})
assert.equal(displayOnlyRenumberInsert.ok, true)
assert.deepEqual(displayOnlyRenumberInput, displayOnlyRenumberSnapshot, 'display-only renumbering leaves the source inputs untouched')
assert.deepEqual(
  displayOnlyRenumberInsert.tasks.filter(task => task.stableId !== displayOnlyRenumberInsert.task.stableId),
  [
    {
      id: '1',
      parentId: undefined,
      order: 1,
      taskName: '其它阶段',
      nodeKind: 'stage',
      planStartDate: undefined,
      planEndDate: null,
      estimatedDays: undefined,
      actualStartDate: null,
      actualEndDate: undefined,
      actualDays: null,
    },
    {
      id: '2',
      stableId: 'machine-stage-launch',
      parentId: null,
      order: 2,
      taskName: '上市阶段',
      source: null,
      nodeKind: 'stage',
      planEndDate: undefined,
      estimatedDays: null,
      actualEndDate: null,
      actualDays: undefined,
    },
    {
      id: '2.1',
      stableId: 'existing-period-stable',
      parentId: '2',
      order: 1,
      taskName: 'MR9',
      source: undefined,
      nodeKind: 'business-period',
      planStartDate: null,
      planEndDate: undefined,
      estimatedDays: null,
      actualStartDate: undefined,
      actualEndDate: null,
      actualDays: undefined,
    },
  ],
  'existing tasks preserve every non-display field and its missing, undefined, or null representation',
)

const denyAllStructure = { canAddStage: false, canAddChild: false, canRename: false, canDelete: false, canReorder: false }
const adminBusinessStructure = { canAddStage: false, canAddChild: true, canRename: true, canDelete: true, canReorder: true }
const adminNonBusinessStructure = { canAddStage: false, canAddChild: true, canRename: false, canDelete: true, canReorder: false }
const customAdminStage = {
  ...machineInsert.parent,
  stableId: 'custom-admin-stage',
  source: 'custom',
  nodeKind: 'stage',
}
const nonBusinessParent = machineBusinessInput.find(task => task.stableId === 'machine-stage-concept')
const customAdminOrdinaryChild = {
  ...machineInsert.task,
  id: '1.99',
  stableId: 'custom-admin-ordinary-child',
  parentId: nonBusinessParent.id,
  source: 'custom',
  nodeKind: 'business-period',
}
for (const [label, task, parent] of [
  ['custom stage', customAdminStage, undefined],
  ['custom business-period under a non-business stage', customAdminOrdinaryChild, nonBusinessParent],
]) {
  assert.deepEqual(
    rules.getLevel1StructurePermissions({
      projectType: '整机产品项目',
      isDraft: true,
      isSuperAdmin: true,
      isSpm: false,
      task,
      parent,
    }),
    adminNonBusinessStructure,
    `super administrators cannot add stages and do not receive business rename/reorder actions for a ${label}`,
  )
  const helperFixture = [...machineInsert.tasks, task]
  const helperSnapshot = structuredClone(helperFixture)
  const renameResult = rules.renameLevel1BusinessNode(helperFixture, {
    projectType: '整机产品项目',
    taskStableId: task.stableId,
    taskName: 'MR99',
  })
  assert.deepEqual(
    { ok: renameResult.ok, code: renameResult.code },
    label === 'custom stage'
      ? { ok: false, code: 'task-not-custom-business' }
      : { ok: false, code: 'parent-not-business-stage' },
    `rename handler rejects a ${label}`,
  )
  const reorderResult = rules.reorderLevel1BusinessNodes(helperFixture, task.stableId, task.stableId, '整机产品项目')
  assert.equal(reorderResult.ok, false, `reorder handler rejects a ${label}`)
  assert.deepEqual(helperFixture, helperSnapshot, `rejected ${label} business actions do not mutate handler input`)
}
assert.deepEqual(
  rules.getLevel1StructurePermissions({
    projectType: '整机产品项目',
    isDraft: true,
    isSuperAdmin: true,
    isSpm: false,
    task: machineInsert.task,
    parent: machineInsert.parent,
  }),
  adminBusinessStructure,
  'super administrators retain child/business actions but cannot add a level-one stage',
)
assert.deepEqual(
  rules.getLevel1StructurePermissions({
    projectType: '整机产品项目',
    isDraft: false,
    isSuperAdmin: true,
    isSpm: true,
    task: machineInsert.task,
    parent: machineInsert.parent,
  }),
  denyAllStructure,
  'published plans deny every structure mutation, including super administrators',
)
assert.deepEqual(
  rules.getLevel1StructurePermissions({
    projectType: '整机产品项目',
    isDraft: true,
    isSuperAdmin: true,
    isSpm: false,
    task: machineBusinessInput[0],
  }),
  adminNonBusinessStructure,
  'super administrators retain child/delete actions without stage-add or unsupported stage rename/reorder actions',
)
assert.deepEqual(
  rules.getLevel1StructurePermissions({
    projectType: '技术项目',
    isDraft: true,
    isSuperAdmin: true,
    isSpm: true,
    task: machineBusinessInput[0],
  }),
  denyAllStructure,
  'technical projects never enter the machine/tOS structure-permission path for super administrators',
)
assert.deepEqual(
  rules.getLevel1StructurePermissions({
    projectType: '技术项目',
    isDraft: true,
    isSuperAdmin: false,
    isSpm: true,
    task: machineInsert.task,
    parent: machineInsert.parent,
  }),
  denyAllStructure,
  'technical projects never enter the machine/tOS structure-permission path for SPMs',
)
assert.deepEqual(
  rules.getLevel1StructurePermissions({
    projectType: '整机产品项目',
    isDraft: true,
    isSuperAdmin: false,
    isSpm: false,
    task: machineInsert.task,
    parent: machineInsert.parent,
  }),
  denyAllStructure,
  'draft structure mutations remain unavailable to non-SPM users',
)
assert.deepEqual(
  rules.getLevel1StructurePermissions({
    projectType: '整机产品项目',
    isDraft: true,
    isSuperAdmin: false,
    isSpm: true,
    task: machineInsert.task,
    parent: machineInsert.parent,
  }),
  { canAddStage: false, canAddChild: true, canRename: true, canDelete: true, canReorder: true },
  'SPMs can add, rename, delete, and reorder dynamic nodes only within machine business stages',
)

const fixedBusinessChild = {
  ...machineInsert.task,
  stableId: 'machine-fixed-business-child',
  source: 'template',
  nodeKind: 'fixed-milestone',
}
assert.deepEqual(
  rules.getLevel1StructurePermissions({
    projectType: '整机产品项目',
    isDraft: true,
    isSuperAdmin: false,
    isSpm: true,
    task: fixedBusinessChild,
    parent: machineInsert.parent,
  }),
  { canAddStage: false, canAddChild: true, canRename: false, canDelete: false, canReorder: false },
  'SPMs cannot rename, delete, or reorder a fixed node even when its parent is a business stage',
)
const templateBusinessPeriod = {
  ...machineInsert.task,
  stableId: 'machine-template-business-period',
  source: 'template',
  nodeKind: 'business-period',
}
assert.deepEqual(
  rules.getLevel1StructurePermissions({
    projectType: '整机产品项目',
    isDraft: true,
    isSuperAdmin: false,
    isSpm: true,
    task: templateBusinessPeriod,
    parent: machineInsert.parent,
  }),
  { canAddStage: false, canAddChild: true, canRename: false, canDelete: false, canReorder: false },
  'SPMs cannot rename, delete, or reorder a template business-period under an allowed business stage',
)
assert.deepEqual(
  rules.getLevel1StructurePermissions({
    projectType: '整机产品项目',
    isDraft: true,
    isSuperAdmin: true,
    isSpm: false,
    task: templateBusinessPeriod,
    parent: machineInsert.parent,
  }),
  adminNonBusinessStructure,
  'global super administrators retain child/delete but not stage-add or unsupported template business rename/reorder actions',
)
assert.equal(typeof rules.deleteLevel1GovernedTask, 'function', 'governed deletion is exposed as an executable permission-checked handler helper')
const templateBusinessTasks = [...machineInsert.tasks, { ...templateBusinessPeriod, id: '4.2', parentId: machineInsert.parent.id, order: 2 }]
const templateBusinessTasksSnapshot = structuredClone(templateBusinessTasks)
const deniedTemplateBusinessDelete = rules.deleteLevel1GovernedTask(templateBusinessTasks, {
  projectType: '整机产品项目',
  isDraft: true,
  isSuperAdmin: false,
  isSpm: true,
  taskStableId: templateBusinessPeriod.stableId,
})
assert.deepEqual(
  { ok: deniedTemplateBusinessDelete.ok, message: deniedTemplateBusinessDelete.message },
  { ok: false, message: '没有权限删除该节点' },
  'the deletion handler rejects an SPM deleting a template business-period',
)
assert.deepEqual(templateBusinessTasks, templateBusinessTasksSnapshot, 'a denied deletion handler does not mutate or produce a writable task change')
const allowedAdminTemplateBusinessDelete = rules.deleteLevel1GovernedTask(templateBusinessTasks, {
  projectType: '整机产品项目',
  isDraft: true,
  isSuperAdmin: true,
  isSpm: false,
  taskStableId: templateBusinessPeriod.stableId,
})
assert.equal(allowedAdminTemplateBusinessDelete.ok, true, 'global super administrators retain template-node deletion')
assert.equal(allowedAdminTemplateBusinessDelete.tasks.some(task => task.stableId === templateBusinessPeriod.stableId), false, 'an authorized deletion removes the requested stable node')
assert.deepEqual(
  rules.getLevel1StructurePermissions({
    projectType: '整机产品项目',
    isDraft: true,
    isSuperAdmin: false,
    isSpm: true,
    task: machineInsert.parent,
  }),
  denyAllStructure,
  'SPMs cannot delete, reorder, or add roots through a fixed business-stage row',
)
assert.deepEqual(
  rules.getLevel1StructurePermissions({
    projectType: 'tOS版本项目',
    isDraft: true,
    isSuperAdmin: false,
    isSpm: true,
    task: tosInsert.task,
    parent: tosInsert.parent,
  }),
  { canAddStage: false, canAddChild: true, canRename: true, canDelete: true, canReorder: true },
  'SPMs receive the same governed permissions under a tOS maintenance stage',
)
assert.deepEqual(
  rules.getLevel1StructurePermissions({
    projectType: '整机产品项目',
    isDraft: true,
    isSuperAdmin: false,
    isSpm: true,
    task: { ...machineInsert.task, parentId: 'legacy-launch' },
    parent: legacyStageInput.at(-1),
  }),
  denyAllStructure,
  'legacy stage aliases do not grant refreshed SPM structure permissions',
)

const makeTask = (id, parentId, order, taskName, planEndDate = '', actualEndDate = '') => ({
  id,
  stableId: id,
  parentId,
  order,
  taskName,
  role: parentId ? 'SPM' : '',
  source: 'template',
  planEndDate,
  actualEndDate,
})

const technicalTdtProjection = rules.projectLevel1Plan([
  makeTask('tdt-stage', null, 0, '开发验证阶段'),
  {
    ...makeTask('tdt-a', 'tdt-stage', 0, 'TDR1', '2026-01-10', '2026-01-11'),
    planStartDate: '2026-01-02', actualStartDate: '2026-01-03', estimatedDays: 8, actualDays: 8,
  },
  {
    ...makeTask('tdt-b', 'tdt-stage', 1, 'TDR2', '2026-01-20', '2026-01-21'),
    planStartDate: '2026-01-12', actualStartDate: '2026-01-13', estimatedDays: 8, actualDays: 8,
  },
], { mode: 'standard', today: '2026-01-22' })
const technicalTdtStage = technicalTdtProjection.rows.find(row => row.id === 'tdt-stage')
assert.deepEqual(
  [technicalTdtStage.planStartDate, technicalTdtStage.planEndDate, technicalTdtStage.estimatedDays],
  ['2026-01-10', '2026-01-20', 10],
  'legacy TDT stages keep completion-point planned aggregation with exclusive duration',
)
assert.deepEqual(
  [technicalTdtStage.actualStartDate, technicalTdtStage.actualEndDate, technicalTdtStage.actualDays],
  ['2026-01-11', '2026-01-21', 10],
  'legacy TDT stages keep completion-point actual aggregation with exclusive duration',
)
assert.deepEqual(
  technicalTdtProjection.rows.filter(row => row.parentId).map(row => [row.planStartDate, row.estimatedDays, row.actualStartDate, row.actualDays, row.isMilestone]),
  [['', null, '', null, true], ['', null, '', null, true]],
  'legacy TDT children remain completion points even when their source contains start dates and stored durations',
)

const tasks = [
  makeTask('p1', null, 0, '空阶段'),
  makeTask('p1c1', 'p1', 0, '空节点'),
  makeTask('p2', null, 1, '计划阶段'),
  makeTask('p2c1', 'p2', 0, 'STR2', '2026-03-18', '2026-03-19'),
  makeTask('p2c2', 'p2', 1, 'STR3', '2026-05-22', '2026-05-22'),
  makeTask('p3', null, 2, '开发验证阶段'),
  makeTask('p3c1', 'p3', 0, 'STR4', '2026-07-31', '2026-08-01'),
  makeTask('p3c2', 'p3', 1, 'STR4A', '2026-10-12', '2026-10-12'),
  makeTask('p3c3', 'p3', 2, 'STR5', '2026-12-15', '2026-12-16'),
]

const projection = rules.projectLevel1Plan(tasks, { mode: 'standard', today: '2026-08-18' })
const emptyStage = projection.rows.find(row => row.id === 'p1')
const planStage = projection.rows.find(row => row.id === 'p2')
const devStage = projection.rows.find(row => row.id === 'p3')
const str2 = projection.rows.find(row => row.id === 'p2c1')

assert.deepEqual(
  [emptyStage.planStartDate, emptyStage.planEndDate, emptyStage.estimatedDays],
  ['', '', null],
  'an empty first stage remains empty',
)
assert.deepEqual(
  [planStage.planStartDate, planStage.planEndDate, planStage.estimatedDays],
  ['2026-03-18', '2026-05-22', 65],
  'the first effective stage starts at its first populated milestone',
)
assert.deepEqual(
  [devStage.planStartDate, devStage.planEndDate, devStage.estimatedDays],
  ['2026-05-23', '2026-12-15', 206],
  'later effective stages begin one day after the previous effective stage',
)
assert.deepEqual(
  [planStage.actualStartDate, planStage.actualEndDate, planStage.actualDays],
  ['2026-03-19', '2026-05-22', 64],
)
assert.equal(str2.planStartDate, '')
assert.equal(str2.actualStartDate, '')
assert.equal(str2.estimatedDays, null)
assert.equal(str2.actualDays, null)
assert.equal(str2.delayStatus, '延期')
assert.equal(projection.rows.find(row => row.id === 'p3c1').delayStatus, '延期')
assert.deepEqual(
  projection.rows.filter(row => !row.parentId).map(row => row.manpowerPercent),
  [null, 24, 76],
  'manpower percentages use the sum of effective stage estimated durations',
)
assert.equal(
  rules.sumLevel1EstimatedDays(projection.rows),
  271,
  'horizontal development cycle sums every populated stage estimated duration',
)
assert.equal(
  rules.sumLevel1EstimatedDays(projection.rows.map(row => ({ ...row, estimatedDays: null }))),
  null,
  'horizontal development cycle stays empty when no estimated duration exists',
)
const exportCycleCounterexample = [
  { estimatedDays: 136, planStartDate: '2026-01-01', planEndDate: '2026-05-17' },
  { estimatedDays: 136, planStartDate: '2026-05-18', planEndDate: '2026-09-29' },
]
assert.equal(rules.sumLevel1EstimatedDays(exportCycleCounterexample), 272, 'horizontal export reuses the page duration sum for the 272-day counterexample')
assert.equal(
  Math.ceil((new Date('2026-09-29').getTime() - new Date('2026-01-01').getTime()) / 86_400_000),
  271,
  'the removed min/max calendar-span algorithm would incorrectly export 271 for the same rows',
)

const invalid = rules.validateLevel1MilestoneDates([
  makeTask('p1', null, 0, '阶段1'),
  makeTask('a', 'p1', 0, 'A', '2026-01-02', '2026-01-04'),
  makeTask('b', 'p1', 1, 'B', '2026-01-02', '2026-01-03'),
  makeTask('p2', null, 1, '阶段2'),
  makeTask('c', 'p2', 0, 'C', '2026-01-01', '2026-01-03'),
])
assert.equal(invalid.valid, false)
assert.equal(invalid.byTaskId.b.planEndDate[0], '下一个子节点日期不允许超上一个子节点。')
assert.equal(invalid.byTaskId.b.actualEndDate[0], '下一个子节点日期不允许超上一个子节点。')
assert.equal(invalid.byTaskId.c.planEndDate[0], '下一个子节点日期不允许超上一个子节点。')

const subproject = rules.projectLevel1Plan([
  makeTask('s1', null, 0, '子项目里程碑1', '2026-01-10', '2026-01-11'),
  makeTask('s2', null, 1, '子项目里程碑2', '2026-01-20', ''),
], { mode: 'technical-subproject', today: '2026-01-15' })
assert.deepEqual(subproject.rows.map(row => ({ start: row.planStartDate, days: row.estimatedDays, delay: row.delayStatus })), [
  { start: '', days: null, delay: '延期' },
  { start: '', days: null, delay: '按时' },
])
assert.deepEqual(subproject.stageGroups, [])

assert.equal(rules.canMaintainLevel1Plan({ projectType: '整机产品项目', currentUser: '李白', spmUsers: ['李白'], technicalLead: '', globalAdmins: [] }), true)
assert.equal(rules.canMaintainLevel1Plan({ projectType: '技术项目', currentUser: '王五', spmUsers: ['王五'], technicalLead: '张三', globalAdmins: [] }), false)
assert.equal(rules.canMaintainLevel1Plan({ projectType: '技术项目', currentUser: '张三', spmUsers: [], technicalLead: '张三', globalAdmins: [] }), true)
assert.equal(rules.canMaintainLevel1Plan({ projectType: '能力建设项目', currentUser: '管理员', spmUsers: [], technicalLead: '', globalAdmins: ['管理员'] }), true)

const launchStage = { ...makeTask('4', null, 3, '上市收编阶段'), stableId: 'stage-launch' }
const templateLaunchChild = { ...makeTask('4.1', '4', 0, '收编完成'), stableId: 'milestone-close' }
const customLaunchChild = { ...makeTask('4.2', '4', 1, '项目自定义节点'), stableId: 'custom-launch-1', source: 'custom' }
const customOutsideLaunch = { ...makeTask('3.4', '3', 3, '错误阶段自定义节点'), stableId: 'custom-development-1', source: 'custom' }
assert.equal(rules.canAddLevel1CustomChild('整机产品项目', launchStage), false, 'whole-machine launch stages reserve additions for controlled MR insertion')
assert.equal(rules.canAddLevel1CustomChild('tOS版本项目', launchStage), false, 'non-whole-machine projects cannot add launch children')
assert.equal(rules.canMutateLevel1TaskStructure({ projectType: '整机产品项目', task: templateLaunchChild, parent: launchStage, action: 'delete' }), false, 'template launch children stay locked')
assert.equal(rules.canMutateLevel1TaskStructure({ projectType: '整机产品项目', task: customLaunchChild, parent: launchStage, action: 'delete' }), true, 'custom launch children can be deleted')
assert.equal(rules.canMutateLevel1TaskStructure({ projectType: '整机产品项目', task: customLaunchChild, parent: launchStage, action: 'rename' }), false, 'custom launch children cannot be renamed')
assert.equal(rules.canMutateLevel1TaskStructure({ projectType: '整机产品项目', task: customOutsideLaunch, parent: { ...launchStage, id: '3', stableId: 'stage-development', taskName: '开发验证阶段' }, action: 'reorder' }), false, 'custom children outside launch stay locked')
assert.equal(rules.canMutateLevel1TaskStructure({ projectType: '技术项目', technicalKind: 'tdt', task: { ...customLaunchChild, parentId: undefined }, action: 'rename' }), false, 'TDT structure stays locked')
assert.equal(rules.canMutateLevel1TaskStructure({ projectType: '技术项目', technicalKind: 'subproject', task: { ...customLaunchChild, parentId: undefined }, action: 'rename' }), false, 'technical subproject custom roots cannot be renamed')
assert.equal(rules.canMutateLevel1TaskStructure({ projectType: '技术项目', technicalKind: 'subproject', task: { ...templateLaunchChild, parentId: undefined }, action: 'delete' }), false, 'technical subproject template roots stay locked')

const prior = [
  { ...makeTask('old-root', null, 0, '旧阶段'), stableId: 'machine-stage-concept' },
  { ...makeTask('old-a', 'old-root', 0, '旧名称', '2026-02-20', '2026-02-21'), stableId: 'machine-ms-concept-kickoff' },
  { ...makeTask('custom-a', 'old-root', 1, '项目自定义', '2026-02-25', ''), stableId: 'custom-a', source: 'custom' },
]
const latestTemplate = rules.buildStandardLevel1Tasks(false).slice(0, 3)
const firstRevision = rules.buildFirstLevel1RevisionTasks(prior, latestTemplate)
assert.equal(firstRevision.find(task => task.stableId === 'machine-ms-concept-kickoff').taskName, '概念启动')
assert.equal(firstRevision.find(task => task.stableId === 'machine-ms-concept-kickoff').planEndDate, '2026-02-20')
assert.equal(firstRevision.find(task => task.stableId === 'machine-ms-concept-kickoff').actualEndDate, '2026-02-21')
assert.equal(firstRevision.find(task => task.stableId === 'custom-a').source, 'custom')
assert.equal(firstRevision.some(task => task.stableId === 'machine-ms-str1'), true)

const nextRevision = rules.buildNextLevel1RevisionTasks(firstRevision)
nextRevision[0].taskName = '仅修改副本'
assert.notEqual(firstRevision[0].taskName, nextRevision[0].taskName)

const synced = rules.synchronizeLevel1ActualEndDate(firstRevision, nextRevision, firstRevision[1].id, '2026-03-01')
assert.equal(synced.sourceTasks.find(task => task.stableId === 'machine-ms-concept-kickoff').actualEndDate, '2026-03-01')
assert.equal(synced.pairedTasks.find(task => task.stableId === 'machine-ms-concept-kickoff').actualEndDate, '2026-03-01')
assert.equal(synced.pairedTasks.find(task => task.stableId === 'custom-a').actualEndDate, '')
assert.throws(
  () => rules.buildFirstLevel1RevisionTasks(prior, [...latestTemplate, { ...latestTemplate[0] }]),
  /重复稳定任务ID/,
)

const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8')
const planStoreSource = read('src/stores/plan.ts')
const technicalStoreSource = read('src/stores/technicalPlan.ts')
const configSource = read('src/containers/ConfigContainer.tsx')
const projectListSource = read('src/containers/ProjectListContainer.tsx')
const projectSpaceSource = read('src/containers/ProjectSpaceContainer.tsx')
const technicalModuleSource = read('src/components/technical-project/TechnicalPlanModule.tsx')
const compareModalSource = read('src/components/plans/PlanVersionCompareModal.tsx')
const plan = loadTypeScriptModule(root, 'src/stores/plan.ts')

assert.match(
  projectSpaceSource,
  /shouldAutoEnablePlanEditMode\(\{[\s\S]*?projectSpaceModule,[\s\S]*?isCurrentDraft,[\s\S]*?followedReadOnly:\s*followedTosLevel1ReadOnly[\s\S]*?\}\)/,
  'draft auto-edit effect must include the active project-space module in its decision',
)
assert.match(
  projectSpaceSource,
  /\/\/ Draft auto-edit mode[\s\S]*?useEffect\([\s\S]*?\[[^\]]*projectSpaceModule[^\]]*\]\)/,
  'draft auto-edit effect must rerun when entering the plan module',
)

assert.equal(plan.PLAN_STORE_VERSION, 13, 'plan persistence retires legacy level-three data and backfills the workbench revision scope after the V9 level-one upgrade')
const migratedPartialV11 = plan.migratePlanStoreState({
  versions: structuredClone(plan.VERSION_DATA),
  currentVersion: 'v3',
  publishedSnapshots: {},
  marketPlanData: {},
  marketVersionsByKey: {},
  marketCurrentVersionByKey: {},
  tosTypePlanDataByProjectId: {},
  tosTypeVersionsByKey: {},
  tosTypeCurrentVersionByKey: {},
}, 12)
assert.ok(Array.isArray(migratedPartialV11.tasks) && migratedPartialV11.tasks.length > 0, 'version-only migrations restore non-persisted default L1 tasks instead of overriding the hydrated store with undefined')
assert.deepEqual(plan.MACHINE_LEVEL1_TASKS, rules.buildMachineLevel1Tasks(true), 'plan store exports the dated machine seed')
assert.deepEqual(plan.TOS_LEVEL1_TASKS, rules.buildTosLevel1Tasks(true), 'plan store exports the dated tOS seed')
assert.deepEqual(plan.MACHINE_LEVEL1_TEMPLATE_TASKS, rules.buildMachineLevel1Tasks(false), 'plan store exports the undated machine template')
assert.deepEqual(plan.TOS_LEVEL1_TEMPLATE_TASKS, rules.buildTosLevel1Tasks(false), 'plan store exports the undated tOS template')
const firstDefaultTosTasks = plan.getDefaultLevel1TasksForProjectType('tOS版本项目', false)
const secondDefaultTosTasks = plan.getDefaultLevel1TasksForProjectType('tOS版本项目', false)
assert.notStrictEqual(firstDefaultTosTasks, secondDefaultTosTasks, 'default level-one tasks clone the array on every call')
assert.notStrictEqual(firstDefaultTosTasks[0], secondDefaultTosTasks[0], 'default level-one tasks clone every task on every call')
firstDefaultTosTasks[0].taskName = '仅修改副本'
assert.equal(secondDefaultTosTasks[0].taskName, '概念阶段', 'mutating a returned default never contaminates later callers')

const rootNames = tasks => tasks.filter(task => !task.parentId).map(task => task.taskName)
assert.deepEqual(
  rootNames(plan.getDefaultLevel1TasksForProjectType('整机产品项目', false)),
  ['概念阶段', '计划阶段', '开发验证阶段', '上市阶段', '生命周期阶段'],
  'machine defaults use the approved stages',
)
assert.deepEqual(
  rootNames(plan.getDefaultLevel1TasksForProjectType('tOS版本项目', false)),
  ['概念阶段', '计划阶段', '开发验证阶段', '上市迭代阶段', '维护阶段'],
  'tOS defaults use the approved stages',
)
assert.deepEqual(
  plan.migrateLevel1TasksForProjectType([], 'tOS版本项目', false),
  plan.TOS_LEVEL1_TEMPLATE_TASKS,
  'empty tOS templates migrate to the tOS seed',
)

const buildV8Seed = descriptors => {
  const idByStableId = new Map()
  const childCountByParent = new Map()
  let rootCount = 0
  descriptors.forEach(([stableId, parentStableId]) => {
    if (!parentStableId) {
      idByStableId.set(stableId, String(++rootCount))
      return
    }
    const childCount = (childCountByParent.get(parentStableId) || 0) + 1
    childCountByParent.set(parentStableId, childCount)
    idByStableId.set(stableId, `${idByStableId.get(parentStableId)}.${childCount}`)
  })
  return descriptors.map(([stableId, parentStableId, order, taskName, nodeKind]) => ({
    id: idByStableId.get(stableId),
    stableId,
    parentId: parentStableId ? idByStableId.get(parentStableId) : null,
    order,
    taskName,
    source: 'template',
    nodeKind,
    defaultRoadmap: Boolean(parentStableId),
    planStartDate: '',
    planEndDate: '',
    actualStartDate: '',
    actualEndDate: '',
  }))
}

const machineV8Seed = buildV8Seed([
  ['machine-stage-concept', null, 0, '概念阶段', 'stage'],
  ['machine-ms-concept-kickoff', 'machine-stage-concept', 0, '概念启动', 'fixed-milestone'],
  ['machine-ms-str1', 'machine-stage-concept', 1, 'STR1', 'fixed-milestone'],
  ['machine-stage-planning', null, 1, '计划阶段', 'stage'],
  ['machine-ms-str2', 'machine-stage-planning', 0, 'STR2', 'fixed-milestone'],
  ['machine-ms-str3', 'machine-stage-planning', 1, 'STR3', 'fixed-milestone'],
  ['machine-stage-development', null, 2, '开发阶段', 'stage'],
  ['machine-ms-str4', 'machine-stage-development', 0, 'STR4', 'fixed-milestone'],
  ['machine-ms-str4a', 'machine-stage-development', 1, 'STR4A', 'fixed-milestone'],
  ['machine-stage-validation', null, 3, '验证阶段', 'stage'],
  ['machine-ms-str5', 'machine-stage-validation', 0, 'STR5', 'fixed-milestone'],
  ['machine-stage-launch', null, 4, '上市阶段', 'stage'],
  ['machine-stage-lifecycle', null, 5, '生命周期阶段', 'stage'],
])
machineV8Seed.find(task => task.stableId === 'machine-ms-str5').planEndDate = '2033-05-05'
const machineV8Validation = machineV8Seed.find(task => task.stableId === 'machine-stage-validation')
machineV8Seed.push({
  id: `${machineV8Validation.id}.2`, stableId: 'custom-machine-validation', parentId: machineV8Validation.id,
  order: 1, taskName: '自定义验证节点', source: 'custom', nodeKind: 'business-period',
  planStartDate: '2033-05-06', planEndDate: '2033-05-10', actualStartDate: '2033-05-07', actualEndDate: '2033-05-11',
})

const tosV8Seed = buildV8Seed([
  ['tos-stage-planning', null, 0, '规划阶段', 'stage'],
  ['tos-ms-planning-ko', 'tos-stage-planning', 0, '规划KO', 'fixed-milestone'],
  ['tos-ms-cdcp', 'tos-stage-planning', 1, 'CDCP', 'fixed-milestone'],
  ['tos-stage-concept', null, 1, '概念阶段', 'stage'],
  ['tos-ms-concept-kickoff', 'tos-stage-concept', 0, '概念启动', 'fixed-milestone'],
  ['tos-ms-str1', 'tos-stage-concept', 1, 'STR1', 'fixed-milestone'],
  ['tos-stage-plan', null, 2, '计划阶段', 'stage'],
  ['tos-ms-str2', 'tos-stage-plan', 0, 'STR2', 'fixed-milestone'],
  ['tos-ms-str3', 'tos-stage-plan', 1, 'STR3', 'fixed-milestone'],
  ['tos-stage-development-validation', null, 3, '开发验证阶段', 'stage'],
  ['tos-ms-str4', 'tos-stage-development-validation', 0, 'STR4', 'fixed-milestone'],
  ['tos-ms-str4a', 'tos-stage-development-validation', 1, 'STR4A', 'fixed-milestone'],
  ['tos-ms-str5', 'tos-stage-development-validation', 2, 'STR5', 'fixed-milestone'],
  ['tos-stage-launch-iteration', null, 4, '上市迭代阶段', 'stage'],
  ['tos-stage-maintenance', null, 5, '维护阶段', 'stage'],
])
const tosV8Planning = tosV8Seed.find(task => task.stableId === 'tos-stage-planning')
tosV8Seed.push({
  id: `${tosV8Planning.id}.3`, stableId: 'custom-tos-planning', parentId: tosV8Planning.id,
  order: 2, taskName: '用户规划节点', source: 'custom', nodeKind: 'business-period',
  planStartDate: '2032-01-01', planEndDate: '2032-01-05', actualStartDate: '2032-01-02', actualEndDate: '2032-01-06', ownerMemo: '必须保留',
})

const capabilityV8Seed = structuredClone(machineV8Seed.filter(task => task.source !== 'custom'))
const nonMarketSnapshot = [{ id: 'keep', taskName: '非市场快照不变', marker: 'exact' }]
const persistedV8FiveStageInput = {
  tasks: structuredClone(machineV8Seed),
  configTemplateTasksByType: {
    '整机产品项目': structuredClone(machineV8Seed),
    'tOS版本项目': structuredClone(tosV8Seed),
    '能力建设项目': structuredClone(capabilityV8Seed),
  },
  marketPlanData: { OP: { tasks: structuredClone(machineV8Seed), marker: 'market-v8' } },
  tosTypePlanDataByProjectId: { '2': { Full: { level1Tasks: structuredClone(tosV8Seed), marker: 'tos-type-v8' } } },
  publishedSnapshots: {
    'template::整机产品项目::level1::v8': structuredClone(machineV8Seed),
    'template::tOS版本项目::level1::v8': structuredClone(tosV8Seed),
    'template::能力建设项目::level1::v8': structuredClone(capabilityV8Seed),
    'project::1::OP::level1::v8': structuredClone(machineV8Seed),
    'project::custom-machine-1::EU::level1::v8': structuredClone(machineV8Seed),
    'project::custom-machine-1::technical::level1::v8': structuredClone(nonMarketSnapshot),
    'project::custom-machine-1::EU::level2::v8': structuredClone(nonMarketSnapshot),
    'project::custom-machine-1::EU::level3::v8': structuredClone(nonMarketSnapshot),
    'project::2::level1::v8': structuredClone(tosV8Seed),
    'project::2::tos-type::Full::level1::v8::snapshot': structuredClone(tosV8Seed),
    'project::5::level1::v8': structuredClone(capabilityV8Seed),
  },
}
const persistedV8FiveStageInputCopy = structuredClone(persistedV8FiveStageInput)
const migratedV9 = plan.migratePlanStoreState(persistedV8FiveStageInput, 8)
assert.deepEqual(persistedV8FiveStageInput, persistedV8FiveStageInputCopy, 'V8 to V9 migration never mutates persisted input')
assert.deepEqual(rootNames(migratedV9.tasks), ['概念阶段', '计划阶段', '开发验证阶段', '上市阶段', '生命周期阶段'], 'root tasks migrate from machine V8 to V9')
assert.deepEqual(
  rootNames(migratedV9.configTemplateTasksByType['tOS版本项目'].filter(task => task.source === 'template')),
  ['概念阶段', '计划阶段', '开发验证阶段', '上市迭代阶段', '维护阶段'],
  'tOS configuration template migrates to five governed stages while compatibility roots remain user-owned',
)
assert.equal(migratedV9.marketPlanData.OP.marker, 'market-v8', 'market V8 sibling metadata survives V9 migration')
assert.equal(migratedV9.tosTypePlanDataByProjectId['2'].Full.marker, 'tos-type-v8', 'tOS type V8 sibling metadata survives V9 migration')
assert.equal(migratedV9.publishedSnapshots['project::1::OP::level1::v8'].find(task => task.stableId === 'machine-ms-str5').planEndDate, '2033-05-05', 'historical fixed-node dates survive the machine merge')
const migratedCustomMarketSnapshot = migratedV9.publishedSnapshots['project::custom-machine-1::EU::level1::v8']
assert.deepEqual(rootNames(migratedCustomMarketSnapshot), ['概念阶段', '计划阶段', '开发验证阶段', '上市阶段', '生命周期阶段'], 'unknown machine projects and later-added markets migrate their V8 level-one snapshots')
assert.equal(migratedCustomMarketSnapshot.find(task => task.stableId === 'machine-ms-str5').planEndDate, '2033-05-05', 'unknown-project market migration preserves fixed milestone dates')
assert.equal(migratedCustomMarketSnapshot.find(task => task.stableId === 'custom-machine-validation').planStartDate, '2033-05-06', 'unknown-project market migration preserves custom task data')
assert.deepEqual(migratedV9.publishedSnapshots['project::custom-machine-1::technical::level1::v8'], nonMarketSnapshot, 'reserved technical scopes never migrate as markets')
assert.deepEqual(migratedV9.publishedSnapshots['project::custom-machine-1::EU::level2::v8'], nonMarketSnapshot, 'market level-two snapshots never migrate as level one')
assert.equal(migratedV9.publishedSnapshots['project::custom-machine-1::EU::level3::v8'], undefined, 'retired market level-three snapshots are removed')
const migratedMachineCustom = migratedV9.tasks.find(task => task.stableId === 'custom-machine-validation')
assert.equal(migratedV9.tasks.find(task => task.id === migratedMachineCustom.parentId)?.stableId, 'machine-stage-development', 'custom validation children move beneath the merged machine development-validation stage')
const migratedTosConfig = migratedV9.configTemplateTasksByType['tOS版本项目']
const migratedTosCustom = migratedTosConfig.find(task => task.stableId === 'custom-tos-planning')
const migratedTosCompatParent = migratedTosConfig.find(task => task.id === migratedTosCustom.parentId)
assert.deepEqual(
  [migratedTosCustom.ownerMemo, migratedTosCustom.planStartDate, migratedTosCompatParent.taskName, migratedTosCompatParent.source],
  ['必须保留', '2032-01-01', '规划阶段', 'custom'],
  'custom children under a removed tOS stage keep data and a compatible custom parent',
)
const migratedTosConfigAgain = plan.migrateLevel1TasksForProjectType(migratedTosConfig, 'tOS版本项目', true)
assert.deepEqual(migratedTosConfigAgain, migratedTosConfig, 'direct tOS task migration remains idempotent after creating a compatibility parent')
assert.equal(new Set(migratedTosConfigAgain.map(task => task.stableId)).size, migratedTosConfigAgain.length, 'direct re-migration keeps every stable ID globally unique')
assert.equal(migratedTosConfigAgain.filter(task => task.stableId === 'tos-stage-planning').length, 1, 'direct re-migration keeps exactly one compatibility planning parent')
assert.equal(migratedTosConfigAgain.filter(task => task.stableId === 'custom-tos-planning').length, 1, 'direct re-migration keeps exactly one custom planning child')
const migratedTosCustomAgain = migratedTosConfigAgain.find(task => task.stableId === 'custom-tos-planning')
assert.equal(migratedTosConfigAgain.some(task => task.id === migratedTosCustomAgain.parentId && task.stableId === 'tos-stage-planning'), true, 'the unique custom planning child remains attached to its compatibility parent')
assert.equal(new Set(migratedTosConfigAgain.map(task => task.id)).size, migratedTosConfigAgain.length, 'direct re-migration keeps every display ID unique')
for (const tasks of [migratedV9.tasks, migratedTosConfig, migratedV9.marketPlanData.OP.tasks, migratedV9.tosTypePlanDataByProjectId['2'].Full.level1Tasks]) {
  const ids = new Set(tasks.map(task => task.id))
  assert.equal(tasks.every(task => !task.parentId || ids.has(task.parentId)), true, 'every V9 migrated scope is free of orphan nodes')
}
assert.deepEqual(migratedV9.configTemplateTasksByType['能力建设项目'], capabilityV8Seed, 'capability configuration data skips the five-stage migration')
assert.deepEqual(migratedV9.publishedSnapshots['project::5::level1::v8'], capabilityV8Seed, 'capability project snapshots skip the five-stage migration')
assert.deepEqual(plan.migratePlanStoreState(plan.migratePlanStoreState(migratedV9, 9), 13), plan.migratePlanStoreState(migratedV9, 9), 'the complete current store migration is idempotent')

const legacySharedTosSeed = [
  { id: '1', stableId: 'stage-concept', parentId: null, order: 0, taskName: '概念阶段', source: 'template' },
  { id: '1.1', stableId: 'milestone-concept-start', parentId: '1', order: 0, taskName: '概念启动', source: 'template' },
  { id: '1.2', stableId: 'milestone-str1', parentId: '1', order: 1, taskName: 'STR1', source: 'template' },
  { id: '2', stableId: 'stage-plan', parentId: null, order: 1, taskName: '计划阶段', source: 'template' },
  { id: '2.1', stableId: 'milestone-str2', parentId: '2', order: 0, taskName: 'STR2', source: 'template' },
  { id: '2.2', stableId: 'milestone-str3', parentId: '2', order: 1, taskName: 'STR3', source: 'template' },
  { id: '3', stableId: 'stage-development', parentId: null, order: 2, taskName: '开发验证阶段', source: 'template' },
  { id: '3.1', stableId: 'milestone-str4', parentId: '3', order: 0, taskName: 'STR4', source: 'template' },
  { id: '3.2', stableId: 'milestone-str4a', parentId: '3', order: 1, taskName: 'STR4A', source: 'template' },
  { id: '3.3', stableId: 'milestone-str5', parentId: '3', order: 2, taskName: 'STR5', source: 'template' },
  { id: '4', stableId: 'stage-launch', parentId: null, order: 3, taskName: '上市收编阶段', source: 'template' },
  { id: '4.1', stableId: 'milestone-close', parentId: '4', order: 0, taskName: '收编完成', source: 'template' },
]
const legacyLaunch = legacySharedTosSeed.find(task => task.stableId === 'stage-launch')
const stableMapped = legacySharedTosSeed.find(task => task.stableId === 'milestone-str2')
stableMapped.planEndDate = '2031-04-08'
stableMapped.ownerMemo = 'stable-id-date'
const secondStableMapped = legacySharedTosSeed.find(task => task.stableId === 'milestone-str3')
secondStableMapped.actualEndDate = '2031-05-09'
secondStableMapped.ownerMemo = 'second-stable-id-date'
legacySharedTosSeed.push({
  id: '4.2',
  stableId: 'custom-launch-child',
  parentId: legacyLaunch.id,
  order: 9,
  taskName: '用户上市节点',
  source: 'custom',
  planStartDate: '2031-06-01',
  planEndDate: '2031-06-02',
  ownerMemo: 'keep-custom-fields',
})
const legacySharedTosInput = structuredClone(legacySharedTosSeed)
const legacySharedV7RoadmapTasks = legacySharedTosInput
  .filter(task => task.source !== 'custom')
  .map(task => ({ ...task, defaultRoadmap: Boolean(task.parentId) }))
const legacySharedV7RoadmapState = {
  publishedSnapshots: {
    'project::2::level1::v7': legacySharedV7RoadmapTasks,
  },
}
const legacySharedV7RoadmapStateInput = structuredClone(legacySharedV7RoadmapState)
const migratedLegacySharedV7RoadmapState = plan.migratePlanStoreState(legacySharedV7RoadmapState, 7)
const migratedLegacySharedV7RoadmapTasks = migratedLegacySharedV7RoadmapState.publishedSnapshots['project::2::level1::v7']
assert.deepEqual(
  rootNames(migratedLegacySharedV7RoadmapTasks),
  rootNames(plan.TOS_LEVEL1_TASKS),
  'a real V4-V7 shared stable seed with explicit roadmap flags migrates to the tOS plan',
)
assert.equal(
  migratedLegacySharedV7RoadmapTasks.every(task => task.defaultRoadmap === Boolean(task.parentId)),
  true,
  'the exact historical roadmap structure remains explicit after migration',
)
assert.deepEqual(legacySharedV7RoadmapState, legacySharedV7RoadmapStateInput, 'the V7 roadmap-shaped migration leaves its input untouched')
const migratedSharedTosSeed = plan.migrateLevel1TasksForProjectType(legacySharedTosSeed, 'tOS版本项目', true)
assert.deepEqual(legacySharedTosSeed, legacySharedTosInput, 'level-one task migration never mutates its input')
assert.equal(migratedSharedTosSeed.find(task => task.stableId === 'tos-ms-str2').planEndDate, '2031-04-08', 'fixed dates map by stable ID before names')
assert.equal(migratedSharedTosSeed.find(task => task.stableId === 'tos-ms-str2').ownerMemo, 'stable-id-date', 'recognized fixed-node user fields survive stable-ID migration')
assert.equal(migratedSharedTosSeed.find(task => task.stableId === 'tos-ms-str3').actualEndDate, '2031-05-09', 'a second legacy stable ID maps its fixed date')
assert.equal(migratedSharedTosSeed.find(task => task.stableId === 'tos-ms-str3').ownerMemo, 'second-stable-id-date', 'recognized fixed-node user fields survive stable migration')
const migratedTosLaunch = migratedSharedTosSeed.find(task => task.stableId === 'tos-stage-launch-iteration')
assert.equal(migratedTosLaunch.taskName, '上市迭代阶段', 'legacy launch aliases map to the approved tOS launch stage')
const migratedCustomLaunchChild = migratedSharedTosSeed.find(task => task.stableId === 'custom-launch-child')
assert.equal(migratedCustomLaunchChild.id, `${migratedTosLaunch.id}.1`, 'the complete migrated tree receives collision-free display numbering after parent mapping')
assert.equal(migratedCustomLaunchChild.parentId, migratedTosLaunch.id, 'the custom launch child follows its migrated business parent')
assert.equal(migratedCustomLaunchChild.stableId, legacySharedTosInput.at(-1).stableId, 'display renumbering preserves the custom business identity')
assert.equal(migratedCustomLaunchChild.planStartDate, legacySharedTosInput.at(-1).planStartDate, 'display renumbering preserves custom dates')
assert.equal(migratedCustomLaunchChild.planEndDate, legacySharedTosInput.at(-1).planEndDate, 'display renumbering preserves all custom date fields')
assert.equal(migratedCustomLaunchChild.ownerMemo, legacySharedTosInput.at(-1).ownerMemo, 'display renumbering preserves custom fields')
const migratedDisplayIds = migratedSharedTosSeed.map(task => task.id)
assert.equal(new Set(migratedDisplayIds).size, migratedDisplayIds.length, 'all migrated display IDs are unique even when a legacy custom ID collides with a new fixed milestone')
const migratedDisplayIdSet = new Set(migratedDisplayIds)
assert.equal(migratedSharedTosSeed.every(task => !task.parentId || migratedDisplayIdSet.has(task.parentId)), true, 'every migrated parent ID resolves after unified display renumbering')
assert.deepEqual(
  plan.migrateLevel1TasksForProjectType(migratedSharedTosSeed, 'tOS版本项目', true),
  migratedSharedTosSeed,
  'project-specific task migration is idempotent',
)

const unknownCustomTasks = [
  { id: 'custom-root', stableId: 'custom-root', order: 0, taskName: '概念阶段增强版', source: 'custom', nested: { keep: true } },
  { id: 'custom-str', parentId: 'custom-root', order: 0, taskName: 'STR1', source: 'custom', planEndDate: '2032-01-01' },
]
const unknownCustomInput = structuredClone(unknownCustomTasks)
assert.deepEqual(
  plan.migrateLevel1TasksForProjectType(unknownCustomTasks, '整机产品项目', true),
  unknownCustomInput,
  'nonempty unknown and custom arrays remain exactly user-owned instead of matching a few names',
)
assert.deepEqual(unknownCustomTasks, unknownCustomInput, 'unknown custom migration also leaves the input untouched')

const semanticCollisionManualTasks = [
  { id: 'manual-concept', order: 0, taskName: '概念阶段', source: 'manual' },
  { id: 'manual-kickoff', order: 1, taskName: '概念启动', source: 'manual' },
  { id: 'manual-str1', order: 2, taskName: 'STR1', source: 'manual' },
  { id: 'manual-plan', order: 3, taskName: '计划阶段', source: 'manual' },
  { id: 'manual-str2', order: 4, taskName: 'STR2', source: 'manual' },
  { id: 'manual-str3', order: 5, taskName: 'STR3', source: 'manual' },
  { id: 'manual-development', order: 6, taskName: '开发验证阶段', source: 'manual' },
  { id: 'manual-launch', order: 7, taskName: '上市收编阶段', source: 'manual' },
]
const semanticCollisionManualInput = structuredClone(semanticCollisionManualTasks)
assert.deepEqual(
  plan.migrateLevel1TasksForProjectType(semanticCollisionManualTasks, 'tOS版本项目', true),
  semanticCollisionManualInput,
  'manual roots that merely collide with legacy names are never treated as a default seed',
)
assert.deepEqual(semanticCollisionManualTasks, semanticCollisionManualInput, 'rejected manual seed candidates remain untouched')

const renamedStableSeed = structuredClone(plan.TOS_LEVEL1_TASKS)
renamedStableSeed.find(task => task.stableId === 'tos-stage-concept').taskName = '用户重命名概念阶段'
const renamedStableSeedInput = structuredClone(renamedStableSeed)
assert.deepEqual(
  plan.migrateLevel1TasksForProjectType(renamedStableSeed, '整机产品项目', true),
  renamedStableSeedInput,
  'a stable seed with a user-renamed root is not pristine and remains exact',
)
assert.deepEqual(renamedStableSeed, renamedStableSeedInput, 'rejecting a renamed stable seed leaves its input untouched')

const reorderedStableSeed = structuredClone(plan.TOS_LEVEL1_TASKS)
reorderedStableSeed.find(task => task.stableId === 'tos-ms-str1').order = 99
const reorderedStableSeedInput = structuredClone(reorderedStableSeed)
assert.deepEqual(
  plan.migrateLevel1TasksForProjectType(reorderedStableSeed, '整机产品项目', true),
  reorderedStableSeedInput,
  'a stable seed with a user-reordered sibling is not pristine and remains exact',
)
assert.deepEqual(reorderedStableSeed, reorderedStableSeedInput, 'rejecting a reordered stable seed leaves its input untouched')

const legacySimpleSeed = [
  { id: '1', order: 1, taskName: '概念', planEndDate: '2030-01-01' },
  { id: '1.1', parentId: '1', order: 1, taskName: '概念启动', planEndDate: '2030-01-02' },
  { id: '1.2', parentId: '1', order: 2, taskName: 'STR1', planEndDate: '2030-01-03' },
  { id: '2', order: 2, taskName: '计划' },
  { id: '2.1', parentId: '2', order: 1, taskName: ' str 2 ', planEndDate: '2030-02-01', ownerMemo: 'normalized-name' },
  { id: '2.2', parentId: '2', order: 2, taskName: 'STR3' },
  { id: '3', order: 3, taskName: '开发验证' },
  { id: '4', order: 4, taskName: '上市保障' },
]
const migratedSimpleMachine = plan.migrateLevel1TasksForProjectType(legacySimpleSeed, '整机产品项目', true)
assert.deepEqual(rootNames(migratedSimpleMachine), ['概念阶段', '计划阶段', '开发验证阶段', '上市阶段', '生命周期阶段'], 'the exact legacy eight-row seed migrates to machine stages')
assert.equal(migratedSimpleMachine.find(task => task.stableId === 'machine-ms-str2').planEndDate, '2030-02-01', 'legacy rows without stable IDs preserve fixed-node dates by name')
assert.equal(migratedSimpleMachine.find(task => task.stableId === 'machine-ms-str2').ownerMemo, 'normalized-name', 'legacy name matching is normalized only after the exact eight-row signature is confirmed')

const technicalSnapshot = [{ id: 'tech-keep', stableId: 'tech-keep', taskName: '技术快照不变', nested: { exact: true } }]
const unknownSnapshot = [{ id: 'unknown-keep', taskName: '未知作用域不变' }]
const clearedHistoricalMachineSnapshot = structuredClone(plan.MACHINE_LEVEL1_TASKS)
const clearedHistoricalMachineMilestone = clearedHistoricalMachineSnapshot.find(task => task.stableId === 'machine-ms-str2')
clearedHistoricalMachineMilestone.planEndDate = ''
clearedHistoricalMachineMilestone.actualEndDate = ''
clearedHistoricalMachineMilestone.clearedByUser = true
const persistedV7 = {
  tasks: plan.LEVEL1_TASKS,
  configTemplateTasksByType: {
    '整机产品项目': plan.LEVEL1_TEMPLATE_TASKS,
    'tOS版本项目': plan.LEVEL1_TEMPLATE_TASKS,
  },
  marketPlanData: {
    OP: { tasks: plan.LEVEL1_TASKS, level2Tasks: [], createdLevel2Plans: [], marker: 'machine-market' },
  },
  tosTypePlanDataByProjectId: {
    'tos-project': {
      Full: { level1Tasks: plan.LEVEL1_TASKS, level2PlanTasks: [], level2PlanMilestones: [], createdLevel2Plans: [], activeLevel2Plan: '', level2PlanMeta: {}, versionTrainRecords: [], marker: 'tos-type' },
    },
  },
  publishedSnapshots: {
    'template::整机产品项目::level1::v3': plan.LEVEL1_TEMPLATE_TASKS,
    'template::tOS版本项目::level1::v3': plan.LEVEL1_TEMPLATE_TASKS,
    'template::技术项目::tdt::v3': technicalSnapshot,
    'template::tOS版本项目::level3::v3': technicalSnapshot,
    'project::1::OP::level1::v3': plan.TOS_LEVEL1_TASKS,
    'project::1::TR::level1::v3': clearedHistoricalMachineSnapshot,
    'project::user-created::OP::level1::v3': plan.TOS_LEVEL1_TASKS,
    'project::tos-project::tos-type::Full::level1::v3::snapshot': plan.LEVEL1_TASKS,
    'project::2::level1::v3': plan.LEVEL1_TASKS,
    'project::2::OP::level1::v3': plan.TOS_LEVEL1_TASKS,
    'project::1::tos-type::Full::level1::v3::snapshot': plan.MACHINE_LEVEL1_TASKS,
    'project::unknown::level1::v3': unknownSnapshot,
    'project::tos-project::tos-type::Full::level2::v3::snapshot': technicalSnapshot,
    'project::tos-project::tos-type::Full::level1::v3': unknownSnapshot,
  },
}
const persistedV7Input = structuredClone(persistedV7)
const migratedV8 = plan.migratePlanStoreState(persistedV7, 7)
assert.deepEqual(persistedV7, persistedV7Input, 'V8 store migration leaves the complete persisted input untouched')
assert.deepEqual(rootNames(migratedV8.configTemplateTasksByType['整机产品项目']), rootNames(plan.MACHINE_LEVEL1_TEMPLATE_TASKS), 'machine configuration templates use machine defaults')
assert.deepEqual(rootNames(migratedV8.configTemplateTasksByType['tOS版本项目']), rootNames(plan.TOS_LEVEL1_TEMPLATE_TASKS), 'tOS configuration templates use tOS defaults')
assert.deepEqual(rootNames(migratedV8.marketPlanData.OP.tasks), rootNames(plan.MACHINE_LEVEL1_TASKS), 'market data only migrates through the machine scope')
assert.equal(migratedV8.marketPlanData.OP.marker, 'machine-market', 'market migration preserves sibling plan metadata')
assert.deepEqual(rootNames(migratedV8.tosTypePlanDataByProjectId['tos-project'].Full.level1Tasks), rootNames(plan.TOS_LEVEL1_TASKS), 'tOS project/type data only migrates its level-one tasks')
assert.equal(migratedV8.tosTypePlanDataByProjectId['tos-project'].Full.marker, 'tos-type', 'tOS type migration preserves sibling plan metadata')
assert.deepEqual(rootNames(migratedV8.publishedSnapshots['project::1::OP::level1::v3']), rootNames(plan.MACHINE_LEVEL1_TASKS), 'a known machine project and configured market migrate as a machine plan')
const migratedClearedHistoricalMilestone = migratedV8.publishedSnapshots['project::1::TR::level1::v3'].find(task => task.stableId === 'machine-ms-str2')
assert.equal(migratedClearedHistoricalMilestone.planEndDate, '', 'an explicitly cleared historical planned date is never filled from mock defaults')
assert.equal(migratedClearedHistoricalMilestone.actualEndDate, '', 'an explicitly cleared historical actual date is never filled from mock defaults')
assert.equal(migratedClearedHistoricalMilestone.clearedByUser, true, 'historical snapshot custom fields survive a confirmed pristine migration')
assert.deepEqual(rootNames(migratedV8.publishedSnapshots['project::user-created::OP::level1::v3']), rootNames(plan.MACHINE_LEVEL1_TASKS), 'market-shaped level-one keys migrate as machine scopes even for user-created project IDs')
assert.deepEqual(rootNames(migratedV8.publishedSnapshots['project::tos-project::tos-type::Full::level1::v3::snapshot']), rootNames(plan.TOS_LEVEL1_TASKS), 'strict tOS type snapshot keys migrate as tOS plans')
assert.deepEqual(rootNames(migratedV8.publishedSnapshots['project::2::level1::v3']), rootNames(plan.TOS_LEVEL1_TASKS), 'known ordinary project mock snapshots resolve the project type')
assert.deepEqual(rootNames(migratedV8.publishedSnapshots['project::2::OP::level1::v3']), rootNames(plan.MACHINE_LEVEL1_TASKS), 'the explicit market snapshot key shape is authoritative without initial-project metadata')
assert.deepEqual(migratedV8.publishedSnapshots['project::1::tos-type::Full::level1::v3::snapshot'], plan.MACHINE_LEVEL1_TASKS, 'a known machine project cannot be rewritten through a tOS-type key')
assert.deepEqual(migratedV8.publishedSnapshots['template::技术项目::tdt::v3'], technicalSnapshot, 'technical template snapshots remain byte-for-data exact')
assert.equal(migratedV8.publishedSnapshots['template::tOS版本项目::level3::v3'], undefined, 'retired standalone level-three template snapshots are removed')
assert.deepEqual(migratedV8.publishedSnapshots['project::unknown::level1::v3'], unknownSnapshot, 'unknown ordinary project scopes remain exact')
assert.deepEqual(migratedV8.publishedSnapshots['project::tos-project::tos-type::Full::level2::v3::snapshot'], technicalSnapshot, 'tOS level-two snapshot keys do not cross into level one')
assert.deepEqual(migratedV8.publishedSnapshots['project::tos-project::tos-type::Full::level1::v3'], unknownSnapshot, 'near-match tOS snapshot keys remain exact')
assert.deepEqual(plan.migratePlanStoreState(migratedV8, 13), migratedV8, 'the complete current store migration is idempotent after upgrading a V8 fixture')

assert.match(configSource, /getDefaultLevel1TasksForProjectType/, 'config center imports the selected-type default helper')
assert.doesNotMatch(configSource, /LEVEL1_TEMPLATE_TASKS/, 'config center never falls back to the generic machine template')
assert.match(configSource, /getDefaultLevel1TasksForProjectType\(selectedTemplateType,\s*false\)/, 'config fallbacks resolve the currently selected project type')
assert.match(configSource, /const clonedTasks = isTechnicalTemplate[\s\S]{0,260}getDefaultLevel1TasksForProjectType\(selectedTemplateType,\s*false\)/, 'new standard revisions clone the currently selected project type')

assert.match(planStoreSource, /projectPlanViewMode:\s*'horizontal'/, 'project plans default to horizontal view')
assert.match(planStoreSource, /CONFIG_TABLE_COLUMNS[\s\S]*序号[\s\S]*任务名称[\s\S]*角色/, 'template configuration keeps sequence, task name, and role')
assert.match(configSource, /isTechnicalTemplate[\s\S]*TDT项目计划[\s\S]*子项目计划/, 'technical configuration retains TDT and subproject templates')
assert.match(configSource, /items=\{isTechnicalTemplate[\s\S]*key: 'level1'[\s\S]*一级计划[\s\S]*\]\}/, 'standard project configuration only exposes the level1 tab')
for (const label of ['阶段/节点', '计划开始时间', '计划完成时间', '预估工期', '实际开始时间', '实际完成时间', '实际工期', '是否延期']) {
  assert.match(projectSpaceSource, new RegExp(label), `project level1 table contains ${label}`)
}
for (const label of ['阶段', '里程碑点', '活动名称', '实际开始时间', '实际完成时间']) assert.match(technicalModuleSource, new RegExp(label), `technical flat table contains ${label}`)
assert.match(projectSpaceSource, /getLevel1StructurePermissions/, 'all governed structure actions use the centralized permission matrix')
assert.match(projectSpaceSource, /insertLevel1BusinessNode/, 'machine and tOS controlled additions use the validated business-node helper')
assert.match(projectSpaceSource, /renameLevel1BusinessNode/, 'business-node editing uses the validated immutable rename helper')
assert.match(projectSpaceSource, /reorderLevel1BusinessNodes/, 'business-node dragging uses the validated immutable reorder helper')
assert.match(projectSpaceSource, /canRenameGovernedTask[\s\S]{0,220}getStructurePermissions\(record\)\.canRename/, 'rename buttons use the centralized parent-aware business permission')
assert.match(projectSpaceSource, /canReorderGovernedTask[\s\S]{0,220}getStructurePermissions\(record\)\.canReorder/, 'drag handles use the centralized parent-aware business permission')
for (const tokenField of ['projectId', 'scopeKind', 'scopeValue', 'versionId', 'currentUser', 'parentStableId', 'editMode', 'draft']) {
  assert.match(projectSpaceSource, new RegExp(`${tokenField}[:;,]`), `structure confirmation token binds ${tokenField}`)
}
for (const storeName of ['usePlanStore', 'useProjectStore', 'usePermissionStore', 'useUiStore']) {
  assert.match(projectSpaceSource, new RegExp(`${storeName}\\.getState\\(\\)`), `structure confirmation re-reads ${storeName}`)
}
assert.match(projectSpaceSource, /getLatestLevel1MutationContext\(dialog\.token\)/, 'structure confirmation rejects a changed live scope before writing')
assert.match(projectSpaceSource, /LEVEL1_TREE_FILTER_FIELDS/, 'governed vertical filters use the visible tree-column contract')
assert.match(projectSpaceSource, /filterLevel1TreeRows/, 'governed vertical tables retain matching tree context')
assert.match(projectSpaceSource, /selectLatestPublishedLevel1Summary/, 'machine and tOS basic information wires the published-only summary selector')
assert.match(projectSpaceSource, /latestPublishedLevel1Summary\.planStartDate/, 'basic information renders latest-published planned start')
assert.match(projectSpaceSource, /latestPublishedLevel1Summary\.planEndDate/, 'basic information renders latest-published planned completion')
assert.match(projectSpaceSource, /latestPublishedLevel1Summary\.actualStartDate/, 'basic information renders latest-published actual start')
assert.match(projectSpaceSource, /latestPublishedLevel1Summary\.actualEndDate/, 'basic information renders latest-published actual completion')
assert.match(projectSpaceSource, /getSnapshot:\s*versionId\s*=>\s*\{[\s\S]{0,240}getLevel1SurfacePublishedSnapshot\(versionId\)[\s\S]{0,240}projectLevel1Plan\(snapshot,\s*\{\s*mode:\s*'standard'\s*\}\)\.rows/, 'the basic summary projects only the scoped published snapshot through the standard tree before selecting four dates')
assert.doesNotMatch(projectSpaceSource, /latestPublishedLevel1Summary[\s\S]{0,240}(effectiveTasks|selectedProject\.planStartDate|selectedProject\.planEndDate)/, 'the governed basic summary never falls back to live drafts or project record dates')
assert.match(projectSpaceSource, /className=\{`pms-table pms-level1-tree-table/, 'machine and tOS share the scoped tree-table surface')
assert.match(projectSpaceSource, /rowKey=\{record => record\.stableId \|\| record\.id\}/, 'governed tree rows use stable identity')
assert.match(projectSpaceSource, /expandedRowKeys[,}]/, 'governed vertical tables expose real controlled tree expanders')
assert.match(projectSpaceSource, /pms-level1-date-input-invalid/, 'invalid governed dates have a dedicated picker error class')
assert.match(projectSpaceSource, /data-field/, 'governed date cells expose stable field focus targets')
assert.match(
  projectSpaceSource,
  /aria-label=\{`添加业务节点 \$\{value\}`\}[\s\S]{0,220}openLevel1Insertion\('business', record\.stableId \|\| record\.id\)/,
  'each governed business-stage row opens insertion with that exact stage as parent',
)
assert.doesNotMatch(projectSpaceSource, /businessStages\[0\]/, 'business insertion never defaults to the first dynamic stage')
assert.doesNotMatch(projectSpaceSource, /aria-label=\{isWholeMachineProject \? '添加MR里程碑' : '添加tOS版本'\}/, 'the top toolbar has no business-node insertion action')
assert.doesNotMatch(projectSpaceSource, /aria-label="业务父阶段"/, 'stage-row business insertion no longer asks users to select a parent again')
assert.match(
  projectSpaceSource,
  /const renameGovernedTask[\s\S]{0,900}getLatestLevel1MutationContext\(token\)[\s\S]{0,1200}renameLevel1BusinessNode/,
  'rename confirmation revalidates the live draft scope and uses the governance helper before writing',
)
assert.match(
  projectSpaceSource,
  /const deleteGovernedTask[\s\S]{0,900}getLatestLevel1MutationContext\(token\)[\s\S]{0,900}deleteLevel1GovernedTask[\s\S]{0,350}if \(!result\.ok\)[\s\S]{0,350}latest\.writeTasks\(result\.tasks\)/,
  'delete confirmation revalidates live state and writes only an executable permission-checked helper success',
)
assert.match(
  projectSpaceSource,
  /const confirmGovernedReorder[\s\S]{0,1600}reorderLevel1BusinessNodes\([\s\S]{0,240}latest\.project\.type[\s\S]{0,350}latest\.writeTasks\(result\.tasks\)/,
  'drag confirmation revalidates permissions and writes only a successful governed reorder result',
)
assert.doesNotMatch(projectSpaceSource, /isFlatGovernedLevel1Table|pms-level1-flat-milestone-table/, 'project space no longer has a special flat eight-column branch')
assert.match(projectSpaceSource, /handleGovernedDragEnd/, 'approved custom launch children have a dedicated safe reorder path')
assert.match(technicalStoreSource, /publishedVersions\.length <= 1[\s\S]*buildFirstLevel1RevisionTasks[\s\S]*buildNextLevel1RevisionTasks/, 'technical first and later revisions follow different synchronization rules')
assert.match(technicalStoreSource, /changedActualDatePatches[\s\S]*actualStartDate[\s\S]*actualEndDate[\s\S]*pairedVersionId/, 'technical draft and published actual dates synchronize by stable ID')
assert.match(compareModalSource, /fieldMode === 'hierarchical-flat'/, 'version comparison supports flat milestone columns')
assert.match(compareModalSource, /fieldMode === 'technical-subproject'/, 'version comparison supports technical activity columns')
assert.match(compareModalSource, /fieldMode\?: 'legacy' \| 'governed' \| 'hierarchical-flat' \| 'technical-subproject'/, 'version comparison retains the governed field mode for ordinary level-one plans')
assert.match(compareModalSource, /const governedColumns = \[/, 'governed history owns an explicit ten-column definition')
for (const label of ['序号', '变更类型', '阶段/节点', '计划开始', '计划完成', '预估工期', '实际开始', '实际完成', '实际工期', '是否延期']) {
  assert.match(compareModalSource, new RegExp(label), `governed history contains ${label}`)
}
assert.match(compareModalSource, /governedColumns[\s\S]*renderFlatDaysCell/, 'governed history renders a real zero-day duration as 0天')
assert.match(projectSpaceSource, /const usesGovernedProjectLevel1History = projectPlanLevel === 'level1'\s*&& !isTechnicalProject/, 'every ordinary non-technical level-one history uses governed fields')
assert.match(projectSpaceSource, /usesGovernedProjectLevel1History[\s\S]{0,180}projectLevel1Plan\(oldTasks as any, \{ mode: 'standard' \}\)\.rows/, 'ordinary, machine and tOS level-one history project the old snapshot through the standard tree')
assert.match(projectSpaceSource, /usesGovernedProjectLevel1History[\s\S]{0,420}projectLevel1Plan\(newTasks as any, \{ mode: 'standard' \}\)\.rows/, 'ordinary, machine and tOS level-one history project the new snapshot through the standard tree')
assert.match(projectSpaceSource, /fieldMode=\{usesGovernedProjectLevel1History \? 'governed' : 'legacy'\}/, 'level-one history uses governed fields while secondary levels retain legacy mode')
assert.match(technicalModuleSource, /fieldMode=\{tab\?\.templateKind === 'subproject' \? 'technical-subproject' : 'hierarchical-flat'\}/, 'technical comparison selects the matching current-table fields')
assert.match(projectSpaceSource, /buildProjectListMockPlanTasks\(selectedProject\.id,/, 'project space consumes the same project-scoped mock plan source as the project list')
assert.match(
  projectListSource,
  /buildProjectListMockPlanTasks\([\s\S]{0,220}projectType:\s*project\.type,[\s\S]{0,80}projectName:\s*project\.name/,
  'project list supplies the real project type and name when building dynamic mock rows',
)
assert.match(
  projectSpaceSource,
  /buildProjectListMockPlanTasks\(selectedProject\.id,[\s\S]{0,220}projectType:\s*selectedProject\.type,[\s\S]{0,100}projectName:\s*selectedProject\.name/,
  'project space supplies the same project context when initializing standard and tOS mock rows',
)
assert.match(
  projectSpaceSource,
  /ensureMarketPlanDataForRows\(marketPlanData,\s*normalizedRows,\s*projectLinkedLevel1MockTasks,\s*FIXED_LEVEL2_PLANS\)/,
  'new machine market scopes initialize from the project-linked mock containing MR business periods',
)
assert.match(projectSpaceSource, /planEndDate:\s*task\.planEndDate\s*\|\|\s*''/, 'tOS project initialization preserves project-linked mock plan dates')
assert.match(projectSpaceSource, /actualStartDate:\s*task\.actualStartDate\s*\|\|\s*''/, 'tOS project initialization restores the project-list mock actual start date after clearing execution fields')
assert.match(projectSpaceSource, /actualEndDate:\s*task\.actualEndDate\s*\|\|\s*''/, 'tOS project initialization restores the project-list mock actual end date after clearing execution fields')
assert.match(projectSpaceSource, /selectLevel1HorizontalVersions\(horizontalVersions,\s*\{\s*surface,\s*includeDraft:\s*surface === 'project-plan' && level1SurfaceCanMaintain,?\s*\}\)/, 'horizontal surfaces select versions explicitly and only project-plan exposes drafts to maintainers')
assert.match(projectSpaceSource, /sumLevel1StageEstimatedDays\(vProjection\.rows\)/, 'horizontal development cycle sums root-stage estimated durations only')
assert.match(projectSpaceSource, /versionProjections\s*=\s*displayVersions\.map/, 'horizontal rows project each version from its own source tasks')
assert.match(projectSpaceSource, /getLevel1SurfaceVersionTasks\(version\)/, 'horizontal rows resolve each version from the current project dimension')
const horizontalTableStart = projectSpaceSource.indexOf('const renderHorizontalTable = (surface: Level1HorizontalSurface) =>')
const horizontalTableEnd = projectSpaceSource.indexOf('// ═══════ renderActionButtons', horizontalTableStart)
const horizontalTableSource = projectSpaceSource.slice(horizontalTableStart, horizontalTableEnd)
assert.ok(horizontalTableStart >= 0 && horizontalTableEnd > horizontalTableStart, 'horizontal renderer requires an explicit surface instead of inferring the current tab')
assert.match(horizontalTableSource, /versionProjections\.map\([\s\S]*<tr key=\{version\.id\}/, 'horizontal renderer outputs one row per selected version')
assert.equal((horizontalTableSource.match(/<tr style=\{\{ background: '#fffbe6' \}\}>/g) || []).length, 1, 'horizontal renderer owns at most one actual row after selected versions')
assert.match(horizontalTableSource, /\{actualProjection && \([\s\S]{0,120}<tr style=\{\{ background: '#fffbe6' \}\}>/, 'horizontal renderer only adds the actual row when a valid published projection exists')
assert.match(horizontalTableSource, /const vMilestones = resolveLevel1HorizontalVersionCells\(allMilestones, vProjection\.rows\)/, 'each horizontal version row resolves cells from that version projection')
assert.match(horizontalTableSource, /const actualMilestones = resolveLevel1HorizontalVersionCells\(allMilestones, actualRows\)/, 'the horizontal actual row resolves cells from the latest published projection')
assert.match(horizontalTableSource, /actualMilestones\.map\(\(actualTask:/, 'the horizontal actual row renders the resolved published cells')
assert.match(horizontalTableSource, /所有一级阶段的预估工期总和[\s\S]{0,180}sumLevel1StageEstimatedDays\(actualRows\)/, 'the actual row development cycle uses the latest published root-stage estimated-duration total')
assert.doesNotMatch(horizontalTableSource, /actualRows\.find\([\s\S]{0,180}\)\s*\|\|\s*m/, 'a missing published actual cell never falls back to a draft/header task')
assert.match(horizontalTableSource, /canEditLevel1HorizontalDateCell\(m\) && version\.id === horizontalCurrentVersion/, 'revision plan-date editing delegates stage readonly enforcement to the tested cell rule')
assert.match(horizontalTableSource, /canEditLevel1HorizontalDateCell\(actualTask\) && actualProjectionAccess\.canEdit/, 'actual-date editing delegates stage readonly enforcement to the tested cell rule and rendered-projection permission')
assert.match(horizontalTableSource, /resolveLevel1HorizontalActualProjectionAccess\(\{[\s\S]{0,220}actualVersionId:\s*actualVersionProjection\.version\.id[\s\S]{0,120}canMaintain:\s*level1SurfaceCanMaintain/, 'actual-row edit permission is based on the rendered published projection rather than the selected revision')
assert.match(horizontalTableSource, /targetPublishedVersionId:\s*actualProjectionAccess\.targetPublishedVersionId!/, 'actual-row writes explicitly target the rendered published snapshot selected by the access rule')
const horizontalHeaderStart = projectSpaceSource.indexOf('{stageGroups.map(({ stage, colSpan }, i) => {')
const horizontalHeaderEnd = projectSpaceSource.indexOf('</thead>', horizontalHeaderStart)
assert.ok(horizontalHeaderStart >= 0 && horizontalHeaderEnd > horizontalHeaderStart, 'horizontal stage header slice is present')
const horizontalHeaderSource = projectSpaceSource.slice(horizontalHeaderStart, horizontalHeaderEnd)
assert.match(horizontalHeaderSource, /const dynamicBusinessStage = selectedProject[\s\S]{0,180}isBusinessStage\(selectedProject\.type, stage\)/, 'horizontal headers recognize project-specific dynamic business stages')
assert.match(horizontalHeaderSource, /!dynamicBusinessStage[\s\S]{0,240}stage\.estimatedDays/, 'dynamic business stages omit the duration badge while fixed stages retain it')
assert.match(horizontalHeaderSource, /textAlign:\s*'center'/, 'horizontal stage names are centered')
assert.doesNotMatch(horizontalHeaderSource, /manpowerPercent|planStartDate|planEndDate|~/, 'horizontal stage headers omit percentages and date ranges')
const basicInfoHorizontalCalls = [
  projectSpaceSource.slice(projectSpaceSource.indexOf('const renderWholeMachinePlanInfo ='), projectSpaceSource.indexOf('const anchorSections =')),
  projectSpaceSource.slice(projectSpaceSource.indexOf('const renderProjectPlanInfo ='), projectSpaceSource.indexOf('// ═══════ renderProjectOverview')),
]
for (const basicInfoSource of basicInfoHorizontalCalls) {
  assert.match(basicInfoSource, /renderHorizontalTable\('basic-info'\)/, 'each basic-information plan surface requests the two-row basic-info horizontal view explicitly')
}
const projectPlanHorizontalSource = projectSpaceSource.slice(projectSpaceSource.indexOf('// ═══════ renderProjectPlan ═══════'), projectSpaceSource.indexOf('// ═══════ Sidebar menu items'))
assert.match(projectPlanHorizontalSource, /projectPlanViewMode === 'horizontal' \? renderHorizontalTable\('project-plan'\)/, 'the plan module explicitly retains the project-plan horizontal version behavior')
assert.doesNotMatch(projectSpaceSource, /横版只读/, 'the obsolete horizontal-readonly label is absent')
assert.match(projectSpaceSource, /version\.status === '修订中'[\s\S]{0,240}aria-label="修订中"/, 'draft version numbers carry a revision-state icon')
assert.equal((projectSpaceSource.match(/<ClickToEditDate\s+align="center"/g) || []).length >= 2, true, 'editable horizontal dates align with read-only date text')
const verticalExportStart = projectSpaceSource.indexOf("const handleExportVerticalPlan = (scope: 'current' | 'all') =>")
const verticalExportEnd = projectSpaceSource.indexOf("const handleExportHorizontalPlan =", verticalExportStart)
const verticalExportSource = projectSpaceSource.slice(verticalExportStart, verticalExportEnd)
assert.match(verticalExportSource, /scope === 'current' \? getLevel1FilteredTreeRows\(effectiveTasks\) : projectedRows/, 'vertical current export shares filtered hierarchy and vertical all uses the complete projection')
assert.match(verticalExportSource, /LEVEL1_TREE_EXPORT_COLUMNS/, 'governed vertical export uses the tree nine-column headers')
const horizontalExportStart = projectSpaceSource.indexOf("const handleExportHorizontalPlan =")
const horizontalExportEnd = projectSpaceSource.indexOf('// ══════ Build transferProps', horizontalExportStart)
const horizontalExportSource = projectSpaceSource.slice(horizontalExportStart, horizontalExportEnd)
assert.match(horizontalExportSource, /versionProjections/, 'horizontal current/all exports keep the version-stage matrix')
assert.match(horizontalExportSource, /getLevel1SurfaceVersionTasks\(version\)/, 'horizontal export resolves every version from its own scoped snapshot')
assert.match(horizontalExportSource, /for \(const match of resolveLevel1HorizontalVersionCells\(allMilestones, projection\.rows\)\)/, 'horizontal export version cells resolve from each version projection')
assert.match(horizontalExportSource, /for \(const task of resolveLevel1HorizontalVersionCells\(allMilestones, actualRows\)\)/, 'horizontal export actual cells resolve from the latest published projection')
assert.match(horizontalExportSource, /\[version\.versionNo,\s*sumLevel1StageEstimatedDays\(projection\.rows\)\s*\?\?\s*'-'\]/, 'horizontal export development cycle reuses the same root-stage duration sum as the page and renders empty totals as a dash')
assert.match(horizontalExportSource, /\['实际',\s*sumLevel1StageEstimatedDays\(actualRows\)\s*\?\?\s*'-'\]/, 'horizontal export actual row uses the latest published root-stage estimated-duration total and renders an empty total as a dash')
assert.match(horizontalExportSource, /if \(actualProjection\) \{[\s\S]{0,500}dataMatrix\.push\(actualRow\)/, 'draft-only horizontal exports never append a fabricated actual row')
assert.doesNotMatch(horizontalExportSource, /calcCycleDays\(projection\.rows,\s*'planStartDate',\s*'planEndDate'\)/, 'horizontal export never derives planned development cycle from calendar min/max')
assert.doesNotMatch(horizontalExportSource, /versionOffsetIndex|shiftDateStrForExport|projectLevel1Plan\(effectiveTasks/, 'horizontal export never fabricates historical versions from the current live plan')
const compareHandlerStart = projectSpaceSource.indexOf('const handleComparePlanVersions = () =>')
const compareHandlerEnd = projectSpaceSource.indexOf('const handleCancelCompare =', compareHandlerStart)
const compareHandlerSource = projectSpaceSource.slice(compareHandlerStart, compareHandlerEnd)
assert.match(compareHandlerSource, /resolveTosComparisonVersionTasks\(\{[\s\S]*version,[\s\S]*currentVersionId:\s*currentVersion/, 'tOS comparison distinguishes the exact current draft from historical versions')
assert.doesNotMatch(compareHandlerSource, /if \(snapshot === undefined\) return currentScopedTasks/, 'a missing historical tOS snapshot never borrows current live tasks')

console.log('level1 plan governance rule verification passed')
