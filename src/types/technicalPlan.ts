export type TechnicalTemplateKind = 'tdt' | 'subproject'

export interface ConfigTemplateVersion {
  id: string
  versionNo: string
  status: string
  publishedAt?: string
}

export interface ConfigTemplateVersionScope {
  versions: ConfigTemplateVersion[]
  currentVersion: string
}

export interface ConfigTemplateCompareScope {
  versionA: string
  versionB: string
}

export interface TechnicalTemplateTask {
  id: string
  stableId?: string
  source?: 'template' | 'custom'
  role?: string
  order: number
  taskName: string
  parentId?: string
  responsible: string
  predecessor: string
  planStartDate: string
  planEndDate: string
  estimatedDays: number
  actualStartDate: string
  actualEndDate: string
  actualDays: number
  status: string
  progress: number
  defaultRoadmap: boolean
}

export type TechnicalTemplateTaskInput = Partial<TechnicalTemplateTask> & {
  id?: string
  taskName?: string
  children?: readonly TechnicalTemplateTaskInput[]
}
