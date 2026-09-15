#!/usr/bin/env node
import assert from 'node:assert/strict'
import { loadTypeScriptModule, projectRoot, readSource } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const storage = new Map()
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: key => storage.delete(key),
}
const share = loadTypeScriptModule(root, 'src/lib/sharePlan.ts')
const market = loadTypeScriptModule(root, 'src/lib/marketRules.ts')
const tos = loadTypeScriptModule(root, 'src/lib/tosTypeRules.ts')
const projectMocks = loadTypeScriptModule(root, 'src/data/projectListPlanMocks.ts')
const published = { id: 'v10', versionNo: 'V10', status: '已发布' }
const versions = [
  { id: 'v9', versionNo: 'V9', status: '已发布' },
  published,
  { id: 'v11', versionNo: 'V11', status: '修订中' },
]
const task = name => ({ id: '1', taskName: name, planEndDate: '2026-09-07', actualEndDate: '2026-09-08', custom: { value: name } })
const machine = { id: 'machine-a', type: '整机产品项目', markets: ['OP', 'RU'] }
const state = {
  versions,
  marketVersionsByKey: { [market.getMarketPlanVersionKey(machine.id, 'OP')]: versions },
  tosTypeVersionsByKey: {},
  publishedSnapshots: {
    [market.getProjectMarketSnapshotKey(machine.id, 'OP', 'v10')]: [task('OP published')],
    [market.getProjectMarketSnapshotKey(machine.id, 'OP', 'v11')]: [task('OP private draft')],
    [market.getProjectMarketSnapshotKey(machine.id, 'RU', 'v10')]: [task('RU published')],
  },
}
const resolve = options => share.resolveSharedLevel1Plan(state, { project: machine, level: 'level1', ...options })
const op = resolve({ scopeValue: 'OP' })
assert.equal(op.ok, true)
assert.equal(op.version.id, 'v10', 'latest published selection uses semantic version ordering and excludes drafts')
assert.deepEqual(op.tasks, [task('OP published')], 'shared tasks and both date fields come from the persisted published snapshot')
assert.deepEqual(resolve({ scopeValue: 'RU' }).tasks, [task('RU published')], 'markets retain different published plans')
assert.equal(resolve({ project: { ...machine, id: 'machine-b' } }).ok, false, 'another project cannot borrow same-market snapshots')
assert.equal(resolve({ scopeValue: 'EU' }).ok, false, 'unconfigured market links do not select a default market silently')
assert.equal(resolve({ level: 'level2' }).ok, false, 'unsupported L2 links never show a fabricated L1 plan')
assert.equal(resolve({ project: { id: 'technical', type: '技术项目' } }).ok, false, 'technical projects require their dedicated scope-safe share resolver')
op.tasks[0].custom.value = 'consumer change'
assert.equal(resolve({ scopeValue: 'OP' }).tasks[0].custom.value, 'OP published', 'public consumers receive detached snapshot tasks')
const withoutLatest = structuredClone(state)
delete withoutLatest.publishedSnapshots[market.getProjectMarketSnapshotKey(machine.id, 'OP', 'v10')]
withoutLatest.publishedSnapshots[market.getProjectMarketSnapshotKey(machine.id, 'OP', 'v9')] = [task('old snapshot')]
assert.equal(share.resolveSharedLevel1Plan(withoutLatest, { project: machine, level: 'level1' }).ok, false, 'missing latest snapshot never falls back to old data or draft tasks')

const tosProject = { id: 'tos-a', type: 'tOS版本项目', versionTypes: ['Full', 'Slim'], versionType: 'Full' }
const tosTypeRows = [
  { id: 'full', type: 'Full', isMain: true, followsMain: false },
  { id: 'slim', type: 'Slim', isMain: false, followsMain: true },
]
state.tosTypeVersionsByKey[tos.getTosTypeVersionKey(tosProject.id, 'Full', 'level1')] = versions
state.publishedSnapshots[tos.getTosTypeSnapshotKey(tosProject.id, 'Full', 'level1', 'v10')] = [task('Full published')]
const slim = share.resolveSharedLevel1Plan(state, { project: tosProject, level: 'level1', scopeValue: 'Slim', tosTypeRows })
assert.equal(slim.ok, true)
assert.deepEqual(slim.tasks, [task('Full published')], 'a following tOS type shares its configured main-type published snapshot')
assert.equal(slim.scope.value, 'Slim')
assert.equal(slim.scope.sourceValue, 'Full')

const ordinary = { id: 'capability-a', type: '能力建设项目' }
state.publishedSnapshots[projectMocks.getProjectLevel1MockSnapshotKey(ordinary.id, 'v10')] = [task('Capability published')]
assert.deepEqual(share.resolveSharedLevel1Plan(state, { project: ordinary, level: 'level1' }).tasks, [task('Capability published')], 'ordinary projects also resolve their own published snapshots')
assert.equal(share.resolveSharedLevel1Plan({ ...state, versions: [{ id: 'v11', versionNo: 'V11', status: '修订中' }] }, { project: ordinary, level: 'level1' }).ok, false, 'a draft-only project has no public share')

