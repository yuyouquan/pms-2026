import { getProjectAttribute, isFormalProject } from '@/types/projectRegistry'
import {
  isMachineProjectType,
  MACHINE_PROJECT_TYPES,
  normalizeMachineSecondaryCategory,
  type MachineProjectType,
} from '@/constants/projectTypes'
import {
  buildRoadmapDisplayName,
  buildRoadmapDuplicateKey,
  normalizeLegacyRoadmapProductType,
  normalizeRoadmapTosReference,
} from '@/lib/roadmapValidation'
import { formatPrimaryChipCode } from '@/lib/enumConsumers'
import { getProjectInfoValue, type ProjectInfoProject } from '@/lib/projectInfoValues'
import type { ProjectItem } from '@/types/app'
import type {
  PlannedRoadmapProject,
  RoadmapAndroidVersion,
  RoadmapBrand,
  RoadmapDevelopMode,
  RoadmapPlanningConflictGroup,
  RoadmapProductType,
  RoadmapProjectRow,
  RoadmapRam,
  RoadmapSource,
  RoadmapVersionType,
  TosVersionConfig,
} from '@/types/roadmap'

const ROADMAP_BRANDS = new Set<RoadmapBrand>(['示例品牌A', '示例品牌B', '示例品牌C', '待定', '其他品牌'])
const ROADMAP_ANDROID_VERSIONS = new Set<RoadmapAndroidVersion>(['Android 16', 'Android 17', 'Android 18'])

function firstNonBlank(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (trimmed) return trimmed
  }
  return ''
}

function infoString(project: ProjectItem, key: string, ...fallbacks: unknown[]): string {
  const value = getProjectInfoValue(project as unknown as ProjectInfoProject, key)
  return typeof value === 'string' ? value.trim() : firstNonBlank(...fallbacks)
}

export function isVisibleRoadmapStatus(status: string): boolean {
  return status !== '已取消' && status !== '已暂停'
}

function extractNamedChipCode(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim().match(/-([^_\s]+)_(?:[^_\s]+)$/)?.[1]?.trim() ?? ''
}

export function resolveNormalProjectChipCode(project: ProjectItem): string {
  if (project.fieldValues && Object.prototype.hasOwnProperty.call(project.fieldValues, 'chipCode')) {
    return formatPrimaryChipCode(project.fieldValues?.chipCode)
  }
  return firstNonBlank(
    extractNamedChipCode(project.projectCode),
    extractNamedChipCode(project.name),
  )
}

function normalizeNormalProductType(value: unknown): RoadmapProductType | null {
  if (value === '切换') return '老品'
  return normalizeLegacyRoadmapProductType(value)
}

function normalizeNormalDevelopMode(value: unknown): RoadmapDevelopMode | null {
  const snapshot = firstNonBlank(value)
  if (!snapshot) return null
  return snapshot
}

function normalizeBrand(value: unknown): RoadmapBrand | null {
  return ROADMAP_BRANDS.has(value as RoadmapBrand) ? value as RoadmapBrand : null
}

function normalizeRam(explicitRam: unknown, legacyMemory: unknown): RoadmapRam | null {
  if (explicitRam !== undefined && explicitRam !== null && explicitRam !== '') {
    return firstNonBlank(explicitRam) || null
  }
  const legacySnapshot = firstNonBlank(legacyMemory)
  const legacyRam = legacySnapshot.match(/^([^+]+)(?:\+|$)/)?.[1]?.trim()
  return legacyRam || null
}

function normalizeVersionType(value: unknown): RoadmapVersionType | null {
  return firstNonBlank(value) || null
}

function normalizeAndroidVersion(explicitVersion: unknown, legacyVersion: unknown): RoadmapAndroidVersion | null {
  if (typeof explicitVersion === 'string' && explicitVersion.trim()) {
    const value = explicitVersion.trim() as RoadmapAndroidVersion
    return ROADMAP_ANDROID_VERSIONS.has(value) ? value : null
  }
  if (typeof legacyVersion === 'string' && legacyVersion.trim()) {
    const value = legacyVersion.trim() as RoadmapAndroidVersion
    return ROADMAP_ANDROID_VERSIONS.has(value) ? value : null
  }
  return null
}

function findTosVersionId(candidate: unknown, versions: readonly TosVersionConfig[]): string | null {
  if (typeof candidate !== 'string' || !candidate.trim()) return null
  const trimmed = candidate.trim()
  const normalized = normalizeRoadmapTosReference(trimmed, versions)
  return normalized || null
}

