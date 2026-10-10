'use client'
import { RESOURCE_CHART_COLORS } from '@/theme/resourceChartTheme'
import { Tooltip } from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons'
import { useState, type CSSProperties, type ReactNode } from 'react'
import { DASHBOARD_BUDGETS, type DashboardAnalysis, type DashboardSource } from '@/components/project-resources/resourceDashboardData'
import { dashboardBusinessMetrics } from '@/components/project-resources/resourceDashboardBusiness'
import type { AccountingAnalysis } from '@/components/project-resources/resourceAccounting'
import type { ResourceDepartmentDetails } from '@/components/project-resources/cumulativeEstimateData'
const format = (value: number | undefined, precision = 1) => value === undefined ? '—' : value.toLocaleString('zh-CN', { minimumFractionDigits: precision, maximumFractionDigits: precision })
const signed = (value: number | undefined, precision = 1) => value === undefined ? '—' : `${value > 0 ? '+' : ''}${format(value, precision)}`
const cumulativeRule = '采取项目预算的正式版本数据，根据月度预估投入拆分到每日预估，Σ项目立项日起至今日预估投入；若无项目预算则取项目概算数据，若无项目概算则取年度预算数据。'

function MetricRule({ label, title, onOpenChange }: { label: string; title: ReactNode; onOpenChange?: (open: boolean) => void }) {
  return <Tooltip title={title} trigger={['hover', 'focus']} onOpenChange={onOpenChange}>
    <button type="button" className="pms-dashboard-metric-info" aria-label={`${label}计算规则`}><InfoCircleOutlined /></button>
  </Tooltip>
}

function HoverMetric({ label, rule, costs, children }: { label: string; rule: string; costs: ReactNode; children: ReactNode }) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [ruleOpen, setRuleOpen] = useState(false)
  return <Tooltip title={<div className="pms-dashboard-metric-breakdown">{costs}</div>} trigger={['hover', 'focus']} open={detailsOpen && !ruleOpen} onOpenChange={setDetailsOpen}>
    <article className="pms-dashboard-metric pms-dashboard-metric-hover" tabIndex={0} aria-label={`${label}指标，悬停或聚焦查看费用详情`}>
      <div className="pms-dashboard-metric-heading"><h3>{label}</h3><MetricRule label={label} title={rule} onOpenChange={setRuleOpen} /></div>
      {children}
    </article>
  </Tooltip>
}

