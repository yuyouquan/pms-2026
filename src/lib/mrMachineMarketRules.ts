import { getMainMarket, type MarketConfigRow } from '@/lib/marketRules'
import { compareTosVersionNumbers, normalizeMrBusinessDate } from '@/lib/mrVersionPlanRules'
import type {
  JointMachinePlan,
  MrMachineMarketProjection,
  MrMachineMarketProjectionResult,
  MrMarketOverride,
  TosMrVersionInstance,
} from '@/types/mrVersionPlan'

const NUMERIC_TRANSFER_TYPES = new Set(['1', '2', '3', '4', '5', '6', '7', '8'])

function canonicalDate(value: unknown): string {
  if (typeof value !== 'string') return ''
  const normalized = normalizeMrBusinessDate(value)
  return normalized === value ? normalized : ''
}

export function getMrMarketOverrideKey(projectId: string, tosVersion: string, market: string): string {
  return `${projectId.trim()}::${tosVersion.trim()}::${market.trim()}`
}

export function isEligibleMachineMrPlan(plan: JointMachinePlan): boolean {
  if (!NUMERIC_TRANSFER_TYPES.has(plan.transferType)) return false
  return Object.values(plan.dates).some(value => Boolean(canonicalDate(value)))
}

function orderedMarkets(rows: readonly MarketConfigRow[]): { mainMarket: string; markets: string[] } {
  const configured = rows.map(row => row.market.trim()).filter(Boolean)
  const mainMarket = getMainMarket(rows.map(row => ({ ...row })))
  if (!mainMarket) return { mainMarket: '', markets: configured }
  return { mainMarket, markets: [mainMarket, ...configured.filter(market => market !== mainMarket)] }
}

export function projectMachineMarketMrVersions(input: {
  projectId: string
  plansByKey: Readonly<Record<string, JointMachinePlan>>
  instancesByProjectId: Readonly<Record<string, readonly TosMrVersionInstance[] | undefined>>
  marketRows: readonly MarketConfigRow[]
}): MrMachineMarketProjectionResult {
  const projectId = input.projectId.trim()
  const { mainMarket, markets } = orderedMarkets(input.marketRows)
  const versions: MrMachineMarketProjection[] = []
  const missingInstanceVersions: string[] = []

  Object.values(input.plansByKey)
    .filter(plan => plan.projectId === projectId && isEligibleMachineMrPlan(plan))
    .sort((left, right) => compareTosVersionNumbers(left.tosVersion, right.tosVersion))
    .forEach(plan => {
      const instance = (input.instancesByProjectId[plan.tosProjectId] ?? [])
        .find(candidate => candidate.tosVersion === plan.tosVersion)
      if (!instance) {
        missingInstanceVersions.push(plan.tosVersion)
        return
      }
      versions.push({
        key: `${plan.projectId}::${plan.tosVersion}`,
        projectId: plan.projectId,
        tosProjectId: plan.tosProjectId,
        tosVersion: plan.tosVersion,
        templateVersionId: instance.templateVersionId,
        activities: instance.activities.map(activity => ({ ...activity })),
        plan: { ...plan, dates: { ...plan.dates } },
      })
    })

  return { mainMarket, markets, versions, missingInstanceVersions }
}

export function getMachineMarketDate(input: {
  plan: JointMachinePlan
  overridesByKey: Readonly<Record<string, MrMarketOverride>>
  market: string
  mainMarket: string
  activityId: string
}): string {
  if (input.market === input.mainMarket) return input.plan.dates[input.activityId] ?? ''
  return input.overridesByKey[
    getMrMarketOverrideKey(input.plan.projectId, input.plan.tosVersion, input.market)
  ]?.dates[input.activityId] ?? ''
}