function resolveTosVersionId(
  project: ProjectItem,
  productType: RoadmapProductType,
  versions: readonly TosVersionConfig[],
): string | null {
  const infoKey = productType === '新品' ? 'firstSaleTosVersion' : 'currentTosVersion'
  if (project.fieldValues && Object.prototype.hasOwnProperty.call(project.fieldValues, infoKey)) {
    return findTosVersionId(project.fieldValues[infoKey], versions)
  }
  const preferredCandidates = productType === '新品'
    ? project.firstSaleTosVersionId ?? project.firstSaleTosVersion
    : project.currentTosVersionId ?? project.currentTosVersion
  if (typeof preferredCandidates === 'string') return findTosVersionId(preferredCandidates, versions)

  for (const candidate of [project.tosVersionName, project.tosVersion]) {
    const resolved = findTosVersionId(candidate, versions)
    if (resolved) return resolved
  }
  return null
}

function compareRows(left: RoadmapProjectRow, right: RoadmapProjectRow): number {
  return left.displayName.localeCompare(right.displayName, 'zh-CN') || left.id.localeCompare(right.id, 'zh-CN')
}

function uniqueRowsBySourceAndId(
  rows: readonly RoadmapProjectRow[],
  source: RoadmapSource,
): RoadmapProjectRow[] {
  const seen = new Set<string>()
  return rows.filter(row => {
    if (row.source !== source) return false
    const identity = `${source}:${row.id}`
    if (seen.has(identity)) return false
    seen.add(identity)
    return true
  })
}

export function adaptNormalProject(
  project: ProjectItem,
  versions: TosVersionConfig[],
  options: { includeHidden?: boolean; includeIncomplete?: boolean } = {},
): RoadmapProjectRow | null {
  if (!isFormalProject(project) || !isMachineProjectType(project.type)
    || (!options.includeHidden && !isVisibleRoadmapStatus(project.status))) return null

  const projectCode = firstNonBlank(project.projectCode, project.model, project.name)
  const androidVersion = normalizeAndroidVersion(infoString(project, 'androidVersion', project.androidVersion), project.operatingSystem)
  const productType = normalizeNormalProductType(infoString(project, 'productType', project.productType))
  const firstSaleTosVersionId = productType ? resolveTosVersionId(project, productType, versions) : null
  const brand = normalizeBrand(infoString(project, 'brand', project.brand))
  const startRam = normalizeRam(project.startRam, project.memory)
  const versionType = normalizeVersionType(project.versionType)
  const developMode = normalizeNormalDevelopMode(project.developMode)
  const machineProjectType = firstNonBlank(project.secondaryCategory)
    ? normalizeMachineSecondaryCategory(project.secondaryCategory)
    : ''
  if (!options.includeIncomplete && (
    !machineProjectType
    || !MACHINE_PROJECT_TYPES.includes(machineProjectType as MachineProjectType)
    || !projectCode
    || !androidVersion
    || !productType
    || !firstSaleTosVersionId
  )) {
    return null
  }
  const remark = typeof project.remark !== 'string'
    ? firstNonBlank(project.projectDescription)
    : project.remark.trim()

  return {
    id: project.id,
    source: 'normal',
    status: project.status,
    readOnly: true,
    machineProjectType: machineProjectType as MachineProjectType,
    projectCode,
    displayName: buildRoadmapDisplayName(projectCode, (androidVersion || '') as RoadmapAndroidVersion, (productType || '') as RoadmapProductType),
    androidVersion: (androidVersion || '') as RoadmapAndroidVersion,
    firstSaleTosVersionId: firstSaleTosVersionId || '',
    brand: (brand || '') as RoadmapBrand,
    productLine: infoString(project, 'productLine', project.productLine),
    productSeries: infoString(project, 'productSeries', project.productSeries),
    marketName: infoString(project, 'marketName', project.marketName),
    productType: (productType || '') as RoadmapProductType,
    chipCode: resolveNormalProjectChipCode(project),
    startRam: startRam || '',
    versionType: versionType || '',
    str5Date: infoString(project, 'str5Date', project.str5Date),
    str5Estimated: false,
    launchDate: infoString(project, 'launchDate', project.launchDate),
    launchEstimated: false,
    developMode: developMode || '',
    remark,
  }
}

export function adaptPlannedProject(project: PlannedRoadmapProject): RoadmapProjectRow {
  const projectCode = project.projectCode.trim()
  return {
    ...project,
    firstSaleTosVersionId: normalizeRoadmapTosReference(project.firstSaleTosVersionId),
    projectCode,
    displayName: buildRoadmapDisplayName(projectCode, project.androidVersion, project.productType),
    source: 'planned',
    status: '待规划',
    readOnly: false,
  }
}


