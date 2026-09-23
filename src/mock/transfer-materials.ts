import type { TransferApplication, CheckListItem, ReviewElement } from '@/mock/transfer-maintenance'
import { MOCK_CHECKLIST_TEMPLATES, MOCK_TOS_CHECKLIST_TEMPLATES, MOCK_REVIEW_ELEMENT_TEMPLATES } from '@/mock/transfer-template-source'

/** All seeded workflow screens use the same templates as the configuration center. */
export function createMockTransferMaterials(app: TransferApplication) {
  const tos = app.projectType === 'tOS版本项目'
  const fields = (role: string, index: number) => {
    const memberRole = role === '测试' ? 'TPM' : role
    const entry = app.team.research.find(member => member.role === memberRole)
    const reviewer = app.team.maintenance.find(member => member.role === memberRole)
    const progress = app.pipeline.roleProgress.find(item => item.role === role)
    const submitted = app.pipeline.dataEntry === 'success' || progress?.entryStatus === 'completed'
    const entered = submitted || (progress?.entryStatus === 'in_progress' && (['SPM', '底软'].includes(role) || index % 3 === 0))
    const draft = !entered && progress?.entryStatus === 'in_progress' && index % 3 === 1
    const reviewed = app.pipeline.maintenanceReview === 'success' || progress?.reviewStatus === 'completed'
    return {
      applicationId: app.id, responsibleRole: role,
      entryPerson: entry?.name ?? '', entryPersonId: entry?.id ?? '',
      reviewPerson: reviewer?.name ?? '', reviewPersonId: reviewer?.id ?? '',
      deliverables: [], entryContent: entered ? '已完成资料录入（模拟数据）' : draft ? '资料整理中（模拟草稿）' : undefined,
      entryStatus: entered ? 'entered' as const : draft ? 'draft' as const : 'not_entered' as const,
      aiCheckStatus: entered ? 'passed' as const : 'not_started' as const,
      reviewStatus: reviewed ? 'passed' as const : progress?.reviewStatus === 'rejected' ? 'rejected' as const : submitted ? 'reviewing' as const : 'not_reviewed' as const,
    }
  }
  const checklist: CheckListItem[] = (tos ? MOCK_TOS_CHECKLIST_TEMPLATES : MOCK_CHECKLIST_TEMPLATES).map((row, index) => ({
    ...fields(row.responsibleRole, index), id: `cl_${app.id}_${row.id}`, seq: row.seq!, type: row.type, checkItem: row.checkItem, aiCheckRule: row.aiCheckRule,
  }))
  const reviewElements: ReviewElement[] = (tos ? [] : MOCK_REVIEW_ELEMENT_TEMPLATES).map((row, index) => ({
    ...fields(row.responsibleRole, index), id: `re_${app.id}_${row.id}`, seq: row.seq!, type: row.type, standard: row.standard, description: row.description, remark: row.remark, aiCheckRule: row.aiCheckRule,
  }))
  return { checklist, reviewElements }
}
