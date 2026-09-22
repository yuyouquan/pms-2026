import assert from 'node:assert/strict'
import { loadTypeScriptModule } from './lib/source-contract.mjs'
const root = process.cwd()
const { getTransferRoleSubmission, canAppendTransferRoleLegacy, inheritTransferMaterialContent, canAssignTransferParticipant } = loadTypeScriptModule(root, 'src/components/transfer/transferInteraction.ts')
const { MOCK_TRANSFER_APPLICATIONS, MOCK_CHECKLIST_ITEMS, buildCloseReviewRows } = loadTypeScriptModule(root, 'src/mock/transfer-maintenance.ts')
const { getTransferRoleConfig } = loadTypeScriptModule(root, 'src/lib/transferConfig.ts')
const app = structuredClone(MOCK_TRANSFER_APPLICATIONS[0])
app.teamConfig = getTransferRoleConfig('整机产品项目')
app.status = 'in_progress'
app.pipeline.maintenanceSpmReview = 'not_started'
const project = { id: app.projectId, name: app.projectName }
const coordinator = app.team.research.find(member => member.role === 'SPM')
const item = { ...MOCK_CHECKLIST_ITEMS[0], applicationId: app.id, responsibleRole: 'SPM', entryStatus: 'entered', aiCheckStatus: 'passed' }
// An approved sibling must remain approved while the repaired rejection is resubmitted.
const mixed = [{ ...item, id: 'approved', reviewStatus: 'passed' }, { ...item, id: 'corrected', reviewStatus: 'not_reviewed' }]
assert.deepEqual(getTransferRoleSubmission(app, 'SPM', mixed, coordinator, project, true), { canSubmit: true, itemIds: ['corrected'] })
assert.equal(getTransferRoleSubmission(app, 'SPM', mixed, coordinator, project, false).canSubmit, false)
assert.equal(getTransferRoleSubmission(app, 'SPM', mixed, coordinator, { id: 'other', name: 'other' }, true).canSubmit, false)
assert.equal(getTransferRoleSubmission({ ...app, status: 'failed' }, 'SPM', mixed, coordinator, project, true).canSubmit, false)
assert.equal(getTransferRoleSubmission(app, 'SPM', mixed.map(row => ({ ...row, reviewStatus: 'passed' })), coordinator, project, true).canSubmit, false)
assert.equal(getTransferRoleSubmission(app, 'SPM', mixed.map(row => row.id === 'corrected' ? { ...row, aiCheckStatus: 'in_progress' } : row), coordinator, project, true).canSubmit, false)
// Coordinator may submit across distinct template entryRole assignments once every row is ready.
const crossOwner = mixed.map(row => ({ ...row, entryPersonId: 'login-演示用户05', entryPerson: '演示用户05' }))
assert.equal(getTransferRoleSubmission(app, 'SPM', crossOwner, coordinator, project, true).canSubmit, true)
const outsider = { id: 'login-演示用户06', name: '演示用户06' }
assert.equal(getTransferRoleSubmission(app, 'SPM', crossOwner, outsider, project, true).canSubmit, false)
assert.equal(getTransferRoleSubmission(app, 'SPM', crossOwner.map(row => ({ ...row, delegatedTo: [outsider.id] })), outsider, project, true).canSubmit, false, 'Delegation never grants role coordinator submission authority')
assert.equal(getTransferRoleSubmission(app, 'SPM', crossOwner.map((row, index) => ({ ...row, delegatedTo: index ? [outsider.id] : [] })), outsider, project, true).canSubmit, false)
// Final-review summary resolves snapshot display names/codes and real reviewer comments.
const configuredSummary = {
  ...app,
  teamConfig: [{ id: 'spm', roleName: '版本负责人', ipmRoleCode: 'VERSION_PM' }, { id: 'test', roleName: '质量代表', ipmRoleCode: 'QUALITY_OWNER' }],
  team: { ...app.team, maintenance: [{ id: 'login-演示用户02', name: '演示用户02', role: 'VERSION_PM', department: '项目团队' }, { id: 'login-演示用户05', name: '演示用户05', role: '质量代表', department: '测试团队' }] },
  pipeline: { ...app.pipeline, roleProgress: [{ role: '版本负责人', entryStatus: 'completed', reviewStatus: 'rejected' }, { role: 'QUALITY_OWNER', entryStatus: 'completed', reviewStatus: 'completed' }] },
}
const summaryRows = buildCloseReviewRows(configuredSummary, [
  { ...item, responsibleRole: 'VERSION_PM', reviewStatus: 'rejected', reviewRemark: '  请补齐链接\n并说明版本  ', reviewComment: '旧角色意见' },
  { ...item, id: 'pm-second', responsibleRole: '版本负责人', reviewStatus: 'rejected', reviewComment: '补充回归范围' },
  { ...item, id: 'quality', responsibleRole: '质量代表', reviewStatus: 'passed', reviewRemark: '复核通过' },
  { ...item, applicationId: 'another-application', responsibleRole: 'VERSION_PM', reviewStatus: 'rejected', reviewRemark: '其他申请备注不能泄漏' },
], [])
assert.deepEqual(summaryRows, [
  { role: '版本负责人', responsiblePerson: '演示用户02', conclusion: 'Fail', comment: '请补齐链接\n并说明版本\n补充回归范围' },
  { role: '质量代表', responsiblePerson: '演示用户05', conclusion: 'PASS', comment: '复核通过' },
])
const legacySummary = { ...app, teamConfig: undefined, team: { ...app.team, maintenance: [{ id: 'login-演示用户05', name: '演示用户05', role: 'TPM', department: '测试团队' }] }, pipeline: { ...app.pipeline, roleProgress: [{ role: '测试', entryStatus: 'completed', reviewStatus: 'rejected' }] } }
assert.deepEqual(buildCloseReviewRows(legacySummary, [{ ...item, responsibleRole: 'TPM', reviewStatus: 'rejected', reviewRemark: '   ', reviewComment: '旧TPM数据的评审意见' }], []), [{ role: '测试', responsiblePerson: '演示用户05', conclusion: 'Fail', comment: '旧TPM数据的评审意见' }])
const codeOnlyMember = { ...configuredSummary, team: { ...configuredSummary.team, maintenance: [{ id: 'login-演示用户02', name: '演示用户02', role: '外部角色名', ipmRoleCode: 'VERSION_PM', department: '项目团队' }] } }
assert.equal(buildCloseReviewRows(codeOnlyMember, [{ ...item, responsibleRole: '版本负责人', reviewStatus: 'passed' }], [])[0].responsiblePerson, '演示用户02')
assert.equal(buildCloseReviewRows(configuredSummary, [], [])[0].conclusion, 'N/A')
// Approving all individual rows keeps an explicit follow-up path without reopening their review.
const reviewer = app.team.maintenance.find(member => member.role === 'SPM')
const passedRole = mixed.map(row => ({ ...row, reviewStatus: 'passed' }))
assert.equal(canAppendTransferRoleLegacy(app, 'SPM', passedRole, reviewer, project, true), true)
assert.equal(canAppendTransferRoleLegacy(app, 'SPM', passedRole, coordinator, project, true), false)
assert.equal(canAppendTransferRoleLegacy(app, 'SPM', mixed, reviewer, project, true), false)
assert.equal(canAppendTransferRoleLegacy(app, 'SPM', passedRole, reviewer, project, false), false)
assert.equal(canAppendTransferRoleLegacy({ ...app, status: 'failed' }, 'SPM', passedRole, reviewer, project, true), false)
assert.equal(canAppendTransferRoleLegacy({ ...app, pipeline: { ...app.pipeline, maintenanceSpmReview: 'success' } }, 'SPM', passedRole, reviewer, project, true), false)
assert.equal(canAppendTransferRoleLegacy(app, 'SPM', passedRole, reviewer, { id: 'other', name: 'other' }, true), false)
// Reopen matching uses the full material identity and consumes identical source rows in order.
const sourceApplication = { ...app, teamConfig: [{ id: 'spm', roleName: 'SPM', ipmRoleCode: 'SPM' }] }
const targetApplication = { ...app, id: 'reopened', teamConfig: [{ id: 'spm', roleName: '版本负责人', ipmRoleCode: 'VERSION_PM' }] }
const sourceMaterial = { ...item, seq: 'A.01', type: '检查项', checkItem: '相同标准', entryContent: '第一条录入', deliverables: [{ id: 'file-1', name: '资料', url: 'https://example.com/one', type: 'link' }], reviewStatus: 'passed', reviewRemark: '旧审核', delegatedTo: ['u003'] }
const freshMaterial = { ...item, id: 'new-1', applicationId: targetApplication.id, responsibleRole: '版本负责人', seq: 'A.01', type: '检查项', checkItem: '相同标准', entryStatus: 'not_entered', aiCheckStatus: 'not_started', reviewStatus: 'not_reviewed', entryContent: undefined, deliverables: [], reviewRemark: undefined, delegatedTo: undefined }
const inherited = inheritTransferMaterialContent(sourceApplication, targetApplication,
 [freshMaterial, { ...freshMaterial, id: 'new-2' }, { ...freshMaterial, id: 'new-3' }, { ...freshMaterial, id: 'changed-seq', seq: 'A.02' }, { ...freshMaterial, id: 'changed-type', type: '交付件' }],
 [sourceMaterial, { ...sourceMaterial, id: 'old-2', entryContent: '第二条录入' }, { ...sourceMaterial, id: 'foreign', applicationId: 'another', entryContent: '别的申请' }])
