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
const categoryTasks = [{ id: 'category-task' }]
assert.deepEqual(
  JSON.parse(JSON.stringify(getTemplateTasksForProjectType({ '整机产品项目': oldTasks }, '整机-手机'))),
  oldTasks,
  'a machine secondary category resolves the current shared category task key',
)
assert.deepEqual(
  JSON.parse(JSON.stringify(getTemplateTasksForProjectType({
    '整机产品项目': oldTasks,
    '整机-手机': categoryTasks,
  }, '整机-平板'))),
  oldTasks,
  'machine templates are intentionally shared by the current project category',
)

const legacySnapshotKey = 'template::整机产品项目::level1::v1'
assert.deepEqual(
  JSON.parse(JSON.stringify(getTemplateSnapshotReadKeys('整机-笔电', 'v1', 'level1'))),
  [legacySnapshotKey, legacySnapshotKey],
  'machine snapshot reads retain the shared category key for every secondary category',
)
assert.deepEqual(
  JSON.parse(JSON.stringify(getTemplateSnapshotForProjectType({ [legacySnapshotKey]: oldTasks }, '整机-手机', 'v1', 'level1'))),
  oldTasks,
  'a machine secondary category reads a category-keyed snapshot',
)
assert.deepEqual(
  JSON.parse(JSON.stringify(getTemplateSnapshotForProjectType({
    [legacySnapshotKey]: oldTasks,
  }, '整机-平板', 'v1', 'level1'))),
  oldTasks,
  'the shared category snapshot remains authoritative for machine secondary categories',
)

console.log('Project template compatibility verification passed.')
