import type { NonLaborInvestment, NonLaborInvestmentItem } from '@/types/nonLaborInvestment'
import type { ConfigRecord } from '@/types/hrConfig'

export const emptyNonLaborInvestment = (): NonLaborInvestment => ({ startMonth: null, endMonth: null, items: [] })
export const cloneNonLaborInvestment = (value?: NonLaborInvestment): NonLaborInvestment => value
  ? { ...value, items: value.items.map(item => ({ ...item, secondaryDepartment: item.secondaryDepartment ?? '', tertiaryDepartment: item.tertiaryDepartment ?? '', monthlyAmounts: { ...item.monthlyAmounts } })) }
  : emptyNonLaborInvestment()

export const nonLaborItemKey = (item: Pick<NonLaborInvestmentItem, 'secondaryDepartment' | 'tertiaryDepartment' | 'secondarySubject' | 'tertiarySubject'>): string =>
  JSON.stringify([item.secondaryDepartment, item.tertiaryDepartment, item.secondarySubject, item.tertiarySubject].map(value => (value ?? '').trim()))

export function nonLaborDepartmentPairs(records: readonly ConfigRecord[]) {
  const pairs = new Map<string, { secondaryDepartment: string; tertiaryDepartment: string }>()
  for (const row of records) {
    const secondaryDepartment = String(row.secondaryDepartment ?? '').trim()
    const tertiaryDepartment = String(row.tertiaryDepartment ?? '').trim()
    if (row.enabled !== false && secondaryDepartment && tertiaryDepartment) {
      pairs.set(JSON.stringify([secondaryDepartment, tertiaryDepartment]), { secondaryDepartment, tertiaryDepartment })
    }
  }
  return [...pairs.values()]
}

export const formatNonLaborAmount = (amount: number): string => amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function monthIndex(value: string | null): number | null {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null
  const [year, month] = value.split('-').map(Number)
  return year * 12 + month - 1
}
export function nonLaborMonths(value: Pick<NonLaborInvestment, 'startMonth' | 'endMonth'>): string[] {
  const start = monthIndex(value.startMonth), end = monthIndex(value.endMonth)
  if (start === null || end === null || start > end) return []
  return Array.from({ length: end - start + 1 }, (_, index) => {
    const month = start + index
    return String(Math.floor(month / 12)).padStart(4, '0') + '-' + String(month % 12 + 1).padStart(2, '0')
  })
}
export const nonLaborTotal = (value: NonLaborInvestment): number => {
  const months = nonLaborMonths(value)
  return Math.round(value.items.reduce((sum, item) => sum + months.reduce((n, month) => n + (item.monthlyAmounts[month] ?? 0), 0), 0) * 100) / 100
}
export function validateNonLaborInvestment(value: NonLaborInvestment, subjects: readonly ConfigRecord[], previous?: NonLaborInvestment, departmentRecords: readonly ConfigRecord[] = []): NonLaborInvestment {
  const result = cloneNonLaborInvestment(value)
  if (!result.startMonth && !result.endMonth && result.items.length === 0) return result
  const months = nonLaborMonths(result)
  if (!months.length && (result.startMonth || result.endMonth)) throw new Error('请填写有效的里程碑时间以生成费用投入时间范围')
  const keys = new Set<string>(), ids = new Set<string>()
  const departments = nonLaborDepartmentPairs(departmentRecords)
  for (const item of result.items) {
    item.secondaryDepartment = item.secondaryDepartment.trim()
    item.tertiaryDepartment = item.tertiaryDepartment.trim()
    item.secondarySubject = item.secondarySubject.trim()
    item.tertiarySubject = item.tertiarySubject.trim()
    const key = nonLaborItemKey(item)
    if (keys.has(key)) throw new Error('同一版本中的二级部门、三级部门、二级科目和三级科目组合不能重复')
    keys.add(key)
    if (!item.id || ids.has(item.id)) throw new Error('非人力投入行标识重复')
    ids.add(item.id)
    const matchesDepartment = (row: Pick<NonLaborInvestmentItem, 'secondaryDepartment' | 'tertiaryDepartment'>) =>
      row.secondaryDepartment === item.secondaryDepartment && row.tertiaryDepartment === item.tertiaryDepartment
    const retainedDepartment = previous?.items.some(row => row.id === item.id && matchesDepartment(row))
    if (!item.secondaryDepartment || !item.tertiaryDepartment || (!departments.some(matchesDepartment) && !retainedDepartment)) {
      throw new Error('请选择有效的二级部门和对应三级部门')
    }
    const matches = (row: { subjectId?: string; id: string; secondarySubject?: unknown; tertiarySubject?: unknown }) =>
      (row.subjectId ?? row.id) === item.subjectId && row.secondarySubject === item.secondarySubject && row.tertiarySubject === item.tertiarySubject
    const active = subjects.some(row => row.enabled !== false && matches(row))
    const retained = previous?.items.some(row => row.id === item.id && matches(row))
    if (!item.secondarySubject.trim() || !item.tertiarySubject.trim() || (!active && !retained)) throw new Error('请选择有效的二级科目和对应三级科目')
    for (const [month, amount] of Object.entries(item.monthlyAmounts)) {
      if (!Number.isFinite(amount) || amount < 0) throw new Error('非人力投入金额必须为非负数')
      if (Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001) throw new Error('非人力投入金额最多保留两位小数')
      if (monthIndex(month) === null) throw new Error('费用投入月份格式不正确')
      // A user may enter an amount and then shrink the milestones in the same draft.
      // Keep valid hidden month amounts; only visible months participate in totals.
    }
  }
  return result
}

export function validateNonLaborSubjects(records: readonly ConfigRecord[]): void {
  const pairs = new Set<string>()
  for (const record of records) {
    const secondary = String(record.secondarySubject ?? '').trim()
    const tertiary = String(record.tertiarySubject ?? '').trim()
    if (!secondary || !tertiary) throw new Error('请输入二级科目和三级科目')
    const key = secondary + '\u0000' + tertiary
    if (pairs.has(key)) throw new Error('该二级科目下已存在相同三级科目')
    pairs.add(key)
  }
}
