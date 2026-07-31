import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { StateStorage } from 'zustand/middleware'
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
  selectedType: EnumTypeKey
  hasHydrated: boolean
  hydrationError: string | null
}

export interface EnumActions {
  setSelectedType: (type: EnumTypeKey) => void
  addEnumValue: (type: EnumTypeKey, input: string) => EnumActionResult
  updateEnumValue: (type: EnumTypeKey, currentValue: string, input: string) => EnumActionResult
  deleteEnumValue: (type: EnumTypeKey, value: string) => EnumActionResult
  hydrateEnumStore: () => Promise<boolean>
  resetLocalConfig: () => Promise<boolean>
  completeHydration: (error?: unknown) => void
}

export type EnumStore = EnumState & EnumActions
export type PersistedEnumState = Pick<EnumState, 'valuesByType'>

export const ENUM_STORAGE_KEY = 'pms-enum-values'
const ENUM_STORE_VERSION = 1

const enumStateStorage: StateStorage = {
  getItem(name) {
    if (typeof window === 'undefined') throw new Error('localStorage unavailable')
    return window.localStorage.getItem(name)
  },
  setItem(name, value) {
    if (typeof window === 'undefined') throw new Error('localStorage unavailable')
    window.localStorage.setItem(name, value)
  },
  removeItem(name) {
    if (typeof window === 'undefined') throw new Error('localStorage unavailable')
    window.localStorage.removeItem(name)
  },
}

function hydrationErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : ''
  const detail = error instanceof Error ? error.message : String(error ?? '')
  if (error instanceof SyntaxError || /JSON|parse|unexpected token/i.test(detail)) {
    return '本地枚举配置无法读取，请重试或重置本地配置。'
  }
  if (name === 'SecurityError' || /storage.*(?:blocked|unavailable)|localStorage unavailable/i.test(detail)) {
    return '本地枚举存储不可用，请检查浏览器权限后重试。'
  }
  return '本地枚举配置加载失败，请重试或重置本地配置。'
}

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

export function partializeEnumState(state: Pick<EnumState, 'valuesByType'>): PersistedEnumState {
  return { valuesByType: cloneValues(state.valuesByType) }
}

export function createEnumStore(initial?: Partial<PersistedEnumState>) {
  let valuesByType = mergeInitialValues(initial)
  const fixture = {
    getState: (): PersistedEnumState => ({ valuesByType: cloneValues(valuesByType) }),
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

export const useEnumStore = create<EnumStore>()((rawSet, get, api) => {
  let hydrationInFlight: Promise<boolean> | null = null

  const persistedCreator = persist<EnumStore, [], [], PersistedEnumState>(
    (set) => {
      const commitValues = (
        previousValues: EnumValuesByType,
        nextValues: EnumValuesByType,
      ): EnumActionResult => {
        try {
          set({ valuesByType: nextValues })
          return { ok: true }
        } catch (error) {
          rawSet({
            valuesByType: cloneValues(previousValues),
            hasHydrated: true,
            hydrationError: hydrationErrorMessage(error),
          })
          return { ok: false, reason: 'storage' }
        }
      }

      const readPersistApi = () => (
        api as typeof api & {
          persist?: { rehydrate?: () => Promise<void> | void }
        }
      ).persist

      return {
        valuesByType: createInitialEnumValues(),
        selectedType: 'tos-2-part',
        hasHydrated: false,
        hydrationError: null,
        setSelectedType: type => {
          if (isEnumTypeKey(type)) rawSet({ selectedType: type })
        },
        addEnumValue: (type, input) => {
          const previousValues = get().valuesByType
          const next = addValue(previousValues, type, input)
          if (!next.result.ok) return next.result
          return commitValues(previousValues, next.valuesByType)
        },
        updateEnumValue: (type, currentValue, input) => {
          const previousValues = get().valuesByType
          const next = updateValue(previousValues, type, currentValue, input)
          if (!next.result.ok) return next.result
          return commitValues(previousValues, next.valuesByType)
        },
        deleteEnumValue: (type, value) => {
          const previousValues = get().valuesByType
          const next = deleteValue(previousValues, type, value)
          if (!next.result.ok) return next.result
          return commitValues(previousValues, next.valuesByType)
        },
        completeHydration: (error) => {
          rawSet({
            hasHydrated: true,
            hydrationError: error ? hydrationErrorMessage(error) : null,
          })
        },
        hydrateEnumStore: async () => {
          if (hydrationInFlight) return hydrationInFlight
          const persistApi = readPersistApi()
          if (!persistApi?.rehydrate) {
            rawSet({
              hasHydrated: true,
              hydrationError: '本地枚举存储不可用，请刷新页面后重试。',
            })
            return false
          }

          rawSet({ hasHydrated: false, hydrationError: null })
          hydrationInFlight = Promise.resolve(persistApi.rehydrate())
            .then(() => get().hasHydrated && !get().hydrationError)
            .catch(error => {
              rawSet({ hasHydrated: true, hydrationError: hydrationErrorMessage(error) })
              return false
            })
            .finally(() => {
              hydrationInFlight = null
            })
          return hydrationInFlight
        },
        resetLocalConfig: async () => {
          try {
            enumStateStorage.removeItem(ENUM_STORAGE_KEY)
          } catch (error) {
            rawSet({ hasHydrated: true, hydrationError: hydrationErrorMessage(error) })
            return false
          }

          const seeds = createInitialEnumValues()
          rawSet({ valuesByType: seeds, hasHydrated: false, hydrationError: null })
          try {
            set({ valuesByType: seeds })
          } catch (error) {
            rawSet({ valuesByType: seeds, hasHydrated: true, hydrationError: hydrationErrorMessage(error) })
            return false
          }
          return get().hydrateEnumStore()
        },
      }
    },
    {
      name: ENUM_STORAGE_KEY,
      version: ENUM_STORE_VERSION,
      storage: createJSONStorage<PersistedEnumState>(() => enumStateStorage),
      migrate: migrateEnumState,
      partialize: partializeEnumState,
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...migrateEnumState(persistedState, ENUM_STORE_VERSION),
      }),
      onRehydrateStorage: state => (_hydratedState, error) => {
        state.completeHydration(error)
      },
      skipHydration: true,
    },
  )

  return persistedCreator(rawSet, get, api as Parameters<typeof persistedCreator>[2])
})

export { TOS_ENUM_TYPE_KEYS }
