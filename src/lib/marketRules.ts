export const MARKET_OPTIONS = ['OP', 'RU', 'TR', 'OPPJ', 'COCL', 'IN', 'EU']

export type MarketYesNoValue = '是' | '否'

export type MarketConfigRow = {
  id: string
  market: string
  isMain: boolean
  followsMain: boolean
  googleLaunchDate?: string
  isCarrierCustomized?: MarketYesNoValue
  isSimLocked?: MarketYesNoValue
  isCancelPaused?: MarketYesNoValue
  cancelPauseDate?: string
  isMadaControlled?: MarketYesNoValue
  branchInfo?: string
  jenkinsUrl?: string
  buildAddress?: string
}

export type LegacyMarketBuildConfig = Pick<
  MarketConfigRow,
  'branchInfo' | 'jenkinsUrl' | 'buildAddress'
>

export type PlanVersionLike = {
  id: string
  versionNo: string
  status: string
}

export type FollowVersionSource = {
  sourceMarket: string
  sourceVersionId: string
  sourceVersionNo: string
}

export type FollowVersionMeta = Record<string, FollowVersionSource>
export type MarketVersionsState = Record<string, PlanVersionLike[]>
export type MarketCurrentVersionState = Record<string, string>

export type MarketPlanEntry = {
  tasks: any[]
  level2Tasks: any[]
  createdLevel2Plans: any[]
}

export type MarketPlanDataLike = Record<string, MarketPlanEntry>

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

const getTaskActualDateKey = (task: any) => String(task?.taskName || '').trim()

const buildTaskMapByActualDateKey = (tasks: any[]) => {
  const taskMap = new Map<string, any>()
  ;(tasks || []).forEach(task => {
    const key = getTaskActualDateKey(task)
    if (!key || taskMap.has(key)) return
    taskMap.set(key, task)
  })
  return taskMap
}

const clearActualTimeDetachedFlag = (task: any) => {
  const nextTask = { ...task }
  delete nextTask.actualTimeDetachedFromMain
  return nextTask
}

export const mergeFollowMarketActualDates = (
  mainTasks: any[],
  historicalFollowTasks: any[] = [],
) => {
  const historicalTasks = buildTaskMapByActualDateKey(historicalFollowTasks)
  return clone(mainTasks || []).map((task: any) => {
    const key = getTaskActualDateKey(task)
    const historicalTask = key ? historicalTasks.get(key) : undefined
    if (historicalTask?.actualTimeDetachedFromMain) {
      return {
        ...clearActualTimeDetachedFlag(task),
        actualStartDate: historicalTask.actualStartDate || '',
        actualEndDate: historicalTask.actualEndDate || '',
        actualTimeDetachedFromMain: true,
      }
    }
    return clearActualTimeDetachedFlag({
      ...task,
      actualStartDate: task.actualStartDate || '',
      actualEndDate: task.actualEndDate || '',
    })
  })
}

export const markTaskActualTimeDetachedFromMain = (
  tasks: any[],
  taskId: string,
  patch: { actualStartDate?: string; actualEndDate?: string },
) => {
  return clone(tasks || []).map((task: any) => {
    if (String(task.id) !== String(taskId)) return task
    return {
      ...task,
      ...patch,
      actualTimeDetachedFromMain: true,
    }
  })
}

export const isValidMarket = (market: string) => MARKET_OPTIONS.includes(market)

export const getMarketPlanVersionKey = (
  projectId: string,
  market: string,
) => `project::${projectId}::${market}::level1::versions`

export const getMarketVersions = (
  state: MarketVersionsState,
  projectId: string,
  market: string,
  fallbackVersions: PlanVersionLike[],
) => {
  const key = getMarketPlanVersionKey(projectId, market)
  return clone(state[key] || fallbackVersions || [])
}

export const setMarketVersions = (
  state: MarketVersionsState,
  projectId: string,
  market: string,
  fallbackVersions: PlanVersionLike[],
  versions: PlanVersionLike[] | ((prev: PlanVersionLike[]) => PlanVersionLike[]),
): MarketVersionsState => {
  const key = getMarketPlanVersionKey(projectId, market)
  const prevVersions = getMarketVersions(state, projectId, market, fallbackVersions)
  const nextVersions = typeof versions === 'function' ? versions(prevVersions) : versions
  return {
    ...state,
    [key]: clone(nextVersions || []),
  }
}

