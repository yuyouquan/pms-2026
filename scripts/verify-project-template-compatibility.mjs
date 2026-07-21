import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const read = filename => readFileSync(filename, 'utf8')
const transpile = filename => ts.transpileModule(read(filename), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText

const projectTypesModule = { exports: {} }
vm.runInNewContext(transpile('src/constants/projectTypes.ts'), {
  module: projectTypesModule,
  exports: projectTypesModule.exports,
}, { filename: 'src/constants/projectTypes.ts' })

const compatibilityModule = { exports: {} }
vm.runInNewContext(transpile('src/lib/projectTemplateCompatibility.ts'), {
  module: compatibilityModule,
  exports: compatibilityModule.exports,
  require: id => {
    if (id === '@/constants/projectTypes') return projectTypesModule.exports
    throw new Error(`Unexpected module: ${id}`)
  },
}, { filename: 'src/lib/projectTemplateCompatibility.ts' })

const {
  getTemplateSnapshotForProjectType,
  getTemplateSnapshotReadKeys,
  getTemplateTasksForProjectType,
} = compatibilityModule.exports

const oldTasks = [{ id: 'legacy-task' }]
const canonicalTasks = [{ id: 'canonical-task' }]
assert.deepEqual(
  JSON.parse(JSON.stringify(getTemplateTasksForProjectType({ '整机产品项目': oldTasks }, '整机产品-手机'))),
  oldTasks,
  'a canonical phone project must still load tasks stored under the legacy machine key',
)
assert.deepEqual(
  JSON.parse(JSON.stringify(getTemplateTasksForProjectType({
    '整机产品项目': oldTasks,
    '整机产品-手机': canonicalTasks,
  }, '整机产品-PAD'))),
  canonicalTasks,
  'the canonical machine-family task key must win over the legacy key',
)

const legacySnapshotKey = 'template::整机产品项目::level1::v1'
const canonicalSnapshotKey = 'template::整机产品-手机::level1::v1'
assert.deepEqual(
  JSON.parse(JSON.stringify(getTemplateSnapshotReadKeys('整机产品-笔电', 'v1', 'level1'))),
  [canonicalSnapshotKey, legacySnapshotKey],
  'machine snapshot reads must try canonical then legacy keys',
)
assert.deepEqual(
  JSON.parse(JSON.stringify(getTemplateSnapshotForProjectType({ [legacySnapshotKey]: oldTasks }, '整机产品-手机', 'v1', 'level1'))),
  oldTasks,
  'a canonical phone project must still load a snapshot stored under the legacy machine key',
)
assert.deepEqual(
  JSON.parse(JSON.stringify(getTemplateSnapshotForProjectType({
    [legacySnapshotKey]: oldTasks,
    [canonicalSnapshotKey]: canonicalTasks,
  }, '整机产品-PAD', 'v1', 'level1'))),
  canonicalTasks,
  'the canonical machine-family snapshot key must win over the legacy key',
)

console.log('Project template compatibility verification passed.')
