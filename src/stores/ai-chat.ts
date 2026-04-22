import { create } from 'zustand'
import type { Conversation, ChatMessage } from '@/types/ai'

const STORAGE_KEY = 'pms-2026-ai-chat'

function loadFromStorage(): { conversations: Conversation[]; activeId: string | null } {
  if (typeof window === 'undefined') return { conversations: [], activeId: null }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { conversations: [], activeId: null }
    const parsed = JSON.parse(raw)
    return { conversations: parsed.conversations ?? [], activeId: parsed.activeId ?? null }
  } catch {
    return { conversations: [], activeId: null }
  }
}

function saveToStorage(state: { conversations: Conversation[]; activeConversationId: string | null }) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      conversations: state.conversations,
      activeId: state.activeConversationId,
    }))
  } catch { /* ignore quota */ }
}

function genId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export interface AIChatState {
  conversations: Conversation[]
  activeConversationId: string | null
  currentProjectContext: string | null
  isStreaming: boolean
}

export interface AIChatActions {
  sendMessage: (text: string) => Promise<void>
  createConversation: () => string
  setActiveConversation: (id: string) => void
  renameConversation: (id: string, title: string) => void
  pinConversation: (id: string) => void
  deleteConversation: (id: string) => void
  bindProject: (projectName: string | null) => void
  appendMessageToActive: (msg: ChatMessage) => void
  patchMessageInActive: (messageId: string, patch: Partial<ChatMessage>) => void
}

const initial = loadFromStorage()

export const useAIChatStore = create<AIChatState & AIChatActions>()((set, get) => ({
  conversations: initial.conversations,
  activeConversationId: initial.activeId,
  currentProjectContext: null,
  isStreaming: false,

  sendMessage: async (_text: string) => {
    // Placeholder: real implementation wired in Task 13
    throw new Error('sendMessage not implemented yet (see Task 13)')
  },

  createConversation: () => {
    const id = genId('conv')
    const conv: Conversation = {
      id, title: '新对话', messages: [], pinned: false,
      boundProject: get().currentProjectContext,
      createdAt: Date.now(), updatedAt: Date.now(),
    }
    set((s) => {
      const next = { conversations: [conv, ...s.conversations], activeConversationId: id }
      saveToStorage({ ...s, ...next })
      return next
    })
    return id
  },

  setActiveConversation: (id) => set((s) => {
    saveToStorage({ ...s, activeConversationId: id })
    return { activeConversationId: id }
  }),

  renameConversation: (id, title) => set((s) => {
    const next = { conversations: s.conversations.map(c => c.id === id ? { ...c, title, updatedAt: Date.now() } : c) }
    saveToStorage({ ...s, ...next })
    return next
  }),

  pinConversation: (id) => set((s) => {
    const next = { conversations: s.conversations.map(c => c.id === id ? { ...c, pinned: !c.pinned } : c) }
    saveToStorage({ ...s, ...next })
    return next
  }),

  deleteConversation: (id) => set((s) => {
    const remaining = s.conversations.filter(c => c.id !== id)
    const nextActive = s.activeConversationId === id ? (remaining[0]?.id ?? null) : s.activeConversationId
    const next = { conversations: remaining, activeConversationId: nextActive }
    saveToStorage({ ...s, ...next })
    return next
  }),

  bindProject: (projectName) => set({ currentProjectContext: projectName }),

  appendMessageToActive: (msg) => set((s) => {
    if (!s.activeConversationId) return s
    const next = {
      conversations: s.conversations.map(c => c.id === s.activeConversationId
        ? { ...c, messages: [...c.messages, msg], updatedAt: Date.now(),
            title: c.messages.length === 0 && msg.role === 'user' && msg.text
                   ? msg.text.slice(0, 20) : c.title }
        : c),
    }
    saveToStorage({ ...s, ...next })
    return next
  }),

  patchMessageInActive: (messageId, patch) => set((s) => {
    if (!s.activeConversationId) return s
    const next = {
      conversations: s.conversations.map(c => c.id === s.activeConversationId
        ? { ...c, messages: c.messages.map(m => m.id === messageId ? { ...m, ...patch } : m) }
        : c),
    }
    saveToStorage({ ...s, ...next })
    return next
  }),
}))
