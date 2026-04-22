'use client'
import { useMemo } from 'react'
import { useAIConfigStore } from '@/stores/ai-config'
import { useAIChatStore } from '@/stores/ai-chat'

export function QuickPromptChips({ emptyMode }: { emptyMode: boolean }) {
  const templates = useAIConfigStore(s => s.promptTemplates)
  const { currentProjectContext, sendMessage, isStreaming } = useAIChatStore()

  const visible = useMemo(() => {
    const filtered = templates.filter(t => t.showInQuickChips)
    return emptyMode ? filtered.slice(0, 6) : filtered.slice(0, 3)
  }, [templates, emptyMode])

  const onClick = (tplContent: string, placeholders: string[]) => {
    if (isStreaming) return
    if (placeholders.length === 0) {
      sendMessage(tplContent)
      return
    }
    if (currentProjectContext) {
      let filled = tplContent
      placeholders.forEach(ph => {
        filled = filled.replace(new RegExp(`\\{${ph}\\}`, 'g'), currentProjectContext)
      })
      sendMessage(filled)
      return
    }
    // No context → dispatch a "fill input" event via custom event
    window.dispatchEvent(new CustomEvent('ai-fill-input', { detail: tplContent }))
  }

  if (visible.length === 0) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 24px 0' }}>
      <span style={{ fontSize: 12, color: '#8c8c8c', alignSelf: 'center', marginRight: 4 }}>💡 试试：</span>
      {visible.map(t => (
        <button key={t.id}
          disabled={isStreaming}
          onClick={() => onClick(t.content, t.placeholders)}
          style={{ padding: '4px 10px', fontSize: 12, border: '1px solid #d9d9d9',
            borderRadius: 16, background: isStreaming ? '#f5f5f5' : '#fff',
            cursor: isStreaming ? 'not-allowed' : 'pointer',
            color: isStreaming ? '#bfbfbf' : '#595959',
            opacity: isStreaming ? 0.6 : 1 }}
        >
          {t.name}
        </button>
      ))}
    </div>
  )
}
