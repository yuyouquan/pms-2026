import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'

// This historical filename is retained by the full-regression runner. The current
// approved contract exposes an authorized permission center after configuration.
const load = createTypeScriptModuleLoader()
const navigation = load(path.resolve('src/components/permission-center/navigation.ts'))
const { createEmptyMenuPolicy } = load(path.resolve('src/lib/permissionCenter.ts'))
const permissions = load(path.resolve('src/stores/permission.ts'))
const { canEnterProjectSpace } = load(path.resolve('src/lib/projectListFilters.ts'))
const appShell = fs.readFileSync('src/containers/AppShell.tsx', 'utf8')
const homePage = fs.readFileSync('src/app/page.tsx', 'utf8')
const globalContainer = fs.readFileSync('src/containers/GlobalPermissionContainer.tsx', 'utf8')
const entries = navigation.PERMISSION_MAIN_NAV
const configIndex = entries.findIndex(entry => entry.key === 'config')
assert.ok(configIndex >= 0, 'configuration remains a main navigation destination')
assert.deepEqual(entries[configIndex + 1], { key: 'globalPermission', label: '权限中心' }, 'permission center immediately follows configuration')
assert.equal(entries.filter(entry => entry.key === 'globalPermission').length, 1, 'permission center has one main entry')
assert.match(appShell, /items=\{PERMISSION_MAIN_NAV\.filter\(item => canAccessMainModule\(permissionCenter, currentLoginUser, item\.key\)\)\}/, 'header filters the shared menu catalog by live authorization')

const source = ts.createSourceFile('page.tsx', homePage, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const rendered = []
const visit = node => {
  if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === 'GlobalPermissionContainer') rendered.push(node)
  ts.forEachChild(node, visit)
}
visit(source)
assert.equal(rendered.length, 1, 'Home renders one permission-center branch')
const ancestors = []
for (let node = rendered[0].parent; node; node = node.parent) ancestors.push(node)
const gatedBy = text => ancestors.some(node => ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && node.left.getText(source) === text)
assert.ok(gatedBy("activeModule === 'globalPermission'"), 'permission-center rendering requires its active module')
assert.ok(gatedBy('permissionReady && canAccessActiveModule'), 'permission-center rendering is nested inside the ready and authorized module boundary')
assert.match(homePage, /<ProjectSpaceAccessBoundary>[\s\S]*?<ProjectSpaceContainer[\s\S]*?<\/ProjectSpaceAccessBoundary>/, 'project space retains its independent access boundary')
assert.match(globalContainer, /<PermissionCenter\s/, 'global route mounts the guarded permission-center implementation')
assert.doesNotMatch(globalContainer, /GlobalPermissionConfig/, 'legacy unguarded global editor is not rendered')

const manager = '演示用户02'
const policy = { ...createEmptyMenuPolicy('ordinary-manager', 'permission.center'), actions: ['view', 'manage'] }
const model = {
  version: 2,
  groups: [{ id: 'group', name: '普通角色' }],
  roles: [{ id: 'ordinary-manager', groupId: 'group', name: '权限管理员', description: '', members: [manager], departments: [] }],
  policies: [policy],
}
assert.equal(navigation.canAccessMainModule(undefined, manager, 'globalPermission'), false, 'uninitialized authorization fails closed')
assert.equal(navigation.canAccessMainModule(model, 'outsider', 'globalPermission'), false, 'unassigned users have no permission-center entry')
assert.equal(navigation.canAccessMainModule({ ...model, policies: [{ ...policy, actions: ['view'] }] }, manager, 'globalPermission'), false, 'view alone cannot enter the permission administration surface')
assert.equal(navigation.canAccessMainModule(model, manager, 'globalPermission'), true, 'explicit manage grant permits the center')
assert.equal(navigation.canAccessMainModule({ ...model, policies: [] }, manager, 'globalPermission'), false, 'revoking the grant removes access immediately')

const store = permissions.usePermissionStore
const previous = store.getState()
try {
  const rolesByProject = { scoped: [{ name: '项目经理', members: ['project-only'] }] }
  store.setState({ permissionCenter: model, rolesByProject, rolePermissionsByProject: { scoped: { 项目经理: { 'basicInfo:编辑': true } } } })
  assert.equal(permissions.isGlobalAdmin(manager), false, 'ordinary permission management does not confer superadministrator status')
  assert.equal(permissions.hasPermission(manager, 'scoped', 'basicInfo:编辑'), false, 'permission-center management does not grant project editing')
  assert.equal(canEnterProjectSpace('scoped', manager, rolesByProject, permissions.isGlobalAdmin(manager)), false, 'permission-center management does not grant project membership')
  assert.equal(permissions.hasPermission('project-only', 'scoped', 'basicInfo:编辑'), true, 'existing project-scoped editing remains available to its assigned member')
  assert.equal(navigation.canAccessMainModule(model, 'project-only', 'globalPermission'), false, 'project editing does not grant global permission management')
} finally {
  store.setState(previous, true)
}
console.log('Authorized permission-center entry and independent project-space permissions passed')
