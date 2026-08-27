import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  createInitialEnumRows,
  ENUM_DEFINITIONS,
  isEnumTypeKey,
  validateAndNormalizeEnumRow,
} from '@/lib/enumValues'
import {
  ENUM_TYPE_KEYS,
  type EnumActionResult,
  type EnumRowByType,
  type EnumRowDraftByType,
  type EnumRowsByType,
  type EnumTypeKey,
} from '@/types/enums'

export interface EnumState {
  rowsByType: EnumRowsByType
  selectedType: EnumTypeKey
  hasHydrated: boolean
  hydrationError: string | null
}

export interface EnumActions {
  setSelectedType: (type: EnumTypeKey) => void
  addEnumRow: <K extends EnumTypeKey>(type: K, draft: EnumRowDraftByType[K]) => EnumActionResult
  updateEnumRow: <K extends EnumTypeKey>(type: K, rowId: string, draft: EnumRowDraftByType[K]) => EnumActionResult
  deleteEnumRow: (type: EnumTypeKey, rowId: string) => EnumActionResult
  hydrateEnumStore: () => Promise<boolean>
  resetLocalConfig: () => Promise<boolean>
  completeHydration: (error?: unknown) => void
}

export type EnumStore = EnumState & EnumActions
export type PersistedEnumState = Pick<EnumState, 'rowsByType'>

export const ENUM_STORAGE_KEY = 'pms-enum-values'
const ENUM_STORE_VERSION = 2

interface SynchronousStateStorage {
  getItem: (name: string) => string | null
  setItem: (name: string, value: string) => void
  removeItem: (name: string) => void
}

/** Production durability is backed only by the browser's synchronous localStorage API. */
const enumStateStorage: SynchronousStateStorage = {
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

function cloneRows(rowsByType: EnumRowsByType): EnumRowsByType {
  return Object.fromEntries(ENUM_TYPE_KEYS.map(type => [
    type,
    rowsByType[type].map(row => ({ ...row })),
  ])) as EnumRowsByType
}

function migratedRows<K extends 'roadmap-tos' | 'first-sale-tos'>(
  type: K,
  enumValues: readonly string[],
): EnumRowByType<K>[] {
  return enumValues.map((value, index) => ({
    id: `migrated-${type}-${index + 1}`,
    value,
  })) as EnumRowByType<K>[]
}

function sanitizeLegacyValues(input: unknown) {
  if (!Array.isArray(input)) return { usable: false, values: [] as string[] }
  const uniqueValues: string[] = []
  for (const candidate of input) {
    if (typeof candidate !== 'string') continue
    const trimmed = candidate.trim()
    const value = (trimmed.startsWith('tOS') ? trimmed.slice(3) : trimmed).trim()
    if (!value) continue
    if (!uniqueValues.includes(value)) uniqueValues.push(value)
  }
  return { usable: input.length === 0 || uniqueValues.length > 0, values: uniqueValues }
}

function migrateLegacyState(persistedState: unknown): PersistedEnumState {
  const seeds = createInitialEnumRows()
  const values = persistedState && typeof persistedState === 'object' && 'valuesByType' in persistedState
    ? (persistedState as { valuesByType?: unknown }).valuesByType
    : undefined
  const source = values && typeof values === 'object' ? values as Record<string, unknown> : {}
  const twoPart = sanitizeLegacyValues(source['tos-2-part'])
  const threePart = sanitizeLegacyValues(source['tos-3-part'])

  if (twoPart.usable) {
    seeds['roadmap-tos'] = migratedRows('roadmap-tos', twoPart.values)
  }
  const firstSaleValues = [...threePart.values]
  for (const value of twoPart.values) {
    if (!firstSaleValues.includes(value)) firstSaleValues.push(value)
  }
  if (threePart.usable || twoPart.usable) {
    seeds['first-sale-tos'] = migratedRows('first-sale-tos', firstSaleValues)
  }

  return { rowsByType: seeds }
}

function migratedId(type: EnumTypeKey, sourceIndex: number, usedIds: ReadonlySet<string>): string {
  let suffix = sourceIndex + 1
  let candidate = `migrated-${type}-${suffix}`
  while (usedIds.has(candidate)) {
    suffix += 1
    candidate = `migrated-${type}-${suffix}`
  }
  return candidate
}

function sanitizeRowsForType<K extends EnumTypeKey>(
  type: K,
  input: unknown,
  fallback: readonly EnumRowByType<K>[],
): EnumRowByType<K>[] {
  if (!Array.isArray(input)) return fallback.map(row => ({ ...row }))
  if (input.length === 0) return []

  const validatedRows: EnumRowByType<K>[] = []
  const candidates: Array<{
    sourceIndex: number
    suppliedId: string | null
    row: EnumRowDraftByType[K]
  }> = []
  input.forEach((candidate, sourceIndex) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return
    const source = candidate as Record<string, unknown>
    const draft = Object.fromEntries(ENUM_DEFINITIONS[type].columns.map(({ key }) => [
      key,
      typeof source[key] === 'string' ? source[key] : '',
    ])) as EnumRowDraftByType[K]
    const validation = validateAndNormalizeEnumRow(type, draft, validatedRows)
    if (!validation.ok) return

    const suppliedId = typeof source.id === 'string' && source.id.trim() ? source.id : null
    candidates.push({ sourceIndex, suppliedId, row: validation.row })
    validatedRows.push({ id: `validated-${sourceIndex}`, ...validation.row } as EnumRowByType<K>)
  })

  if (candidates.length === 0) return fallback.map(row => ({ ...row }))

  const reservedIds = new Set(candidates.flatMap(candidate => candidate.suppliedId ? [candidate.suppliedId] : []))
  const claimedIds = new Set<string>()
  return candidates.map(candidate => {
    const id = candidate.suppliedId && !claimedIds.has(candidate.suppliedId)
      ? candidate.suppliedId
      : migratedId(type, candidate.sourceIndex, new Set([...reservedIds, ...claimedIds]))
    claimedIds.add(id)
    return { id, ...candidate.row } as EnumRowByType<K>
  })
}

