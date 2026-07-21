import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'

const root = process.cwd()
const require = createRequire(import.meta.url)
const sourcePath = path.join(root, 'src/lib/tosTypeRules.ts')

if (!fs.existsSync(sourcePath)) {
  throw new Error('src/lib/tosTypeRules.ts is missing')
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
  TOS_TYPE_OPTIONS,
  buildTosTypeRows,
  createTosTypePlanEntry,
  ensureTosTypePlanDataForRows,
  getMainTosType,
  getTosTypePlanSourceType,
  getTosTypeSummaryGroups,
  getTosTypeCurrentVersion,
  getTosTypeSnapshotKey,
  getTosTypeVersionKey,
  getTosTypeVersions,
  normalizeTosTypeRows,
  isFollowTosType,
  isTosTypeLevel1ReadOnly,
  setTosTypeCurrentVersion,
  setTosTypeVersions,
} = sandbox.module.exports

const plain = value => JSON.parse(JSON.stringify(value))

assert.deepEqual(plain(TOS_TYPE_OPTIONS), ['Full', 'Slim', 'PAD', 'GO'])

assert.deepEqual(
  plain(buildTosTypeRows([], 'Slim')),
  [{ id: 'tos-type-Slim', type: 'Slim', isMain: true, followsMain: false }],
  'an existing scalar version type should become the only main type',
)

assert.deepEqual(
  plain(buildTosTypeRows(['Full', 'Slim'], 'Slim')),
  [
    { id: 'tos-type-Full', type: 'Full', isMain: false, followsMain: false },
    { id: 'tos-type-Slim', type: 'Slim', isMain: true, followsMain: false },
  ],
  'the scalar compatibility field should remain the main type when reconstructing rows',
)

assert.deepEqual(
  plain(buildTosTypeRows([], 'invalid')),
  [{ id: 'tos-type-Full', type: 'Full', isMain: true, followsMain: false }],
  'missing or invalid project data should default to Full',
)

const normalized = normalizeTosTypeRows([
  { id: '1', type: 'Full', isMain: false },
  { id: '2', type: 'Slim', isMain: true },
  { id: '3', type: 'Slim', isMain: false },
  { id: '4', type: 'INVALID', isMain: true },
])
assert.deepEqual(
  plain(normalized),
  [
    { id: '1', type: 'Full', isMain: false, followsMain: false },
    { id: '2', type: 'Slim', isMain: true, followsMain: false },
  ],
  'normalization should remove invalid and duplicate rows while preserving one main type',
)
assert.equal(getMainTosType(normalized), 'Slim')

const followRows = normalizeTosTypeRows([
  { id: 'full', type: 'Full', isMain: true, followsMain: false },
  { id: 'go', type: 'GO', isMain: false, followsMain: true },
  { id: 'pad', type: 'PAD', isMain: false, followsMain: false },
])
assert.deepEqual(
  plain(followRows),
  [
    { id: 'full', type: 'Full', isMain: true, followsMain: false },
    { id: 'go', type: 'GO', isMain: false, followsMain: true },
    { id: 'pad', type: 'PAD', isMain: false, followsMain: false },
  ],
  'normalization should preserve main-follow flags',
)
assert.deepEqual(
  plain(normalizeTosTypeRows([
    { id: 'full', type: 'Full', isMain: true, followsMain: true },
    { id: 'go', type: 'GO', isMain: false, followsMain: true },
  ])),
  [
    { id: 'full', type: 'Full', isMain: true, followsMain: false },
    { id: 'go', type: 'GO', isMain: false, followsMain: true },
  ],
  'a main type cannot follow itself',
)
assert.equal(isFollowTosType(followRows, 'GO'), true)
assert.equal(isFollowTosType(followRows, 'PAD'), false)
assert.equal(getTosTypePlanSourceType(followRows, 'GO', 'level1'), 'Full')
assert.equal(getTosTypePlanSourceType(followRows, 'GO', 'level2'), 'GO')
assert.equal(isTosTypeLevel1ReadOnly(followRows, 'GO', 'level1'), true)
assert.equal(isTosTypeLevel1ReadOnly(followRows, 'GO', 'level2'), false)
assert.deepEqual(
  plain(getTosTypeSummaryGroups(followRows)),
  [
    { key: 'Full', label: 'Full&GO', sourceType: 'Full', memberTypes: ['Full', 'GO'] },
    { key: 'PAD', label: 'PAD', sourceType: 'PAD', memberTypes: ['PAD'] },
  ],
)
assert.deepEqual(
  plain(getTosTypeSummaryGroups(normalizeTosTypeRows([
    { id: 'pad', type: 'PAD', isMain: false, followsMain: false },
    { id: 'full', type: 'Full', isMain: true, followsMain: false },
    { id: 'go', type: 'GO', isMain: false, followsMain: true },
  ]))),
  [
    { key: 'PAD', label: 'PAD', sourceType: 'PAD', memberTypes: ['PAD'] },
    { key: 'Full', label: 'Full&GO', sourceType: 'Full', memberTypes: ['Full', 'GO'] },
  ],
  'summary groups should preserve configured type order',
)
assert.deepEqual(
  plain(getTosTypeSummaryGroups(normalizeTosTypeRows([
    { id: 'full', type: 'Full', isMain: false, followsMain: true },
    { id: 'go', type: 'GO', isMain: true, followsMain: false },
  ]))),
  [
    { key: 'GO', label: 'Full&GO', sourceType: 'GO', memberTypes: ['Full', 'GO'] },
  ],
  'the merged label must preserve configured order even when the main type is not first',
)

