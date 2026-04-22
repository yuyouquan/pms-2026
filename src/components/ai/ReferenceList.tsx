'use client'
import { Tooltip } from 'antd'
import { LinkOutlined } from '@ant-design/icons'
import type { ReferenceItem } from '@/types/ai'

export function ReferenceList({ items }: { items: ReferenceItem[] }) {
  if (items.length === 0) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#8c8c8c',
      marginTop: 8, padding: '6px 8px', background: '#fafafa', borderRadius: 4 }}>
      <LinkOutlined />
      <span>来源：</span>
      {items.map((it, idx) => (
        <Tooltip key={idx} title={`引用 [${it.index}] ${it.label}`}>
          <span style={{ cursor: 'default' }}>
            {it.label}<sup>{it.index}</sup>
            {idx < items.length - 1 ? ' · ' : ''}
          </span>
        </Tooltip>
      ))}
    </div>
  )
}
