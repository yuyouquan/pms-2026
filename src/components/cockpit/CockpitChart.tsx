'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeftOutlined, ArrowRightOutlined, PushpinOutlined } from '@ant-design/icons'
import { cockpitTrendPeriodRange } from '@/components/cockpit/cockpitTrendInteraction'
import { formatCockpit, type CockpitMode } from '@/components/cockpit/cockpitData'
import CockpitEChart from '@/components/cockpit/CockpitEChart'
import { cockpitCategoryRows, cockpitTrendOption, type CockpitSeries } from '@/components/cockpit/cockpitChartOptions'
import { cockpitCurrentPeriod, cockpitInitialPeriodIndex, cockpitPeriodLabel, cockpitPeriodScrollLeft, cockpitPeriodWindow } from '@/components/cockpit/cockpitChartPresentation'
import { useCockpitReducedMotion } from '@/components/cockpit/useCockpitMotion'

export default function CockpitChart({ periods, series, mode, bars, grain, dates, today, hidden, onHiddenChange, onInspectPeriod }: {
  periods: string[]; series: readonly CockpitSeries[]; mode: CockpitMode; bars: boolean; grain: 'month' | 'week'; dates: [string, string]; today: string
  hidden: string[]; onHiddenChange: (keys: string[]) => void; onInspectPeriod: (period: string) => void
}) {
  const [focused, setFocused] = useState<number>(), [pinned, setPinned] = useState<number>()
  const active = pinned ?? focused
  const initialIndex = cockpitInitialPeriodIndex(periods, today, grain)
  const scroll = useRef<HTMLDivElement>(null), reduced = useCockpitReducedMotion()
  const [visibleWindow, setVisibleWindow] = useState(() => cockpitPeriodWindow(periods.length, 12, initialIndex))
  const navigationIndex = active ?? Math.max(visibleWindow.start, Math.min(visibleWindow.end, initialIndex))
  const period = active === undefined ? undefined : periods[active]
  const selectedRange = period && pinned !== undefined ? cockpitTrendPeriodRange(period, grain, dates) : undefined
  const alreadyInRange = !!selectedRange && selectedRange[0] === dates[0] && selectedRange[1] === dates[1]
  const current = cockpitCurrentPeriod(periods, { today, dates, grain })
  const option = useMemo(() => cockpitTrendOption(periods, series, hidden, bars, mode, { today, dates, grain }), [periods, series, hidden, bars, mode, today, dates, grain])
  const visible = series.filter(item => !hidden.includes(item.key))
  const hasData = visible.some(item => item.values.some(value => value !== undefined))
  const rows = cockpitCategoryRows(series.length, periods.length > 12)
  const toggleSeries = (key: string) => onHiddenChange(hidden.includes(key) ? hidden.filter(item => item !== key) : [...hidden, key])
  const selectPeriod = (index: number) => { setFocused(index); if (pinned !== undefined) setPinned(index) }
  useEffect(() => {
    const viewport = scroll.current
    if (!bars || !viewport) return
    const reveal = (behavior: ScrollBehavior) => {
      viewport.scrollTo({ left: cockpitPeriodScrollLeft(viewport.scrollWidth, viewport.clientWidth, navigationIndex, visibleWindow), behavior })
    }
    reveal(active === undefined || reduced ? 'auto' : 'smooth')
    const observer = new ResizeObserver(() => reveal('auto'))
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [bars, navigationIndex, active, reduced, visibleWindow])
  return <div className={`cockpit-chart${bars ? ' cockpit-category-chart' : ''}`}>
    <div className="cockpit-chart-meta"><span>{mode === 'labor' ? '人月' : '万元'}</span>{!bars && <div className="cockpit-legend" aria-label="图例">
      {series.map(item => <button key={item.key} type="button" aria-pressed={!hidden.includes(item.key)} className={hidden.includes(item.key) ? 'is-muted' : ''}
        onClick={() => toggleSeries(item.key)}><i style={{ background: item.color }} />{item.label}</button>)}
    </div>}{current && <span className="cockpit-current-cutoff">{current.label}</span>}{hidden.length > 0 && <button type="button" className="cockpit-text-button cockpit-legend-reset" onClick={() => onHiddenChange([])}>显示全部系列</button>}</div>
    {bars && <div className="cockpit-period-navigation" role="group" aria-label="趋势期间切换">
      <button type="button" disabled={!periods.length || navigationIndex === 0} onClick={() => selectPeriod(Math.max(0, navigationIndex - 1))}><ArrowLeftOutlined />{grain === 'month' ? '上一月' : '上一周'}</button>
      <strong aria-live="polite">{cockpitPeriodLabel(periods[navigationIndex], grain)}</strong>
      <button type="button" disabled={!periods.length || navigationIndex === periods.length - 1} onClick={() => selectPeriod(Math.min(periods.length - 1, navigationIndex + 1))}>{grain === 'month' ? '下一月' : '下一周'}<ArrowRightOutlined /></button>
    </div>}
    <div className="cockpit-trend-graphic">
      {bars && rows.slice(0, -1).map((row, index) => <span key={index} className="cockpit-category-divider" aria-hidden="true" style={{ top: `${row.top + row.height + 3}%` }} />)}
      {bars && <div className="cockpit-category-labels" aria-label="项目分类显示">
        {series.map((item, index) => <button key={item.key} type="button" aria-pressed={!hidden.includes(item.key)} aria-label={`${hidden.includes(item.key) ? '显示' : '隐藏'}${item.label}`}
          style={{ top: `${rows[index].top + rows[index].height / 2}%` }} onClick={() => toggleSeries(item.key)}>{item.label}</button>)}
      </div>}
      <div ref={scroll} className={bars ? 'cockpit-category-scroll' : undefined}>
      <CockpitEChart option={option} label={`${bars ? '项目分类投入分行柱状图' : '资源管道总趋势折线图'}，${periods.length} 个期间。方向键浏览，Enter 固定，Esc 取消。`} tabIndex={0} activeIndex={active}
        onPeriodWindowChange={window => setVisibleWindow(previous => previous.start === window.start && previous.end === window.end ? previous : window)}
        onSelect={index => { setPinned(index); setFocused(index) }}
        onKeyDown={event => {
          if (!periods.length) return
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
            event.preventDefault()
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? periods.length - 1 : Math.max(0, Math.min(periods.length - 1, navigationIndex + (event.key === 'ArrowRight' ? 1 : -1)))
            selectPeriod(next)
          } else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setPinned(navigationIndex); setFocused(navigationIndex) }
          else if (event.key === 'Escape') { event.preventDefault(); setPinned(undefined); setFocused(undefined) }
        }} />
      </div>
      {!hasData && <div className="cockpit-graphic-empty">{visible.length ? '暂无可用数据' : '暂无选中系列'}</div>}
    </div>
    {period && <div className="cockpit-chart-readout is-active" aria-live="polite"><strong>{period}</strong>{visible.map(item => <span key={item.key}>{item.label} <b>{formatCockpit(item.values[active!])}</b></span>)}</div>}
    {pinned !== undefined && selectedRange && period && <div className="cockpit-trend-selection" aria-label="已固定期间"><span><PushpinOutlined /><b>{selectedRange[0]} 至 {selectedRange[1]}</b></span><div><button type="button" className="cockpit-text-button" onClick={() => { setPinned(undefined); setFocused(undefined) }}>取消固定</button><button type="button" className="cockpit-period-inspect" disabled={alreadyInRange} onClick={() => onInspectPeriod(period)}>{alreadyInRange ? '已在该期间' : '查看该期间'}<ArrowRightOutlined /></button></div></div>}
  </div>
}
