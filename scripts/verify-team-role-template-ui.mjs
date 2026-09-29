import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const element = (type, props, key) => ({ type, props: props ?? {}, key })
let hooks = [], cursor = 0
const react = {
  Fragment: 'Fragment',
  useState(initial) { const slot = cursor++; if (!(slot in hooks)) hooks[slot] = typeof initial === 'function' ? initial() : initial; return [hooks[slot], next => { hooks[slot] = typeof next === 'function' ? next(hooks[slot]) : next }] },
  useRef(initial) { const slot = cursor++; return hooks[slot] ??= { current: initial } },
  useEffect() { cursor++ }, useCallback(fn) { cursor++; return fn }, useMemo(fn) { cursor++; return fn() },
}
const style = { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) }
const ant = Object.fromEntries(['Alert', 'Button', 'Card', 'Empty', 'Form', 'Input', 'Modal', 'Space', 'Table', 'Tag', 'Tooltip', 'Tree', 'Tabs'].map(name => [name, name]))
ant.message = { error() {} }
ant.Modal = Object.assign(() => null, { confirm: options => { confirmDialog = options } })
let confirmDialog
const icons = new Proxy({}, { get: (_, key) => key })
const nodes = root => !root || typeof root !== 'object' ? [] : [root, ...[root.props?.children].flat(Infinity).flatMap(nodes)]
const find = (tree, type) => nodes(tree).find(node => node.type === type)
const all = (tree, type) => nodes(tree).filter(node => node.type === type)
function load(file, modules) {
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', output)(name => {
    if (name === 'react') return react
    if (name === 'react/jsx-runtime') return { jsx: element, jsxs: element }
    if (name === 'antd') return ant
    if (name === '@ant-design/icons') return icons
    if (name.endsWith('.module.css')) return style
    assert(name in modules, `unmocked ${name}`)
    return modules[name]
  }, module, module.exports)
  return module.exports.default
}
const use = value => Object.assign(selector => selector ? selector(value) : value, { getState: () => value })
let actor = '演示用户01', manage = true, token = 'scope:source-1', writes = []
const session = { currentLoginUser: actor, selectedProject: { id: 'project-1' } }
const local = { name: 'SPM', groupName: '自定义角色', members: ['演示用户02'], departments: ['研发部'], isFixed: false }
const source = { id: 'source-spm', source: 'ipm', sourceRoleName: 'SPM', roleName: 'SPM', ipmRoleCode: 'RJPM', pmsRoleCode: 'SPM', templateId: 'seed', grants: { 'basicInfo:查看': true } }
const permission = use({ rolesByProject: { 'project-1': [local] }, rolePermissionsByProject: { 'project-1': { SPM: { 'basicInfo:查看': false } } }, toggleProjectRolePermissions(...args) { writes.push(args); return { ok: true } }, setProjectRoleAssignees(...args) { writes.push(args); return { ok: true } } })
const project = { id: 'project-1', type: '整机产品项目', projectAttribute: 'formal' }
const projectStore = use(session)
const ProjectPage = load('src/components/permission/ProjectPermissionConfig.tsx', {
  '@/components/shared/CollapsibleWorkspace': { CollapsibleSidebarShell: 'Sidebar' },
  '@/components/permission-center/RoleForm': { __esModule: true, default: 'RoleForm' },
  '@/components/permission/ProjectRoleAssignees': { __esModule: true, default: 'Assignees' },
  '@/components/permission/ProjectTeamMembers': { __esModule: true, default: 'Members' },
  '@/components/permission/ProjectFunctionalPermissions': { __esModule: true, default: 'Functional' },
  '@/components/permission/projectPermissionCatalog': { getProjectPermissionCatalog: () => [{ id: 'basic', label: '基础信息', rows: [{ id: 'basic', label: '基本信息', actions: [{ key: 'basicInfo:查看', label: '查看' }] }] }] },
  '@/lib/projectTeamMutationGuard': { projectTeamScopeToken: () => token },
  '@/stores/permission': { usePermissionStore: permission, hasPermission: () => manage },
  '@/stores/rolePermissionTemplates': { useSyncedProjectRoles: () => [source], getSyncedProjectRoles: () => [source] },
  '@/stores/project': { useProjectStore: projectStore },
  '@/stores/ui': { useUiStore: Object.assign(selector => selector({ setPermissionCenterHasDraft() {} }), { getState: () => ({ navigateWithEditGuard(action) { action() } }) }) },
})
const projectRender = () => { cursor = 0; return ProjectPage({ project, projectId: project.id, actor: '演示用户01' }) }
let page = projectRender()
const tree = find(page, 'Tree')
assert.equal(tree.props.treeData.length, 2, 'source and local roles appear in one flat list')
assert(tree.props.treeData.every(node => node.isLeaf && !node.children), 'project roles have no group wrappers')
assert.notEqual(tree.props.treeData[0].key, tree.props.treeData[1].key, 'source/local same-name identities stay separate')
assert.equal(find(tree.props.treeData[0].title, 'Tag'), undefined, 'source label is removed from the list')
assert.equal(find(tree.props.treeData[0].title, 'UserOutlined'), undefined, 'synced role has no custom role icon')
assert(find(tree.props.treeData[1].title, 'UserOutlined'), 'local role has a leading custom role icon')
assert.equal(find(page, 'Tabs').props.activeKey, 'functional', 'first tab is functional')
assert.deepEqual(find(page, 'Functional').props.grants, source.grants)
const staleActorHandler = find(page, 'Functional').props.onChange
session.currentLoginUser = '演示用户02'
staleActorHandler('basicInfo:查看', false)
assert.equal(writes.length, 0, 'captured actor cannot mutate after account switch')
session.currentLoginUser = '演示用户01'
token = 'scope:source-2'
staleActorHandler('basicInfo:查看', false)
assert.equal(writes.length, 0, 'captured source cannot mutate after source rebinding')
token = 'scope:source-1'
find(projectRender(), 'Tree').props.onSelect([tree.props.treeData[1].key])
page = projectRender()
assert.equal(find(page, 'Tabs').props.activeKey, 'functional', 'switching role resets functional tab')
assert.equal(find(page, 'Functional').props.grants['basicInfo:查看'], false)
find(page, 'Functional').props.onBulkChange(['basicInfo:查看'], true)
assert.deepEqual(writes.at(-1)[2], { source: 'local', name: 'SPM' })
find(page, 'Tabs').props.onChange('assignees')
page = projectRender()
const writesBeforeRebind = writes.length
token = 'scope:source-2'
page = projectRender()
assert.equal(find(page, 'Assignees').props.onCommit('departments', ['市场部']).ok, false, 'rerendered open picker retains opening source authority')
assert.equal(writes.length, writesBeforeRebind)
token = 'scope:source-1'
page = projectRender()
all(page, 'Button').find(button => button.props.children === '编辑').props.onClick()
assert(find(projectRender(), 'RoleForm'), 'local role form opened')
assert.equal(find(projectRender(), 'RoleForm').props.showGroup, false, 'project role editing hides group selection')
token = 'scope:source-2'
page = projectRender()
assert.equal(find(page, 'RoleForm').props.onSubmit({ name: 'SPM-2', groupName: '自定义角色', description: '' }).ok, false, 'rerendered role form retains opening source authority')
assert.equal(writes.length, writesBeforeRebind)
token = 'scope:source-1'
find(projectRender(), 'Tabs').props.onChange('functional')
manage = false
page = projectRender()
assert.equal(find(page, 'Functional').props.disabled, true)
assert.equal(all(page, 'Button').some(button => button.props.children === '添加角色'), false)
find(page, 'Tabs').props.onChange('assignees')
page = projectRender()
assert.equal(find(page, 'Assignees').props.disabled, true)

