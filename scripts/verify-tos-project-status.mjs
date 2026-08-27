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

const { getProjectStatusEnumType, mapIpmProjectStatus, resolveConfiguredProjectStatus } = statusModule.exports
assert.equal(getProjectStatusEnumType('整机产品项目'), 'machine-project-status')
assert.equal(getProjectStatusEnumType('技术项目'), 'technical-project-status')
assert.equal(getProjectStatusEnumType('tOS版本项目'), 'tos-capability-project-status')
assert.equal(getProjectStatusEnumType('能力建设项目'), 'tos-capability-project-status')
assert.equal(mapIpmProjectStatus('暂停', 'tOS版本项目'), '暂停')
assert.equal(mapIpmProjectStatus('已取消', 'tOS版本项目'), '已取消')
assert.equal(mapIpmProjectStatus('进行中', 'tOS版本项目'), '在研')
assert.equal(mapIpmProjectStatus('已完成', 'tOS版本项目'), '已完成')
assert.equal(mapIpmProjectStatus('维护期', 'tOS版本项目'), '已完成')
assert.equal(typeof resolveConfiguredProjectStatus, 'function', 'configured status submission resolver must exist')
assert.equal(resolveConfiguredProjectStatus({
  projectType: 'tOS版本项目',
  configuredValues: ['规划中', '在研'],
  ipmStatus: '进行中',
}), '在研', 'tOS create keeps the existing IPM status synchronization when it is live')
assert.equal(resolveConfiguredProjectStatus({
  projectType: '能力建设项目',
  configuredValues: ['规划中', '在研'],
  ipmStatus: '进行中',
}), '规划中', 'capability create chooses the first live configured status instead of a hard-coded default')
assert.equal(resolveConfiguredProjectStatus({
  projectType: '能力建设项目',
  configuredValues: ['规划中', '在研'],
  submittedStatus: '规划中',
}), '规划中', 'capability create submission preserves a live selected status')
assert.equal(resolveConfiguredProjectStatus({
  projectType: '能力建设项目',
  configuredValues: ['规划中', '在研'],
  submittedStatus: '待立项',
}), '', 'capability create submission rejects a stale hard-coded status')

const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8')
const externalPool = read('src/data/externalProjectPool.ts')
const projectInfoModal = read('src/components/project-info/ProjectInfoModal.tsx')
const addProjectModal = read('src/components/workspace/AddProjectModal.tsx')
const projectList = read('src/containers/ProjectListContainer.tsx')
const projectSpace = read('src/containers/ProjectSpaceContainer.tsx')

assert.match(externalPool, /ipmStatus\?: string/)
assert.match(projectInfoModal, /resolveConfiguredProjectStatus\([\s\S]*ipmStatus:\s*entry\.ipmStatus/)
assert.match(projectInfoModal, /getProjectStatusEnumType/)
assert.match(projectInfoModal, /buildEnumOptions/)
assert.match(projectInfoModal, /useEnumHydration/)
assert.match(projectInfoModal, /projectType === PROJECT_CATEGORY_CAPABILITY/, 'capability create/edit renders the configured status selector')
assert.match(projectInfoModal, /resolveConfiguredProjectStatus/, 'project submission uses the runtime configured-status boundary')
assert.doesNotMatch(projectInfoModal, /CREATE_FORM_DEFAULTS[^}]*status:\s*'待立项'/s, 'project create no longer injects the stale status default')
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
