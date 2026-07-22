import type {
  RoadmapColumnKey,
  RoadmapProjectRow,
  TosVersionConfig,
} from '@/types/roadmap'
import { MAX_TOS_VERSION_COMPONENT, normalizeTosVersionName } from '@/lib/roadmapValidation'

type SemanticTos = Pick<TosVersionConfig, 'major' | 'minor'>
type ComparableRoadmapRecord = Partial<Record<RoadmapColumnKey, unknown>>

const APPROVED_RAM_VALUES = new Map([
  ['2GB', 2],
  ['3GB', 3],
  ['4GB', 4],
  ['6GB', 6],
  ['8GB', 8],
  ['12GB', 12],
  ['16GB', 16],
])

function deterministicValueKey(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value !== 'object') return `${typeof value}:${String(value)}`
  const record = value as Record<string, unknown>
  if ('major' in record || 'minor' in record) return `semantic:${String(record.major)}|${String(record.minor)}`
  return `object:${Object.keys(record).sort().map(key => `${key}=${String(record[key])}`).join('|')}`
}

function compareInvalidValues(left: unknown, right: unknown): number {
  const leftKey = deterministicValueKey(left)
  const rightKey = deterministicValueKey(right)
  const localized = compareLocalizedText(leftKey, rightKey)
  if (localized !== 0) return localized
  return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0
}

function compareParsedValues<T>(
  leftRaw: unknown,
  rightRaw: unknown,
  left: T | null,
  right: T | null,
  compareValid: (leftValue: T, rightValue: T) => number,
): number {
  if (left !== null && right !== null) return compareValid(left, right)
  if (left !== null) return -1
  if (right !== null) return 1
  return compareInvalidValues(leftRaw, rightRaw)
}

function parseSemanticTos(value: unknown): SemanticTos | null {
  if (typeof value !== 'object' || value === null) return null
  const candidate = value as Partial<Record<keyof SemanticTos, unknown>>
  if (
    !Number.isSafeInteger(candidate.major)
    || !Number.isSafeInteger(candidate.minor)
    || Number(candidate.major) < 0
    || Number(candidate.minor) < 0
    || Number(candidate.major) > MAX_TOS_VERSION_COMPONENT
    || Number(candidate.minor) > MAX_TOS_VERSION_COMPONENT
  ) return null
  return { major: Number(candidate.major), minor: Number(candidate.minor) }
}

export function compareSemanticTos(left: unknown, right: unknown): number {
  const leftVersion = parseSemanticTos(left)
  const rightVersion = parseSemanticTos(right)
  return compareParsedValues(
    left,
    right,
    leftVersion,
    rightVersion,
    (leftValue, rightValue) => leftValue.major - rightValue.major || leftValue.minor - rightValue.minor,
  )
}

export function compareRam(left: unknown, right: unknown): number {
  const leftRam = typeof left === 'string' ? APPROVED_RAM_VALUES.get(left) ?? null : null
  const rightRam = typeof right === 'string' ? APPROVED_RAM_VALUES.get(right) ?? null : null
  return compareParsedValues(left, right, leftRam, rightRam, (leftValue, rightValue) => leftValue - rightValue)
}

function parseIsoDate(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? value : null
}

export function compareIsoDate(left: unknown, right: unknown): number {
  return compareParsedValues(left, right, parseIsoDate(left), parseIsoDate(right), (leftValue, rightValue) => leftValue.localeCompare(rightValue))
}

export function compareLocalizedText(left: string, right: string): number {
  return left.localeCompare(right, 'zh-CN', { numeric: true, sensitivity: 'base' })
}

function isRoadmapRecord(value: unknown, field: RoadmapColumnKey): value is ComparableRoadmapRecord {
  return typeof value === 'object' && value !== null && field in value
}

function extractValue(
  field: RoadmapColumnKey,
  value: unknown | ComparableRoadmapRecord | RoadmapProjectRow,
): unknown {
  return isRoadmapRecord(value, field) ? value[field] : value
}

function resolveTosValue(value: unknown, versions: readonly TosVersionConfig[]): SemanticTos | null {
  const semanticValue = parseSemanticTos(value)
  if (semanticValue) return semanticValue
  if (typeof value !== 'string') return null
  const configured = versions.find(version => version.id === value || version.name === value)
  if (configured) return parseSemanticTos(configured)
  return normalizeTosVersionName(value)
}

function compareTextValues(left: unknown, right: unknown): number {
  const leftText = typeof left === 'string' ? left : null
  const rightText = typeof right === 'string' ? right : null
  return compareParsedValues(left, right, leftText, rightText, compareLocalizedText)
}

export function compareRoadmapValues(
  field: RoadmapColumnKey,
  left: unknown | ComparableRoadmapRecord | RoadmapProjectRow,
  right: unknown | ComparableRoadmapRecord | RoadmapProjectRow,
  versions: readonly TosVersionConfig[] = [],
): number {
  const leftValue = extractValue(field, left)
  const rightValue = extractValue(field, right)

  if (field === 'firstSaleTosVersionId') {
    const leftVersion = resolveTosValue(leftValue, versions)
    const rightVersion = resolveTosValue(rightValue, versions)
    return compareParsedValues(
      leftValue,
      rightValue,
      leftVersion,
      rightVersion,
      (leftSemantic, rightSemantic) => compareSemanticTos(leftSemantic, rightSemantic),
    )
  }
  if (field === 'startRam') return compareRam(leftValue, rightValue)
  if (field === 'str5Date' || field === 'launchDate') return compareIsoDate(leftValue, rightValue)
  return compareTextValues(leftValue, rightValue)
}
