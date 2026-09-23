import { mapTransferOwnerToPmsUser } from '@/lib/todoAggregation'
import { MOCK_TM_USERS, type TransferApplication, type CheckListItem, type ReviewElement, type RoleNodeStatus, type LegacyTask } from '@/mock/transfer-maintenance'
import { createTransferTemplateVersions, getCurrentTransferTemplates, getTransferProjectType, getTransferMember, getTransferRoleConfig, type TransferTemplateSet, type TransferTeamRole } from '@/lib/transferConfig'

export type TransferActor = { id: string; name: string; isAdmin?: boolean }
type TransferProject = { id: string; name: string } | null
export type TransferItem = CheckListItem | ReviewElement
export function matchesTransferProject(app: TransferApplication, project: TransferProject): boolean {
  return Boolean(project && (app.projectId === project.id || (/^proj_\d+$/.test(app.projectId) && app.projectName === project.name)))
}
export function matchesTransferActor(actor: TransferActor, id?: string, name?: string): boolean {
  if (!id || !name) return false
  return (actor.id === id && actor.name === name) || mapTransferOwnerToPmsUser(id, name) === actor.name
}
export function matchesTransferDelegate(actor: TransferActor, ids?: readonly string[]): boolean {
  return (ids ?? []).some(id => id === actor.id || mapTransferOwnerToPmsUser(id, MOCK_TM_USERS.find(user => user.id === id)?.name) === actor.name)
}
const active = (app: TransferApplication, project: TransferProject) => matchesTransferProject(app, project) && app.status === 'in_progress'
const entryOpen = (app: TransferApplication, item: TransferItem, project: TransferProject) => active(app, project) && item.applicationId === app.id && app.pipeline.maintenanceSpmReview !== 'success' && ['not_reviewed', 'rejected'].includes(item.reviewStatus)
const reviewOpen = (app: TransferApplication, item: TransferItem, project: TransferProject) => active(app, project) && item.applicationId === app.id && app.pipeline.maintenanceReview === 'in_progress' && item.entryStatus === 'entered' && item.aiCheckStatus === 'passed' && ['reviewing', 'rejected'].includes(item.reviewStatus)
export function canEnterTransferItem(app: TransferApplication, item: TransferItem, actor: TransferActor, project: TransferProject): boolean {
  return entryOpen(app, item, project) && (matchesTransferActor(actor, item.entryPersonId, item.entryPerson) || matchesTransferDelegate(actor, item.delegatedTo))
}
export function canReviewTransferItem(app: TransferApplication, item: TransferItem, actor: TransferActor, project: TransferProject): boolean {
  return reviewOpen(app, item, project) && (matchesTransferActor(actor, item.reviewPersonId, item.reviewPerson) || matchesTransferDelegate(actor, item.reviewDelegatedTo))
}
export function canDelegateTransferItem(app: TransferApplication, item: TransferItem, actor: TransferActor, project: TransferProject, side: 'entry' | 'review'): boolean {
  if (!active(app, project) || item.applicationId !== app.id || app.pipeline.maintenanceSpmReview === 'success') return false
  if (side === 'entry') return item.reviewStatus !== 'passed'
    && (matchesTransferActor(actor, item.entryPersonId, item.entryPerson) || matchesTransferDelegate(actor, item.delegatedTo))
  return ['in_progress', 'success'].includes(app.pipeline.maintenanceReview)
    && item.entryStatus === 'entered' && item.aiCheckStatus === 'passed'
    && ['reviewing', 'rejected', 'passed'].includes(item.reviewStatus)
    && (matchesTransferActor(actor, item.reviewPersonId, item.reviewPerson) || matchesTransferDelegate(actor, item.reviewDelegatedTo))
}
export function getTransferRoleLabel(app: TransferApplication, role: string): string {
  return app.teamConfig?.find(config => config.roleName === role || config.ipmRoleCode === role)?.roleName ?? role
}
export function canManageTransfer(app: TransferApplication, actor: TransferActor, project: TransferProject, canApply: boolean): boolean {
  const owner = getTransferMember(app.team.research, app.finalReviewRole ?? 'SPM', app.teamConfig)
  return Boolean(canApply && matchesTransferProject(app, project) && (actor.isAdmin || matchesTransferActor(actor, owner?.id, owner?.name)))
}
export function canCloseTransfer(app: TransferApplication, actor: TransferActor, project: TransferProject, canApply: boolean): boolean {
  return Boolean(canApply && active(app, project) && matchesTransferActor(actor, app.applicantId, app.applicant)
    && app.pipeline.maintenanceSpmReview !== 'in_progress' && app.pipeline.maintenanceSpmReview !== 'success'
    && (app.pipeline.maintenanceReview === 'not_started' || !app.pipeline.roleProgress.some(role => role.reviewStatus === 'in_progress' || role.reviewStatus === 'completed')))
}
export function getMaintenanceSpmReviewAccess(app: TransferApplication | undefined, actor: TransferActor, project: TransferProject) {
  const reviewer = app && getTransferMember(app.team.maintenance, app.finalReviewRole ?? 'SPM', app.teamConfig)
  const isReviewer = Boolean(reviewer && matchesTransferActor(actor, reviewer.id, reviewer.name))
  const roleProgress = app?.pipeline.roleProgress ?? []
  const allPassed = roleProgress.length > 0 && roleProgress.every(role => role.reviewStatus === 'completed')
  const finalOpen = app?.pipeline.maintenanceSpmReview === 'not_started' || app?.pipeline.maintenanceSpmReview === 'in_progress'
  const isRejectionMode = Boolean(finalOpen && app?.pipeline.maintenanceReview === 'in_progress' && roleProgress.some(role => role.reviewStatus === 'rejected'))
  const ready = app?.pipeline.maintenanceSpmReview === 'in_progress' && allPassed
  const allowed = Boolean(app && active(app, project) && isReviewer)
  return { reviewer, isReviewer, isRejectionMode, canApprove: allowed && ready && !isRejectionMode, canReject: allowed && (ready || isRejectionMode) }
}
export function canEditTransferLegacy(app: TransferApplication, actor: TransferActor, project: TransferProject): boolean {
  const access = getMaintenanceSpmReviewAccess(app, actor, project)
  return access.canApprove || access.canReject
}
/** Follow-up owners can finish an existing task after the transfer itself has ended. */
export function canResolveTransferLegacy(app: TransferApplication, task: LegacyTask, actor: TransferActor, project: TransferProject, canView: boolean): boolean {
  return canView && matchesTransferProject(app, project) && task.applicationId === app.id
    && task.status === 'open' && task.responsiblePerson === actor.name
}
export function createTransferMaterials(app: TransferApplication, templates?: TransferTemplateSet) {
  const kind = getTransferProjectType(app.projectType)
  const source = templates ?? getCurrentTransferTemplates(kind, createTransferTemplateVersions())
  const roleFor = (label: string, fallback: string) => {
    const raw = label.replace(/^(在研|维护)/, '')
    const exact = app.teamConfig?.find(role => role.roleName === raw || role.ipmRoleCode === raw)
    if (exact) return exact.roleName
    const clean = raw.replace(/集成开发代表$|开发代表$/, '')
    return app.teamConfig?.find(role => role.roleName === clean || role.ipmRoleCode === clean)?.roleName ?? (clean || fallback)
  }
  const fields = (role: string, entryRole: string, reviewRole: string) => {
    const entry = getTransferMember(app.team.research, roleFor(entryRole, role), app.teamConfig)
    const review = getTransferMember(app.team.maintenance, roleFor(reviewRole, role), app.teamConfig)
    return { applicationId: app.id, responsibleRole: role, entryPerson: entry?.name ?? '', entryPersonId: entry?.id ?? '', reviewPerson: review?.name ?? '', reviewPersonId: review?.id ?? '', deliverables: [], entryStatus: 'not_entered' as const, aiCheckStatus: 'not_started' as const, reviewStatus: 'not_reviewed' as const }
  }
  const checklist: CheckListItem[] = source.checklist.map((row, index) => ({ ...fields(row.responsibleRole, row.entryRole, row.reviewRole), id: `cl_${app.id}_${row.id}`, seq: row.seq ?? index + 1, type: row.type, checkItem: row.checkItem, aiCheckRule: row.aiCheckRule }))
  const reviewElements: ReviewElement[] = (kind === 'tOS版本项目' ? [] : source.reviewElements).map((row, index) => ({ ...fields(row.responsibleRole, row.entryRole, row.reviewRole), id: `re_${app.id}_${row.id}`, seq: row.seq ?? index + 1, type: row.type, standard: row.standard, description: row.description, remark: row.remark, aiCheckRule: row.aiCheckRule }))
  return { checklist, reviewElements }
}
export function getMissingTransferTeamRoles(team: TransferApplication['team'], config: TransferTeamRole[] = getTransferRoleConfig('整机产品项目')): string[] {
  return (['research', 'maintenance'] as const).flatMap(side => config.filter(role => !getTransferMember(team[side], role.roleName, config)).map(role => `${side === 'research' ? '在研' : '维护'}${role.roleName}`))
}
export function syncTransferPipeline(app: TransferApplication, checklist: CheckListItem[], reviewElements: ReviewElement[]): TransferApplication {
  if (app.status !== 'in_progress' || app.pipeline.maintenanceSpmReview === 'success') return app
  const items = [...checklist, ...(app.projectType === 'tOS版本项目' ? [] : reviewElements)].filter(item => item.applicationId === app.id)
  if (!items.length) return app
  // Older applications have no configuration snapshot. Keep all of their team roles visible,
  // including roles with no material rows, when delegation or entry refreshes the pipeline.
  const legacyRoles = [...app.pipeline.roleProgress.map(role => role.role), ...app.team.research.map(member => member.role === 'TPM' ? '测试' : member.role)]
  const roles = [...new Set([...(app.teamConfig?.map(role => role.roleName) ?? legacyRoles), ...items.map(item => item.responsibleRole)])]
  const roleProgress = roles.map(role => {
    const rows = items.filter(item => item.responsibleRole === role)
    // Configured roles without template rows have no material work and do not block the flow.
    const entryStatus: RoleNodeStatus = rows.every(item => item.entryStatus === 'entered' && item.aiCheckStatus === 'passed' && item.reviewStatus !== 'not_reviewed') ? 'completed' : rows.some(item => item.entryStatus !== 'not_entered') ? 'in_progress' : 'not_started'
    const reviewStatus: RoleNodeStatus = rows.some(item => item.reviewStatus === 'rejected') ? 'rejected' : rows.every(item => item.reviewStatus === 'passed') ? 'completed' : rows.some(item => item.reviewStatus !== 'not_reviewed') ? 'in_progress' : 'not_started'
    return { role, entryStatus, reviewStatus }
  })
  const entered = roleProgress.every(role => role.entryStatus === 'completed')
  const reviewed = roleProgress.every(role => role.reviewStatus === 'completed')
  const reviewStarted = items.some(item => item.reviewStatus !== 'not_reviewed')
  return { ...app, updatedAt: new Date().toISOString(), pipeline: { ...app.pipeline, roleProgress, dataEntry: entered ? 'success' : 'in_progress', maintenanceReview: reviewed ? 'success' : reviewStarted ? 'in_progress' : 'not_started', maintenanceSpmReview: reviewed ? 'in_progress' : 'not_started', infoChange: 'not_started' } }
}
export { createMockTransferMaterials as seedTransferMaterials } from '@/mock/transfer-materials'
