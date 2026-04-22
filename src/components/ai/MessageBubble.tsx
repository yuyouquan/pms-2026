'use client'
import { useState } from 'react'
import { Avatar, Button, message as antdMessage, Tooltip } from 'antd'
import { CopyOutlined, LikeOutlined, DislikeOutlined, ReloadOutlined, UserOutlined, RobotFilled } from '@ant-design/icons'
import type { ChatMessage } from '@/types/ai'
import { ThinkingProcess } from './ThinkingProcess'
import { ResponseCard } from './ResponseCard'
import { ReferenceList } from './ReferenceList'

export function MessageBubble({ msg }: { msg: ChatMessage }) {
  const [feedback, setFeedback] = useState<'like' | 'dislike' | null>(null)

  if (msg.role === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <div style={{ maxWidth: '70%', background: '#e6f4ff', padding: '8px 12px',
          borderRadius: 8, fontSize: 13, lineHeight: 1.6 }}>
          {msg.text}
        </div>
        <Avatar icon={<UserOutlined />} style={{ marginLeft: 8, background: '#1677ff' }} />
      </div>
    )
  }

  const s = msg.streaming
  const revealedThinking = s?.thinkingRevealed ?? msg.thinkingSteps?.length ?? 0
  const textToShow = s
    ? (msg.text ?? '').slice(0, s.textRevealed)
    : (msg.text ?? '')
  const cardsToShow = s
    ? (msg.cards ?? []).slice(0, s.cardsRevealed)
    : (msg.cards ?? [])
  const showRefs = s ? s.referencesRevealed : true

  const copyText = () => {
    navigator.clipboard.writeText(msg.text ?? '')
    antdMessage.success('已复制到剪贴板')
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16 }}>
      <Avatar icon={<RobotFilled />} style={{ marginRight: 8, background: '#722ed1', flexShrink: 0 }} />
      <div style={{ maxWidth: '92%', flex: 1 }}>
        {msg.thinkingSteps && msg.thinkingSteps.length > 0 && (
          <ThinkingProcess steps={msg.thinkingSteps} revealedCount={revealedThinking}
            collapsed={s?.thinkingCollapsed ?? true} />
        )}
        {textToShow && (
          <div style={{ padding: '8px 12px', background: '#f6f8fa', borderRadius: 8,
            fontSize: 13, lineHeight: 1.7, marginBottom: 8, whiteSpace: 'pre-wrap' }}
            dangerouslySetInnerHTML={{ __html: simpleMarkdown(textToShow) }} />
        )}
        {cardsToShow.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 8 }}>
            {cardsToShow.map((card, idx) => (
              <div key={idx} style={{
                animation: `fadeInUp 0.4s ease-out ${idx * 0.08}s both`,
              }}>
                <ResponseCard card={card} />
              </div>
            ))}
          </div>
        )}
        {showRefs && msg.references && <ReferenceList items={msg.references} />}
        {showRefs && (
          <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
            <Tooltip title="有帮助"><Button size="small" type="text" icon={<LikeOutlined />}
              onClick={() => setFeedback('like')}
              style={{ color: feedback === 'like' ? '#1677ff' : undefined }} /></Tooltip>
            <Tooltip title="没帮助"><Button size="small" type="text" icon={<DislikeOutlined />}
              onClick={() => setFeedback('dislike')}
              style={{ color: feedback === 'dislike' ? '#ff4d4f' : undefined }} /></Tooltip>
            <Tooltip title="重新生成"><Button size="small" type="text" icon={<ReloadOutlined />} /></Tooltip>
            <Tooltip title="复制"><Button size="small" type="text" icon={<CopyOutlined />} onClick={copyText} /></Tooltip>
          </div>
        )}
        <style jsx global>{`
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    </div>
  )
}

// Minimal markdown → HTML: **bold**, 【x】wrap
function simpleMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\n/g, '<br/>')
}
