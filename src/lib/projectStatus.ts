import type { SingleEnumTypeKey } from '@/lib/enumConsumers'

export const ACTIVE_PROJECT_STATUSES = {
  machine: ['待立项', '在研', '上市', 'EOS', '转维', '已取消', '已暂停'],
  tos: ['在研', '已完成'],
  technical: ['进行中', '已完成', '暂停', '已取消'],
} as const

const isMachineStatusProjectType = (projectType: string) => (
  projectType === '整机产品项目'
  || projectType.startsWith('整机-')
  || projectType.startsWith('整机产品-')
)

export function getActiveProjectStatuses(projectType: string): readonly string[] {
  if (isMachineStatusProjectType(projectType)) {
    return ACTIVE_PROJECT_STATUSES.machine
  }
  if (projectType === '技术项目') return ACTIVE_PROJECT_STATUSES.technical
  return ACTIVE_PROJECT_STATUSES.tos
}

export function normalizeLegacyProjectStatus(projectType: string, status: string): string {
  const value = status.trim()
  if (!value) return value
  if (isMachineStatusProjectType(projectType)) {
    if (value === '暂停') return '已暂停'
    if (value === '规划中' || value === '筹备中') return '待立项'
    return value
  }
  if (projectType === '技术项目') {
    if (value === '在研' || value === '筹备中') return '进行中'
    if (value === '已迁移' || value === 'EOS') return '已完成'
    return value
  }
  if (projectType === 'tOS版本项目' || projectType === '能力建设项目') {
    return ['已完成', '已迁移', 'EOS'].includes(value) ? '已完成' : '在研'
  }
  return value
}

export function getProjectStatusEnumType(category: string): SingleEnumTypeKey {
  if (category === '整机产品项目') return 'machine-project-status'
  if (category === '技术项目') return 'technical-project-status'
  return 'tos-capability-project-status'
}

const TOS_IPM_STATUS_MAP: Readonly<Record<string, string>> = {
  '暂停': '暂停',
  '已取消': '已取消',
  '进行中': '在研',
  '已完成': '已完成',
  '维护期': '已完成',
}

const DEFAULT_IPM_STATUS_MAP: Readonly<Record<string, string>> = {
  '筹备中': '待立项',
  '进行中': '在研',
  '已完成': '转维',
  '已取消': '已取消',
  '维护期': '转维',
  '已上市': '上市',
  '维护': '转维',
}

export const mapIpmProjectStatus = (ipmStatus: string, projectType: string): string => {
  const normalizedStatus = ipmStatus.trim()
  if (projectType === 'tOS版本项目') {
    return TOS_IPM_STATUS_MAP[normalizedStatus] || normalizedStatus
  }
  if (projectType === '技术项目' && normalizedStatus === '已迁移') return '已迁移'
  if (projectType === '技术项目' && normalizedStatus === '待立议') return '待立议'
  if (projectType === '技术项目' && normalizedStatus === '待验') return '待验'
  return DEFAULT_IPM_STATUS_MAP[normalizedStatus] || normalizedStatus
}

export interface ConfiguredProjectStatusInput {
  projectType: string
  configuredValues: readonly string[]
  submittedStatus?: string
  ipmStatus?: string
  mode?: 'create' | 'edit'
  originalStatus?: string
}

export const resolveConfiguredProjectStatus = ({
  projectType,
  configuredValues,
  submittedStatus = '',
  ipmStatus = '',
  mode = 'create',
  originalStatus = '',
}: ConfiguredProjectStatusInput): string => {
  const liveValues = [...new Set(configuredValues.map(value => value.trim()).filter(Boolean))]
  const submitted = submittedStatus.trim()
  if (submitted) {
    if (liveValues.includes(submitted)) return submitted
    if (mode === 'edit' && submitted === originalStatus.trim()) return submitted
    return ''
  }
  if (mode === 'edit' && originalStatus.trim()) return originalStatus.trim()
  return ''
}

export interface InitialProjectStatusPatchInput {
  initialize: boolean
  projectType: string
  configuredValues: readonly string[]
  ipmStatus?: string
}

/** Project status is always selected by the user and is never copied from IPM. */
export const buildInitialProjectStatusPatch = (_input: InitialProjectStatusPatchInput): { status?: string } => ({})
