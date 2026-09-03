import {
  isMachineProjectType,
  MACHINE_PROJECT_TYPES,
  normalizeMachineSecondaryCategory,
  resolveProjectClassification,
  type MachineProjectType,
} from '@/constants/projectTypes'
import {
  buildRoadmapDisplayName,
  buildRoadmapDuplicateKey,
  normalizeLegacyRoadmapProductType,
  normalizeRoadmapTosReference,
} from '@/lib/roadmapValidation'
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

const ROADMAP_BRANDS = new Set<RoadmapBrand>(['TECNO', 'Infinix', 'itel', '待定', '其他品牌'])
const ROADMAP_ANDROID_VERSIONS = new Set<RoadmapAndroidVersion>(['Android 16', 'Android 17', 'Android 18'])

function firstNonBlank(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (trimmed) return trimmed
  }
  return ''
}

function getNormalProjectChipCode(project: ProjectItem): string {
  const directChipCode = (project as ProjectItem & { chipCode?: string }).chipCode
  return firstNonBlank(project.fieldValues?.chipCode, directChipCode, project.platform, project.cpu)
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
  const preferredCandidates = productType === '新品'
    ? [project.firstSaleTosVersionId, project.firstSaleTosVersion]
    : [project.currentTosVersionId, project.currentTosVersion]
  const explicitCandidate = preferredCandidates.find(candidate => (
    typeof candidate === 'string' && candidate.trim()
  ))
  if (explicitCandidate) return findTosVersionId(explicitCandidate, versions)

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
): RoadmapProjectRow | null {
  if (!isMachineProjectType(project.type)) return null

  const projectCode = firstNonBlank(project.projectCode, project.model)
  const androidVersion = normalizeAndroidVersion(project.androidVersion, project.operatingSystem)
  const productType = normalizeNormalProductType(project.productType)
  const firstSaleTosVersionId = productType ? resolveTosVersionId(project, productType, versions) : null
  const brand = normalizeBrand(project.brand)
  const startRam = normalizeRam(project.startRam, project.memory)
  const versionType = normalizeVersionType(project.versionType)
  const developMode = normalizeNormalDevelopMode(project.developMode)
  const machineProjectType = firstNonBlank(project.secondaryCategory)
    ? normalizeMachineSecondaryCategory(project.secondaryCategory)
    : resolveProjectClassification(project.type).secondaryCategory
  if (
    !machineProjectType
    || !MACHINE_PROJECT_TYPES.includes(machineProjectType as MachineProjectType)
    || !projectCode
    || !androidVersion
    || !productType
    || !firstSaleTosVersionId
    || !brand
    || !startRam
    || !versionType
    || !developMode
  ) {
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
    displayName: buildRoadmapDisplayName(projectCode, androidVersion, productType),
    androidVersion,
    firstSaleTosVersionId,
    brand,
    productLine: firstNonBlank(project.productLine),
    productSeries: firstNonBlank(project.productSeries),
    marketName: firstNonBlank(project.marketName),
    productType,
    chipCode: getNormalProjectChipCode(project),
    startRam,
    versionType,
    str5Date: firstNonBlank(project.str5Date),
    str5Estimated: false,
    launchDate: firstNonBlank(project.launchDate),
    launchEstimated: false,
    developMode,
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
    ...plannedProjects.map(adaptPlannedProject),
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
