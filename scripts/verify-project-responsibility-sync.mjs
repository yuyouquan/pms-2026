import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const helperPath = path.join(root, 'src/lib/projectResponsibility.ts')

if (!fs.existsSync(helperPath)) {
  throw new Error('Missing src/lib/projectResponsibility.ts')
}

const source = fs.readFileSync(helperPath, 'utf8')
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const loadedModule = { exports: {} }
new Function('module', 'exports', output)(loadedModule, loadedModule.exports)

const {
  getProjectResponsiblePersons,
  haveProjectResponsiblePersonsChanged,
  mergeResponsiblePersonsIntoVisibleMembers,
  replaceProjectSystemAdministrators,
} = loadedModule.exports

assert.deepEqual(
  getProjectResponsiblePersons({ leader: '王五', responsiblePersons: ['李四', '赵六'] }),
  ['李四', '赵六'],
  'project-owned responsible persons should be authoritative',
)
assert.deepEqual(
  getProjectResponsiblePersons({ leader: '王五' }),
  ['王五'],
  'legacy seed projects should initialize responsibility from leader',
)
assert.equal(
  haveProjectResponsiblePersonsChanged(['李四', '赵六'], ['李四', '赵六']),
  false,
  'saving unrelated fields must not be treated as a responsibility change',
)
assert.equal(
  haveProjectResponsiblePersonsChanged(['李四', '赵六'], ['赵六', '李四']),
  true,
  'responsibility order is meaningful because the first person is the project leader',
)
assert.deepEqual(
  mergeResponsiblePersonsIntoVisibleMembers(['普通成员', '旧责任人'], ['新责任人']),
  ['普通成员', '旧责任人', '新责任人'],
  'changing responsibility must preserve ordinary visible members',
)

const projectRoles = [
  { name: '系统管理员', members: ['旧责任人'], isFixed: true },
  { name: '项目经理', members: ['普通成员'], isFixed: true },
]
const nextRoles = replaceProjectSystemAdministrators(projectRoles, ['新责任人'])
assert.deepEqual(nextRoles[0].members, ['新责任人'])
assert.equal(nextRoles[1], projectRoles[1], 'unrelated roles must remain untouched')

const projectInfoValuesSource = fs.readFileSync(path.join(root, 'src/lib/projectInfoValues.ts'), 'utf8')
assert.match(
  projectInfoValuesSource,
  /DIRECT_ROOT_KEYS\s*=\s*\[[\s\S]*?'versionType'/,
  'versionType stored in fieldValues must also be written to the compatible root field',
)

console.log('Project responsibility and versionType compatibility verification passed.')
