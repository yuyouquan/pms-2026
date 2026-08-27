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
] as const

export type EnumTypeKey = (typeof ENUM_TYPE_KEYS)[number]

export type EnumKind = 'single' | 'tmg-map' | 'chip-map' | 'project-category-map'

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

export type EnumRow = SingleEnumRow | TmgMappingRow | ChipMappingRow | ProjectCategoryMappingRow

export type EnumRowByType<K extends EnumTypeKey> = K extends 'tmg-subdomain-mapping'
  ? TmgMappingRow
  : K extends 'chip-mapping'
    ? ChipMappingRow
    : K extends 'project-category-mapping'
      ? ProjectCategoryMappingRow
      : SingleEnumRow

export type EnumRowsByType = {
  [K in EnumTypeKey]: EnumRowByType<K>[]
}

export type EnumRowDraftByType = {
  [K in EnumTypeKey]: Omit<EnumRowByType<K>, 'id'>
}

export type EnumRowDraft = EnumRowDraftByType[EnumTypeKey]

export type EnumFieldKey =
  | 'value'
  | 'domain'
  | 'subdomain'
  | 'chipCode'
  | 'chipModel'
  | 'chipPlatform'
  | 'ipmProjectCategory'
  | 'pmsProjectCategory'
  | 'pmsSecondaryCategory'

export interface EnumColumnDefinition {
  key: EnumFieldKey
  label: string
}

export interface EnumTypeDefinition {
  key: EnumTypeKey
  label: string
  scopeLabel: string
  kind: EnumKind
  columns: readonly EnumColumnDefinition[]
}

export type EnumFieldErrors = Partial<Record<EnumFieldKey, string>>

export type EnumActionResult =
  | { ok: true }
  | {
      ok: false
      reason: 'invalid' | 'duplicate' | 'missing' | 'storage'
      fieldErrors?: EnumFieldErrors
    }

export type EnumRowValidationResult =
  | { ok: true; row: EnumRowDraft }
  | {
      ok: false
      reason: 'invalid' | 'duplicate'
      fieldErrors: EnumFieldErrors
    }

/** @deprecated Temporary compatibility contract for consumers migrated in later tasks. */
export type LegacyTosEnumTypeKey = 'tos-2-part' | 'tos-3-part'

/** @deprecated Temporary compatibility contract for consumers migrated in later tasks. */
export type EnumValuesByType = Record<LegacyTosEnumTypeKey, string[]>

/** @deprecated Temporary compatibility contract for consumers migrated in later tasks. */
export interface LegacyTosEnumTypeDefinition {
  key: LegacyTosEnumTypeKey
  label: string
  initialValues: readonly string[]
}
