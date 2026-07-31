export type TechnicalDomain =
  | '基础架构TMG'
  | '性能TMG'
  | 'DFX TMG'
  | 'UX TMG'
  | '系统应用'
  | '底软通信'
  | '集成维护'
  | '其他'

export interface TechnicalTeam {
  technicalLead: string
  technicalProjectManager: string
  testRepresentative: string
  qualityRepresentative: string
  productRepresentative: string
  standardizationRepresentative: string
}

export interface DeliverableFile {
  name: string
  size: number
  mimeType: string
}

export type DeliverableValue =
  | { kind: 'url'; url: string }
  | { kind: 'file'; name: string; size: number; mimeType: string }
  | null

export type TechnicalDeliverableKey =
  | 'projectKpi'
  | 'conceptDesign'
  | 'charterReport'
  | 'pdcpReport'
  | 'tdcpReport'
  | 'edcpReport'

export type TechnicalDeliverables = Record<TechnicalDeliverableKey, DeliverableValue>

export interface TechnicalProjectValues extends TechnicalTeam {
  technicalTrack: string
  tmg: TechnicalDomain | ''
  subdomain: string
  preProjectId: string
  projectYear: string
  projectValue: string
  ipmProjectType: string
  deliverables: Partial<TechnicalDeliverables>
}

export type TechnicalSubprojectCoreValue = '' | '追赶' | '人无我有' | '人有我有'
export type TechnicalSubprojectDevelopmentMode = '' | '自研' | '谷歌合作' | 'SoC合作' | '高校合作'

export interface TechnicalSubprojectConfiguration {
  coreValue: TechnicalSubprojectCoreValue
  developmentMode: TechnicalSubprojectDevelopmentMode
  firstTosVersion: string
  firstMachineProjectId: string
}

export interface TechnicalSubproject {
  id: string
  parentProjectId: string
  name: string
  active: boolean
  ipmOrder: number
  configuration: TechnicalSubprojectConfiguration
  planInstanceId?: string
}

export interface IpmTechnicalSubproject {
  id: string
  parentProjectId: string
  name: string
  ipmOrder: number
}

export type TechnicalSubprojectSyncResult =
  | { ok: true; items: TechnicalSubproject[] }
  | { ok: false; reason: 'duplicate-id' | 'invalid-payload'; items: readonly TechnicalSubproject[] }

export type TechnicalSubprojectConfigurationPatch = Partial<TechnicalSubprojectConfiguration>
