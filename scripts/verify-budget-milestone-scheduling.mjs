import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'

globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = { localStorage }

const load = createTypeScriptModuleLoader()
const get = file => load(path.resolve(file))
const scheduling = get('src/lib/budgetMilestoneScheduling.ts')

const task = (id, taskName, intervalDays, parentId, order = Number(id.split('.').at(-1))) => ({
  id,
  taskName,
  intervalDays,
  ...(parentId ? { parentId } : {}),
  order,
})
const stage = (id, taskName, children) => [
  task(id, taskName, null, undefined, Number(id)),
  ...children.map(([name, days], index) => task(`${id}.${index + 1}`, name, days, id, index + 1)),
]
const publishedState = (category, tasks, version = { id: 'v4', versionNo: 'V4', status: '已发布', publishedAt: '2026-09-18T00:00:00Z' }) => {
  const source = scheduling.BUDGET_SCHEDULE_SOURCES[category]
  return {
    configTemplateVersionScopes: {
      [source.scopeKey]: { currentVersion: version.id, versions: [
        { id: 'v3', versionNo: 'V3', status: '已发布', publishedAt: '2026-08-18T00:00:00Z' },
        version,
      ] },
    },
    publishedSnapshots: {
      [source.snapshotKey('v3')]: tasks.map(item => ({ ...item, intervalDays: item.parentId ? 999 : item.intervalDays })),
      [source.snapshotKey(version.id)]: structuredClone(tasks),
    },
  }
}

const categoryCases = {
  machine: {
    anchors: ['conceptStart', 'str5'],
    tasks: [
      ...stage('1', '概念阶段', [['概念启动', 99], ['STR1', 1]]),
      ...stage('2', '计划阶段', [['STR3', 2], ['STR5', 3]]),
    ],
  },
  tos: {
    anchors: ['planningKO', 'str5'],
    tasks: [
      ...stage('1', '规划阶段', [['规划KO', 99], ['CDCP', 1]]),
      ...stage('2', '开发验证阶段', [['STR3', 2], ['STR5', 3]]),
    ],
  },
  technical: {
    anchors: ['planningStart', 'edcp'],
    tasks: [
      ...stage('1', '规划阶段', [['规划启动', 99], ['charter DCP', 1]]),
      ...stage('2', '迁移阶段', [['TDCP_X', 2], ['EDCP', 3]]),
    ],
  },
}

for (const [category, fixture] of Object.entries(categoryCases)) {
  assert.deepEqual(scheduling.BUDGET_SCHEDULE_ANCHORS[category].map(anchor => anchor.key), fixture.anchors)
  const model = scheduling.resolvePublishedBudgetScheduleModel(publishedState(category, fixture.tasks), category)
  assert.equal(model.templateVersionId, 'v4', `${category}: newest published template selected`)
  assert.equal(model.templateVersionNo, 'V4')
  assert.equal(model.totalModelDays, 6, `${category}: first anchor interval excluded`)
  assert.deepEqual(model.milestones.map(item => item.fieldKey), [fixture.anchors[0], scheduling.BUDGET_MILESTONE_FIELD_BY_LABEL[category][fixture.tasks[2].taskName], scheduling.BUDGET_MILESTONE_FIELD_BY_LABEL[category][fixture.tasks[4].taskName], fixture.anchors[1]])
  const dates = scheduling.createBudgetMilestoneSchedule(model, '2026-01-01', '2026-03-02')
  assert.equal(dates[fixture.anchors[0]], '2026-01-01', `${category}: first anchor exact`)
  assert.equal(dates[fixture.anchors[1]], '2026-03-02', `${category}: last anchor exact`)
  assert.equal(dates[model.milestones[1].fieldKey], '2026-01-11')
  assert.equal(dates[model.milestones[2].fieldKey], '2026-01-31')
}

const roundingTasks = [
  ...stage('1', '概念阶段', [['概念启动', 100], ['STR1', 1], ['STR5', 2]]),
]
const roundingModel = scheduling.resolvePublishedBudgetScheduleModel(publishedState('machine', roundingTasks), 'machine')
const rounded = scheduling.createBudgetMilestoneSchedule(roundingModel, '2026-01-01', '2026-01-11')
assert.equal(rounded.str1, '2026-01-04', 'cumulative proportional rounding uses integer calendar days')
assert.equal(rounded.str5, '2026-01-11', 'rounding never moves the last endpoint')

