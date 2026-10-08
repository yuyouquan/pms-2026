import type { ProjectItem } from '@/types/app'
import type { HrProjectCategory } from '@/lib/hrFormalProjectSource'
import type { PermissionCenterModel } from '@/types/permissionCenter'
import type { ResourceAccountingDataset } from '@/types/resourceAccounting'
import type { ResourceMonthlyRow } from '@/components/project-resources/resourceVersionViewData'
import { buildDashboardAnalysis, type DashboardSource } from '@/components/project-resources/resourceDashboardData'
import { buildAccountingAnalysis, dashboardDepartmentParents, UNASSIGNED_PRIMARY } from '@/components/project-resources/resourceAccounting'
import { buildCumulativeEstimate, executionPercent } from '@/components/project-resources/cumulativeEstimateData'
import { dashboardDates, dashboardWeekStart, type DashboardDay } from '@/components/project-resources/resourceDashboardPeriods'
import { resolveMachineDepartmentInvestments } from '@/lib/resourceAllocation'
import { evaluateMenuPermission } from '@/lib/permissionCenter'
import { getProjectInfoValue } from '@/lib/projectInfoValues'
import { EXTERNAL_PROJECT_POOL } from '@/data/externalProjectPool'

export const COCKPIT_CATEGORIES = [
  { key: 'machine', label: '整机产品项目', color: '#7561d1' },
  { key: 'tos', label: 'tOS项目', color: '#3c99a0' },
  { key: 'technical', label: '技术项目', color: '#cd9550' },
  { key: 'capability', label: '能力建设项目', color: '#698dc8' },
] as const
export const SOFTWARE_DEPARTMENTS = ['软件项目管理部', '软件产品规划部', '软件架设与技术规划部', '底软通信开发部', '系统应用开发部', '集成维护开发部', '用户体验部', '创新产品部']
export const isSoftwareDepartment = (primary: string) => primary === '软件工程部'
export type CockpitScope = 'software' | 'all'
// Existing project resources may use other organizations. Never default them out of the dashboard.
export const defaultCockpitScope = (facts: readonly Pick<CockpitFact, 'primary'>[]): CockpitScope => facts.some(row => isSoftwareDepartment(row.primary)) ? 'software' : 'all'
export type CockpitMode = 'labor' | 'cost'
export type Amount = { labor?: number; cost?: number }
export type AmountKey = 'annual' | 'estimate' | 'budget' | 'cumulative' | 'cumulativeBudget' | 'actual'
export interface CockpitInput {
  project: ProjectItem; category: HrProjectCategory; sources: (DashboardSource | undefined)[]
  monthly: readonly ResourceMonthlyRow[]; dataset?: ResourceAccountingDataset
}
export interface CockpitFilter { startDate: string; endDate: string; scope: CockpitScope; departments: string[] }
export interface CockpitFact {
  key: string; project: ProjectItem; category: HrProjectCategory; primary: string; secondary: string; research: string
  annual?: Amount; estimate?: Amount; budget?: Amount; cumulative?: Amount; cumulativeBudget?: Amount; actual?: Amount
  daily: { annual?: DashboardDay[]; estimate?: DashboardDay[]; budget?: DashboardDay[]; actual?: DashboardDay[] }
  worklogs: { date: string; personDays: number }[]; issues: string[]
}
export interface CockpitRow extends Partial<Record<AmountKey, Amount>> {
  key: string; name: string; category?: HrProjectCategory; project?: ProjectItem; count: number
}
export const formatCockpit = (value: number | undefined, precision = 1) => value === undefined || !Number.isFinite(value) ? '—' : value.toLocaleString('zh-CN', { minimumFractionDigits: precision, maximumFractionDigits: precision })

/** Only explicit source classification is used. An ambiguous project stays unclassified. */
export function cockpitResearchCategory(project: ProjectItem) {
  const raw = [getProjectInfoValue({ ...project }, 'ipmProjectType'), getProjectInfoValue({ ...project }, 'ipmProjectCategory'), EXTERNAL_PROJECT_POOL.find(item => item.bid === project.sourceBid)?.ipmProjectCategoryName].filter(value => typeof value === 'string').join(' ')
  const matches = ['产品开发', '技术研发', '基础研究'].filter(label => raw.includes(label))
  return matches.length === 1 ? matches[0] : '未归类'
}
export function canReadCockpitDepartment(model: PermissionCenterModel | undefined, actor: string, project: ProjectItem, category: HrProjectCategory, primary: string, secondary: string) {
  return evaluateMenuPermission(model, actor, 'cockpit.resources', 'view', {
    name: project.name, type: COCKPIT_CATEGORIES.find(item => item.key === category)!.label,
    status: project.status, primaryDepartment: primary, secondaryDepartment: secondary,
  })
}

