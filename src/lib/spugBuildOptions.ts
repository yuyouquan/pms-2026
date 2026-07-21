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

export type SpugMarketBuildSelectionIssue = {
  field: 'buildOption' | 'buildMarket'
  reason: 'required' | 'unsupported'
  market: string
  value: string
}

export interface SpugMarketBuildValidationResult {
  firstRequiredIssue?: SpugMarketBuildSelectionIssue
  unsupportedIssues: SpugMarketBuildSelectionIssue[]
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

export const validateMarketBuildSelections = (
  rows: readonly MarketBuildSelectionRow[],
  options: SpugBuildOptions,
): SpugMarketBuildValidationResult => {
  const firstMissingBuildOptionRow = rows.find(row => !row.buildOption?.trim())
  const firstMissingBuildMarketRow = firstMissingBuildOptionRow
    ? undefined
    : rows.find(row => !row.buildMarket?.trim())
  const firstRequiredIssue: SpugMarketBuildSelectionIssue | undefined = firstMissingBuildOptionRow
    ? {
        field: 'buildOption',
        reason: 'required',
        market: firstMissingBuildOptionRow.market,
        value: firstMissingBuildOptionRow.buildOption ?? '',
      }
    : firstMissingBuildMarketRow
      ? {
          field: 'buildMarket',
          reason: 'required',
          market: firstMissingBuildMarketRow.market,
          value: firstMissingBuildMarketRow.buildMarket ?? '',
        }
      : undefined

  const unsupportedIssues: SpugMarketBuildSelectionIssue[] = []
  for (const row of rows) {
    const buildOption = row.buildOption ?? ''
    if (buildOption.trim() && !options.buildOptions.includes(buildOption)) {
      unsupportedIssues.push({
        field: 'buildOption',
        reason: 'unsupported',
        market: row.market,
        value: buildOption,
      })
    }

    const buildMarket = row.buildMarket ?? ''
    if (buildMarket.trim() && !options.buildMarkets.includes(buildMarket)) {
      unsupportedIssues.push({
        field: 'buildMarket',
        reason: 'unsupported',
        market: row.market,
        value: buildMarket,
      })
    }
  }
  return { firstRequiredIssue, unsupportedIssues }
}

export const formatMarketBuildSelectionIssue = (issue: SpugMarketBuildSelectionIssue): string => {
  if (issue.field === 'buildOption') {
    return issue.reason === 'required'
      ? `请填写 ${issue.market} 市场的编译选项`
      : `${issue.market} 市场的编译选项不在当前 SPUG 枚举中，请重新选择`
  }
  return issue.reason === 'required'
    ? `请填写 ${issue.market} 市场的编译市场`
    : `${issue.market} 市场的编译市场不在当前 SPUG 枚举中，请重新选择`
}
