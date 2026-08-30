import type { ProjectVisibilityFieldDefinition } from '@/lib/projectFieldPreferences'

export const MACHINE_PROJECT_SPACE_PLAN_FIELD_KEYS = [
  'isMadaControlled',
  'isSimLocked',
  'googleLaunchDate',
  'isCancelPaused',
  'cancelPauseDate',
  'buildOption',
  'buildMarket',
] as const

export const PROJECT_PLAN_INFO_FIELDS: ProjectVisibilityFieldDefinition[] = [
  { key: 'isMadaControlled', label: '是否MADA管控', defaultVisible: true, hideable: false },
  { key: 'isSimLocked', label: '是否锁卡', defaultVisible: true, hideable: false },
  { key: 'googleLaunchDate', label: 'Google Launch Date', defaultVisible: true, hideable: false },
  { key: 'isCancelPaused', label: '是否取消暂停', defaultVisible: true, hideable: false },
  { key: 'cancelPauseDate', label: '取消暂停时间', defaultVisible: true, hideable: false },
  { key: 'buildOption', label: '编译选项', defaultVisible: false, hideable: true },
  { key: 'buildMarket', label: '编译市场', defaultVisible: false, hideable: true },
]
