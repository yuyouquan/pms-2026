import { cockpitOverview, cockpitRatios, summarizeCockpit, type AmountKey, type CockpitFact, type CockpitInput, type CockpitMode, type CockpitRow } from '@/components/cockpit/cockpitData'

export type CockpitMetricKey = AmountKey | 'deviation' | 'toDate' | 'annualExecution'
export interface CockpitMetric { key: CockpitMetricKey; label: string; note: string }
export type CockpitSourceFilter = 'all' | 'available' | 'unavailable'
export const cockpitRatioFields = (key: CockpitMetricKey): { key: AmountKey; label: string }[] => key === 'deviation'
  ? [{ key: 'estimate', label: '项目概算' }, { key: 'budget', label: '项目预算' }]
  : key === 'toDate' ? [{ key: 'actual', label: '项目核算' }, { key: 'cumulative', label: '累至今日预估投入' }]
    : key === 'annualExecution' ? [{ key: 'actual', label: '项目核算' }, { key: 'budget', label: '项目预算' }] : []

export function cockpitMetricValue(row: CockpitRow, key: CockpitMetricKey, mode: CockpitMode) {
  return key === 'deviation' || key === 'toDate' || key === 'annualExecution' ? cockpitRatios(row, mode)[key] : row[key]?.[mode]
}

/** Availability describes this window and unit; it is not a judgment about project data quality. */
export function cockpitMetricAvailability(row: CockpitRow, key: CockpitMetricKey, mode: CockpitMode, input?: CockpitInput) {
  const value = cockpitMetricValue(row, key, mode)
  if (value !== undefined && Number.isFinite(value)) return { available: true, reason: '当前范围有可用值' }
  const fields = cockpitRatioFields(key)
  const required = fields.length ? fields : [{ key: key as AmountKey, label: '' }]
  const missing = required.find(field => row[field.key]?.[mode] === undefined || !Number.isFinite(row[field.key]?.[mode]))
  if (missing) {
    const sourceIndex = ({ annual: 0, estimate: 1, budget: 2, cumulativeBudget: 2 } as Partial<Record<AmountKey, number>>)[missing.key]
    if (sourceIndex !== undefined && input && !input.sources[sourceIndex]) return { available: false, reason: `未设置正式${['年度预算', '项目概算', '项目预算'][sourceIndex]}` }
    if (missing.key === 'actual' && input && !input.dataset) return { available: false, reason: '无项目核算台账' }
    if (missing.key === 'cumulative' && input && !input.sources.some(Boolean)) return { available: false, reason: '无正式预算或概算来源' }
    if (missing.key === 'cumulative' || missing.key === 'cumulativeBudget') return { available: false, reason: '累计投入暂无法计算，请在项目资源核对起算日期与来源' }
    return { available: false, reason: `${missing.label ? `${missing.label}：` : ''}当前日期或部门无可用${mode === 'labor' ? '人月' : '费用'}值` }
  }
  return { available: false, reason: '比例分母为零或非正，无法计算' }
}

/** Receive authorized, globally filtered facts only. Inputs never add rows to these results. */
export function cockpitMetricDetail(facts: readonly CockpitFact[], key: CockpitMetricKey, mode: CockpitMode, filter: CockpitSourceFilter, search: string) {
  const projectRows = cockpitOverview(facts, 'project', mode)
  const available = projectRows.filter(row => cockpitMetricAvailability(row, key, mode).available).length
  const rows = projectRows.filter(row => row.name.toLowerCase().includes(search.trim().toLowerCase()) &&
    (filter === 'all' || cockpitMetricAvailability(row, key, mode).available === (filter === 'available')))
    .sort((a, b) => {
      const av = cockpitMetricValue(a, key, mode), bv = cockpitMetricValue(b, key, mode)
      const aa = cockpitMetricAvailability(a, key, mode).available, ba = cockpitMetricAvailability(b, key, mode).available
      return Number(ba) - Number(aa) || (aa && ba ? Math.abs(bv!) - Math.abs(av!) : 0)
    })
  const ids = new Set(rows.map(row => row.key))
  const total: CockpitRow = { key: 'total', name: '匹配明细合计', count: rows.length, ...summarizeCockpit(facts.filter(fact => ids.has(fact.project.id))) }
  return { rows, total, available, unavailable: projectRows.length - available, count: projectRows.length }
}