assert.throws(() => scheduling.resolvePublishedBudgetScheduleModel(publishedState('machine', [
  ...stage('1', '概念阶段', [['概念启动', 0], ['STR1', undefined], ['STR5', 2]]),
]), 'machine'), /STR1.*间隔天数/)
assert.throws(() => scheduling.resolvePublishedBudgetScheduleModel(publishedState('machine', [
  ...stage('1', '概念阶段', [['概念启动', 0], ['STR1', 0], ['STR5', 0]]),
]), 'machine'), /模型周期必须大于0/)
assert.throws(() => scheduling.resolvePublishedBudgetScheduleModel(publishedState('machine', [
  ...stage('1', '概念阶段', [['概念启动', 0], ['未知评审点', 5], ['STR5', 5]]),
]), 'machine'), /未知评审点.*无法映射/)
assert.throws(() => scheduling.resolvePublishedBudgetScheduleModel(publishedState('machine', [
  ...stage('1', '概念阶段', [['概念启动', 0], ['STR5', 5]]),
  task('1.1.1', '未知深层节点', 9, '1.1', 1),
]), 'machine'), /未知深层节点.*无法映射/, 'positive-weight nested nodes must not disappear outside direct stage traversal')
assert.throws(() => scheduling.resolvePublishedBudgetScheduleModel(publishedState('machine', [
  ...stage('1', '概念阶段', [['STR5', 2], ['STR1', 1], ['概念启动', 0]]),
]), 'machine'), /锚点顺序/)
assert.throws(() => scheduling.createBudgetMilestoneSchedule(roundingModel, '2026-02-01', '2026-01-01'), /结束时间不能早于开始时间/)
assert.throws(() => scheduling.createBudgetMilestoneSchedule(roundingModel, '2026-02-30', '2026-03-01'), /有效日期/)

