import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'

const root = process.cwd()
const require = createRequire(import.meta.url)
const sourcePath = path.join(root, 'src/lib/marketRules.ts')

if (!fs.existsSync(sourcePath)) {
  throw new Error('src/lib/marketRules.ts is missing')
}

const source = fs.readFileSync(sourcePath, 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
}).outputText

const sandbox = {
  exports: {},
  module: { exports: {} },
  require,
}
sandbox.exports = sandbox.module.exports
vm.runInNewContext(compiled, sandbox, { filename: sourcePath })

const {
  buildFollowVersionMetaForPublish,
  canChangeMainMarket,
  canCreateRevisionForMarket,
  cancelDraftRevision,
  formatFollowVersionSource,
  getMarketCurrentVersion,
  getMarketFollowVersionKey,
  getMarketPlanVersionKey,
  getMarketVersions,
  markTaskActualTimeDetachedFromMain,
  mergeFollowMarketActualDates,
  normalizeMarketRows,
  removeFollowVersionMetaForMarkets,
  setMarketCurrentVersion,
  setMarketVersions,
  syncFollowMarketPlans,
} = sandbox.module.exports

const normalized = normalizeMarketRows([
  { id: '1', market: 'OP', isMain: true, followsMain: true },
  { id: '2', market: 'RU', isMain: true, followsMain: true },
  { id: '3', market: 'RU', isMain: false, followsMain: true },
  { id: '4', market: '', isMain: false, followsMain: true },
])

assert.deepEqual(
  normalized.map(row => ({ market: row.market, isMain: row.isMain, followsMain: row.followsMain })),
  [
    { market: 'OP', isMain: true, followsMain: false },
    { market: 'RU', isMain: false, followsMain: true },
  ],
  'normalization should keep one main market, clear main follow flag, and remove duplicate/empty markets',
)

const changedMain = normalizeMarketRows([
  { id: '1', market: 'OP', isMain: false, followsMain: false },
  { id: '2', market: 'TR', isMain: true, followsMain: true },
  { id: '3', market: 'RU', isMain: false, followsMain: true },
], 'OP')

assert.deepEqual(
  changedMain.map(row => ({ market: row.market, isMain: row.isMain, followsMain: row.followsMain })),
  [
    { market: 'OP', isMain: false, followsMain: false },
    { market: 'TR', isMain: true, followsMain: false },
    { market: 'RU', isMain: false, followsMain: false },
  ],
  'changing main market should clear all follow-main selections',
)

assert.equal(canCreateRevisionForMarket(changedMain, 'RU', 'level1'), true)
assert.equal(canCreateRevisionForMarket(normalized, 'RU', 'level1'), true)
assert.equal(canCreateRevisionForMarket(normalized, 'RU', 'level2'), true)

const seedVersions = [
  { id: 'v1', versionNo: 'V1', status: '已发布' },
  { id: 'v2', versionNo: 'V2', status: '已发布' },
]
const marketVersionKeyOP = getMarketPlanVersionKey('project-1', 'OP')
const marketVersionKeyTR = getMarketPlanVersionKey('project-1', 'TR')
assert.notEqual(marketVersionKeyOP, marketVersionKeyTR, 'each market should have an isolated version-state key')

const marketVersionsAfterOpDraft = setMarketVersions({}, 'project-1', 'OP', seedVersions, [
  ...seedVersions,
  { id: 'v3', versionNo: 'V3', status: '修订中' },
])
assert.deepEqual(
  JSON.parse(JSON.stringify(getMarketVersions(marketVersionsAfterOpDraft, 'project-1', 'OP', seedVersions))),
  [
    { id: 'v1', versionNo: 'V1', status: '已发布' },
    { id: 'v2', versionNo: 'V2', status: '已发布' },
    { id: 'v3', versionNo: 'V3', status: '修订中' },
  ],
  'creating a revision in OP should update only OP version state',
)
assert.deepEqual(
  JSON.parse(JSON.stringify(getMarketVersions(marketVersionsAfterOpDraft, 'project-1', 'TR', seedVersions))),
  seedVersions,
  'creating a revision in OP should not change TR version state',
)

