import type { EnumTypeDefinition, EnumTypeKey, EnumValuesByType } from '@/types/enums'

export const TOS_ENUM_REGISTRY: Record<EnumTypeKey, EnumTypeDefinition> = {
  'tos-2-part': {
    key: 'tos-2-part',
    label: 'tOS版本（2位）',
    initialValues: ['16.0', '17.2'],
  },
  'tos-3-part': {
    key: 'tos-3-part',
    label: 'tOS版本（3位）',
    initialValues: ['16.0.1', '16.0.2', '17.2.0'],
  },
}

export const TOS_ENUM_TYPE_KEYS = Object.freeze([
  'tos-2-part',
  'tos-3-part',
] as const satisfies readonly EnumTypeKey[])

const FORMAT_BY_TYPE: Record<EnumTypeKey, RegExp> = {
  'tos-2-part': /^\d+\.\d+$/,
  'tos-3-part': /^\d+\.\d+\.\d+$/,
}

export function isEnumTypeKey(value: unknown): value is EnumTypeKey {
  return typeof value === 'string' && TOS_ENUM_TYPE_KEYS.includes(value as EnumTypeKey)
}

export function normalizeEnumValue(value: string): string {
  const trimmed = value.trim()
  const prefixed = /^tOS(\d+\.\d+(?:\.\d+)?)$/.exec(trimmed)
  return prefixed ? prefixed[1] : trimmed
}

export function validateEnumValue(type: EnumTypeKey, input: string): string {
  const value = normalizeEnumValue(input)
  if (!FORMAT_BY_TYPE[type]?.test(value)) {
    throw new Error(`Invalid ${type} format`)
  }
  return value
}

export function isValidEnumValue(type: EnumTypeKey, input: unknown): input is string {
  if (typeof input !== 'string') return false
  try {
    validateEnumValue(type, input)
    return true
  } catch {
    return false
  }
}

export function sortEnumValues(input: readonly string[]): string[] {
  const compareNumericSegment = (left: string, right: string) => {
    const normalizedLeft = left.replace(/^0+(?=\d)/, '')
    const normalizedRight = right.replace(/^0+(?=\d)/, '')
    if (normalizedLeft.length !== normalizedRight.length) {
      return normalizedLeft.length - normalizedRight.length
    }
    if (normalizedLeft < normalizedRight) return -1
    if (normalizedLeft > normalizedRight) return 1
    return 0
  }

  return input
    .map((value, index) => ({ value, index, segments: value.split('.') }))
    .sort((left, right) => {
      const segmentCount = Math.max(left.segments.length, right.segments.length)
      for (let index = 0; index < segmentCount; index += 1) {
        if (left.segments[index] === undefined) return -1
        if (right.segments[index] === undefined) return 1
        const segmentComparison = compareNumericSegment(left.segments[index], right.segments[index])
        if (segmentComparison !== 0) return segmentComparison
      }
      return left.index - right.index
    })
    .map(item => item.value)
}

export function createInitialEnumValues(): EnumValuesByType {
  return {
    'tos-2-part': [...TOS_ENUM_REGISTRY['tos-2-part'].initialValues],
    'tos-3-part': [...TOS_ENUM_REGISTRY['tos-3-part'].initialValues],
  }
}
