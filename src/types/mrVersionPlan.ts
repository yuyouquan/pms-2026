export type MrTemplateVersionStatus = '已发布' | '修订中'
export type MrTransferType = 'N/A' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8'
export type MrPlanViewMode = 'vertical' | 'horizontal'
export type MrActivityDateMap = Record<string, string>

export interface MrTemplateActivity {
  id: string
  parentId: string | null
  order: number
  activityName: string
}

export interface MrTemplateVersion {
  id: string
  versionNo: string
  status: MrTemplateVersionStatus
  activities: MrTemplateActivity[]
  createdBy: string
  createdAt: string
  publishedAt?: string
}

export interface MrTemplateChangeLog {
  id: string
  versionId: string
  action: 'create-revision' | 'add' | 'rename' | 'move' | 'delete' | 'publish' | 'cancel-revision'
  activityId?: string
  before?: string
  after?: string
  actor: string
  occurredAt: string
}

export interface TosMrVersionInstance {
  projectId: string
  tosVersion: string
  templateVersionId: string
  activities: MrTemplateActivity[]
  dates: MrActivityDateMap
  createdBy: string
  createdAt: string
  updatedBy: string
  updatedAt: string
}

export interface MrPlanVersionLike {
  id: string
  versionNo: string
  status: string
}

export interface MrLevel1TaskLike {
  id?: string
  stableId?: string
  parentId?: string | null
  taskName?: string
  order?: number
  planStartDate?: string | Date
  planEndDate?: string | Date
}

export interface TosMrCandidateInput {
  versions: readonly MrPlanVersionLike[]
  getSnapshot: (versionId: string) => readonly MrLevel1TaskLike[] | undefined
  usedVersions: readonly string[]
}

export interface TosMrVersionCandidate {
  value: string
  label: string
  planStartDate: string
  planEndDate: string
  disabled: boolean
  reason?: string
}

export interface MrTosDateBounds {
  planStartDate: string
  planEndDate: string
}

export interface CreateTosMrVersionInput {
  projectId: string
  tosVersion: string
  templateVersion: MrTemplateVersion
  actor: string
  now: string
}

export interface AddTosInstanceInput {
  projectId: string
  tosVersion: string
  actor: string
  now: string
}

export interface MrTosVerticalRow extends MrTemplateActivity {
  number: string
  depth: 0 | 1
  date: string
}

export interface MrLeafColumn {
  key: string
  title: string
  parentName: string
  activityName: string
  activityId?: string
}

export interface MrGroupedColumn {
  key: string
  title: string
  children: MrLeafColumn[]
}

export interface JointMachinePlan {
  projectId: string
  tosProjectId: string
  tosVersion: string
  transferType: MrTransferType
  dates: MrActivityDateMap
  updatedBy: string
  updatedAt: string
}

export interface MrStopReleaseRecord {
  id: string
  projectId: string
  projectName: string
  stopDate: string
  operator: string
  operatedAt: string
}

export interface MrMarketOverride {
  projectId: string
  tosVersion: string
  market: string
  mainMarket: string
  dates: MrActivityDateMap
}

export interface StoreStopReleaseInput extends MrStopReleaseRecord {}

export interface MrCellError {
  rowKey: string
  activityId: string
  activityName: string
  message: string
}

export interface MrTosProjectSource {
  projectId: string
  tosProjectKey: string
  projectName: string
}

export interface MrMachineProjectSource {
  id: string
  projectName?: string
  productType: string
  firstSaleTosVersion?: string
  currentTosVersion?: string
  spm?: string
  spmUsers?: string[]
}

export interface MrLevel1Source {
  versions: readonly MrPlanVersionLike[]
  getSnapshot: (versionId: string) => readonly MrLevel1TaskLike[] | undefined
}

export interface MrPublishedLevel1Source extends MrLevel1Source {
  versionId: string
  versionNo: string
  tasks: MrLevel1TaskLike[]
}

export interface MrMachineMetadata {
  projectName: string
  marketName: string
  productLine: string
  spm: string
  spmUsers: string[]
  isMada: '是' | '否'
  socPlatform: string
  packageMode: string
}

export interface MrAggregationSources {
  tosProjects: MrTosProjectSource[]
  machineProjects: MrMachineProjectSource[]
  latestPublishedLevel1ByProjectId: Record<string, MrPublishedLevel1Source>
  machineMetadataByProjectId: Record<string, MrMachineMetadata>
  tosManagerUsersByProjectId: Record<string, string[]>
}

export interface MrJointReferenceRow {
  key: string
  kind: 'tos-reference'
  projectId: string
  tosProjectId: string
  tosVersion: string
  instance: TosMrVersionInstance
}

export interface MrJointMachineRow {
  key: string
  kind: 'machine'
  projectId: string
  tosProjectId: string
  tosVersion: string
  plan: JointMachinePlan
}

export interface ReconcileJointInput {
  today: string
  tosProjects: readonly MrTosProjectSource[]
  tosInstances: readonly TosMrVersionInstance[]
  machineProjects: readonly MrMachineProjectSource[]
  latestPublishedLevel1ByProjectId: Readonly<Record<string, MrLevel1Source | undefined>>
  persistedPlans: Readonly<Record<string, JointMachinePlan>>
  stopRecords: readonly MrStopReleaseRecord[]
}

export interface ReconcileJointResult {
  rows: Array<MrJointReferenceRow | MrJointMachineRow>
  persistedPlans: Record<string, JointMachinePlan>
}

export interface StopExclusionInput {
  plan: JointMachinePlan
  tosInstances: readonly TosMrVersionInstance[]
  stopRecords: readonly MrStopReleaseRecord[]
}

export interface ApplyStopReleaseInput {
  persistedPlans: Readonly<Record<string, JointMachinePlan>>
  tosInstances: readonly TosMrVersionInstance[]
  stopRecords: readonly MrStopReleaseRecord[]
  record: MrStopReleaseRecord
}

export interface ApplyStopReleaseResult {
  persistedPlans: Record<string, JointMachinePlan>
  stopRecords: MrStopReleaseRecord[]
  removedPlanKeys: string[]
}

export interface JointValidationInput {
  tosInstances: readonly TosMrVersionInstance[]
  machinePlans: readonly JointMachinePlan[]
}

export interface MarketDateValidationInput {
  value: string
  mainValue: string
  activityId: string
  activityName: string
}

export interface MrPermissionInput {
  context: 'config' | 'tos' | 'joint-machine' | 'machine-market'
  currentUser: string
  globalAdminUsers: string[]
  tosManagerUsers: string[]
  machineSpm: string
  machineSpmUsers?: string[]
  tosProjectId?: string
  machineProjectId?: string
}

export interface MrPermissionResult {
  canView: boolean
  canEditTemplate: boolean
  canEditTos: boolean
  canEditMachine: boolean
  canStopRelease: boolean
  canEditMarket: boolean
  /** Explicit ownership scope for non-admin tOS managers. */
  tosProjectIds?: string[]
  /** Explicit ownership scope for non-admin machine SPMs. */
  machineProjectIds?: string[]
}

export type MrActivityUpdater = MrTemplateActivity[] | ((previous: MrTemplateActivity[]) => MrTemplateActivity[])
