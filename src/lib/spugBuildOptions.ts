export interface SpugBuildOptions {
  buildOptions: string[]
  buildMarkets: string[]
}

export interface SpugBuildOptionsProvider {
  load: () => Promise<SpugBuildOptions>
}

export interface SpugBuildOptionsLoadHandlers {
  isActive: () => boolean
  onSuccess: (options: SpugBuildOptions) => void
  onError: () => void
  onSettled: () => void
}

export type MarketBuildSelectionRow = {
  market: string
  buildOption?: string
  buildMarket?: string
}

export type MarketBuildSelectionIssue = {
  field: 'buildOption' | 'buildMarket'
  reason: 'required' | 'unsupported'
  market: string
  value: string
}

export const MOCK_SPUG_BUILD_OPTIONS = ['ko2_sl303', 'ko2', 'a681l_sm386', 'lj8k_h781', 'lj8_h781', 'lj7_h782', 'x1103b']

export const MOCK_SPUG_BUILD_MARKETS = ['op', 'tr']

export const mockSpugBuildOptionsProvider: SpugBuildOptionsProvider = {
  async load() {
    return {
      buildOptions: [...MOCK_SPUG_BUILD_OPTIONS],
      buildMarkets: [...MOCK_SPUG_BUILD_MARKETS],
    }
  },
}

export const loadSpugBuildOptions = async (
  provider: SpugBuildOptionsProvider,
  handlers: SpugBuildOptionsLoadHandlers,
) => {
  try {
    const options = await provider.load()
    if (handlers.isActive()) handlers.onSuccess(options)
  } catch {
    if (handlers.isActive()) handlers.onError()
  } finally {
    if (handlers.isActive()) handlers.onSettled()
  }
}

export const findMarketBuildSelectionIssue = (
  rows: readonly MarketBuildSelectionRow[],
  options: SpugBuildOptions,
): MarketBuildSelectionIssue | undefined => {
  for (const row of rows) {
    const buildOption = row.buildOption ?? ''
    if (!buildOption.trim()) {
      return { field: 'buildOption', reason: 'required', market: row.market, value: buildOption }
    }
    if (!options.buildOptions.includes(buildOption)) {
      return { field: 'buildOption', reason: 'unsupported', market: row.market, value: buildOption }
    }

    const buildMarket = row.buildMarket ?? ''
    if (!buildMarket.trim()) {
      return { field: 'buildMarket', reason: 'required', market: row.market, value: buildMarket }
    }
    if (!options.buildMarkets.includes(buildMarket)) {
      return { field: 'buildMarket', reason: 'unsupported', market: row.market, value: buildMarket }
    }
  }
  return undefined
}

export const formatMarketBuildSelectionIssue = (issue: MarketBuildSelectionIssue): string => {
  if (issue.field === 'buildOption') {
    return issue.reason === 'required'
      ? `请填写 ${issue.market} 市场的编译选项`
      : `${issue.market} 市场的编译选项不在当前 SPUG 枚举中，请重新选择`
  }
  return issue.reason === 'required'
    ? `请填写 ${issue.market} 市场的编译市场`
    : `${issue.market} 市场的编译市场不在当前 SPUG 枚举中，请重新选择`
}
