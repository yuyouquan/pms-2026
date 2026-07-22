import type {
  RoadmapColumnKey,
  RoadmapProjectRow,
  RoadmapRam,
  TosVersionConfig,
} from '@/types/roadmap'
import { normalizeTosVersionName } from '@/lib/roadmapValidation'

type SemanticTos = Pick<TosVersionConfig, 'major' | 'minor'>
type ComparableRoadmapValue = string | null | undefined | SemanticTos
type ComparableRoadmapRecord = Partial<Record<RoadmapColumnKey, ComparableRoadmapValue>>

export function compareSemanticTos(left: SemanticTos, right: SemanticTos) {
  return left.major - right.major || left.minor - right.minor
}

export function compareRam(left: RoadmapRam | string, right: RoadmapRam | string) {
  const parseRam = (value: string) => Number.parseInt(value.replace(/GB$/i, ''), 10)
  return parseRam(left) - parseRam(right)
}

export function compareIsoDate(left: string, right: string) {
  return left.localeCompare(right)
}

export function compareLocalizedText(left: string, right: string) {
  return left.localeCompare(right, 'zh-CN', { numeric: true, sensitivity: 'base' })
}

function isRoadmapRecord(value: ComparableRoadmapValue | ComparableRoadmapRecord, field: RoadmapColumnKey): value is ComparableRoadmapRecord {
  return typeof value === 'object' && value !== null && field in value
}

function extractValue(
  field: RoadmapColumnKey,
  value: ComparableRoadmapValue | ComparableRoadmapRecord | RoadmapProjectRow,
) {
  return isRoadmapRecord(value, field) ? value[field] : value as ComparableRoadmapValue
}

function resolveTosValue(value: ComparableRoadmapValue, versions: readonly TosVersionConfig[]): SemanticTos | null {
  if (typeof value === 'object' && value !== null) return value
  if (typeof value !== 'string') return null
  const configured = versions.find(version => version.id === value || version.name === value)
  return configured ?? normalizeTosVersionName(value)
}

export function compareRoadmapValues(
  field: RoadmapColumnKey,
  left: ComparableRoadmapValue | ComparableRoadmapRecord | RoadmapProjectRow,
  right: ComparableRoadmapValue | ComparableRoadmapRecord | RoadmapProjectRow,
  versions: readonly TosVersionConfig[] = [],
) {
  const leftValue = extractValue(field, left)
  const rightValue = extractValue(field, right)

  if (field === 'firstSaleTosVersionId') {
    const leftVersion = resolveTosValue(leftValue, versions)
    const rightVersion = resolveTosValue(rightValue, versions)
    if (leftVersion && rightVersion) return compareSemanticTos(leftVersion, rightVersion)
  }
  if (field === 'startRam') return compareRam(String(leftValue ?? ''), String(rightValue ?? ''))
  if (field === 'str5Date' || field === 'launchDate') return compareIsoDate(String(leftValue ?? ''), String(rightValue ?? ''))
  return compareLocalizedText(String(leftValue ?? ''), String(rightValue ?? ''))
}
