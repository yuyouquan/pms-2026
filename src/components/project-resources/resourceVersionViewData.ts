export const RESOURCE_TABS = [
  { key: 'dashboard', label: '总览' },
  { key: 'annual', label: '年度预算' },
  { key: 'projectEstimate', label: '项目概算' },
  { key: 'projectBudget', label: '项目预算' },
  { key: 'accounting', label: '项目核算' },
] as const

export type ResourceTab = typeof RESOURCE_TABS[number]['key']
export type ResourceBudgetType = 'annual' | 'projectEstimate' | 'projectBudget'

export interface ResourceMonthlyRow {
  id: string
  versionId: string
  primaryDepartment: string
  secondaryDepartment: string
  estimatedTotal: number
  monthlyData: Record<string, number>
  isArchived?: boolean
}

export function chooseResourceVersion<T extends { id: string; minorVersion: number }>(versions: readonly T[], selectedId?: string): T | undefined {
  return versions.find(version => version.id === selectedId)
    ?? versions.reduce<T | undefined>((latest, version) => !latest || version.minorVersion > latest.minorVersion ? version : latest, undefined)
}

const rounded = (amount: number) => Math.round(amount * 1000) / 1000
const validMonth = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value)

/** A selected-version projection; activation belongs to aggregate consumers, never this view. */
export function buildResourceMonthlyView(allRows: readonly ResourceMonthlyRow[], versionId: string, startMonth?: string, endMonth?: string, year = 'all', additionalMonths: readonly string[] = []) {
  const rows = allRows.filter(row => row.versionId === versionId && !row.isArchived)
  const monthSet = new Set([...rows.flatMap(row => Object.keys(row.monthlyData)), ...additionalMonths].filter(validMonth))
  if (startMonth && endMonth && validMonth(startMonth) && validMonth(endMonth) && startMonth <= endMonth) {
    const [startYear, start] = startMonth.split('-').map(Number)
    const [endYear, end] = endMonth.split('-').map(Number)
    for (let month = startYear * 12 + start - 1; month <= endYear * 12 + end - 1; month++) {
      monthSet.add(`${Math.floor(month / 12)}-${String(month % 12 + 1).padStart(2, '0')}`)
    }
  }
  const allMonths = [...monthSet].sort()
  const years = [...new Set(allMonths.map(month => month.slice(0, 4)))]
  const months = allMonths.filter(month => year === 'all' || month.startsWith(`${year}-`))
  const totals = Object.fromEntries(months.map(month => [month, rounded(rows.reduce((sum, row) => sum + (row.monthlyData[month] || 0), 0))]))
  const allocatedTotal = rounded(rows.reduce((sum, row) => sum + Object.values(row.monthlyData).reduce((subtotal, value) => subtotal + (Number.isFinite(value) ? value : 0), 0), 0))
  const estimatedTotal = rounded(rows.reduce((sum, row) => sum + row.estimatedTotal, 0))
  const differences = rows.map(row => rounded(row.estimatedTotal - Object.values(row.monthlyData).reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0)))
  const remainingTotal = rounded(differences.reduce((sum, value) => sum + Math.max(0, value), 0))
  const excessTotal = rounded(differences.reduce((sum, value) => sum + Math.max(0, -value), 0))
  return { rows, months, years, totals, estimatedTotal, allocatedTotal, remainingTotal, excessTotal,
    unallocatedTotal: rounded(estimatedTotal - allocatedTotal), visibleTotal: rounded(Object.values(totals).reduce((sum, value) => sum + value, 0)) }
}