const marketCurrentAfterOpChange = setMarketCurrentVersion({}, 'project-1', 'OP', 'v3')
assert.equal(getMarketCurrentVersion(marketCurrentAfterOpChange, 'project-1', 'OP', marketVersionsAfterOpDraft[marketVersionKeyOP], 'v1'), 'v3')
assert.equal(getMarketCurrentVersion(marketCurrentAfterOpChange, 'project-1', 'TR', seedVersions, 'v3'), 'v2')

const versions = [
  { id: 'v1', versionNo: 'V1', status: '已发布' },
  { id: 'v2', versionNo: 'V2', status: '修订中' },
]
assert.equal(canChangeMainMarket(versions), false, 'draft version should block main-market changes')

const cancelled = cancelDraftRevision(versions, 'v2')
assert.deepEqual(
  JSON.parse(JSON.stringify(cancelled.versions)),
  [
    { id: 'v1', versionNo: 'V1', status: '已发布' },
    { id: 'v2', versionNo: 'V2', status: '已取消' },
  ],
)
assert.equal(cancelled.currentVersion, 'v1')
assert.equal(canChangeMainMarket(cancelled.versions), true)

const mainTasks = [
  { id: '1', taskName: 'main', planStartDate: '2026-01-01', actualStartDate: '2026-01-02', actualEndDate: '2026-01-05' },
  { id: '1.1', parentId: '1', taskName: 'STR1', planStartDate: '2026-02-01', actualStartDate: '', actualEndDate: '' },
]
const historicalFollowTasks = [
  { id: 'old-1', taskName: 'main', actualStartDate: '2025-12-29', actualEndDate: '2026-01-03' },
  { id: 'old-2', taskName: 'STR1', actualStartDate: '2026-02-08', actualEndDate: '2026-02-10' },
]
const mergedActualDates = mergeFollowMarketActualDates(mainTasks, historicalFollowTasks)

assert.deepEqual(
  JSON.parse(JSON.stringify(mergedActualDates.map(task => ({
    id: task.id,
    taskName: task.taskName,
    actualStartDate: task.actualStartDate,
    actualEndDate: task.actualEndDate,
    actualTimeDetachedFromMain: !!task.actualTimeDetachedFromMain,
  })))),
  [
    { id: '1', taskName: 'main', actualStartDate: '2026-01-02', actualEndDate: '2026-01-05', actualTimeDetachedFromMain: false },
    { id: '1.1', taskName: 'STR1', actualStartDate: '', actualEndDate: '', actualTimeDetachedFromMain: false },
  ],
  'follow-market actual dates should fully follow main market unless the row is detached',
)

const detachedFollowTasks = markTaskActualTimeDetachedFromMain(
  mergedActualDates,
  '1.1',
  { actualStartDate: '2026-02-08', actualEndDate: '2026-02-10' },
)
assert.deepEqual(
  JSON.parse(JSON.stringify(detachedFollowTasks.map(task => ({
    id: task.id,
    actualStartDate: task.actualStartDate,
    actualEndDate: task.actualEndDate,
    actualTimeDetachedFromMain: !!task.actualTimeDetachedFromMain,
  })))),
  [
    { id: '1', actualStartDate: '2026-01-02', actualEndDate: '2026-01-05', actualTimeDetachedFromMain: false },
    { id: '1.1', actualStartDate: '2026-02-08', actualEndDate: '2026-02-10', actualTimeDetachedFromMain: true },
  ],
  'editing a follow-market actual time should detach that task from main-market actual-time updates',
)

const mainTasksAfterActualChange = [
  { id: '1', taskName: 'main', planStartDate: '2026-01-01', actualStartDate: '2026-01-06', actualEndDate: '2026-01-09' },
  { id: '1.1', parentId: '1', taskName: 'STR1', planStartDate: '2026-02-01', actualStartDate: '2026-02-20', actualEndDate: '2026-02-21' },
]
const mergedAfterMainActualChange = mergeFollowMarketActualDates(mainTasksAfterActualChange, detachedFollowTasks)

