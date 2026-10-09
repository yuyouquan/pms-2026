export type CockpitProjectLens = 'all' | 'budget' | 'actual'

const PROJECT_COLUMNS = {
  budget: ['name', 'budget', 'estimate', 'deviation', 'annual'],
  actual: ['name', 'actual', 'cumulative', 'toDate', 'budget', 'annualExecution'],
} as const

/** A reading projection only: preserve each column's existing value and render bindings. */
export function cockpitProjectColumns<T extends { key: string }>(columns: T[], lens: CockpitProjectLens): T[] {
  if (lens === 'all') return columns
  return PROJECT_COLUMNS[lens].flatMap(key => {
    const column = columns.find(item => item.key === key)
    return column ? [column] : []
  })
}
