'use client'
import { Button } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useAIChatStore } from '@/stores/ai-chat'
import { useAIConfigStore } from '@/stores/ai-config'

export function ChatHeader() {
  const { createConversation, setSidebarCollapsed } = useAIChatStore()
  const { providers, defaultProviderId } = useAIConfigStore()
  const defaultProvider = providers.find(p => p.id === defaultProviderId)
  const modelLabel = defaultProvider?.defaultModel ?? '未配置'

  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '8px 20px',
      borderBottom: '1px solid #f0f0f0', gap: 10, background: '#fff', minHeight: 44 }}>
      <div style={{ flex: 1 }} />
      <span style={{ fontSize: 11, color: '#8c8c8c' }}>默认模型：{modelLabel}</span>
      <Button
        icon={<PlusOutlined />}
        size="small"
        type="text"
        onClick={() => {
          createConversation()
          setSidebarCollapsed(false)   // reveal sidebar so user sees the new + old conversations
        }}
      >
        新对话
      </Button>
    </div>
  )
}
