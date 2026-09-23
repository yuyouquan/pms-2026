'use client'
import { Empty, Table } from 'antd'
import { useEffect, useRef, useState } from 'react'
import type { DashboardBusinessTrend } from '@/components/project-resources/resourceDashboardBusiness'

const labelWidth = (label: string) => Array.from(label).reduce((width, character) => width + (/[^\x00-\x7F]/.test(character) ? 11 : 6.5), 0)
function fitLabel(label: string, width: number) {
  if (labelWidth(label) <= width) return label
  let result = ''
  for (const character of label) {
    if (labelWidth(`${result}${character}…`) > width) break
    result += character
  }
  return `${result}…`
}

export default function ResourceBusinessTrend({ trend }: { trend: DashboardBusinessTrend }) {
  const { periods, labels, series, mode, grain } = trend
  const container = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const hasPeriods = periods.length > 0
  useEffect(() => {
    const element = container.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [hasPeriods])
  if (!hasPeriods) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前筛选范围暂无趋势数据" />
  const grainLabel = grain === 'stage' ? '阶段' : grain === 'week' ? '周度' : '月度'
  const width = containerWidth || 820, height = 248, top = 22, baseline = 198
  const max = Math.max(1, ...series.flatMap(item => item.values.filter((value): value is number => value !== undefined)))
  const left = Math.max(48, labelWidth(max.toFixed(mode === 'labor' ? 1 : 2)) + 12), right = 20
  const plotWidth = Math.max(1, width - left - right)
  const x = (index: number) => periods.length === 1 ? left + plotWidth / 2 : left + index * plotWidth / (periods.length - 1)
  const y = (value: number) => baseline - value / max * (baseline - top)
  const unit = mode === 'labor' ? '人月' : '万元', precision = mode === 'labor' ? 3 : 2
  const axisLabels = periods.map((period, index) => grain === 'stage' ? labels[index] : grain === 'week' ? period.slice(5) : period.slice(2))
  const labelSpacing = grain === 'stage' ? Math.min(150, Math.max(80, ...axisLabels.map(label => labelWidth(label) + 24))) : grain === 'week' ? 76 : 64
  const labelCount = Math.min(periods.length, Math.max(2, Math.floor(plotWidth / labelSpacing) + 1))
  const tickWidth = plotWidth / Math.max(1, labelCount - 1) * 0.62
  const axisTicks = axisLabels.map((label, index) => {
    const text = fitLabel(label, tickWidth)
    const textWidth = Math.max(labelWidth(text), grain === 'week' ? labelWidth(periods[index].slice(0, 4)) : 0)
    const start = periods.length === 1 ? x(index) - textWidth / 2 : index === 0 ? x(index) : index === periods.length - 1 ? x(index) - textWidth : x(index) - textWidth / 2
    return { text, start, end: start + textWidth }
  })
  const visibleLabels = new Set([0, periods.length - 1])
  const minimumLabelGap = 12
  let previousLabelEnd = axisTicks[0].end
  const lastLabelStart = axisTicks[periods.length - 1].start
  // Reserve the end label before greedily placing intermediate labels by their anchored bounds.
  for (let index = 1; index < periods.length - 1; index += 1) {
    const tick = axisTicks[index]
    if (tick.start >= previousLabelEnd + minimumLabelGap && tick.end <= lastLabelStart - minimumLabelGap) {
      visibleLabels.add(index)
      previousLabelEnd = tick.end
    }
  }
  return <>
    <div className="pms-dashboard-legend">{series.map(item => <span key={item.key}><i style={{ background: item.color }} />{item.label}{!item.included && ' · 未纳入'}</span>)}</div>
    <div ref={container} className="pms-dashboard-business-trend" aria-label="四类投入趋势">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label={`四类${grainLabel}${unit}趋势`}>
        <title>年度预算、概算、预算、核算分别比较，单位：{unit}。无来源或超出来源覆盖期间的数据不补零，不连线。</title>
        {[0, 1, 2, 3, 4].map(tick => { const value = max * tick / 4; return <g key={tick}><line x1={left} y1={y(value)} x2={width - right} y2={y(value)} stroke="var(--pms-border)" strokeDasharray={tick ? '3 5' : undefined} /><text x={left - 8} y={y(value) + 4} textAnchor="end">{value.toFixed(mode === 'labor' ? 1 : 2)}</text></g> })}
        {periods.map((period, index) => {
          if (!visibleLabels.has(index)) return null
          const anchor = periods.length === 1 ? 'middle' : index === 0 ? 'start' : index === periods.length - 1 ? 'end' : 'middle'
          return <g key={period}><text x={x(index)} y={220} textAnchor={anchor}><title>{labels[index]}</title>{axisTicks[index].text}</text>{grain === 'week' && <text x={x(index)} y={236} textAnchor={anchor}>{period.slice(0, 4)}</text>}</g>
        })}
        {series.map((item, seriesIndex) => <g key={item.key}><path d={item.values.map((value, index) => value === undefined ? '' : `${index && item.values[index - 1] !== undefined ? 'L' : 'M'}${x(index)},${y(value)}`).join(' ')} fill="none" stroke={item.color} strokeWidth="2.2" strokeDasharray={seriesIndex === 0 ? '5 3' : undefined} />{item.values.map((value, index) => value === undefined ? null : <circle key={periods[index]} cx={x(index)} cy={y(value)} r="3" fill={item.color}><title>{item.label} · {labels[index]}：{value.toFixed(precision)} {unit}</title></circle>)}</g>)}
      </svg>
    </div>
    <details className="pms-dashboard-trend-detail"><summary>查看{grainLabel}趋势明细（{unit}）</summary>
      <Table className="pms-table pms-dashboard-trend-table" size="small" rowKey="period" tableLayout="fixed" pagination={{ pageSize: 12, showSizeChanger: false }}
        dataSource={periods.map((period, index) => ({ period, label: labels[index], ...Object.fromEntries(series.map(item => [item.key, item.values[index]])) }))}
        columns={[{ title: grain === 'stage' ? '阶段' : grain === 'week' ? '周一～周日' : '月份', dataIndex: 'label', width: grain === 'week' ? '30%' : '20%' }, ...series.map(item => ({ title: item.label, dataIndex: item.key, align: 'right' as const, render: (value: number | undefined) => value === undefined ? '—' : value.toFixed(precision) }))]} />
    </details>
  </>
}
