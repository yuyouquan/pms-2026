import { isHrVersionVisible } from '@/lib/hrProjectRegistry'
import type { HrProjectCategory } from '@/lib/hrFormalProjectSource'
import { resolveMachineDepartmentInvestments } from '@/lib/resourceAllocation'
import { getResourcePhaseRatios } from '@/lib/resourceRatios'
import { hrNonLaborMonthRange } from '@/lib/hrNonLaborRange'
import { cloneNonLaborInvestment, nonLaborMonths } from '@/lib/nonLaborInvestment'
import type { ResourceProject, ResourceVersion } from '@/components/project-resources/resourceVersionAdapter'
import { buildResourceMonthlyView, type ResourceBudgetType, type ResourceMonthlyRow } from '@/components/project-resources/resourceVersionViewData'
import { resourceInvestmentStages, summarizeResourceMonths, sumMonthlyRow } from '@/components/project-resources/resourceMonthlyPresentation'

export const DASHBOARD_BUDGETS: { key: ResourceBudgetType; label: string; color: string }[] = [
  { key: 'annual', label: '年度预算', color: '#6b50dc' },
  { key: 'projectEstimate', label: '项目概算', color: '#168b88' },
  { key: 'projectBudget', label: '项目预算', color: '#c77d25' },
]
export interface DashboardSource { owner: ResourceProject; version: ResourceVersion }
export function dashboardSources(projects: readonly ResourceProject[], scopeId: string, type: ResourceBudgetType): DashboardSource[] {
  return projects.filter(owner => isHrVersionVisible(owner, type, scopeId)).flatMap(owner => owner.versions
    .filter(version => version.budgetType === type).map(version => ({ owner, version })))
    .sort((a, b) => b.version.createdAt.localeCompare(a.version.createdAt) || b.version.minorVersion - a.version.minorVersion)
}
/** Missing or conflicting official versions require an explicit analysis selection. Never silently use a draft. */
export function selectDashboardSource(sources: readonly DashboardSource[], selectedId?: string) {
  if (selectedId) return sources.find(source => source.version.id === selectedId)
  const official = sources.filter(source => source.version.isActive)
  return official.length === 1 ? official[0] : undefined
}
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : 0
const rounded = (value: number) => Math.round(value * 1000000) / 1000000
export function dashboardDelta(value: number | undefined, baseline: number | undefined) {
  if (value === undefined || baseline === undefined) return undefined
  const amount = rounded(value - baseline)
  return { amount, percent: baseline === 0 ? undefined : amount / baseline * 100 }
}
export interface DashboardDepartment {
  key: string; primary: string; secondary: string; target: number; allocated: number; selected: number; cost: number; delta: number; deficit: number; excess: number; share: number
}
export interface DashboardIssue { key: string; title: string; detail: string; severity: 'warning' | 'info' }

