import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'

const root = process.cwd()
const statusModulePath = path.join(root, 'src/lib/projectStatus.ts')

assert.equal(fs.existsSync(statusModulePath), true, 'tOS project status module must exist')

const compiled = ts.transpileModule(fs.readFileSync(statusModulePath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const statusModule = { exports: {} }
vm.runInNewContext(compiled, { module: statusModule, exports: statusModule.exports }, { filename: statusModulePath })

const { mapIpmProjectStatus, TOS_PROJECT_STATUS_OPTIONS } = statusModule.exports
assert.equal(mapIpmProjectStatus('暂停', 'tOS版本项目'), '暂停')
assert.equal(mapIpmProjectStatus('已取消', 'tOS版本项目'), '已取消')
assert.equal(mapIpmProjectStatus('进行中', 'tOS版本项目'), '在研')
assert.equal(mapIpmProjectStatus('已完成', 'tOS版本项目'), '已完成')
assert.equal(mapIpmProjectStatus('维护期', 'tOS版本项目'), '已完成')
assert.deepEqual(
  Array.from(TOS_PROJECT_STATUS_OPTIONS, option => option.value),
  ['在研', '已完成', '暂停', '已取消'],
)

const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8')
const externalPool = read('src/data/externalProjectPool.ts')
const projectInfoModal = read('src/components/project-info/ProjectInfoModal.tsx')
const addProjectModal = read('src/components/workspace/AddProjectModal.tsx')
const projectList = read('src/containers/ProjectListContainer.tsx')
const projectSpace = read('src/containers/ProjectSpaceContainer.tsx')

assert.match(externalPool, /ipmStatus\?: string/)
assert.match(projectInfoModal, /mapIpmProjectStatus\(entry\.ipmStatus/)
assert.match(projectInfoModal, /label="项目状态"[\s\S]{0,220}TOS_PROJECT_STATUS_OPTIONS/)
assert.match(addProjectModal, /status: payload\.projectStatus/)
assert.match(projectList, /projectTypeFilter === PROJECT_TYPE_TOS_VERSION[\s\S]{0,260}TOS_PROJECT_LIST_STATUS_OPTIONS/)
assert.match(projectSpace, /p\.type === PROJECT_TYPE_TOS_VERSION \? TOS_PROJECT_STATUS_OPTIONS/)

console.log('tOS project status verification passed.')
