import assert from 'node:assert/strict'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'

globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = { localStorage }

const load = createTypeScriptModuleLoader()
const markets = load(path.resolve('src/lib/mrMachineMarketRules.ts'))
const projection = load(path.resolve('src/lib/machineMrLevel1Projection.ts'))
const shared = load(path.resolve('src/lib/level1SharedBusinessTasks.ts'))

const projectId = 'machine-p'
const tosProjectId = 'tos-p'
const activities = [
  { id: 'group', parentId: null, order: 0, activityName: '开发' },
  { id: 'start', parentId: 'group', order: 0, activityName: '开始' },
  { id: 'finish', parentId: 'group', order: 1, activityName: '结束' },
]
const sourceTasks = [
  { id: 'launch', stableId: 'tos-stage-launch-iteration', parentId: null, taskName: '上市迭代阶段' },
  { id: 'maintenance', stableId: 'tos-stage-maintenance', parentId: null, taskName: '维护阶段' },
  { id: 'source-2', stableId: 'source-2', parentId: 'launch', taskName: '16.3.0.2' },
  { id: 'source-3', stableId: 'source-3', parentId: 'maintenance', taskName: '16.3.0.3' },
  { id: 'source-10', stableId: 'source-10', parentId: 'launch', taskName: '16.3.0.10' },
]
const instances = Object.fromEntries(sourceTasks.slice(2).map(task => [task.taskName, {
  projectId: tosProjectId, tosVersion: task.taskName, sourceLevel1TaskId: task.stableId,
  templateVersionId: 'template-1', activities, dates: {},
}]))
const makePlan = (version, transferType, dates) => ({
  projectId, tosProjectId, tosVersion: version, transferType, dates,
})
const plans = {
  two: makePlan('16.3.0.2', '1', { start: '2027-01-08', finish: '2027-01-21' }),
  three: makePlan('16.3.0.3', '2', { start: '2027-02-08', finish: '2027-02-21' }),
  ten: makePlan('16.3.0.10', '3', { start: '2027-03-08', finish: '2027-03-21' }),
  excluded: makePlan('16.3.0.4', 'N/A', { start: '2027-04-08' }),
  noDates: makePlan('16.3.0.5', '1', {}),
}
const marketRows = [
  { id: 'tr', market: 'TR', isMain: false, followsMain: true },
  { id: 'op', market: 'OP', isMain: true, followsMain: false },
  { id: 'ru', market: 'RU', isMain: false, followsMain: false },
]
const versions = markets.projectMachineMarketMrVersions({
  projectId, plansByKey: plans, instancesByProjectId: { [tosProjectId]: Object.values(instances) }, marketRows,
})
assert.deepEqual(versions.versions.map(row => row.tosVersion), ['16.3.0.2', '16.3.0.3', '16.3.0.10'])
assert.deepEqual(versions.markets, ['OP', 'TR', 'RU'])
const sourceBeforeFilter = structuredClone(versions)
const filtered = markets.filterMachineMrProjection(versions, { tosVersion: ' .0.3 ', mrNumber: ' mr2 ', markets: ['RU', 'TR'] })
assert.deepEqual(filtered.versions.map(row => row.tosVersion), ['16.3.0.3'], 'fuzzy filters combine and MR number uses unfiltered order')
assert.deepEqual(filtered.markets, ['TR', 'RU'], 'multi-market filter keeps source market order')
assert.equal(markets.filterMachineMrProjection(versions, { tosVersion: '', mrNumber: '3', markets: [] }).versions[0].tosVersion, '16.3.0.10')
assert.equal(markets.filterMachineMrProjection(versions, { tosVersion: 'missing', mrNumber: '', markets: [] }).versions.length, 0)
assert.deepEqual(markets.filterMachineMrProjection(versions, { tosVersion: '', mrNumber: '', markets: [] }), versions, 'clearing filters restores all rows')
assert.deepEqual(versions, sourceBeforeFilter, 'filtering does not mutate plan data')
const overrides = {
  [markets.getMrMarketOverrideKey(projectId, '16.3.0.2', 'TR')]: {
    projectId, tosVersion: '16.3.0.2', market: 'TR', mainMarket: 'OP',
    dates: { start: '2027-01-09', finish: '2027-01-12' },
  },
}
const makeTasks = (market, source = sourceTasks, rows = versions.versions) => projection.projectMachineMrLevel1Tasks({
  versions: rows, instancesByProjectId: { [tosProjectId]: Object.values(instances) },
  sourceTasksByProjectId: { [tosProjectId]: source }, overridesByKey: overrides,
  market, mainMarket: versions.mainMarket,
})
const children = market => makeTasks(market).filter(task => task.parentId)
const stageIds = Object.fromEntries(makeTasks('OP').filter(task => !task.parentId).map(task => [task.stableId, task.id]))
assert.deepEqual(children('OP').map(task => [task.taskName, task.parentId]), [
  ['MR1', stageIds['machine-stage-launch']], ['MR2', stageIds['machine-stage-lifecycle']], ['MR3', stageIds['machine-stage-launch']],
])
assert.deepEqual(children('TR').map(task => [task.planStartDate, task.planEndDate]), [
  ['2027-01-09', '2027-01-12'], ['', ''], ['', ''],
], 'follow markets use only their own MR overrides')
assert.ok(children('RU').every(task => task.planStartDate === '' && task.planEndDate === ''), 'missing market dates stay blank')
const launched = children('OP')[0]
const actualInput = {
  versions: versions.versions, instancesByProjectId: { [tosProjectId]: Object.values(instances) },
  sourceTasksByProjectId: { [tosProjectId]: sourceTasks }, overridesByKey: overrides,
  market: 'OP', mainMarket: 'OP',
  previousTasks: [{ ...launched, actualStartDate: '2027-01-09', actualEndDate: '2027-01-22', planEndDate: '2099-01-01' }],
}
const actualProjection = projection.projectMachineMrLevel1Tasks(actualInput)
assert.equal(actualProjection.find(task => task.stableId === launched.stableId).actualStartDate, '2027-01-09', 'MR refresh preserves entered actual dates')
assert.equal(actualProjection.find(task => task.stableId === launched.stableId).actualEndDate, '2027-01-22')
assert.equal(actualProjection.find(task => task.stableId === launched.stableId).planEndDate, '2027-01-21', 'plan dates still come from current MR activities')
assert.ok(actualProjection.filter(task => task.parentId && task.stableId !== launched.stableId).every(task => !task.actualStartDate), 'other MR nodes do not inherit actual dates')
assert.ok(projection.projectMachineMrLevel1Tasks({ ...actualInput, versions: [] }).every(task => !task.parentId), 'removed MR nodes are not resurrected by actual dates')
const renamedSource = sourceTasks.map(task => task.id === 'source-2' ? { ...task, taskName: '16.3.0.20' } : task)
const renamedInstance = { ...instances['16.3.0.2'], tosVersion: '16.3.0.20' }
const renamedVersion = { ...versions.versions[0], tosVersion: '16.3.0.20', key: 'renamed', plan: { ...plans.two, tosVersion: '16.3.0.20' } }
const renamedTasks = projection.projectMachineMrLevel1Tasks({
  versions: [renamedVersion], instancesByProjectId: { [tosProjectId]: [renamedInstance] },
  sourceTasksByProjectId: { [tosProjectId]: renamedSource }, overridesByKey: {}, market: 'OP', mainMarket: 'OP',
})
assert.equal(renamedTasks.find(task => task.parentId)?.stableId, launched.stableId, 'source task identity survives tOS version rename')
const trBusiness = shared.captureLevel1BusinessTasks('整机产品项目', makeTasks('TR'))
assert.deepEqual(trBusiness['machine-stage-lifecycle'].map(task => task.taskName), ['MR2'])
assert.equal(shared.getLevel1BusinessScopeKey(projectId, 'market', 'TR') !== shared.getLevel1BusinessScopeKey(projectId, 'market', 'OP'), true)
const machine = { id: projectId, productType: '新品', firstSaleTosVersion: '16.3.0.100' }
const tosProjects = [{ projectId: tosProjectId, tosProjectKey: '16.3', projectName: 'tOS16.3' }]
assert.equal(projection.classifyMachineMrSource(machine, tosProjects, { [tosProjectId]: null }), 'pending', 'linked source with missing level-one data is not authoritative empty')
assert.equal(projection.classifyMachineMrSource(machine, tosProjects, { [tosProjectId]: [] }), 'ready', 'an explicit empty source is authoritative')
assert.equal(projection.classifyMachineMrSource(machine, [], { [tosProjectId]: null }), 'unbound', 'deleted tOS binding clears derived nodes')
assert.equal(projection.classifyMachineMrSource({ ...machine, firstSaleTosVersion: '' }, tosProjects, { [tosProjectId]: null }), 'unbound', 'unlinked machine clears derived nodes')
const emptyBusiness = shared.captureLevel1BusinessTasks('整机产品项目', projection.projectMachineMrLevel1Tasks({
  versions: [], instancesByProjectId: {}, sourceTasksByProjectId: {}, overridesByKey: {}, market: 'TR', mainMarket: 'OP',
}))
assert.deepEqual(Object.values(emptyBusiness), [[], []], 'unbound projection explicitly empties both machine business stages')
const projectStore = load(path.resolve('src/stores/project.ts')).useProjectStore
const planStore = load(path.resolve('src/stores/plan.ts')).usePlanStore
const mrStore = load(path.resolve('src/stores/mrVersionPlan.ts')).useMrVersionPlanStore
const linkedProject = { id: tosProjectId, name: 'tOS16.3', type: 'tOS版本项目', versionTypes: ['Full'], versionType: 'Full' }
const machineProject = { id: projectId, name: 'Machine', type: '整机产品项目', productType: '新品', firstSaleTosVersion: '16.3.0.100', markets: ['OP', 'TR'] }
const detachedMachine = { ...machineProject, id: 'detached-machine', firstSaleTosVersion: '' }
const readyTosProject = { ...linkedProject, id: 'ready-tos', name: 'tOS17.1' }
const readyMachine = { ...machineProject, id: 'ready-machine', firstSaleTosVersion: '17.1.0.100', markets: ['OP'] }
const shanghaiDate = load(path.resolve('src/lib/shanghaiBusinessDate.ts')).getShanghaiBusinessDate(new Date())
const relativeDate = days => new Date(Date.parse(`${shanghaiDate}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10)
const readyTasks = load(path.resolve('src/lib/level1PlanRules.ts')).buildMachineLevel1Tasks(false)
  .map(task => task.taskName === 'STR5' ? { ...task, planEndDate: relativeDate(-1) } : task)
const readyTosTasks = [
  { id: 'ready-launch', stableId: 'tos-stage-launch-iteration', parentId: null, taskName: '上市迭代阶段', nodeKind: 'stage' },
  { id: 'ready-source', stableId: 'ready-source', parentId: 'ready-launch', taskName: '17.1.0.120' },
]
const readyInstance = { projectId: readyTosProject.id, tosVersion: '17.1.0.120', sourceLevel1TaskId: 'ready-source',
  templateVersionId: 'template-1', activities, dates: { start: relativeDate(0), finish: relativeDate(1) } }
const scope = shared.getLevel1BusinessScopeKey(projectId, 'market', 'TR')
const detachedScope = shared.getLevel1BusinessScopeKey(detachedMachine.id, 'market', 'TR')
const events = { localStorage, addEventListener() {}, removeEventListener() {} }
const stop = load(path.resolve('src/hooks/useTosMrLevel1Sync.ts')).startTosMrLevel1Sync(events)
await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
projectStore.setState({ projects: [machineProject, linkedProject, detachedMachine, readyTosProject, readyMachine], marketConfigsByProjectId: { [projectId]: marketRows, [detachedMachine.id]: marketRows, [readyMachine.id]: [{ id: 'ready-op', market: 'OP', isMain: true, followsMain: false }] } })
planStore.setState({
  versions: [],
  publishedSnapshots: { [`project::${readyMachine.id}::OP::level1::ready-v1`]: readyTasks },
  marketVersionsByKey: { [`project::${readyMachine.id}::OP::level1::versions`]: [{ id: 'ready-v1', versionNo: 'V1', status: '已发布' }] },
  tosTypeVersionsByKey: {}, tosTypePlanDataByProjectId: {},
  level1BusinessTasksByScope: { [scope]: trBusiness, [detachedScope]: trBusiness,
    [shared.getLevel1BusinessScopeKey(readyTosProject.id, 'tos', 'Full')]: shared.captureLevel1BusinessTasks('tOS版本项目', readyTosTasks) },
})
mrStore.setState({
  machinePlansByKey: { [`${projectId}::16.3.0.2`]: plans.two, [`${detachedMachine.id}::16.3.0.2`]: { ...plans.two, projectId: detachedMachine.id } },
  tosInstancesByProjectId: { [tosProjectId]: [instances['16.3.0.2']], [readyTosProject.id]: [readyInstance] },
  marketOverridesByKey: Object.fromEntries([projectId, detachedMachine.id].map(id => [
    markets.getMrMarketOverrideKey(id, '16.3.0.2', 'TR'),
    { projectId: id, tosVersion: '16.3.0.2', market: 'TR', mainMarket: 'OP', dates: { start: '2027-01-09' } },
  ])),
  machineRowLocks: Object.fromEntries([projectId, detachedMachine.id].map(id => {
    const key = `${id}::${tosProjectId}::16.3.0.2`
    return [key, { key, projectId: id, tosProjectId, tosVersion: '16.3.0.2', lockedBy: 'tester', lockedAt: '2027-01-01' }]
  })),
})
await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
assert.equal(mrStore.getState().machinePlansByKey[`${projectId}::16.3.0.2`]?.tosVersion, '16.3.0.2', 'temporarily missing linked source keeps MR detail')
assert.deepEqual(planStore.getState().level1BusinessTasksByScope[scope], trBusiness, 'temporarily missing linked source keeps machine L1 children')
assert.ok(mrStore.getState().marketOverridesByKey[markets.getMrMarketOverrideKey(projectId, '16.3.0.2', 'TR')], 'pending machine market override survives reconciliation')
assert.ok(mrStore.getState().machineRowLocks[`${projectId}::${tosProjectId}::16.3.0.2`], 'pending machine lock survives reconciliation')
assert.equal(mrStore.getState().machinePlansByKey[`${detachedMachine.id}::16.3.0.2`], undefined, 'unbound machine MR is removed while another machine source is pending')
assert.equal(mrStore.getState().marketOverridesByKey[markets.getMrMarketOverrideKey(detachedMachine.id, '16.3.0.2', 'TR')], undefined, 'unbound machine market override is pruned')
assert.equal(mrStore.getState().machineRowLocks[`${detachedMachine.id}::${tosProjectId}::16.3.0.2`], undefined, 'unbound machine lock is pruned')
assert.deepEqual(planStore.getState().level1BusinessTasksByScope[detachedScope]['machine-stage-launch'], [], 'unbound machine L1 clears while another machine source is pending')
assert.ok(mrStore.getState().machinePlansByKey[`${readyMachine.id}::17.1.0.120`], 'ready machine MR is created while another machine source is pending')
mrStore.setState(state => ({ machinePlansByKey: { ...state.machinePlansByKey,
  [`${readyMachine.id}::17.1.0.120`]: { ...state.machinePlansByKey[`${readyMachine.id}::17.1.0.120`], dates: readyInstance.dates },
} }))
await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
const readyScope = shared.getLevel1BusinessScopeKey(readyMachine.id, 'market', 'OP')
const readySnapshotKey = `project::${readyMachine.id}::OP::level1::ready-v1`
const readyBusiness = planStore.getState().level1BusinessTasksByScope[readyScope]
const readyChild = readyBusiness['machine-stage-launch'][0]
assert.ok(readyChild)
const actualTasks = shared.applyLevel1BusinessTasks('整机产品项目', readyTasks, readyBusiness).map(task =>
  task.stableId === readyChild.stableId ? { ...task, actualStartDate: relativeDate(0), actualEndDate: relativeDate(1) } : task)
planStore.getState().setLevel1BusinessTasks(readyScope, '整机产品项目', actualTasks, readySnapshotKey)
await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
assert.equal(planStore.getState().level1BusinessTasksByScope[readyScope]['machine-stage-launch'][0].actualEndDate, relativeDate(1), 'global MR refresh retains actual dates after editing')
assert.equal(planStore.getState().publishedSnapshots[readySnapshotKey].find(task => task.stableId === readyChild.stableId).actualStartDate, relativeDate(0), 'latest published snapshot is updated')
const summary = load(path.resolve('src/lib/level1PlanRules.ts')).projectLevel1Plan(planStore.getState().publishedSnapshots[readySnapshotKey]).rows.find(task => task.stableId === 'machine-stage-launch')
assert.equal(summary.actualStartDate, relativeDate(0), 'stage start aggregates MR actual dates')
assert.equal(summary.actualEndDate, relativeDate(1), 'stage end aggregates MR actual dates')
const persistedActuals = JSON.parse(localStorage.getItem('pms-plan-store')).state.level1BusinessTasksByScope[readyScope]
assert.equal(persistedActuals['machine-stage-launch'][0].actualEndDate, relativeDate(1), 'actual dates survive persistence')
planStore.getState().setLevel1BusinessTasks(readyScope, '整机产品项目', actualTasks.map(task => task.stableId === readyChild.stableId ? { ...task, actualStartDate: '', actualEndDate: '' } : task), readySnapshotKey)
await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
assert.equal(planStore.getState().level1BusinessTasksByScope[readyScope]['machine-stage-launch'][0].actualEndDate, '', 'cleared actual dates are not restored by synchronization')
projectStore.setState({ projects: [machineProject] })
await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
assert.deepEqual(planStore.getState().level1BusinessTasksByScope[scope]['machine-stage-launch'], [], 'deleted tOS project clears launch children')
assert.deepEqual(planStore.getState().level1BusinessTasksByScope[scope]['machine-stage-lifecycle'], [], 'deleted tOS project clears lifecycle children')
assert.equal(mrStore.getState().machinePlansByKey[`${projectId}::16.3.0.2`], undefined, 'deleted source removes stale machine MR plan')
planStore.setState({ level1BusinessTasksByScope: { [scope]: trBusiness } })
mrStore.setState({ machinePlansByKey: { [`${projectId}::16.3.0.2`]: plans.two } })
projectStore.setState({ projects: [{ ...machineProject, firstSaleTosVersion: '' }, linkedProject] })
await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
assert.deepEqual(planStore.getState().level1BusinessTasksByScope[scope]['machine-stage-launch'], [], 'unlinked machine clears generated children')
assert.equal(mrStore.getState().machinePlansByKey[`${projectId}::16.3.0.2`], undefined, 'unlinked machine removes stale MR plan')
stop()
const jointSource = readFileSync(path.resolve('src/components/joint/JointMrVersionPlan.tsx'), 'utf8')
assert.match(jointSource, /selectActiveTosMrTasks\(\{[\s\S]*?sharedBusinessTasks: level1BusinessTasksByScope/, 'joint MR page resolves the same active tOS source as the global hook')
assert.match(jointSource, /reconcileMachinePlans\(\{[\s\S]*?preserveMachineProjectIds,/, 'joint MR page preserves pending machine plans during its own reconciliation')
assert.match(jointSource, /if \(!hydrated \|\| !sourcesHydrated\) return/, 'joint MR page waits for project and plan hydration')
console.log('PASS machine MR business phase, numeric sequence, market dates, source availability, stable identity')