const projectStore = loadTypeScriptModule(root, 'src/stores/project.ts').useProjectStore.getState()
const planStore = loadTypeScriptModule(root, 'src/stores/plan.ts').usePlanStore.getState()
for (const [projectType, projectId] of [['整机产品项目', '1'], ['tOS版本项目', '19'], ['tOS版本项目', '2']]) {
  const project = projectStore.projects.find(item => item.id === projectId && item.type === projectType)
  assert.ok(project, `${projectType} seed exists`)
  const shared = share.resolveSharedLevel1Plan(planStore, {
    project, level: 'level1',
    marketRows: projectStore.marketConfigsByProjectId[project.id],
    tosTypeRows: projectStore.tosTypeConfigsByProjectId[project.id],
  })
  assert.equal(shared.ok, true, `${projectType} default seeded published share remains available`)
  assert.ok(shared.tasks.length > 0)
  assert.equal(shared.version.status, '已发布')
}
// Project 2 now has a canonical resource/plan fixture. Explicitly remove only
// its published snapshots to exercise missing-data behavior independently.
const withoutProjectSnapshots = {
  ...planStore,
  publishedSnapshots: Object.fromEntries(Object.entries(planStore.publishedSnapshots).filter(([key]) => !key.startsWith('project::2::'))),
}
assert.equal(share.resolveSharedLevel1Plan(withoutProjectSnapshots, { project: projectStore.projects.find(item => item.id === '2'), level: 'level1' }).ok, false, 'a project without its published snapshots displays an empty state and never borrows another project or template')

const shareView = loadTypeScriptModule(root, 'src/lib/sharedPlanView.ts')
assert.deepEqual(shareView.SHARED_LEVEL1_COLUMNS.map(column => column.title), ['序号', '阶段/节点', '计划开始时间', '计划完成时间', '预估工期', '实际开始时间', '实际完成时间', '实际工期', '是否延期'], 'shared list and Gantt expose the current nine core fields')
assert.equal(shareView.SHARED_LEVEL1_COLUMNS[0].hideable, false, 'sequence remains mandatory')
assert.equal(shareView.SHARED_LEVEL1_COLUMNS[1].hideable, false, 'task name remains mandatory')
assert.equal(shareView.getSharedLevel1Columns(true)[1].title, '阶段/里程碑节点', 'ordinary shares retain their project-list name label')
assert.equal(shareView.getSharedLevel1Columns(true)[6].title, '实际结束时间', 'ordinary shares retain their project-list actual end label')
const snapshotTasks = [
  { id: 'stage-stable', order: 1, taskName: '概念阶段', nodeKind: 'stage' },
  { id: 'node-stable', parentId: 'stage-stable', order: 1, taskName: '概念启动', nodeKind: 'fixed-milestone', planEndDate: '2026-01-15', actualEndDate: '2026-01-16' },
]
const originalSnapshot = JSON.stringify(snapshotTasks)
const view = shareView.buildSharedLevel1View(snapshotTasks)
assert.equal(JSON.stringify(snapshotTasks), originalSnapshot, 'share projections do not modify the published snapshot')
assert.deepEqual(view.rows.map(row => row.id), ['1', '1.1'], 'stable storage IDs never appear as sequence numbers')
assert.equal(view.rows[1].planStartDate, '', 'fixed milestones retain an empty start date')
assert.equal(view.rows[1].estimatedDays, null, 'fixed milestones do not invent durations')
assert.equal(view.rows[1].delayStatus, '延期')
assert.ok(view.ganttTasks.every(task => task.readonly), 'every shared Gantt node is readonly')
assert.deepEqual(view.ganttTasks.map(task => task.planGridValues), view.rows, 'shared Gantt displays the exact table values')
for (const empty of [null, undefined, '']) assert.equal(shareView.formatSharedPlanCell('estimatedDays', empty), '-', 'missing durations never produce a bare day unit')
assert.equal(shareView.formatSharedPlanCell('actualDays', 0), '0天', 'zero remains distinct from missing duration')
assert.deepEqual(shareView.buildSharedLevel1View(snapshotTasks, false, '概念启动').rows.map(row => row.id), ['1', '1.1'], 'search retains the matched milestone and its parent')

const source = readSource(root, 'src/app/share/plan/page.tsx')
assert.match(source, /usePlanStore/, 'share page subscribes to live persisted plan state')
assert.match(source, /resolveSharedLevel1Plan/, 'share page uses the tested project-scoped resolver')
assert.doesNotMatch(source, /\b(?:VERSION_DATA|LEVEL1_TASKS)\b/, 'share page has no standalone demo tasks or version history')
assert.match(source, /versions=\{\[latestVersion\]\}/, 'legacy horizontal renderer receives only the real latest version and cannot synthesize older dates')
assert.match(source, /pms-main-content/, 'share route uses shared responsive page padding')
assert.match(source, /pms-page-shell/, 'share route applies shared native-table styles')
assert.match(source, /其他浏览器不会同步本地修改/, 'local mock sharing limitation is visible to recipients')
assert.doesNotMatch(source, /<TaskTable\b|<GanttChart\b|<DatePicker\b|<ActualDateCell\b|setTasks=/, 'share route never renders editable legacy plan components')
assert.match(source, /<DHTMLXGantt[\s\S]*?readOnly[\s\S]*?allowLightbox=\{false\}[\s\S]*?allowStandaloneUpdate=\{false\}/, 'share Gantt blocks lightbox, dragging and standalone updates')
assert.match(source, /dataSource=\{sharedView.rows\}/, 'the readonly table renders projected snapshot rows')
assert.match(source, /tasks=\{sharedView.ganttTasks\}/, 'Gantt receives the same readonly snapshot projection')
console.log('Shared plan snapshot verification passed')
