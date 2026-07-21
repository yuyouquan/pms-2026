import type {
  ProjectInfoFieldDefinition,
  ProjectInfoGroupKey,
} from '@/constants/projectInfoSchema'
import {
  LEGACY_PROJECT_INFO_SCHEMA_VERSION,
  PROJECT_INFO_SCHEMA_VERSION,
} from '@/constants/projectInfoSchema'

export interface ProjectFieldPreferenceScope {
  userId: string
  projectId: string
  groupKey: ProjectInfoGroupKey
}

export interface ProjectFieldVisibilityPreference extends ProjectFieldPreferenceScope {
  visibleFieldKeys: string[]
  schemaVersion: number
  updatedAt: string
}

export interface ProjectFieldPreferenceRepository {
  get(scope: ProjectFieldPreferenceScope): ProjectFieldVisibilityPreference | null
  save(preference: ProjectFieldVisibilityPreference): void | boolean | Promise<void | boolean>
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
      const schemaVersion = Number.isInteger(parsed.schemaVersion) && parsed.schemaVersion >= 0
        ? parsed.schemaVersion
        : LEGACY_PROJECT_INFO_SCHEMA_VERSION
      return {
        ...scope,
        visibleFieldKeys: parsed.visibleFieldKeys.filter((key): key is string => typeof key === 'string'),
        schemaVersion,
        updatedAt: parsed.updatedAt || '',
      }
    } catch {
      return null
    }
  }

  save(preference: ProjectFieldVisibilityPreference) {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(buildStorageKey(preference), JSON.stringify(preference))
  }
}

export const defaultProjectFieldPreferenceRepository = new LocalStorageProjectFieldPreferenceRepository()

export const getDefaultVisibleFieldKeys = (fields: ProjectInfoFieldDefinition[]) => (
  fields.filter(field => field.defaultVisible || !field.hideable).map(field => field.key)
)

export const reconcileVisibleFieldKeys = (
  fields: ProjectInfoFieldDefinition[],
  storedPreference?: Pick<ProjectFieldVisibilityPreference, 'visibleFieldKeys' | 'schemaVersion'> | null,
) => {
  const validKeys = new Set(fields.map(field => field.key))
  const storedSet = new Set(
    (storedPreference?.visibleFieldKeys || []).filter(key => validKeys.has(key)),
  )
  fields.forEach(field => {
    const introducedInVersion = field.introducedInSchemaVersion
      ?? LEGACY_PROJECT_INFO_SCHEMA_VERSION
    const addedAfterStoredSchema = !!storedPreference
      && introducedInVersion > storedPreference.schemaVersion

    if (
      !field.hideable
      || (!storedPreference && field.defaultVisible)
      || (addedAfterStoredSchema && field.defaultVisible)
    ) {
      storedSet.add(field.key)
    }
  })
  return fields.filter(field => storedSet.has(field.key)).map(field => field.key)
}

export const createCurrentFieldVisibilityPreference = (
  scope: ProjectFieldPreferenceScope,
  visibleFieldKeys: string[],
): ProjectFieldVisibilityPreference => ({
  ...scope,
  visibleFieldKeys,
  schemaVersion: PROJECT_INFO_SCHEMA_VERSION,
  updatedAt: new Date().toISOString(),
})
