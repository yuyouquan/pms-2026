import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const rulesPath = path.join(root, 'src/lib/level1PlanRules.ts')

if (!fs.existsSync(rulesPath)) throw new Error('src/lib/level1PlanRules.ts does not exist')

const source = fs.readFileSync(rulesPath, 'utf8')
const transpiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  fileName: rulesPath,
}).outputText
const rules = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`)

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

console.log('level1 plan governance rule verification passed')