hooks = []; cursor = 0
ant.Form = Object.assign(() => null, { useForm: () => [{ submit() {}, setFieldValue() {} }], Item: 'Form.Item' })
const RoleForm = load('src/components/permission-center/RoleForm.tsx', {
  '@/lib/permissionCenter': { normalizePermissionName: name => name.trim().toLocaleLowerCase() },
})
const formModel = { version: 2, groups: [{ id: 'group-1', name: '已有分类' }], roles: [{ id: 'local-1', groupId: 'group-1', name: '已有角色', description: '' }], policies: [] }
let submitted
const formRender = options => { cursor = 0; return RoleForm({ model: formModel, onSubmit: input => { submitted = input; return { ok: true } }, onDirty() {}, onClose() {}, ...options }) }
let formPage = formRender({ showGroup: false })
assert.equal(all(formPage, 'Form.Item').some(node => node.props.name === 'groupName'), false, 'project add dialog only asks for role fields')
find(formPage, ant.Form).props.onFinish({ name: '新角色', description: '查看范围' })
assert.deepEqual(submitted, { name: '新角色', description: '查看范围', groupName: '自定义角色' }, 'group-free submission supplies compatible project metadata')
formPage = formRender({ showGroup: false, role: formModel.roles[0] })
find(formPage, ant.Form).props.onFinish({ name: '更名角色', description: '' })
assert.equal(submitted.groupName, '已有分类', 'editing preserves stored metadata without displaying groups')
const roleNameField = all(formPage, 'Form.Item').find(node => node.props.name === 'name')
assert.equal(roleNameField.props.rules[0].required, true, 'role name stays required')
formPage = formRender({ showGroup: false })
await assert.rejects(all(formPage, 'Form.Item').find(node => node.props.name === 'name').props.rules[1].validator(null, '已有角色'), /不能重复/)
assert(all(formRender({}), 'Form.Item').some(node => node.props.name === 'groupName' && node.props.rules[0].required), 'global permission center keeps required grouping')
console.log('PASS flat project roles: source/local identity, custom icon, group-free create/edit and global grouping preservation')

