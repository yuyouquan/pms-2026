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
]
const linkedMockA = projectMocks.buildProjectListMockPlanTasks('project-a', linkedMockTemplate)
const linkedMockB = projectMocks.buildProjectListMockPlanTasks('project-b', linkedMockTemplate)
assert.equal(linkedMockA.length, linkedMockTemplate.length)
assert.equal(linkedMockA.every(task => task.planEndDate), true, 'project mock plans contain dates')
assert.notDeepEqual(
  linkedMockA.map(task => task.planEndDate),
  linkedMockB.map(task => task.planEndDate),
  'project mock plans are scoped by project id',
)

assert.deepEqual(
  rules.STANDARD_LEVEL1_TEMPLATE_TASKS.map(task => [task.id, task.parentId || null, task.taskName]),
  [
    ['stage-concept', null, '概念阶段'],
    ['milestone-concept-start', 'stage-concept', '概念启动'],
    ['milestone-str1', 'stage-concept', 'STR1'],
    ['stage-plan', null, '计划阶段'],
    ['milestone-str2', 'stage-plan', 'STR2'],
    ['milestone-str3', 'stage-plan', 'STR3'],
    ['stage-development', null, '开发验证阶段'],
    ['milestone-str4', 'stage-development', 'STR4'],
    ['milestone-str4a', 'stage-development', 'STR4A'],
    ['milestone-str5', 'stage-development', 'STR5'],
    ['stage-launch', null, '上市收编阶段'],
    ['milestone-close', 'stage-launch', '收编完成'],
  ],
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

const prior = [
  { ...makeTask('old-root', null, 0, '旧阶段'), stableId: 'stage-concept' },
  { ...makeTask('old-a', 'old-root', 0, '旧名称', '2026-02-20', '2026-02-21'), stableId: 'milestone-concept-start' },
  { ...makeTask('custom-a', 'old-root', 1, '项目自定义', '2026-02-25', ''), stableId: 'custom-a', source: 'custom' },
]
const latestTemplate = rules.buildStandardLevel1Tasks(false).slice(0, 3)
const firstRevision = rules.buildFirstLevel1RevisionTasks(prior, latestTemplate)
assert.equal(firstRevision.find(task => task.stableId === 'milestone-concept-start').taskName, '概念启动')
assert.equal(firstRevision.find(task => task.stableId === 'milestone-concept-start').planEndDate, '2026-02-20')
assert.equal(firstRevision.find(task => task.stableId === 'milestone-concept-start').actualEndDate, '2026-02-21')
assert.equal(firstRevision.find(task => task.stableId === 'custom-a').source, 'custom')
assert.equal(firstRevision.some(task => task.stableId === 'milestone-str1'), true)

const nextRevision = rules.buildNextLevel1RevisionTasks(firstRevision)
nextRevision[0].taskName = '仅修改副本'
assert.notEqual(firstRevision[0].taskName, nextRevision[0].taskName)

const synced = rules.synchronizeLevel1ActualEndDate(firstRevision, nextRevision, firstRevision[1].id, '2026-03-01')
assert.equal(synced.sourceTasks.find(task => task.stableId === 'milestone-concept-start').actualEndDate, '2026-03-01')
assert.equal(synced.pairedTasks.find(task => task.stableId === 'milestone-concept-start').actualEndDate, '2026-03-01')
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
  assert.match(technicalModuleSource, new RegExp(label), `technical governed table contains ${label}`)
}
assert.match(projectSpaceSource, /上市收编阶段/, 'launch stage is identified for special whole-machine structure permissions')
assert.match(projectSpaceSource, /canAddGovernedChild[\s\S]{0,260}isWholeMachineProject[\s\S]{0,120}isLaunchStage/, 'whole-machine SPM structure changes are restricted to the launch stage')
assert.match(projectSpaceSource, /record\.source === 'custom'/, 'SPM can only delete project-created launch children')
assert.match(projectSpaceSource, /level1GlobalAdmins\.includes\(currentLoginUser\)[\s\S]*添加一级活动/, 'global administrators can add top-level activities')
assert.match(technicalStoreSource, /publishedVersions\.length <= 1[\s\S]*buildFirstLevel1RevisionTasks[\s\S]*buildNextLevel1RevisionTasks/, 'technical first and later revisions follow different synchronization rules')
assert.match(technicalStoreSource, /changedActualEnds[\s\S]*pairedVersionId/, 'technical draft and published actual completion dates stay synchronized')
assert.match(compareModalSource, /fieldMode === 'governed'[\s\S]*governedKeys/, 'version comparison supports the governed field set')
assert.match(projectSpaceSource, /fieldMode=\{projectPlanLevel === 'level1' \? 'governed' : 'legacy'\}/, 'project level1 comparison selects governed fields')
assert.match(technicalModuleSource, /fieldMode="governed"/, 'technical comparison selects governed fields')
assert.match(projectSpaceSource, /buildProjectListMockPlanTasks\(selectedProject\.id,/, 'project space consumes the same project-scoped mock plan source as the project list')
assert.match(projectSpaceSource, /planEndDate:\s*task\.planEndDate\s*\|\|\s*''/, 'tOS project initialization preserves project-linked mock plan dates')
assert.match(projectSpaceSource, /getDisplayPlanVersionsForHorizontalPlan\(horizontalVersions,\s*\{\s*includeDraft:\s*canMaintainCurrentPlan\s*\}\)/, 'horizontal plan exposes drafts to maintainers')

console.log('level1 plan governance rule verification passed')
