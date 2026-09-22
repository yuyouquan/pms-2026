'use client'
import { Empty, Table } from 'antd'
import type { DashboardBusinessTrend } from '@/components/project-resources/resourceDashboardBusiness'
export default function ResourceBusinessTrend({ trend }: { trend: DashboardBusinessTrend }) {
  const { periods, labels, series, mode, grain } = trend
  if (!periods.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前筛选范围暂无趋势数据" />
  const width = Math.max(820, periods.length * (grain === 'week' ? 72 : 64)), height = 248, left = 64, top = 22, baseline = 198
  const max = Math.max(1, ...series.flatMap(item => item.values.filter((value): value is number => value !== undefined)))
  const x = (index: number) => left + index * (width - left - 42) / Math.max(1, periods.length - 1)
  const y = (value: number) => baseline - value / max * (baseline - top)
  const unit = mode === 'labor' ? '人月' : '万元', precision = mode === 'labor' ? 3 : 2
  return <>
    <div className="pms-dashboard-legend">{series.map(item => <span key={item.key}><i style={{ background: item.color }} />{item.label}{!item.included && ' · 未纳入'}</span>)}</div>
    <div className="pms-dashboard-trend-scroll pms-dashboard-business-trend" tabIndex={0} aria-label="四类投入趋势，可横向滚动">
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width, minWidth: '100%' }} role="img" aria-label={`四类${grain === 'week' ? '周度' : '月度'}${unit}趋势`}>
        <title>年度预算、概算、预算、核算分别比较，单位：{unit}。无来源或超出来源覆盖期间的数据不补零，不连线。</title>
        {[0, 1, 2, 3, 4].map(tick => { const value = max * tick / 4; return <g key={tick}><line x1={left} y1={y(value)} x2={width - 24} y2={y(value)} stroke="var(--pms-border)" strokeDasharray={tick ? '3 5' : undefined} /><text x={left - 8} y={y(value) + 4} textAnchor="end">{value.toFixed(mode === 'labor' ? 1 : 2)}</text></g> })}
        {periods.map((period, index) => <g key={period}><text x={x(index)} y={220} textAnchor="middle">{grain === 'week' ? period.slice(5) : period.slice(2)}</text>{grain === 'week' && <text x={x(index)} y={236} textAnchor="middle">{period.slice(0, 4)}</text>}</g>)}
        {series.map((item, seriesIndex) => <g key={item.key}><path d={item.values.map((value, index) => value === undefined ? '' : `${index && item.values[index - 1] !== undefined ? 'L' : 'M'}${x(index)},${y(value)}`).join(' ')} fill="none" stroke={item.color} strokeWidth="2.2" strokeDasharray={seriesIndex === 0 ? '5 3' : undefined} />{item.values.map((value, index) => value === undefined ? null : <circle key={periods[index]} cx={x(index)} cy={y(value)} r="3" fill={item.color}><title>{item.label} · {labels[index]}：{value.toFixed(precision)} {unit}</title></circle>)}</g>)}
      </svg>
    </div>
    <details className="pms-dashboard-trend-detail"><summary>查看{grain === 'week' ? '周度' : '月度'}趋势明细（{unit}）</summary>
      <Table className="pms-table" size="small" rowKey="period" pagination={{ pageSize: 12, showSizeChanger: false }} scroll={{ x: 760 }}
        dataSource={periods.map((period, index) => ({ period, label: labels[index], ...Object.fromEntries(series.map(item => [item.key, item.values[index]])) }))}
        columns={[{ title: grain === 'week' ? '周一～周日' : '月份', dataIndex: 'label', width: grain === 'week' ? 220 : 120 }, ...series.map(item => ({ title: item.label, dataIndex: item.key, align: 'right' as const, render: (value: number | undefined) => value === undefined ? '—' : value.toFixed(precision) }))]} />
    </details>
  </>
}
