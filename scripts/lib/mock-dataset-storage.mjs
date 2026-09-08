import { fileURLToPath } from 'node:url'
import { loadTypeScriptModule } from './source-contract.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
export const {
  MOCK_DATASET_VERSION,
  MOCK_DATASET_VERSION_STORAGE_KEY,
} = loadTypeScriptModule(root, 'src/lib/mockDatasetStorage.ts')

/** Schema-migration fixtures belong to the active dataset; obsolete datasets are tested separately. */
export function createCurrentDatasetStorage(initial = {}) {
  const values = new Map([
    [MOCK_DATASET_VERSION_STORAGE_KEY, MOCK_DATASET_VERSION],
    ...Object.entries(initial),
  ])
  return {
    get length() { return values.size },
    key: index => [...values.keys()][index] ?? null,
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, String(value)) },
    removeItem: key => { values.delete(key) },
    clear: () => { values.clear() },
  }
}
