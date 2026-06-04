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
  getMarketFollowVersionKey,
  normalizeMarketRows,
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
assert.equal(canCreateRevisionForMarket(normalized, 'RU', 'level1'), false)
assert.equal(canCreateRevisionForMarket(normalized, 'RU', 'level2'), true)

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

const mainTasks = [{ id: '1', taskName: 'main', planStartDate: '2026-01-01' }]
const untouchedTasks = [{ id: '9', taskName: 'independent' }]
const synced = syncFollowMarketPlans(
  {
    OP: { tasks: mainTasks, level2Tasks: [], createdLevel2Plans: [] },
    RU: { tasks: [{ id: 'old', taskName: 'old' }], level2Tasks: [], createdLevel2Plans: [] },
    TR: { tasks: untouchedTasks, level2Tasks: [], createdLevel2Plans: [] },
  },
  normalized,
)

assert.deepEqual(JSON.parse(JSON.stringify(synced.RU.tasks)), mainTasks)
assert.notEqual(synced.RU.tasks, mainTasks, 'follow market should receive a cloned main-market task list')
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
