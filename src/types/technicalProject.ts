export type TechnicalDomain = string

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

export type TechnicalSubprojectCoreValue = string
export type TechnicalSubprojectDevelopmentMode = string

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
  planReferences?: Record<string, unknown>
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
