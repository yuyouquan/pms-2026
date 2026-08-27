import { buildEnumOptions, getSingleEnumValues } from '@/lib/enumConsumers'
import {
  createInitialEnumRows,
  formatEnumCellValue,
  normalizeEnumFieldValue,
} from '@/lib/enumValues'
import type { LegacyTosEnumTypeKey } from '@/types/enums'

// Deprecated compatibility adapter. Remove after all callers use the flat enum consumer APIs.

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
  return normalizeEnumFieldValue(
    'first-sale-tos',
    'value',
    withoutStatus.replace(/^tOS\s+/i, 'tOS'),
  )
}

const flatTosType = (type: LegacyTosEnumTypeKey) =>
  type === 'tos-2-part' ? 'roadmap-tos' as const : 'first-sale-tos' as const

function currentValuesFor(type: LegacyTosEnumTypeKey, values: readonly string[]): string[] {
  const unique = new Set<string>()
  for (const candidate of values) {
    const value = normalizeEnumFieldValue(
      flatTosType(type),
      'value',
      candidate.replace(/^tOS\s+/i, 'tOS'),
    )
    if (value) unique.add(value)
  }
  return [...unique]
}

export function formatTosEnumValue(input: unknown): string {
  const value = normalizeTosEnumReference(input)
  return value ? formatEnumCellValue('first-sale-tos', 'value', value) : ''
}

/** @deprecated Use buildEnumOptions with rowsByType and a flat enum key. */
export function buildTosEnumOptions(
  type: LegacyTosEnumTypeKey,
  configuredValues: readonly string[],
  historicalValues: readonly unknown[] = [],
): TosEnumOption[] {
  const currentValues = currentValuesFor(type, configuredValues)
  const normalizedHistory: string[] = []
  for (const input of historicalValues) {
    const value = normalizeTosEnumReference(input)
    if (value) normalizedHistory.push(value)
  }
  const rowsByType = createInitialEnumRows()
  const flatType = flatTosType(type)
  rowsByType[flatType] = currentValues.map((value, index) => ({
    id: `legacy-tos-option-${index + 1}`,
    value,
  }))
  return buildEnumOptions(rowsByType, flatType, normalizedHistory)
}

/** @deprecated Use getSingleEnumValues with rowsByType and a flat enum key. */
export function resolveCurrentTosEnumValue(
  type: LegacyTosEnumTypeKey,
  input: unknown,
  configuredValues: readonly string[],
): string | null {
  const value = normalizeTosEnumReference(input)
  return currentValuesFor(type, configuredValues).includes(value) ? value : null
}

/** @deprecated Use getSingleEnumValues with rowsByType and a flat enum key. */
export function getCurrentTosEnumValues(type: LegacyTosEnumTypeKey, configuredValues: readonly string[]): string[] {
  const rowsByType = createInitialEnumRows()
  const flatType = flatTosType(type)
  rowsByType[flatType] = currentValuesFor(type, configuredValues).map((value, index) => ({
    id: `legacy-tos-value-${index + 1}`,
    value,
  }))
  return getSingleEnumValues(rowsByType, flatType)
}
