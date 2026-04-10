// Plan task notification types (added 2026-04-10)
// Shared between page.tsx (detection) and src/lib/feishu-notify.ts (delivery)

export type PlanChangeKind = 'created' | 'modified'

export interface TaskChange {
  kind: PlanChangeKind
  task: any
  previous?: any
  changedFields?: string[]
}

export interface PlanDueNotice {
  kind: 'due_soon' | 'overdue'
  task: any
  daysUntilDue: number  // negative means already overdue by |daysUntilDue| days
}

export interface FeishuRecipient {
  openId: string
  email: string
  name: string
}
