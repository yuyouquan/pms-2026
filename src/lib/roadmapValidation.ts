import type {
  PlannedRoadmapProjectInput,
  RoadmapAndroidVersion,
  RoadmapBrand,
  RoadmapProductType,
  RoadmapProjectRow,
  RoadmapValidationErrors,
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

export function buildRoadmapDisplayName(
  projectCode: string,
  androidVersion: RoadmapAndroidVersion,
  productType: RoadmapProductType,
) {
  const normalizedCode = projectCode.trim()
  return productType === '老品' ? `${normalizedCode}(${androidVersion})` : normalizedCode
}

export function buildRoadmapDuplicateKey(
  projectCode: string,
  androidVersion: string,
  productType: string,
) {
  return `${projectCode.trim().toLocaleUpperCase()}|${androidVersion.trim()}|${productType.trim()}`
}

export function normalizeTosVersionName(input: string) {
  const match = input.trim().match(/^tos\s*(\d+)\.(\d+)$/i)
  if (!match) return null
  const major = Number(match[1])
  const minor = Number(match[2])
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
) {
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

export function validatePlannedProject(
  input: Partial<PlannedRoadmapProjectInput>,
  existingProjects: readonly ExistingRoadmapDuplicateCandidate[] = [],
  excludedId?: string,
): RoadmapValidationErrors {
  const errors: RoadmapValidationErrors = {}

  for (const field of REQUIRED_PLANNED_FIELDS) {
    const value = input[field]
    if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) {
      errors[field] = '此字段为必填项'
    }
  }

  if (input.brand && !isRoadmapBrand(input.brand)) {
    errors.brand = '品牌无效'
  } else if (input.brand && input.productLine) {
    const options = getProductLineOptions(input.brand)
    if (!options.some(option => option === input.productLine)) errors.productLine = '产品线不属于所选品牌'
  }

  for (const field of ['str5Date', 'launchDate'] as const) {
    const value = input[field]
    if (value && !isExactIsoDate(value)) errors[field] = '日期格式必须为 YYYY-MM-DD'
  }

  if (
    input.projectCode
    && input.androidVersion
    && input.productType
    && isExactRoadmapDuplicate(input as RoadmapDuplicateCandidate, existingProjects, excludedId)
  ) {
    errors.projectCode = '已存在相同项目'
  }

  return errors
}