/** Authorization is applied at project + department grain before any totals, options or charts exist. */
export function buildCockpitFacts(inputs: readonly CockpitInput[], dates: Pick<CockpitFilter, 'startDate' | 'endDate'>, rate: number, today: string,
  allow: (input: CockpitInput, primary: string, secondary: string) => boolean): CockpitFact[] {
  return inputs.flatMap(input => {
    const { project, category, sources, monthly, dataset } = input
    const upper = sources.flatMap(source => !source ? [] : 'hrModelVersion' in source.version ? resolveMachineDepartmentInvestments(source.version) : source.version.departmentInvestments)
    const activeRows = monthly.filter(row => !row.isArchived && sources.some(source => source?.version.id === row.versionId))
    const pairs = [...upper, ...activeRows, ...(dataset?.worklogs ?? []), ...(dataset?.expenses ?? [])]
    const parents = dashboardDepartmentParents(pairs)
    const expenses = sources.flatMap(source => source?.version.nonLaborInvestment?.items.map(row => ({ primaryDepartment: row.primaryDepartment || parents[row.secondaryDepartment] || UNASSIGNED_PRIMARY, secondaryDepartment: row.secondaryDepartment })) ?? [])
    const departments = new Map([...pairs, ...expenses].map(row => {
      const primary = row.primaryDepartment || UNASSIGNED_PRIMARY, secondary = row.secondaryDepartment || '未填二级部门'
      return [JSON.stringify([primary, secondary]), { primary, secondary, sourceSecondary: row.secondaryDepartment }]
    }))
    // Unconfigured projects never acquire invented department or financial records.
    return [...departments].flatMap(([key, { primary, secondary, sourceSecondary }]) => {
      if (!allow(input, primary, secondary)) return []
      const filter = { ...dates, primary, department: sourceSecondary, departmentParents: parents }
      const analyses = sources.map(source => source && buildDashboardAnalysis(category, source, monthly, rate, filter))
      const actual = buildAccountingAnalysis(dataset, rate, { ...filter, endDate: dates.endDate < today ? dates.endDate : today })
      // A date filter must not retain projects whose only plans and ledgers lie outside the window.
      if (!analyses.some(analysis => analysis?.months.length) && !actual?.months.length) return []
      const start = project.planStartDate
      const cumulativeStart = start && start > dates.startDate ? start : dates.startDate
      const cutoff = dates.endDate < today ? dates.endDate : today
      // Keep the project-space calendar-day formula, intersected with the selected cockpit date window.
      const cumulative = buildCumulativeEstimate(category, sources, rate, filter, cutoff, monthly, start ? cumulativeStart : undefined)
      const cumulativeBudget = buildCumulativeEstimate(category, [sources[2]], rate, filter, cutoff, monthly, start ? cumulativeStart : undefined)
      const amount = (analysis: typeof analyses[number] | typeof actual): Amount | undefined => analysis?.months.length ? { labor: analysis.labor, cost: analysis.cost } : undefined
      const issues = [...(cumulative?.issues ?? []), ...(actual?.issues ?? [])]
      return [{ key: `${project.id}:${key}`, project, category, primary, secondary, research: cockpitResearchCategory(project),
        annual: amount(analyses[0]), estimate: amount(analyses[1]), budget: amount(analyses[2]),
        cumulative: cumulative && { labor: cumulative.labor, cost: cumulative.cost }, cumulativeBudget: cumulativeBudget && { labor: cumulativeBudget.labor, cost: cumulativeBudget.cost }, actual: amount(actual),
        daily: { annual: analyses[0]?.daily, estimate: analyses[1]?.daily, budget: analyses[2]?.daily, actual: actual?.daily },
        worklogs: actual?.worklogs.map(row => ({ date: row.date, personDays: row.personDays })) ?? [], issues,
      }]
    })
  })
}
export function filterCockpitFacts(facts: readonly CockpitFact[], filter: Pick<CockpitFilter, 'scope' | 'departments'>) {
  return facts.filter(row => (filter.scope === 'all' || isSoftwareDepartment(row.primary)) && (!filter.departments.length || filter.departments.includes(row.secondary)))
}
/** Sum available values only; coverage is shown alongside each metric. Missing data never becomes zero. */
export function summarizeCockpit(facts: readonly CockpitFact[]): Partial<Record<AmountKey, Amount>> {
  const keys: AmountKey[] = ['annual', 'estimate', 'budget', 'cumulative', 'cumulativeBudget', 'actual']
  return Object.fromEntries(keys.map(key => {
    const values = facts.flatMap(row => row[key] ? [row[key]!] : [])
    const amount = values.length ? Object.fromEntries((['labor', 'cost'] as const).map(mode => [mode, values.some(value => value[mode] !== undefined) ? values.reduce((total, value) => total + (value[mode] ?? 0), 0) : undefined])) : undefined
    return [key, amount]
  }))
}
export function cockpitRatios(row: Partial<Record<AmountKey, Amount>>, mode: CockpitMode) {
  const budget = row.budget?.[mode], estimate = row.estimate?.[mode], actual = row.actual?.[mode]
  return {
    deviation: budget === undefined || estimate === undefined || estimate <= 0 ? undefined : (budget - estimate) / estimate * 100,
    toDate: executionPercent(actual, row.cumulative?.[mode]), annualExecution: executionPercent(actual, budget),
  }
}
export function cockpitOverview(facts: readonly CockpitFact[], group: 'category' | 'department' | 'project', mode: CockpitMode): CockpitRow[] {
  const groups = new Map<string, CockpitFact[]>()
  if (group === 'category') COCKPIT_CATEGORIES.forEach(item => groups.set(item.key, []))
  if (group === 'department') SOFTWARE_DEPARTMENTS.forEach(item => groups.set(JSON.stringify(['软件工程部', item]), []))
  facts.forEach(row => {
    const key = group === 'category' ? row.category : group === 'project' ? row.project.id : JSON.stringify([row.primary, row.secondary])
    groups.set(key, [...(groups.get(key) ?? []), row])
  })
  return [...groups].map(([key, rows]) => ({ key,
    name: group === 'category' ? COCKPIT_CATEGORIES.find(item => item.key === key)!.label : group === 'department' ? (rows[0]?.secondary ?? JSON.parse(key)[1]) : rows[0].project.name,
    category: group === 'category' ? key as HrProjectCategory : rows[0]?.category, project: group === 'project' ? rows[0]?.project : undefined,
    count: new Set(rows.map(row => row.project.id)).size, ...summarizeCockpit(rows),
  })).sort((a, b) => group === 'project'
    ? COCKPIT_CATEGORIES.findIndex(item => item.key === a.category) - COCKPIT_CATEGORIES.findIndex(item => item.key === b.category) || (b.annual?.[mode] ?? -Infinity) - (a.annual?.[mode] ?? -Infinity) || a.name.localeCompare(b.name, 'zh-CN')
    : 0)
}
export function cockpitPeriods(dates: Pick<CockpitFilter, 'startDate' | 'endDate'>, grain: 'month' | 'week' = 'month') {
  return [...new Set(dashboardDates(dates.startDate, dates.endDate).map(date => grain === 'month' ? date.slice(0, 7) : dashboardWeekStart(date)))]
}
export function cockpitTrend(facts: readonly CockpitFact[], dates: Pick<CockpitFilter, 'startDate' | 'endDate'>, mode: CockpitMode, kind: 'resource' | 'category', grain: 'month' | 'week') {
  const periods = cockpitPeriods(dates, kind === 'resource' ? 'month' : grain)
  const definitions = kind === 'resource' ? [
    { key: 'annual', label: '年度预算', color: '#7561d1' }, { key: 'estimate', label: '项目概算', color: '#3c99a0' },
    { key: 'budget', label: '项目预算', color: '#cd9550' }, { key: 'actual', label: '项目核算', color: '#698dc8' },
  ] : COCKPIT_CATEGORIES
  return { periods, series: definitions.map(item => {
    const sums = new Map<string, number>()
    facts.filter(row => kind === 'resource' || row.category === item.key).forEach(row => {
      const days = row.daily[kind === 'resource' ? item.key as keyof CockpitFact['daily'] : 'actual']
      days?.forEach(day => {
        const period = kind === 'category' && grain === 'week' ? dashboardWeekStart(day.date) : day.date.slice(0, 7)
        sums.set(period, (sums.get(period) ?? 0) + day[mode])
      })
    })
    return { ...item, values: periods.map(period => sums.get(period)) }
  }) }
}
/** Investment shares use source person-days, not money or an average of monthly percentages. */
export function cockpitShares(facts: readonly CockpitFact[], dates: Pick<CockpitFilter, 'startDate' | 'endDate'>, kind: 'research' | 'category') {
  const months = cockpitPeriods(dates), labels = kind === 'research' ? ['产品开发', '技术研发', '基础研究', '未归类'] : COCKPIT_CATEGORIES.map(item => item.label)
  const totals = new Map<string, number>(), byMonth = new Map<string, number>(), groupMonths = new Map<string, number>()
  facts.forEach(row => {
    const label = kind === 'research' ? row.research : COCKPIT_CATEGORIES.find(item => item.key === row.category)!.label
    row.worklogs.forEach(log => {
      const month = log.date.slice(0, 7)
      totals.set(label, (totals.get(label) ?? 0) + log.personDays)
      byMonth.set(month, (byMonth.get(month) ?? 0) + log.personDays)
      groupMonths.set(`${label}:${month}`, (groupMonths.get(`${label}:${month}`) ?? 0) + log.personDays)
    })
  })
  const total = [...totals.values()].reduce((sum, value) => sum + value, 0)
  return { months, total, rows: labels.filter(label => label !== '未归类' || (totals.get(label) ?? 0) > 0).map((label, index) => ({ key: label, label, color: COCKPIT_CATEGORIES[index]?.color ?? '#9ca5b5', days: totals.get(label) ?? 0,
    total: total > 0 ? (totals.get(label) ?? 0) / total * 100 : undefined,
    months: months.map(month => (byMonth.get(month) ?? 0) > 0 ? (groupMonths.get(`${label}:${month}`) ?? 0) / byMonth.get(month)! * 100 : undefined),
  })) }
}
