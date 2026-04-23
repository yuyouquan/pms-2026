import { create } from 'zustand'
import type { Conversation, ChatMessage } from '@/types/ai'
import { matchScenario } from '@/lib/ai-matcher'
import { SCENARIOS } from '@/mock/ai-scenarios'
import { useProjectStore } from '@/stores/project'
import { hasProjectAccess } from '@/stores/permission'
import type { ScenarioConfig, ScenarioResponse, ThinkingStep } from '@/types/ai'

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
  drawerOpen: boolean
  sidebarCollapsed: boolean
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
  setDrawerOpen: (open: boolean) => void
  setSidebarCollapsed: (v: boolean) => void
}

const initial = loadFromStorage()

export const useAIChatStore = create<AIChatState & AIChatActions>()((set, get) => ({
  conversations: initial.conversations,
  activeConversationId: initial.activeId,
  currentProjectContext: null,
  isStreaming: false,
  drawerOpen: false,
  sidebarCollapsed: false,

  sendMessage: async (text: string) => {
    const api = get()

    // Ensure there's an active conversation
    if (!api.activeConversationId) {
      api.createConversation()
    }

    // 1) Append user message
    const userMsgId = genId('msg')
    api.appendMessageToActive({
      id: userMsgId, role: 'user', text, timestamp: Date.now(),
    })

    set({ isStreaming: true })

    // 2) Match scenario
    const { projects } = useProjectStore.getState()
    const match = matchScenario(text, {
      projects,
      currentProject: get().currentProjectContext,
      scenarios: SCENARIOS,
    })
    const scenario = SCENARIOS.find(s => s.id === match.scenarioId) as ScenarioConfig

    // 3) Permission check
    let effectiveScenarioId = scenario.id
    let thinkingSteps: ThinkingStep[]
    let response: ScenarioResponse

    if (scenario.requiresProject && match.variables.projectName) {
      const user = useProjectStore.getState().currentLoginUser
      const allowed = hasProjectAccess(user, match.variables.projectName)
      if (!allowed) {
        const projName = match.variables.projectName
        const p = projects.find(x => x.name === projName)
        const spm = p?.spm ?? '未知'
        effectiveScenarioId = 'permission-denied'
        thinkingSteps = [{ icon: '🔒', type: 'permission', target: `权限校验...无 ${projName} 的查看权限`, delay: 600 }]
        response = {
          markdown: `🔒 抱歉，你暂时没有 **${projName}** 的查看权限。该项目的 SPM 是 **${spm}**，请去飞书找他申请。`,
          cards: [{ type: 'permission-notice', data: { projectName: projName, spm } }],
          references: [],
        }
      } else {
        thinkingSteps = scenario.buildThinking(match.variables)
        response = scenario.buildResponse(match.variables)
      }
    } else {
      thinkingSteps = scenario.buildThinking(match.variables)
      response = scenario.buildResponse(match.variables)
    }

    // 4) Append assistant message skeleton
    const asMsgId = genId('msg')
    api.appendMessageToActive({
      id: asMsgId, role: 'assistant', timestamp: Date.now(),
      scenarioId: effectiveScenarioId,
      thinkingSteps, text: response.markdown,
      cards: response.cards, references: response.references,
      streaming: { thinkingRevealed: 0, thinkingCollapsed: false, textRevealed: 0, cardsRevealed: 0, referencesRevealed: false },
    })

    // 5) Drive streaming state machine
    await streamAssistantMessage(asMsgId, thinkingSteps, response, api.patchMessageInActive)

    set({ isStreaming: false })
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
  setDrawerOpen: (open) => set({ drawerOpen: open }),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),

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

// ─── Streaming orchestration ────────────────────────────────────

const TYPING_SPEED = 33 // ms per char (~30 chars/s)

async function streamAssistantMessage(
  messageId: string,
  thinkingSteps: ThinkingStep[],
  response: ScenarioResponse,
  patch: (id: string, p: Partial<import('@/types/ai').ChatMessage>) => void,
) {
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

  // Reveal thinking steps one by one
  for (let i = 0; i < thinkingSteps.length; i++) {
    await sleep(thinkingSteps[i].delay)
    patch(messageId, { streaming: {
      thinkingRevealed: i + 1, thinkingCollapsed: false,
      textRevealed: 0, cardsRevealed: 0, referencesRevealed: false,
    }})
  }

  // Collapse thinking after 300ms
  await sleep(300)
  patch(messageId, { streaming: {
    thinkingRevealed: thinkingSteps.length, thinkingCollapsed: true,
    textRevealed: 0, cardsRevealed: 0, referencesRevealed: false,
  }})

  // Typing effect for markdown
  const fullText = response.markdown
  for (let i = 1; i <= fullText.length; i++) {
    await sleep(TYPING_SPEED)
    patch(messageId, { streaming: {
      thinkingRevealed: thinkingSteps.length, thinkingCollapsed: true,
      textRevealed: i, cardsRevealed: 0, referencesRevealed: false,
    }})
  }

  // Reveal cards one by one (200ms apart)
  for (let i = 0; i < response.cards.length; i++) {
    await sleep(200)
    patch(messageId, { streaming: {
      thinkingRevealed: thinkingSteps.length, thinkingCollapsed: true,
      textRevealed: fullText.length, cardsRevealed: i + 1, referencesRevealed: false,
    }})
  }

  // Finally reveal references
  await sleep(200)
  patch(messageId, { streaming: {
    thinkingRevealed: thinkingSteps.length, thinkingCollapsed: true,
    textRevealed: fullText.length, cardsRevealed: response.cards.length, referencesRevealed: true,
  }})
}
