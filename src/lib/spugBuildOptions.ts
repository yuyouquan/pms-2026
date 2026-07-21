export interface SpugBuildOptions {
  buildOptions: string[]
  buildMarkets: string[]
}

export interface SpugBuildOptionsProvider {
  load: () => Promise<SpugBuildOptions>
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
