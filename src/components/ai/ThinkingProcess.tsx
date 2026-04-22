'use client'
import { useState } from 'react'
import { DownOutlined, UpOutlined, CheckCircleFilled } from '@ant-design/icons'
import type { ThinkingStep } from '@/types/ai'

type Props = {
  steps: ThinkingStep[]
  revealedCount: number
  collapsed: boolean
}

export function ThinkingProcess({ steps, revealedCount, collapsed }: Props) {
  const [userCollapsed, setUserCollapsed] = useState<boolean | null>(null)
  const effectivelyCollapsed = userCollapsed === null ? collapsed : userCollapsed

  const visible = steps.slice(0, revealedCount)

  if (effectivelyCollapsed) {
    return (
      <div
        onClick={() => setUserCollapsed(false)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#8c8c8c',
          cursor: 'pointer', padding: '4px 8px', background: '#fafafa', borderRadius: 4, marginBottom: 8 }}
      >
        <CheckCircleFilled style={{ color: '#52c41a' }} />
        <span>已完成 {steps.length} 步</span>
        <DownOutlined style={{ fontSize: 10 }} />
      </div>
    )
  }

  return (
    <div style={{ fontSize: 12, color: '#595959', padding: '8px 12px', background: '#f6f8fa',
      borderRadius: 4, marginBottom: 8, border: '1px solid #e8e8e8' }}>
      <div onClick={() => setUserCollapsed(true)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, cursor: 'pointer' }}>
        <b>▼ AI 思考过程（{revealedCount}/{steps.length} 步）</b>
        <UpOutlined style={{ fontSize: 10, marginLeft: 'auto' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {visible.map((step, idx) => (
          <div key={idx} style={{ display: 'flex', gap: 6 }}>
            <span>{step.icon}</span>
            <span>{step.target}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
