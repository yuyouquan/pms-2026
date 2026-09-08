import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'
import { loadTypeScriptModule } from './lib/source-contract.mjs'

const root = process.cwd()
const { useTransferStore } = loadTypeScriptModule(root, 'src/stores/transfer.ts')
const mock = loadTypeScriptModule(root, 'src/mock/transfer-maintenance.ts')
const jsx = (type, props) => ({ type, props: props || {} })
const source = fs.readFileSync(path.join(root, 'src/components/transfer/TransferModule.tsx'), 'utf8')
const output = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
const module = { exports: {} }
const requireModule = name => {
  if (name === 'react') return { Fragment: 'Fragment', useEffect: () => {} }
  if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' }
  if (name === 'antd') return new Proxy({ message: { warning() {}, success() {}, error() {} } }, { get: (target, key) => target[key] || key })
  if (name === '@ant-design/icons') return new Proxy({}, { get: (_, key) => key })
  if (name.includes('CollapsibleWorkspace')) return { ConfigWorkspaceShell: 'ConfigWorkspaceShell' }
  if (name.startsWith('@/')) return loadTypeScriptModule(root, `src/${name.slice(2)}.ts`)
  throw new Error(name)
}
vm.runInThisContext(`(function(require,module,exports){${output}\n})`)(requireModule, module, module.exports)
const components = module.exports
const allNodes = element => !element || typeof element !== 'object' ? [] : [element, ...[element.props?.children, element.props?.footer].flat(Infinity).flatMap(allNodes)]
const button = (tree, label) => allNodes(tree).find(node => node.type === 'Button' && node.props.children === label)
const propsFor = (app, user = '演示用户01') => {
  const props = { ...useTransferStore.getState(), selectedProject: { id: app.projectId, name: app.projectName }, currentUser: { id: `login-${user}`, name: user }, canApplyTransfer: true, canViewTransfer: true, setProjectSpaceModule() {} }
  for (const key of Object.keys(useTransferStore.getState()).filter(key => key !== 'currentUser')) Object.defineProperty(props, key, { get: () => useTransferStore.getState()[key], configurable: true })
  useTransferStore.getState().setSelectedTransferAppId(app.id)
  return props
}
const initial = useTransferStore.getState()
const failures = []
function check(name, fn) { try { useTransferStore.setState(initial, true); fn(); console.log(`PASS ${name}`) } catch (error) { failures.push(name); console.error(`FAIL ${name}: ${error.message}`) } }

