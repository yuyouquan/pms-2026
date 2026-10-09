'use client'
import { useMemo, useState } from 'react'
import { ArrowRightOutlined, PushpinOutlined } from '@ant-design/icons'
import { cockpitTrendPeriodRange } from '@/components/cockpit/cockpitTrendInteraction'
import { formatCockpit, type CockpitMode } from '@/components/cockpit/cockpitData'
import CockpitEChart from '@/components/cockpit/CockpitEChart'
import { cockpitColors, cockpitTrendOption, type CockpitSeries } from '@/components/cockpit/cockpitChartOptions'

export default function CockpitChart({ periods, series, mode, bars, grain, dates, hidden, onHiddenChange, onInspectPeriod }: {
  periods: string[]; series: readonly CockpitSeries[]; mode: CockpitMode; bars: boolean; grain: 'month' | 'week'; dates: [string, string]
  hidden: string[]; onHiddenChange: (keys: string[]) => void; onInspectPeriod: (period: string) => void
}) {
  const [focused, setFocused] = useState<number>(), [pinned, setPinned] = useState<number>()
  const active = pinned ?? focused
  const period = active === undefined ? undefined : periods[active]
  const selectedRange = period && pinned !== undefined ? cockpitTrendPeriodRange(period, grain, dates) : undefined
  const alreadyInRange = !!selectedRange && selectedRange[0] === dates[0] && selectedRange[1] === dates[1]
  const option = useMemo(() => cockpitTrendOption(periods, series, hidden, bars, mode), [periods, series, hidden, bars, mode])
  const visible = series.filter(item => !hidden.includes(item.key))
  const hasData = visible.some(item => item.values.some(value => value !== undefined))
  return <div className="cockpit-chart">
    <div className="cockpit-chart-meta"><span>{mode === 'labor' ? '人月' : '万元'}</span><div className="cockpit-legend" aria-label="图例">
      {series.map((item, index) => <button key={item.key} type="button" aria-pressed={!hidden.includes(item.key)} className={hidden.includes(item.key) ? 'is-muted' : ''}
        onClick={() => onHiddenChange(hidden.includes(item.key) ? hidden.filter(key => key !== item.key) : [...hidden, item.key])}><i style={{ background: cockpitColors[index % cockpitColors.length] }} />{item.label}</button>)}
    </div>{hidden.length > 0 && <button type="button" className="cockpit-text-button cockpit-legend-reset" onClick={() => onHiddenChange([])}>显示全部系列</button>}</div>
    <div className="cockpit-trend-graphic">
      <CockpitEChart option={option} label={`${bars ? '项目分类投入柱状图' : '资源管道总趋势折线图'}，${periods.length} 个期间。方向键浏览，Enter 固定，Esc 取消。`} tabIndex={0} activeIndex={active}
        onSelect={index => { setPinned(index); setFocused(index) }}
        onKeyDown={event => {
          if (!periods.length) return
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
            event.preventDefault()
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? periods.length - 1 : active === undefined ? 0 : Math.max(0, Math.min(periods.length - 1, active + (event.key === 'ArrowRight' ? 1 : -1)))
            setFocused(next); if (pinned !== undefined) setPinned(next)
          } else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setPinned(active ?? 0); setFocused(active ?? 0) }
          else if (event.key === 'Escape') { event.preventDefault(); setPinned(undefined); setFocused(undefined) }
        }} />
      {!hasData && <div className="cockpit-graphic-empty">{visible.length ? '暂无可用数据' : '暂无选中系列'}</div>}
    </div>
    {period && <div className="cockpit-chart-readout is-active" aria-live="polite"><strong>{period}</strong>{visible.map(item => <span key={item.key}>{item.label} <b>{formatCockpit(item.values[active!])}</b></span>)}</div>}
    {pinned !== undefined && selectedRange && period && <div className="cockpit-trend-selection" aria-label="已固定期间"><span><PushpinOutlined /><b>{selectedRange[0]} 至 {selectedRange[1]}</b></span><div><button type="button" className="cockpit-text-button" onClick={() => { setPinned(undefined); setFocused(undefined) }}>取消固定</button><button type="button" className="cockpit-period-inspect" disabled={alreadyInRange} onClick={() => onInspectPeriod(period)}>{alreadyInRange ? '已在该期间' : '查看该期间'}<ArrowRightOutlined /></button></div></div>}
  </div>
}
