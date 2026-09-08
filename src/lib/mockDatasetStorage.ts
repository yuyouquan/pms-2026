/** Bump only when replacing the complete prototype dataset, not for normal schema changes. */
export const MOCK_DATASET_VERSION = '2026-09-08-v1'
export const MOCK_DATASET_VERSION_STORAGE_KEY = 'pms:mock-dataset-version'

// Explicit ownership prevents this refresh from deleting other apps on the same origin.
const LOCAL_STORAGE_KEYS = new Set([
  'pms-projects',
  'pms-project-permissions',
  'pms-plan-store',
  'pms-enum-values',
  'pms-project-roadmap',
  'pms-technical-projects',
  'pms-technical-plans',
  'pms-mr-version-plan-store',
  'pms-level3-plan-store',
  'pms_roadmap_milestone_views',
  'pms_project_custom_views',
])
const LOCAL_STORAGE_PREFIXES = [
  'pms:project-creation-draft:',
  'pms:project-summary:',
  // Field preferences encode each key segment, including their namespace.
  'pms%3Aproject-field-visibility%3Av1:',
]
const SESSION_STORAGE_KEYS = new Set(['pms:technical-project-list-target-child'])

type StorageArea = 'localStorage' | 'sessionStorage'

interface SynchronousStorage {
  getItem(name: string): string | null
  setItem(name: string, value: string): void
  removeItem(name: string): void
}

function prepareStorage(area: StorageArea): Storage {
  if (typeof window === 'undefined') throw new Error(`${area} unavailable outside the browser`)
  const storage = window[area]
  if (!storage) throw new Error(`${area} unavailable`)
  if (storage.getItem(MOCK_DATASET_VERSION_STORAGE_KEY) === MOCK_DATASET_VERSION) return storage

  const ownedKeys = area === 'localStorage' ? LOCAL_STORAGE_KEYS : SESSION_STORAGE_KEYS
  const keysToRemove = new Set(ownedKeys)
  if (area === 'localStorage') {
    // Capture dynamic keys before removing any entries: deletion shifts Storage indices.
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)
      if (key && LOCAL_STORAGE_PREFIXES.some(prefix => key.startsWith(prefix))) keysToRemove.add(key)
    }
  }
  for (const key of keysToRemove) storage.removeItem(key)
  // A thrown read, enumeration, removal, or write prevents access to residual old data.
  // Never write this marker until every owned key has been removed successfully.
  storage.setItem(MOCK_DATASET_VERSION_STORAGE_KEY, MOCK_DATASET_VERSION)
  return storage
}

/** Strict entry point for consumers that already surface persistence errors. */
export const getPmsLocalStorage = (): Storage => prepareStorage('localStorage')

function safeStorage(area: StorageArea): SynchronousStorage {
  return {
    getItem(name) {
      try {
        return prepareStorage(area).getItem(name)
      } catch {
        return null
      }
    },
    setItem(name, value) {
      try {
        prepareStorage(area).setItem(name, value)
      } catch {
        // Read-only/blocked storage must not interrupt in-memory prototype interaction.
      }
    },
    removeItem(name) {
      try {
        prepareStorage(area).removeItem(name)
      } catch {
        // No fallback reads: incomplete cleanup stays closed until storage works again.
      }
    },
  }
}

/** Synchronous adapters also gate Zustand's automatic hydration during module evaluation. */
export const pmsLocalStorage = safeStorage('localStorage')
export const pmsSessionStorage = safeStorage('sessionStorage')

export function refreshMockDatasetStorage(): void {
  for (const area of ['localStorage', 'sessionStorage'] as const) {
    try {
      prepareStorage(area)
    } catch {
      // Each area is independent. Every later read/write retries its own guard.
    }
  }
}

// Runs before importing stores can hydrate, including direct template/share routes.
// Per-operation guards above also cover storage becoming available after startup.
refreshMockDatasetStorage()
