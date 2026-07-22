import { isMachineProjectType } from '@/constants/projectTypes'
import {
  buildRoadmapDisplayName,
  buildRoadmapDuplicateKey,
  normalizeLegacyRoadmapProductType,
  normalizeTosVersionName,
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
const ROADMAP_RAMS = new Set<RoadmapRam>(['2GB', '3GB', '4GB', '6GB', '8GB', '12GB', '16GB'])
const ROADMAP_VERSION_TYPES = new Set<RoadmapVersionType>(['Full', 'Slim', 'Go'])
const ROADMAP_DEVELOP_MODES = new Set<RoadmapDevelopMode>(['自研', 'ODC', 'ITD-ODC', 'ODM', '纯外研'])

function firstNonBlank(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (trimmed) return trimmed
  }
  return ''
}

function normalizeNormalProductType(value: unknown): RoadmapProductType {
  if (value === '切换') return '老品'
  return normalizeLegacyRoadmapProductType(value) ?? '新品'
}

function normalizeNormalDevelopMode(value: unknown): RoadmapDevelopMode {
  if (value === '外研') return '纯外研'
  if (value === '联合开发') return 'ITD-ODC'
  return ROADMAP_DEVELOP_MODES.has(value as RoadmapDevelopMode) ? value as RoadmapDevelopMode : '自研'
}

function normalizeBrand(value: unknown): RoadmapBrand {
  return ROADMAP_BRANDS.has(value as RoadmapBrand) ? value as RoadmapBrand : '其他品牌'
}

function normalizeRam(explicitRam: unknown, legacyMemory: unknown): RoadmapRam {
  if (ROADMAP_RAMS.has(explicitRam as RoadmapRam)) return explicitRam as RoadmapRam
  const match = typeof legacyMemory === 'string' ? legacyMemory.trim().match(/^(\d+GB)(?:\+|$)/) : null
  return match && ROADMAP_RAMS.has(match[1] as RoadmapRam) ? match[1] as RoadmapRam : '2GB'
}

function normalizeVersionType(value: unknown): RoadmapVersionType {
  return ROADMAP_VERSION_TYPES.has(value as RoadmapVersionType) ? value as RoadmapVersionType : 'Full'
}

function resolveTosVersionId(project: ProjectItem, versions: readonly TosVersionConfig[]): string {
  const candidates = [project.firstSaleTosVersionId, project.tosVersionName, project.tosVersion]
  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || !candidate.trim()) continue
    const trimmed = candidate.trim()
    const byId = versions.find(version => version.id === trimmed)
    if (byId) return byId.id
    const normalized = normalizeTosVersionName(trimmed)
    if (!normalized) continue
    const byVersion = versions.find(version => (
      version.major === normalized.major && version.minor === normalized.minor
    ))
    if (byVersion) return byVersion.id
  }
  return ''
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

  const projectCode = firstNonBlank(project.projectCode, project.model, project.name)
  const androidVersion = firstNonBlank(project.androidVersion, project.operatingSystem) as RoadmapAndroidVersion
  const productType = normalizeNormalProductType(project.productType)
  const remark = project.remark === undefined
    ? firstNonBlank(project.projectDescription)
    : project.remark.trim()

  return {
    id: project.id,
    source: 'normal',
    status: project.status,
    readOnly: true,
    machineProjectType: project.type,
    projectCode,
    displayName: firstNonBlank(project.name, buildRoadmapDisplayName(projectCode, androidVersion, productType)),
    androidVersion,
    firstSaleTosVersionId: resolveTosVersionId(project, versions),
    brand: normalizeBrand(project.brand),
    productLine: firstNonBlank(project.productLine),
    productSeries: firstNonBlank(project.productSeries),
    marketName: firstNonBlank(project.marketName),
    productType,
    platform: firstNonBlank(project.platform, project.cpu, project.chipPlatform),
    startRam: normalizeRam(project.startRam, project.memory),
    versionType: normalizeVersionType(project.versionType),
    str5Date: firstNonBlank(project.str5Date),
    launchDate: firstNonBlank(project.launchDate),
    developMode: normalizeNormalDevelopMode(project.developMode),
    remark,
  }
}

export function adaptPlannedProject(project: PlannedRoadmapProject): RoadmapProjectRow {
  const projectCode = project.projectCode.trim()
  return {
    ...project,
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