/** Partial canonical records remain visible; blank fields are genuine missing data. */
export function projectRegistryToPlanned(project: ProjectItem): PlannedRoadmapProject {
  return {
    id: project.id, status: '待规划', displayName: project.name,
    machineProjectType: (project.secondaryCategory || '') as PlannedRoadmapProject['machineProjectType'],
    projectCode: project.projectCode || '', androidVersion: infoString(project, 'androidVersion', project.androidVersion) as PlannedRoadmapProject['androidVersion'],
    firstSaleTosVersionId: normalizeRoadmapTosReference(infoString(project, 'firstSaleTosVersion', project.firstSaleTosVersionId, project.firstSaleTosVersion)),
    brand: infoString(project, 'brand', project.brand) as PlannedRoadmapProject['brand'], productLine: infoString(project, 'productLine', project.productLine),
    productSeries: infoString(project, 'productSeries', project.productSeries), marketName: infoString(project, 'marketName', project.marketName),
    productType: infoString(project, 'productType', project.productType) as PlannedRoadmapProject['productType'],
    chipCode: formatPrimaryChipCode(project.fieldValues?.chipCode), startRam: project.startRam || '',
    versionType: infoString(project, 'versionType', project.versionType), str5Date: infoString(project, 'str5Date', project.str5Date), launchDate: infoString(project, 'launchDate', project.launchDate),
    str5Estimated: project.str5Estimated ?? false, launchEstimated: project.launchEstimated ?? false,
    developMode: infoString(project, 'developmentMode', project.developMode), remark: infoString(project, 'remark', project.remark),
    createdAt: project.createdAt || '', createdBy: project.createdBy || '', updatedAt: project.updatedAt || '',
    updatedBy: project.createdBy || '',
  }
}

export function adaptRegistryRoadmapProject(
  project: ProjectItem,
  options: { includeHidden?: boolean; includeIncomplete?: boolean } = {},
): RoadmapProjectRow | null {
  if (getProjectAttribute(project) !== 'roadmap'
    || (!options.includeHidden && !isVisibleRoadmapStatus(project.status))) return null
  const row = projectRegistryToPlanned(project)
  if (!options.includeIncomplete && (!MACHINE_PROJECT_TYPES.includes(row.machineProjectType)
    || !ROADMAP_ANDROID_VERSIONS.has(row.androidVersion)
    || (row.productType !== '新品' && row.productType !== '老品')
    || !row.firstSaleTosVersionId)) return null
  return { ...row, status: project.status, source: 'planned', readOnly: true }
}

export function mergeRoadmapProjects(
  projects: ProjectItem[],
  plannedProjects: PlannedRoadmapProject[],
  versions: TosVersionConfig[],
): RoadmapProjectRow[] {
  return [
    ...projects.flatMap(project => {
      const row = adaptNormalProject(project, versions)
      return row ? [row] : []
    }),
    ...projects.flatMap(project => { const row = adaptRegistryRoadmapProject(project); return row ? [row] : [] }),
  ]
}

export function findRoadmapHistoryMatches(
  rows: RoadmapProjectRow[],
  projectCode: string,
  excludedId?: string,
): RoadmapProjectRow[] {
  const normalizedCode = projectCode.trim().toUpperCase()
  if (!normalizedCode) return []
  return rows.filter(row => (
    !(row.source === 'planned' && row.id === excludedId)
    && row.projectCode.trim().toUpperCase() === normalizedCode
  ))
}

export function deriveRoadmapPlanningConflicts(
  normalRows: RoadmapProjectRow[],
  plannedRows: RoadmapProjectRow[],
): RoadmapPlanningConflictGroup[] {
  const normalByKey = new Map<string, RoadmapProjectRow[]>()
  const plannedByKey = new Map<string, RoadmapProjectRow[]>()

  for (const row of uniqueRowsBySourceAndId(normalRows, 'normal')) {
    const key = buildRoadmapDuplicateKey(row.projectCode, row.androidVersion, row.productType)
    normalByKey.set(key, [...(normalByKey.get(key) ?? []), row])
  }
  for (const row of uniqueRowsBySourceAndId(plannedRows, 'planned')) {
    if (!row.projectCode || !row.androidVersion || !row.productType) continue
    const key = buildRoadmapDuplicateKey(row.projectCode, row.androidVersion, row.productType)
    plannedByKey.set(key, [...(plannedByKey.get(key) ?? []), row])
  }

  return [...plannedByKey.entries()]
    .flatMap(([key, plannedProjects]) => {
      const normalProjects = normalByKey.get(key)
      return normalProjects?.length
        ? [{
            key,
            normalProjects: [...normalProjects].sort(compareRows),
            plannedProjects: [...plannedProjects].sort(compareRows),
          }]
        : []
    })
    .sort((left, right) => (
      compareRows(left.plannedProjects[0], right.plannedProjects[0]) || left.key.localeCompare(right.key, 'zh-CN')
    ))
}

export function countConflictingPlannedProjects(groups: RoadmapPlanningConflictGroup[]): number {
  return new Set(groups.flatMap(group => group.plannedProjects.map(project => `planned:${project.id}`))).size
}
