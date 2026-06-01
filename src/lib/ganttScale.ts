export type GanttScaleMode = 'day' | 'month' | 'quarter' | 'year'

type GanttScale = {
  unit: 'day' | 'month' | 'quarter' | 'year'
  step: number
  format: string | ((date: Date) => string)
}

export type GanttScaleConfig = {
  scales: GanttScale[]
  scaleHeight: number
  minColumnWidth: number
}

const quarterLabel = (date: Date) => `Q${Math.floor(date.getMonth() / 3) + 1}`

export const GANTT_SCALE_OPTIONS: Array<{ label: string; value: GanttScaleMode }> = [
  { label: '日', value: 'day' },
  { label: '月', value: 'month' },
  { label: '季度', value: 'quarter' },
  { label: '年', value: 'year' },
]

export function getGanttScaleConfig(mode: GanttScaleMode): GanttScaleConfig {
  switch (mode) {
    case 'day':
      return {
        scales: [
          { unit: 'month', step: 1, format: '%Y年%m月' },
          { unit: 'day', step: 1, format: '%d日' },
        ],
        scaleHeight: 56,
        minColumnWidth: 42,
      }
    case 'quarter':
      return {
        scales: [
          { unit: 'year', step: 1, format: '%Y年' },
          { unit: 'quarter', step: 1, format: quarterLabel },
        ],
        scaleHeight: 56,
        minColumnWidth: 90,
      }
    case 'year':
      return {
        scales: [
          { unit: 'year', step: 1, format: '%Y年' },
        ],
        scaleHeight: 34,
        minColumnWidth: 120,
      }
    case 'month':
    default:
      return {
        scales: [
          { unit: 'year', step: 1, format: '%Y年' },
          { unit: 'month', step: 1, format: '%m月' },
        ],
        scaleHeight: 56,
        minColumnWidth: 58,
      }
  }
}
