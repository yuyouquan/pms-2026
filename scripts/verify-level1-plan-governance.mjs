import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

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

const horizontalVersions = [
  { id: 'v1', versionNo: 'V1', status: '已发布' },
  { id: 'v2', versionNo: 'V2', status: '已发布' },
  { id: 'v3', versionNo: 'V3', status: '修订中' },
]
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
    ['machine-stage-development', null, '开发阶段', 'stage'],
    ['machine-ms-str4', 'machine-stage-development', 'STR4', 'fixed-milestone'],
    ['machine-ms-str4a', 'machine-stage-development', 'STR4A', 'fixed-milestone'],
    ['machine-stage-validation', null, '验证阶段', 'stage'],
    ['machine-ms-str5', 'machine-stage-validation', 'STR5', 'fixed-milestone'],
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
    ['tos-stage-planning', null, '规划阶段', 'stage'],
    ['tos-ms-planning-ko', 'tos-stage-planning', '规划KO', 'fixed-milestone'],
    ['tos-ms-cdcp', 'tos-stage-planning', 'CDCP', 'fixed-milestone'],
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
assert.equal(
  tosTemplateTasks.some(task => ['上市迭代阶段', '维护阶段'].includes(task.taskName)
    && tosTemplateTasks.some(child => child.parentId === task.id)),
  false,
  'tOS business stages start empty',
)
assert.deepEqual(rules.buildStandardLevel1Tasks(true), machineTemplateTasks, 'the standard builder remains a whole-machine compatibility alias')

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

for (const invalidMrName of ['mr1', 'MR01', 'MR 1', 'MR0', '里程碑1']) {
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
assert.equal(sameNameOtherTosStage.ok, true, 'the same business name remains valid under a different business parent')

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

const denyAllStructure = { canAddStage: false, canAddChild: false, canDelete: false, canReorder: false }
const allowAllStructure = { canAddStage: true, canAddChild: true, canDelete: true, canReorder: true }
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
  allowAllStructure,
  'super administrators can mutate any stage or node in a draft',
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
  { canAddStage: false, canAddChild: true, canDelete: true, canReorder: true },
  'SPMs can add, delete, and reorder dynamic nodes only within machine business stages',
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
  { canAddStage: false, canAddChild: true, canDelete: false, canReorder: false },
  'SPMs cannot delete or reorder a fixed node even when its parent is a business stage',
)
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
  { canAddStage: false, canAddChild: true, canDelete: true, canReorder: true },
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

const invalid = rules.validateLevel1MilestoneDates([
  makeTask('p1', null, 0, '阶段1'),
  makeTask('a', 'p1', 0, 'A', '2026-01-02', '2026-01-04'),
  makeTask('b', 'p1', 1, 'B', '2026-01-02', '2026-01-03'),
  makeTask('p2', null, 1, '阶段2'),
  makeTask('c', 'p2', 0, 'C', '2026-01-01', '2026-01-03'),
])
assert.equal(invalid.valid, false)
assert.match(invalid.byTaskId.b.planEndDate[0], /晚于.*A/)
assert.match(invalid.byTaskId.b.actualEndDate[0], /晚于.*A/)
assert.match(invalid.byTaskId.c.planEndDate[0], /晚于.*B/)

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
const projectSpaceSource = read('src/containers/ProjectSpaceContainer.tsx')
const technicalModuleSource = read('src/components/technical-project/TechnicalPlanModule.tsx')
const compareModalSource = read('src/components/plans/PlanVersionCompareModal.tsx')

