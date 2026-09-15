import type { NonLaborInvestment } from '@/types/nonLaborInvestment'
import type { ConfigRecord } from '@/types/hrConfig'

export const emptyNonLaborInvestment = (): NonLaborInvestment => ({ startMonth: null, endMonth: null, items: [] })
export const cloneNonLaborInvestment = (value?: NonLaborInvestment): NonLaborInvestment => value
  ? { ...value, items: value.items.map(item => ({ ...item, monthlyAmounts: { ...item.monthlyAmounts } })) }
  : emptyNonLaborInvestment()

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
export function validateNonLaborInvestment(value: NonLaborInvestment, subjects: readonly ConfigRecord[], previous?: NonLaborInvestment): NonLaborInvestment {
  const result = cloneNonLaborInvestment(value)
  if (!result.startMonth && !result.endMonth && result.items.length === 0) return result
  const months = nonLaborMonths(result)
  if (!months.length) throw new Error('请选择有效的非人力投入时间范围')
  const keys = new Set<string>(), ids = new Set<string>()
  for (const item of result.items) {
    const key = item.secondarySubject.trim() + '\u0000' + item.tertiarySubject.trim()
    if (keys.has(key)) throw new Error('同一版本中不能重复选择相同科目')
    keys.add(key)
    if (!item.id || ids.has(item.id)) throw new Error('非人力投入行标识重复')
    ids.add(item.id)
    const matches = (row: { subjectId?: string; id: string; secondarySubject?: unknown; tertiarySubject?: unknown }) =>
      (row.subjectId ?? row.id) === item.subjectId && row.secondarySubject === item.secondarySubject && row.tertiarySubject === item.tertiarySubject
    const active = subjects.some(row => row.enabled !== false && matches(row))
    const retained = previous?.items.some(row => row.id === item.id && matches(row))
    if (!item.secondarySubject.trim() || !item.tertiarySubject.trim() || (!active && !retained)) throw new Error('请选择有效的二级科目和对应三级科目')
    for (const [month, amount] of Object.entries(item.monthlyAmounts)) {
      if (!Number.isFinite(amount) || amount < 0) throw new Error('非人力投入必须为非负数')
      if (!months.includes(month)) throw new Error('投入月份不能超出所选时间范围')
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
