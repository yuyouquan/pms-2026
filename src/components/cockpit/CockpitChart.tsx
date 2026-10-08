'use client'
import { useId, useMemo, useState } from 'react'
import type { CockpitMode } from '@/components/cockpit/cockpitData'
import { formatCockpit } from '@/components/cockpit/cockpitData'

type Series = { key: string; label: string; color: string; values: (number | undefined)[] }
/** Monotone cubic interpolation avoids negative overshoot in non-negative investment series. */
export function smoothCockpitPath(points: { x: number; y: number }[]) {
  if (!points.length) return ''
  let path = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], middle = (a.x + b.x) / 2
    path += ` C ${middle} ${a.y}, ${middle} ${b.y}, ${b.x} ${b.y}`
  }
  return path
}
export default function CockpitChart({ periods, series, mode, bars, grain }: {
  periods: string[]; series: readonly Series[]; mode: CockpitMode; bars: boolean; grain: 'month' | 'week'
}) {
  const uid = useId().replaceAll(':', ''), [hidden, setHidden] = useState<string[]>([]), [active, setActive] = useState<number>()
  const visible = series.filter(item => !hidden.includes(item.key))
  const width = Math.max(760, periods.length * (bars ? 30 : 50)), height = 270, left = 48, right = width - 18, top = 24, bottom = 224
  const peak = Math.max(1, ...periods.map((_, i) => bars ? visible.reduce((sum, item) => sum + (item.values[i] ?? 0), 0) : Math.max(0, ...visible.map(item => item.values[i] ?? 0))))
  const maximum = Math.ceil(peak / 4 / Math.pow(10, Math.floor(Math.log10(peak / 4)))) * Math.pow(10, Math.floor(Math.log10(peak / 4))) * 4
  const x = (i: number) => left + (i + 0.5) * (right - left) / Math.max(1, periods.length)
  const y = (value: number) => bottom - value / maximum * (bottom - top)
  const hasData = visible.some(item => item.values.some(value => value !== undefined))
  const paths = useMemo(() => visible.map(item => {
    const groups: { x: number; y: number }[][] = [[]]
    item.values.forEach((value, i) => value === undefined ? groups.push([]) : groups[groups.length - 1].push({ x: x(i), y: y(value) }))
    return { ...item, groups: groups.filter(group => group.length) }
  // Scale and source values are deterministic for this render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [series, hidden, width, maximum])
  const label = (period: string) => grain === 'week' && bars ? `${period.slice(5)}周` : `${period.slice(5)}月`
  return <div className="cockpit-chart">
    <div className="cockpit-chart-meta"><span>{mode === 'labor' ? '投入 · 人月' : '费用 · 万元'}</span><div className="cockpit-legend" aria-label="图例">
      {series.map(item => <button key={item.key} type="button" aria-pressed={!hidden.includes(item.key)} className={hidden.includes(item.key) ? 'is-muted' : ''}
        onClick={() => setHidden(current => current.includes(item.key) ? current.filter(key => key !== item.key) : [...current, item.key])}><i style={{ background: item.color }} />{item.label}</button>)}
    </div></div>
    <div className="cockpit-chart-scroll" tabIndex={0} aria-label="趋势图，可横向滚动">
      <svg viewBox={`0 0 ${width} ${height}`} style={{ minWidth: periods.length > 24 ? width : undefined }} role="img" aria-label={`${bars ? '项目分类投入柱状图' : '资源管道总趋势折线图'}，${periods.length} 个期间`}>
        <defs>{visible.map(item => <linearGradient key={item.key} id={`${uid}-${item.key}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={item.color} stopOpacity=".16" /><stop offset="100%" stopColor={item.color} stopOpacity="0" /></linearGradient>)}</defs>
        {[0, 1, 2, 3, 4].map(tick => <g key={tick}><line x1={left} x2={right} y1={y(maximum * tick / 4)} y2={y(maximum * tick / 4)} stroke="#e9edf3" strokeDasharray={tick ? '3 5' : undefined} /><text x={left - 10} y={y(maximum * tick / 4) + 4} textAnchor="end" className="cockpit-axis">{formatCockpit(maximum * tick / 4, maximum < 4 ? 1 : 0)}</text></g>)}
        {!bars && paths.map(item => <g key={item.key}>{item.groups.map((points, i) => <g key={i}>
          <path d={`${smoothCockpitPath(points)} L ${points.at(-1)!.x} ${bottom} L ${points[0].x} ${bottom} Z`} fill={`url(#${uid}-${item.key})`} />
          <path className="cockpit-line" d={smoothCockpitPath(points)} stroke={item.color} fill="none" strokeWidth="2.5" pathLength="1" />
          {points.length === 1 && <circle cx={points[0].x} cy={points[0].y} r="3" fill={item.color} />}
        </g>)}</g>)}
        {bars && periods.map((_, i) => {
          let total = 0
          return <g key={i}>{visible.map(item => {
            const value = item.values[i] ?? 0, previous = total; total += value
            return <rect key={item.key} className="cockpit-bar" x={x(i) - Math.min(11, (right - left) / periods.length / 3)} y={y(total)} width={Math.min(22, (right - left) / periods.length * .65)} height={y(previous) - y(total)} rx="2" fill={item.color} />
          })}</g>
        })}
        {periods.map((period, i) => <g key={period}>
          {(periods.length <= 18 || i % Math.ceil(periods.length / 14) === 0) && <text className="cockpit-axis" x={x(i)} y={249} textAnchor="middle">{label(period)}</text>}
          <rect x={x(i) - (right - left) / periods.length / 2} y={top} width={(right - left) / periods.length} height={bottom - top} fill="transparent" tabIndex={0} role="button"
            aria-label={`${period}，${visible.map(item => `${item.label} ${formatCockpit(item.values[i])}`).join('，')}`}
            onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(undefined)} onFocus={() => setActive(i)} onBlur={() => setActive(undefined)} />
        </g>)}
        {active !== undefined && <g pointerEvents="none"><line x1={x(active)} x2={x(active)} y1={top} y2={bottom} stroke="#b3bcca" strokeDasharray="4 4" />{!bars && visible.map(item => item.values[active] !== undefined && <circle key={item.key} cx={x(active)} cy={y(item.values[active]!)} r="4" stroke="white" strokeWidth="2" fill={item.color} />)}</g>}
      </svg>
      {!hasData && <div className="cockpit-chart-empty">{visible.length ? '所选范围暂无可用数据' : '点击图例显示趋势'}<small>调整日期或部门范围后查看</small></div>}
    </div>
    <div className={`cockpit-chart-readout${active === undefined ? '' : ' is-active'}`} aria-live="polite">
      {active === undefined ? <span>悬停或聚焦图表查看期间明细 · 点击图例切换系列</span> : <><strong>{periods[active]}</strong>{visible.map(item => <span key={item.key}><i style={{ background: item.color }} />{item.label} <b>{formatCockpit(item.values[active])}</b></span>)}</>}
    </div>
  </div>
}
