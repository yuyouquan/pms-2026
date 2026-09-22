import assert from 'node:assert/strict'
import { loadTypeScriptModule } from './lib/source-contract.mjs'

// Real stores and business helpers; browser interactions are verified separately.
const root = process.cwd()
const { useTransferStore, resumeTransferAiChecks, upgradeTransferMockDefaults } = loadTypeScriptModule(root, 'src/stores/transfer.ts')
const { usePermissionStore, hasGlobalPermission } = loadTypeScriptModule(root, 'src/stores/permission.ts')
const config = loadTypeScriptModule(root, 'src/lib/transferConfig.ts')
const flow = loadTypeScriptModule(root, 'src/lib/transferWorkflow.ts')
const { getTransferRoleSubmission } = loadTypeScriptModule(root, 'src/components/transfer/transferInteraction.ts')
const { MOCK_TRANSFER_APPLICATIONS } = loadTypeScriptModule(root, 'src/mock/transfer-maintenance.ts')
const { mapTransferOwnerToPmsUser } = loadTypeScriptModule(root, 'src/lib/todoAggregation.ts')
const whole = '整机产品项目', tos = 'tOS版本项目', editor = '演示用户01', viewer = '演示用户05'
const person = name => ({ id: `login-${name}`, name })
const actor = person(editor), reviewer = person('演示用户02'), outsider = person(viewer)
const project = { id: 'regression-project', name: '转维业务回归项目' }
const foreignProject = { id: 'another-project', name: project.name }
const cloneState = state => Object.fromEntries(Object.entries(state).map(([key, value]) => [key, typeof value === 'function' ? value : structuredClone(value)]))
const initialTransfer = cloneState(useTransferStore.getState()), initialPermission = cloneState(usePermissionStore.getState())
const state = () => useTransferStore.getState()
const snapshot = () => structuredClone({ teams: state().tmTeamConfigs, versions: state().tmTemplateVersions })
const failures = []
let checks = 0
function check(name, fn) {
  checks++
  try {
    useTransferStore.setState(cloneState(initialTransfer), true)
    usePermissionStore.setState(cloneState(initialPermission), true)
    usePermissionStore.setState({
      globalRoles: [{ name: '转维回归编辑组', members: [editor], isFixed: false }, { name: '转维回归查看组', members: [viewer], isFixed: false }],
      globalRolePerms: { '转维回归编辑组': { 'configCenter:transferEdit': true }, '转维回归查看组': { 'configCenter:transferEdit': false } },
    })
    fn(); console.log(`PASS ${name}`)
  } catch (error) { failures.push(name); console.error(`FAIL ${name}: ${error.stack || error.message}`) }
}
function templateRows(kind, projectType = whole) {
  return config.parseTransferTemplateRows([
    config.TRANSFER_TEMPLATE_HEADERS[kind],
    kind === 'checklist'
      ? ['A.01', '回归检查标准', '检查项', 'SPM', '在研SPM', '维护SPM', '资料完整']
      : ['B.01', '回归评审要素', '交付件', '说明', '备注', 'SPM', '在研SPM', '维护SPM', '核对内容'],
  ], kind, state().tmTeamConfigs[projectType])
}
check('tOS mock defaults contain only SPM and TPM with matching material responsibilities', () => {
  assert.deepEqual(state().tmTeamConfigs[tos].map(role => [role.roleName, role.ipmRoleCode]), [['SPM', 'SPM'], ['TPM', 'TPM']])
  const templates = config.getCurrentTransferTemplates(tos, state().tmTemplateVersions)
  assert.deepEqual([...new Set(templates.checklist.map(row => row.responsibleRole))].sort(), ['SPM', 'TPM'])
  assert.ok(templates.checklist.every(row => row.entryRole === `在研${row.responsibleRole}` && row.reviewRole === `维护${row.responsibleRole}`))
  assert.equal(templates.reviewElements.length, 0)
  assert.equal(state().tmTeamConfigs[whole].length, 5)
})
check('legacy default refresh preserves whole-product data, existing applications and customized configuration', () => {
  const original = cloneState(state())
  useTransferStore.setState({ tmTeamConfigs: { ...state().tmTeamConfigs, [tos]: config.getTransferRoleConfig(whole) }, tmTemplateVersions: { ...state().tmTemplateVersions, [tos]: { checklist: [{ ...state().tmTemplateVersions[tos].checklist[0], rows: structuredClone(state().tmTemplateVersions[whole].checklist[0].rows) }], review: [] } } })
  upgradeTransferMockDefaults()
  assert.deepEqual(state().tmTeamConfigs[tos], original.tmTeamConfigs[tos])
  assert.deepEqual(state().tmTemplateVersions[tos], original.tmTemplateVersions[tos])
  assert.deepEqual(state().tmTemplateVersions[whole], original.tmTemplateVersions[whole])
  assert.deepEqual(state().transferApplications, original.transferApplications)
  const custom = [{ id: 'spm', roleName: '版本负责人', ipmRoleCode: 'VERSION_PM' }]
  useTransferStore.setState({ tmTeamConfigs: { ...state().tmTeamConfigs, [tos]: custom } })
  upgradeTransferMockDefaults()
  assert.deepEqual(state().tmTeamConfigs[tos], custom)
  useTransferStore.setState({ tmTeamConfigs: { ...state().tmTeamConfigs, [tos]: config.getTransferRoleConfig(whole) }, tmTemplateVersions: { ...state().tmTemplateVersions, [tos]: { ...state().tmTemplateVersions[tos], checklist: [{ ...state().tmTemplateVersions[tos].checklist[0], createdBy: editor }] } } })
  const imported = snapshot()
  upgradeTransferMockDefaults()
  assert.deepEqual(snapshot(), imported)
})
function application(projectType = whole) {
  return {
    ...structuredClone(MOCK_TRANSFER_APPLICATIONS[0]), id: 'regression-application', projectId: project.id, projectName: project.name,
    projectType, applicantId: actor.id, applicant: actor.name, status: 'in_progress', finalReviewRole: 'SPM',
    teamConfig: [{ id: 'spm', roleName: 'SPM', ipmRoleCode: 'SPM' }],
    team: { research: [{ ...actor, role: 'SPM', ipmRoleCode: 'SPM' }], maintenance: [{ ...reviewer, role: 'SPM', ipmRoleCode: 'SPM' }] },
    pipeline: { projectInit: 'success', dataEntry: 'in_progress', maintenanceReview: 'not_started', maintenanceSpmReview: 'not_started', infoChange: 'not_started', roleProgress: [{ role: 'SPM', entryStatus: 'not_started', reviewStatus: 'not_started' }] },
  }
}
const material = app => flow.createTransferMaterials(app, { checklist: templateRows('checklist'), reviewElements: templateRows('review') })

