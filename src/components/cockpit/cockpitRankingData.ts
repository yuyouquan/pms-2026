import { cockpitOverview, type CockpitFact, type CockpitMode } from '@/components/cockpit/cockpitData'

/** Input facts already carry the live date, department and authorization restrictions. */
export function cockpitProjectRanking(facts: readonly CockpitFact[], metric: 'budget' | 'actual', mode: CockpitMode) {
  const projects = cockpitOverview(facts, 'project', mode)
  const available = projects.flatMap(row => {
    const value = row[metric]?.[mode]
    return value === undefined || !Number.isFinite(value) ? [] : [{ ...row, value }]
  }).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'zh-CN') || a.key.localeCompare(b.key))
  const total = available.length ? available.reduce((sum, row) => sum + row.value, 0) : undefined
  const positive = Math.max(0, ...available.map(row => row.value)), negative = Math.max(0, ...available.map(row => -row.value))
  const domain = positive + negative, zero = domain ? negative / domain * 100 : 0
  const topCount = Math.min(3, available.length)
  return {
    projectCount: projects.length, covered: available.length, total, zero, topCount,
    topShare: total !== undefined && total > 0 ? available.slice(0, topCount).reduce((sum, row) => sum + row.value, 0) / total * 100 : undefined,
    rows: available.map(row => ({ ...row,
      share: total !== undefined && total > 0 ? row.value / total * 100 : undefined,
      barStart: zero + (domain ? Math.min(0, row.value) / domain * 100 : 0), barWidth: domain ? Math.abs(row.value) / domain * 100 : 0,
    })),
  }
}
