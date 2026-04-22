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
        height: '100%', color: '#8c8c8c', gap: 12 }}>
        <div style={{ fontSize: 48 }}>🤖</div>
        <div style={{ fontSize: 16, fontWeight: 500 }}>有什么可以帮你的？</div>
        <div style={{ fontSize: 13 }}>试试下方的快捷问题，或者直接描述你的需求</div>
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