export function buildDashboardAnalysis(category: HrProjectCategory, source: DashboardSource, allRows: readonly ResourceMonthlyRow[], rate: number,
  filter: { year?: string; department?: string } = {}) {
  const version = source.version, year = filter.year ?? 'all', department = filter.department ?? 'all'
  const matches = (value: string) => department === 'all' || value === department
  const rows = allRows.filter(row => row.versionId === version.id && !row.isArchived && matches(row.secondaryDepartment))
  const range = hrNonLaborMonthRange(category, 'milestones' in version ? version.milestones : version, true)
  const complete = buildResourceMonthlyView(rows, version.id, range.startMonth ?? undefined, range.endMonth ?? undefined)
  const expense = cloneNonLaborInvestment(version.nonLaborInvestment)
  const expenseMonths = nonLaborMonths(expense)
  const expenseItems = expense.items.filter(item => matches(item.secondaryDepartment))
  const allMonths = [...new Set([...complete.months, ...expenseMonths])].sort()
  const months = allMonths.filter(month => year === 'all' || month.startsWith(`${year}-`))
  const years = [...new Set(allMonths.map(month => month.slice(0, 4)))]
  const validRate = Number.isFinite(rate) && rate >= 0 ? rate : 0
  const monthly = months.map(month => {
    const labor = rounded(rows.reduce((sum, row) => sum + number(row.monthlyData[month]), 0))
    const nonLaborYuan = expenseMonths.includes(month) ? rounded(expenseItems.reduce((sum, item) => sum + number(item.monthlyAmounts[month]), 0)) : 0
    return { month, labor, laborCost: rounded(labor * validRate), nonLaborYuan, cost: rounded(labor * validRate + nonLaborYuan / 10000) }
  })
  const labor = rounded(monthly.reduce((sum, item) => sum + item.labor, 0))
  const nonLaborYuan = rounded(monthly.reduce((sum, item) => sum + item.nonLaborYuan, 0))
  const laborCost = rounded(labor * validRate), cost = rounded(laborCost + nonLaborYuan / 10000)
  const peak = monthly.reduce<{ month: string; value: number } | undefined>((best, item) => !best || item.labor > best.value ? { month: item.month, value: item.labor } : best, undefined)
  const upperRows = ('hrModelVersion' in version ? resolveMachineDepartmentInvestments(version) : version.departmentInvestments).filter(row => matches(row.secondaryDepartment))
  const departments = new Map<string, DashboardDepartment>()
  const keyOf = (primary: string, secondary: string) => JSON.stringify([primary, secondary])
  const ensure = (primary: string, secondary: string) => {
    const key = keyOf(primary, secondary)
    if (!departments.has(key)) departments.set(key, { key, primary, secondary, target: 0, allocated: 0, selected: 0, cost: 0, delta: 0, deficit: 0, excess: 0, share: 0 })
    return departments.get(key)!
  }
  const upperKeys = new Set(upperRows.map(row => keyOf(row.primaryDepartment, row.secondaryDepartment)))
  upperRows.forEach(row => { ensure(row.primaryDepartment, row.secondaryDepartment).target += number(row.estimatedInvestment) })
  const issues: DashboardIssue[] = []
  const monthlyTargets = new Map<string, number>()
  rows.forEach((row, index) => {
    const item = ensure(row.primaryDepartment, row.secondaryDepartment)
    monthlyTargets.set(item.key, (monthlyTargets.get(item.key) ?? 0) + number(row.estimatedTotal))
    if (!upperKeys.has(item.key)) item.target += number(row.estimatedTotal)
    const rowTotal = sumMonthlyRow(row), delta = rounded(rowTotal - number(row.estimatedTotal))
    item.allocated += rowTotal
    item.selected += sumMonthlyRow(row, months)
    // Source rows can share department names. Keep their shortages and excesses before grouping.
    if (Math.abs(delta) >= 0.0005) {
      item.deficit += Math.max(0, -delta)
      item.excess += Math.max(0, delta)
      const duplicate = rows.filter(other => keyOf(other.primaryDepartment, other.secondaryDepartment) === item.key).length > 1
      const ordinal = duplicate ? `（第 ${rows.slice(0, index + 1).filter(other => keyOf(other.primaryDepartment, other.secondaryDepartment) === item.key).length} 条投入）` : ''
      issues.push({ key: `balance-${row.id}`, title: `${item.primary || '未填一级部门'} / ${item.secondary || '未填二级部门'}${ordinal} 分配${delta > 0 ? '超额' : '不足'}`,
        detail: `全周期已分配 ${rowTotal.toFixed(1)} / 目标 ${number(row.estimatedTotal).toFixed(1)} 人月（${delta > 0 ? '+' : ''}${delta.toFixed(1)}）`, severity: 'warning' })
    }
  })
  departments.forEach(item => {
    const missingTarget = rounded(item.target - (monthlyTargets.get(item.key) ?? 0))
    if (Math.abs(missingTarget) >= 0.0005) {
      item.deficit += Math.max(0, missingTarget)
      item.excess += Math.max(0, -missingTarget)
      issues.push({ key: `balance-missing-${item.key}`, title: `${item.primary || '未填一级部门'} / ${item.secondary || '未填二级部门'} 月度目标待同步`, detail: `上方目标 ${item.target.toFixed(1)} / 月度来源目标 ${(monthlyTargets.get(item.key) ?? 0).toFixed(1)} 人月`, severity: 'warning' })
    }
  })
  const departmentRows = [...departments.values()].map(item => ({ ...item, target: rounded(item.target), allocated: rounded(item.allocated), selected: rounded(item.selected),
    cost: rounded(item.selected * validRate), delta: rounded(item.allocated - item.target), share: labor > 0 ? item.selected / labor * 100 : 0 }))
    .sort((a, b) => b.selected - a.selected || a.key.localeCompare(b.key))
  const target = department === 'all' ? number(version.estimatedInvestment) : rounded(departmentRows.reduce((sum, item) => sum + item.target, 0))
  const allocated = rounded(departmentRows.reduce((sum, item) => sum + item.allocated, 0))
  if (department === 'all' && target > 0 && !departmentRows.length) issues.push({ key: 'missing-detail', title: '版本投入明细缺失', detail: `版本保存了 ${target.toFixed(1)} 人月预估，但未保存可还原的部门与月度明细，请前往来源版本核对。`, severity: 'warning' })
  const deficit = rounded(departmentRows.reduce((sum, item) => sum + item.deficit, 0))
  const excess = rounded(departmentRows.reduce((sum, item) => sum + item.excess, 0))
  const stageDefinitions = resourceInvestmentStages(category, version)
  const stageStats = summarizeResourceMonths({ ...complete, months, totals: Object.fromEntries(monthly.map(item => [item.month, item.labor])), visibleTotal: labor }, stageDefinitions)
  const stages = stageStats.stages.map(stage => ({ ...stage, amount: rounded(labor * stage.ratio / 100) }))
  const subjects = new Map<string, { key: string; secondary: string; tertiary: string; amount: number; share: number }>()
  expenseItems.forEach(item => {
    const key = JSON.stringify([item.secondarySubject, item.tertiarySubject])
    const subject = subjects.get(key) ?? { key, secondary: item.secondarySubject || '待分类', tertiary: item.tertiarySubject || '待分类', amount: 0, share: 0 }
    subject.amount += monthly.reduce((sum, row) => sum + (expenseMonths.includes(row.month) ? number(item.monthlyAmounts[row.month]) : 0), 0)
    subjects.set(key, subject)
  })
  const subjectRows = months.length ? [...subjects.values()].map(item => ({ ...item, amount: rounded(item.amount), share: nonLaborYuan > 0 ? item.amount / nonLaborYuan * 100 : 0 })).sort((a, b) => b.amount - a.amount || a.key.localeCompare(b.key)) : []
  if (category !== 'machine') upperRows.forEach(row => {
    const ratio = Object.values(getResourcePhaseRatios(category, version, row)).reduce((sum, value) => sum + value, 0)
    if (Math.abs(ratio - 100) > 0.00001) issues.push({ key: `ratio-${row.id}`, title: `${row.primaryDepartment || '未填部门'} / ${row.secondaryDepartment || '未填部门'} 阶段比例未平衡`, detail: `比例合计 ${ratio.toFixed(2)}% / 100%`, severity: 'warning' })
  })
  if (upperRows.some(row => !row.primaryDepartment || !row.secondaryDepartment)) issues.push({ key: 'department', title: '部门信息待补全', detail: '部分投入尚未填写完整的一级、二级部门。', severity: 'warning' })
  const pendingStages = stageDefinitions.filter(stage => (!stage.start || !stage.end) && upperRows.some(row => category === 'capability'
    ? row.estimatedInvestment * (getResourcePhaseRatios(category, version, row).projectPeriod ?? 100) > 0
    : number((row as unknown as Record<string, unknown>)[stage.key]) > 0))
  if (pendingStages.length) issues.push({ key: 'dates', title: '阶段日期待补全', detail: pendingStages.map(stage => stage.label).join('、'), severity: 'warning' })
  if (!allMonths.length) issues.push({ key: 'months', title: '尚未形成月度计划', detail: '完善来源版本的里程碑或项目起止日期后，可分析月度投入。', severity: 'info' })
  if (!version.isActive) issues.push({ key: 'draft', title: '正在分析非正式版本', detail: `${version.versionNumber} 为手动选择的分析版本，未改变正式版本。`, severity: 'info' })
  if (!Number.isFinite(rate) || rate < 0) issues.push({ key: 'rate', title: '人力费率无效', detail: '请在配置中心修正费率；当前人力费用按 0 计算。', severity: 'warning' })
  return { source, year, department, rate: validRate, allMonths, months, years, monthly, labor, laborCost, nonLaborYuan, cost,
    target, allocated, deficit, excess, average: months.length ? labor / months.length : 0, peak, departments: departmentRows, stages, subjects: subjectRows, issues }
}
export type DashboardAnalysis = ReturnType<typeof buildDashboardAnalysis>

/** A continuous calendar axis retains gaps as missing values, without inventing zero allocations. */
export function dashboardTrendSeries(analyses: readonly (DashboardAnalysis | undefined)[], mode: 'labor' | 'cost', cumulative: boolean) {
  const observed = analyses.flatMap(analysis => analysis?.months ?? []).sort()
  const months: string[] = []
  if (observed.length) {
    const [startYear, startMonth] = observed[0].split('-').map(Number)
    const [endYear, endMonth] = observed.at(-1)!.split('-').map(Number)
    for (let value = startYear * 12 + startMonth - 1; value <= endYear * 12 + endMonth - 1; value++) months.push(`${Math.floor(value / 12)}-${String(value % 12 + 1).padStart(2, '0')}`)
  }
  const series = DASHBOARD_BUDGETS.map((budget, index) => {
    let total = 0
    return { ...budget, values: months.map(month => {
      const value = analyses[index]?.monthly.find(item => item.month === month)?.[mode]
      if (value === undefined) return undefined
      total += value
      return cumulative ? rounded(total) : value
    }) }
  })
  return { months, series }
}
