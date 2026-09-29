import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
const load = createTypeScriptModuleLoader(), get = file => load(path.resolve(file))
const guard = get('src/lib/projectTeamMutationGuard.ts')
assert.equal(typeof guard.canImportTechnicalRevision, 'function', 'technical import needs a narrow live operation gate')
const { useProjectStore } = get('src/stores/project.ts')
const { useProjectTeamStore } = get('src/stores/projectTeam.ts')
const { usePermissionStore, getSyncedProjectRoles } = get('src/stores/permission.ts')
const { useTechnicalPlanStore, getTechnicalPlanKey } = get('src/stores/technicalPlan.ts')
const actor = '演示用户10', project = { ...useProjectStore.getState().projects.find(row => row.id === '9'), technicalLead: actor, fieldValues: { technicalLead: [actor] } }
useProjectStore.setState({ currentLoginUser: actor, selectedProject: project })
useProjectTeamStore.getState().syncProjects([project])
const role = getSyncedProjectRoles(project.id).find(row => row.ipmRoleCode === 'RD')
const toggle = enabled => usePermissionStore.getState().toggleProjectRolePermissions('演示用户01', project.id, { source: 'ipm', id: role.id }, ['plan:导入'], enabled)
const scope = { kind: 'tdt', parentProjectId: project.id }, key = getTechnicalPlanKey(scope)
const version = { id: 'import-draft', versionNo: 'V1', status: '修订中', tasks: [] }
useTechnicalPlanStore.setState({ plansByKey: { [key]: { scope, currentVersionId: version.id, versions: [version] } } })
const token = guard.projectTeamScopeToken(project.id)
const can = () => guard.canImportTechnicalRevision(actor, project.id, scope, version.id, token)
assert.equal(can(), false)
assert.equal(toggle(true).ok, true)
assert.equal(can(), true, 'source import grant plus canonical technical responsibility plus draft permits import')
assert.equal(guard.canExecuteProjectTeamWrite(actor, project.id, useProjectStore.getState()), false, 'import grant never enables broad L1 writes')
useProjectStore.setState({ selectedProject: { ...project, fieldValues: { technicalLead: ['演示用户11'] } } })
assert.equal(can(), false, 'missing canonical responsibility denies despite grant')
const missingLead = { ...project, fieldValues: {} }
delete missingLead.technicalLead
useProjectStore.setState({ selectedProject: missingLead })
assert.equal(usePermissionStore.getState().setProjectRoleAssignees('演示用户01', project.id, '技术项目负责人', { users: [actor], departments: [] }).ok, true)
assert.equal(can(), false, 'editable local lead role cannot replace absent canonical responsibility for source member')
useProjectStore.setState({ selectedProject: { ...missingLead, fieldValues: { technicalLead: [] } } })
assert.equal(can(), false, 'cleared canonical lead cannot fall back to local role')
useProjectStore.setState({ selectedProject: project })
useTechnicalPlanStore.setState({ plansByKey: { [key]: { scope, currentVersionId: version.id, versions: [{ ...version, status: '已发布' }] } } })
assert.equal(can(), false, 'published version cannot be imported')
useTechnicalPlanStore.setState({ plansByKey: { [key]: { scope, currentVersionId: version.id, versions: [version] } } })
assert.equal(toggle(false).ok, true)
assert.equal(can(), false, 'permission revoke during async file read denies commit')
console.log('PASS narrow technical import source grant, responsibility, draft and late revoke')

// Execute the production async file handler against the real parser and plan store.
const fs = await import('node:fs'), vm = await import('node:vm'), ts = await import('typescript'), XLSX = await import('xlsx')
const text = fs.readFileSync('src/components/technical-project/TechnicalPlanModule.tsx', 'utf8')
const ast = ts.createSourceFile('component.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
let expression
function visit(node) { if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'importWorkbook') expression = node.initializer; ts.forEachChild(node, visit) }
visit(ast)
assert(expression)
const worksheet = XLSX.utils.json_to_sheet([{ ID: 'imported', 任务名称: '导入任务', 计划开始: '2026-10-01', 计划完成: '2026-10-02' }])
const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, worksheet, '计划')
const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
const { parseTechnicalPlanImportRows } = get('src/lib/technicalPlanWorkspace.ts')
const { validateTechnicalTemplateDepth } = get('src/lib/technicalPlanRules.ts')
const env = {
  currentVersion: version, activeKey: `${project.id}:tdt`, activeKeyRef: { current: `${project.id}:tdt` }, currentLoginUser: actor, projectId: project.id,
  scope, sourceScopeToken: token, canImportCurrentRevision: true, canImportTechnicalRevision: guard.canImportTechnicalRevision,
  tasks: [], templateTasks: [], tab: { templateKind: 'tdt' }, maxDepth: 2, XLSX, parseTechnicalPlanImportRows, validateTechnicalTemplateDepth,
  updateCurrentTasks: useTechnicalPlanStore.getState().updateCurrentTasks, message: { success() {}, error() {} },
}
const handler = vm.runInNewContext(ts.transpileModule(`(${expression.getText(ast)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, env)
assert.equal(toggle(true).ok, true)
await handler({ arrayBuffer: async () => bytes })
assert.equal(useTechnicalPlanStore.getState().plansByKey[key].versions[0].tasks[0].taskName, '导入任务', 'real import handler saves parsed tasks')
const beforeImport = JSON.stringify(useTechnicalPlanStore.getState().plansByKey)
let resume
const inFlight = handler({ arrayBuffer: () => new Promise(resolve => { resume = resolve }) })
assert.equal(toggle(false).ok, true)
resume(bytes)
await inFlight
assert.equal(JSON.stringify(useTechnicalPlanStore.getState().plansByKey), beforeImport, 'revoked asynchronous handler leaves real plan unchanged')
console.log('PASS production technical import handler and async source revoke')
