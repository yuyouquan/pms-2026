import type {
  ProjectInfoFieldDefinition,
  ProjectInfoGroupKey,
} from '@/constants/projectInfoSchema'

export interface ProjectFieldPreferenceScope {
  userId: string
  projectId: string
  groupKey: ProjectInfoGroupKey
}

export interface ProjectFieldVisibilityPreference extends ProjectFieldPreferenceScope {
  visibleFieldKeys: string[]
  updatedAt: string
}

export interface ProjectFieldPreferenceRepository {
  get(scope: ProjectFieldPreferenceScope): ProjectFieldVisibilityPreference | null
  save(preference: ProjectFieldVisibilityPreference): void
}

const STORAGE_PREFIX = 'pms:project-field-visibility:v1'

const buildStorageKey = (scope: ProjectFieldPreferenceScope) => (
  [STORAGE_PREFIX, scope.userId, scope.projectId, scope.groupKey]
    .map(encodeURIComponent)
    .join(':')
)

export class LocalStorageProjectFieldPreferenceRepository implements ProjectFieldPreferenceRepository {
  get(scope: ProjectFieldPreferenceScope) {
    if (typeof window === 'undefined') return null
    try {
      const raw = window.localStorage.getItem(buildStorageKey(scope))
      if (!raw) return null
      const parsed = JSON.parse(raw) as ProjectFieldVisibilityPreference
      if (!Array.isArray(parsed.visibleFieldKeys)) return null
      return { ...scope, visibleFieldKeys: parsed.visibleFieldKeys, updatedAt: parsed.updatedAt || '' }
    } catch {
      return null
    }
  }

  save(preference: ProjectFieldVisibilityPreference) {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(buildStorageKey(preference), JSON.stringify(preference))
    } catch {
      // Mock persistence is best effort. Production implementation will use an API/database repository.
    }
  }
}

export const defaultProjectFieldPreferenceRepository = new LocalStorageProjectFieldPreferenceRepository()

export const getDefaultVisibleFieldKeys = (fields: ProjectInfoFieldDefinition[]) => (
  fields.filter(field => field.defaultVisible || !field.hideable).map(field => field.key)
)

export const reconcileVisibleFieldKeys = (
  fields: ProjectInfoFieldDefinition[],
  storedKeys?: string[] | null,
) => {
  const validKeys = new Set(fields.map(field => field.key))
  const storedSet = new Set((storedKeys || []).filter(key => validKeys.has(key)))
  fields.forEach(field => {
    if (!field.hideable || (!storedKeys && field.defaultVisible)) storedSet.add(field.key)
  })
  return fields.filter(field => storedSet.has(field.key)).map(field => field.key)
}
