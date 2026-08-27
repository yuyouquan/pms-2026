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

const { getProjectStatusEnumType, mapIpmProjectStatus } = statusModule.exports
assert.equal(getProjectStatusEnumType('整机产品项目'), 'machine-project-status')
assert.equal(getProjectStatusEnumType('技术项目'), 'technical-project-status')
assert.equal(getProjectStatusEnumType('tOS版本项目'), 'tos-capability-project-status')
assert.equal(getProjectStatusEnumType('能力建设项目'), 'tos-capability-project-status')
assert.equal(mapIpmProjectStatus('暂停', 'tOS版本项目'), '暂停')
assert.equal(mapIpmProjectStatus('已取消', 'tOS版本项目'), '已取消')
assert.equal(mapIpmProjectStatus('进行中', 'tOS版本项目'), '在研')
assert.equal(mapIpmProjectStatus('已完成', 'tOS版本项目'), '已完成')
assert.equal(mapIpmProjectStatus('维护期', 'tOS版本项目'), '已完成')

const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8')
const externalPool = read('src/data/externalProjectPool.ts')
const projectInfoModal = read('src/components/project-info/ProjectInfoModal.tsx')
const addProjectModal = read('src/components/workspace/AddProjectModal.tsx')
const projectList = read('src/containers/ProjectListContainer.tsx')
const projectSpace = read('src/containers/ProjectSpaceContainer.tsx')

assert.match(externalPool, /ipmStatus\?: string/)
assert.match(projectInfoModal, /mapIpmProjectStatus\(entry\.ipmStatus/)
assert.match(projectInfoModal, /getProjectStatusEnumType/)
assert.match(projectInfoModal, /buildEnumOptions/)
assert.match(projectInfoModal, /useEnumHydration/)
assert.match(addProjectModal, /status: payload\.projectStatus/)
assert.match(projectList, /getProjectStatusEnumType/)
assert.match(projectList, /useSingleEnumOptions/)
assert.match(projectList, /['"]全部['"]/)
assert.match(projectSpace, /getProjectStatusEnumType/)
assert.match(projectSpace, /buildEnumOptions/)

const statusSource = read('src/lib/projectStatus.ts')
const projectTypesSource = read('src/constants/projectTypes.ts')
assert.doesNotMatch(statusSource, /TOS_PROJECT_STATUS_(?:VALUES|OPTIONS)/)
assert.doesNotMatch(projectTypesSource, /PROJECT_STATUS_VALUES/)
for (const [label, source] of [
  ['project info modal', projectInfoModal],
  ['project list', projectList],
  ['project space', projectSpace],
]) {
  assert.doesNotMatch(source, /TOS_PROJECT_STATUS_OPTIONS/, `${label} still uses the legacy status array`)
}

console.log('tOS project status verification passed.')
