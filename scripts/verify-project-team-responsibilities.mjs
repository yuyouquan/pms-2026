import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
const load = createTypeScriptModuleLoader()
const get = file => load(path.resolve(file))
const { useProjectTeamStore } = get('src/stores/projectTeam.ts')
const { usePermissionStore } = get('src/stores/permission.ts')
const workflow = get('src/lib/transferWorkflow.ts')
const interaction = get('src/components/transfer/transferInteraction.ts')
const { resolveMrPermissions } = get('src/lib/mrVersionPlanRules.ts')
const member = '演示用户10'
useProjectTeamStore.getState().syncProjects([{ id: '1', mockTeamSourceId: 'legacy:1' }, { id: '2' }])
const project = { id: '1', name: 'Example' }
const actor = { id: `login-${member}`, name: member, isAdmin: true }
const person = { id: actor.id, name: member, role: 'SPM' }
const app = { id: 'app', projectId: '1', projectName: 'Example', status: 'in_progress', applicantId: actor.id, applicant: member, team: { research: [person], maintenance: [person] }, pipeline: { maintenanceSpmReview: 'not_started', maintenanceReview: 'not_started', roleProgress: [] } }
const item = { id: 'item', applicationId: 'app', responsibleRole: 'SPM', entryPersonId: actor.id, entryPerson: member, reviewPersonId: actor.id, reviewPerson: member, reviewStatus: 'not_reviewed', entryStatus: 'entered', aiCheckStatus: 'passed' }
assert.equal(workflow.canEnterTransferItem(app, item, actor, project), false, 'named entry owner cannot bypass team read-only')
assert.equal(workflow.canDelegateTransferItem(app, item, actor, project, 'entry'), false)
assert.equal(workflow.canManageTransfer(app, actor, project, true), false, 'stale admin prop cannot bypass authoritative team restriction')
assert.equal(workflow.canCloseTransfer(app, actor, project, true), false)
assert.equal(interaction.getTransferRoleSubmission(app, 'SPM', [item], actor, project, true).canSubmit, false)
assert.equal(interaction.canAssignTransferParticipant(person, project), false)
const reviewApp = { ...app, pipeline: { ...app.pipeline, maintenanceReview: 'in_progress', maintenanceSpmReview: 'in_progress', roleProgress: [{ reviewStatus: 'completed' }] } }
assert.equal(workflow.canReviewTransferItem(reviewApp, { ...item, reviewStatus: 'reviewing' }, actor, project), false)
assert.equal(workflow.getMaintenanceSpmReviewAccess(reviewApp, actor, project).canApprove, false)
assert.equal(interaction.canAppendTransferRoleLegacy(app, 'SPM', [{ ...item, reviewStatus: 'passed' }], actor, project, true), false)
assert.equal(workflow.canResolveTransferLegacy(app, { applicationId: 'app', status: 'open', responsiblePerson: member }, actor, project, true), false)
const mrInput = { currentUser: member, context: 'tos', tosProjectId: '1', globalAdminUsers: [member], tosManagerUsers: [member] }
assert.equal(resolveMrPermissions(mrInput).canEditTos, false, 'named MR manager and stale global admin array cannot elevate reader')
assert.equal(resolveMrPermissions({ ...mrInput, context: 'joint-machine', machineProjectId: '1', tosProjectId: '2' }).canEditMachine, false)
assert.equal(workflow.canEnterTransferItem({ ...app, projectId: '2' }, item, actor, { ...project, id: '2' }), true, 'target scope does not block unrelated project')
const original = get('src/lib/permissionCenterSeed.ts').createPermissionCenterSeed()
usePermissionStore.setState({ permissionCenter: { ...original, roles: original.roles.map(role => role.builtin === 'superadmin' ? { ...role, members: [...role.members, member] } : role) } })
assert.equal(workflow.canEnterTransferItem(app, item, actor, project), true, 'authoritative builtin superadmin exempt')
assert.equal(resolveMrPermissions(mrInput).canEditTos, true)
usePermissionStore.setState({ permissionCenter: original })

const { canExecuteProjectTeamWrite } = get('src/lib/projectTeamMutationGuard.ts')
const { useProjectStore } = get('src/stores/project.ts')
const { usePlanStore } = get('src/stores/plan.ts')
useProjectStore.setState({ currentLoginUser: member, selectedProject: project })
useProjectTeamStore.getState().syncProjects([project, { id: '2' }])
// An opening with existing project access (before source membership arrives).
// The guard must also reject callbacks after all project access is revoked.
usePermissionStore.getState().setRolesForProject('1', [{ name: '已有项目职责', members: [member], departments: [], isFixed: false }])
// Opening before source membership arrives must not preserve a write grant.
assert.equal(canExecuteProjectTeamWrite(member, '1', useProjectStore.getState()), true)
useProjectTeamStore.getState().syncProjects([{ ...project, sourceBid: 'EXT-001' }, { id: '2' }])
const { canMaintainLevel1Plan } = get('src/lib/level1PlanRules.ts')
for (const projectType of ['整机产品项目', '技术项目']) {
  const namedResponsibility = canMaintainLevel1Plan({ projectType, currentUser: member, spmUsers: [member], technicalLead: [member], globalAdmins: [] })
  assert.equal(namedResponsibility, true, 'named SPM/technical lead fixture is genuinely privileged')
  assert.equal(namedResponsibility && canExecuteProjectTeamWrite(member, '1', useProjectStore.getState()), false, 'live guard overrides independent named plan responsibility')
}
const beforeTasks = usePlanStore.getState().tasks
const staleTaskSubmit = () => { if (canExecuteProjectTeamWrite(member, '1', useProjectStore.getState())) usePlanStore.getState().setTasks([{ id: 'forbidden' }]) }
staleTaskSubmit()
assert.equal(usePlanStore.getState().tasks, beforeTasks, 'shared guard blocks real plan setter after source change (helper-level coverage)')
assert.equal(canExecuteProjectTeamWrite(member, '1', { currentLoginUser: '演示用户01', selectedProject: project }), false, 'stale user rejected')
assert.equal(canExecuteProjectTeamWrite(member, '1', { currentLoginUser: member, selectedProject: { id: '2' } }), false, 'stale target project rejected')
const { hasPermission } = get('src/stores/permission.ts')
for (const action of ['plan:导出', 'plan:导入', 'plan:一级计划-分享']) assert.equal(hasPermission(member, '1', action), false)

