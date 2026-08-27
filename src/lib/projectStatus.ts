import type { SingleEnumTypeKey } from '@/lib/enumConsumers'

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
  if (projectType === 'tOS版本项目') {
    return mapIpmProjectStatus(ipmStatus, projectType)
  }
  return liveValues[0] || ''
}
