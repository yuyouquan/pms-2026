'use client'
import { Empty, Table } from 'antd'
import { dashboardTrendSeries, type DashboardAnalysis } from '@/components/project-resources/resourceDashboardData'

export function DashboardTrend({ analyses, mode, cumulative }: { analyses: (DashboardAnalysis | undefined)[]; mode: 'labor' | 'cost'; cumulative: boolean }) {
  const { months, series } = dashboardTrendSeries(analyses, mode, cumulative)
  if (!months.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前筛选范围暂无月度计划" />
  const width = Math.max(740, months.length * 52), height = 228, left = 55, top = 24, baseline = 184
  const max = Math.max(1, ...series.flatMap(item => item.values.filter((value): value is number => value !== undefined)))
  const x = (index: number) => left + index * (width - left - 30) / Math.max(1, months.length - 1)
  const y = (value: number) => baseline - value / max * (baseline - top)
  const unit = mode === 'labor' ? '人月' : '万元'
  return <>
    <div className="pms-dashboard-legend">{series.map((item, index) => <span key={item.key}><i style={{ background: item.color }} />{item.label}{!analyses[index] && ' · 未纳入'}</span>)}</div>
    <div className="pms-dashboard-trend-scroll" tabIndex={0} aria-label="预算趋势，可横向滚动">
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width, minWidth: '100%' }} role="img" aria-label={`${cumulative ? '累计' : '月度'}${mode === 'labor' ? '人力投入' : '计划费用'}对比`}>
        <title>三类预算按相同月份分别比较，单位：{unit}。空缺数据不连线。</title>
        {[0, 1, 2, 3, 4].map(tick => { const value = max * tick / 4; return <g key={tick}><line x1={left} y1={y(value)} x2={width - 20} y2={y(value)} stroke="var(--pms-border)" strokeDasharray={tick ? '3 5' : undefined} /><text x={left - 8} y={y(value) + 4} textAnchor="end">{value.toFixed(mode === 'labor' ? 1 : 2)}</text></g> })}
        {months.map((month, index) => <text key={month} x={x(index)} y={209} textAnchor="middle">{month.slice(2)}</text>)}
        {series.map(item => {
          const path = item.values.map((value, index) => value === undefined ? '' : `${index && item.values[index - 1] !== undefined ? 'L' : 'M'}${x(index)},${y(value)}`).join(' ')
          return <g key={item.key}><path d={path} fill="none" stroke={item.color} strokeWidth="2.5" />{item.values.map((value, index) => value === undefined ? null : <circle key={months[index]} cx={x(index)} cy={y(value)} r="3.5" fill={item.color}><title>{item.label} · {months[index]}：{value.toFixed(mode === 'labor' ? 1 : 2)} {unit}</title></circle>)}</g>
        })}
      </svg>
    </div>
    <details className="pms-dashboard-trend-detail"><summary>查看{cumulative ? '累计' : '月度'}明细（{unit}）</summary>
      <Table className="pms-table" size="small" rowKey="month" pagination={false} scroll={{ x: 580, y: 260 }}
        columns={[{ title: '月份', dataIndex: 'month' }, ...series.map(item => ({ title: item.label, dataIndex: item.key, align: 'right' as const, render: (value: number | undefined) => value === undefined ? '—' : value.toFixed(mode === 'labor' ? 1 : 2) }))]}
        dataSource={months.map((month, index) => ({ month, ...Object.fromEntries(series.map(item => [item.key, item.values[index]])) }))} />
    </details>
  </>
}

export function DashboardCostMix({ analysis }: { analysis: DashboardAnalysis }) {
  if (!analysis.months.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="所选年份暂无费用计划" />
  const items = [{ name: '人力费用', value: analysis.laborCost, color: '#6b50dc' }, { name: '非人力费用', value: analysis.nonLaborYuan / 10000, color: '#26a8a1' }]
  const circumference = 2 * Math.PI * 54
  let offset = 0
  return <div className="pms-dashboard-cost-mix">
    <svg viewBox="0 0 152 152" role="img" aria-label={`费用构成：人力 ${analysis.laborCost.toFixed(2)} 万元，非人力 ${(analysis.nonLaborYuan / 10000).toFixed(2)} 万元`}>
      <circle cx="76" cy="76" r="54" fill="none" stroke="var(--pms-border)" strokeWidth="13" />
      {items.map(item => { const length = analysis.cost > 0 ? item.value / analysis.cost * circumference : 0, start = offset; offset += length; return <circle key={item.name} cx="76" cy="76" r="54" fill="none" stroke={item.color} strokeWidth="13" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-start} transform="rotate(-90 76 76)" /> })}
      <text x="76" y="72" textAnchor="middle" className="pms-dashboard-donut-value">{analysis.cost.toFixed(2)}</text><text x="76" y="94" textAnchor="middle">万元</text>
    </svg>
    <div>{items.map(item => <div className="pms-dashboard-mix-item" key={item.name}><span><i style={{ background: item.color }} />{item.name}</span><strong>{item.value.toFixed(2)} <small>万元</small></strong><span>{analysis.cost > 0 ? (item.value / analysis.cost * 100).toFixed(1) : '0.0'}%</span></div>)}</div>
  </div>
}

export function DashboardStageBars({ analysis }: { analysis: DashboardAnalysis }) {
  if (!analysis.months.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="所选年份暂无阶段投入" />
  return <div className="pms-dashboard-stage-bars">{analysis.stages.map(stage => <div className="pms-dashboard-stage-row" key={stage.key}>
    <div><span>{stage.label}</span><strong>{stage.amount.toFixed(1)} <small>人月</small><em>{stage.ratio.toFixed(1)}%</em></strong></div>
    <div className="pms-dashboard-bar-track"><span style={{ width: `${Math.min(100, Math.max(0, stage.ratio))}%`, background: stage.color }} /></div>
  </div>)}</div>
}