assert.deepEqual(inherited.map(row => row.entryContent), ['第一条录入', '第二条录入', undefined, undefined, undefined])
assert.equal(inherited[0].responsibleRole, '版本负责人')
assert.equal(inherited[0].reviewStatus, 'not_reviewed')
assert.equal(inherited[0].reviewRemark, undefined)
assert.equal(inherited[0].delegatedTo, undefined)
assert.equal(inherited[0].aiCheckStatus, 'in_progress')
assert.notEqual(inherited[0].deliverables[0], sourceMaterial.deliverables[0])
const reviewSource = { ...sourceMaterial, id: 'old-review', standard: '稳定性标准', description: '场景一', checkItem: undefined }
delete reviewSource.checkItem
const reviewFresh = { ...freshMaterial, id: 'new-review', standard: '稳定性标准', description: '场景二', checkItem: undefined }
delete reviewFresh.checkItem
assert.equal(inheritTransferMaterialContent(sourceApplication, targetApplication, [reviewFresh], [reviewSource])[0].entryContent, undefined)
assert.equal(inheritTransferMaterialContent(sourceApplication, targetApplication, [{ ...reviewFresh, description: '场景一' }], [reviewSource])[0].entryContent, '第一条录入')
// Assignment eligibility reads current PMS permission scope; it never grants access itself.
const { usePermissionStore } = loadTypeScriptModule(root, 'src/stores/permission.ts')
const restrictedProject = { id: 'mock-machine-3-4' }
const participant09 = { id: 'login-演示用户09', name: '演示用户09' }
const admin01 = { id: 'login-演示用户01', name: '演示用户01' }
assert.equal(canAssignTransferParticipant(participant09, restrictedProject), false)
assert.equal(canAssignTransferParticipant(admin01, restrictedProject), true)
assert.equal(canAssignTransferParticipant({ id: 'u001', name: '演示用户09' }, restrictedProject), false)
const permissionBefore = usePermissionStore.getState()
try {
  const scope = restrictedProject.id
  const roles = [...(permissionBefore.rolesByProject[scope] || []), { name: '回归转维授权', members: [participant09.name], isFixed: false }]
  const grants = { ...(permissionBefore.rolePermissionsByProject[scope] || {}), '回归转维授权': { 'basicInfo:transferView': true, 'basicInfo:查看': false } }
  usePermissionStore.setState({ rolesByProject: { ...permissionBefore.rolesByProject, [scope]: roles }, rolePermissionsByProject: { ...permissionBefore.rolePermissionsByProject, [scope]: grants } })
  assert.equal(canAssignTransferParticipant(participant09, restrictedProject), true, 'transfer-only access remains sufficient')
  assert.equal(canAssignTransferParticipant(participant09, { id: 'permission-child', parentProjectId: ` ${scope} ` }), true, 'child uses its parent permission scope')
  const granted = usePermissionStore.getState()
  usePermissionStore.setState({ rolePermissionsByProject: { ...granted.rolePermissionsByProject, [scope]: { ...grants, '回归转维授权': { 'basicInfo:transferView': false } } } })
  assert.equal(canAssignTransferParticipant(participant09, restrictedProject), false, 'latest revoked permission blocks a previously selectable assignment')
  assert.equal(canAssignTransferParticipant(participant09, { id: 'permission-child', parentProjectId: scope }), false)
} finally {
  usePermissionStore.setState({ rolesByProject: permissionBefore.rolesByProject, rolePermissionsByProject: permissionBefore.rolePermissionsByProject })
}
assert.equal(canAssignTransferParticipant(participant09, restrictedProject), false)
// Pipeline role dots follow source rejection semantics and preserve configured role labels/order.
const { getTransferPipelineRoleDots } = loadTypeScriptModule(root, 'src/components/transfer/transferPipelineState.ts')
const roleProgress = [
  { role: '版本负责人', entryStatus: 'completed', reviewStatus: 'rejected' },
  { role: '测试代表', entryStatus: 'not_started', reviewStatus: 'not_started' },
  { role: '新增的跨产品线平台集成与影像质量协同责任角色', entryStatus: 'in_progress', reviewStatus: 'in_progress' },
  { role: '系统', entryStatus: 'completed', reviewStatus: 'completed' },
  { role: '影像', entryStatus: 'completed', reviewStatus: 'not_started' },
  { role: '自定义角色六', entryStatus: 'not_started', reviewStatus: 'not_started' },
  { role: '自定义角色七', entryStatus: 'completed', reviewStatus: 'completed' },
]
const beforeDots = structuredClone(roleProgress)
const entryDots = getTransferPipelineRoleDots(roleProgress, 'entry')
const reviewDots = getTransferPipelineRoleDots(roleProgress, 'review')
assert.deepEqual(entryDots.map(dot => dot.role), roleProgress.map(progress => progress.role))
assert.equal(entryDots.length, 7, 'role count is dynamic rather than fixed at five')
assert.deepEqual(entryDots[0], { role: '版本负责人', status: 'rejected', statusLabel: '审核不通过，需修改', label: '版本负责人: 审核不通过，需修改', color: '#ff4d4f' })
assert.deepEqual(reviewDots[0], { role: '版本负责人', status: 'not_started', statusLabel: '待审核（资料修改后再次审核）', label: '版本负责人: 待审核（资料修改后再次审核）', color: '#d9d9d9' })
assert.deepEqual(entryDots.slice(1, 4).map(dot => dot.statusLabel), ['未开始', '进行中', '已完成'])
assert.equal(reviewDots[4].statusLabel, '未开始', 'review dot uses its own status rather than completed entry')
assert.equal(entryDots[4].statusLabel, '已完成')
assert.deepEqual(getTransferPipelineRoleDots([], 'entry'), [])
assert.deepEqual(roleProgress, beforeDots, 'rendering rejection does not mutate the stored role progress')
// Source dialog semantics distinguish single reassignment from a fresh batch assignment.
const { getTransferDelegateAssignee, getTransferParticipantLabel, getTransferAiDetail, matchesTransferColumnSearch, getTransferContentHref } = loadTypeScriptModule(root, 'src/components/transfer/transferInteraction.ts')
const delegatedOne = { ...item, delegatedTo: ['u004'], reviewDelegatedTo: ['u006'] }
assert.equal(getTransferDelegateAssignee([delegatedOne], 'entry'), 'u004')
assert.equal(getTransferDelegateAssignee([delegatedOne], 'review'), 'u006')
assert.equal(getTransferDelegateAssignee([delegatedOne, { ...delegatedOne, id: 'second' }], 'entry'), undefined)
assert.equal(getTransferDelegateAssignee([delegatedOne, { ...delegatedOne, id: 'second' }], 'review'), undefined)
assert.equal(getTransferDelegateAssignee([], 'review'), undefined)
const directoryPerson = { id: 'login-演示用户02', name: '演示用户02', role: 'SPM', department: '示例项目组' }
assert.equal(getTransferParticipantLabel(directoryPerson), '演示用户02（SPM - 示例项目组）')
assert.equal(getTransferParticipantLabel(directoryPerson, { ...configuredSummary, team: { research: [{ ...directoryPerson, role: 'VERSION_PM', department: '项目团队' }], maintenance: [{ ...directoryPerson, role: 'QUALITY_OWNER', department: '示例质量组' }] } }), '演示用户02（版本负责人 / 质量代表 - 示例质量组）')
assert.equal(getTransferParticipantLabel({ id: 'missing', name: '待配置人员', role: '', department: '' }), '待配置人员（未配置角色 - 未配置部门）')
// AI status details use the actual stored result, preserve newlines and cover retry failures.
assert.equal(getTransferAiDetail({ ...item, aiCheckStatus: 'failed', aiCheckResult: '检查失败\n需要补充链接' }), '检查失败\n需要补充链接')
assert.equal(getTransferAiDetail({ ...item, aiCheckStatus: 'in_progress', aiCheckResult: undefined }), 'AI检查进行中...')
assert.equal(getTransferAiDetail({ ...item, aiCheckStatus: 'passed', aiCheckResult: undefined }), 'AI检查通过，内容符合要求。')
assert.equal(getTransferAiDetail({ ...item, aiCheckStatus: 'failed', aiCheckResult: undefined }), 'AI检查不通过，请修改后重新提交。')
assert.equal(getTransferAiDetail({ ...item, aiCheckStatus: 'not_started', aiCheckResult: '过期结果' }), '')
assert.equal(getTransferAiDetail(undefined), '')
// Column filtering is case-insensitive, resets on an empty search and isolates material kinds.
assert.equal(matchesTransferColumnSearch({ ...item, checkItem: 'IPM 接口完整性' }, 'checkItem', 'ipm'), true)
assert.equal(matchesTransferColumnSearch({ ...item, checkItem: 'IPM 接口完整性' }, 'checkItem', '稳定性'), false)
assert.equal(matchesTransferColumnSearch({ ...item, checkItem: 'IPM 接口完整性' }, 'checkItem', ''), true)
assert.equal(matchesTransferColumnSearch(reviewSource, 'description', '场景一'), true)
assert.equal(matchesTransferColumnSearch(reviewSource, 'checkItem', '相同标准'), false)
// The source's directory link remains reachable, while unrelated URL schemes stay plain text.
assert.equal(getTransferContentHref('https://example.com/docs'), 'https://example.com/docs')
assert.equal(getTransferContentHref('http://example.com/docs'), 'http://example.com/docs')
assert.equal(getTransferContentHref(String.raw`\\server\transfer\资料`), 'file://///server/transfer/资料')
assert.equal(getTransferContentHref('javascript:alert(1)'), undefined)
assert.equal(getTransferContentHref('data:text/html,<script>'), undefined)
assert.equal(getTransferContentHref('file:///etc/passwd'), undefined)

console.log('Transfer UI guards: role access, final review, duplicate-safe reopen, permission scopes and dynamic role dots, source dialogs, search and content links passed')
