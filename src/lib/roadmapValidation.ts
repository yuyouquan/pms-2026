import {
  PROJECT_CATEGORY_MACHINE,
  PROJECT_SECONDARY_CATEGORIES,
} from '@/constants/projectTypes'
import type {
  PlannedRoadmapProjectInput,
  RoadmapAndroidVersion,
  RoadmapBrand,
  RoadmapProductType,
  RoadmapProjectRow,
  RoadmapValidationErrors,
  TosVersionConfig,
} from '@/types/roadmap'
import { formatTosSnapshot, normalizeTosSnapshot } from '@/lib/enumConsumers'

export const PRODUCT_LINES_BY_BRAND = {
  TECNO: ['PHANTOM', 'CAMON', 'POVA', 'SPARK', 'POP'],
  Infinix: ['ZERO', 'NOTE', 'GT', 'HOT', 'SMART'],
  itel: ['SUPER', 'POWER', 'CITY', 'A'],
  待定: ['待定'],
  其他品牌: ['其他系列'],
} as const satisfies Record<RoadmapBrand, readonly string[]>

const REQUIRED_PLANNED_FIELDS: readonly (Exclude<keyof PlannedRoadmapProjectInput, 'remark' | 'str5Estimated' | 'launchEstimated'>)[] = [
  'machineProjectType',
  'projectCode',
  'androidVersion',
  'firstSaleTosVersionId',
  'brand',
  'productLine',
  'productSeries',
  'marketName',
  'productType',
  'platform',
  'startRam',
  'versionType',
  'str5Date',
  'launchDate',
  'developMode',
]

const ISO_DATE_PATTERN = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/

const ROADMAP_ANDROID_VERSIONS: readonly RoadmapAndroidVersion[] = ['Android 16', 'Android 17', 'Android 18']
const ROADMAP_PRODUCT_TYPES: readonly RoadmapProductType[] = ['新品', '老品']

export interface NormalizedTosVersion {
  name: string
  major: number
  minor: number
}

export interface RoadmapTosSelectOption {
  label: string
  value: string
  disabled?: boolean
}

export type RoadmapTosVersionCatalog = ReadonlySet<string> | readonly Pick<TosVersionConfig, 'id'>[]

export function buildRoadmapDisplayName(
  projectCode: string,
  androidVersion: RoadmapAndroidVersion,
  productType: RoadmapProductType,
): string {
  const normalizedCode = projectCode.trim()
  return productType === '老品' ? `${normalizedCode}(${androidVersion})` : normalizedCode
}

export function buildRoadmapDuplicateKey(
  projectCode: string,
  androidVersion: string,
  productType: string,
): string {
  const normalizedCode = projectCode.trim().toUpperCase()
  return `${normalizedCode}|${androidVersion.trim()}|${productType.trim()}`
}

export function normalizeTosVersionName(input: string): NormalizedTosVersion | null {
  const match = normalizeTosSnapshot(input).match(/^(\d+)\.(\d+)$/)
  if (!match) return null
  const major = Number(match[1])
  const minor = Number(match[2])
  if (
    !Number.isSafeInteger(major)
    || !Number.isSafeInteger(minor)
    || major < 0
    || minor < 0
  ) return null
  return { name: `tOS ${major}.${minor}`, major, minor }
}

export function normalizeLegacyTosVersionName(input: string): NormalizedTosVersion | null {
  const normalized = normalizeTosVersionName(input)
  if (normalized) return normalized
  const match = normalizeTosSnapshot(input).match(/^(\d+)\.(\d+)\.\d+$/)
  if (!match) return null
  return normalizeTosVersionName(`${match[1]}.${match[2]}`)
}

/**
 * Roadmap records persist the enum's numeric string, while unknown historical
 * strings remain intact so removing an enum never erases business history.
 */
export function normalizeRoadmapTosValue(input: unknown): string {
  return normalizeTosSnapshot(input)
}

export function normalizeRoadmapTosReference(
  input: unknown,
  compatibilityDirectory: readonly Pick<TosVersionConfig, 'id' | 'name' | 'major' | 'minor'>[] = [],
): string {
  if (typeof input !== 'string') return ''
  const trimmed = input.trim()
  if (!trimmed) return ''
  const configured = compatibilityDirectory.find(version => (
    version.id === trimmed || version.name === trimmed
  ))
  if (configured) return normalizeRoadmapTosReference(configured.id)
  const legacyId = trimmed.match(/^tos-(\d+)-(\d+)(?:-\d+)?$/i)
  if (legacyId) return `${Number(legacyId[1])}.${Number(legacyId[2])}`
  const normalized = normalizeLegacyTosVersionName(trimmed)
  return normalized ? `${normalized.major}.${normalized.minor}` : normalizeRoadmapTosValue(trimmed)
}

export function formatRoadmapTosValue(input: unknown): string {
  return formatTosSnapshot(input) || '-'
}

export function buildRoadmapTosSelectOptions(
  currentValues: readonly string[],
  currentHistoricalValue?: string | null,
): RoadmapTosSelectOption[] {
  const current = currentValues.map(normalizeRoadmapTosValue).filter(Boolean)
  const currentSet = new Set(current)
  const historical = normalizeRoadmapTosReference(currentHistoricalValue)
  return [
    ...(historical && !currentSet.has(historical)
      ? [{
          label: `${formatRoadmapTosValue(historical)}（已停用）`,
          value: historical,
          disabled: true,
        }]
      : []),
    ...current.map(value => ({ label: formatRoadmapTosValue(value), value })),
  ]
}

