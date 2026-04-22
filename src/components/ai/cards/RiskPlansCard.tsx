'use client'
import { Card, Tag } from 'antd'
import type { RiskPlanCardData } from '@/types/ai'

const TYPE_COLOR: Record<string, string> = {
  '版本': 'purple',
  '需求': 'blue',
  '开发': 'gold',
  '测试': 'green',
  '其他': 'default',
}

const REASON_ICON = (reason: string) => {
  if (reason.includes('阻塞')) return '🚧'
  if (reason.includes('紧急')) return '🔥'
  if (reason.includes('截止')) return '🔥'
  return '⚠️'
}

export function RiskPlansCard({ data }: { data: RiskPlanCardData }) {
  return (
    <Card
      size="small"
      style={{ borderRadius: 8, background: '#fff1f0', borderColor: '#ffa39e' }}
      title={<span style={{ fontSize: 14 }}>🚨 风险计划项 ({data.items.length} 项)</span>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.items.map((item, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 8px',
              background: '#fff',
              borderRadius: 4,
              border: '1px solid #ffccc7',
            }}
          >
            <span>{REASON_ICON(item.reason)}</span>
            <Tag color={TYPE_COLOR[item.planType] ?? 'default'} style={{ margin: 0 }}>
              {item.planType}
            </Tag>
            <span style={{ flex: 1, fontSize: 13 }}>{item.planName}</span>
            <span style={{ color: '#8c8c8c', fontSize: 12 }}>· {item.owner}</span>
            <span style={{ color: '#ff4d4f', fontSize: 12 }}>· {item.reason}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}
