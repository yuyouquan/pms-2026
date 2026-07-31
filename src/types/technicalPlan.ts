export type TechnicalTemplateKind = 'tdt' | 'subproject'

export interface TechnicalTemplateTask {
  id: string
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

