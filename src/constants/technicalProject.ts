import type { TechnicalDeliverableKey, TechnicalTeam } from '@/types/technicalProject'

export const TECHNICAL_TEAM_FIELDS: ReadonlyArray<{ key: keyof TechnicalTeam; label: string; required: boolean }> = [
  { key: 'technicalLead', label: '技术项目负责人', required: true },
  { key: 'technicalProjectManager', label: '技术项目经理', required: false },
  { key: 'testRepresentative', label: '测试代表', required: false },
  { key: 'qualityRepresentative', label: '质量代表', required: false },
  { key: 'productRepresentative', label: '产品代表', required: false },
  { key: 'standardizationRepresentative', label: '标准化代表', required: false },
]

export const TECHNICAL_DELIVERABLE_FIELDS: ReadonlyArray<{ key: TechnicalDeliverableKey; label: string }> = [
  { key: 'projectKpi', label: '项目KPI文件' },
  { key: 'conceptDesign', label: '概设' },
  { key: 'charterReport', label: 'charter报告' },
  { key: 'pdcpReport', label: 'PDCP报告' },
  { key: 'tdcpReport', label: 'TDCP报告' },
  { key: 'edcpReport', label: 'EDCP报告' },
]

export const TECHNICAL_STRING_FIELD_KEYS = [
  'technicalTrack', 'tmg', 'subdomain', 'preProjectId', 'projectYear', 'projectValue',
  'technicalLead', 'technicalProjectManager', 'testRepresentative', 'qualityRepresentative',
  'productRepresentative', 'standardizationRepresentative',
] as const

export const EMPTY_TECHNICAL_TEAM: TechnicalTeam = {
  technicalLead: '', technicalProjectManager: '', testRepresentative: '',
  qualityRepresentative: '', productRepresentative: '', standardizationRepresentative: '',
}
