import type { SortableColumnSettingsValue } from '@/lib/columnSettings'

export type Level3ActivityStatus = '待启动' | '进行中' | '已完成'
export type Level3ActivityRisk = '无' | '高' | '中' | '低'
export type Level3ScopeKind = 'market' | 'tosType'

export const LEVEL3_ACTIVITY_STATUSES: Level3ActivityStatus[] = ['待启动', '进行中', '已完成']
export const LEVEL3_ACTIVITY_RISKS: Level3ActivityRisk[] = ['无', '高', '中', '低']

export const LEVEL3_COLUMN_KEYS = [
  'number',
  'activityName',
  'responsible',
  'responsibleDepartment',
  'planStartDate',
  'planEndDate',
  'estimatedDays',
  'milestoneName',
  'actualStartDate',
  'actualEndDate',
  'actualDays',
  'status',
  'risk',
  'creator',
] as const

export type Level3ColumnKey = typeof LEVEL3_COLUMN_KEYS[number]

export interface Level3Activity {
  id: string
  parentId: string | null
  order: number
  activityName: string
  responsible: string
  responsibleDepartment: string
  planStartDate: string
  planEndDate: string
  actualStartDate: string
  actualEndDate: string
  milestoneId: string
  milestoneName: string
  milestonePlanEndDate: string
  status: Level3ActivityStatus
  risk: Level3ActivityRisk
  remark: string
  creator: string
  createdAt: string
  updatedBy: string
  updatedAt: string
}

export interface Level3ActivityFormValue {
  activityName?: string
  responsible?: string
  responsibleDepartment?: string
  planStartDate?: string
  planEndDate?: string
  actualStartDate?: string
  actualEndDate?: string
  milestoneId?: string
  status?: Level3ActivityStatus
  risk?: Level3ActivityRisk
  remark?: string
}

export interface Level3Milestone {
  id: string
  name: string
  planEndDate: string
}

export interface NumberedLevel3Activity extends Level3Activity {
  number: string
  depth: 0 | 1
}

export interface Level3ParentRollup {
  planStartDate: string
  planEndDate: string
  estimatedDays: number | null
  actualStartDate: string
  actualEndDate: string
  actualDays: number | null
}

export interface Level3ActivityViewRow extends NumberedLevel3Activity {
  estimatedDays: number | null
  actualDays: number | null
}

export interface Level3ScopeInput {
  projectId: string
  kind: Level3ScopeKind
  value: string
  mainValue: string
  followsMain: boolean
}

export interface Level3ScopeResolution {
  selectedScopeKey: string
  scopeKey: string
  selectedValue: string
  sourceValue: string
  readOnly: boolean
}

export interface Level3PermissionContext {
  currentUser: string
  administratorUsers: string[]
  spmUsers: string[]
}

export interface Level3ActivityPermissions {
  canCreateParent: boolean
  canEdit: boolean
  canAddChild: boolean
  canDrag: boolean
}

export interface Level3ValidationResult {
  ok: boolean
  errors: string[]
}

export interface Level3MoveResult {
  ok: boolean
  activities: Level3Activity[]
  reason?: string
  activeId?: string
  fromParentId?: string | null
  toParentId?: string | null
  fromIndex?: number
  toIndex?: number
}

export interface Level3FieldChange {
  field: string
  label: string
  before: string
  after: string
}

export type Level3ChangeAction = 'create-parent' | 'create-child' | 'edit' | 'move'

export interface Level3ChangeLog {
  id: string
  action: Level3ChangeAction
  actor: string
  occurredAt: string
  activityId: string
  activityName: string
  activityNumber: string
  summary: string
  changes: Level3FieldChange[]
}

export interface Level3ScopeData {
  activities: Level3Activity[]
  history: Level3ChangeLog[]
  collapsedIds: string[]
  columnSettings: SortableColumnSettingsValue<Level3ColumnKey>
}
