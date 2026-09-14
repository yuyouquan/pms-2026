import type { FanTrialAllocation } from '@/types/fanTrial'

export function readFanTrialRows(value: unknown): FanTrialAllocation[] {
  return Array.isArray(value) ? value.filter((row): row is FanTrialAllocation => (
    !!row && typeof row === 'object' && typeof row.country === 'string'
  )) : []
}

export function selectFanTrialCountries(countries: readonly string[], previous: readonly FanTrialAllocation[]): FanTrialAllocation[] {
  return [...new Set(countries)].map(country => ({ country, quantity: previous.find(row => row.country === country)?.quantity ?? null }))
}

export const isValidTrialQuantity = (quantity: unknown): quantity is number => (
  typeof quantity === 'number' && Number.isSafeInteger(quantity) && quantity > 0
)

/** Missing flags in older records mean no. Retired countries can only be retained from the saved record. */
export function validateFanTrial(
  values: { fanTrialEnabled?: unknown; fanTrialCountries?: unknown },
  availableCountries?: readonly string[],
  savedRows: unknown = [],
): { fieldKey: 'fanTrialEnabled' | 'fanTrialCountries'; message: string } | null {
  const enabled = values.fanTrialEnabled ?? '否'
  if (enabled === '否') return null
  if (enabled !== '是') return { fieldKey: 'fanTrialEnabled', message: '请选择是否粉丝试用' }
  const error = (message: string) => ({ fieldKey: 'fanTrialCountries' as const, message })
  const rows = readFanTrialRows(values.fanTrialCountries)
  if (!rows.length) return error('请至少选择一个粉丝试用国家，并填写试用台数')
  if (!Array.isArray(values.fanTrialCountries) || rows.length !== values.fanTrialCountries.length) return error('粉丝试用国家配置不完整')
  const seen = new Set<string>()
  const historical = new Set(readFanTrialRows(savedRows).map(row => row.country))
  let total = 0
  for (const row of rows) {
    if (!row.country.trim()) return error('请选择粉丝试用国家')
    if (seen.has(row.country)) return error('粉丝试用国家不可重复')
    seen.add(row.country)
    if (availableCountries && !availableCountries.includes(row.country) && !historical.has(row.country)) return error(`${row.country}已不在国家配置中，请重新选择`)
    if (!isValidTrialQuantity(row.quantity)) return error(`请填写${row.country}的试用台数（正整数）`)
    total += row.quantity
  }
  if (!Number.isSafeInteger(total)) return error('试用台数合计过大，请调整')
  return null
}