assert.deepEqual(
  JSON.parse(JSON.stringify(mergedAfterMainActualChange.map(task => ({
    id: task.id,
    actualStartDate: task.actualStartDate,
    actualEndDate: task.actualEndDate,
    actualTimeDetachedFromMain: !!task.actualTimeDetachedFromMain,
  })))),
  [
    { id: '1', actualStartDate: '2026-01-06', actualEndDate: '2026-01-09', actualTimeDetachedFromMain: false },
    { id: '1.1', actualStartDate: '2026-02-08', actualEndDate: '2026-02-10', actualTimeDetachedFromMain: true },
  ],
  'main-market actual-time changes should update only non-detached follow-market rows',
)

const untouchedTasks = [{ id: '9', taskName: 'independent' }]
const synced = syncFollowMarketPlans(
  {
    OP: { tasks: mainTasksAfterActualChange, level2Tasks: [], createdLevel2Plans: [] },
    RU: { tasks: detachedFollowTasks, level2Tasks: [], createdLevel2Plans: [] },
    TR: { tasks: untouchedTasks, level2Tasks: [], createdLevel2Plans: [] },
  },
  normalized,
)

assert.deepEqual(JSON.parse(JSON.stringify(synced.RU.tasks)), JSON.parse(JSON.stringify(mergedAfterMainActualChange)))
assert.notEqual(synced.RU.tasks, mainTasksAfterActualChange, 'follow market should receive a cloned main-market task list')
assert.deepEqual(JSON.parse(JSON.stringify(synced.TR.tasks)), untouchedTasks, 'non-follow market should not be changed')

const followVersionMeta = buildFollowVersionMetaForPublish({
  projectId: 'project-1',
  rows: normalized,
  sourceMarket: 'OP',
  sourceVersionId: 'v4',
  sourceVersionNo: 'V4',
})
const ruFollowKey = getMarketFollowVersionKey('project-1', 'RU', 'v4')

assert.deepEqual(
  JSON.parse(JSON.stringify(followVersionMeta)),
  {
    [ruFollowKey]: {
      sourceMarket: 'OP',
      sourceVersionId: 'v4',
      sourceVersionNo: 'V4',
    },
  },
  'follow-published version metadata should record the source market and source version for follow markets only',
)
assert.equal(formatFollowVersionSource(followVersionMeta[ruFollowKey]), '跟随 OP V4')

const cleanedFollowMeta = removeFollowVersionMetaForMarkets(
  {
    ...followVersionMeta,
    [getMarketFollowVersionKey('project-1', 'TR', 'v4')]: {
      sourceMarket: 'OP',
      sourceVersionId: 'v4',
      sourceVersionNo: 'V4',
    },
    [getMarketFollowVersionKey('project-1', 'RU', 'v3')]: {
      sourceMarket: 'OP',
      sourceVersionId: 'v3',
      sourceVersionNo: 'V3',
    },
  },
  {
    projectId: 'project-1',
    markets: ['RU'],
    versionIds: ['v4'],
  },
)
assert.deepEqual(
  JSON.parse(JSON.stringify(cleanedFollowMeta)),
  {
    [getMarketFollowVersionKey('project-1', 'TR', 'v4')]: {
      sourceMarket: 'OP',
      sourceVersionId: 'v4',
      sourceVersionNo: 'V4',
    },
    [getMarketFollowVersionKey('project-1', 'RU', 'v3')]: {
      sourceMarket: 'OP',
      sourceVersionId: 'v3',
      sourceVersionNo: 'V3',
    },
  },
  'unfollowing a market should remove only the latest published follow tag for that market',
)

assert.deepEqual(
  JSON.parse(JSON.stringify(buildFollowVersionMetaForPublish({
    projectId: 'project-1',
    rows: normalized,
    sourceMarket: 'RU',
    sourceVersionId: 'v4',
    sourceVersionNo: 'V4',
  }))),
  {},
  'non-main market publish should not create follow-published metadata',
)

console.log('market/version rule checks passed')