export const getMarketCurrentVersion = (
  state: MarketCurrentVersionState,
  projectId: string,
  market: string,
  versions: PlanVersionLike[],
  fallbackCurrentVersion: string,
) => {
  const key = getMarketPlanVersionKey(projectId, market)
  const currentVersion = state[key] || fallbackCurrentVersion
  if (versions.some(version => version.id === currentVersion)) return currentVersion
  const latestPublished = versions
    .filter(version => version.status === '已发布')
    .sort((a, b) => parseInt(b.versionNo.replace('V', ''), 10) - parseInt(a.versionNo.replace('V', ''), 10))[0]
  return latestPublished?.id || versions[0]?.id || currentVersion
}

export const setMarketCurrentVersion = (
  state: MarketCurrentVersionState,
  projectId: string,
  market: string,
  currentVersion: string,
): MarketCurrentVersionState => ({
  ...state,
  [getMarketPlanVersionKey(projectId, market)]: currentVersion,
})

export const getMainMarket = (rows: MarketConfigRow[]) => (
  rows.find(row => row.isMain)?.market || rows[0]?.market || ''
)

export const normalizeMarketRows = (
  rows: MarketConfigRow[],
  previousMainMarket?: string,
): MarketConfigRow[] => {
  const seen = new Set<string>()
  const filtered = rows.filter(row => {
    if (!row.market || !isValidMarket(row.market) || seen.has(row.market)) return false
    seen.add(row.market)
    return true
  })

  if (filtered.length === 0) return []

  const requestedMain = filtered.find(row => row.isMain)?.market || filtered[0].market
  const mainChanged = !!previousMainMarket && previousMainMarket !== requestedMain

  return filtered.map((row, index) => {
    const isMain = row.market === requestedMain || (!requestedMain && index === 0)
    return {
      ...row,
      isMain,
      followsMain: isMain || mainChanged ? false : !!row.followsMain,
    }
  })
}

export const buildMarketRowsFromMarkets = (
  markets: string[],
  existingRows?: MarketConfigRow[],
  legacyBuildConfig?: LegacyMarketBuildConfig,
): MarketConfigRow[] => {
  const sourceRows: MarketConfigRow[] = existingRows?.length
    ? existingRows
    : markets.map((market, index) => ({
        id: `market-${market}`,
        market,
        isMain: index === 0,
        followsMain: false,
        googleLaunchDate: '',
        isCarrierCustomized: undefined,
        isSimLocked: undefined,
        isCancelPaused: undefined,
        cancelPauseDate: '',
        isMadaControlled: undefined,
      }))

  const hydratedRows = legacyBuildConfig
    ? sourceRows.map(row => ({
        ...row,
        branchInfo: row.branchInfo === undefined ? (legacyBuildConfig.branchInfo || '') : row.branchInfo,
        jenkinsUrl: row.jenkinsUrl === undefined ? (legacyBuildConfig.jenkinsUrl || '') : row.jenkinsUrl,
        buildAddress: row.buildAddress === undefined ? (legacyBuildConfig.buildAddress || '') : row.buildAddress,
      }))
    : sourceRows

  return normalizeMarketRows(hydratedRows)
}

export const isFollowMarket = (rows: MarketConfigRow[], market: string) => {
  const row = normalizeMarketRows(rows).find(item => item.market === market)
  return !!row && !row.isMain && row.followsMain
}

export const canCreateRevisionForMarket = (
  rows: MarketConfigRow[],
  market: string,
  planLevel: string,
) => {
  return planLevel !== 'level1' || !isFollowMarket(rows, market)
}

export const canChangeMainMarket = (versions: PlanVersionLike[]) => (
  !versions.some(version => version.status === '修订中')
)

