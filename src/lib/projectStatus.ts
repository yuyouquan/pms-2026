export const TOS_PROJECT_STATUS_VALUES = ['在研', '已完成', '暂停', '已取消'] as const

export const TOS_PROJECT_STATUS_OPTIONS = TOS_PROJECT_STATUS_VALUES.map(value => ({
  label: value,
  value,
}))

export const TOS_PROJECT_LIST_STATUS_OPTIONS = [
  { label: '全部', value: 'all' },
  ...TOS_PROJECT_STATUS_OPTIONS,
]

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
