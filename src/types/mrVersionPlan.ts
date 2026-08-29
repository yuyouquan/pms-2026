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
  dates: MrActivityDateMap
}

export interface MrCellError {
  rowKey: string
  activityId: string
  activityName: string
  message: string
}

export interface MrPermissionInput {
  context: 'config' | 'tos' | 'joint-machine' | 'machine-market'
  currentUser: string
  globalAdminUsers: string[]
  tosManagerUsers: string[]
  machineSpm: string
}

export interface MrPermissionResult {
  canView: boolean
  canEditTemplate: boolean
  canEditTos: boolean
  canEditMachine: boolean
  canStopRelease: boolean
  canEditMarket: boolean
}

export type MrActivityUpdater = MrTemplateActivity[] | ((previous: MrTemplateActivity[]) => MrTemplateActivity[])
