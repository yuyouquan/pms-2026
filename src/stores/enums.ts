import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  createInitialEnumValues,
  isEnumTypeKey,
  isValidEnumValue,
  normalizeEnumValue,
  sortEnumValues,
  TOS_ENUM_TYPE_KEYS,
} from '@/lib/enumValues'
import type { EnumActionResult, EnumTypeKey, EnumValuesByType } from '@/types/enums'

export interface EnumState {
  valuesByType: EnumValuesByType
}

export interface EnumActions {
  addEnumValue: (type: EnumTypeKey, input: string) => EnumActionResult
  updateEnumValue: (type: EnumTypeKey, currentValue: string, input: string) => EnumActionResult
  deleteEnumValue: (type: EnumTypeKey, value: string) => EnumActionResult
}

export type EnumStore = EnumState & EnumActions
export type PersistedEnumState = Pick<EnumState, 'valuesByType'>

const ENUM_STORE_VERSION = 1

function cloneValues(values: EnumValuesByType): EnumValuesByType {
  return {
    'tos-2-part': [...values['tos-2-part']],
    'tos-3-part': [...values['tos-3-part']],
  }
}

function mergeInitialValues(input?: Partial<PersistedEnumState>): EnumValuesByType {
  const defaults = createInitialEnumValues()
  const source = input?.valuesByType
  if (!source) return defaults
  return {
    'tos-2-part': Array.isArray(source['tos-2-part']) ? [...source['tos-2-part']] : defaults['tos-2-part'],
    'tos-3-part': Array.isArray(source['tos-3-part']) ? [...source['tos-3-part']] : defaults['tos-3-part'],
  }
}

function addValue(valuesByType: EnumValuesByType, type: EnumTypeKey, input: string) {
  if (!isEnumTypeKey(type) || !isValidEnumValue(type, input)) {
    return { result: { ok: false, reason: 'invalid' } as const, valuesByType }
  }
  const value = normalizeEnumValue(input)
  if (valuesByType[type].includes(value)) {
    return { result: { ok: false, reason: 'duplicate' } as const, valuesByType }
  }
  return {
    result: { ok: true } as const,
    valuesByType: { ...valuesByType, [type]: sortEnumValues([...valuesByType[type], value]) },
  }
}

function updateValue(valuesByType: EnumValuesByType, type: EnumTypeKey, currentValue: string, input: string) {
  if (!isEnumTypeKey(type) || !isValidEnumValue(type, input)) {
    return { result: { ok: false, reason: 'invalid' } as const, valuesByType }
  }
  const currentIndex = valuesByType[type].indexOf(currentValue)
  if (currentIndex < 0) {
    return { result: { ok: false, reason: 'missing' } as const, valuesByType }
  }
  const value = normalizeEnumValue(input)
  if (valuesByType[type].some((candidate, index) => index !== currentIndex && candidate === value)) {
    return { result: { ok: false, reason: 'duplicate' } as const, valuesByType }
  }
  const next = [...valuesByType[type]]
  next[currentIndex] = value
  return {
    result: { ok: true } as const,
    valuesByType: { ...valuesByType, [type]: sortEnumValues(next) },
  }
}

function deleteValue(valuesByType: EnumValuesByType, type: EnumTypeKey, value: string) {
  if (!isEnumTypeKey(type) || !valuesByType[type].includes(value)) {
    return { result: { ok: false, reason: 'missing' } as const, valuesByType }
  }
  return {
    result: { ok: true } as const,
    valuesByType: { ...valuesByType, [type]: valuesByType[type].filter(candidate => candidate !== value) },
  }
}

function sanitizeCategory(type: EnumTypeKey, input: unknown, fallback: string[]): string[] {
  if (!Array.isArray(input)) return fallback
  const unique = new Set<string>()
  input.forEach(candidate => {
    if (isValidEnumValue(type, candidate)) unique.add(normalizeEnumValue(candidate))
  })
  return sortEnumValues([...unique])
}

export function migrateEnumState(persistedState: unknown, _fromVersion: number): PersistedEnumState {
  const defaults = createInitialEnumValues()
  const values = persistedState && typeof persistedState === 'object' && 'valuesByType' in persistedState
    ? (persistedState as { valuesByType?: unknown }).valuesByType
    : undefined
  const source = values && typeof values === 'object' ? values as Record<string, unknown> : {}

  return {
    valuesByType: {
      'tos-2-part': sanitizeCategory('tos-2-part', source['tos-2-part'], defaults['tos-2-part']),
      'tos-3-part': sanitizeCategory('tos-3-part', source['tos-3-part'], defaults['tos-3-part']),
    },
  }
}

export function partializeEnumState(state: EnumState): PersistedEnumState {
  return { valuesByType: cloneValues(state.valuesByType) }
}

export function createEnumStore(initial?: Partial<PersistedEnumState>) {
  let valuesByType = mergeInitialValues(initial)
  const fixture = {
    getState: (): EnumState => ({ valuesByType: cloneValues(valuesByType) }),
    getValues: (type: EnumTypeKey): string[] => [...valuesByType[type]],
    addEnumValue: (type: EnumTypeKey, input: string): EnumActionResult => {
      const next = addValue(valuesByType, type, input)
      valuesByType = next.valuesByType
      return next.result
    },
    updateEnumValue: (type: EnumTypeKey, currentValue: string, input: string): EnumActionResult => {
      const next = updateValue(valuesByType, type, currentValue, input)
      valuesByType = next.valuesByType
      return next.result
    },
    deleteEnumValue: (type: EnumTypeKey, value: string): EnumActionResult => {
      const next = deleteValue(valuesByType, type, value)
      valuesByType = next.valuesByType
      return next.result
    },
  }
  return fixture
}

export const useEnumStore = create<EnumStore>()(persist<EnumStore, [], [], PersistedEnumState>(
  (set, get) => ({
    valuesByType: createInitialEnumValues(),
    addEnumValue: (type, input) => {
      const next = addValue(get().valuesByType, type, input)
      if (next.result.ok) set({ valuesByType: next.valuesByType })
      return next.result
    },
    updateEnumValue: (type, currentValue, input) => {
      const next = updateValue(get().valuesByType, type, currentValue, input)
      if (next.result.ok) set({ valuesByType: next.valuesByType })
      return next.result
    },
    deleteEnumValue: (type, value) => {
      const next = deleteValue(get().valuesByType, type, value)
      if (next.result.ok) set({ valuesByType: next.valuesByType })
      return next.result
    },
  }),
  {
    name: 'pms-enum-values',
    version: ENUM_STORE_VERSION,
    storage: createJSONStorage(() => localStorage),
    migrate: migrateEnumState,
    partialize: partializeEnumState,
    merge: (persistedState, currentState) => ({
      ...currentState,
      ...migrateEnumState(persistedState, ENUM_STORE_VERSION),
    }),
  },
))

export { TOS_ENUM_TYPE_KEYS }
