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
  'remark',
  'creator',
] as const

export type Level3ColumnKey = typeof LEVEL3_COLUMN_KEYS[number]

export const LEVEL3_COLUMN_TITLES: Record<Level3ColumnKey, string> = {
  number: '序号',
  activityName: '活动名称',
  responsible: '责任人',
  responsibleDepartment: '责任部门',
  planStartDate: '计划开始时间',
  planEndDate: '计划结束时间',
  estimatedDays: '预估工期',
  milestoneName: '关键节点',
  actualStartDate: '实际开始时间',
  actualEndDate: '实际完成时间',
  actualDays: '实际工期',
  status: '状态',
  risk: '任务风险',
  remark: '备注',
  creator: '创建者',
}

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

export interface Level3ActualDateOverride {
  activityId: string
  actualStartDate: string
  actualEndDate: string
  detachedBy: string
  detachedAt: string
}

export type Level3ActualDateOverrideMap = Partial<Record<string, Level3ActualDateOverride>>

export interface Level3WorkflowOverride {
  activityId: string
  status?: Level3ActivityStatus
  risk?: Level3ActivityRisk
  detachedBy: string
  detachedAt: string
}

export type Level3WorkflowOverrideMap = Partial<Record<string, Level3WorkflowOverride>>

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
  status: Level3ActivityStatus
  risk: Level3ActivityRisk
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

export interface Level3ScopeFork {
  sourceScopeKey: string
  targetScopeKey: string
}

export interface Level3PermissionContext {
  currentUser: string
  administratorUsers: string[]
  structuralAdministratorUsers: string[]
  spmUsers: string[]
}

export interface Level3ActivityPermissions {
  canCreateParent: boolean
  canEdit: boolean
  canAddChild: boolean
  canDrag: boolean
  canDelete: boolean
}

export interface Level3ValidationResult {
  ok: boolean
  errors: string[]
}

export interface Level3MoveResult {
  ok: boolean
  activities: Level3Activity[]
  changed?: boolean
  reason?: string
  activeId?: string
  fromParentId?: string | null
  toParentId?: string | null
  fromIndex?: number
  toIndex?: number
}

export interface Level3MovePermission {
  allowed: boolean
  reason?: string
}

export interface Level3DeleteResult {
  ok: boolean
  activities: Level3Activity[]
  deletedActivities: Level3Activity[]
  reason?: string
}

export interface Level3FieldChange {
  field: string
  label: string
  before: string
  after: string
}

export type Level3ChangeAction = 'create-parent' | 'create-child' | 'edit' | 'move' | 'delete'

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
  parentActivityId?: string
  parentActivityName?: string
  sourceParentActivityId?: string
  sourceParentActivityName?: string
  targetParentActivityId?: string
  targetParentActivityName?: string
}

export interface Level3ScopeData {
  activities: Level3Activity[]
  history: Level3ChangeLog[]
  collapsedIds: string[]
  columnSettings: SortableColumnSettingsValue<Level3ColumnKey>
}
