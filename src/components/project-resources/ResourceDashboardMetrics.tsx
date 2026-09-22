'use client'
import { Button, Select, Tag, Tooltip } from 'antd'
import { ArrowRightOutlined, InfoCircleOutlined } from '@ant-design/icons'
import type { CSSProperties } from 'react'
import { DASHBOARD_BUDGETS, type DashboardAnalysis, type DashboardSource } from '@/components/project-resources/resourceDashboardData'
import { dashboardBusinessMetrics } from '@/components/project-resources/resourceDashboardBusiness'
import { resourceProjectName } from '@/components/project-resources/resourceVersionAdapter'
import type { AccountingAnalysis } from '@/components/project-resources/resourceAccounting'
import type { ResourceBudgetType } from '@/components/project-resources/resourceVersionViewData'
const format = (value: number | undefined, precision = 1) => value === undefined ? '—' : value.toLocaleString('zh-CN', { minimumFractionDigits: precision, maximumFractionDigits: precision })
const signed = (value: number | undefined, precision = 1) => value === undefined ? '—' : `${value > 0 ? '+' : ''}${format(value, precision)}`
export default function ResourceDashboardMetrics({ available, sources, analyses, accounting, selected, onSelect, onOpenVersion }: {
  available: DashboardSource[][]; sources: (DashboardSource | undefined)[]; analyses: (DashboardAnalysis | undefined)[]; accounting?: AccountingAnalysis
  selected: Partial<Record<ResourceBudgetType, string>>; onSelect: (type: ResourceBudgetType, id?: string) => void
  onOpenVersion: (type: ResourceBudgetType, versionId?: string) => void
}) {
  const metrics = dashboardBusinessMetrics(analyses, accounting)
  const budget = analyses[2]?.months.length ? analyses[2] : undefined
  const actual = accounting?.months.length ? accounting : undefined
  return <div className="pms-dashboard-metrics-scroll" tabIndex={0} aria-label="六项资源指标，可横向滚动"><div className="pms-dashboard-six-metrics">
    {DASHBOARD_BUDGETS.map((item, index) => {
      const source = sources[index], analysis = analyses[index], officials = available[index].filter(entry => entry.version.isActive)
      return <article className="pms-dashboard-metric" key={item.key} style={{ '--budget-color': item.color } as CSSProperties} aria-label={`${item.label}指标`}>
        <div className="pms-dashboard-metric-heading"><h3>{item.key === 'annual' ? '项目年度预算' : item.label}</h3>{source && <span className={`pms-dashboard-lock-state${source.version.lockState === 'locked' ? ' is-locked' : ''}`}>{source.version.lockState === 'locked' ? '已锁定' : '未锁定'}</span>}</div>
        <div className="pms-dashboard-metric-value">{format(analysis?.months.length ? analysis.labor : undefined)} <small>人月</small></div>
        <div className="pms-dashboard-metric-cost">{format(analysis?.months.length ? analysis.cost : undefined, 2)} 万元</div>
        <Select size="small" aria-label={`${item.label}分析版本`} value={selected[item.key] ?? '__official__'} onChange={id => onSelect(item.key, id === '__official__' ? undefined : id)}
          options={[{ value: '__official__', label: officials.length === 1 ? `${officials[0].version.versionNumber} · 正式版本` : officials.length ? '正式版本冲突，请选择' : '未设置正式版本' }, ...available[index].map(entry => ({ value: entry.version.id, label: `${entry.version.versionNumber} · ${entry.version.isActive ? '正式' : '分析'} · ${resourceProjectName(entry.owner)}` }))]} />
        <div className="pms-dashboard-metric-footer">{source ? <Button size="small" type="link" onClick={() => onOpenVersion(item.key, source.version.id)}>查看来源版本 <ArrowRightOutlined /></Button>
          : <span>{selected[item.key] ? '所选版本不可用，请重选' : '未纳入，可手动选择版本'}</span>}</div>
      </article>
    })}
    <article className="pms-dashboard-metric" style={{ '--budget-color': '#31976c' } as CSSProperties} aria-label="项目核算指标">
      <div className="pms-dashboard-metric-heading"><h3>项目核算</h3><Tag color="green">Mock</Tag></div>
      <div className="pms-dashboard-metric-value">{format(actual?.labor)} <small>人月</small></div>
      <div className="pms-dashboard-metric-cost">{format(actual?.cost, 2)} 万元</div>
      <span className="pms-dashboard-metric-caption">人天 ÷ 当月工作日</span>
      <div className="pms-dashboard-metric-footer">{accounting ? `模拟核算截至 ${accounting.dataset.endDate}` : '暂无核算数据'}</div>
    </article>
    <article className="pms-dashboard-metric" aria-label="概算到预算偏差指标">
      <div className="pms-dashboard-metric-heading"><h3>概算 → 预算偏差</h3><Tooltip title="（项目预算费用－项目概算费用）÷ 项目概算费用；分母为零或缺失时不计算。"><InfoCircleOutlined /></Tooltip></div>
      <div className={`pms-dashboard-metric-value${(metrics.costDelta?.percent ?? 0) > 0 ? ' pms-resource-difference' : ''}`}>{signed(metrics.costDelta?.percent)}<small> %</small></div>
      <div className="pms-dashboard-metric-cost">费用差 {signed(metrics.costDelta?.amount, 2)} 万元</div>
      <span className="pms-dashboard-metric-caption">人月差 {signed(metrics.laborDelta?.amount)}</span>
      <div className="pms-dashboard-metric-footer">费用口径 ·（预算－概算）/ 概算</div>
    </article>
    <article className="pms-dashboard-metric" aria-label="预算执行率指标">
      <div className="pms-dashboard-metric-heading"><h3>预算执行率</h3><Tooltip title="项目核算费用 ÷ 项目预算费用；使用当前部门及日期筛选。分母为零或缺失时不计算。"><InfoCircleOutlined /></Tooltip></div>
      <div className={`pms-dashboard-metric-value${(metrics.execution ?? 0) > 100 ? ' pms-resource-difference' : ''}`}>{format(metrics.execution)}<small> %</small></div>
      <div className="pms-dashboard-metric-cost">{format(actual?.cost, 2)} / {format(budget?.cost, 2)} 万元</div>
      <span className="pms-dashboard-metric-caption">{format(actual?.labor)} / {format(budget?.labor)} 人月</span>
      <div className="pms-dashboard-metric-footer">费用口径 · 核算 / 预算</div>
    </article>
  </div></div>
}
