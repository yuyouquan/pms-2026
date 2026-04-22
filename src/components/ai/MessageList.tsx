'use client'
import { useEffect, useRef } from 'react'
import { Empty } from 'antd'
import type { ChatMessage } from '@/types/ai'
import { MessageBubble } from './MessageBubble'

export function MessageList({ messages }: { messages: ChatMessage[] }) {
  const bottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  if (messages.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: '#8c8c8c', gap: 12, padding: '40px 24px' }}>
        <div style={{ fontSize: 56 }}>🤖</div>
        <div style={{ fontSize: 18, fontWeight: 500, color: '#262626' }}>智能助手，随时问我</div>
        <div style={{ fontSize: 13, color: '#8c8c8c', textAlign: 'center', maxWidth: 480, lineHeight: 1.7 }}>
          我可以回答项目基础信息、一级/二级/三级计划、版本发布、产品规格、需求状态、转维流程等问题。<br />
          试试点击下方的快捷问题，或直接描述你的需求。
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
      {messages.map(m => <MessageBubble key={m.id} msg={m} />)}
      <div ref={bottomRef} />
    </div>
  )
}