hooks = []; cursor = 0
let templateWrites = []
const template = { id: 'template-1', roleName: 'SPM', pmsRoleCode: 'SPM', ipmRoleCode: 'RJPM', grants: { 'basicInfo:查看': true } }
const templateState = { templatesByType: { '整机产品项目': [template] }, updateTemplateGrants(...args) { templateWrites.push(args); return { ok: true } }, createTemplate(...args) { templateWrites.push(args); return { ok: true } }, updateTemplate(...args) { templateWrites.push(args); return { ok: true } }, deleteTemplate(...args) { templateWrites.push(args); return { ok: true } } }
const TemplatePage = load('src/components/permission/RolePermissionTemplateConfig.tsx', {
  '@/components/permission/ProjectFunctionalPermissions': { __esModule: true, default: 'Functional' },
  '@/lib/globalMenuPermissions': { canRunGlobalMenuAction: (opening, _menu, action) => opening === actor && (action === 'view' || manage) },
  '@/stores/rolePermissionTemplates': { useRolePermissionTemplateStore: use(templateState) },
})
manage = true
const templateRender = () => { cursor = 0; return TemplatePage({ actor: '演示用户01', projectType: '整机产品项目' }) }
let rendered = templateRender()
assert.deepEqual(find(rendered, 'Table').props.columns.map(column => column.title), ['角色名称', 'PMS角色编码', 'IPM角色编码', '操作'])
const actionCell = find(rendered, 'Table').props.columns[3].render(null, template)
find(actionCell, 'Button').props.onClick()
rendered = templateRender()
assert.equal(find(rendered, 'Functional').props.grants, template.grants, 'template modal reuses project permission matrix')
assert(all(rendered, ant.Modal).some(modal => modal.props.open && modal.props.title.includes('整机产品项目')), 'template permission title keeps project type visible')
const captured = find(rendered, 'Functional').props.onBulkChange
actor = '演示用户02'
captured(['basicInfo:查看'], false)
assert.equal(templateWrites.length, 0, 'old template modal handler cannot save after actor switch')
actor = '演示用户01'
captured(['basicInfo:查看'], false)
assert.deepEqual(templateWrites.at(-1).slice(1, 4), ['整机产品项目', template.id, ['basicInfo:查看']])
console.log('PASS team/template actual handlers: source/local identity, first tab, role switch, readonly, stale actor/source, template modal and bulk write')
