import type { DashboardStageDefinition } from '@/components/project-resources/resourceDashboardStages'
import type { ResourceDepartmentDetails } from '@/components/project-resources/cumulativeEstimateData'
import type { DashboardTrendGrain } from '@/components/project-resources/resourceDashboardBusiness'
import { exportMultiSheet, exportTimestamp, type ExportColumn } from '@/utils/exportExcel'
import type { DashboardAnalysis } from '@/components/project-resources/resourceDashboardData'
import type { AccountingAnalysis, DashboardFilter } from '@/components/project-resources/resourceAccounting'
import { DASHBOARD_SERIES, dashboardBusinessMetrics, dashboardBusinessTrend } from '@/components/project-resources/resourceDashboardBusiness'
import { resourceProjectName } from '@/components/project-resources/resourceVersionAdapter'
const amount = (key: string, title: string, precision = 3): ExportColumn => ({ key, title, formatter: (value: number | undefined) => value === undefined ? '—' : Number(value.toFixed(precision)) })
export function exportResourceBusinessDashboard(projectName: string, analyses: (DashboardAnalysis | undefined)[], accounting: AccountingAnalysis | undefined, filter: DashboardFilter, mode: 'labor' | 'cost', grain: DashboardTrendGrain, stages: readonly (DashboardStageDefinition | undefined)[] = [], details?: ResourceDepartmentDetails) {
  const trend = dashboardBusinessTrend(analyses, accounting, mode, grain, stages), metrics = dashboardBusinessMetrics(analyses, accounting)
  const context = { primaryFilter: !filter.primary || filter.primary === 'all' ? '全部一级部门' : filter.primary, departmentFilter: !filter.department || filter.department === 'all' ? '全部二级部门' : filter.department,
    range: filter.startDate && filter.endDate ? `${filter.startDate}～${filter.endDate}` : '全周期' }
  const contextColumns = [{ key: 'primaryFilter', title: '一级部门筛选' }, { key: 'departmentFilter', title: '二级部门筛选' }, { key: 'range', title: '日期范围' }]
  const rowsWithContext = <T extends object>(rows: readonly T[]) => rows.map(row => ({ ...context, ...row }))
  exportMultiSheet([
    { sheetName: '四类投入', columns: [...contextColumns, { key: 'type', title: '分类' }, { key: 'version', title: '版本' }, { key: 'source', title: '来源' }, amount('labor', '人月'), amount('laborCost', '人力费用（万元）', 2), amount('nonLaborYuan', '非人力费用（元）', 2), amount('cost', '费用合计（万元）', 2)],
      rows: rowsWithContext(DASHBOARD_SERIES.map((item, index) => {
        const data = index === 3 ? accounting : analyses[index], visible = data?.months.length ? data : undefined, source = analyses[index]?.source
        return { type: item.label, version: index === 3 ? 'Mock 明细核算' : source?.version.versionNumber ?? '未纳入', source: index === 3 ? accounting ? `独立模拟明细 ${accounting.dataset.startDate}～${accounting.dataset.endDate}` : '暂无来源' : source ? `${resourceProjectName(source.owner)} · 正式版本` : '暂无来源', labor: visible?.labor, laborCost: visible?.laborCost, nonLaborYuan: visible?.nonLaborYuan, cost: visible?.cost }
      })) },
    { sheetName: '偏差及执行率', columns: [...contextColumns, { key: 'name', title: '指标' }, { key: 'formula', title: '计算口径' }, amount('percent', '人月百分比（%）', 2), amount('costPercent', '费用百分比（%）', 2), amount('labor', '预估人月', 6), amount('cost', '预估总费用（万元）', 2), amount('laborDelta', '人月差'), amount('costDelta', '费用差（万元）', 2)], rows: rowsWithContext([
      { name: '概算→预算偏差', formula: '（预算－概算）÷概算，分别按人月、总费用计算', percent: metrics.laborDelta?.percent, costPercent: metrics.costDelta?.percent, laborDelta: metrics.laborDelta?.amount, costDelta: metrics.costDelta?.amount },
      { name: '累至今日预估投入', formula: `部门投入×阶段比例×里程碑已过时间占比；来源 ${details?.cumulative?.source.version.budgetType ?? '无'} ${details?.cumulative?.source.version.versionNumber ?? ''}`, labor: details?.cumulative?.labor, cost: details?.cumulative?.cost, range: `截至 ${details?.today ?? '—'}` },
      { name: '累至今日执行率', formula: '项目核算÷累至今日预估投入，分别按人月、总费用计算；分子与项目核算一致', percent: details?.total.toDateExecution, costPercent: details?.total.toDateCostExecution },
      { name: '全生命周期预算执行率', formula: '项目核算÷项目预算，分别按人月、总费用计算', percent: metrics.laborExecution, costPercent: metrics.execution },
    ]) },
    { sheetName: '当前趋势', columns: [...contextColumns, { key: 'period', title: grain === 'stage' ? '阶段' : grain === 'week' ? '周一～周日' : '月份' }, { key: 'unit', title: '单位' }, ...DASHBOARD_SERIES.map(item => amount(item.key, item.label, mode === 'cost' ? 2 : 3))], rows: rowsWithContext(trend.labels.map((period, index) => ({ period, unit: mode === 'labor' ? '人月' : '万元', ...Object.fromEntries(trend.series.map(item => [item.key, item.values[index]])) }))) },
    { sheetName: '工时投入明细', columns: [...contextColumns, { key: 'date', title: '日期' }, { key: 'person', title: '人员' }, { key: 'primaryDepartment', title: '一级部门' }, { key: 'secondaryDepartment', title: '二级部门' }, amount('personDays', '投入人天', 2), amount('monthWorkingDays', '来源当月工作日', 2), amount('labor', '折算人月', 6), amount('laborCost', '人力费用（万元）', 2), { key: 'description', title: '工作内容' }], rows: rowsWithContext(accounting?.worklogs ?? []) },
    { sheetName: '部门投入明细', columns: [...contextColumns, { key: 'primary', title: '一级部门' }, { key: 'secondary', title: '二级部门' },
      ...[{ key: 'annual', label: '年度预算' }, { key: 'estimate', label: '项目概算' }, { key: 'budget', label: '项目预算' }, { key: 'cumulative', label: '累至今日预估投入' }, { key: 'actual', label: '项目核算' }].flatMap(item => [amount(`${item.key}Labor`, `${item.label}（人月）`, 6), amount(`${item.key}Cost`, `${item.label}（万元）`, 2)]),
      { key: 'today', title: '累至今日截止日期' }, amount('toDateExecution', '累至今日人月执行率（%）', 2), amount('toDateCostExecution', '累至今日费用执行率（%）', 2), amount('lifecycleExecution', '全生命周期预算人月执行率（%）', 2), amount('lifecycleCostExecution', '全生命周期预算费用执行率（%）', 2)],
      rows: rowsWithContext(details ? [...details.rows, details.total].map(row => ({ primary: row.primary, secondary: row.secondary, today: details.today,
        ...Object.fromEntries((['annual', 'estimate', 'budget', 'cumulative', 'actual'] as const).flatMap(key => [[`${key}Labor`, row[key]?.labor], [`${key}Cost`, row[key]?.cost]])),
        toDateExecution: row.toDateExecution, toDateCostExecution: row.toDateCostExecution, lifecycleExecution: row.lifecycleExecution, lifecycleCostExecution: row.lifecycleCostExecution })) : []) },
    { sheetName: '口径与检查', columns: [...contextColumns, { key: 'title', title: '项目' }, { key: 'detail', title: '说明' }], rows: rowsWithContext([
      { title: '计划折算', detail: '预算的周度、阶段和部分月份按当月周一至周五均摊，并非实际发生时间；阶段采用各来源里程碑，核算使用正式项目里程碑，无法归类的投入列为未归属阶段；空缺不补零。' },
      { title: '核算来源', detail: '独立 Mock 人天及实际非人力费用，尚未接入 IPM。人月=人天/来源当月工作日，逐条折算后汇总；Mock 日历为周一至周五。' },
      { title: '费用口径', detail: `人月×配置费率 ${accounting?.rate ?? analyses.find(Boolean)?.rate ?? '—'} 万元/人月+非人力元/10000，逐条计算不提前四舍五入。` },
      { title: '累至今日预估', detail: '依次选取正式项目预算、正式年度预算、正式项目概算的部门投入及里程碑，阶段内按自然日均摊；开始日为0，结束日为100%，同日开始结束按当天完成。忽略月度手动分配及顶部日期筛选，预估费用为人月×费率+截至今日非人力计划元/10000；非人力计划当月按已过工作日占比折算；缺失日期或阶段投入不平衡不计算。' },
      ...details?.cumulative?.issues.map(detail => ({ title: '累至今日来源检查', detail })) ?? [],
      ...analyses.flatMap(analysis => analysis?.issues.map(row => ({ title: row.title, detail: `${analysis.source.version.versionNumber} · ${row.detail}` })) ?? []),
      ...accounting?.issues.map(detail => ({ title: '核算来源检查', detail })) ?? [],
    ]) },
  ], `${projectName}_资源总览_${exportTimestamp()}.xlsx`)
}