check('template imports append immutable versions and isolate project types and template kinds', () => {
  const before = snapshot(), rows = templateRows('checklist')
  assert.equal(hasGlobalPermission(editor, 'configCenter:transferEdit'), true)
  assert.equal(state().importTransferTemplate(whole, 'checklist', rows, editor), true)
  const versions = state().tmTemplateVersions[whole].checklist
  assert.equal(versions.length, before.versions[whole].checklist.length + 1)
  assert.deepEqual(versions.slice(0, -1), before.versions[whole].checklist)
  assert.deepEqual(versions.at(-1).rows, rows)
  assert.equal(versions.at(-1).createdBy, editor)
  assert.equal(versions.at(-1).version, `v${versions.length}.0`)
  assert.equal(state().tmConfigSelectedVersion, versions.at(-1).id)
  rows[0].checkItem = 'caller mutation must not alter published content'
  assert.equal(versions.at(-1).rows[0].checkItem, '回归检查标准')
  assert.deepEqual(state().tmTemplateVersions[tos], before.versions[tos])
  assert.deepEqual(state().tmTemplateVersions[whole].review, before.versions[whole].review)
  const wholeAfter = structuredClone(state().tmTemplateVersions[whole])
  assert.equal(state().importTransferTemplate(tos, 'checklist', templateRows('checklist', tos), editor), true)
  assert.deepEqual(state().tmTemplateVersions[whole], wholeAfter)
  assert.equal(config.getCurrentTransferTemplates(tos, state().tmTemplateVersions).reviewElements.length, 0)
})
check('unauthorized, revoked, empty and tOS review imports cannot publish versions', () => {
  const before = snapshot(), rows = templateRows('checklist')
  assert.equal(state().importTransferTemplate(whole, 'checklist', rows, viewer), false)
  assert.equal(state().importTransferTemplate(whole, 'checklist', rows, ''), false)
  assert.equal(state().importTransferTemplate(tos, 'review', templateRows('review'), editor), false)
  assert.equal(state().importTransferTemplate(whole, 'checklist', [], editor), false)
  usePermissionStore.setState({ globalRolePerms: { '转维回归编辑组': { 'configCenter:transferEdit': false } } })
  assert.equal(state().importTransferTemplate(whole, 'checklist', rows, editor), false)
  assert.deepEqual(snapshot(), before)
})
check('team rename updates current templates while preserving history and existing applications', () => {
  const before = snapshot()
  const apps = structuredClone(state().transferApplications), checklist = structuredClone(state().tmChecklistItems), reviewElements = structuredClone(state().tmReviewElements)
  const roles = before.teams[whole].map(role => role.id === 'spm' ? { ...role, roleName: ' 版本负责人 ', ipmRoleCode: ' VERSION_PM ' } : role)
  assert.deepEqual(state().saveTransferTeamConfig(whole, roles, editor), [])
  assert.deepEqual(state().tmTeamConfigs[whole].find(role => role.id === 'spm'), { id: 'spm', roleName: '版本负责人', ipmRoleCode: 'VERSION_PM' })
  for (const kind of ['checklist', 'review']) {
    const oldVersions = before.versions[whole][kind], newVersions = state().tmTemplateVersions[whole][kind]
    assert.equal(newVersions.length, oldVersions.length + 1)
    assert.deepEqual(newVersions.slice(0, -1), oldVersions)
    assert.deepEqual(newVersions.at(-1).rows, oldVersions.at(-1).rows.map(row => ({
      ...row, responsibleRole: row.responsibleRole === 'SPM' ? '版本负责人' : row.responsibleRole,
      entryRole: row.entryRole === '在研SPM' ? '在研版本负责人' : row.entryRole,
      reviewRole: row.reviewRole === '维护SPM' ? '维护版本负责人' : row.reviewRole,
    })))
  }
  assert.deepEqual(state().tmTeamConfigs[tos], before.teams[tos])
  assert.deepEqual(state().tmTemplateVersions[tos], before.versions[tos])
  assert.deepEqual(state().transferApplications, apps)
  assert.deepEqual(state().tmChecklistItems, checklist)
  assert.deepEqual(state().tmReviewElements, reviewElements)
})
check('team save rejects unauthorized users, revoked grants and invalid roles without partial changes', () => {
  const before = snapshot(), roles = structuredClone(before.teams[whole])
  const renamed = roles.map(role => role.id === 'spm' ? { ...role, roleName: '无权保存的名称' } : role)
  assert.ok(state().saveTransferTeamConfig(whole, renamed, viewer).length > 0)
  assert.ok(state().saveTransferTeamConfig(whole, roles.filter(role => role.id !== 'spm'), editor).length > 0)
  assert.ok(state().saveTransferTeamConfig(whole, roles.map(role => ({ ...role, roleName: '重复角色' })), editor).length > 0)
  assert.ok(state().saveTransferTeamConfig(whole, roles.filter(role => role.id !== 'test'), editor).length > 0)
  usePermissionStore.setState({ globalRolePerms: {} })
  assert.ok(state().saveTransferTeamConfig(whole, renamed, editor).length > 0)
  assert.deepEqual(snapshot(), before)
})
check('configuration project switch clears view selections without changing published data', () => {
  const before = snapshot()
  state().setTransferConfigView('review'); state().setTmConfigSearchText('旧搜索')
  state().setTmConfigSelectedVersion('old-version'); state().setTmConfigDiffOpen(true)
  state().setTransferProjectType(tos)
  assert.equal(state().transferProjectType, tos)
  assert.equal(state().transferConfigView, 'checklist')
  assert.equal(state().tmConfigSearchText, '')
  assert.equal(state().tmConfigSelectedVersion, '')
  assert.equal(state().tmConfigDiffOpen, false)
  assert.deepEqual(snapshot(), before)
})
check('entry and review require correct owner or delegate, application, project and readiness', () => {
  const app = application(), item = material(app).checklist[0]
  assert.equal(flow.canEnterTransferItem(app, item, actor, project), true)
  assert.equal(flow.canEnterTransferItem(app, item, outsider, project), false)
  assert.equal(flow.canEnterTransferItem(app, item, actor, foreignProject), false)
  assert.equal(flow.canEnterTransferItem(app, { ...item, applicationId: 'another-application' }, actor, project), false)
  assert.equal(flow.canEnterTransferItem(app, { ...item, delegatedTo: [outsider.id] }, outsider, project), true)
  const reviewing = { ...app, pipeline: { ...app.pipeline, maintenanceReview: 'in_progress' } }
  const submitted = { ...item, entryStatus: 'entered', aiCheckStatus: 'passed', reviewStatus: 'reviewing' }
  assert.equal(flow.canReviewTransferItem(reviewing, submitted, reviewer, project), true)
  assert.equal(flow.canReviewTransferItem(reviewing, submitted, actor, project), false)
  assert.equal(flow.canReviewTransferItem(reviewing, submitted, reviewer, foreignProject), false)
  assert.equal(flow.canReviewTransferItem(reviewing, { ...submitted, applicationId: 'another-application' }, reviewer, project), false)
  assert.equal(flow.canReviewTransferItem(reviewing, { ...submitted, aiCheckStatus: 'in_progress' }, reviewer, project), false)
  assert.equal(flow.canReviewTransferItem(reviewing, { ...submitted, reviewDelegatedTo: [outsider.id] }, outsider, project), true)
  assert.equal(flow.canReviewTransferItem(app, submitted, reviewer, project), false)
})
check('all material approvals start maintenance SPM review and ignore unrelated applications', () => {
  const app = application(), materials = material(app)
  const ready = item => ({ ...item, entryStatus: 'entered', aiCheckStatus: 'passed', reviewStatus: 'passed' })
  const checklist = materials.checklist.map(ready), reviewElements = materials.reviewElements.map(ready)
  const foreign = { ...checklist[0], id: 'unrelated', applicationId: 'another-application', reviewStatus: 'rejected' }
  const next = flow.syncTransferPipeline(app, [...checklist, foreign], reviewElements)
  assert.equal(next.pipeline.dataEntry, 'success')
  assert.equal(next.pipeline.maintenanceReview, 'success')
  assert.equal(next.pipeline.maintenanceSpmReview, 'in_progress')
  assert.equal(next.pipeline.infoChange, 'not_started')
  assert.equal(app.pipeline.maintenanceSpmReview, 'not_started')
  const access = flow.getMaintenanceSpmReviewAccess(next, reviewer, project)
  assert.equal(access.canApprove, true); assert.equal(access.canReject, true)
  assert.equal(flow.canEditTransferLegacy(next, reviewer, project), true)
  assert.equal(flow.getMaintenanceSpmReviewAccess(next, actor, project).canApprove, false)
  assert.equal(flow.getMaintenanceSpmReviewAccess(next, reviewer, foreignProject).canReject, false)
  assert.equal(flow.canEditTransferLegacy(next, outsider, project), false)
  const tosApp = application(tos)
  assert.equal(material(tosApp).reviewElements.length, 0)
  assert.equal(flow.syncTransferPipeline(tosApp, checklist, [{ ...reviewElements[0], reviewStatus: 'rejected' }]).pipeline.maintenanceSpmReview, 'in_progress')
})
check('a rejected role permits maintenance SPM rejection and legacy work but cannot be approved', () => {
  const app = application(), items = material(app)
  const rejected = item => ({ ...item, entryStatus: 'entered', aiCheckStatus: 'not_started', reviewStatus: 'rejected' })
  const next = flow.syncTransferPipeline(app, items.checklist.map(rejected), items.reviewElements.map(rejected))
  const access = flow.getMaintenanceSpmReviewAccess(next, reviewer, project)
  assert.equal(access.isRejectionMode, true)
  assert.equal(access.canApprove, false); assert.equal(access.canReject, true)
  assert.equal(flow.canEditTransferLegacy(next, reviewer, project), true)
  assert.equal(flow.getMaintenanceSpmReviewAccess(next, outsider, project).canReject, false)
})
check('terminal applications are read-only and sync cannot reopen a finished workflow', () => {
  const app = application(), entry = { ...material(app).checklist[0], entryStatus: 'entered', aiCheckStatus: 'passed' }
  for (const status of ['cancelled', 'failed', 'completed']) {
    const terminal = { ...app, status, pipeline: { ...app.pipeline, maintenanceReview: 'in_progress', maintenanceSpmReview: 'in_progress', roleProgress: [{ role: 'SPM', entryStatus: 'completed', reviewStatus: 'completed' }] } }
    const review = { ...entry, reviewStatus: 'reviewing' }
    assert.equal(flow.canEnterTransferItem(terminal, entry, actor, project), false, status)
    assert.equal(flow.canReviewTransferItem(terminal, review, reviewer, project), false, status)
    assert.equal(flow.canDelegateTransferItem(terminal, entry, actor, project, 'entry'), false, status)
    assert.equal(flow.canDelegateTransferItem(terminal, review, reviewer, project, 'review'), false, status)
    assert.equal(flow.getMaintenanceSpmReviewAccess(terminal, reviewer, project).canReject, false, status)
    assert.equal(flow.canEditTransferLegacy(terminal, reviewer, project), false, status)
    assert.equal(flow.canCloseTransfer(terminal, actor, project, true), false, status)
    assert.equal(getTransferRoleSubmission(terminal, 'SPM', [entry], actor, project, true).canSubmit, false, status)
    assert.equal(flow.syncTransferPipeline(terminal, [review], []), terminal)
  }
  const approved = { ...app, pipeline: { ...app.pipeline, maintenanceReview: 'success', maintenanceSpmReview: 'success', infoChange: 'in_progress' } }
  assert.equal(flow.canEnterTransferItem(approved, entry, actor, project), false)
  assert.equal(flow.canEditTransferLegacy(approved, reviewer, project), false)
  assert.equal(flow.canCloseTransfer(approved, actor, project, true), false)
  assert.equal(flow.syncTransferPipeline(approved, [entry], []), approved)
})
check('role submission rejects a different actor, project, hidden view or unfinished AI check', () => {
  const app = application(), item = { ...material(app).checklist[0], entryStatus: 'entered', aiCheckStatus: 'passed' }
  assert.equal(getTransferRoleSubmission(app, 'SPM', [item], actor, project, true).canSubmit, true)
  assert.equal(getTransferRoleSubmission(app, 'SPM', [item], outsider, project, true).canSubmit, false)
  assert.equal(getTransferRoleSubmission(app, 'SPM', [item], actor, foreignProject, true).canSubmit, false)
  assert.equal(getTransferRoleSubmission(app, 'SPM', [item], actor, project, false).canSubmit, false)
  assert.equal(getTransferRoleSubmission(app, 'SPM', [{ ...item, aiCheckStatus: 'in_progress' }], actor, project, true).canSubmit, false)
})
check('application and view switches clear draft dialogs while preserving saved business data', () => {
  const saved = { apps: structuredClone(state().transferApplications), checklist: structuredClone(state().tmChecklistItems), versions: structuredClone(state().tmTemplateVersions) }
  const fill = () => {
    state().setTmApplyDate('2026-10-01'); state().setTmApplyRemark('未提交申请'); state().setTmApplyTeam(application().team)
    state().setTmEntryModalRecord({ id: 'old-entry', applicationId: 'first' }); state().setTmEntryModalOpen(true); state().setTmEntryContent('未保存录入')
    state().setTmReviewRecord({ id: 'old-review', applicationId: 'first' }); state().setTmReviewModalOpen(true); state().setTmReviewComment('未保存审核')
    state().setTmDetailModalVisible(true); state().setTmDetailModalContent('上一个申请详情')
  }
  const cleared = () => {
    assert.equal(state().tmApplyDate, ''); assert.equal(state().tmApplyRemark, '')
    assert.deepEqual(state().tmApplyTeam, { research: [], maintenance: [] })
    assert.equal(state().tmEntryModalOpen, false); assert.equal(state().tmEntryModalRecord, null); assert.equal(state().tmEntryContent, '')
    assert.equal(state().tmReviewModalOpen, false); assert.equal(state().tmReviewRecord, null); assert.equal(state().tmReviewComment, '')
    assert.equal(state().tmDetailModalVisible, false); assert.equal(state().tmDetailModalContent, '')
  }
  state().setSelectedTransferAppId('first'); state().setTransferView('entry'); fill()
  state().setSelectedTransferAppId('first')
  assert.equal(state().tmEntryContent, '未保存录入', 'reselecting the same application must retain its draft')
  state().setSelectedTransferAppId('second'); cleared()
  assert.equal(state().selectedTransferAppId, 'second')
  fill(); state().setTransferView('maintenance-spm-review'); cleared()
  assert.equal(state().transferView, 'maintenance-spm-review')
  assert.deepEqual(state().transferApplications, saved.apps)
  assert.deepEqual(state().tmChecklistItems, saved.checklist)
  assert.deepEqual(state().tmTemplateVersions, saved.versions)
})
check('reload resumes pending mock AI checks without altering completed or terminal materials', () => {
  const app = application(), item = {...material(app).checklist[0],entryStatus:'entered',aiCheckStatus:'in_progress'}
  const terminal = {...app,id:'finished',status:'failed'}
  const finishedItem = {...item,id:'frozen-check',applicationId:terminal.id}
  const passedItem = {...item,id:'passed-check',aiCheckStatus:'passed',aiCheckResult:'保留原结果'}
  useTransferStore.setState({transferApplications:[app,terminal],tmChecklistItems:[item,finishedItem,passedItem],tmReviewElements:[]})
  resumeTransferAiChecks()
  const rows = state().tmChecklistItems
  assert.ok(['passed','failed'].includes(rows[0].aiCheckStatus))
  assert.ok(rows[0].aiCheckResult)
  assert.deepEqual(rows[1],finishedItem)
  assert.deepEqual(rows[2],passedItem)
  assert.equal(state().transferApplications[0].pipeline.dataEntry,'in_progress','AI completion does not automatically submit a role')
  assert.deepEqual(state().transferApplications[1],terminal)
})
check('PMS identity bridge requires a known exact external identity or local login pair', () => {
  assert.equal(mapTransferOwnerToPmsUser(actor.id, actor.name), actor.name)
  assert.equal(mapTransferOwnerToPmsUser('u001', actor.name), actor.name)
  assert.equal(mapTransferOwnerToPmsUser(actor.id, outsider.name), undefined)
  assert.equal(mapTransferOwnerToPmsUser('login-不存在', '不存在'), undefined)
  assert.equal(mapTransferOwnerToPmsUser('arbitrary-id', actor.name), undefined)
  assert.equal(mapTransferOwnerToPmsUser('u001', outsider.name), undefined)
})

useTransferStore.setState(cloneState(initialTransfer), true)
usePermissionStore.setState(cloneState(initialPermission), true)
if (failures.length) throw new Error(`${failures.length}/${checks} transfer regressions: ${failures.join(', ')}`)
console.log(`Transfer workflow verification passed: ${checks} real-module business regressions`)
