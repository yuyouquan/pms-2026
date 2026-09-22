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
      <div className="pms-dashboard-metric-heading"><h3>累至今日预估投入</h3><Tooltip title={cumulative ? `来源：${sourceLabel} ${cumulative.source.version.versionNumber} · 正式版本。部门预估投入 × 阶段比例 × 里程碑间已过自然日占比，截止 ${details.today}，仅随部门筛选变化。${cumulative.issues.join('；')}` : '未设置可用的正式项目预算、年度预算或项目概算。'}><InfoCircleOutlined /></Tooltip></div>
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
      <div className="pms-dashboard-metric-heading"><h3>概算 → 预算偏差</h3><Tooltip title="（项目预算费用－项目概算费用）÷ 项目概算费用；分母为零或缺失时不计算。"><InfoCircleOutlined /></Tooltip></div>
      <div className={`pms-dashboard-metric-value${(metrics.costDelta?.percent ?? 0) > 0 ? ' pms-resource-difference' : ''}`}>{signed(metrics.costDelta?.percent)}<small> %</small></div>
      <div className="pms-dashboard-metric-cost">费用差 {signed(metrics.costDelta?.amount, 2)} 万元</div>
      <span className="pms-dashboard-metric-caption">人月差 {signed(metrics.laborDelta?.amount)}</span>
    </article>
    <article className="pms-dashboard-metric" aria-label="累至今日执行率指标">
      <div className="pms-dashboard-metric-heading"><h3>累至今日执行率</h3><Tooltip title={`截至 ${details.today} 的核算人月 ÷ 累至今日预估人月，仅随部门筛选变化；分母为零或缺失时不计算。`}><InfoCircleOutlined /></Tooltip></div>
      <div className={`pms-dashboard-metric-value${(details.total.toDateExecution ?? 0) > 100 ? ' pms-resource-difference' : ''}`}>{format(details.total.toDateExecution)}<small> %</small></div>
      <div className="pms-dashboard-metric-cost">{format(details.actualToDate?.labor, 3)} / {format(cumulative?.labor, 3)} 人月</div>
      <span className="pms-dashboard-metric-caption">截至 {details.today}</span>
    </article>
    <article className="pms-dashboard-metric" aria-label="全生命周期预算执行率指标">
      <div className="pms-dashboard-metric-heading"><h3>全生命周期预算执行率</h3><Tooltip title="项目核算费用 ÷ 项目预算费用；沿用当前部门及日期筛选。分母为零或缺失时不计算。"><InfoCircleOutlined /></Tooltip></div>
      <div className={`pms-dashboard-metric-value${(metrics.execution ?? 0) > 100 ? ' pms-resource-difference' : ''}`}>{format(metrics.execution)}<small> %</small></div>
      <div className="pms-dashboard-metric-cost">{format(actual?.cost, 2)} / {format(budget?.cost, 2)} 万元</div>
      <span className="pms-dashboard-metric-caption">{format(actual?.labor)} / {format(budget?.labor)} 人月</span>
    </article>
  </div></div>
}
