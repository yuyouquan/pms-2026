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
    if (ACTIVE_PROJECT_STATUSES.machine.includes(value as typeof ACTIVE_PROJECT_STATUSES.machine[number])) return value
    if (value === '暂停') return '已暂停'
    if (['规划中', '筹备中', '待立议', '待验'].includes(value)) return '待立项'
    if (value === '进行中') return '在研'
    if (value === '已上市') return '上市'
    if (['已完成', '维护', '维护期', '已迁移'].includes(value)) return '转维'
    return ACTIVE_PROJECT_STATUSES.machine[0]
  }
  if (projectType === '技术项目') {
    if (ACTIVE_PROJECT_STATUSES.technical.includes(value as typeof ACTIVE_PROJECT_STATUSES.technical[number])) return value
    if (['待立项', '待立议', '规划中', '筹备中', '在研', '待验'].includes(value)) return '进行中'
    if (['上市', '已上市', '转维', '维护', '维护期', 'EOS', '已迁移'].includes(value)) return '已完成'
    return ACTIVE_PROJECT_STATUSES.technical[0]
  }
  if (projectType === 'tOS版本项目' || projectType === '能力建设项目') {
    if (ACTIVE_PROJECT_STATUSES.tos.includes(value as typeof ACTIVE_PROJECT_STATUSES.tos[number])) return value
    return ['已完成', '已迁移', 'EOS'].includes(value) ? '已完成' : '在研'
  }
  return value
}

type ProjectStatusEnumRow = { id: string; value: string }

export function normalizeProjectStatusEnumRows<T extends ProjectStatusEnumRow>(
  projectType: string,
  rows: readonly T[],
  fallbackRows: readonly T[],
): T[] {
  const activeValues = getActiveProjectStatuses(projectType)
  const candidates = rows.map((row, index) => ({
    row,
    index,
    value: normalizeLegacyProjectStatus(projectType, row.value),
  }))
  const claimedIndexes = new Set<number>()
  const claimedIds = new Set<string>()

  return activeValues.map((value, activeIndex) => {
    const candidate = candidates.find(item => item.value === value && !claimedIndexes.has(item.index))
    if (candidate) claimedIndexes.add(candidate.index)
    const fallback = fallbackRows.find(row => row.value === value)
    const source = candidate?.row || fallback || ({ id: '', value } as T)
    let id = String(source.id || '').trim()
    if (!id || claimedIds.has(id)) {
      let suffix = activeIndex + 1
      id = `migrated-project-status-${suffix}`
      while (claimedIds.has(id)) {
        suffix += 1
        id = `migrated-project-status-${suffix}`
      }
    }
    claimedIds.add(id)
    return { ...source, id, value } as T
  })
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
    return ''
  }
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