export default function ResourceDashboardMetrics({ sources, analyses, accounting, details, mode = 'labor' }: {
  sources: (DashboardSource | undefined)[]; analyses: (DashboardAnalysis | undefined)[]; accounting?: AccountingAnalysis; details: ResourceDepartmentDetails; mode?: 'labor' | 'cost'
}) {
  const unit = mode === 'labor' ? '人月' : '万元', alternate = mode === 'labor' ? 'cost' : 'labor'
  const amount = (value?: {labor?: number; cost?: number}) => <><div className="pms-dashboard-metric-value"><span>{format(value?.[mode], mode === 'cost' ? 2 : 1)}</span><small>{unit}</small></div><div className="pms-dashboard-metric-cost">{format(value?.[alternate], mode === 'labor' ? 2 : 1)} {mode === 'labor' ? '万元' : '人月'}</div></>
  const metrics = dashboardBusinessMetrics(analyses, accounting)
  const delta = mode === 'labor' ? metrics.laborDelta : metrics.costDelta
  const estimate = analyses[1]?.months.length ? analyses[1] : undefined
  const budget = analyses[2]?.months.length ? analyses[2] : undefined
  const actual = accounting?.months.length ? accounting : undefined
  const cumulative = details.cumulative
  const sourceLabel = DASHBOARD_BUDGETS.find(item => item.key === cumulative?.source.version.budgetType)?.label
  return <div className="pms-dashboard-metrics-scroll" role="group" aria-label="八项资源指标"><div className="pms-dashboard-eight-metrics">
    {DASHBOARD_BUDGETS.map((item, index) => {
      const source = sources[index], analysis = analyses[index]
      return <article className="pms-dashboard-metric" key={item.key} style={{ '--budget-color': item.color } as CSSProperties} aria-label={`${item.label}指标`}>
        <div className="pms-dashboard-metric-heading"><h3>{item.key === 'annual' ? '项目年度预算' : item.label}</h3>{source ? <span className="pms-dashboard-official-version" title={`${source.version.versionNumber} · 正式版本`}>{source.version.versionNumber}</span> : <MetricRule label={item.label} title="未设置唯一正式版本，未纳入分析" />}</div>
        {amount(analysis?.months.length ? analysis : undefined)}

      </article>
    })}
    <article className="pms-dashboard-metric" style={{ '--budget-color': RESOURCE_CHART_COLORS.cumulative } as CSSProperties} aria-label="累至今日预估投入指标">
      <div className="pms-dashboard-metric-heading"><h3>累至今日预估投入</h3><MetricRule label="累至今日预估投入" title={<div className="pms-dashboard-metric-breakdown"><span>{details.rangeStart ? `当前范围 ${details.rangeStart} 至 ${details.today}，沿用正式版本按自然日均摊的预估投入。` : cumulativeRule}</span><span>{cumulative ? `实际来源：${sourceLabel} ${cumulative.source.version.versionNumber} · 正式版本；截至 ${details.today}。` : '暂无可用的正式项目预算、项目概算或年度预算。'}</span>{cumulative?.issues.length ? <span>{cumulative.issues.join('；')}</span> : null}</div>} /></div>
      {amount(cumulative)}
    </article>
    <article className="pms-dashboard-metric" style={{ '--budget-color': RESOURCE_CHART_COLORS.actual } as CSSProperties} aria-label="项目核算指标">
      <div className="pms-dashboard-metric-heading"><h3>项目核算</h3><MetricRule label="项目核算" title="人天 ÷ 当月工作日" /></div>
      {amount(actual)}
    </article>
    <HoverMetric label="概算 → 预算偏差" rule="(项目预算-项目概算)/项目概算" costs={<>
      <span>费用偏差 {signed(metrics.costDelta?.percent)}%</span>
      <span>费用差 {signed(metrics.costDelta?.amount, 2)} 万元</span>
      <span>({format(budget?.cost, 2)} - {format(estimate?.cost, 2)}) / {format(estimate?.cost, 2)} 万元</span>
    </>}>
      <div className={`pms-dashboard-metric-value${(delta?.percent ?? 0) > 0 ? ' pms-resource-difference' : ''}`}><span>{signed(delta?.percent)}</span><small>% {unit}</small></div>
      <div className="pms-dashboard-metric-cost">{unit}差 {signed(delta?.amount)}</div>
    </HoverMetric>
    {([
      { key: 'toDate', label: '累至今日预算执行率', labor: details.total.toDateExecution, cost: details.total.toDateCostExecution, planned: cumulative, rule: '项目核算/累至今日预估投入' },
      { key: 'lifecycle', label: '全生命周期预算执行率', labor: details.total.lifecycleExecution, cost: details.total.lifecycleCostExecution, planned: budget, rule: '项目核算/项目预算' },
    ] as const).map(item => <HoverMetric key={item.key} label={item.label} rule={item.rule} costs={<>
      <span>费用执行率 {format(item.cost)}%</span>
      <span>{format(actual?.cost, 2)} / {format(item.planned?.cost, 2)} 万元</span>
    </>}>
      <div className={`pms-dashboard-metric-value${(item[mode] ?? 0) > 100 ? ' pms-resource-difference' : ''}`}><span>{format(item[mode])}</span><small>% {unit}</small></div>
      <div className="pms-dashboard-metric-cost">{format(actual?.[mode], 3)} / {format(item.planned?.[mode], 3)} {unit}</div>
    </HoverMetric>)}
  </div></div>
}