check('unauthorized actor cannot save a stale entry dialog', () => {
  const app = mock.MOCK_TRANSFER_APPLICATIONS[0]
  const props = propsFor(app)
  const item = props.tmChecklistItems.find(item => item.responsibleRole === 'SPM')
  props.setTmEntryModalRecord({ ...item, _tab: 'checklist', _actorId: 'login-演示用户01' })
  props.setTmEntryContent('unauthorized overwrite')
  props.setTmEntryModalOpen(true)
  props.currentUser = { id: 'login-演示用户03', name: '演示用户03' }
  button(components.TransferEntry(props), '确认提交')?.props.onClick()
  assert.notEqual(props.tmChecklistItems.find(row => row.id === item.id).entryContent, 'unauthorized overwrite')
})
check('application change closes and clears pending record', () => {
  const store = useTransferStore.getState()
  store.setSelectedTransferAppId('ta001'); store.setTransferView('entry')
  store.setTmEntryModalRecord({ id: 'old', applicationId: 'ta001' }); store.setTmEntryModalOpen(true)
  store.setSelectedTransferAppId('ta002')
  assert.equal(useTransferStore.getState().tmEntryModalOpen, false)
  assert.equal(useTransferStore.getState().tmEntryModalRecord, null)
})
check('apply permission is checked at submit', () => {
  const props = propsFor(mock.MOCK_TRANSFER_APPLICATIONS[0]); props.canApplyTransfer = false
  props.setTmApplyDate('2026-09-09'); const count = props.transferApplications.length
  button(components.TransferApply(props), '提交申请')?.props.onClick()
  assert.equal(props.transferApplications.length, count)
})
check('new application contains its own template rows with team assignment', () => {
  const props = propsFor(mock.MOCK_TRANSFER_APPLICATIONS[0])
  props.setTmApplyDate('2026-09-09'); props.setTmApplyTeam(mock.MOCK_TM_TEAMS.TEAM_2)
  button(components.TransferApply(props), '提交申请')?.props.onClick()
  const app = props.transferApplications[0]
  assert.ok(props.tmChecklistItems.some(row => row.applicationId === app.id))
  const item = props.tmChecklistItems.find(row => row.applicationId === app.id && row.responsibleRole === 'SPM')
  assert.equal(item.entryPersonId, mock.MOCK_TM_TEAMS.TEAM_2.research.find(member => member.role === 'SPM').id)
})
check('SQA confirmation updates the application pipeline', () => {
  const app = { ...mock.MOCK_TRANSFER_APPLICATIONS[0], pipeline: { ...mock.MOCK_TRANSFER_APPLICATIONS[0].pipeline, dataEntry: 'success', maintenanceReview: 'success', sqaReview: 'in_progress' } }
  const props = propsFor(app, '演示用户07'); props.setTransferApplications([app]); props.setTmSqaModalOpen(true)
  const modal = allNodes(components.TransferSqaReview(props)).find(node => node.type === 'Modal')
  modal?.props.onOk()
  assert.equal(props.transferApplications[0].pipeline.sqaReview, 'success')
  assert.equal(props.transferApplications[0].pipeline.infoChange, 'in_progress')
})
check('another application record and current project mismatch cannot be submitted', () => {
  const props = propsFor(mock.MOCK_TRANSFER_APPLICATIONS[1])
  const oldItem = props.tmChecklistItems.find(item => item.applicationId === 'ta001')
  props.setTmEntryModalRecord({ ...oldItem, _tab: 'checklist', _actorId: props.currentUser.id })
  props.setTmEntryContent('cross application overwrite')
  button(components.TransferEntry(props), '确认提交')?.props.onClick()
  assert.notEqual(props.tmChecklistItems.find(item => item.id === oldItem.id).entryContent, 'cross application overwrite')
  props.selectedProject = { id: 'different-project', name: 'different-project' }
  assert.equal(allNodes(components.TransferDetail(props)).some(node => node.type === 'Table'), false)
})
check('the last entry and review advance only their application and reset old review results', () => {
  const app = structuredClone(mock.MOCK_TRANSFER_APPLICATIONS[0])
  const props = propsFor(app)
  const original = props.tmChecklistItems.find(item => item.applicationId === app.id && item.responsibleRole === 'SPM')
  const target = { ...original, entryStatus: 'draft', aiCheckStatus: 'not_started', reviewStatus: 'rejected', reviewComment: 'old rejection' }
  const unrelated = { ...original, id: 'other', applicationId: 'other-app' }
  props.setTmChecklistItems([target, unrelated]); props.setTmReviewElements([])
  props.setTmEntryModalRecord({ ...target, _tab: 'checklist', _actorId: props.currentUser.id })
  props.setTmEntryContent('corrected content')
  button(components.TransferEntry(props), '确认提交').props.onClick()
  assert.equal(props.tmChecklistItems[0].reviewStatus, 'not_reviewed')
  assert.equal(props.tmChecklistItems[0].reviewComment, undefined)
  assert.equal(props.tmChecklistItems[1], unrelated)
  assert.equal(props.transferApplications.find(row => row.id === app.id).pipeline.maintenanceReview, 'in_progress')
  props.currentUser = { id: 'login-演示用户02', name: '演示用户02' }
  props.setTmReviewRecord({ ...props.tmChecklistItems[0], _tab: 'checklist', _actorId: props.currentUser.id })
  props.setTmReviewAction('pass')
  allNodes(components.TransferReview(props)).find(node => node.type === 'Modal').props.onOk()
  const updated = props.transferApplications.find(row => row.id === app.id)
  assert.equal(updated.pipeline.maintenanceReview, 'success')
  assert.equal(updated.pipeline.sqaReview, 'in_progress')
})
check('team assignment and item readiness protect maintenance review', () => {
  const { canEnterTransferItem, canReviewTransferItem, canSqaReviewTransfer, matchesTransferProject } = loadTypeScriptModule(root, 'src/lib/transferWorkflow.ts')
  const app = mock.MOCK_TRANSFER_APPLICATIONS[1]
  const props = propsFor(app)
  const item = props.tmChecklistItems.find(row => row.applicationId === app.id && row.responsibleRole === 'SPM')
  assert.equal(canReviewTransferItem(app, item, { id: 'login-演示用户01', name: '演示用户01' }, props.selectedProject), true)
  assert.equal(canReviewTransferItem(app, item, { id: 'login-演示用户02', name: '演示用户02' }, props.selectedProject), false)
  assert.equal(canReviewTransferItem(app, { ...item, entryStatus: 'draft' }, { id: 'login-演示用户01', name: '演示用户01' }, props.selectedProject), false)
  assert.equal(canSqaReviewTransfer(app, { id: 'login-演示用户07', name: '演示用户07' }, props.selectedProject), false)
  assert.equal(matchesTransferProject({ ...app, projectId: 'real-project-id' }, { id: 'other-id', name: app.projectName }), false)
  assert.equal(canEnterTransferItem({ ...app, status: 'completed' }, item, { id: 'login-演示用户01', name: '演示用户01' }, props.selectedProject), false)
})
check('SQA rejection persists the rollback and allows re-review', () => {
  const app = { ...mock.MOCK_TRANSFER_APPLICATIONS[0], pipeline: { ...mock.MOCK_TRANSFER_APPLICATIONS[0].pipeline, dataEntry: 'success', maintenanceReview: 'success', sqaReview: 'in_progress' } }
  const props = propsFor(app, '演示用户07'); props.setTransferApplications([app])
  props.setTmSqaAction('reject'); props.setTmSqaComment('补充审核')
  allNodes(components.TransferSqaReview(props)).find(node => node.type === 'Modal').props.onOk()
  assert.equal(props.transferApplications[0].pipeline.maintenanceReview, 'in_progress')
  assert.equal(props.transferApplications[0].pipeline.sqaReview, 'not_started')
  assert.ok(props.tmChecklistItems.filter(item => item.applicationId === app.id).every(item => item.reviewStatus === 'not_reviewed'))
})
check('newly submitted application produces the assigned current user entry todo', () => {
  const { buildTransferTodoCandidates } = loadTypeScriptModule(root, 'src/lib/todoAggregation.ts')
  const props = propsFor(mock.MOCK_TRANSFER_APPLICATIONS[0])
  props.setTmApplyDate('2026-09-09'); props.setTmApplyTeam(mock.MOCK_TM_TEAMS.TEAM_1)
  button(components.TransferApply(props), '提交申请').props.onClick()
  const app = props.transferApplications[0]
  const todos = buildTransferTodoCandidates({ applications: [app], projects: [props.selectedProject] })
  assert.equal(todos.find(todo => todo.view === 'entry')?.activeOwner, '演示用户01')
  const assignedElsewhere = { ...app, team: mock.MOCK_TM_TEAMS.TEAM_2 }
  const otherTodos = buildTransferTodoCandidates({ applications: [assignedElsewhere], projects: [props.selectedProject] })
  assert.equal(otherTodos.find(todo => todo.view === 'entry')?.activeOwner, '演示用户03')
})
check('PMS login identities require a directory user and exact matching ID/name pair', () => {
  const { mapTransferOwnerToPmsUser } = loadTypeScriptModule(root, 'src/lib/todoAggregation.ts')
  assert.equal(mapTransferOwnerToPmsUser('login-演示用户01', '演示用户01'), '演示用户01')
  assert.equal(mapTransferOwnerToPmsUser('login-演示用户09', '演示用户09'), '演示用户09')
  assert.equal(mapTransferOwnerToPmsUser('login-演示用户01', '演示用户03'), undefined)
  assert.equal(mapTransferOwnerToPmsUser('login-不存在', '不存在'), undefined)
  assert.equal(mapTransferOwnerToPmsUser('arbitrary-id', '演示用户01'), undefined)
  assert.equal(mapTransferOwnerToPmsUser('u001', '演示用户03'), undefined)
})
check('embedded project transfer table hosts the close confirmation and rechecks permission', () => {
  const props = propsFor(mock.MOCK_TRANSFER_APPLICATIONS[0]); props.embedded = true
  props.setTmCloseAppId('ta001'); props.setTmCloseReason('不再转维'); props.setTmCloseModalVisible(true)
  const tree = components.TransferWorkbench(props)
  const table = allNodes(tree).find(node => node.type === 'Table')
  assert.deepEqual(table.props.columns.map(column => column.title), ['项目名称', '流水线进度', '计划评审日期', '角色进度', '操作'])
  const modal = allNodes(tree).find(node => node.type === 'Modal')
  assert.ok(modal)
  props.canApplyTransfer = false; modal.props.onOk()
  assert.equal(props.transferApplications.find(app => app.id === 'ta001').status, 'in_progress')
  props.canApplyTransfer = true; modal.props.onOk()
  assert.equal(props.transferApplications.find(app => app.id === 'ta001').status, 'cancelled')
})
if (failures.length) throw new Error(`${failures.length} transfer regressions: ${failures.join(', ')}`)
console.log('Transfer workflow verification passed')