export function formatTosVersionFull(
  version: Pick<TosVersionConfig, 'major' | 'minor'> & Partial<Pick<TosVersionConfig, 'id' | 'name'>>,
): string {
  if (Number.isSafeInteger(version.major) && Number.isSafeInteger(version.minor)) {
    return formatRoadmapTosValue(`${version.major}.${version.minor}`)
  }
  return formatRoadmapTosValue(version.id ?? version.name ?? '')
}

export function formatTosVersionDisplay(
  version: Pick<TosVersionConfig, 'major' | 'minor'> & Partial<Pick<TosVersionConfig, 'id' | 'name'>>,
): string {
  return formatTosVersionFull(version)
}

export function getProductLineOptions(brand: RoadmapBrand): readonly string[] {
  return PRODUCT_LINES_BY_BRAND[brand] ?? []
}

function isRoadmapBrand(value: unknown): value is RoadmapBrand {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PRODUCT_LINES_BY_BRAND, value)
}

export function normalizeLegacyRoadmapProductType(input: unknown): RoadmapProductType | null {
  if (input === '新品') return '新品'
  if (input === '老品' || input === '升级' || input === '换代') return '老品'
  return null
}

type RoadmapDuplicateCandidate = Pick<PlannedRoadmapProjectInput, 'projectCode' | 'androidVersion' | 'productType'>
type ExistingRoadmapDuplicateCandidate = RoadmapDuplicateCandidate & Pick<RoadmapProjectRow, 'id'>

export function isExactRoadmapDuplicate(
  candidate: RoadmapDuplicateCandidate,
  existingProjects: readonly ExistingRoadmapDuplicateCandidate[],
  excludedId?: string,
): boolean {
  const candidateKey = buildRoadmapDuplicateKey(candidate.projectCode, candidate.androidVersion, candidate.productType)
  return existingProjects.some(project => (
    project.id !== excludedId
    && buildRoadmapDuplicateKey(project.projectCode, project.androidVersion, project.productType) === candidateKey
  ))
}

export function isExactIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function isAllowedValue<T extends string>(value: unknown, allowedValues: readonly T[]): value is T {
  return typeof value === 'string' && allowedValues.some(allowed => allowed === value)
}

function isVersionIdSet(catalog: RoadmapTosVersionCatalog): catalog is ReadonlySet<string> {
  return 'has' in catalog && typeof catalog.has === 'function'
}

function tosCatalogHasId(catalog: RoadmapTosVersionCatalog, id: string): boolean {
  const normalizedId = normalizeRoadmapTosReference(id)
  if (isVersionIdSet(catalog)) {
    return catalog.has(id) || catalog.has(normalizedId)
  }
  return (catalog as readonly Pick<TosVersionConfig, 'id'>[]).some(version => (
    version.id === id || normalizeRoadmapTosReference(version.id) === normalizedId
  ))
}

export function validatePlannedProject(
  input: unknown,
  existingProjects: readonly ExistingRoadmapDuplicateCandidate[],
  excludedId: string | undefined,
  tosVersionCatalog: RoadmapTosVersionCatalog,
): RoadmapValidationErrors {
  const errors: RoadmapValidationErrors = {}
  const values: Record<string, unknown> = typeof input === 'object' && input !== null
    ? input as Record<string, unknown>
    : {}

  for (const field of REQUIRED_PLANNED_FIELDS) {
    const value = values[field]
    if (typeof value !== 'string' || !value.trim()) {
      errors[field] = '此字段为必填项'
    }
  }

  if (values.remark !== undefined && typeof values.remark !== 'string') errors.remark = '备注格式无效'
  if (values.str5Estimated !== undefined && typeof values.str5Estimated !== 'boolean') {
    errors.str5Estimated = 'STR5 预估状态无效'
  }
  if (values.launchEstimated !== undefined && typeof values.launchEstimated !== 'boolean') {
    errors.launchEstimated = '上市时间预估状态无效'
  }

  if (
    values.machineProjectType
    && !(PROJECT_SECONDARY_CATEGORIES[PROJECT_CATEGORY_MACHINE] as readonly string[])
      .includes(String(values.machineProjectType))
  ) {
    errors.machineProjectType = '项目二级分类无效'
  }
  if (values.androidVersion && !isAllowedValue(values.androidVersion, ROADMAP_ANDROID_VERSIONS)) {
    errors.androidVersion = '安卓版本无效'
  }
  if (values.productType && !isAllowedValue(values.productType, ROADMAP_PRODUCT_TYPES)) {
    errors.productType = '产品类型无效'
  }
  if (values.brand && !isRoadmapBrand(values.brand)) {
    errors.brand = '品牌无效'
  } else if (isRoadmapBrand(values.brand) && typeof values.productLine === 'string') {
    const options = getProductLineOptions(values.brand)
    if (!options.some(option => option === values.productLine)) errors.productLine = '产品线不属于所选品牌'
  }

  if (
    typeof values.firstSaleTosVersionId === 'string'
    && values.firstSaleTosVersionId.trim()
    && !tosCatalogHasId(tosVersionCatalog, values.firstSaleTosVersionId)
  ) {
    errors.firstSaleTosVersionId = 'tOS 版本无效'
  }

  for (const field of ['str5Date', 'launchDate'] as const) {
    const value = values[field]
    if (value && !isExactIsoDate(value)) errors[field] = '日期格式必须为 YYYY-MM-DD'
  }

  if (
    typeof values.projectCode === 'string'
    && isAllowedValue(values.androidVersion, ROADMAP_ANDROID_VERSIONS)
    && isAllowedValue(values.productType, ROADMAP_PRODUCT_TYPES)
    && isExactRoadmapDuplicate(values as RoadmapDuplicateCandidate, existingProjects, excludedId)
  ) {
    errors.projectCode = '已存在相同项目'
  }

  return errors
}
