'use client'
import { useEffect } from 'react'
import { ConversationSidebar } from '@/components/ai/ConversationSidebar'
import { ChatHeader } from '@/components/ai/ChatHeader'
import { MessageList } from '@/components/ai/MessageList'
import { ChatInput } from '@/components/ai/ChatInput'
import { QuickPromptChips } from '@/components/ai/QuickPromptChips'
import { useAIChatStore } from '@/stores/ai-chat'

export default function AIAssistantContainer() {
  const { conversations, activeConversationId, createConversation } = useAIChatStore()
  const active = conversations.find(c => c.id === activeConversationId)

  // Ensure there's always at least one conversation
  useEffect(() => {
    if (conversations.length === 0) createConversation()
  }, [conversations.length, createConversation])

  const messages = active?.messages ?? []
  const emptyMode = messages.length === 0

  return (
    <div style={{ display: 'flex', height: '100%', background: '#fff', overflow: 'hidden' }}>
      <ConversationSidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <ChatHeader />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <MessageList messages={messages} />
          <QuickPromptChips emptyMode={emptyMode} />
          <ChatInput />
        </div>
      </div>
    </div>
  )
}
