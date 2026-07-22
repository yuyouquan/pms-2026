import type { MachineProjectType } from '@/constants/projectTypes'

export type RoadmapSource = 'normal' | 'planned'
export type RoadmapViewMode = 'table' | 'evolution'
export type RoadmapProductType = '新品' | '老品'
export type RoadmapBrand = 'TECNO' | 'Infinix' | 'itel' | '待定' | '其他品牌'
export type RoadmapAndroidVersion = 'Android 16' | 'Android 17' | 'Android 18'
export type RoadmapRam = '2GB' | '3GB' | '4GB' | '6GB' | '8GB' | '12GB' | '16GB'
export type RoadmapVersionType = 'Full' | 'Slim' | 'Go'
export type RoadmapDevelopMode = '自研' | 'ODC' | 'ITD-ODC' | 'ODM' | '纯外研'
export type RoadmapSortDirection = 'ascend' | 'descend' | null
export type RoadmapChangeAction = 'create' | 'update' | 'delete'
export type RoadmapFilterOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'before'
  | 'after'

export interface RoadmapProjectFields {
  machineProjectType: MachineProjectType
  projectCode: string
  displayName: string
  androidVersion: RoadmapAndroidVersion
  firstSaleTosVersionId: string
  brand: RoadmapBrand
  productLine: string
  productSeries: string
  marketName: string
  productType: RoadmapProductType
  platform: string
  startRam: RoadmapRam
  versionType: RoadmapVersionType
  str5Date: string
  launchDate: string
  developMode: RoadmapDevelopMode
  remark: string
}

export interface RoadmapProjectRow extends RoadmapProjectFields {
  id: string
  source: RoadmapSource
  status: string
  readOnly: boolean
}

export interface PlannedRoadmapProject extends RoadmapProjectFields {
  id: string
  status: '待规划'
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
}

export type PlannedRoadmapProjectInput = Omit<RoadmapProjectFields, 'displayName' | 'remark'> & {
  remark?: string
}

export interface TosVersionConfig {
  id: string
  name: string
  major: number
  minor: number
  targets: string[]
  createdAt: string
  updatedAt: string
}

export interface RoadmapPlanningConflictGroup {
  key: string
  normalProjects: RoadmapProjectRow[]
  plannedProjects: RoadmapProjectRow[]
}

export type RoadmapAuditField =
  | 'firstSaleTosVersionId'
  | 'brand'
  | 'productLine'
  | 'marketName'
  | 'projectCode'
  | 'productType'
  | 'platform'
  | 'startRam'
  | 'versionType'
  | 'str5Date'
  | 'launchDate'
  | 'developMode'
  | 'remark'

export interface RoadmapFieldChange {
  field: RoadmapAuditField
  before: string
  after: string
}

export interface RoadmapChangeLog {
  id: string
  projectId: string
  projectDisplayName: string
  source: RoadmapSource
  action: RoadmapChangeAction
  actor: string
  occurredAt: string
  tosVersionName: string
  changes: RoadmapFieldChange[]
  snapshot?: Partial<RoadmapProjectFields>
}

export type RoadmapColumnKey =
  | 'firstSaleTosVersionId'
  | 'brand'
  | 'productLine'
  | 'productSeries'
  | 'marketName'
  | 'displayName'
  | 'productType'
  | 'platform'
  | 'startRam'
  | 'versionType'
  | 'str5Date'
  | 'launchDate'
  | 'developMode'
  | 'remark'

export type RoadmapColumnKind = 'tos-version' | 'text' | 'enum' | 'ram' | 'date'

export interface RoadmapColumnDefinition {
  key: RoadmapColumnKey
  label: string
  kind: RoadmapColumnKind
  defaultVisible: boolean
}

export const ROADMAP_COLUMNS: readonly RoadmapColumnDefinition[] = [
  { key: 'firstSaleTosVersionId', label: 'tOS版本', kind: 'tos-version', defaultVisible: true },
  { key: 'brand', label: '品牌', kind: 'enum', defaultVisible: true },
  { key: 'productLine', label: '产品线', kind: 'enum', defaultVisible: true },
  { key: 'productSeries', label: '产品系列', kind: 'text', defaultVisible: false },
  { key: 'marketName', label: '市场名', kind: 'text', defaultVisible: true },
  { key: 'displayName', label: '项目名', kind: 'text', defaultVisible: true },
  { key: 'productType', label: '产品类型', kind: 'enum', defaultVisible: true },
  { key: 'platform', label: '平台', kind: 'text', defaultVisible: true },
  { key: 'startRam', label: '起步RAM', kind: 'ram', defaultVisible: true },
  { key: 'versionType', label: '版本类型', kind: 'enum', defaultVisible: true },
  { key: 'str5Date', label: 'STR5时间', kind: 'date', defaultVisible: true },
  { key: 'launchDate', label: '上市时间', kind: 'date', defaultVisible: true },
  { key: 'developMode', label: '开发模式', kind: 'enum', defaultVisible: true },
  { key: 'remark', label: '备注', kind: 'text', defaultVisible: true },
]

export interface RoadmapFilterCondition {
  id: string
  field: RoadmapColumnKey
  operator: RoadmapFilterOperator
  value: string
}

export interface RoadmapSortState {
  field: RoadmapColumnKey | null
  direction: RoadmapSortDirection
}

export interface RoadmapStoreState {
  plannedProjects: PlannedRoadmapProject[]
  tosVersions: TosVersionConfig[]
  changeLogs: RoadmapChangeLog[]
  viewMode: RoadmapViewMode
  selectedTosVersionId: string | null
  brandFilter: 'all' | RoadmapBrand
  productTypeFilter: 'all' | RoadmapProductType
  filters: RoadmapFilterCondition[]
  visibleColumns: RoadmapColumnKey[]
  sort: RoadmapSortState
  selectedConflictKey: string | null
}

export type RoadmapMutationFailureReason = 'duplicate' | 'referenced' | 'not-found' | 'invalid'

export type RoadmapMutationResult =
  | { ok: true }
  | { ok: false; reason: RoadmapMutationFailureReason; referenceCount?: number; errors?: RoadmapValidationErrors }

export type RoadmapValidationErrors = Partial<Record<keyof PlannedRoadmapProjectInput, string>>

export type PlannedRoadmapProjectMutationInput = PlannedRoadmapProjectInput & {
  actor: string
}

export interface CreateTosVersionInput {
  name: string
}

export type RoadmapNormalChangeInput = Omit<RoadmapChangeLog, 'id' | 'occurredAt'> & {
  id?: string
  occurredAt?: string
}

export interface RoadmapStoreActions {
  createPlannedProject: (input: PlannedRoadmapProjectMutationInput) => RoadmapMutationResult
  updatePlannedProject: (id: string, input: PlannedRoadmapProjectMutationInput) => RoadmapMutationResult
  deletePlannedProject: (id: string, actor: string) => RoadmapMutationResult
  createTosVersion: (input: CreateTosVersionInput) => RoadmapMutationResult
  renameTosVersion: (id: string, input: CreateTosVersionInput) => RoadmapMutationResult
  deleteTosVersion: (id: string, normalReferenceCount: number) => RoadmapMutationResult
  setTosTargets: (id: string, targets: string[]) => RoadmapMutationResult
  recordNormalProjectChange: (input: RoadmapNormalChangeInput) => void
}

export type RoadmapStore = RoadmapStoreState & RoadmapStoreActions
