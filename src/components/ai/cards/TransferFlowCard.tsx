'use client'
import { Card } from 'antd'
import type { TransferFlowData } from '@/types/ai'

export function TransferFlowCard({ data }: { data: TransferFlowData }) {
  const current = data.stages[data.currentStageIndex]

  return (
    <Card size="small" style={{ borderRadius: 8 }}>
      <div style={{ fontWeight: 500, marginBottom: 12, fontSize: 14 }}>🚚 转维流程进度</div>

      {/* Horizontal progress bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
        {data.stages.map((stage, idx) => {
          const isDone = stage.status === 'done'
          const isCurrent = stage.status === 'current'
          const color = isDone ? '#52c41a' : isCurrent ? '#1677ff' : '#d9d9d9'
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: color,
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 600, flexShrink: 0,
                boxShadow: isCurrent ? '0 0 0 3px #bae0ff' : 'none' }}>
                {isDone ? '✓' : idx + 1}
              </div>
              {idx < data.stages.length - 1 && (
                <div style={{ height: 2, flex: 1, background: isDone ? '#52c41a' : '#d9d9d9', margin: '0 4px' }} />
              )}
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, fontSize: 11, color: '#595959' }}>
        {data.stages.map((stage, idx) => (
          <div key={idx} style={{ flex: 1, textAlign: 'center', fontWeight: stage.status === 'current' ? 600 : 400,
            color: stage.status === 'current' ? '#1677ff' : '#8c8c8c' }}>
            {stage.name}
          </div>
        ))}
      </div>

      {/* Current stage details */}
      {current && (
        <div style={{ padding: 12, background: '#e6f4ff', borderRadius: 6, border: '1px solid #91caff' }}>
          <div style={{ fontWeight: 500, marginBottom: 6 }}>当前阶段：{current.name}</div>
          <div style={{ fontSize: 12, color: '#595959', lineHeight: 1.8 }}>
            {current.owner && <div>负责人：<b>{current.owner}</b></div>}
            {current.dueDate && <div>预计完成：<b>{current.dueDate}</b></div>}
            {current.pendingItems && current.pendingItems.length > 0 && (
              <div>未完成项：
                <ul style={{ margin: '4px 0 0 20px' }}>
                  {current.pendingItems.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}