const changedMainRows = normalizeTosTypeRows([
  { id: 'full', type: 'Full', isMain: false, followsMain: true },
  { id: 'pad', type: 'PAD', isMain: true, followsMain: false },
], 'Full')
assert.deepEqual(
  plain(changedMainRows),
  [
    { id: 'full', type: 'Full', isMain: false, followsMain: false },
    { id: 'pad', type: 'PAD', isMain: true, followsMain: false },
  ],
  'changing the main type should clear every follow relationship',
)

const seed = createTosTypePlanEntry({
  level1Tasks: [{ id: '1', taskName: 'STR1' }],
  level2PlanTasks: [{ id: '1', planId: 'plan0', taskName: '需求' }],
  level2PlanMilestones: ['STR1'],
  createdLevel2Plans: [{ id: 'plan0', name: '需求开发计划', type: '需求开发计划', fixed: true }],
  activeLevel2Plan: 'plan0',
  level2PlanMeta: {},
  versionTrainRecords: [{ id: 'train-1', versionNo: '16.3.030' }],
})
const data = ensureTosTypePlanDataForRows({}, 'project-1', normalized, seed)
assert.notEqual(data['project-1'].Full, data['project-1'].Slim)
assert.notEqual(data['project-1'].Full.level1Tasks, data['project-1'].Slim.level1Tasks)
assert.notEqual(data['project-1'].Full.versionTrainRecords, data['project-1'].Slim.versionTrainRecords)
data['project-1'].Full.level1Tasks[0].taskName = 'Full STR1'
data['project-1'].Full.versionTrainRecords[0].versionNo = 'Full-16.3.030'
assert.equal(data['project-1'].Slim.level1Tasks[0].taskName, 'STR1')
assert.equal(data['project-1'].Slim.versionTrainRecords[0].versionNo, '16.3.030')

const historical = ensureTosTypePlanDataForRows(data, 'project-1', normalized, seed)
assert.equal(historical['project-1'].Full.level1Tasks[0].taskName, 'Full STR1', 'existing hidden data should be preserved when a type is re-added')

assert.equal(
  getTosTypeVersionKey('project-1', 'Full', 'level1'),
  'project::project-1::tos-type::Full::level1::versions',
)
assert.equal(
  getTosTypeSnapshotKey('project-1', 'Full', 'level2', 'v3'),
  'project::project-1::tos-type::Full::level2::v3::snapshot',
)

const fallbackVersions = [
  { id: 'v1', versionNo: 'V1', status: '已发布' },
  { id: 'v2', versionNo: 'V2', status: '已发布' },
]
const versionsState = setTosTypeVersions({}, 'project-1', 'Full', 'level1', fallbackVersions, previous => [
  ...previous,
  { id: 'v3', versionNo: 'V3', status: '修订中' },
])
assert.equal(getTosTypeVersions(versionsState, 'project-1', 'Full', 'level1', fallbackVersions).length, 3)
assert.equal(getTosTypeVersions(versionsState, 'project-1', 'Slim', 'level1', fallbackVersions).length, 2)

const currentState = setTosTypeCurrentVersion({}, 'project-1', 'Full', 'level1', 'v3')
assert.equal(
  getTosTypeCurrentVersion(currentState, 'project-1', 'Full', 'level1', versionsState[getTosTypeVersionKey('project-1', 'Full', 'level1')], 'v1'),
  'v3',
)
assert.equal(
  getTosTypeCurrentVersion(currentState, 'project-1', 'Slim', 'level1', fallbackVersions, 'missing'),
  'v2',
  'an invalid selection should fall back to the latest published version',
)

console.log('tOS type rules verification passed.')
