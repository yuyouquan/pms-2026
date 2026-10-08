export interface CockpitSort { key: string; descending: boolean }
export interface CockpitTableView { widths: Record<string, number>; sort?: CockpitSort }

export function nextCockpitSort(current: CockpitSort | undefined, key: string): CockpitSort | undefined {
  return current?.key === key ? current.descending ? undefined : { key, descending: true } : { key, descending: false }
}

export function sortCockpitRows<T>(rows: readonly T[], columns: readonly { key: string; value?: (row: T) => number | string | undefined }[], sort?: CockpitSort): readonly T[] {
  const value = columns.find(column => column.key === sort?.key)?.value
  if (!sort || !value) return rows
  return [...rows].sort((a, b) => {
    const av = value(a), bv = value(b)
    if (av === undefined) return bv === undefined ? 0 : 1
    if (bv === undefined) return -1
    return (typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), 'zh-CN')) * (sort.descending ? -1 : 1)
  })
}

export function cockpitColumnWidth(key: string, defaultWidth: number, view: CockpitTableView, compact: boolean, first: boolean): number {
  return Math.max(100, Math.min(compact && first ? 160 : 560, view.widths[key] ?? defaultWidth))
}

export function resizeCockpitColumn(key: string, defaultWidth: number, view: CockpitTableView, compact: boolean, first: boolean, requested: number): CockpitTableView {
  const width = Math.max(100, Math.min(compact && first ? 160 : 560, requested))
  if (width === cockpitColumnWidth(key, defaultWidth, view, compact, first)) return view
  return { ...view, widths: { ...view.widths, [key]: width } }
}
