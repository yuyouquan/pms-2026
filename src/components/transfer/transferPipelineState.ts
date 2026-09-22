import type { RoleProgress, RoleNodeStatus } from '@/mock/transfer-maintenance'

const ROLE_STATUS_COLORS: Record<RoleNodeStatus, string> = {
  not_started: '#d9d9d9',
  in_progress: 'var(--pms-brand)',
  completed: '#52c41a',
  rejected: '#ff4d4f',
}
const ROLE_STATUS_LABELS: Record<RoleNodeStatus, string> = {
  not_started: '未开始',
  in_progress: '进行中',
  completed: '已完成',
  rejected: '被拒绝',
}

/** Review rejection sends the entry dot back for correction while review waits for resubmission. */
export function getTransferPipelineRoleDots(roles: readonly RoleProgress[], side: 'entry' | 'review') {
  return roles.map(progress => {
    const bouncedBack = progress.reviewStatus === 'rejected'
    const status = bouncedBack
      ? side === 'entry' ? 'rejected' : 'not_started'
      : side === 'entry' ? progress.entryStatus : progress.reviewStatus
    const statusLabel = bouncedBack
      ? side === 'entry' ? '审核不通过，需修改' : '待审核（资料修改后再次审核）'
      : ROLE_STATUS_LABELS[status]
    return { role: progress.role, status, statusLabel, label: `${progress.role}: ${statusLabel}`, color: ROLE_STATUS_COLORS[status] }
  })
}
