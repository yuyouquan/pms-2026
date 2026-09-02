export const ENUM_TYPE_KEYS = [
  'first-sale-tos',
  'roadmap-tos',
  'machine-project-status',
  'technical-project-status',
  'tos-capability-project-status',
  'machine-health-status',
  'version-type',
  'software-project-level',
  'product-series',
  'research-mode',
  'machine-development-mode',
  'technical-development-mode',
  'upgrade-strategy',
  'system-type',
  'kernel-version',
  'chip-mapping',
  'memory-size',
  'project-category-mapping',
  'build-option',
  'build-market',
  'tmg-subdomain-mapping',
  'core-value',
  'android-version',
  'package-mode-mapping',
] as const

export type EnumTypeKey = (typeof ENUM_TYPE_KEYS)[number]

export type EnumKind = 'single' | 'tmg-map' | 'chip-map' | 'project-category-map' | 'package-map'

export interface BaseEnumRow {
  id: string
}

export interface SingleEnumRow extends BaseEnumRow {
  value: string
}

export interface TmgMappingRow extends BaseEnumRow {
  domain: string
  subdomain: string
}

export interface ChipMappingRow extends BaseEnumRow {
  chipCode: string
  chipModel: string
  chipPlatform: string
}

export interface ProjectCategoryMappingRow extends BaseEnumRow {
  ipmProjectCategory: string
  pmsProjectCategory: string
  pmsSecondaryCategory: string
}

export interface PackageModeMappingRow extends BaseEnumRow {
  androidVersion: string
  chipModel: string
  packageMode: string
}

export type EnumRow = SingleEnumRow | TmgMappingRow | ChipMappingRow | ProjectCategoryMappingRow | PackageModeMappingRow

export type EnumRowByType<K extends EnumTypeKey> = K extends 'tmg-subdomain-mapping'
  ? TmgMappingRow
  : K extends 'chip-mapping'
    ? ChipMappingRow
    : K extends 'project-category-mapping'
      ? ProjectCategoryMappingRow
      : K extends 'package-mode-mapping'
        ? PackageModeMappingRow
        : SingleEnumRow

export type EnumRowsByType = {
  [K in EnumTypeKey]: EnumRowByType<K>[]
}

export type EnumRowDraftByType = {
  [K in EnumTypeKey]: Omit<EnumRowByType<K>, 'id'>
}

export type EnumRowDraft = EnumRowDraftByType[EnumTypeKey]

export type EnumFieldKeyByType<K extends EnumTypeKey> = K extends EnumTypeKey
  ? Extract<keyof EnumRowDraftByType[K], string>
  : never

export type EnumFieldKey = EnumFieldKeyByType<EnumTypeKey>

export interface EnumColumnDefinition<K extends EnumTypeKey = EnumTypeKey> {
  key: EnumFieldKeyByType<K>
  label: string
}

export interface EnumTypeDefinition<K extends EnumTypeKey = EnumTypeKey> {
  key: K
  label: string
  scopeLabel: string
  kind: EnumKind
  columns: readonly EnumColumnDefinition<K>[]
}

export type EnumFieldErrors = Partial<Record<EnumFieldKey, string>>

export type EnumActionResult =
  | { ok: true }
  | {
      ok: false
      reason: 'invalid' | 'duplicate' | 'missing' | 'storage'
      fieldErrors?: EnumFieldErrors
    }

export type EnumRowValidationResult<K extends EnumTypeKey = EnumTypeKey> =
  | { ok: true; row: EnumRowDraftByType[K] }
  | {
      ok: false
      reason: 'invalid' | 'duplicate'
      fieldErrors: EnumFieldErrors
    }