export const cancelDraftRevision = (
  versions: PlanVersionLike[],
  currentVersionId: string,
) => {
  const current = versions.find(version => version.id === currentVersionId)
  if (!current || current.status !== '修订中') {
    return { versions, currentVersion: currentVersionId }
  }

  const nextVersions = versions.map(version => (
    version.id === currentVersionId ? { ...version, status: '已取消' } : version
  ))
  const latestPublished = nextVersions
    .filter(version => version.status === '已发布')
    .sort((a, b) => parseInt(b.versionNo.replace('V', ''), 10) - parseInt(a.versionNo.replace('V', ''), 10))[0]

  return {
    versions: nextVersions,
    currentVersion: latestPublished?.id || currentVersionId,
  }
}

export const syncFollowMarketPlans = (
  marketPlanData: MarketPlanDataLike,
  rows: MarketConfigRow[],
) => {
  const normalizedRows = normalizeMarketRows(rows)
  const mainMarket = getMainMarket(normalizedRows)
  const mainMarketData = marketPlanData[mainMarket]
  if (!mainMarket || !mainMarketData) return marketPlanData

  const nextData: MarketPlanDataLike = { ...marketPlanData }
  normalizedRows.forEach(row => {
    if (!row.market || row.isMain || !row.followsMain) return
    const existing = marketPlanData[row.market] || { level2Tasks: [], createdLevel2Plans: [] }
    nextData[row.market] = {
      ...existing,
      tasks: mergeFollowMarketActualDates(mainMarketData.tasks || [], existing.tasks || []),
      level2Tasks: existing.level2Tasks || [],
      createdLevel2Plans: existing.createdLevel2Plans || [],
    }
  })

  return nextData
}

export const getMarketFollowVersionKey = (
  projectId: string,
  market: string,
  versionId: string,
) => `project::${projectId}::${market}::level1::${versionId}::follow-source`

export const formatFollowVersionSource = (source?: FollowVersionSource) => (
  source ? `跟随 ${source.sourceMarket} ${source.sourceVersionNo}` : ''
)

export const buildFollowVersionMetaForPublish = ({
  projectId,
  rows,
  sourceMarket,
  sourceVersionId,
  sourceVersionNo,
}: {
  projectId: string
  rows: MarketConfigRow[]
  sourceMarket: string
  sourceVersionId: string
  sourceVersionNo: string
}): FollowVersionMeta => {
  const normalizedRows = normalizeMarketRows(rows)
  const mainMarket = getMainMarket(normalizedRows)
  if (!projectId || !mainMarket || sourceMarket !== mainMarket) return {}

  return normalizedRows.reduce<FollowVersionMeta>((acc, row) => {
    if (!row.market || row.isMain || !row.followsMain) return acc
    acc[getMarketFollowVersionKey(projectId, row.market, sourceVersionId)] = {
      sourceMarket,
      sourceVersionId,
      sourceVersionNo,
    }
    return acc
  }, {})
}

export const removeFollowVersionMetaForMarkets = (
  meta: FollowVersionMeta,
  {
    projectId,
    markets,
    versionIds,
  }: {
    projectId: string
    markets: string[]
    versionIds: string[]
  },
): FollowVersionMeta => {
  const nextMeta = { ...meta }
  markets.forEach(market => {
    versionIds.forEach(versionId => {
      delete nextMeta[getMarketFollowVersionKey(projectId, market, versionId)]
    })
  })
  return nextMeta
}

export const ensureMarketPlanDataForRows = (
  marketPlanData: MarketPlanDataLike,
  rows: MarketConfigRow[],
  fallbackTasks: any[],
  fallbackLevel2Plans: any[],
) => {
  const nextData: MarketPlanDataLike = { ...marketPlanData }
  normalizeMarketRows(rows).forEach(row => {
    if (nextData[row.market]) return
    nextData[row.market] = {
      tasks: clone(fallbackTasks),
      level2Tasks: [],
      createdLevel2Plans: clone(fallbackLevel2Plans),
    }
  })
  return nextData
}

export const getProjectMarketSnapshotKey = (
  projectId: string,
  market: string,
  versionId: string,
) => `project::${projectId}::${market}::level1::${versionId}`
