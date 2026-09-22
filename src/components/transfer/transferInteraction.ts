import { ALL_USERS } from '@/constants/permissions'
import { hasPermission, resolvePermissionProjectId } from '@/stores/permission'
import type { TransferApplication } from '@/mock/transfer-maintenance'
import { getTransferMember, getTransferRoleConfig, getTransferProjectType } from '@/lib/transferConfig'
import { matchesTransferActor, matchesTransferProject, type TransferActor, type TransferItem } from '@/lib/transferWorkflow'

/** A role submits its remaining work without reopening siblings already approved. */
export function getTransferRoleSubmission(
  application: TransferApplication,
  role: string,
  allItems: readonly TransferItem[],
  actor: TransferActor,
  project: { id: string; name: string } | null,
  canView: boolean,
): { canSubmit: boolean; itemIds: string[] } {
  const rows = allItems.filter(item => item.applicationId === application.id && item.responsibleRole === role)
  const coordinator = getTransferMember(application.team.research, role, application.teamConfig)
  const coordinates = matchesTransferActor(actor, coordinator?.id, coordinator?.name)
  const remaining = rows.filter(item => item.reviewStatus !== 'passed')
  const ready = rows.length > 0 && rows.every(item => item.entryStatus === 'entered' && item.aiCheckStatus === 'passed' && ['not_reviewed', 'rejected', 'passed'].includes(item.reviewStatus))
  const canSubmit = canView && matchesTransferProject(application, project) && application.status === 'in_progress'
    && application.pipeline.maintenanceSpmReview !== 'success' && coordinates && ready && remaining.length > 0
  return { canSubmit, itemIds: canSubmit ? remaining.map(item => item.id) : [] }
}

/** An approved role may explicitly append follow-up work until final approval freezes the flow. */
export function canAppendTransferRoleLegacy(
  application: TransferApplication,
  role: string,
  allItems: readonly TransferItem[],
  actor: TransferActor,
  project: { id: string; name: string } | null,
  canView: boolean,
): boolean {
  const rows = allItems.filter(item => item.applicationId === application.id && item.responsibleRole === role)
  const coordinator = getTransferMember(application.team.maintenance, role, application.teamConfig)
  return canView && matchesTransferProject(application, project) && application.status === 'in_progress'
    && application.pipeline.maintenanceSpmReview !== 'success'
    && matchesTransferActor(actor, coordinator?.id, coordinator?.name)
    && rows.length > 0 && rows.every(item => item.entryStatus === 'entered' && item.aiCheckStatus === 'passed' && item.reviewStatus === 'passed')
}

/** Match each source record at most once, even when imported templates contain identical grouped rows. */
export function inheritTransferMaterialContent<T extends TransferItem>(
  sourceApplication: TransferApplication,
  targetApplication: TransferApplication,
  freshRows: readonly T[],
  sourceRows: readonly TransferItem[],
): T[] {
  const roleKey = (role: string, application: TransferApplication) => {
    const roles = application.teamConfig ?? getTransferRoleConfig(getTransferProjectType(application.projectType))
    const configured = roles.find(row => row.roleName === role || row.ipmRoleCode === role)
      ?? (role === '测试' || role === 'TPM' ? roles.find(row => row.id === 'test') : undefined)
    return configured?.id ?? (role === 'TPM' ? '测试' : role)
  }
  // Legacy applications used automatic row numbers; only configured snapshots carry user sequence keys.
  const hasUserSequence = Boolean(sourceApplication.teamConfig?.length)
  const key = (item: TransferItem, application: TransferApplication) => JSON.stringify([
    'checkItem' in item ? 'checklist' : 'review', hasUserSequence ? String(item.seq) : '',
    item.type ?? ('standard' in item ? '检查项' : ''),
    'checkItem' in item ? item.checkItem : item.standard,
    'description' in item ? item.description : '',
    roleKey(item.responsibleRole, application),
  ])
  const queues = new Map<string, TransferItem[]>()
  for (const item of sourceRows) {
    if (item.applicationId !== sourceApplication.id) continue
    const itemKey = key(item, sourceApplication)
    const queue = queues.get(itemKey) ?? []
    queue.push(item)
    queues.set(itemKey, queue)
  }
  return freshRows.map(item => {
    const previous = queues.get(key(item, targetApplication))?.shift()
    return previous ? {
      ...item,
      entryContent: previous.entryContent,
      deliverables: previous.deliverables.map(file => ({ ...file })),
      entryStatus: previous.entryStatus,
      aiCheckStatus: previous.entryStatus === 'entered' ? 'in_progress' : 'not_started',
    } : item
  })
}


/** A new assignment must be actionable in the same resolved project permission scope. */
export function canAssignTransferParticipant(
  person: { id: string; name: string },
  project: { id: string; parentProjectId?: unknown } | null,
): boolean {
  if (!project || !ALL_USERS.includes(person.name)
    || !matchesTransferActor({ id: `login-${person.name}`, name: person.name }, person.id, person.name)) return false
  const projectId = resolvePermissionProjectId(project.id, typeof project.parentProjectId === 'string' ? project.parentProjectId : undefined)
  return hasPermission(person.name, projectId, 'basicInfo:transferView')
}

/** Single-item dialogs show the current assignee; a batch always starts empty. */
export function getTransferDelegateAssignee(items: readonly TransferItem[], side: 'entry' | 'review'): string | undefined {
  return items.length === 1 ? (side === 'entry' ? items[0].delegatedTo : items[0].reviewDelegatedTo)?.[0] : undefined
}

export function getTransferParticipantLabel(person: { id: string; name: string; role: string; department: string }, application?: TransferApplication): string {
  const memberships = application ? [...application.team.research, ...application.team.maintenance].filter(member => matchesTransferActor(person, member.id, member.name)) : []
  const roleNames = memberships.map(member => application?.teamConfig?.find(role => role.roleName === member.role || role.ipmRoleCode === member.role || role.ipmRoleCode === member.ipmRoleCode)?.roleName || member.role)
  const roles = [...new Set(roleNames.length ? roleNames : [person.role].filter(Boolean))]
  const departments = [...new Set(memberships.map(member => member.department).filter(value => value && value !== '项目团队'))]
  return `${person.name}（${roles.join(' / ') || '未配置角色'} - ${departments.join(' / ') || person.department || '未配置部门'}）`
}

export function getTransferAiDetail(item?: TransferItem): string {
  if (!item || item.aiCheckStatus === 'not_started') return ''
  return item.aiCheckResult || (item.aiCheckStatus === 'passed' ? 'AI检查通过，内容符合要求。' : item.aiCheckStatus === 'failed' ? 'AI检查不通过，请修改后重新提交。' : 'AI检查进行中...')
}

export function matchesTransferColumnSearch(item: TransferItem, field: 'checkItem' | 'description', value: unknown): boolean {
  const text = field in item ? (item as unknown as Record<string, unknown>)[field] : ''
  return String(text ?? '').toLocaleLowerCase().includes(String(value ?? '').toLocaleLowerCase())
}

/** Retain the source's HTTP/document and UNC directory links without admitting script URLs. */
export function getTransferContentHref(value: string): string | undefined {
  if (/^https?:\/\//i.test(value)) return value
  if (/^\\\\[^\s]+/.test(value)) return `file:///${value.replace(/\\/g, '/')}`
  return undefined
}
