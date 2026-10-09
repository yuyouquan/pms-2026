'use client'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowDownOutlined, ArrowUpOutlined, SwapOutlined } from '@ant-design/icons'
import { cockpitColumnWidth, nextCockpitSort, resizeCockpitColumn, sortCockpitRows, type CockpitTableView } from '@/components/cockpit/cockpitTableView'
export interface CockpitColumn<T> { key: string; label: string; width?: number; numeric?: boolean; render: (row: T) => ReactNode; value?: (row: T) => number | string | undefined }
export default function CockpitTable<T extends { key: string }>({ rows, columns, label, footer, view: controlledView, onViewChange }: { rows: readonly T[]; columns: CockpitColumn<T>[]; label: string; footer?: T; view?: CockpitTableView; onViewChange?: (view: CockpitTableView) => void }) {
  const [localView, setLocalView] = useState<CockpitTableView>({ widths: {} })
  const view = controlledView ?? localView, { widths, sort } = view
  const updateView = onViewChange ?? setLocalView
  const [compact, setCompact] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(max-width: 720px)')
    const update = () => setCompact(query.matches)
    update(); query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  const activeSortColumn = columns.find(column => column.key === sort?.key && column.value)
  const sorted = useMemo(() => sortCockpitRows(rows, columns, sort), [rows, columns, sort])
  const width = (column: CockpitColumn<T>) => cockpitColumnWidth(column.key, column.width ?? 155, view, compact, column.key === columns[0]?.key)
  const maxWidth = (key: string) => compact && key === columns[0]?.key ? 160 : 560
  const resize = (column: CockpitColumn<T>, value: number) => {
    const next = resizeCockpitColumn(column.key, column.width ?? 155, view, compact, column.key === columns[0]?.key, value)
    if (next !== view) updateView(next)
  }
  return <div className="cockpit-table-view">
    {onViewChange && <div className="cockpit-table-controls" aria-label={`${label}阅读设置`}>
      <span role="status">共 {rows.length} 行 <i />{sort ? activeSortColumn ? `${activeSortColumn.label} · ${sort.descending ? '降序' : '升序'}` : '排序列暂未显示，使用默认顺序' : '默认顺序'}</span>
      <div><button type="button" className="cockpit-text-button" disabled={!sort} onClick={() => updateView({ ...view, sort: undefined })}>恢复默认排序</button><button type="button" className="cockpit-text-button" disabled={!Object.keys(widths).length} onClick={() => updateView({ ...view, widths: {} })}>恢复默认列宽</button></div>
    </div>}
    <div className="cockpit-table-scroll" tabIndex={0} aria-label={`${label}，可横向滚动`}>
    <table className="cockpit-table" style={{ width: columns.reduce((sum, column) => sum + width(column), 0), minWidth: '100%' }}>
      <caption className="sr-only">{label}，点击表头排序，拖动表头右侧边缘调整列宽</caption>
      <colgroup>{columns.map(column => <col key={column.key} style={{ width: width(column) }} />)}</colgroup>
      <thead><tr>{columns.map((column, index) => <th key={column.key} className={`${index === 0 ? 'cockpit-sticky' : ''} ${column.numeric ? 'is-numeric' : ''}`} aria-sort={activeSortColumn?.key === column.key ? sort!.descending ? 'descending' : 'ascending' : 'none'}>
        <button type="button" className="cockpit-sort" aria-label={column.label} disabled={!column.value} onClick={() => updateView({ ...view, sort: nextCockpitSort(sort, column.key) })}>
          {column.label}{column.value && (sort?.key === column.key ? sort.descending ? <ArrowDownOutlined /> : <ArrowUpOutlined /> : <SwapOutlined className="cockpit-sort-idle" />)}
        </button>
        <span role="separator" tabIndex={0} aria-orientation="vertical" aria-label={`调整${column.label}列宽`} aria-valuemin={100} aria-valuemax={maxWidth(column.key)} aria-valuenow={width(column)}
          className="cockpit-column-resizer" onKeyDown={event => { if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); resize(column, width(column) + (event.key === 'ArrowRight' ? 20 : -20)) } }}
          onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.dataset.startX = String(event.clientX); event.currentTarget.dataset.startWidth = String(width(column)) }}
          onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) resize(column, Number(event.currentTarget.dataset.startWidth) + event.clientX - Number(event.currentTarget.dataset.startX)) }}
          onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }} />
      </th>)}</tr></thead>
      <tbody>{sorted.map(row => <tr key={row.key}>{columns.map((column, index) => <td key={column.key} className={`${index === 0 ? 'cockpit-sticky' : ''} ${column.numeric ? 'is-numeric' : ''}`}>{column.render(row)}</td>)}</tr>)}</tbody>
      {footer && <tfoot><tr>{columns.map((column, index) => <td key={column.key} className={`${index === 0 ? 'cockpit-sticky' : ''} ${column.numeric ? 'is-numeric' : ''}`}>{column.render(footer)}</td>)}</tr></tfoot>}
    </table>
    {!rows.length && <div className="cockpit-no-rows">所选范围暂无项目数据</div>}
    </div>
  </div>
}
