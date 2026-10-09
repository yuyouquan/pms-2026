import type { EChartsOption } from 'echarts'
import { formatCockpit, type CockpitMode, type CockpitRow } from '@/components/cockpit/cockpitData'

export const cockpitColors = ['#8063e4', '#32a995', '#b87c32', '#7590db', '#8e879d']
export type CockpitSeries = { key: string; label: string; color: string; values: (number | undefined)[] }
const axis = { axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#756e84', fontSize: 12 } }
const finite = (value?: number) => value !== undefined && Number.isFinite(value) ? value : null
export const cockpitChartBase: EChartsOption = {
  backgroundColor: 'transparent', textStyle: { fontFamily: 'inherit', color: '#4b435f' },
  animationDuration: 650, animationDurationUpdate: 350, animationEasing: 'cubicOut',
  tooltip: { renderMode: 'richText', backgroundColor: '#ffffff', borderColor: '#dcd6ff', textStyle: { color: '#302a43', fontSize: 12 } },
}

/** Presentation mapping only: missing values stay gaps; signed values are never clipped. */
export function cockpitTrendOption(periods: string[], series: readonly CockpitSeries[], hidden: string[], bars: boolean, mode: CockpitMode): EChartsOption {
  return {
    ...cockpitChartBase,
    grid: { left: 48, right: 20, top: 22, bottom: periods.length > 24 ? 64 : 32 },
    tooltip: { ...cockpitChartBase.tooltip, trigger: 'axis', valueFormatter: value => value == null ? '—' : `${formatCockpit(Number(value))} ${mode === 'labor' ? '人月' : '万元'}` },
    xAxis: { ...axis, type: 'category', data: periods, boundaryGap: bars, axisLabel: { ...axis.axisLabel, formatter: (value: string) => value.length === 7 ? `${value.slice(5)}月` : value.slice(5) } },
    yAxis: { ...axis, type: 'value', splitLine: { lineStyle: { color: '#e9e5f2', type: 'dashed' } } },
    dataZoom: periods.length > 24 ? [{ type: 'slider', height: 16, bottom: 5, borderColor: 'transparent', textStyle: { color: '#756e84' }, startValue: 0, endValue: 23, brushSelect: false }] : [],
    series: series.flatMap((item, index) => hidden.includes(item.key) ? [] : [{
      id: item.key, name: item.label, type: bars ? 'bar' as const : 'line' as const,
      data: item.values.map(finite), itemStyle: { color: cockpitColors[index % cockpitColors.length] },
      ...(bars ? { stack: 'investment', barMaxWidth: 22, emphasis: { focus: 'series' as const } } : {
        smooth: .25, smoothMonotone: 'x' as const, connectNulls: false, showSymbol: false, symbolSize: 7,
        lineStyle: { width: 2.5 }, areaStyle: { opacity: .05 }, emphasis: { focus: 'series' as const },
      }),
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
    series: [{ key: 'budget', label: '项目预算', color: '#7590db' }, { key: 'actual', label: '项目核算', color: '#32a995' }].map(item => ({
      name: item.label, type: 'bar', barMaxWidth: 10, barGap: '45%', itemStyle: { color: item.color, borderRadius: [0, 3, 3, 0] },
      data: rows.map(row => finite(row[item.key as 'budget' | 'actual']?.[mode])),
    })),
  }
}
