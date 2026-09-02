export const TOS_TYPE_OPTIONS = ['Full', 'Slim', 'PAD', 'GO'] as const

export type TosPlanType = typeof TOS_TYPE_OPTIONS[number]

export type TosTypeConfigRow = {
  id: string
  type: TosPlanType
  isMain: boolean
  followsMain: boolean
}

export type TosTypeSummaryGroup = {
  key: TosPlanType
  label: string
  sourceType: TosPlanType
  memberTypes: TosPlanType[]
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
  publishedAt?: string
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
  rows: Array<{ id: string; type: string; isMain: boolean; followsMain?: boolean }>,
  previousMainType?: string,
): TosTypeConfigRow[] => {
  const seen = new Set<string>()
  const filtered: TosTypeConfigRow[] = []

  rows.forEach(row => {
    if (!isValidTosType(row.type) || seen.has(row.type)) return
    seen.add(row.type)
    filtered.push({ id: row.id, type: row.type, isMain: row.isMain, followsMain: !!row.followsMain })
  })

  if (filtered.length === 0) return []
  const mainType = filtered.find(row => row.isMain)?.type || filtered[0].type
  const mainChanged = !!previousMainType && previousMainType !== mainType
  return filtered.map(row => ({
    ...row,
    isMain: row.type === mainType,
    followsMain: !mainChanged && row.type !== mainType && row.followsMain,
  }))
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
  const mainType = sourceTypes.includes(fallbackType) ? fallbackType : types[0]
  return normalizeTosTypeRows(types.map((type, index) => ({
    id: `tos-type-${type}`,
    type,
    isMain: type === mainType,
    followsMain: false,
  })))
}

export const getMainTosType = (rows: TosTypeConfigRow[]) => (
  normalizeTosTypeRows(rows).find(row => row.isMain)?.type || ''
)

export const getAvailableTosTypes = (rows: TosTypeConfigRow[]): TosPlanType[] => {
  const configuredTypes = new Set(rows.map(row => row.type))
  return TOS_TYPE_OPTIONS.filter(type => !configuredTypes.has(type))
}

export const updateTosTypeDraftRows = (
  rows: TosTypeConfigRow[],
  rowId: string,
  patch: Partial<TosTypeConfigRow>,
): TosTypeConfigRow[] => {
  const normalizedRows = normalizeTosTypeRows(rows)
  const previousMainType = getMainTosType(normalizedRows)
  const nextRows = normalizedRows.map(row => ({ ...row }))
  const targetRow = nextRows.find(row => row.id === rowId)
  if (!targetRow) return normalizedRows

  if (patch.followsMain !== undefined && !targetRow.isMain) {
    targetRow.followsMain = patch.followsMain
  }
  if (patch.isMain) {
    nextRows.forEach(row => {
      row.isMain = row.id === rowId
    })
    targetRow.followsMain = false
  }

  return normalizeTosTypeRows(nextRows, previousMainType)
}

export const addTosTypeDraftRow = (
  rows: TosTypeConfigRow[],
  type: string,
  id: string,
): TosTypeConfigRow[] => {
  const normalizedRows = normalizeTosTypeRows(rows)
  if (!isValidTosType(type) || normalizedRows.some(row => row.type === type)) return normalizedRows
  const previousMainType = getMainTosType(normalizedRows)
  return normalizeTosTypeRows([
    ...normalizedRows,
    {
      id,
      type,
      isMain: normalizedRows.length === 0,
      followsMain: false,
    },
  ], previousMainType)
}

export const removeTosTypeDraftRow = (
  rows: TosTypeConfigRow[],
  rowId: string,
): TosTypeConfigRow[] => {
  const normalizedRows = normalizeTosTypeRows(rows)
  if (normalizedRows.length <= 1) return normalizedRows
  const targetRow = normalizedRows.find(row => row.id === rowId)
  if (!targetRow || targetRow.isMain) return normalizedRows
  const previousMainType = getMainTosType(normalizedRows)
  return normalizeTosTypeRows(
    normalizedRows.filter(row => row.id !== rowId),
    previousMainType,
  )
}

export const isFollowTosType = (rows: TosTypeConfigRow[], type: string) => (
  normalizeTosTypeRows(rows).some(row => row.type === type && !row.isMain && row.followsMain)
)

export const deriveDetachedTosTypes = (
  previousRows: TosTypeConfigRow[],
  nextRows: TosTypeConfigRow[],
  previousMainType = getMainTosType(previousRows),
): TosPlanType[] => {
  const previousFollowTypes = new Set(
    normalizeTosTypeRows(previousRows)
      .filter(row => row.followsMain)
      .map(row => row.type),
  )
  const nextFollowTypes = new Set(
    normalizeTosTypeRows(nextRows, previousMainType)
      .filter(row => row.followsMain)
      .map(row => row.type),
  )
  return [...previousFollowTypes].filter(type => !nextFollowTypes.has(type))
}

export type TosTypeDetachTransition = {
  type: TosPlanType
  previousRow: TosTypeConfigRow
  nextRow: TosTypeConfigRow
}

export const planDetachedTosTypeTransitions = (
  previousRows: TosTypeConfigRow[],
  nextRows: TosTypeConfigRow[],
): TosTypeDetachTransition[] => {
  const normalizedPreviousRows = normalizeTosTypeRows(previousRows)
  const previousMainType = getMainTosType(normalizedPreviousRows)
  const normalizedNextRows = normalizeTosTypeRows(nextRows, previousMainType)
  return deriveDetachedTosTypes(normalizedPreviousRows, normalizedNextRows, previousMainType).flatMap(type => {
    const previousRow = normalizedPreviousRows.find(row => row.type === type)
    if (!previousRow) return []
    return [{
      type,
      previousRow,
      nextRow: normalizedNextRows.find(row => row.type === type) || {
        id: `tos-type-detached-${type}`,
        type,
        isMain: false,
        followsMain: false,
      },
    }]
  })
}

export const getTosTypePlanSourceType = (
  rows: TosTypeConfigRow[],
  type: string,
  planLevel: string,
) => {
  const normalizedRows = normalizeTosTypeRows(rows)
  const mainType = getMainTosType(normalizedRows)
  const row = normalizedRows.find(item => item.type === type)
  if (!row) return mainType
  return planLevel === 'level1' && isFollowTosType(normalizedRows, type) ? mainType : row.type
}

export const isTosTypeLevel1ReadOnly = (
  rows: TosTypeConfigRow[],
  type: string,
  planLevel: string,
) => planLevel === 'level1' && isFollowTosType(rows, type)

export const getTosTypeSummaryGroups = (rows: TosTypeConfigRow[]): TosTypeSummaryGroup[] => {
  const normalizedRows = normalizeTosTypeRows(rows)
  const main = normalizedRows.find(row => row.isMain)
  if (!main) return []

  const mainMemberTypes = normalizedRows
    .filter(row => row.isMain || row.followsMain)
    .map(row => row.type)
  const mainGroup: TosTypeSummaryGroup = {
    key: main.type,
    label: mainMemberTypes.join('&'),
    sourceType: main.type,
    memberTypes: mainMemberTypes,
  }
  return normalizedRows.flatMap<TosTypeSummaryGroup>(row => {
    if (row.followsMain) return []
    if (row.isMain) return [mainGroup]
    return [{
      key: row.type,
      label: row.type,
      sourceType: row.type,
      memberTypes: [row.type],
    }]
  })
}

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
