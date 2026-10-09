'use client'

import { useEffect, useRef, useState, type KeyboardEventHandler } from 'react'
import type { EChartsOption, EChartsType } from 'echarts'
import { useCockpitReducedMotion } from '@/components/cockpit/useCockpitMotion'

export default function CockpitEChart({ option, label, className = '', onSelect, onKeyDown, tabIndex, activeIndex }: {
  option: EChartsOption; label: string; className?: string; onSelect?: (index: number) => void
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>; tabIndex?: number; activeIndex?: number
}) {
  const host = useRef<HTMLDivElement>(null), chart = useRef<EChartsType>(), current = useRef({ option, onSelect, activeIndex })
  current.current = { option, onSelect, activeIndex }
  const reduced = useCockpitReducedMotion(), reducedRef = useRef(reduced)
  reducedRef.current = reduced
  const [error, setError] = useState(false)
  const syncSelection = () => {
    const instance = chart.current, { activeIndex: index, option: latest } = current.current
    if (!instance) return
    if (index === undefined) { instance.dispatchAction({ type: 'hideTip' }); return }
    const xAxis = Array.isArray(latest.xAxis) ? latest.xAxis[0] : latest.xAxis
    const count = xAxis && 'data' in xAxis ? xAxis.data?.length ?? 0 : 0
    if (count > 24) instance.dispatchAction({ type: 'dataZoom', startValue: Math.max(0, Math.min(count - 24, index - 12)), endValue: Math.min(count - 1, Math.max(23, index + 11)) })
    instance.dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex: index })
  }
  useEffect(() => {
    let cancelled = false, resize: ResizeObserver | undefined
    const apply = () => chart.current?.setOption({ ...current.current.option, animation: !reducedRef.current && !document.hidden }, { notMerge: true })
    const visibility = () => { if (document.hidden) { chart.current?.clear(); apply() } }
    void import('@/components/cockpit/cockpitEchartsRuntime').then(({ init }) => {
      if (cancelled || !host.current) return
      chart.current = init(host.current, undefined, { renderer: 'svg' })
      chart.current.getZr().on('click', event => {
        const instance = chart.current
        if (!instance || !current.current.onSelect || !instance.containPixel({ gridIndex: 0 }, [event.offsetX, event.offsetY])) return
        const position = instance.convertFromPixel({ xAxisIndex: 0 }, event.offsetX)
        const axis = current.current.option.xAxis
        const count = axis && !Array.isArray(axis) && 'data' in axis ? axis.data?.length ?? 0 : 0
        if (count && typeof position === 'number' && Number.isFinite(position)) current.current.onSelect(Math.max(0, Math.min(count - 1, Math.round(position))))
      })
      apply(); syncSelection()
      resize = new ResizeObserver(() => chart.current?.resize({ animation: { duration: 0 } }))
      resize.observe(host.current)
      document.addEventListener('visibilitychange', visibility)
    }).catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true; resize?.disconnect(); document.removeEventListener('visibilitychange', visibility); chart.current?.dispose(); chart.current = undefined }
  }, [])
  useEffect(() => {
    // Clear in-flight graphic transitions immediately when motion is disabled.
    if (reduced) chart.current?.clear()
    chart.current?.setOption({ ...option, animation: !reduced && !document.hidden }, { notMerge: true })
    syncSelection()
  }, [option, reduced])
  useEffect(() => { syncSelection() }, [activeIndex])
  return <div className={`cockpit-echart-wrap ${className}`}>
    <div ref={host} className="cockpit-echart" role={onKeyDown ? 'group' : 'img'} aria-label={label} tabIndex={tabIndex} onKeyDown={onKeyDown} />
    {error && <span className="cockpit-graphic-empty" role="alert">图表加载失败，请刷新页面</span>}
  </div>
}
