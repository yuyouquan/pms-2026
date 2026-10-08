'use client'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowDownOutlined, ArrowUpOutlined, SwapOutlined } from '@ant-design/icons'
export interface CockpitColumn<T> { key: string; label: string; width?: number; numeric?: boolean; render: (row: T) => ReactNode; value?: (row: T) => number | string | undefined }
export default function CockpitTable<T extends { key: string }>({ rows, columns, label, footer }: { rows: readonly T[]; columns: CockpitColumn<T>[]; label: string; footer?: T }) {
  const [widths, setWidths] = useState<Record<string, number>>({}), [sort, setSort] = useState<{ key: string; descending: boolean }>()
  const [compact, setCompact] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(max-width: 720px)')
    const update = () => setCompact(query.matches)
    update(); query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  const sorted = useMemo(() => {
    const column = columns.find(item => item.key === sort?.key)
    if (!column?.value || !sort) return rows
    const value = column.value
    return [...rows].sort((a, b) => {
      const av = value(a), bv = value(b)
      if (av === undefined) return bv === undefined ? 0 : 1
      if (bv === undefined) return -1
      return (typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), 'zh-CN')) * (sort.descending ? -1 : 1)
    })
  }, [rows, columns, sort])
  const width = (column: CockpitColumn<T>) => widths[column.key] ?? (compact && column.key === columns[0]?.key ? Math.min(column.width ?? 155, 160) : column.width ?? 155)
  const resize = (key: string, value: number) => setWidths(current => ({ ...current, [key]: Math.max(100, Math.min(560, value)) }))
  return <div className="cockpit-table-scroll" tabIndex={0} aria-label={`${label}，可横向滚动`}>
    <table className="cockpit-table" style={{ width: columns.reduce((sum, column) => sum + width(column), 0), minWidth: '100%' }}>
      <caption className="sr-only">{label}，点击表头排序，拖动表头右侧边缘调整列宽</caption>
      <colgroup>{columns.map(column => <col key={column.key} style={{ width: width(column) }} />)}</colgroup>
      <thead><tr>{columns.map((column, index) => <th key={column.key} className={`${index === 0 ? 'cockpit-sticky' : ''} ${column.numeric ? 'is-numeric' : ''}`} aria-sort={sort?.key === column.key ? sort.descending ? 'descending' : 'ascending' : 'none'}>
        <button type="button" className="cockpit-sort" aria-label={column.label} disabled={!column.value} onClick={() => setSort(current => current?.key === column.key ? current.descending ? undefined : { key: column.key, descending: true } : { key: column.key, descending: false })}>
          {column.label}{column.value && (sort?.key === column.key ? sort.descending ? <ArrowDownOutlined /> : <ArrowUpOutlined /> : <SwapOutlined className="cockpit-sort-idle" />)}
        </button>
        <span role="separator" tabIndex={0} aria-orientation="vertical" aria-label={`调整${column.label}列宽`} aria-valuemin={100} aria-valuemax={560} aria-valuenow={width(column)}
          className="cockpit-column-resizer" onKeyDown={event => { if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); resize(column.key, width(column) + (event.key === 'ArrowRight' ? 20 : -20)) } }}
          onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.dataset.startX = String(event.clientX); event.currentTarget.dataset.startWidth = String(width(column)) }}
          onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) resize(column.key, Number(event.currentTarget.dataset.startWidth) + event.clientX - Number(event.currentTarget.dataset.startX)) }}
          onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }} />
      </th>)}</tr></thead>
      <tbody>{sorted.map(row => <tr key={row.key}>{columns.map((column, index) => <td key={column.key} className={`${index === 0 ? 'cockpit-sticky' : ''} ${column.numeric ? 'is-numeric' : ''}`}>{column.render(row)}</td>)}</tr>)}</tbody>
      {footer && <tfoot><tr>{columns.map((column, index) => <td key={column.key} className={`${index === 0 ? 'cockpit-sticky' : ''} ${column.numeric ? 'is-numeric' : ''}`}>{column.render(footer)}</td>)}</tr></tfoot>}
    </table>
    {!rows.length && <div className="cockpit-no-rows">所选范围暂无项目数据</div>}
  </div>
}
