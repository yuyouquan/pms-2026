import { isValidEnumValue, normalizeEnumValue, sortEnumValues } from '@/lib/enumValues'
import type { EnumTypeKey } from '@/types/enums'

export interface TosEnumOption {
  label: string
  value: string
  disabled?: boolean
}

export function normalizeTosEnumReference(input: unknown): string {
  if (typeof input !== 'string') return ''
  const withoutStatus = input.trim().replace(/（已停用）$/, '').trim()
  const legacyId = /^tos-(\d+)-(\d+)(?:-(\d+))?$/i.exec(withoutStatus)
  if (legacyId) return legacyId.slice(1).filter(Boolean).join('.')
  return normalizeEnumValue(withoutStatus.replace(/^tOS\s+/i, 'tOS'))
}

function currentValuesFor(type: EnumTypeKey, values: readonly string[]): string[] {
  const unique = new Set<string>()
  for (const candidate of values) {
    if (!isValidEnumValue(type, candidate)) continue
    unique.add(normalizeEnumValue(candidate))
  }
  return sortEnumValues([...unique])
}

export function formatTosEnumValue(input: unknown): string {
  const value = normalizeTosEnumReference(input)
  return value ? `tOS${value}` : ''
}

export function buildTosEnumOptions(
  type: EnumTypeKey,
  configuredValues: readonly string[],
  historicalValues: readonly unknown[] = [],
): TosEnumOption[] {
  const currentValues = currentValuesFor(type, configuredValues)
  const currentSet = new Set(currentValues)
  const historicalOptions: TosEnumOption[] = []
  const historicalSet = new Set<string>()
  for (const input of historicalValues) {
    const value = normalizeTosEnumReference(input)
    if (!value || currentSet.has(value) || historicalSet.has(value)) continue
    historicalSet.add(value)
    historicalOptions.push({ label: `${formatTosEnumValue(value)}（已停用）`, value, disabled: true })
  }
  return [
    ...currentValues.map(value => ({ label: formatTosEnumValue(value), value })),
    ...historicalOptions,
  ]
}

export function resolveCurrentTosEnumValue(
  type: EnumTypeKey,
  input: unknown,
  configuredValues: readonly string[],
): string | null {
  const value = normalizeTosEnumReference(input)
  return currentValuesFor(type, configuredValues).includes(value) ? value : null
}

export function getCurrentTosEnumValues(type: EnumTypeKey, configuredValues: readonly string[]): string[] {
  return currentValuesFor(type, configuredValues)
}
