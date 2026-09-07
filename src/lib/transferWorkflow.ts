import { mapTransferOwnerToPmsUser } from '@/lib/todoAggregation'
import {
  MOCK_CHECKLIST_TEMPLATES, MOCK_REVIEW_ELEMENT_TEMPLATES,
  type TransferApplication, type CheckListItem, type ReviewElement, type TMTeamMember,
  type PipelineRole, type RoleNodeStatus,
} from '@/mock/transfer-maintenance'

type TransferActor = { id: string; name: string }
type TransferProject = { id: string; name: string } | null
export type TransferItem = CheckListItem | ReviewElement

export function matchesTransferProject(app: TransferApplication, project: TransferProject): boolean {
  if (!project) return false
  return app.projectId === project.id || (/^proj_\d+$/.test(app.projectId) && app.projectName === project.name)
}

export function matchesTransferActor(actor: TransferActor, id?: string, name?: string): boolean {
  if (!id || !name) return false
  return (actor.id === id && actor.name === name) || mapTransferOwnerToPmsUser(id, name) === actor.name
}

const teamRole = (role: string) => role === '测试' ? 'TPM' : role
const activeApplication = (app: TransferApplication, project: TransferProject) => matchesTransferProject(app, project) && app.status === 'in_progress'

export function canEnterTransferItem(app: TransferApplication, item: TransferItem, actor: TransferActor, project: TransferProject): boolean {
  return activeApplication(app, project) && item.applicationId === app.id && app.pipeline.sqaReview !== 'success'
    && (app.pipeline.dataEntry !== 'success' || item.reviewStatus === 'rejected')
    && app.team.research.some(member => member.role === teamRole(item.responsibleRole) && matchesTransferActor(actor, member.id, member.name))
    && matchesTransferActor(actor, item.entryPersonId, item.entryPerson)
}

export function canReviewTransferItem(app: TransferApplication, item: TransferItem, actor: TransferActor, project: TransferProject): boolean {
  return activeApplication(app, project) && item.applicationId === app.id && app.pipeline.maintenanceReview === 'in_progress'
    && item.entryStatus === 'entered' && item.aiCheckStatus === 'passed' && item.reviewStatus !== 'passed'
    && app.team.maintenance.some(member => member.role === teamRole(item.responsibleRole) && matchesTransferActor(actor, member.id, member.name))
    && matchesTransferActor(actor, item.reviewPersonId, item.reviewPerson)
}

export function canSqaReviewTransfer(app: TransferApplication, actor: TransferActor, project: TransferProject): boolean {
  return activeApplication(app, project) && app.pipeline.dataEntry === 'success'
    && app.pipeline.maintenanceReview === 'success' && app.pipeline.sqaReview === 'in_progress'
    && app.team.research.some(member => member.role === 'SQA' && matchesTransferActor(actor, member.id, member.name))
}

// Instantiate records from the current templates, never from another application's filled content.
export function createTransferMaterials(app: TransferApplication) {
  const member = (side: 'research' | 'maintenance', role: string): TMTeamMember | undefined => app.team[side].find(person => person.role === teamRole(role))
  const fields = (role: string) => {
    const entry = member('research', role)
    const review = member('maintenance', role)
    return {
      applicationId: app.id, responsibleRole: role as PipelineRole,
      entryPerson: entry?.name || '', entryPersonId: entry?.id || '',
      reviewPerson: review?.name || '', reviewPersonId: review?.id || '',
      deliverables: [], entryStatus: 'not_entered' as const,
      aiCheckStatus: 'not_started' as const, reviewStatus: 'not_reviewed' as const,
    }
  }
  const checklist: CheckListItem[] = MOCK_CHECKLIST_TEMPLATES.map((template, index) => ({
    ...fields(template.responsibleRole), id: `cl_${app.id}_${template.id}`, seq: index + 1,
    type: template.type, checkItem: template.checkItem, aiCheckRule: template.aiCheckRule,
  }))
  const reviewElements: ReviewElement[] = MOCK_REVIEW_ELEMENT_TEMPLATES.map((template, index) => ({
    ...fields(template.responsibleRole), id: `re_${app.id}_${template.id}`, seq: index + 1,
    standard: template.standard, description: template.description, remark: template.remark, aiCheckRule: template.aiCheckRule,
  }))
  return { checklist, reviewElements }
}