assert.match(planStoreSource, /projectPlanViewMode:\s*'horizontal'/, 'project plans default to horizontal view')
assert.match(planStoreSource, /CONFIG_TABLE_COLUMNS[\s\S]*序号[\s\S]*任务名称[\s\S]*角色/, 'template configuration keeps sequence, task name, and role')
assert.match(configSource, /isTechnicalTemplate[\s\S]*TDT项目计划[\s\S]*子项目计划/, 'technical configuration retains TDT and subproject templates')
assert.match(configSource, /items=\{isTechnicalTemplate[\s\S]*key: 'level1'[\s\S]*一级计划[\s\S]*\]\}/, 'standard project configuration only exposes the level1 tab')
for (const label of ['阶段/里程碑节点', '计划开始时间', '计划完成时间', '预估工期', '实际开始时间', '实际结束时间', '实际工期', '是否延期']) {
  assert.match(projectSpaceSource, new RegExp(label), `project level1 table contains ${label}`)
}
for (const label of ['阶段', '里程碑点', '活动名称', '实际开始时间', '实际完成时间']) assert.match(technicalModuleSource, new RegExp(label), `technical flat table contains ${label}`)
assert.match(projectSpaceSource, /canAddLevel1CustomChild/, 'whole-machine structure additions use the source-aware launch-stage rule')
assert.match(projectSpaceSource, /canMutateLevel1TaskStructure/, 'rename, delete and reorder share the source-aware structure rule')
assert.doesNotMatch(projectSpaceSource, /isGlobalLevel1Admin\s*\|\|/, 'global administrators do not bypass template structure locks')
assert.doesNotMatch(projectSpaceSource, /level1GlobalAdmins\.includes\(currentLoginUser\)[\s\S]{0,500}添加一级活动/, 'project revisions cannot add top-level template activities')
assert.match(projectSpaceSource, /canRenameGovernedTask[\s\S]{0,420}<Input/, 'approved custom launch children can edit their names inline')
assert.match(projectSpaceSource, /handleGovernedDragEnd/, 'approved custom launch children have a dedicated safe reorder path')
assert.match(technicalStoreSource, /publishedVersions\.length <= 1[\s\S]*buildFirstLevel1RevisionTasks[\s\S]*buildNextLevel1RevisionTasks/, 'technical first and later revisions follow different synchronization rules')
assert.match(technicalStoreSource, /changedActualDatePatches[\s\S]*actualStartDate[\s\S]*actualEndDate[\s\S]*pairedVersionId/, 'technical draft and published actual dates synchronize by stable ID')
assert.match(compareModalSource, /fieldMode === 'hierarchical-flat'/, 'version comparison supports flat milestone columns')
assert.match(compareModalSource, /fieldMode === 'technical-subproject'/, 'version comparison supports technical activity columns')
assert.match(compareModalSource, /fieldMode\?: 'legacy' \| 'governed' \| 'hierarchical-flat' \| 'technical-subproject'/, 'version comparison retains the governed field mode for ordinary level-one plans')
assert.match(compareModalSource, /const governedKeys = new Set\(\['taskId', 'changeType', 'taskName', 'planStartDate', 'planEndDate', 'estimatedDays', 'actualStartDate', 'actualEndDate', 'actualDays', 'delayStatus'\]\)/, 'governed mode retains the BASE compact comparison columns')
assert.match(projectSpaceSource, /usesFlatLevel1Comparison[\s\S]{0,320}projectLevel1FlatMilestones/, 'governed project level1 comparisons project historical versions into flat milestones')
assert.match(projectSpaceSource, /fieldMode=\{usesFlatLevel1Comparison \? 'hierarchical-flat' : projectPlanLevel === 'level1' \? 'governed' : 'legacy'\}/, 'project comparisons use flat columns only for machine or tOS level-one plans')
assert.match(technicalModuleSource, /fieldMode=\{tab\?\.templateKind === 'subproject' \? 'technical-subproject' : 'hierarchical-flat'\}/, 'technical comparison selects the matching current-table fields')
assert.match(projectSpaceSource, /buildProjectListMockPlanTasks\(selectedProject\.id,/, 'project space consumes the same project-scoped mock plan source as the project list')
assert.match(projectSpaceSource, /planEndDate:\s*task\.planEndDate\s*\|\|\s*''/, 'tOS project initialization preserves project-linked mock plan dates')
assert.match(projectSpaceSource, /getDisplayPlanVersionsForHorizontalPlan\(horizontalVersions,\s*\{\s*includeDraft:\s*canMaintainCurrentPlan\s*\}\)/, 'horizontal plan exposes drafts to maintainers')
assert.match(projectSpaceSource, /sumLevel1EstimatedDays\(vProjection\.rows\)/, 'horizontal development cycle uses the estimated-duration total')
const horizontalHeaderStart = projectSpaceSource.indexOf('{stageGroups.map(({ stage, colSpan }, i) => (')
const horizontalHeaderEnd = projectSpaceSource.indexOf('</thead>', horizontalHeaderStart)
assert.ok(horizontalHeaderStart >= 0 && horizontalHeaderEnd > horizontalHeaderStart, 'horizontal stage header slice is present')
const horizontalHeaderSource = projectSpaceSource.slice(horizontalHeaderStart, horizontalHeaderEnd)
assert.match(horizontalHeaderSource, /stage\.estimatedDays === null \? '-' : `\$\{stage\.estimatedDays\}天`/, 'horizontal stages show estimated duration')
assert.doesNotMatch(horizontalHeaderSource, /manpowerPercent|planStartDate|planEndDate|~/, 'horizontal stage headers omit percentages and date ranges')
assert.match(projectSpaceSource, /version\.status === '修订中'[\s\S]{0,240}aria-label="修订中"/, 'draft version numbers carry a revision-state icon')
assert.equal((projectSpaceSource.match(/<ClickToEditDate\s+align="center"/g) || []).length >= 2, true, 'editable horizontal dates align with read-only date text')

console.log('level1 plan governance rule verification passed')
