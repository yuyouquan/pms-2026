#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import vm from 'vm'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const ts = require('typescript')

const root = process.cwd()
const sourcePath = path.join(root, 'src/lib/planVersioning.ts')
const planStorePath = path.join(root, 'src/stores/plan.ts')

if (!fs.existsSync(sourcePath)) {
  console.error('Plan versioning helper is missing: src/lib/planVersioning.ts')
  process.exit(1)
}

const source = fs.readFileSync(sourcePath, 'utf8')
const planStoreSource = fs.readFileSync(planStorePath, 'utf8')
const planStoreVersion = Number(planStoreSource.match(/PLAN_STORE_VERSION\s*=\s*(\d+)/)?.[1])
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2019,
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
  getNextPlanRevisionVersionNo,
  getPlanVersionId,
  comparePlanVersions,
  getDisplayPlanVersionsForHorizontalPlan,
  getRevisionKindForLatestPublishedVersion,
} = sandbox.module.exports

const versions = (...items) => items.map((versionNo) => ({ versionNo, status: '已发布' }))
const cases = [
  { name: 'first gray version starts at V0.1', input: [], kind: 'gray', expected: 'V0.1' },
  { name: 'next gray before formal increments V0.x', input: versions('V0.1'), kind: 'gray', expected: 'V0.2' },
  { name: 'formal after gray versions starts at V1', input: versions('V0.1', 'V0.2'), kind: 'formal', expected: 'V1' },
  { name: 'gray after first formal becomes V1.1', input: versions('V0.1', 'V0.2', 'V1'), kind: 'gray', expected: 'V1.1' },
  { name: 'gray after V1.1 increments to V1.2', input: versions('V1', 'V1.1'), kind: 'gray', expected: 'V1.2' },
  { name: 'formal after V1.1 increments to V2', input: versions('V1', 'V1.1'), kind: 'formal', expected: 'V2' },
]

const failures = []
if (planStoreVersion !== 10) {
  failures.push(`plan persistence version should be V10: expected 10, got ${planStoreVersion}`)
}
for (const testCase of cases) {
  const actual = getNextPlanRevisionVersionNo(testCase.input, testCase.kind)
  if (actual !== testCase.expected) {
    failures.push(`${testCase.name}: expected ${testCase.expected}, got ${actual}`)
  }
}

if (getPlanVersionId('V1.1') !== 'v1.1') {
  failures.push(`getPlanVersionId should keep the dotted version id: expected v1.1, got ${getPlanVersionId('V1.1')}`)
}

const sorted = versions('V1.1', 'V1', 'V0.2', 'V2').sort(comparePlanVersions).map(v => v.versionNo).join(',')
if (sorted !== 'V0.2,V1,V1.1,V2') {
  failures.push(`comparePlanVersions should sort dotted versions numerically: got ${sorted}`)
}

const displayCases = [
  {
    name: 'horizontal view shows gray versions before any formal release',
    input: versions('V0.1', 'V0.2'),
    expected: 'V0.1,V0.2',
  },
  {
    name: 'horizontal view hides V0 gray versions after V1 formal release',
    input: versions('V0.1', 'V0.2', 'V1', 'V1.1'),
    expected: 'V1,V1.1',
  },
  {
    name: 'horizontal view keeps formal history and only latest formal gray versions',
    input: versions('V0.1', 'V0.2', 'V1', 'V1.1', 'V1.2', 'V2', 'V2.1', 'V2.2'),
    expected: 'V1,V2,V2.1,V2.2',
  },
]

for (const testCase of displayCases) {
  const actual = getDisplayPlanVersionsForHorizontalPlan(testCase.input)
    .map(version => version.versionNo)
    .join(',')
  if (actual !== testCase.expected) {
    failures.push(`${testCase.name}: expected ${testCase.expected}, got ${actual}`)
  }
}

const revisionKindCases = [
  {
    name: 'latest formal published version creates formal follow revision',
    input: versions('V1', 'V2'),
    expected: 'formal',
  },
  {
    name: 'latest gray published version creates gray follow revision',
    input: versions('V1', 'V1.1'),
    expected: 'gray',
  },
  {
    name: 'latest pre-formal gray published version creates gray follow revision',
    input: versions('V0.1', 'V0.2'),
    expected: 'gray',
  },
  {
    name: 'canceled latest-looking version is ignored',
    input: [{ versionNo: 'V1', status: '已发布' }, { versionNo: 'V1.1', status: '已取消' }],
    expected: 'formal',
  },
]

for (const testCase of revisionKindCases) {
  const actual = getRevisionKindForLatestPublishedVersion(testCase.input)
  if (actual !== testCase.expected) {
    failures.push(`${testCase.name}: expected ${testCase.expected}, got ${actual}`)
  }
}

if (failures.length) {
  console.error('Plan versioning verification failed:')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('Plan versioning verification passed.')