function sanitizeV2State(persistedState: unknown): PersistedEnumState {
  const seeds = createInitialEnumRows()
  const rows = persistedState && typeof persistedState === 'object' && 'rowsByType' in persistedState
    ? (persistedState as { rowsByType?: unknown }).rowsByType
    : undefined
  const source = rows && typeof rows === 'object' ? rows as Record<string, unknown> : {}
  const entries = ENUM_TYPE_KEYS.map(type => [
    type,
    sanitizeRowsForType(type, source[type], seeds[type]),
  ])
  return { rowsByType: Object.fromEntries(entries) as EnumRowsByType }
}

export function migrateEnumState(persistedState: unknown, fromVersion: number): PersistedEnumState {
  return fromVersion >= 2 ? sanitizeV2State(persistedState) : migrateLegacyState(persistedState)
}

export function partializeEnumState(state: Pick<EnumState, 'rowsByType'>): PersistedEnumState {
  return { rowsByType: cloneRows(state.rowsByType) }
}

function mergeInitialRows(input?: Partial<PersistedEnumState>): EnumRowsByType {
  return input ? sanitizeV2State(input).rowsByType : createInitialEnumRows()
}

type IdFactory = () => string

const defaultIdFactory: IdFactory = () => {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  return `enum-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function allocateUserId(type: EnumTypeKey, rows: readonly { id: string }[], idFactory: IdFactory): string {
  const existingIds = new Set(rows.map(row => row.id))
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = idFactory()
    if (typeof candidate === 'string' && candidate.trim() && !existingIds.has(candidate)) return candidate
  }
  let candidate = defaultIdFactory()
  while (existingIds.has(candidate)) candidate = defaultIdFactory()
  return candidate || `enum-${type}-${Date.now()}`
}

interface RowMutation {
  result: EnumActionResult
  rowsByType: EnumRowsByType
}

function addRow<K extends EnumTypeKey>(
  rowsByType: EnumRowsByType,
  type: K,
  draft: EnumRowDraftByType[K],
  idFactory: IdFactory,
): RowMutation {
  if (!isEnumTypeKey(type)) return { result: { ok: false, reason: 'invalid' }, rowsByType }
  const existingRows = rowsByType[type]
  const validation = validateAndNormalizeEnumRow(type, draft, existingRows)
  if (!validation.ok) return { result: validation, rowsByType }
  const row = {
    id: allocateUserId(type, existingRows, idFactory),
    ...validation.row,
  } as EnumRowByType<K>
  return {
    result: { ok: true },
    rowsByType: { ...rowsByType, [type]: [...existingRows, row] } as EnumRowsByType,
  }
}

function updateRow<K extends EnumTypeKey>(
  rowsByType: EnumRowsByType,
  type: K,
  rowId: string,
  draft: EnumRowDraftByType[K],
): RowMutation {
  if (!isEnumTypeKey(type)) return { result: { ok: false, reason: 'invalid' }, rowsByType }
  const existingRows = rowsByType[type]
  const rowIndex = existingRows.findIndex(row => row.id === rowId)
  if (rowIndex < 0) return { result: { ok: false, reason: 'missing' }, rowsByType }
  const validation = validateAndNormalizeEnumRow(type, draft, existingRows, rowId)
  if (!validation.ok) return { result: validation, rowsByType }
  const nextRows = [...existingRows]
  nextRows[rowIndex] = { id: rowId, ...validation.row } as EnumRowByType<K>
  return {
    result: { ok: true },
    rowsByType: { ...rowsByType, [type]: nextRows } as EnumRowsByType,
  }
}

function deleteRow(rowsByType: EnumRowsByType, type: EnumTypeKey, rowId: string): RowMutation {
  if (!isEnumTypeKey(type)) return { result: { ok: false, reason: 'invalid' }, rowsByType }
  const existingRows = rowsByType[type]
  const rowIndex = existingRows.findIndex(row => row.id === rowId)
  if (rowIndex < 0) return { result: { ok: false, reason: 'missing' }, rowsByType }
  return {
    result: { ok: true },
    rowsByType: {
      ...rowsByType,
      [type]: existingRows.filter(row => row.id !== rowId),
    } as EnumRowsByType,
  }
}

export function createEnumStore(initial?: Partial<PersistedEnumState>, idFactory: IdFactory = defaultIdFactory) {
  let rowsByType = mergeInitialRows(initial)
  let selectedType: EnumTypeKey = 'first-sale-tos'
  let hasHydrated = false
  let hydrationError: string | null = null

  const apply = (mutation: RowMutation) => {
    if (mutation.result.ok) rowsByType = mutation.rowsByType
    return mutation.result
  }

  return {
    getState: () => ({
      rowsByType: cloneRows(rowsByType),
      selectedType,
      hasHydrated,
      hydrationError,
    }),
    getRows: <K extends EnumTypeKey>(type: K): EnumRowByType<K>[] =>
      rowsByType[type].map(row => ({ ...row })) as EnumRowByType<K>[],
    setSelectedType: (type: EnumTypeKey) => {
      if (isEnumTypeKey(type)) selectedType = type
    },
    addEnumRow: <K extends EnumTypeKey>(type: K, draft: EnumRowDraftByType[K]) =>
      apply(addRow(rowsByType, type, draft, idFactory)),
    updateEnumRow: <K extends EnumTypeKey>(type: K, rowId: string, draft: EnumRowDraftByType[K]) =>
      apply(updateRow(rowsByType, type, rowId, draft)),
    deleteEnumRow: (type: EnumTypeKey, rowId: string) => apply(deleteRow(rowsByType, type, rowId)),
    hydrateEnumStore: async () => {
      hasHydrated = true
      hydrationError = null
      return true
    },
    resetLocalConfig: () => {
      rowsByType = createInitialEnumRows()
      hydrationError = null
      return true
    },
    completeHydration: (error?: unknown) => {
      hasHydrated = true
      hydrationError = error ? hydrationErrorMessage(error) : null
    },
  }
}

export const useEnumStore = create<EnumStore>()((rawSet, get, api) => {
  let hydrationInFlight: Promise<boolean> | null = null
  let resetInFlight: Promise<boolean> | null = null

  const persistedCreator = persist<EnumStore, [], [], PersistedEnumState>(
    (set) => {
      const commitRows = (
        previousRows: EnumRowsByType,
        nextRows: EnumRowsByType,
      ): EnumActionResult => {
        try {
          set({ rowsByType: nextRows })
          return { ok: true }
        } catch (error) {
          rawSet({
            rowsByType: cloneRows(previousRows),
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

      const seeds = createInitialEnumRows()
      return {
        rowsByType: seeds,
        selectedType: 'first-sale-tos',
        hasHydrated: false,
        hydrationError: null,
        setSelectedType: type => {
          if (isEnumTypeKey(type)) rawSet({ selectedType: type })
        },
        addEnumRow: (type, draft) => {
          const previousRows = get().rowsByType
          const next = addRow(previousRows, type, draft, defaultIdFactory)
          if (!next.result.ok) return next.result
          return commitRows(previousRows, next.rowsByType)
        },
        updateEnumRow: (type, rowId, draft) => {
          const previousRows = get().rowsByType
          const next = updateRow(previousRows, type, rowId, draft)
          if (!next.result.ok) return next.result
          return commitRows(previousRows, next.rowsByType)
        },
        deleteEnumRow: (type, rowId) => {
          const previousRows = get().rowsByType
          const next = deleteRow(previousRows, type, rowId)
          if (!next.result.ok) return next.result
          return commitRows(previousRows, next.rowsByType)
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
          if (resetInFlight) return resetInFlight

          const reset = async () => {
            const activeHydration = hydrationInFlight
            if (activeHydration) await activeHydration.catch(() => false)

            try {
              enumStateStorage.removeItem(ENUM_STORAGE_KEY)
            } catch (error) {
              rawSet({ hasHydrated: true, hydrationError: hydrationErrorMessage(error) })
              return false
            }

            const nextSeeds = createInitialEnumRows()
            rawSet({ rowsByType: nextSeeds, hasHydrated: false, hydrationError: null })
            try {
              set({ rowsByType: nextSeeds })
            } catch (error) {
              rawSet({ rowsByType: nextSeeds, hasHydrated: true, hydrationError: hydrationErrorMessage(error) })
              return false
            }

            try {
              const hydrated = await get().hydrateEnumStore()
              if (!get().hasHydrated) {
                rawSet({
                  hasHydrated: true,
                  hydrationError: hydrated ? null : '本地枚举配置加载失败，请重试或重置本地配置。',
                })
              }
              return hydrated
            } catch (error) {
              rawSet({ hasHydrated: true, hydrationError: hydrationErrorMessage(error) })
              return false
            }
          }

          resetInFlight = reset().finally(() => {
            resetInFlight = null
          })
          return resetInFlight
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
        rowsByType: migrateEnumState(persistedState, ENUM_STORE_VERSION).rowsByType,
      }),
      onRehydrateStorage: state => (_hydratedState, error) => {
        state.completeHydration(error)
      },
      skipHydration: true,
    },
  )

  return persistedCreator(rawSet, get, api as Parameters<typeof persistedCreator>[2])
})

export async function ensureEnumHydrated(): Promise<boolean> {
  const state = useEnumStore.getState()
  if (state.hasHydrated && !state.hydrationError) return true
  return state.hydrateEnumStore()
}
