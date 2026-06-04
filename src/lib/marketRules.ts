export const MARKET_OPTIONS = ['OP', 'RU', 'TR', 'OPPJ', 'COCL', 'IN', 'EU']

export type MarketConfigRow = {
  id: string
  market: string
  isMain: boolean
  followsMain: boolean
}

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

export type MarketPlanEntry = {
  tasks: any[]
  level2Tasks: any[]
  createdLevel2Plans: any[]
}

export type MarketPlanDataLike = Record<string, MarketPlanEntry>

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

export const isValidMarket = (market: string) => MARKET_OPTIONS.includes(market)

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
): MarketConfigRow[] => {
  const sourceRows = existingRows?.length
    ? existingRows
    : markets.map((market, index) => ({
        id: `market-${market}`,
        market,
        isMain: index === 0,
        followsMain: false,
      }))

  return normalizeMarketRows(sourceRows)
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
  if (planLevel !== 'level1') return true
  return !isFollowMarket(rows, market)
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
      tasks: clone(mainMarketData.tasks || []),
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
