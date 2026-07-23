import { isMachineProjectType } from '@/constants/projectTypes'
import type {
  PlannedRoadmapProjectInput,
  RoadmapAndroidVersion,
  RoadmapBrand,
  RoadmapProductType,
  RoadmapProjectRow,
  RoadmapValidationErrors,
  TosVersionConfig,
} from '@/types/roadmap'

export const PRODUCT_LINES_BY_BRAND = {
  TECNO: ['PHANTOM', 'CAMON', 'POVA', 'SPARK', 'POP'],
  Infinix: ['ZERO', 'NOTE', 'GT', 'HOT', 'SMART'],
  itel: ['SUPER', 'POWER', 'CITY', 'A'],
  待定: ['待定'],
  其他品牌: ['其他系列'],
} as const satisfies Record<RoadmapBrand, readonly string[]>

const REQUIRED_PLANNED_FIELDS: readonly (Exclude<keyof PlannedRoadmapProjectInput, 'remark'>)[] = [
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
const ROADMAP_RAMS = ['2GB', '3GB', '4GB', '6GB', '8GB', '12GB', '16GB'] as const
const ROADMAP_VERSION_TYPES = ['Full', 'Slim', 'Go'] as const
const ROADMAP_DEVELOP_MODES = ['自研', 'ODC', 'ITD-ODC', 'ODM', '纯外研'] as const

export interface NormalizedTosVersion {
  name: string
  major: number
  minor: number
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
  const match = input.trim().match(/^tos\s*(\d+)\.(\d+)$/i)
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

function isExactIsoDate(value: unknown): value is string {
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
  if (isVersionIdSet(catalog)) return catalog.has(id)
  return (catalog as readonly Pick<TosVersionConfig, 'id'>[]).some(version => version.id === id)
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

  if (values.machineProjectType && !isMachineProjectType(String(values.machineProjectType))) {
    errors.machineProjectType = '整机项目类型无效'
  }
  if (values.androidVersion && !isAllowedValue(values.androidVersion, ROADMAP_ANDROID_VERSIONS)) {
    errors.androidVersion = '安卓版本无效'
  }
  if (values.productType && !isAllowedValue(values.productType, ROADMAP_PRODUCT_TYPES)) {
    errors.productType = '产品类型无效'
  }
  if (values.startRam && !isAllowedValue(values.startRam, ROADMAP_RAMS)) errors.startRam = '起步 RAM 无效'
  if (values.versionType && !isAllowedValue(values.versionType, ROADMAP_VERSION_TYPES)) errors.versionType = '版本类型无效'
  if (values.developMode && !isAllowedValue(values.developMode, ROADMAP_DEVELOP_MODES)) errors.developMode = '开发模式无效'

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
    errors.firstSaleTosVersionId = '首销 tOS 版本无效'
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
