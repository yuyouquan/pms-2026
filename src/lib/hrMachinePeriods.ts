import dayjs from 'dayjs'

/** A calendar-month endpoint: month ends clamp to the target month's last day. */
export function withMachineDerivedMilestones<T extends object>(values: T) {
  const str5 = (values as { str5?: string | null }).str5
  const date = str5 ? dayjs(str5) : null
  const valid = date?.isValid() && date.format('YYYY-MM-DD') === str5
  return { ...values, str5Plus6Months: valid && date ? date.add(6, 'month').format('YYYY-MM-DD') : null }
}

export const MACHINE_INVESTMENT_PERIODS = [
  { key: 'conceptToStr1', label: '概念启动~STR1', startField: 'conceptStart', endField: 'str1' },
  { key: 'str1ToStr2', label: 'STR1~STR2', startField: 'str1', endField: 'str2' },
  { key: 'str2ToStr3', label: 'STR2~STR3', startField: 'str2', endField: 'str3' },
  { key: 'str3ToStr4', label: 'STR3~STR4', startField: 'str3', endField: 'str4' },
  { key: 'str4ToStr4a', label: 'STR4~STR4A', startField: 'str4', endField: 'str4a' },
  { key: 'str4aToStr5', label: 'STR4A~STR5', startField: 'str4a', endField: 'str5' },
  { key: 'str5ToSixMonths', label: 'STR5+6个月', startField: 'str5', endField: 'str5Plus6Months' },
] as const

export const LEGACY_MACHINE_PHASES = [
  { key: 'conceptPhase', label: '概念阶段' }, { key: 'planningPhase', label: '计划阶段' },
  { key: 'developmentPhase', label: '开发阶段' }, { key: 'validationPhase', label: '验证阶段' },
  { key: 'launchPhase', label: '上市阶段' }, { key: 'lifecycle', label: '生命周期阶段' },
] as const

export function isCurrentMachineModel(row: object): boolean {
  const values = row as Record<string, unknown>
  return MACHINE_INVESTMENT_PERIODS.every(({ key }) => typeof values[key] === 'number' && Number.isFinite(values[key]) && Number(values[key]) >= 0)
}

/** Archived models retain their original schema; never invent a split of user-entered values. */
export function machinePhaseFields(records: readonly object[]) {
  const hasCurrent = records.some(isCurrentMachineModel)
  const hasLegacy = records.some(row => !isCurrentMachineModel(row))
  return hasCurrent && hasLegacy ? [...MACHINE_INVESTMENT_PERIODS, ...LEGACY_MACHINE_PHASES]
    : hasLegacy ? [...LEGACY_MACHINE_PHASES] : [...MACHINE_INVESTMENT_PERIODS]
}
