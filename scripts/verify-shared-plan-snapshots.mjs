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
for (const [projectType, projectId] of [['整机产品项目', '1'], ['tOS版本项目', '19']]) {
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
assert.equal(share.resolveSharedLevel1Plan(planStore, { project: projectStore.projects.find(item => item.id === '2'), level: 'level1' }).ok, false, 'a fresh demo project without persisted published snapshots displays an empty state')

const source = readSource(root, 'src/app/share/plan/page.tsx')
assert.match(source, /usePlanStore/, 'share page subscribes to live persisted plan state')
assert.match(source, /resolveSharedLevel1Plan/, 'share page uses the tested project-scoped resolver')
assert.doesNotMatch(source, /\b(?:VERSION_DATA|LEVEL1_TASKS)\b/, 'share page has no standalone demo tasks or version history')
assert.match(source, /versions=\{\[latestVersion\]\}/, 'legacy horizontal renderer receives only the real latest version and cannot synthesize older dates')
assert.match(source, /pms-main-content/, 'share route uses shared responsive page padding')
assert.match(source, /pms-page-shell/, 'share route applies shared native-table styles')
assert.match(source, /其他浏览器不会同步本地修改/, 'local mock sharing limitation is visible to recipients')
console.log('Shared plan snapshot verification passed')
