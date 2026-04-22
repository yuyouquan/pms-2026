'use client'
import { useEffect, useRef, useState } from 'react'
import { Input, Button } from 'antd'
import { SendOutlined, PaperClipOutlined } from '@ant-design/icons'
import { useAIChatStore } from '@/stores/ai-chat'

export function ChatInput() {
  const [value, setValue] = useState('')
  const textareaRef = useRef<any>(null)
  const { sendMessage, isStreaming } = useAIChatStore()

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as string
      setValue(detail)
      setTimeout(() => textareaRef.current?.focus(), 0)
    }
    window.addEventListener('ai-fill-input', handler)
    return () => window.removeEventListener('ai-fill-input', handler)
  }, [])

  const onSubmit = () => {
    const text = value.trim()
    if (!text || isStreaming) return
    setValue('')
    sendMessage(text)
  }

  return (
    <div style={{ display: 'flex', gap: 8, padding: 16, borderTop: '1px solid #f0f0f0', alignItems: 'flex-end' }}>
      <Button type="text" icon={<PaperClipOutlined />} disabled title="附件（即将上线）" />
      <Input.TextArea
        ref={textareaRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onPressEnter={e => {
          if (!e.shiftKey) {
            e.preventDefault()
            onSubmit()
          }
        }}
        autoSize={{ minRows: 1, maxRows: 6 }}
        placeholder={isStreaming ? 'AI 正在思考...' : '输入你的问题，按 Enter 发送，Shift+Enter 换行'}
        disabled={isStreaming}
        style={{ flex: 1 }}
      />
      <Button type="primary" icon={<SendOutlined />} onClick={onSubmit}
        disabled={!value.trim() || isStreaming}>发送</Button>
    </div>
  )
}