const { createMrVersionPlanStore } = get('src/stores/mrVersionPlan.ts')
const mr = createMrVersionPlanStore()
const templateInstance = Object.values(mr.getState().tosInstancesByProjectId).flat()[0]
const instance = { ...templateInstance, projectId: '1' }
const machine = { projectId: '1', tosProjectId: '2', tosVersion: instance.tosVersion, transferType: '1', dates: {}, updatedBy: member, updatedAt: '2026-09-28T00:00:00.000Z' }
const key = `1::${instance.tosVersion}`
mr.setState({ tosInstancesByProjectId: { '1': [instance] }, machinePlansByKey: { [key]: machine }, machineRowLocks: {}, stopReleaseRecords: [] })
const staleGrant = { canView: true, canEditTemplate: true, canEditTos: true, canEditMachine: true, canEditMarket: true, canStopRelease: true, canManageMachineLocks: true }
const beforeMr = JSON.stringify(mr.getState())
const leaf = instance.activities.find(row => row.parentId)?.id
assert.equal(mr.getState().updateTosDate('1', instance.tosVersion, leaf, '2027-02-01', member, staleGrant), false)
assert.equal(mr.getState().addTosVersionInstance({ projectId: '1', tosVersion: '99.0.0', actor: member, now: '2026-09-28' }, staleGrant), false)
assert.equal(mr.getState().updateMachineTransferType(key, '2', member, staleGrant), false)
assert.equal(mr.getState().updateMachineDate(key, leaf, '2027-02-01', member, staleGrant), false)
assert.equal(mr.getState().lockMachineRows([machine], member, staleGrant).processed, 0)
assert.equal(mr.getState().unlockMachineRows([machine], member, staleGrant).processed, 0)
assert.equal(mr.getState().stopRelease({ id: 'stop', projectId: '1', operator: member, stopDate: '2026-09-28', operatedAt: '2026-09-28', projectName: 'Example' }, staleGrant), false)
assert.equal(mr.getState().updateMarketDate({ projectId: '1', tosVersion: instance.tosVersion, market: 'TR', mainMarket: 'OP', activityId: leaf, value: '2027-02-01' }, member, staleGrant), false)
assert.equal(JSON.stringify(mr.getState()), beforeMr, 'all real MR mutations leave data and audits unchanged')
const otherMachine = { ...machine, projectId: '2' }
mr.setState({ machinePlansByKey: { [`2::${instance.tosVersion}`]: otherMachine } })
assert.equal(mr.getState().updateMachineTransferType(`2::${instance.tosVersion}`, '2', member, staleGrant), true, 'other project MR mutation unaffected')

const { useHrMachineStore } = get('src/stores/hrMachine.ts')
useProjectTeamStore.getState().syncProjects([{ ...project, sourceBid: 'EXT-001' }, { id: '2' }])
assert.equal(get('src/stores/permission.ts').isProjectTeamReadOnly(member, '1'), true, 'resource test uses live team membership')
const hr = useHrMachineStore.getState()
const resource = hr.projects.find(row => row.pmsProjectId === '1')
const version = resource.versions[0]
const beforeResource = JSON.stringify(hr.projects)
hr.updateVersion(resource.id, version.id, { estimatedInvestment: 99999 })
hr.deleteVersion(resource.id, version.id)
assert.throws(() => hr.updateVersionInline(resource.id, version.id, { type: 'departmentTotal', department: '示例研发部', value: 99999 }, '1'), /权限|编辑/)
assert.equal(JSON.stringify(useHrMachineStore.getState().projects), beforeResource, 'real resource edit/delete leave versions and operation logs unchanged')
const { projectTeamRows } = get('src/lib/projectTeamPresentation.ts')
const teamSnapshot = useProjectTeamStore.getState().teamsByProjectId['1']
const row = teamSnapshot.members[0]
const rows = projectTeamRows({ ...teamSnapshot, members: [row, { ...row, roles: ['Second', ...row.roles] }, { ...row, employeeId: '', name: 'Unknown' }] })
assert.equal(rows.length, 1)
assert.deepEqual(rows[0].roles, [...new Set([...row.roles, 'Second'])])
assert.equal(projectTeamRows(undefined).length, 0)
console.log('project-team responsibilities, real mutations, stale context, export denial and deduplication: passed')
