import type { ProjectVisibilityFieldDefinition } from '@/lib/projectFieldPreferences'

export const PROJECT_PLAN_INFO_FIELDS: ProjectVisibilityFieldDefinition[] = [
  { key: 'planStartDate', label: '计划开始时间', defaultVisible: true, hideable: true },
  { key: 'planEndDate', label: '计划结束时间', defaultVisible: true, hideable: true },
  { key: 'developCycle', label: '开发周期（工作日）', defaultVisible: true, hideable: true },
  { key: 'googleLaunchDate', label: 'Google Launch Date', defaultVisible: true, hideable: true },
  { key: 'isMadaControlled', label: '是否MADA管控', defaultVisible: true, hideable: true },
  { key: 'isCarrierCustomized', label: '是否运营商定制', defaultVisible: true, hideable: false },
  { key: 'isSimLocked', label: '是否锁卡', defaultVisible: true, hideable: true },
  { key: 'isCancelPaused', label: '是否取消暂停', defaultVisible: true, hideable: true },
  { key: 'cancelPauseDate', label: '取消暂停时间', defaultVisible: true, hideable: true },
]