export function getMissingTransferTeamRoles(team: TransferApplication['team']): string[] {
  const roles = Array.from(new Set([...MOCK_CHECKLIST_TEMPLATES, ...MOCK_REVIEW_ELEMENT_TEMPLATES].map(item => teamRole(item.responsibleRole))))
  return [
    ...roles.filter(role => !team.research.some(member => member.role === role)).map(role => `在研${role}`),
    ...roles.filter(role => !team.maintenance.some(member => member.role === role)).map(role => `维护${role}`),
    ...(!team.research.some(member => member.role === 'SQA') ? ['在研SQA'] : []),
  ]
}

export function syncTransferPipeline(app: TransferApplication, checklist: CheckListItem[], reviewElements: ReviewElement[]): TransferApplication {
  if (app.status !== 'in_progress') return app
  const items = [...checklist, ...reviewElements].filter(item => item.applicationId === app.id)
  if (!items.length) return app
  const roleProgress = Array.from(new Set(items.map(item => item.responsibleRole))).map(role => {
    const rows = items.filter(item => item.responsibleRole === role)
    const entryStatus: RoleNodeStatus = rows.every(item => item.entryStatus === 'entered' && item.aiCheckStatus === 'passed') ? 'completed'
      : rows.some(item => item.entryStatus !== 'not_entered') ? 'in_progress' : 'not_started'
    const reviewStatus: RoleNodeStatus = rows.some(item => item.reviewStatus === 'rejected') ? 'rejected'
      : rows.every(item => item.reviewStatus === 'passed') ? 'completed'
      : rows.some(item => item.reviewStatus !== 'not_reviewed') ? 'in_progress' : 'not_started'
    return { role, entryStatus, reviewStatus }
  })
  const entered = roleProgress.every(role => role.entryStatus === 'completed')
  const reviewed = roleProgress.every(role => role.reviewStatus === 'completed')
  return { ...app, updatedAt: new Date().toISOString(), pipeline: {
    ...app.pipeline, roleProgress,
    dataEntry: entered ? 'success' : 'in_progress',
    maintenanceReview: reviewed ? 'success' : entered ? 'in_progress' : 'not_started',
    sqaReview: reviewed ? app.pipeline.sqaReview === 'success' ? 'success' : 'in_progress' : 'not_started',
    infoChange: reviewed ? app.pipeline.infoChange : 'not_started',
  } }
}

// Seed the other historical applications with their own team and phase snapshots.
export function seedTransferMaterials(app: TransferApplication) {
  const generated = createTransferMaterials(app)
  const applyStatus = <T extends TransferItem>(item: T): T => {
    const role = app.pipeline.roleProgress.find(progress => progress.role === item.responsibleRole)
    const entered = app.pipeline.dataEntry === 'success' || role?.entryStatus === 'completed'
    const reviewed = app.pipeline.maintenanceReview === 'success' || role?.reviewStatus === 'completed'
    return { ...item,
      entryStatus: entered ? 'entered' : 'not_entered',
      aiCheckStatus: entered ? 'passed' : 'not_started',
      entryContent: entered ? '已完成资料录入（模拟数据）' : undefined,
      reviewStatus: reviewed ? 'passed' : role?.reviewStatus === 'rejected' ? 'rejected' : 'not_reviewed',
    }
  }
  return { checklist: generated.checklist.map(applyStatus), reviewElements: generated.reviewElements.map(applyStatus) }
}
