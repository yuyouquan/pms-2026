import type { EChartsOption, LineSeriesOption } from 'echarts'
import { PMS_COLORS } from '@/theme/pmsTheme'
import { RESOURCE_CHART_COLORS } from '@/theme/resourceChartTheme'
import { formatCockpit, type CockpitMode, type CockpitRow } from '@/components/cockpit/cockpitData'
import { cockpitCurrentPeriod, cockpitInitialPeriodIndex, cockpitPeriodWindow, type CockpitTrendPresentation } from '@/components/cockpit/cockpitChartPresentation'

export const cockpitColors = ['#8063e4', '#32a995', '#b87c32', '#7590db', '#8e879d']
export type CockpitSeries = { key: string; label: string; color: string; values: (number | undefined)[] }
const axis = { axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#756e84', fontSize: 12, hideOverlap: true } }
const finite = (value?: number) => value !== undefined && Number.isFinite(value) ? value : null
export const cockpitChartBase: EChartsOption = {
  backgroundColor: 'transparent', textStyle: { fontFamily: 'inherit', color: '#4b435f' },
  animationDuration: 650, animationDurationUpdate: 350, animationEasing: 'cubicOut',
  tooltip: { renderMode: 'richText', backgroundColor: '#ffffff', borderColor: PMS_COLORS.brandBorder, textStyle: { color: '#302a43', fontSize: 12 } },
}

/** Shared row geometry keeps the HTML category names aligned with ECharts grids. */
export function cockpitCategoryRows(count: number, zoom: boolean) {
  const step = (zoom ? 82 : 90) / Math.max(1, count)
  return Array.from({ length: count }, (_, index) => ({ top: 3 + index * step, height: step - 6 }))
}

/** One scale across every category and the entire selected period, including hidden series. */
function categoryScale(series: readonly CockpitSeries[]) {
  const values = series.flatMap(item => item.values).filter((value): value is number => finite(value) !== null)
  const min = Math.min(0, ...values), max = Math.max(0, ...values)
  const rough = (max - min || 1) / 3, power = 10 ** Math.floor(Math.log10(rough))
  const interval = ([1, 2, 5, 10].find(step => step * power >= rough) ?? 10) * power
  return { min: min < 0 ? Math.floor(min * 1.18 / interval) * interval : 0,
    max: max > 0 ? Math.ceil(max * 1.18 / interval) * interval : min < 0 ? 0 : 1, interval }
}

/** Presentation mapping only: missing values stay gaps; signed values are never clipped. */
export function cockpitTrendOption(periods: string[], series: readonly CockpitSeries[], hidden: string[], bars: boolean, mode: CockpitMode, presentation?: CockpitTrendPresentation): EChartsOption {
  const tooltip: EChartsOption['tooltip'] = { ...cockpitChartBase.tooltip, trigger: 'axis', confine: true,
    valueFormatter: value => value == null ? '—' : `${formatCockpit(Number(value))} ${mode === 'labor' ? '人月' : '万元'}` }
  const current = presentation && cockpitCurrentPeriod(periods, presentation)
  const focusIndex = presentation ? presentation.activeIndex ?? cockpitInitialPeriodIndex(periods, presentation.today, presentation.grain) : 0
  const window = cockpitPeriodWindow(periods.length, bars ? 12 : 24, focusIndex)
  const periodHighlight: Pick<LineSeriesOption, 'markArea' | 'markLine'> = current ? {
    ...(bars ? { markArea: { silent: true, label: { show: false }, itemStyle: { color: 'rgba(107, 80, 220, .055)' },
      data: [[{ xAxis: current.index }, { xAxis: current.index }]] } } : {}),
    markLine: { silent: true, symbol: 'none', label: { show: false }, lineStyle: { color: '#ab9cd5', type: 'dashed' as const, width: 1 }, data: [{ xAxis: current.index }] },
  } : {}
  if (bars) {
    const zoom = periods.length > 12, rows = cockpitCategoryRows(series.length, zoom), scale = categoryScale(series)
    return { ...cockpitChartBase, tooltip: { ...tooltip, axisPointer: { type: 'shadow' } },
      grid: rows.map(row => ({ left: 48, right: 24, top: `${row.top}%`, height: `${row.height}%` })),
      xAxis: series.map((_, index) => ({ ...axis, type: 'category', gridIndex: index, data: periods, boundaryGap: true,
        axisLine: { show: true, lineStyle: { color: '#ded8ed' } },
        axisLabel: { ...axis.axisLabel, show: index === series.length - 1, fontSize: 11,
          formatter: (value: string) => value.length === 7 ? `${value.slice(5)}月` : value.slice(5) } })),
      yAxis: series.map((_, index) => ({ ...axis, ...scale, type: 'value', gridIndex: index,
        axisLabel: { ...axis.axisLabel, fontSize: 10, hideOverlap: true }, splitLine: { lineStyle: { color: '#e9e5f2', type: 'dashed' } } })),
      dataZoom: zoom ? [{ type: 'slider', xAxisIndex: series.map((_, index) => index), height: 16, bottom: 3,
        borderColor: 'transparent', textStyle: { color: '#756e84' }, startValue: window.start, endValue: window.end, maxValueSpan: 11, brushSelect: false }] : [],
      series: series.flatMap((item, index) => hidden.includes(item.key) ? [] : [{
        id: item.key, name: item.label, type: 'bar' as const, xAxisIndex: index, yAxisIndex: index,
        data: item.values.map(finite), barMaxWidth: 30, ...periodHighlight,
        itemStyle: { color: cockpitColors[0], borderRadius: [2, 2, 0, 0] },
        label: { show: true, position: 'top' as const, distance: 4, color: '#6550b7', fontSize: 11, fontWeight: 600,
          formatter: (params: { value: unknown }) => typeof params.value === 'number' ? formatCockpit(params.value) : '' },
        emphasis: { itemStyle: { color: '#6545ce' } },
      }]),
    }
  }
  return {
    ...cockpitChartBase,
    grid: { left: 48, right: 20, top: 22, bottom: periods.length > 24 ? 64 : 32 }, tooltip,
    xAxis: { ...axis, type: 'category', data: periods, boundaryGap: false, axisLabel: { ...axis.axisLabel, formatter: (value: string) => value.length === 7 ? `${value.slice(5)}月` : value.slice(5) } },
    yAxis: { ...axis, type: 'value', splitLine: { lineStyle: { color: '#e9e5f2', type: 'dashed' } } },
    dataZoom: periods.length > 24 ? [{ type: 'slider', height: 16, bottom: 5, borderColor: 'transparent', textStyle: { color: '#756e84' }, startValue: window.start, endValue: window.end, brushSelect: false }] : [],
    series: series.flatMap(item => hidden.includes(item.key) ? [] : [{
      id: item.key, name: item.label, type: 'line' as const,
      data: item.values.map(finite), itemStyle: { color: item.color },
      ...(series.find(item => !hidden.includes(item.key))?.key === item.key ? periodHighlight : {}),
      smooth: .25, smoothMonotone: 'x' as const, connectNulls: false, showSymbol: false, symbolSize: 7,
      lineStyle: { width: 2.5 }, areaStyle: { opacity: .05 }, emphasis: { focus: 'series' as const },
    }]),
  }
}

export function cockpitAllocationOption(rows: { label: string; days: number }[]): EChartsOption {
  return { ...cockpitChartBase, tooltip: { ...cockpitChartBase.tooltip, trigger: 'item', formatter: '{b}\n{c} 人天 · {d}%' },
    series: [{ type: 'pie', radius: ['69%', '87%'], center: ['50%', '50%'], label: { show: false }, labelLine: { show: false },
      padAngle: 3, stillShowZeroSum: false, itemStyle: { borderRadius: 5 }, emphasis: { scaleSize: 5 },
      data: rows.map((row, index) => ({ name: row.label, value: row.days, itemStyle: { color: cockpitColors[index % cockpitColors.length] } })).filter(row => row.value > 0),
    }],
  }
}

export function cockpitComparisonOption(rows: CockpitRow[], mode: CockpitMode): EChartsOption {
  return { ...cockpitChartBase, grid: { left: 110, right: 30, top: 10, bottom: 30 },
    tooltip: { ...cockpitChartBase.tooltip, trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: value => value == null ? '—' : `${formatCockpit(Number(value))} ${mode === 'labor' ? '人月' : '万元'}` },
    xAxis: { ...axis, type: 'value', splitLine: { lineStyle: { color: '#e9e5f2', type: 'dashed' } } },
    yAxis: { ...axis, type: 'category', inverse: true, data: rows.map(row => row.name) },
    series: [{ key: 'budget', label: '项目预算', color: RESOURCE_CHART_COLORS.budget }, { key: 'actual', label: '项目核算', color: RESOURCE_CHART_COLORS.actual }].map(item => ({
      name: item.label, type: 'bar', barMaxWidth: 10, barGap: '45%', itemStyle: { color: item.color, borderRadius: [0, 3, 3, 0] },
      data: rows.map(row => finite(row[item.key as 'budget' | 'actual']?.[mode])),
    })),
  }
}
