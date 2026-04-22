import { create } from 'zustand'
import type {
  ModelProvider, KnowledgeBase, Tool, MCPServer, PromptTemplate,
} from '@/types/ai'
import {
  MOCK_MODEL_PROVIDERS, MOCK_KNOWLEDGE_BASES, MOCK_TOOLS,
  MOCK_MCP_SERVERS, MOCK_PROMPT_TEMPLATES, DEFAULT_PROVIDER_ID,
} from '@/mock/ai-config'

export interface AIConfigState {
  providers: ModelProvider[]
  knowledgeBases: KnowledgeBase[]
  tools: Tool[]
  mcpServers: MCPServer[]
  promptTemplates: PromptTemplate[]
  defaultProviderId: string
}

export interface AIConfigActions {
  // Providers
  addProvider: (p: ModelProvider) => void
  updateProvider: (id: string, patch: Partial<ModelProvider>) => void
  removeProvider: (id: string) => void
  toggleProvider: (id: string) => void
  setDefaultProviderId: (id: string) => void

  // Knowledge bases
  addKnowledgeBase: (k: KnowledgeBase) => void
  updateKnowledgeBase: (id: string, patch: Partial<KnowledgeBase>) => void
  removeKnowledgeBase: (id: string) => void
  toggleKnowledgeBase: (id: string) => void

  // Tools
  addTool: (t: Tool) => void
  updateTool: (id: string, patch: Partial<Tool>) => void
  removeTool: (id: string) => void
  toggleTool: (id: string) => void

  // MCP servers
  addMCPServer: (m: MCPServer) => void
  updateMCPServer: (id: string, patch: Partial<MCPServer>) => void
  removeMCPServer: (id: string) => void
  toggleMCPServerTool: (serverId: string, toolName: string) => void

  // Prompt templates
  addPromptTemplate: (p: PromptTemplate) => void
  updatePromptTemplate: (id: string, patch: Partial<PromptTemplate>) => void
  removePromptTemplate: (id: string) => void
}

export const useAIConfigStore = create<AIConfigState & AIConfigActions>()((set) => ({
  providers: MOCK_MODEL_PROVIDERS,
  knowledgeBases: MOCK_KNOWLEDGE_BASES,
  tools: MOCK_TOOLS,
  mcpServers: MOCK_MCP_SERVERS,
  promptTemplates: MOCK_PROMPT_TEMPLATES,
  defaultProviderId: DEFAULT_PROVIDER_ID,

  addProvider: (p) => set((s) => ({ providers: [...s.providers, p] })),
  updateProvider: (id, patch) => set((s) => ({
    providers: s.providers.map(p => p.id === id ? { ...p, ...patch } : p),
  })),
  removeProvider: (id) => set((s) => ({ providers: s.providers.filter(p => p.id !== id) })),
  toggleProvider: (id) => set((s) => ({
    providers: s.providers.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p),
  })),
  setDefaultProviderId: (id) => set({ defaultProviderId: id }),

  addKnowledgeBase: (k) => set((s) => ({ knowledgeBases: [...s.knowledgeBases, k] })),
  updateKnowledgeBase: (id, patch) => set((s) => ({
    knowledgeBases: s.knowledgeBases.map(k => k.id === id ? { ...k, ...patch } : k),
  })),
  removeKnowledgeBase: (id) => set((s) => ({
    knowledgeBases: s.knowledgeBases.filter(k => k.id !== id),
  })),
  toggleKnowledgeBase: (id) => set((s) => ({
    knowledgeBases: s.knowledgeBases.map(k => k.id === id ? { ...k, enabled: !k.enabled } : k),
  })),

  addTool: (t) => set((s) => ({ tools: [...s.tools, t] })),
  updateTool: (id, patch) => set((s) => ({
    tools: s.tools.map(t => t.id === id ? { ...t, ...patch } : t),
  })),
  removeTool: (id) => set((s) => ({ tools: s.tools.filter(t => t.id !== id) })),
  toggleTool: (id) => set((s) => ({
    tools: s.tools.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t),
  })),

  addMCPServer: (m) => set((s) => ({ mcpServers: [...s.mcpServers, m] })),
  updateMCPServer: (id, patch) => set((s) => ({
    mcpServers: s.mcpServers.map(m => m.id === id ? { ...m, ...patch } : m),
  })),
  removeMCPServer: (id) => set((s) => ({
    mcpServers: s.mcpServers.filter(m => m.id !== id),
  })),
  toggleMCPServerTool: (serverId, toolName) => set((s) => ({
    mcpServers: s.mcpServers.map(m => m.id === serverId ? {
      ...m,
      exposedTools: m.exposedTools.map(t => t.name === toolName ? { ...t, enabled: !t.enabled } : t),
    } : m),
  })),

  addPromptTemplate: (p) => set((s) => ({ promptTemplates: [...s.promptTemplates, p] })),
  updatePromptTemplate: (id, patch) => set((s) => ({
    promptTemplates: s.promptTemplates.map(p => p.id === id ? { ...p, ...patch } : p),
  })),
  removePromptTemplate: (id) => set((s) => ({
    promptTemplates: s.promptTemplates.filter(p => p.id !== id),
  })),
}))
