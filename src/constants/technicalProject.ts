import type { TechnicalDeliverableKey, TechnicalTeam } from '@/types/technicalProject'

interface TechnicalTeamFieldDefinition {
  key: keyof TechnicalTeam
  label: string
  required: boolean
}

interface TechnicalDeliverableFieldDefinition {
  key: TechnicalDeliverableKey
  label: string
}

export const TECHNICAL_TEAM_FIELDS = [
  { key: 'technicalLead', label: '技术项目负责人', required: true },
  { key: 'technicalProjectManager', label: '技术项目经理', required: true },
  { key: 'testRepresentative', label: '测试代表', required: false },
  { key: 'qualityRepresentative', label: '质量代表', required: false },
  { key: 'productRepresentative', label: '产品代表', required: false },
  { key: 'standardizationRepresentative', label: '标准化代表', required: false },
  { key: 'technicalOther', label: '其他', required: false },
] as const satisfies readonly TechnicalTeamFieldDefinition[]

export const TECHNICAL_DELIVERABLE_FIELDS = [
  { key: 'projectKpi', label: '项目KPI文件' },
  { key: 'conceptDesign', label: '概设' },
  { key: 'charterReport', label: 'Charter报告' },
  { key: 'pdcpReport', label: 'PDCP报告' },
  { key: 'tdcpReport', label: 'TDCP报告' },
  { key: 'edcpReport', label: 'EDCP报告' },
] as const satisfies readonly TechnicalDeliverableFieldDefinition[]

const TECHNICAL_BASIC_STRING_FIELD_KEYS = [
  'technicalTrack', 'tmg', 'subdomain', 'preProjectId', 'projectYear', 'projectValue',
] as const

type TechnicalStringFieldKey = typeof TECHNICAL_BASIC_STRING_FIELD_KEYS[number] | keyof TechnicalTeam

export const TECHNICAL_STRING_FIELD_KEYS = [
  ...TECHNICAL_BASIC_STRING_FIELD_KEYS,
  ...TECHNICAL_TEAM_FIELDS.map(field => field.key),
] as const satisfies readonly TechnicalStringFieldKey[]

export const EMPTY_TECHNICAL_TEAM: TechnicalTeam = {
  technicalLead: '', technicalProjectManager: '', testRepresentative: '',
  qualityRepresentative: '', productRepresentative: '', standardizationRepresentative: '', technicalOther: '',
}
