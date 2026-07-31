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

export interface TechnicalSubproject {
  id: string
  name?: string
  active: boolean
  config?: Record<string, unknown>
}
