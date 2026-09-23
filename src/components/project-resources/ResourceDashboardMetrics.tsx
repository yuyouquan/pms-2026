'use client'
import { Tag, Tooltip } from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons'
import type { CSSProperties } from 'react'
import { DASHBOARD_BUDGETS, type DashboardAnalysis, type DashboardSource } from '@/components/project-resources/resourceDashboardData'
import { dashboardBusinessMetrics } from '@/components/project-resources/resourceDashboardBusiness'
import type { AccountingAnalysis } from '@/components/project-resources/resourceAccounting'
import type { ResourceDepartmentDetails } from '@/components/project-resources/cumulativeEstimateData'
const format = (value: number | undefined, precision = 1) => value === undefined ? '—' : value.toLocaleString('zh-CN', { minimumFractionDigits: precision, maximumFractionDigits: precision })
const signed = (value: number | undefined, precision = 1) => value === undefined ? '—' : `${value > 0 ? '+' : ''}${format(value, precision)}`
export default function ResourceDashboardMetrics({ sources, analyses, accounting, details }: {
  sources: (DashboardSource | undefined)[]; analyses: (DashboardAnalysis | undefined)[]; accounting?: AccountingAnalysis; details: ResourceDepartmentDetails
}) {
  const metrics = dashboardBusinessMetrics(analyses, accounting)
  const budget = analyses[2]?.months.length ? analyses[2] : undefined
  const actual = accounting?.months.length ? accounting : undefined
  const cumulative = details.cumulative
  const sourceLabel = DASHBOARD_BUDGETS.find(item => item.key === cumulative?.source.version.budgetType)?.label
  return <div className="pms-dashboard-metrics-scroll" tabIndex={0} aria-label="八项资源指标，可横向滚动"><div className="pms-dashboard-eight-metrics">
    {DASHBOARD_BUDGETS.map((item, index) => {
      const source = sources[index], analysis = analyses[index]
      return <article className="pms-dashboard-metric" key={item.key} style={{ '--budget-color': item.color } as CSSProperties} aria-label={`${item.label}指标`}>
        <div className="pms-dashboard-metric-heading"><h3>{item.key === 'annual' ? '项目年度预算' : item.label}</h3>{source ? <span className="pms-dashboard-official-version" title={`${source.version.versionNumber} · 正式版本`}>{source.version.versionNumber}</span> : <Tooltip title="未设置唯一正式版本，未纳入分析"><InfoCircleOutlined /></Tooltip>}</div>
        <div className="pms-dashboard-metric-value">{format(analysis?.months.length ? analysis.labor : undefined)} <small>人月</small></div>
        <div className="pms-dashboard-metric-cost">{format(analysis?.months.length ? analysis.cost : undefined, 2)} 万元</div>

      </article>
    })}
    <article className="pms-dashboard-metric" style={{ '--budget-color': '#497dc0' } as CSSProperties} aria-label="累至今日预估投入指标">
      <div className="pms-dashboard-metric-heading"><h3>累至今日预估投入</h3><Tooltip title={cumulative ? `来源：${sourceLabel} ${cumulative.source.version.versionNumber} · 正式版本。部门预估投入 × 阶段比例 × 里程碑间已过自然日占比，截止 ${details.today}，仅随部门筛选变化。费用为预估人力费加截至今日非人力计划费用，当月非人力费用按已过工作日占比折算。${cumulative.issues.join('；')}` : '未设置可用的正式项目预算、年度预算或项目概算。'}><InfoCircleOutlined /></Tooltip></div>
      <div className="pms-dashboard-metric-value">{format(cumulative?.labor)} <small>人月</small></div>
      <div className="pms-dashboard-metric-cost">{format(cumulative?.cost, 2)} 万元</div>
      <span className="pms-dashboard-metric-caption">{cumulative ? `${sourceLabel} ${cumulative.source.version.versionNumber}` : '暂无正式版本'}</span>
      {cumulative?.issues.length ? <span className="pms-resource-difference">阶段投入或里程碑待完善</span> : null}
    </article>
    <article className="pms-dashboard-metric" style={{ '--budget-color': '#31976c' } as CSSProperties} aria-label="项目核算指标">
      <div className="pms-dashboard-metric-heading"><h3>项目核算</h3><Tag color="green">Mock</Tag></div>
      <div className="pms-dashboard-metric-value">{format(actual?.labor)} <small>人月</small></div>
      <div className="pms-dashboard-metric-cost">{format(actual?.cost, 2)} 万元</div>
      <span className="pms-dashboard-metric-caption">人天 ÷ 当月工作日</span>
    </article>
    <article className="pms-dashboard-metric" aria-label="概算到预算偏差指标">
      <div className="pms-dashboard-metric-heading"><h3>概算 → 预算偏差</h3><Tooltip title="（项目预算－项目概算）÷ 项目概算；分别按人月、总费用计算，分母为零或缺失时显示 —。"><InfoCircleOutlined /></Tooltip></div>
      <div className={`pms-dashboard-metric-value${(metrics.laborDelta?.percent ?? 0) > 0 ? ' pms-resource-difference' : ''}`}>{signed(metrics.laborDelta?.percent)}<small> % 人月</small></div>
      <div className="pms-dashboard-metric-cost">人月差 {signed(metrics.laborDelta?.amount)}</div>
      <div className={`pms-dashboard-metric-cost${(metrics.costDelta?.percent ?? 0) > 0 ? ' pms-resource-difference' : ''}`}>费用 {signed(metrics.costDelta?.percent)}%</div>
      <div className="pms-dashboard-metric-cost">费用差 {signed(metrics.costDelta?.amount, 2)} 万元</div>
    </article>
    {([
      { key: 'toDate', label: '累至今日执行率', labor: details.total.toDateExecution, cost: details.total.toDateCostExecution, planned: cumulative, tooltip: `项目核算 ÷ 累至今日预估投入，分别按人月和总费用计算。分子与项目核算卡片一致；预估截至 ${details.today}，仅随部门筛选变化。` },
      { key: 'lifecycle', label: '全生命周期预算执行率', labor: details.total.lifecycleExecution, cost: details.total.lifecycleCostExecution, planned: budget, tooltip: '项目核算 ÷ 项目预算，分别按人月和总费用计算，沿用当前部门及日期筛选。' },
    ] as const).map(item => <article key={item.key} className="pms-dashboard-metric" aria-label={`${item.label}指标`}>
      <div className="pms-dashboard-metric-heading"><h3>{item.label}</h3><Tooltip title={`${item.tooltip} 总费用含人力费用及非人力费用；分母为零或缺失时显示 —。`}><InfoCircleOutlined /></Tooltip></div>
      <div className={`pms-dashboard-metric-value${(item.labor ?? 0) > 100 ? ' pms-resource-difference' : ''}`}>{format(item.labor)}<small> % 人月</small></div>
      <div className="pms-dashboard-metric-cost">{format(actual?.labor, 3)} / {format(item.planned?.labor, 3)} 人月</div>
      <div className={`pms-dashboard-metric-cost${(item.cost ?? 0) > 100 ? ' pms-resource-difference' : ''}`}>费用 {format(item.cost)}%</div>
      <div className="pms-dashboard-metric-cost">{format(actual?.cost, 2)} / {format(item.planned?.cost, 2)} 万元</div>
    </article>)}
  </div></div>
}
