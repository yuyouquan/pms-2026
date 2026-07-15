export const TOS_TYPE_OPTIONS = ['Full', 'Slim', 'PAD', 'GO'] as const

export type TosPlanType = typeof TOS_TYPE_OPTIONS[number]

export type TosTypeConfigRow = {
  id: string
  type: TosPlanType
  isMain: boolean
}

export type TosTypePlanEntry = {
  level1Tasks: any[]
  level2PlanTasks: any[]
  level2PlanMilestones: string[]
  createdLevel2Plans: any[]
  activeLevel2Plan: string
  level2PlanMeta: Record<string, any>
  versionTrainRecords: any[]
}

export type TosTypePlanData = Record<string, Record<string, TosTypePlanEntry>>

export type TosTypePlanVersion = {
  id: string
  versionNo: string
  status: string
}

export type TosTypeVersionsState = Record<string, TosTypePlanVersion[]>
export type TosTypeCurrentVersionState = Record<string, string>

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

const versionParts = (versionNo: string) => (
  String(versionNo || '')
    .replace(/^V/i, '')
    .split('.')
    .map(part => Number.parseInt(part, 10) || 0)
)

const compareVersionNo = (left: string, right: string) => {
  const leftParts = versionParts(left)
  const rightParts = versionParts(right)
  const length = Math.max(leftParts.length, rightParts.length)
  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0)
    if (difference !== 0) return difference
  }
  return 0
}

export const isValidTosType = (value: string): value is TosPlanType => (
  TOS_TYPE_OPTIONS.includes(value as TosPlanType)
)

export const normalizeTosTypeRows = (
  rows: Array<{ id: string; type: string; isMain: boolean }>,
): TosTypeConfigRow[] => {
  const seen = new Set<string>()
  const filtered: TosTypeConfigRow[] = []

  rows.forEach(row => {
    if (!isValidTosType(row.type) || seen.has(row.type)) return
    seen.add(row.type)
    filtered.push({ id: row.id, type: row.type, isMain: row.isMain })
  })

  if (filtered.length === 0) return []
  const mainType = filtered.find(row => row.isMain)?.type || filtered[0].type
  return filtered.map(row => ({ ...row, isMain: row.type === mainType }))
}

export const buildTosTypeRows = (
  versionTypes: string[] = [],
  versionType = '',
  existingRows: TosTypeConfigRow[] = [],
) => {
  if (existingRows.length > 0) return normalizeTosTypeRows(existingRows)

  const sourceTypes = versionTypes.filter(isValidTosType)
  const fallbackType: TosPlanType = isValidTosType(versionType) ? versionType : 'Full'
  const types = sourceTypes.length > 0 ? sourceTypes : [fallbackType]
  return normalizeTosTypeRows(types.map((type, index) => ({
    id: `tos-type-${type}`,
    type,
    isMain: index === 0,
  })))
}

export const getMainTosType = (rows: TosTypeConfigRow[]) => (
  normalizeTosTypeRows(rows).find(row => row.isMain)?.type || ''
)

export const createTosTypePlanEntry = (seed: TosTypePlanEntry): TosTypePlanEntry => clone(seed)

export const ensureTosTypePlanDataForRows = (
  data: TosTypePlanData,
  projectId: string,
  rows: TosTypeConfigRow[],
  seed: TosTypePlanEntry,
): TosTypePlanData => {
  const projectData = { ...(data[projectId] || {}) }
  normalizeTosTypeRows(rows).forEach(row => {
    if (!projectData[row.type]) projectData[row.type] = createTosTypePlanEntry(seed)
  })
  return { ...data, [projectId]: projectData }
}

export const getTosTypeVersionKey = (
  projectId: string,
  type: string,
  planLevel: string,
) => `project::${projectId}::tos-type::${type}::${planLevel}::versions`

export const getTosTypeSnapshotKey = (
  projectId: string,
  type: string,
  planLevel: string,
  versionId: string,
) => `project::${projectId}::tos-type::${type}::${planLevel}::${versionId}::snapshot`

export const getTosTypeVersions = (
  state: TosTypeVersionsState,
  projectId: string,
  type: string,
  planLevel: string,
  fallback: TosTypePlanVersion[],
) => clone(state[getTosTypeVersionKey(projectId, type, planLevel)] || fallback)

export const setTosTypeVersions = (
  state: TosTypeVersionsState,
  projectId: string,
  type: string,
  planLevel: string,
  fallback: TosTypePlanVersion[],
  next: TosTypePlanVersion[] | ((previous: TosTypePlanVersion[]) => TosTypePlanVersion[]),
): TosTypeVersionsState => {
  const key = getTosTypeVersionKey(projectId, type, planLevel)
  const previous = getTosTypeVersions(state, projectId, type, planLevel, fallback)
  return { ...state, [key]: clone(typeof next === 'function' ? next(previous) : next) }
}

export const getTosTypeCurrentVersion = (
  state: TosTypeCurrentVersionState,
  projectId: string,
  type: string,
  planLevel: string,
  versions: TosTypePlanVersion[],
  fallback: string,
) => {
  const selected = state[getTosTypeVersionKey(projectId, type, planLevel)] || fallback
  if (versions.some(version => version.id === selected)) return selected
  const latestPublished = versions
    .filter(version => version.status === '已发布')
    .sort((left, right) => compareVersionNo(right.versionNo, left.versionNo))[0]
  return latestPublished?.id || versions[0]?.id || fallback
}

export const setTosTypeCurrentVersion = (
  state: TosTypeCurrentVersionState,
  projectId: string,
  type: string,
  planLevel: string,
  versionId: string,
): TosTypeCurrentVersionState => ({
  ...state,
  [getTosTypeVersionKey(projectId, type, planLevel)]: versionId,
})
