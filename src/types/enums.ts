export type EnumTypeKey = 'tos-2-part' | 'tos-3-part'

export type EnumValuesByType = Record<EnumTypeKey, string[]>

export type EnumActionResult =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'duplicate' | 'missing' }

export interface EnumTypeDefinition {
  key: EnumTypeKey
  label: string
  initialValues: readonly string[]
}