const schedule = scheduling.createBudgetMilestoneSchedule(roundingModel, '2026-01-01', '2026-01-11')
const initialMetrics = scheduling.calculateBudgetStageMetrics(roundingModel, schedule)
const manualMetrics = scheduling.calculateBudgetStageMetrics(roundingModel, { ...schedule, str1: '2026-01-08' })
assert.equal(initialMetrics[0].modelDays, 3)
assert.equal(manualMetrics[0].modelDays, 3, 'manual changes never alter model metrics')
assert.notEqual(initialMetrics[0].scheduledSegments[0].days, manualMetrics[0].scheduledSegments[0].days, 'manual edit changes scheduled metric')
assert.match(scheduling.formatBudgetStageMetrics(manualMetrics[0]), /^排布10天（100\.00%）\/模型3天（100\.00%）$/)
assert.match(scheduling.formatBudgetStageMetrics(scheduling.calculateBudgetStageMetrics(roundingModel, { ...schedule, str1: null })[0]), /^排布0天（0\.00%）\//)
const partialModel=scheduling.resolvePublishedBudgetScheduleModel(publishedState('machine',[
  ...stage('1','概念阶段',[['概念启动',0],['STR1',10]]),
  ...stage('2','计划阶段',[['STR2',20],['STR3',20]]),
  ...stage('3','开发验证阶段',[['STR4',10],['STR4A',10],['STR5',30]]),
]),'machine')
const partialDates={conceptStart:'2026-09-02',str1:'2026-09-11'}
let partialMetrics=scheduling.calculateBudgetStageMetrics(partialModel,partialDates)
assert.deepEqual(partialMetrics.map(metric=>[metric.scheduledDays,metric.scheduledRatio]),[[9,100],[0,0],[0,0],[0,0]],'one completed stage accounts for all known intervals')
partialMetrics=scheduling.calculateBudgetStageMetrics(partialModel,{...partialDates,str2:'2026-09-19',str3:'2026-09-25',str4:'2026-09-26',str4a:'2026-09-28'})
assert.deepEqual(partialMetrics.map(metric=>metric.scheduledDays),[9,14,3,0],'incomplete last stage includes already filled intervals')
assert.deepEqual(partialMetrics.map(metric=>metric.scheduledRatio),[9/26*100,14/26*100,3/26*100,0])
assert.equal(scheduling.calculateBudgetStageMetrics(partialModel,{}).every(metric=>metric.scheduledRatio===0),true,'empty dates do not divide by zero')
const divergentSnapshot = JSON.parse(JSON.stringify(roundingModel))
divergentSnapshot.stages[0].milestones[1].intervalDays = 999
assert.throws(() => scheduling.validateBudgetScheduleSnapshot('machine', divergentSnapshot), /阶段里程碑与模型不一致/, 'JSON roundtrip stage copies must match canonical milestones')

const planStore = get('src/stores/plan.ts').usePlanStore
for (const [category, expected] of Object.entries({ machine:['概念阶段','计划阶段','开发阶段','验证阶段'], tos:['规划阶段','概念阶段','计划阶段','开发验证阶段'], technical:['规划阶段','概念阶段','计划阶段','开发验证阶段','迁移阶段'] })) {
  const emptyState = {configTemplateVersionScopes:{},publishedSnapshots:{}}
  const display = scheduling.resolveBudgetScheduleDisplay(emptyState,category)
  assert.deepEqual(display.stages.map(stage=>stage.label),expected,`${category}: unconfigured template retains default stage headings`)
  assert.equal(display.totalModelDays,null,'display fallback must not invent model weights')
  assert.throws(()=>scheduling.resolvePublishedBudgetScheduleModel(emptyState,category),/未找到/,'display fallback never enables automatic scheduling')
  const source = scheduling.BUDGET_SCHEDULE_SOURCES[category]
  const tasks = planStore.getState().publishedSnapshots[source.snapshotKey('v3')].map(({intervalDays,...item})=>item)
  tasks.find(task=>!task.parentId).taskName='自定义首阶段'
  const retained = scheduling.resolveBudgetScheduleDisplay(publishedState(category,tasks),category)
  assert.equal(retained.stages[0].label,'自定义首阶段','missing intervals preserve published stage structure')
  const manualDates=Object.fromEntries(retained.milestones.map((milestone,index)=>[milestone.fieldKey,`2026-01-${String(index+1).padStart(2,'0')}`]))
  const metrics=scheduling.calculateBudgetStageMetrics(retained,manualDates)
  assert.ok(metrics.every(metric=>metric.scheduledDays!==null),'manual dates calculate without model interval days')
  assert.equal(Math.round(metrics.reduce((sum,metric)=>sum+metric.scheduledRatio,0)),100)
  assert.ok(metrics.every(metric=>metric.modelDays===null))
  assert.match(scheduling.formatBudgetStageMetrics(metrics[0]),/排布\d+天.*\/模型未配置$/)
}
const intervalMath = get('src/lib/templateIntervals.ts')
const draftKeys = { machine: '整机产品项目', tos: 'tOS版本项目', technical: '技术项目::TDT项目计划' }
for (const category of ['machine', 'tos', 'technical']) {
  const seeded = scheduling.resolvePublishedBudgetScheduleModel(planStore.getState(), category)
  assert.equal(seeded.templateVersionId, 'v3', `${category}: fresh default uses latest published V3`)
  assert.equal(seeded.totalModelDays, 100, `${category}: fresh published template has a usable 100-day model`)
  assert.equal(intervalMath.calculateTemplateIntervals(planStore.getState().configTemplateTasksByType[draftKeys[category]]).totalDays, 100, `${category}: fresh draft starts with the same 100-day model`)
}
const defaultMachineDraft = structuredClone(planStore.getState().configTemplateTasksByType[draftKeys.machine])
const defaultMachineSnapshot = structuredClone(planStore.getState().publishedSnapshots[scheduling.BUDGET_SCHEDULE_SOURCES.machine.snapshotKey('v3')])
const retainedEmpty = defaultMachineDraft.map(({ intervalDays: _intervalDays, ...item }) => item)
planStore.getState().setConfigTemplateTasksByType(previous => ({ ...previous, [draftKeys.machine]: retainedEmpty }))
planStore.getState().setPublishedSnapshots(previous => ({ ...previous, [scheduling.BUDGET_SCHEDULE_SOURCES.machine.snapshotKey('v3')]: retainedEmpty }))
const reloadedPlanStore = createTypeScriptModuleLoader()(path.resolve('src/stores/plan.ts')).usePlanStore
await reloadedPlanStore.persist.rehydrate()
assert.equal(intervalMath.calculateTemplateIntervals(reloadedPlanStore.getState().configTemplateTasksByType[draftKeys.machine]).totalDays, 0, 'persisted draft is not replaced by fresh defaults')
assert.throws(() => scheduling.resolvePublishedBudgetScheduleModel(reloadedPlanStore.getState(), 'machine'), /间隔天数/, 'persisted published snapshot is not silently reseeded')
planStore.getState().setConfigTemplateTasksByType(previous => ({ ...previous, [draftKeys.machine]: defaultMachineDraft }))
planStore.getState().setPublishedSnapshots(previous => ({ ...previous, [scheduling.BUDGET_SCHEDULE_SOURCES.machine.snapshotKey('v3')]: defaultMachineSnapshot }))

const registry = get('src/stores/project.ts').useProjectStore
const registryRules = get('src/lib/hrProjectRegistry.ts')
const versionRules = get('src/lib/hrVersionRules.ts')
const authorizedActor = registry.getState().currentLoginUser
let unauthorizedScheduleCase
for (const [category, kind] of Object.entries({ machine: 'Machine', tos: 'Tos', technical: 'Technical' })) {
  const store = get(`src/stores/hr${kind}.ts`)[`useHr${kind}Store`]
  store.getState().refreshFormalProjects()
  const seededProject = store.getState().projects.find(item => item.pmsProjectId === `mock-budget-${category}-bound`)
  const seededVersion = seededProject?.versions.find(item => item.scheduleModelSnapshot)
  assert.ok(seededVersion, `${category}: fresh budget fixture includes a scheduled resource version`)
  assert.equal(seededVersion.scheduleModelSnapshot.totalModelDays, 100)
  assert.ok(seededVersion.milestones[categoryCases[category].anchors[0]])
  assert.ok(seededVersion.milestones[categoryCases[category].anchors[1]])
  const seededSnapshot = structuredClone(seededVersion.scheduleModelSnapshot)
  store.setState({ projects: store.getState().projects.map(item => item.id !== seededProject.id ? item : { ...item, versions: item.versions.map(version => {
    if (version.id !== seededVersion.id) return version
    const { scheduleModelSnapshot: _snapshot, ...retained } = version
    return retained
  }) }) })
  await store.persist.rehydrate()
  assert.equal(store.getState().projects.find(item => item.id === seededProject.id).versions.find(item => item.id === seededVersion.id).scheduleModelSnapshot, undefined, `${category}: persisted resource version is not backfilled`)
  store.setState({ projects: store.getState().projects.map(item => item.id !== seededProject.id ? item : { ...item, versions: item.versions.map(version => version.id === seededVersion.id ? { ...version, scheduleModelSnapshot: seededSnapshot } : version) }) })
  const project = store.getState().projects.find(item => registryRules.getHrAllowedBudgetTypes(item).includes('annual') && registryRules.canEditHrInScope(item, item.pmsProjectId))
  assert.ok(project, `${category}: editable budget project fixture`)
  const existing = project.versions.find(version => version.budgetType === 'annual' && versionRules.isHrVersionEditable(project, version))
  const versionId = existing?.id ?? store.getState().createVersionInline(project.id, 'annual', project.pmsProjectId)
  const currentProject = () => store.getState().projects.find(item => item.id === project.id)
  const currentVersion = () => currentProject().versions.find(item => item.id === versionId)
  const allMilestones = Object.keys(scheduling.BUDGET_MILESTONE_FIELD_BY_LABEL[category])
  const fullTemplate = stage('1', '完整阶段', allMilestones.map((label, index) => [label, index === 0 ? 0 : 1]))
  const model = scheduling.resolvePublishedBudgetScheduleModel(publishedState(category, fullTemplate), category)
  const dates = scheduling.createBudgetMilestoneSchedule(model, '2020-01-01', '2020-03-01')
  const patch = { type: 'milestoneSchedule', dates, modelSnapshot: model }
  const estimatedBefore = currentVersion().estimatedInvestment
  store.getState().updateVersionInline(project.id, versionId, patch, project.pmsProjectId)
  assert.deepEqual(currentVersion().scheduleModelSnapshot, model, `${category}: model saved with dates`)
  assert.equal(currentVersion().milestones[categoryCases[category].anchors[0]], '2020-01-01')
  assert.equal(currentVersion().milestones[categoryCases[category].anchors[1]], '2020-03-01')
  assert.equal(currentVersion().nonLaborInvestment.startMonth, '2020-01', `${category}: expense range follows scheduled dates`)
  assert.equal(currentVersion().estimatedInvestment, estimatedBefore, `${category}: scheduling preserves investment calculation`)
  const saved = structuredClone(currentVersion())
  assert.throws(() => store.getState().updateVersionInline(project.id, versionId, { ...patch, modelSnapshot: { ...model, totalModelDays: model.totalModelDays + 1 } }, project.pmsProjectId), /汇总不一致/)
  assert.deepEqual(currentVersion(), saved, `${category}: malformed snapshot is atomic`)
  const invalid = { ...dates, [categoryCases[category].anchors[0]]: '2031-01-01' }
  assert.throws(() => store.getState().updateVersionInline(project.id, versionId, { ...patch, dates: invalid }, project.pmsProjectId), /顺序/)
  assert.deepEqual(currentVersion(), saved, `${category}: invalid batch is atomic`)
  assert.throws(() => store.getState().updateVersionInline(project.id, versionId, patch, 'another-project'), /不可编辑/)
  store.getState().copyVersion(project.id, versionId)
  const copy = currentProject().versions.at(-1)
  assert.deepEqual(copy.scheduleModelSnapshot, model)
  assert.notEqual(copy.scheduleModelSnapshot, currentVersion().scheduleModelSnapshot, `${category}: copied snapshot is independent`)
  if (category === 'machine') unauthorizedScheduleCase = {
    store,
    projectId: project.id,
    versionId: copy.id,
    scopeId: project.pmsProjectId,
    patch: { ...patch, dates: scheduling.createBudgetMilestoneSchedule(model, '2021-01-01', '2021-03-01') },
  }
  currentVersion().scheduleModelSnapshot.stages[0].label = 'source mutation probe'
  assert.notEqual(copy.scheduleModelSnapshot.stages[0].label, currentVersion().scheduleModelSnapshot.stages[0].label)
  await store.persist.rehydrate()
  assert.equal(currentProject().versions.find(item => item.id === copy.id).scheduleModelSnapshot.templateVersionId, 'v4', `${category}: copy survives reload`)
  store.getState().setVersionLocked(project.id, versionId, true)
  const frozen = structuredClone(currentVersion())
  assert.throws(() => store.getState().updateVersionInline(project.id, versionId, patch, project.pmsProjectId), /不可编辑/)
  assert.deepEqual(currentVersion(), frozen, `${category}: locked schedule stays unchanged`)
}

assert.ok(unauthorizedScheduleCase, 'unauthorized schedule fixture captured')
const unauthorizedProjectBefore = structuredClone(unauthorizedScheduleCase.store.getState().projects.find(item => item.id === unauthorizedScheduleCase.projectId))
registry.setState({ currentLoginUser: 'unknown' })
assert.throws(() => unauthorizedScheduleCase.store.getState().updateVersionInline(
  unauthorizedScheduleCase.projectId,
  unauthorizedScheduleCase.versionId,
  unauthorizedScheduleCase.patch,
  unauthorizedScheduleCase.scopeId,
), /当前版本不可编辑/, 'milestoneSchedule enforces actor edit permission')
assert.deepEqual(
  unauthorizedScheduleCase.store.getState().projects.find(item => item.id === unauthorizedScheduleCase.projectId),
  unauthorizedProjectBefore,
  'unauthorized milestoneSchedule leaves the complete project unchanged',
)
registry.setState({ currentLoginUser: authorizedActor })
assert.doesNotThrow(() => unauthorizedScheduleCase.store.getState().updateVersionInline(
  unauthorizedScheduleCase.projectId,
  unauthorizedScheduleCase.versionId,
  unauthorizedScheduleCase.patch,
  unauthorizedScheduleCase.scopeId,
), 'the same valid unlocked schedule succeeds after restoring the authorized actor')
const authorizedVersion = unauthorizedScheduleCase.store.getState().projects.find(item => item.id === unauthorizedScheduleCase.projectId).versions.find(item => item.id === unauthorizedScheduleCase.versionId)
assert.equal(authorizedVersion.milestones.conceptStart, '2021-01-01')
assert.equal(authorizedVersion.milestones.str5, '2021-03-01')
console.log('PASS budget milestone scheduling: mappings, published snapshots, rounding, guards, atomic stores, metrics and copy/reload isolation')
