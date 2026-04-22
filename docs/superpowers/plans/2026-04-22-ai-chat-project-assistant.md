# AI Chat 项目助手 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 PMS-2026 前端工程中交付一个 demo 级 AI 能力：独立的「智能助手」Chat 模块 + 配置中心下的「AI 配置」tab。Chat 用关键词 mock 回答 4 类项目相关问题，配置页展示模型/知识库/工具/MCP/提示词 5 类可编辑资源。

**Architecture:** 纯前端实现，无后端。Zustand 承载两个新 store（`ai-config` 和 `ai-chat`）。关键词匹配引擎以纯函数形式实现并覆盖单元测试。所有"思考过程/工具调用"都是视觉演出。配置页的资源名与场景配置通过字面量对齐以形成闭环感。权限检查复用现有 `permissionStore` + `PROJECT_MEMBER_MAP`。

**Tech Stack:** Next.js 14, React 18, Ant Design 6.3.1, Zustand 4.5, Tailwind CSS, TypeScript 5.5；新增 vitest 作为最小测试运行器。

**Spec:** `docs/superpowers/specs/2026-04-22-ai-chat-project-assistant-design.md`

---

## 文件结构总览

### 新建文件
- `src/types/ai.ts` — 所有 AI 相关类型
- `src/mock/ai-config.ts` — 5 类资源预填充数据
- `src/mock/ai-scenarios.ts` — 4 个场景 + 兜底配置
- `src/stores/ai-config.ts`
- `src/stores/ai-chat.ts`
- `src/lib/ai-matcher.ts`
- `src/lib/ai-matcher.test.ts`
- `vitest.config.ts`
- `src/containers/AIAssistantContainer.tsx`
- `src/components/ai/` 目录下：
  - `ChatHeader.tsx`, `ConversationSidebar.tsx`, `MessageList.tsx`, `MessageBubble.tsx`
  - `ThinkingProcess.tsx`, `ResponseCard.tsx`, `ReferenceList.tsx`
  - `QuickPromptChips.tsx`, `ChatInput.tsx`
  - `cards/ProjectInfoCard.tsx`, `cards/LinkCard.tsx`, `cards/PermissionNoticeCard.tsx`, `cards/NextActionCard.tsx`
  - `cards/RiskPlansCard.tsx`, `cards/PlansTableCard.tsx`
  - `cards/RequirementDistCard.tsx`, `cards/TransferFlowCard.tsx`
  - `config/AIConfigPanel.tsx` (容器)
  - `config/ModelProviderPanel.tsx`, `config/KnowledgeBasePanel.tsx`
  - `config/ToolsPanel.tsx`, `config/MCPServersPanel.tsx`, `config/PromptTemplatesPanel.tsx`

### 修改文件
- `src/stores/permission.ts` — 增加 `hasProjectAccess` 辅助函数
- `src/app/page.tsx` — 增加 `aiAssistant` 模块分支
- `src/containers/AppShell.tsx` — MainHeader 增加导航项与全局 AI 按钮
- `src/containers/ConfigContainer.tsx` — 增加 "AI 配置" tab 挂载 `AIConfigPanel`
- `package.json` — 增加 vitest devDep 与 test 脚本

---

## Task 1: 安装 vitest 并配置

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: 安装 vitest**

```bash
npm install --save-dev vitest@^2.0.0
```

- [ ] **Step 2: 创建 vitest 配置**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
```

- [ ] **Step 3: 在 package.json 添加 test 脚本**

在 `"scripts"` 对象中追加（保持其他脚本不变）：
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: 验证 vitest 可运行**

Run: `npx vitest run --reporter=verbose`
Expected: 输出 "No test files found"（此时未写测试文件，这就是预期结果）

- [ ] **Step 5: 提交**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest for ai-matcher unit tests"
```

---

## Task 2: 创建 AI 类型定义

**Files:**
- Create: `src/types/ai.ts`

- [ ] **Step 1: 写类型定义文件**

Create `src/types/ai.ts`:
```ts
// ─── 配置层 ────────────────────────────────────────────────────

export type ModelProvider = {
  id: string
  name: string
  logo?: string
  enabled: boolean
  apiEndpoint?: string
  apiKey?: string
  defaultModel?: string
  models: string[]
  temperature: number
  maxTokens: number
}

export type KnowledgeBase = {
  id: string
  name: string
  type: 'structured' | 'document'
  recordCount?: number
  size?: string
  fields?: string[]
  visibleRoles?: string[]
  indexStatus: 'ready' | 'indexing' | 'error'
  enabled: boolean
}

export type Tool = {
  id: string
  name: string
  type: 'cli' | 'http' | 'function' | 'shell'
  callTemplate: string
  relatedSystem?: string
  paramSchema?: Record<string, { type: string; required: boolean }>
  enabled: boolean
}

export type MCPServer = {
  id: string
  name: string
  protocol: 'stdio' | 'sse' | 'http'
  endpoint: string
  envVars?: Record<string, string>
  connectionStatus: 'connected' | 'disconnected' | 'error'
  exposedTools: { name: string; description: string; enabled: boolean }[]
}

export type PromptTemplate = {
  id: string
  name: string
  category: 'analysis' | 'query' | 'flow'
  description?: string
  content: string
  placeholders: string[]
  showInQuickChips: boolean
}

// ─── 场景层 ────────────────────────────────────────────────────

export type ScenarioId =
  | 'project-basic-info'
  | 'project-plans'
  | 'requirement-status'
  | 'transfer-status'
  | 'fallback'
  | 'permission-denied'

export type ThinkingStep = {
  icon: '🔍' | '🔧' | '🌐' | '💭' | '🔒'
  type: 'knowledge' | 'tool' | 'mcp' | 'reasoning' | 'permission'
  target: string
  delay: number
  note?: string
}

export type ProjectInfoCardData = {
  name: string
  spm: string
  schedule: string
  currentVersion: string
  status: string
  description: string
}

export type RiskPlanItem = {
  planType: string
  planName: string
  owner: string
  reason: string
}

export type RiskPlanCardData = {
  items: RiskPlanItem[]
}

export type PlanRow = {
  id: string
  type: '版本' | '需求' | '开发' | '测试' | '其他'
  name: string
  owner: string
  progress: number
  deadline: string
  status: string
  isRisk: boolean
}

export type PlansTableData = {
  projectName: string
  filters: { key: string; label: string; count: number }[]
  activeFilter: string
  rows: PlanRow[]
}

export type RequirementDistData = {
  projectName: string
  totalCount: number
  distribution: { status: string; count: number; color: string }[]
  requirements: { id: string; name: string; owner: string; status: string; priority: string; blockReason?: string }[]
}

export type TransferStage = {
  name: string
  status: 'done' | 'current' | 'pending'
  owner?: string
  dueDate?: string
  pendingItems?: string[]
}

export type TransferFlowData = {
  projectName: string
  stages: TransferStage[]
  currentStageIndex: number
}

export type NextActionData = {
  stageName: string
  actions: string[]
}

export type ResponseCard =
  | { type: 'project-info'; data: ProjectInfoCardData }
  | { type: 'risk-plans'; data: RiskPlanCardData }
  | { type: 'plans-table'; data: PlansTableData }
  | { type: 'requirement-dist'; data: RequirementDistData }
  | { type: 'transfer-flow'; data: TransferFlowData }
  | { type: 'next-action'; data: NextActionData }
  | { type: 'link'; data: { text: string; href: string; module?: string; projectId?: string } }
  | { type: 'permission-notice'; data: { projectName: string; spm: string } }

export type ReferenceItem = {
  label: string
  index: number
}

export type ScenarioResponse = {
  markdown: string
  cards: ResponseCard[]
  references: ReferenceItem[]
}

export type ScenarioVars = {
  projectName?: string
  ownership?: 'all' | 'mine'
  planType?: '版本' | '需求' | '开发' | '测试'
  rawInput?: string
}

export type ScenarioConfig = {
  id: ScenarioId
  name: string
  keywords: string[][]
  requiresProject: boolean
  modifiers?: {
    ownership?: string[]
    planType?: string[]
  }
  priority: number
  buildThinking: (vars: ScenarioVars) => ThinkingStep[]
  buildResponse: (vars: ScenarioVars) => ScenarioResponse
}

export type MatchResult = {
  scenarioId: ScenarioId
  variables: ScenarioVars
}

// ─── 会话层 ────────────────────────────────────────────────────

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text?: string
  thinkingSteps?: ThinkingStep[]
  cards?: ResponseCard[]
  references?: ReferenceItem[]
  timestamp: number
  scenarioId?: ScenarioId
  // Streaming state (for rendering progress)
  streaming?: {
    thinkingRevealed: number   // 已显示的思考步数
    thinkingCollapsed: boolean
    textRevealed: number       // 已显示的正文字符数
    cardsRevealed: number      // 已显示的卡片数
    referencesRevealed: boolean
  }
}

export type Conversation = {
  id: string
  title: string
  messages: ChatMessage[]
  pinned: boolean
  boundProject: string | null
  createdAt: number
  updatedAt: number
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误退出（exit code 0）

- [ ] **Step 3: 提交**

```bash
git add src/types/ai.ts
git commit -m "feat(ai): add type definitions for chat + config"
```

---

## Task 3: 给 permissionStore 增加 hasProjectAccess

**Files:**
- Modify: `src/stores/permission.ts` (append helper at end of file)

**说明：** `PROJECT_MEMBER_MAP` 在 `src/stores/project.ts` 定义（key 为项目 id，value 为成员姓名数组）。`isGlobalAdmin` 已在 permission.ts 定义。项目名到 id 的映射通过 `projectStore.projects` 查找。

- [ ] **Step 1: 在 permission.ts 末尾追加辅助函数**

在文件末尾添加（`useHasPermission` 之后）：
```ts
// Check if user can view a project. Admin group bypasses; otherwise must be
// listed in PROJECT_MEMBER_MAP for that project.
import { PROJECT_MEMBER_MAP, useProjectStore } from '@/stores/project'

export function hasProjectAccess(userName: string, projectNameOrId: string): boolean {
  if (!userName || !projectNameOrId) return false
  if (isGlobalAdmin(userName)) return true

  // Resolve project name → id (if not already id)
  let projectId = projectNameOrId
  const byName = useProjectStore.getState().projects.find(
    p => p.name === projectNameOrId || p.id === projectNameOrId
  )
  if (byName) projectId = byName.id

  const members = PROJECT_MEMBER_MAP[projectId] || []
  return members.includes(userName)
}
```

**注意：** 不要在文件顶部加 import（会与现有结构冲突且可能形成循环依赖）。在函数内部使用 `useProjectStore.getState()` 读取即时状态即可。

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/stores/permission.ts
git commit -m "feat(permission): add hasProjectAccess helper for AI chat gate"
```

---

## Task 4: 建立 AI 配置的预填充 mock 数据

**Files:**
- Create: `src/mock/ai-config.ts`

- [ ] **Step 1: 创建 mock 数据文件**

Create `src/mock/ai-config.ts`:
```ts
import type {
  ModelProvider,
  KnowledgeBase,
  Tool,
  MCPServer,
  PromptTemplate,
} from '@/types/ai'

export const MOCK_MODEL_PROVIDERS: ModelProvider[] = [
  {
    id: 'openai', name: 'OpenAI', enabled: true,
    apiEndpoint: 'https://api.openai.com/v1', apiKey: 'sk-••••••••',
    defaultModel: 'gpt-4o', models: ['gpt-4o', 'gpt-4-turbo'],
    temperature: 0.7, maxTokens: 2048,
  },
  {
    id: 'anthropic', name: 'Anthropic', enabled: true,
    apiEndpoint: 'https://api.anthropic.com/v1', apiKey: 'sk-ant-••••••••',
    defaultModel: 'claude-opus-4-7',
    models: ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
    temperature: 0.7, maxTokens: 4096,
  },
  {
    id: 'internal', name: '公司内网模型', enabled: true,
    apiEndpoint: 'http://llm.internal.company/v1', apiKey: '••••••••',
    defaultModel: 'internal-llm-v3', models: ['internal-llm-v3'],
    temperature: 0.5, maxTokens: 2048,
  },
  { id: 'qwen', name: '阿里通义', enabled: false, models: [], temperature: 0.7, maxTokens: 2048 },
  { id: 'wenxin', name: '百度文心', enabled: false, models: [], temperature: 0.7, maxTokens: 2048 },
  { id: 'glm', name: '智谱 GLM', enabled: false, models: [], temperature: 0.7, maxTokens: 2048 },
  { id: 'ollama', name: 'Ollama 本地', enabled: false, models: [], temperature: 0.7, maxTokens: 2048 },
  { id: 'custom', name: '自定义 (OpenAI 兼容)', enabled: false, models: [], temperature: 0.7, maxTokens: 2048 },
]

export const MOCK_KNOWLEDGE_BASES: KnowledgeBase[] = [
  // Structured
  { id: 'kb-projects', name: '项目主表', type: 'structured', recordCount: 146,
    fields: ['id', 'name', 'status', 'spm', 'progress', '+ 20 more'],
    visibleRoles: ['系统管理员', '项目经理', '产品经理', '管理层'],
    indexStatus: 'ready', enabled: true },
  { id: 'kb-versions', name: '版本主表', type: 'structured', recordCount: 89,
    fields: ['id', 'projectId', 'versionName', 'status', 'planDate', '+ 13 more'],
    visibleRoles: ['系统管理员', '项目经理', '产品经理'],
    indexStatus: 'ready', enabled: true },
  { id: 'kb-transfer', name: '转维申请表', type: 'structured', recordCount: 8,
    fields: ['id', 'projectId', 'applicant', 'stage', 'status', '+ 27 more'],
    visibleRoles: ['系统管理员', '项目经理', '软件SE'],
    indexStatus: 'ready', enabled: true },
  { id: 'kb-roadmap', name: '路标视图数据', type: 'structured', recordCount: 146,
    fields: ['projectId', 'milestone', 'planDate', 'actualDate', '+ 8 more'],
    visibleRoles: ['系统管理员', '项目经理', '管理层'],
    indexStatus: 'ready', enabled: true },
  { id: 'kb-todos', name: '待办与计划', type: 'structured', recordCount: 234,
    fields: ['id', 'projectId', 'planType', 'name', 'owner', 'status', 'priority', 'deadline', '+ 7 more'],
    visibleRoles: ['系统管理员', '项目经理', '开发工程师', '测试工程师'],
    indexStatus: 'ready', enabled: true },
  // Documents
  { id: 'kb-tm-manual', name: '转维操作手册 V3.pdf', type: 'document', size: '1.2 MB',
    indexStatus: 'ready', enabled: true },
  { id: 'kb-mr-process', name: 'MR 版本发布流程.md', type: 'document', size: '24 KB',
    indexStatus: 'ready', enabled: true },
  { id: 'kb-health-rules', name: '项目健康度评分标准.docx', type: 'document', size: '56 KB',
    indexStatus: 'indexing', enabled: true },
]

export const MOCK_TOOLS: Tool[] = [
  { id: 'tool-gitlab', name: 'gitlab-cli', type: 'cli',
    callTemplate: 'glab issue list --project={project_key}',
    relatedSystem: 'GitLab', enabled: true },
  { id: 'tool-jenkins', name: 'jenkins-cli', type: 'cli',
    callTemplate: 'jenkins-cli build {job_name}',
    relatedSystem: 'Jenkins', enabled: true },
  { id: 'tool-jump', name: '项目空间跳转', type: 'function',
    callTemplate: 'navigateToProjectSpace({projectId})',
    relatedSystem: 'PMS', enabled: true },
  { id: 'tool-jira', name: 'Jira HTTP API', type: 'http',
    callTemplate: 'GET /rest/api/2/search?jql=project={key}',
    relatedSystem: 'Jira', enabled: true },
  { id: 'tool-wx', name: '发送企微通知', type: 'http',
    callTemplate: 'POST /cgi-bin/webhook/send {json}',
    relatedSystem: '企业微信', enabled: true },
  { id: 'tool-script', name: '自定义脚本', type: 'shell',
    callTemplate: 'bash ./scripts/{script_name}.sh',
    relatedSystem: '本地', enabled: false },
]

export const MOCK_MCP_SERVERS: MCPServer[] = [
  { id: 'mcp-jira', name: 'Jira MCP Server', protocol: 'sse',
    endpoint: 'https://jira.internal.company/mcp/sse',
    connectionStatus: 'connected',
    exposedTools: [
      { name: 'jira_search_issues', description: '搜索 issue', enabled: true },
      { name: 'jira_get_issue', description: '获取 issue 详情', enabled: true },
      { name: 'jira_create_issue', description: '创建 issue', enabled: true },
      { name: 'jira_update_issue', description: '更新 issue', enabled: true },
      { name: 'jira_transition_issue', description: '切换状态', enabled: true },
      { name: 'jira_list_projects', description: '列项目', enabled: true },
      { name: 'jira_get_user', description: '获取用户', enabled: true },
      { name: 'jira_add_comment', description: '添加评论', enabled: true },
    ] },
  { id: 'mcp-confluence', name: 'Confluence MCP', protocol: 'http',
    endpoint: 'https://confluence.internal.company/mcp',
    connectionStatus: 'connected',
    exposedTools: [
      { name: 'cf_search_pages', description: '搜索页面', enabled: true },
      { name: 'cf_get_page', description: '获取页面', enabled: true },
      { name: 'cf_create_page', description: '创建页面', enabled: true },
      { name: 'cf_update_page', description: '更新页面', enabled: true },
      { name: 'cf_list_spaces', description: '列空间', enabled: true },
    ] },
  { id: 'mcp-review', name: '代码审查 MCP (内部)', protocol: 'stdio',
    endpoint: '/usr/local/bin/code-review-mcp',
    connectionStatus: 'connected',
    exposedTools: [
      { name: 'review_diff', description: '审查 diff', enabled: true },
      { name: 'check_coverage', description: '覆盖率检查', enabled: true },
      { name: 'lint_files', description: 'Lint 检查', enabled: true },
    ] },
  { id: 'mcp-figma', name: 'Figma MCP', protocol: 'sse',
    endpoint: 'https://figma-mcp.example.com/sse',
    connectionStatus: 'error',
    exposedTools: [] },
]

export const MOCK_PROMPT_TEMPLATES: PromptTemplate[] = [
  { id: 'pt-1', name: '项目基本情况', category: 'query',
    description: '查询项目的基础信息',
    content: '{项目名} 的基本情况', placeholders: ['项目名'], showInQuickChips: true },
  { id: 'pt-2', name: '项目负责人是谁', category: 'query',
    description: '查询项目负责人',
    content: '{项目名} 是谁负责的', placeholders: ['项目名'], showInQuickChips: true },
  { id: 'pt-3', name: '项目所有计划', category: 'query',
    description: '列出项目全部计划',
    content: '{项目名} 的所有计划', placeholders: ['项目名'], showInQuickChips: true },
  { id: 'pt-4', name: '我负责的计划', category: 'query',
    description: '过滤当前用户负责的计划',
    content: '我在 {项目名} 负责的计划', placeholders: ['项目名'], showInQuickChips: true },
  { id: 'pt-5', name: '版本计划', category: 'query',
    description: '查询版本类计划',
    content: '{项目名} 的版本计划', placeholders: ['项目名'], showInQuickChips: false },
  { id: 'pt-6', name: '需求状态汇总', category: 'analysis',
    description: '分析需求状态分布',
    content: '{项目名} 的需求进展', placeholders: ['项目名'], showInQuickChips: true },
  { id: 'pt-7', name: '需求阻塞情况', category: 'analysis',
    description: '查询阻塞的需求',
    content: '{项目名} 有哪些阻塞的需求', placeholders: ['项目名'], showInQuickChips: false },
  { id: 'pt-8', name: '转维进度', category: 'flow',
    description: '查询转维当前进度',
    content: '{项目名} 转维到哪一步了', placeholders: ['项目名'], showInQuickChips: true },
  { id: 'pt-9', name: '转维下一步', category: 'flow',
    description: '查询转维下一步动作',
    content: '{项目名} 转维下一步该做什么', placeholders: ['项目名'], showInQuickChips: false },
  { id: 'pt-10', name: '转维负责人', category: 'flow',
    description: '查询当前转维处理人',
    content: '{项目名} 当前转维是谁在处理', placeholders: ['项目名'], showInQuickChips: false },
]

export const DEFAULT_PROVIDER_ID = 'anthropic'
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/mock/ai-config.ts
git commit -m "feat(ai): add mock data for 5 AI config resources"
```

---

## Task 5: 创建 ai-config Zustand store

**Files:**
- Create: `src/stores/ai-config.ts`

- [ ] **Step 1: 创建 store 文件**

Create `src/stores/ai-config.ts`:
```ts
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
```

- [ ] **Step 2: 验证编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/stores/ai-config.ts
git commit -m "feat(ai): add ai-config zustand store with CRUD actions"
```

---

## Task 6: 创建 ai-chat store 骨架

**Files:**
- Create: `src/stores/ai-chat.ts`

**说明：** 此时 `sendMessage` 只做占位实现（写用户消息 + 追加一条空 assistant 消息，不做真正的匹配/权限/流式）。实际逻辑在 Task 13 填入。但骨架包含所有会话级 actions，UI 层可以先开发。

- [ ] **Step 1: 创建 store 文件**

Create `src/stores/ai-chat.ts`:
```ts
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
```

- [ ] **Step 2: 验证编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/stores/ai-chat.ts
git commit -m "feat(ai): add ai-chat store skeleton with localStorage persistence"
```

---

## Task 7: 实现关键词匹配器（TDD）

**Files:**
- Create: `src/lib/ai-matcher.ts`
- Create: `src/lib/ai-matcher.test.ts`

- [ ] **Step 1: 写失败的测试**

Create `src/lib/ai-matcher.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { matchScenario, normalize, extractProjectName } from './ai-matcher'
import type { ScenarioConfig } from '@/types/ai'

// Fixture: minimal scenario configs for testing
const SCENARIOS: ScenarioConfig[] = [
  {
    id: 'project-basic-info', name: '基本信息',
    keywords: [['基本情况'], ['信息'], ['详情'], ['负责人']],
    requiresProject: true, priority: 5,
    buildThinking: () => [], buildResponse: () => ({ markdown: '', cards: [], references: [] }),
  },
  {
    id: 'project-plans', name: '计划',
    keywords: [['计划'], ['任务'], ['排期']],
    requiresProject: true, priority: 5,
    modifiers: {
      ownership: ['我', '我的', '我负责', '自己'],
      planType: ['版本', '需求', '开发', '测试'],
    },
    buildThinking: () => [], buildResponse: () => ({ markdown: '', cards: [], references: [] }),
  },
  {
    id: 'requirement-status', name: '需求状态',
    keywords: [['需求', '进展'], ['需求', '状态']],
    requiresProject: true, priority: 5,
    buildThinking: () => [], buildResponse: () => ({ markdown: '', cards: [], references: [] }),
  },
  {
    id: 'transfer-status', name: '转维',
    keywords: [['转维']],
    requiresProject: true, priority: 5,
    buildThinking: () => [], buildResponse: () => ({ markdown: '', cards: [], references: [] }),
  },
  {
    id: 'fallback', name: '兜底',
    keywords: [], requiresProject: false, priority: 0,
    buildThinking: () => [], buildResponse: () => ({ markdown: '', cards: [], references: [] }),
  },
]

const PROJECTS = [
  { id: '1', name: 'MR V2.3' },
  { id: '2', name: 'DS V1.0' },
  { id: '3', name: 'X6877-D8400_H991' },
]

describe('normalize', () => {
  it('converts uppercase English to lowercase', () => {
    expect(normalize('Hello WORLD')).toContain('hello world')
  })
  it('trims spaces', () => {
    expect(normalize('  foo  bar  ')).toBe('foo bar')
  })
})

describe('extractProjectName', () => {
  it('finds project name by exact match', () => {
    expect(extractProjectName('查询 MR V2.3 的信息', PROJECTS)).toBe('MR V2.3')
  })
  it('finds project name with whitespace variations (fuzzy)', () => {
    expect(extractProjectName('MR2.3 进度', PROJECTS)).toBe('MR V2.3')
  })
  it('prefers longest match when names overlap', () => {
    expect(extractProjectName('X6877-D8400_H991 状态', PROJECTS)).toBe('X6877-D8400_H991')
  })
  it('returns null when no project name present', () => {
    expect(extractProjectName('今天天气不错', PROJECTS)).toBeNull()
  })
})

describe('matchScenario', () => {
  const ctx = { projects: PROJECTS, currentProject: null, scenarios: SCENARIOS }

  it('matches project-basic-info by keyword + project name', () => {
    const r = matchScenario('MR V2.3 的基本情况', ctx)
    expect(r.scenarioId).toBe('project-basic-info')
    expect(r.variables.projectName).toBe('MR V2.3')
  })

  it('matches project-plans with ownership modifier', () => {
    const r = matchScenario('我在 MR V2.3 负责的计划', ctx)
    expect(r.scenarioId).toBe('project-plans')
    expect(r.variables.ownership).toBe('mine')
  })

  it('matches project-plans with planType modifier', () => {
    const r = matchScenario('MR V2.3 的版本计划', ctx)
    expect(r.scenarioId).toBe('project-plans')
    expect(r.variables.planType).toBe('版本')
  })

  it('defaults ownership to all when no "我" modifier', () => {
    const r = matchScenario('MR V2.3 的所有计划', ctx)
    expect(r.scenarioId).toBe('project-plans')
    expect(r.variables.ownership).toBe('all')
  })

  it('matches requirement-status with AND-grouped keywords', () => {
    const r = matchScenario('MR V2.3 需求状态如何', ctx)
    expect(r.scenarioId).toBe('requirement-status')
  })

  it('matches transfer-status', () => {
    const r = matchScenario('MR V2.3 转维到哪一步了', ctx)
    expect(r.scenarioId).toBe('transfer-status')
  })

  it('falls back to current project context when no name in input', () => {
    const r = matchScenario('计划怎么样', { ...ctx, currentProject: 'DS V1.0' })
    expect(r.scenarioId).toBe('project-plans')
    expect(r.variables.projectName).toBe('DS V1.0')
  })

  it('returns fallback when no scenario matches', () => {
    const r = matchScenario('今天天气怎么样', ctx)
    expect(r.scenarioId).toBe('fallback')
  })

  it('returns fallback when scenario matches but no project identified', () => {
    const r = matchScenario('基本情况是什么', ctx)
    expect(r.scenarioId).toBe('fallback')
  })
})
```

- [ ] **Step 2: 验证测试失败（matcher 还没实现）**

Run: `npx vitest run src/lib/ai-matcher.test.ts`
Expected: FAIL with "Cannot find module './ai-matcher'"

- [ ] **Step 3: 实现 ai-matcher.ts**

Create `src/lib/ai-matcher.ts`:
```ts
import type { ScenarioConfig, ScenarioVars, MatchResult } from '@/types/ai'

export function normalize(input: string): string {
  return input.toLowerCase().replace(/\s+/g, ' ').trim()
}

type ProjectRef = { id: string; name: string }

/**
 * Find a project name in the input using:
 * 1. Exact substring match (longest first)
 * 2. Fuzzy match: strip whitespace from both sides, compare
 */
export function extractProjectName(
  input: string,
  projects: ProjectRef[],
): string | null {
  const normInput = normalize(input)
  const normNoSpace = normInput.replace(/\s+/g, '')

  // Sort by length desc to prefer longest match
  const sorted = [...projects].sort((a, b) => b.name.length - a.name.length)

  for (const p of sorted) {
    const normName = p.name.toLowerCase()
    const normNameNoSpace = normName.replace(/\s+/g, '')
    if (normInput.includes(normName) || normNoSpace.includes(normNameNoSpace)) {
      return p.name
    }
  }
  return null
}

type MatchCtx = {
  projects: ProjectRef[]
  currentProject: string | null
  scenarios: ScenarioConfig[]
}

export function matchScenario(rawInput: string, ctx: MatchCtx): MatchResult {
  const normInput = normalize(rawInput)
  const projectName = extractProjectName(rawInput, ctx.projects) ?? ctx.currentProject ?? undefined

  // Score each scenario
  const nonFallback = ctx.scenarios.filter(s => s.id !== 'fallback')
  const matched = nonFallback
    .filter(s => {
      if (s.requiresProject && !projectName) return false
      // keywords is OR of AND-groups
      return s.keywords.some(group => group.every(kw => normInput.includes(kw.toLowerCase())))
    })
    .sort((a, b) => b.priority - a.priority)

  if (matched.length === 0) {
    return { scenarioId: 'fallback', variables: { rawInput } }
  }

  const chosen = matched[0]
  const variables: ScenarioVars = { projectName, rawInput }

  // Scenario #2 (project-plans) modifier extraction
  if (chosen.id === 'project-plans' && chosen.modifiers) {
    const hasOwnership = (chosen.modifiers.ownership ?? []).some(w => normInput.includes(w))
    variables.ownership = hasOwnership ? 'mine' : 'all'
    const foundType = (chosen.modifiers.planType ?? []).find(w => normInput.includes(w))
    if (foundType) variables.planType = foundType as ScenarioVars['planType']
  }

  return { scenarioId: chosen.id, variables }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run src/lib/ai-matcher.test.ts`
Expected: 所有测试 PASS（11 个 test cases 全过）

- [ ] **Step 5: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 6: 提交**

```bash
git add src/lib/ai-matcher.ts src/lib/ai-matcher.test.ts
git commit -m "feat(ai): implement keyword matcher with 11 unit tests"
```

---

## Task 8: 建立 ai-scenarios 骨架 + 兜底场景

**Files:**
- Create: `src/mock/ai-scenarios.ts`

- [ ] **Step 1: 写骨架与兜底**

Create `src/mock/ai-scenarios.ts`:
```ts
import type { ScenarioConfig, ThinkingStep, ScenarioVars } from '@/types/ai'

// ─── Shared helpers ─────────────────────────────────────────────

/** Standard delay sequence for thinking steps. */
export const STEP_DELAYS = [400, 500, 500, 500, 400]

/** Build a simple note suffix. */
function kb(target: string, delay = 500): ThinkingStep {
  return { icon: '🔍', type: 'knowledge', target, delay }
}
function tool(target: string, delay = 500): ThinkingStep {
  return { icon: '🔧', type: 'tool', target, delay }
}
function mcp(target: string, delay = 500): ThinkingStep {
  return { icon: '🌐', type: 'mcp', target, delay }
}
function reasoning(target: string, delay = 400): ThinkingStep {
  return { icon: '💭', type: 'reasoning', target, delay }
}

// ─── Fallback ──────────────────────────────────────────────────

const FALLBACK: ScenarioConfig = {
  id: 'fallback',
  name: '兜底',
  keywords: [],
  requiresProject: false,
  priority: 0,
  buildThinking: () => [],
  buildResponse: () => ({
    markdown: '这个问题超出了我当前的能力范围 😅 试试这些我能回答的：',
    cards: [],
    references: [],
  }),
}

// Individual scenarios are exported as placeholders here, filled in later tasks.
// They will be added to SCENARIOS array below once implemented.
export const SCENARIOS: ScenarioConfig[] = [
  FALLBACK,
]

// Helper shared by scenario builders
export { kb, tool, mcp, reasoning }
```

- [ ] **Step 2: 验证编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/mock/ai-scenarios.ts
git commit -m "feat(ai): add scenarios scaffolding with fallback"
```

---

## Task 9: 场景 ① 项目基础信息查询

**Files:**
- Modify: `src/mock/ai-scenarios.ts`

**说明：** 场景 ① 需要返回项目基础信息卡片 + 风险计划项卡片（若存在风险）。风险识别规则见 spec §6.1。因 demo 项目的计划数据规模不足，我们直接为每个有效项目预置 2-3 条"已计算好的风险项"作为 mock。

- [ ] **Step 1: 在 ai-scenarios.ts 追加场景 ① 实现**

在 `src/mock/ai-scenarios.ts` 文件中：
- 在 `import` 后增加：`import { useProjectStore, PROJECT_MEMBER_MAP } from '@/stores/project'`（实际上 project.ts 已 export 这两者）
- 在 `// ─── Fallback ──` 段**前面**插入场景 ①：

```ts
// ─── Scenario ① 项目基础信息查询 ──────────────────────────────

const MOCK_RISK_PLANS: Record<string, { planType: string; planName: string; owner: string; reason: string }[]> = {
  // keyed by project name — each project gets 0-3 risk items
  'X6877-D8400_H991': [
    { planType: '需求', planName: '支付流程重构', owner: '张三', reason: '延期 2 天' },
    { planType: '开发', planName: 'UI 组件升级', owner: '李四', reason: '阻塞中' },
    { planType: '版本', planName: 'V2.3 发布', owner: '王五', reason: '3 天内截止' },
  ],
  'tOS16.0': [
    { planType: '测试', planName: '回归测试全量', owner: '孙七', reason: '阻塞中' },
  ],
  'X6873_H972': [
    { planType: '开发', planName: 'Camera HAL 适配', owner: '周八', reason: '延期 5 天' },
    { planType: '需求', planName: 'AOD 界面', owner: '李白', reason: '紧急' },
  ],
  // others: empty (no risks)
}

const MOCK_PROJECT_DESC: Record<string, string> = {
  'X6877-D8400_H991': '面向 OP/TR/RU 市场的整机产品项目，搭载 Android 16 + tOS 16.3。',
  'tOS16.0': 'tOS 16.0 系列产品项目。',
  'X6873_H972': 'X6873 整机产品项目，采用 H972 主板方案。',
  'X6855': '技术项目。',
  'X6876_H786': '整机产品项目。',
  'tOS17.1': 'tOS 17.1 技术项目。',
  'X6890 CAMON': 'CAMON 系列整机产品。',
  'tOS18.0': 'tOS 18.0 能力建设项目。',
  'AI-Engine-V2': 'AI Engine V2 能力建设项目。',
  'DevOps-Platform': 'DevOps 平台能力建设项目。',
}

const SCENARIO_PROJECT_BASIC_INFO: ScenarioConfig = {
  id: 'project-basic-info',
  name: '项目基础信息查询',
  keywords: [
    ['基本情况'], ['信息'], ['详情'],
    ['是谁', '负责'], ['负责人'],
  ],
  requiresProject: true,
  priority: 5,
  buildThinking: (vars) => [
    kb(`项目主表 · 查询 ${vars.projectName}`, 400),
    kb('待办与计划 · 扫描风险计划项', 500),
  ],
  buildResponse: (vars) => {
    const name = vars.projectName!
    const p = useProjectStore.getState().projects.find(x => x.name === name)
    const risks = MOCK_RISK_PLANS[name] ?? []
    const hasRisk = risks.length > 0

    const headerLine = hasRisk
      ? `📋 **${name}** 基本信息如下。⚠️ 注意：该项目有 **${risks.length} 项计划处于风险状态**，建议优先关注 ↓`
      : `📋 **${name}** 基本信息如下。`

    const cards: any[] = []
    if (hasRisk) {
      cards.push({ type: 'risk-plans', data: { items: risks } })
    }
    cards.push({
      type: 'project-info',
      data: {
        name,
        spm: p?.spm ?? '未知',
        schedule: p ? `${p.planStartDate} ~ ${p.planEndDate}` : '未知',
        currentVersion: p?.tosVersion ?? p?.androidVersion ?? '未知',
        status: p?.status ?? '未知',
        description: MOCK_PROJECT_DESC[name] ?? '（暂无描述）',
      },
    })
    if (p) {
      cards.push({
        type: 'link',
        data: { text: '跳转到项目空间 →', href: '#', module: 'projectSpace', projectId: p.id },
      })
    }

    const references = [
      { label: '项目主表', index: 1 },
      { label: '待办与计划', index: 2 },
    ]

    return { markdown: headerLine, cards, references }
  },
}
```

- 把 `SCENARIOS` 数组改为：
```ts
export const SCENARIOS: ScenarioConfig[] = [
  SCENARIO_PROJECT_BASIC_INFO,
  FALLBACK,
]
```

- [ ] **Step 2: 验证编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/mock/ai-scenarios.ts
git commit -m "feat(ai): scenario 1 - project basic info with risk plans"
```

---

## Task 10: 场景 ② 项目计划查询

**Files:**
- Modify: `src/mock/ai-scenarios.ts`

- [ ] **Step 1: 在 ai-scenarios.ts 追加场景 ②**

在 Fallback 之前、场景 ① 之后追加：
```ts
// ─── Scenario ② 项目计划查询 ──────────────────────────────

const MOCK_PLAN_ROWS: Record<string, Array<{
  id: string; type: '版本' | '需求' | '开发' | '测试' | '其他';
  name: string; owner: string; progress: number;
  deadline: string; status: string; isRisk: boolean;
}>> = {
  'X6877-D8400_H991': [
    { id: 'pl-1', type: '版本', name: 'V2.3 发布', owner: '王五', progress: 60, deadline: '2026-04-25', status: '进行中', isRisk: true },
    { id: 'pl-2', type: '版本', name: 'V2.4 规划', owner: '王五', progress: 20, deadline: '2026-06-30', status: '规划中', isRisk: false },
    { id: 'pl-3', type: '需求', name: '支付流程重构', owner: '张三', progress: 70, deadline: '2026-04-20', status: '延期', isRisk: true },
    { id: 'pl-4', type: '需求', name: '首页信息流改版', owner: '李四', progress: 45, deadline: '2026-05-10', status: '进行中', isRisk: false },
    { id: 'pl-5', type: '需求', name: 'AI 助手接入', owner: '李白', progress: 30, deadline: '2026-05-15', status: '进行中', isRisk: false },
    { id: 'pl-6', type: '开发', name: 'UI 组件升级', owner: '李四', progress: 50, deadline: '2026-05-05', status: '阻塞', isRisk: true },
    { id: 'pl-7', type: '开发', name: 'Gradle 插件升级', owner: '李四', progress: 90, deadline: '2026-04-30', status: '进行中', isRisk: false },
    { id: 'pl-8', type: '测试', name: 'E2E 自动化扩充', owner: '赵六', progress: 40, deadline: '2026-05-10', status: '进行中', isRisk: false },
  ],
  'tOS16.0': [
    { id: 'pl-20', type: '版本', name: 'tOS 16.0 终版', owner: '张三', progress: 85, deadline: '2026-04-28', status: '进行中', isRisk: false },
    { id: 'pl-21', type: '测试', name: '回归测试全量', owner: '孙七', progress: 60, deadline: '2026-04-23', status: '阻塞', isRisk: true },
    { id: 'pl-22', type: '需求', name: '通知中心优化', owner: '李四', progress: 50, deadline: '2026-05-08', status: '进行中', isRisk: false },
  ],
  // Others: give each a minimal list of 2-3 rows
  'X6855': [
    { id: 'pl-30', type: '版本', name: 'X6855 V1 发布', owner: '赵六', progress: 55, deadline: '2026-05-20', status: '进行中', isRisk: false },
    { id: 'pl-31', type: '需求', name: '相机算法升级', owner: '孙七', progress: 40, deadline: '2026-05-15', status: '进行中', isRisk: false },
  ],
  'X6876_H786': [
    { id: 'pl-40', type: '版本', name: 'X6876 V1', owner: '孙七', progress: 30, deadline: '2026-06-01', status: '进行中', isRisk: false },
  ],
  'X6873_H972': [
    { id: 'pl-50', type: '开发', name: 'Camera HAL 适配', owner: '周八', progress: 30, deadline: '2026-04-24', status: '延期', isRisk: true },
    { id: 'pl-51', type: '需求', name: 'AOD 界面', owner: '李白', progress: 20, deadline: '2026-04-23', status: '进行中', isRisk: true },
  ],
  'tOS17.1': [
    { id: 'pl-60', type: '版本', name: 'tOS 17.1 里程碑', owner: '赵六', progress: 40, deadline: '2026-06-15', status: '进行中', isRisk: false },
  ],
  'X6890 CAMON': [
    { id: 'pl-70', type: '需求', name: 'CAMON 影像模式', owner: '李白', progress: 60, deadline: '2026-05-30', status: '进行中', isRisk: false },
    { id: 'pl-71', type: '开发', name: '定制相机 UI', owner: '张三', progress: 55, deadline: '2026-05-28', status: '进行中', isRisk: false },
  ],
  'tOS18.0': [
    { id: 'pl-80', type: '需求', name: 'tOS 18.0 架构设计', owner: '杜甫', progress: 30, deadline: '2026-07-01', status: '进行中', isRisk: false },
  ],
  'AI-Engine-V2': [
    { id: 'pl-90', type: '需求', name: '推理引擎升级', owner: '李四', progress: 45, deadline: '2026-06-10', status: '进行中', isRisk: false },
    { id: 'pl-91', type: '开发', name: '模型量化', owner: '赵六', progress: 50, deadline: '2026-06-05', status: '进行中', isRisk: false },
  ],
  'DevOps-Platform': [
    { id: 'pl-100', type: '需求', name: 'CI 流水线改造', owner: '孙七', progress: 60, deadline: '2026-05-25', status: '进行中', isRisk: false },
  ],
}

const SCENARIO_PROJECT_PLANS: ScenarioConfig = {
  id: 'project-plans',
  name: '项目计划查询',
  keywords: [['计划'], ['任务'], ['排期']],
  requiresProject: true,
  modifiers: {
    ownership: ['我', '我的', '我负责', '自己'],
    planType: ['版本', '需求', '开发', '测试'],
  },
  priority: 6,
  buildThinking: (_vars) => [
    kb('待办与计划 · 查询项目计划', 500),
    reasoning('按筛选条件过滤', 400),
  ],
  buildResponse: (vars) => {
    const name = vars.projectName!
    const allRows = MOCK_PLAN_ROWS[name] ?? []
    const currentUser = useProjectStore.getState().currentLoginUser
    const ownership = vars.ownership ?? 'all'
    const planType = vars.planType

    let rows = allRows
    if (ownership === 'mine') rows = rows.filter(r => r.owner === currentUser)
    if (planType) rows = rows.filter(r => r.type === planType)

    const total = allRows.length
    const mineCount = allRows.filter(r => r.owner === currentUser).length
    const typeCount = (t: string) => allRows.filter(r => r.type === t).length

    const filters = [
      { key: 'all', label: '全部', count: total },
      { key: 'mine', label: '我负责', count: mineCount },
      { key: '版本', label: '版本', count: typeCount('版本') },
      { key: '需求', label: '需求', count: typeCount('需求') },
      { key: '开发', label: '开发', count: typeCount('开发') },
      { key: '测试', label: '测试', count: typeCount('测试') },
    ]

    const activeFilter = planType ?? (ownership === 'mine' ? 'mine' : 'all')
    const descr = activeFilter === 'all' ? '所有计划'
      : activeFilter === 'mine' ? '我负责的计划'
      : `${activeFilter}计划`

    return {
      markdown: `📅 **${name}** 的 ${descr}，共 **${rows.length}** 项`,
      cards: [
        {
          type: 'plans-table',
          data: { projectName: name, filters, activeFilter, rows },
        },
      ],
      references: [{ label: '待办与计划', index: 1 }],
    }
  },
}
```

- 更新 `SCENARIOS` 数组：
```ts
export const SCENARIOS: ScenarioConfig[] = [
  SCENARIO_PROJECT_BASIC_INFO,
  SCENARIO_PROJECT_PLANS,
  FALLBACK,
]
```

- [ ] **Step 2: 验证编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/mock/ai-scenarios.ts
git commit -m "feat(ai): scenario 2 - project plans with ownership/type filters"
```

---

## Task 11: 场景 ③ 项目需求状态汇总

**Files:**
- Modify: `src/mock/ai-scenarios.ts`

- [ ] **Step 1: 追加场景 ③**

在 Fallback 前追加：
```ts
// ─── Scenario ③ 项目需求状态汇总 ──────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  '待开始': '#9ca3af',
  '开发中': '#1677ff',
  '测试中': '#faad14',
  '已完成': '#52c41a',
  '阻塞': '#ff4d4f',
}

function buildRequirementDist(projectName: string) {
  // Derive requirements from plans of type "需求" for this project
  const plans = MOCK_PLAN_ROWS[projectName] ?? []
  const reqs = plans.filter(p => p.type === '需求')

  // Classify plan.status → distribution status buckets (demo heuristic)
  const classify = (row: typeof reqs[0]) => {
    if (row.status === '延期' || row.status === '阻塞') return '阻塞'
    if (row.progress >= 100) return '已完成'
    if (row.progress >= 60) return '测试中'
    if (row.progress >= 10) return '开发中'
    return '待开始'
  }

  const requirements = reqs.map(r => ({
    id: r.id,
    name: r.name,
    owner: r.owner,
    status: classify(r),
    priority: r.isRisk ? '高' : '中',
    blockReason: (r.status === '延期' || r.status === '阻塞') ? r.status : undefined,
  }))

  const counts: Record<string, number> = { '待开始': 0, '开发中': 0, '测试中': 0, '已完成': 0, '阻塞': 0 }
  requirements.forEach(r => { counts[r.status] = (counts[r.status] ?? 0) + 1 })

  const distribution = Object.entries(counts).map(([status, count]) => ({
    status, count, color: STATUS_COLORS[status] ?? '#9ca3af',
  }))

  return { totalCount: requirements.length, distribution, requirements }
}

const SCENARIO_REQUIREMENT_STATUS: ScenarioConfig = {
  id: 'requirement-status',
  name: '项目需求状态汇总',
  keywords: [['需求', '进展'], ['需求', '状态'], ['需求', '分布'], ['需求', '阻塞']],
  requiresProject: true,
  priority: 7,
  buildThinking: (vars) => [
    kb(`项目主表 · 确认 ${vars.projectName}`, 400),
    kb('待办与计划 · 筛选需求类计划', 500),
    reasoning('按状态分组统计', 400),
  ],
  buildResponse: (vars) => {
    const name = vars.projectName!
    const dist = buildRequirementDist(name)
    return {
      markdown: `🧩 **${name}** 共有 **${dist.totalCount}** 个需求，当前状态分布如下`,
      cards: [
        { type: 'requirement-dist', data: { projectName: name, ...dist } },
      ],
      references: [
        { label: '项目主表', index: 1 },
        { label: '待办与计划', index: 2 },
      ],
    }
  },
}
```

更新 `SCENARIOS` 数组增加 `SCENARIO_REQUIREMENT_STATUS`。

- [ ] **Step 2: 验证编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/mock/ai-scenarios.ts
git commit -m "feat(ai): scenario 3 - requirement status distribution"
```

---

## Task 12: 场景 ④ 项目转维流程状态

**Files:**
- Modify: `src/mock/ai-scenarios.ts`

- [ ] **Step 1: 追加场景 ④**

在 Fallback 前追加：
```ts
// ─── Scenario ④ 项目转维流程状态 ──────────────────────────────

type StageMock = {
  stages: Array<{ name: string; status: 'done' | 'current' | 'pending'; owner?: string; dueDate?: string; pendingItems?: string[] }>
  currentIndex: number
  nextActions: string[]
}

const MOCK_TRANSFER_STATE: Record<string, StageMock> = {
  'X6877-D8400_H991': {
    stages: [
      { name: '申请提交', status: 'done' },
      { name: '材料填报', status: 'current', owner: '张三', dueDate: '2026-04-25',
        pendingItems: ['完善部署清单', '补充验证报告', '上传变更说明'] },
      { name: '研发转维', status: 'pending' },
      { name: '转维评审', status: 'pending' },
      { name: 'SQA 评审', status: 'pending' },
      { name: '转维完成', status: 'pending' },
    ],
    currentIndex: 1,
    nextActions: [
      '补齐部署清单中缺失的配置项',
      '把单元测试覆盖率报告上传到附件区',
      '联系软件 SE 确认变更说明文档',
    ],
  },
  'tOS16.0': {
    stages: [
      { name: '申请提交', status: 'done' },
      { name: '材料填报', status: 'done' },
      { name: '研发转维', status: 'current', owner: '李四', dueDate: '2026-04-24',
        pendingItems: ['代码 freeze', '最终打包验证'] },
      { name: '转维评审', status: 'pending' },
      { name: 'SQA 评审', status: 'pending' },
      { name: '转维完成', status: 'pending' },
    ],
    currentIndex: 2,
    nextActions: [
      '完成代码 freeze 并通知测试',
      '执行最终打包验证',
      '准备转维评审材料',
    ],
  },
  // default for projects without transfer: show "未进入转维"
}

const SCENARIO_TRANSFER_STATUS: ScenarioConfig = {
  id: 'transfer-status',
  name: '项目转维流程状态',
  keywords: [['转维'], ['转维', '进度'], ['转维', '流程'], ['转维', '下一步']],
  requiresProject: true,
  priority: 8,
  buildThinking: (vars) => [
    kb(`项目主表 · 确认 ${vars.projectName}`, 400),
    kb('转维申请表 · 查询当前转维状态', 500),
    kb('转维操作手册 · 加载流程定义', 500),
  ],
  buildResponse: (vars) => {
    const name = vars.projectName!
    const state = MOCK_TRANSFER_STATE[name]
    if (!state) {
      return {
        markdown: `🚚 **${name}** 尚未进入转维流程。`,
        cards: [],
        references: [{ label: '转维申请表', index: 1 }],
      }
    }
    const currentStage = state.stages[state.currentIndex]
    const doneCount = state.stages.filter(s => s.status === 'done').length

    return {
      markdown: `🚚 **${name}** 当前转维进度：已完成 **${doneCount}** 个阶段，当前处于 **【${currentStage.name}】** 阶段`,
      cards: [
        { type: 'transfer-flow', data: { projectName: name, stages: state.stages, currentStageIndex: state.currentIndex } },
        { type: 'next-action', data: { stageName: currentStage.name, actions: state.nextActions } },
        { type: 'link', data: { text: '跳转转维详情页 →', href: '#', module: 'transfer' } },
      ],
      references: [
        { label: '转维申请表', index: 1 },
        { label: '转维操作手册', index: 2 },
      ],
    }
  },
}
```

更新 `SCENARIOS` 数组增加 `SCENARIO_TRANSFER_STATUS`。

- [ ] **Step 2: 验证编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/mock/ai-scenarios.ts
git commit -m "feat(ai): scenario 4 - transfer maintenance flow status"
```

---

## Task 13: 接入 sendMessage（关键词匹配 + 权限拦截 + 流式演出）

**Files:**
- Modify: `src/stores/ai-chat.ts`

- [ ] **Step 1: 替换 sendMessage 占位实现**

在 `src/stores/ai-chat.ts` 里：
- 在文件顶部的 import 区域增加：
```ts
import { matchScenario } from '@/lib/ai-matcher'
import { SCENARIOS } from '@/mock/ai-scenarios'
import { useProjectStore } from '@/stores/project'
import { hasProjectAccess } from '@/stores/permission'
import type { ScenarioConfig, ScenarioResponse, ThinkingStep } from '@/types/ai'
```

- 把 `sendMessage` 整个函数替换为：
```ts
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
```

- 在文件末尾（在 `}))` 之后）追加工具函数 `streamAssistantMessage`：
```ts
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
```

- [ ] **Step 2: 验证编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/stores/ai-chat.ts
git commit -m "feat(ai): wire sendMessage with matcher + permission gate + streaming"
```

---

## Task 14: 简单卡片组件（ProjectInfo / Link / PermissionNotice / NextAction）

**Files:**
- Create: `src/components/ai/cards/ProjectInfoCard.tsx`
- Create: `src/components/ai/cards/LinkCard.tsx`
- Create: `src/components/ai/cards/PermissionNoticeCard.tsx`
- Create: `src/components/ai/cards/NextActionCard.tsx`

- [ ] **Step 1: ProjectInfoCard**

Create `src/components/ai/cards/ProjectInfoCard.tsx`:
```tsx
'use client'
import { Card, Descriptions, Tag } from 'antd'
import type { ProjectInfoCardData } from '@/types/ai'

export function ProjectInfoCard({ data }: { data: ProjectInfoCardData }) {
  return (
    <Card size="small" style={{ borderRadius: 8 }}>
      <Descriptions title={<span style={{ fontSize: 14 }}>📋 项目信息</span>} column={2} size="small">
        <Descriptions.Item label="名称">{data.name}</Descriptions.Item>
        <Descriptions.Item label="SPM">{data.spm}</Descriptions.Item>
        <Descriptions.Item label="排期">{data.schedule}</Descriptions.Item>
        <Descriptions.Item label="当前版本">{data.currentVersion}</Descriptions.Item>
        <Descriptions.Item label="状态"><Tag color="blue">{data.status}</Tag></Descriptions.Item>
        <Descriptions.Item label="描述" span={2}>{data.description}</Descriptions.Item>
      </Descriptions>
    </Card>
  )
}
```

- [ ] **Step 2: LinkCard**

Create `src/components/ai/cards/LinkCard.tsx`:
```tsx
'use client'
import { Button } from 'antd'
import { useProjectStore } from '@/stores/project'
import { useUiStore } from '@/stores/ui'

type Props = { data: { text: string; href: string; module?: string; projectId?: string } }

export function LinkCard({ data }: Props) {
  const { setSelectedProject, projects } = useProjectStore()
  const { setActiveModule } = useUiStore()

  const onClick = () => {
    if (data.module === 'projectSpace' && data.projectId) {
      const p = projects.find(x => x.id === data.projectId)
      if (p) {
        setSelectedProject(p)
        setActiveModule('projectSpace')
      }
      return
    }
    if (data.module === 'transfer') {
      setActiveModule('projects')
      // Demo: just navigate to main workspace
      return
    }
  }

  return (
    <Button type="link" onClick={onClick} style={{ paddingLeft: 0 }}>
      {data.text}
    </Button>
  )
}
```

- [ ] **Step 3: PermissionNoticeCard**

Create `src/components/ai/cards/PermissionNoticeCard.tsx`:
```tsx
'use client'
import { Card } from 'antd'
import { LockOutlined } from '@ant-design/icons'

type Props = { data: { projectName: string; spm: string } }

export function PermissionNoticeCard({ data }: Props) {
  return (
    <Card size="small" style={{ borderRadius: 8, background: '#fff7e6', borderColor: '#ffd591' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500, marginBottom: 8 }}>
        <LockOutlined style={{ color: '#d48806' }} />
        <span>权限提示</span>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.8 }}>
        项目：<b>{data.projectName}</b><br/>
        SPM：<b>{data.spm}</b>
      </div>
    </Card>
  )
}
```

- [ ] **Step 4: NextActionCard**

Create `src/components/ai/cards/NextActionCard.tsx`:
```tsx
'use client'
import { Card, List } from 'antd'
import { RightCircleOutlined } from '@ant-design/icons'
import type { NextActionData } from '@/types/ai'

export function NextActionCard({ data }: { data: NextActionData }) {
  return (
    <Card size="small" style={{ borderRadius: 8, borderColor: '#91caff' }}>
      <div style={{ fontWeight: 500, marginBottom: 8, color: '#1677ff' }}>
        ⏭️ 【{data.stageName}】下一步行动
      </div>
      <List
        size="small"
        dataSource={data.actions}
        renderItem={(item) => (
          <List.Item style={{ padding: '6px 0', borderBottom: 'none' }}>
            <RightCircleOutlined style={{ color: '#1677ff', marginRight: 8 }} />
            {item}
          </List.Item>
        )}
      />
    </Card>
  )
}
```

- [ ] **Step 5: 验证编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 6: 提交**

```bash
git add src/components/ai/cards/
git commit -m "feat(ai): add 4 simple card components (info/link/permission/action)"
```

---

## Task 15: 数据表格卡片（RiskPlans / PlansTable）

**Files:**
- Create: `src/components/ai/cards/RiskPlansCard.tsx`
- Create: `src/components/ai/cards/PlansTableCard.tsx`

- [ ] **Step 1: RiskPlansCard**

Create `src/components/ai/cards/RiskPlansCard.tsx`:
```tsx
'use client'
import { Card, Tag } from 'antd'
import type { RiskPlanCardData } from '@/types/ai'

const TYPE_COLOR: Record<string, string> = {
  '版本': 'purple', '需求': 'blue', '开发': 'gold', '测试': 'green', '其他': 'default',
}

const REASON_ICON = (reason: string) => {
  if (reason.includes('阻塞')) return '🚧'
  if (reason.includes('紧急')) return '🔥'
  if (reason.includes('截止')) return '🔥'
  return '⚠️'
}

export function RiskPlansCard({ data }: { data: RiskPlanCardData }) {
  return (
    <Card
      size="small"
      style={{ borderRadius: 8, background: '#fff1f0', borderColor: '#ffa39e' }}
      title={<span style={{ fontSize: 14 }}>🚨 风险计划项 ({data.items.length} 项)</span>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.items.map((item, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
            background: '#fff', borderRadius: 4, border: '1px solid #ffccc7' }}>
            <span>{REASON_ICON(item.reason)}</span>
            <Tag color={TYPE_COLOR[item.planType] ?? 'default'} style={{ margin: 0 }}>{item.planType}</Tag>
            <span style={{ flex: 1, fontSize: 13 }}>{item.planName}</span>
            <span style={{ color: '#8c8c8c', fontSize: 12 }}>· {item.owner}</span>
            <span style={{ color: '#ff4d4f', fontSize: 12 }}>· {item.reason}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}
```

- [ ] **Step 2: PlansTableCard**

Create `src/components/ai/cards/PlansTableCard.tsx`:
```tsx
'use client'
import { useState } from 'react'
import { Card, Segmented, Table, Tag, Progress } from 'antd'
import type { PlansTableData, PlanRow } from '@/types/ai'

const TYPE_COLOR: Record<string, string> = {
  '版本': 'purple', '需求': 'blue', '开发': 'gold', '测试': 'green', '其他': 'default',
}

export function PlansTableCard({ data }: { data: PlansTableData }) {
  const [activeFilter, setActiveFilter] = useState(data.activeFilter)

  // Re-derive user name for 我负责 filter (simpler: client-side filter based on owner)
  // Since the scenario pre-filtered when the initial filter was applied, clicking a chip re-filters locally from the full set.
  // For demo purposes, 'data.rows' is treated as the visible rows after initial filter.
  // When switching filters, we can only show/hide from the current dataset. This is acceptable for demo.

  const visibleRows = data.rows.filter(r => {
    if (activeFilter === 'all') return true
    if (activeFilter === 'mine') return true // shown as-is; re-filter would need currentLoginUser
    return r.type === activeFilter
  })

  const columns = [
    { title: '类型', dataIndex: 'type', width: 80,
      render: (t: string) => <Tag color={TYPE_COLOR[t]} style={{ margin: 0 }}>{t}</Tag> },
    { title: '计划名', dataIndex: 'name', render: (n: string, r: PlanRow) =>
      r.isRisk ? <span style={{ color: '#ff4d4f', fontWeight: 500 }}>{n}</span> : n },
    { title: '负责人', dataIndex: 'owner', width: 90 },
    { title: '进度', dataIndex: 'progress', width: 120,
      render: (p: number) => <Progress percent={p} size="small" showInfo={false} /> },
    { title: '截止日', dataIndex: 'deadline', width: 110 },
    { title: '状态', dataIndex: 'status', width: 90,
      render: (s: string, r: PlanRow) =>
        <Tag color={r.isRisk ? 'red' : 'default'} style={{ margin: 0 }}>{s}</Tag> },
  ]

  return (
    <Card size="small" style={{ borderRadius: 8 }}>
      <div style={{ marginBottom: 12 }}>
        <Segmented
          size="small"
          value={activeFilter}
          onChange={(v) => setActiveFilter(v as string)}
          options={data.filters.map(f => ({ value: f.key, label: `${f.label} ${f.count}` }))}
        />
      </div>
      <Table
        size="small"
        rowKey="id"
        columns={columns}
        dataSource={visibleRows}
        pagination={false}
        rowClassName={(r) => r.isRisk ? 'plans-table-risk-row' : ''}
      />
      <style jsx global>{`
        .plans-table-risk-row { background: #fff1f0; }
      `}</style>
    </Card>
  )
}
```

- [ ] **Step 3: 验证编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add src/components/ai/cards/RiskPlansCard.tsx src/components/ai/cards/PlansTableCard.tsx
git commit -m "feat(ai): add risk plans + plans table card components"
```

---

## Task 16: 复杂卡片（RequirementDist / TransferFlow）

**Files:**
- Create: `src/components/ai/cards/RequirementDistCard.tsx`
- Create: `src/components/ai/cards/TransferFlowCard.tsx`

- [ ] **Step 1: RequirementDistCard**

Create `src/components/ai/cards/RequirementDistCard.tsx`:
```tsx
'use client'
import { useState } from 'react'
import { Card, Table, Tag, Progress } from 'antd'
import type { RequirementDistData } from '@/types/ai'

export function RequirementDistCard({ data }: { data: RequirementDistData }) {
  const [activeStatus, setActiveStatus] = useState<string | null>(null)
  const visible = activeStatus ? data.requirements.filter(r => r.status === activeStatus) : data.requirements
  const total = data.totalCount || 1

  return (
    <Card size="small" style={{ borderRadius: 8 }}>
      <div style={{ fontWeight: 500, marginBottom: 12, fontSize: 14 }}>🧩 需求状态分布（共 {data.totalCount} 个）</div>
      {/* Simple horizontal stacked bar as "饼图" substitute */}
      <div style={{ display: 'flex', height: 24, borderRadius: 4, overflow: 'hidden', marginBottom: 8, border: '1px solid #f0f0f0' }}>
        {data.distribution.map(d => (
          d.count > 0 && (
            <div key={d.status}
              onClick={() => setActiveStatus(activeStatus === d.status ? null : d.status)}
              style={{ width: `${(d.count / total) * 100}%`, background: d.color, cursor: 'pointer',
                color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title={`${d.status}: ${d.count}`}
            >
              {d.count > 0 ? d.count : ''}
            </div>
          )
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12, fontSize: 12 }}>
        {data.distribution.map(d => (
          <div key={d.status} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
            onClick={() => setActiveStatus(activeStatus === d.status ? null : d.status)}>
            <span style={{ width: 10, height: 10, background: d.color, borderRadius: 2, display: 'inline-block' }} />
            <span>{d.status}: <b>{d.count}</b></span>
          </div>
        ))}
        {activeStatus && (
          <a style={{ marginLeft: 'auto' }} onClick={() => setActiveStatus(null)}>清除过滤</a>
        )}
      </div>
      <Table
        size="small"
        rowKey="id"
        columns={[
          { title: '需求名', dataIndex: 'name' },
          { title: '负责人', dataIndex: 'owner', width: 90 },
          { title: '状态', dataIndex: 'status', width: 100,
            render: (s: string) => {
              const color = data.distribution.find(d => d.status === s)?.color ?? '#9ca3af'
              return <Tag color={color} style={{ margin: 0, color: '#fff' }}>{s}</Tag>
            } },
          { title: '优先级', dataIndex: 'priority', width: 80 },
          { title: '阻塞原因', dataIndex: 'blockReason', width: 100,
            render: (v?: string) => v ? <Tag color="red">{v}</Tag> : '-' },
        ]}
        dataSource={visible}
        pagination={false}
      />
    </Card>
  )
}
```

- [ ] **Step 2: TransferFlowCard**

Create `src/components/ai/cards/TransferFlowCard.tsx`:
```tsx
'use client'
import { Card } from 'antd'
import type { TransferFlowData } from '@/types/ai'

export function TransferFlowCard({ data }: { data: TransferFlowData }) {
  const current = data.stages[data.currentStageIndex]

  return (
    <Card size="small" style={{ borderRadius: 8 }}>
      <div style={{ fontWeight: 500, marginBottom: 12, fontSize: 14 }}>🚚 转维流程进度</div>

      {/* Horizontal progress bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
        {data.stages.map((stage, idx) => {
          const isDone = stage.status === 'done'
          const isCurrent = stage.status === 'current'
          const color = isDone ? '#52c41a' : isCurrent ? '#1677ff' : '#d9d9d9'
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: color,
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 600, flexShrink: 0,
                boxShadow: isCurrent ? '0 0 0 3px #bae0ff' : 'none' }}>
                {isDone ? '✓' : idx + 1}
              </div>
              {idx < data.stages.length - 1 && (
                <div style={{ height: 2, flex: 1, background: isDone ? '#52c41a' : '#d9d9d9', margin: '0 4px' }} />
              )}
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, fontSize: 11, color: '#595959' }}>
        {data.stages.map((stage, idx) => (
          <div key={idx} style={{ flex: 1, textAlign: 'center', fontWeight: stage.status === 'current' ? 600 : 400,
            color: stage.status === 'current' ? '#1677ff' : '#8c8c8c' }}>
            {stage.name}
          </div>
        ))}
      </div>

      {/* Current stage details */}
      {current && (
        <div style={{ padding: 12, background: '#e6f4ff', borderRadius: 6, border: '1px solid #91caff' }}>
          <div style={{ fontWeight: 500, marginBottom: 6 }}>当前阶段：{current.name}</div>
          <div style={{ fontSize: 12, color: '#595959', lineHeight: 1.8 }}>
            {current.owner && <div>负责人：<b>{current.owner}</b></div>}
            {current.dueDate && <div>预计完成：<b>{current.dueDate}</b></div>}
            {current.pendingItems && current.pendingItems.length > 0 && (
              <div>未完成项：
                <ul style={{ margin: '4px 0 0 20px' }}>
                  {current.pendingItems.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}
```

- [ ] **Step 3: 验证编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add src/components/ai/cards/RequirementDistCard.tsx src/components/ai/cards/TransferFlowCard.tsx
git commit -m "feat(ai): add requirement dist + transfer flow card components"
```

---

## Task 17: ResponseCard 分发器、ReferenceList、ThinkingProcess

**Files:**
- Create: `src/components/ai/ResponseCard.tsx`
- Create: `src/components/ai/ReferenceList.tsx`
- Create: `src/components/ai/ThinkingProcess.tsx`

- [ ] **Step 1: ResponseCard 分发器**

Create `src/components/ai/ResponseCard.tsx`:
```tsx
'use client'
import type { ResponseCard as ResponseCardType } from '@/types/ai'
import { ProjectInfoCard } from './cards/ProjectInfoCard'
import { RiskPlansCard } from './cards/RiskPlansCard'
import { PlansTableCard } from './cards/PlansTableCard'
import { RequirementDistCard } from './cards/RequirementDistCard'
import { TransferFlowCard } from './cards/TransferFlowCard'
import { NextActionCard } from './cards/NextActionCard'
import { LinkCard } from './cards/LinkCard'
import { PermissionNoticeCard } from './cards/PermissionNoticeCard'

export function ResponseCard({ card }: { card: ResponseCardType }) {
  switch (card.type) {
    case 'project-info':      return <ProjectInfoCard data={card.data} />
    case 'risk-plans':        return <RiskPlansCard data={card.data} />
    case 'plans-table':       return <PlansTableCard data={card.data} />
    case 'requirement-dist':  return <RequirementDistCard data={card.data} />
    case 'transfer-flow':     return <TransferFlowCard data={card.data} />
    case 'next-action':       return <NextActionCard data={card.data} />
    case 'link':              return <LinkCard data={card.data} />
    case 'permission-notice': return <PermissionNoticeCard data={card.data} />
  }
}
```

- [ ] **Step 2: ReferenceList**

Create `src/components/ai/ReferenceList.tsx`:
```tsx
'use client'
import { Tooltip } from 'antd'
import { LinkOutlined } from '@ant-design/icons'
import type { ReferenceItem } from '@/types/ai'

export function ReferenceList({ items }: { items: ReferenceItem[] }) {
  if (items.length === 0) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#8c8c8c',
      marginTop: 8, padding: '6px 8px', background: '#fafafa', borderRadius: 4 }}>
      <LinkOutlined />
      <span>来源：</span>
      {items.map((it, idx) => (
        <Tooltip key={idx} title={`引用 [${it.index}] ${it.label}`}>
          <span style={{ cursor: 'default' }}>
            {it.label}<sup>{it.index}</sup>
            {idx < items.length - 1 ? ' · ' : ''}
          </span>
        </Tooltip>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: ThinkingProcess**

Create `src/components/ai/ThinkingProcess.tsx`:
```tsx
'use client'
import { useState } from 'react'
import { DownOutlined, UpOutlined, CheckCircleFilled } from '@ant-design/icons'
import type { ThinkingStep } from '@/types/ai'

type Props = {
  steps: ThinkingStep[]
  revealedCount: number
  collapsed: boolean
}

export function ThinkingProcess({ steps, revealedCount, collapsed }: Props) {
  const [userCollapsed, setUserCollapsed] = useState<boolean | null>(null)
  const effectivelyCollapsed = userCollapsed === null ? collapsed : userCollapsed

  const visible = steps.slice(0, revealedCount)

  if (effectivelyCollapsed) {
    return (
      <div
        onClick={() => setUserCollapsed(false)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#8c8c8c',
          cursor: 'pointer', padding: '4px 8px', background: '#fafafa', borderRadius: 4, marginBottom: 8 }}
      >
        <CheckCircleFilled style={{ color: '#52c41a' }} />
        <span>已完成 {steps.length} 步</span>
        <DownOutlined style={{ fontSize: 10 }} />
      </div>
    )
  }

  return (
    <div style={{ fontSize: 12, color: '#595959', padding: '8px 12px', background: '#f6f8fa',
      borderRadius: 4, marginBottom: 8, border: '1px solid #e8e8e8' }}>
      <div onClick={() => setUserCollapsed(true)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, cursor: 'pointer' }}>
        <b>▼ AI 思考过程（{revealedCount}/{steps.length} 步）</b>
        <UpOutlined style={{ fontSize: 10, marginLeft: 'auto' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {visible.map((step, idx) => (
          <div key={idx} style={{ display: 'flex', gap: 6 }}>
            <span>{step.icon}</span>
            <span>{step.target}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 验证编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 5: 提交**

```bash
git add src/components/ai/ResponseCard.tsx src/components/ai/ReferenceList.tsx src/components/ai/ThinkingProcess.tsx
git commit -m "feat(ai): add ResponseCard dispatcher + ReferenceList + ThinkingProcess"
```

---

## Task 18: MessageBubble 与 MessageList

**Files:**
- Create: `src/components/ai/MessageBubble.tsx`
- Create: `src/components/ai/MessageList.tsx`

- [ ] **Step 1: MessageBubble**

Create `src/components/ai/MessageBubble.tsx`:
```tsx
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
      <div style={{ maxWidth: '85%', flex: 1 }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
            {cardsToShow.map((card, idx) => (
              <div key={idx} style={{ animation: 'fadeInUp 0.3s ease-out' }}>
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
        <style jsx>{`
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(10px); }
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
```

- [ ] **Step 2: MessageList**

Create `src/components/ai/MessageList.tsx`:
```tsx
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
```

- [ ] **Step 3: 验证编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add src/components/ai/MessageBubble.tsx src/components/ai/MessageList.tsx
git commit -m "feat(ai): add MessageBubble + MessageList with streaming render"
```

---

## Task 19: ChatInput 与 QuickPromptChips

**Files:**
- Create: `src/components/ai/ChatInput.tsx`
- Create: `src/components/ai/QuickPromptChips.tsx`

- [ ] **Step 1: QuickPromptChips**

Create `src/components/ai/QuickPromptChips.tsx`:
```tsx
'use client'
import { useMemo } from 'react'
import { useAIConfigStore } from '@/stores/ai-config'
import { useAIChatStore } from '@/stores/ai-chat'

export function QuickPromptChips({ emptyMode }: { emptyMode: boolean }) {
  const templates = useAIConfigStore(s => s.promptTemplates)
  const { currentProjectContext, sendMessage } = useAIChatStore()

  const visible = useMemo(() => {
    const filtered = templates.filter(t => t.showInQuickChips)
    return emptyMode ? filtered.slice(0, 6) : filtered.slice(0, 3)
  }, [templates, emptyMode])

  const onClick = (tplContent: string, placeholders: string[]) => {
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
          onClick={() => onClick(t.content, t.placeholders)}
          style={{ padding: '4px 10px', fontSize: 12, border: '1px solid #d9d9d9',
            borderRadius: 16, background: '#fff', cursor: 'pointer', color: '#595959' }}
        >
          {t.name}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: ChatInput**

Create `src/components/ai/ChatInput.tsx`:
```tsx
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
```

- [ ] **Step 3: 验证编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add src/components/ai/ChatInput.tsx src/components/ai/QuickPromptChips.tsx
git commit -m "feat(ai): add chat input + quick prompt chips"
```

---

## Task 20: ConversationSidebar 与 ChatHeader

**Files:**
- Create: `src/components/ai/ConversationSidebar.tsx`
- Create: `src/components/ai/ChatHeader.tsx`

- [ ] **Step 1: ConversationSidebar**

Create `src/components/ai/ConversationSidebar.tsx`:
```tsx
'use client'
import { Button, Dropdown, Empty } from 'antd'
import {
  PlusOutlined, PushpinOutlined, EditOutlined, DeleteOutlined,
  MoreOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
} from '@ant-design/icons'
import { useState } from 'react'
import { useAIChatStore } from '@/stores/ai-chat'
import type { Conversation } from '@/types/ai'

function groupByTime(conversations: Conversation[]) {
  const now = Date.now()
  const oneDay = 24 * 60 * 60 * 1000
  const today: Conversation[] = []
  const thisWeek: Conversation[] = []
  const earlier: Conversation[] = []
  conversations.forEach(c => {
    const diff = now - c.updatedAt
    if (diff < oneDay) today.push(c)
    else if (diff < 7 * oneDay) thisWeek.push(c)
    else earlier.push(c)
  })
  return { today, thisWeek, earlier }
}

export function ConversationSidebar() {
  const {
    conversations, activeConversationId, setActiveConversation,
    createConversation, renameConversation, pinConversation, deleteConversation,
  } = useAIChatStore()
  const [collapsed, setCollapsed] = useState(false)

  if (collapsed) {
    return (
      <div style={{ width: 40, borderRight: '1px solid #f0f0f0', padding: 8 }}>
        <Button type="text" icon={<MenuUnfoldOutlined />} onClick={() => setCollapsed(false)} />
      </div>
    )
  }

  const pinned = conversations.filter(c => c.pinned)
  const rest = conversations.filter(c => !c.pinned)
  const groups = groupByTime(rest)

  const renderItem = (c: Conversation) => (
    <div key={c.id}
      onClick={() => setActiveConversation(c.id)}
      style={{ display: 'flex', alignItems: 'center', padding: '6px 12px', cursor: 'pointer',
        background: c.id === activeConversationId ? '#e6f4ff' : 'transparent',
        borderRadius: 6, marginBottom: 2 }}
    >
      {c.pinned && <PushpinOutlined style={{ marginRight: 6, fontSize: 10, color: '#faad14' }} />}
      <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {c.title}
      </span>
      <Dropdown
        menu={{
          items: [
            { key: 'rename', label: '重命名', icon: <EditOutlined />,
              onClick: () => {
                const name = window.prompt('重命名会话', c.title)
                if (name) renameConversation(c.id, name)
              } },
            { key: 'pin', label: c.pinned ? '取消置顶' : '置顶', icon: <PushpinOutlined />,
              onClick: () => pinConversation(c.id) },
            { key: 'delete', label: '删除', icon: <DeleteOutlined />, danger: true,
              onClick: () => deleteConversation(c.id) },
          ],
        }}
        trigger={['click']}
      >
        <Button size="small" type="text" icon={<MoreOutlined />} onClick={e => e.stopPropagation()} />
      </Dropdown>
    </div>
  )

  return (
    <div style={{ width: 240, borderRight: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column',
      background: '#fafbfc' }}>
      <div style={{ padding: 12, display: 'flex', gap: 6 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={createConversation} style={{ flex: 1 }}>新对话</Button>
        <Button type="text" icon={<MenuFoldOutlined />} onClick={() => setCollapsed(true)} />
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px 12px' }}>
        {conversations.length === 0 && (
          <Empty description="暂无会话" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ marginTop: 40 }} />
        )}
        {pinned.length > 0 && (<>
          <div style={{ padding: '6px 12px', fontSize: 11, color: '#8c8c8c' }}>📌 置顶</div>
          {pinned.map(renderItem)}
        </>)}
        {groups.today.length > 0 && (<>
          <div style={{ padding: '6px 12px', fontSize: 11, color: '#8c8c8c' }}>今天</div>
          {groups.today.map(renderItem)}
        </>)}
        {groups.thisWeek.length > 0 && (<>
          <div style={{ padding: '6px 12px', fontSize: 11, color: '#8c8c8c' }}>本周</div>
          {groups.thisWeek.map(renderItem)}
        </>)}
        {groups.earlier.length > 0 && (<>
          <div style={{ padding: '6px 12px', fontSize: 11, color: '#8c8c8c' }}>更早</div>
          {groups.earlier.map(renderItem)}
        </>)}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: ChatHeader**

Create `src/components/ai/ChatHeader.tsx`:
```tsx
'use client'
import { Button, Tag } from 'antd'
import { CloseOutlined, PlusOutlined, FolderOutlined } from '@ant-design/icons'
import { useAIChatStore } from '@/stores/ai-chat'
import { useAIConfigStore } from '@/stores/ai-config'

export function ChatHeader() {
  const { currentProjectContext, bindProject, createConversation } = useAIChatStore()
  const { providers, defaultProviderId } = useAIConfigStore()
  const defaultProvider = providers.find(p => p.id === defaultProviderId)
  const modelLabel = defaultProvider?.defaultModel ?? '未配置'

  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '10px 24px',
      borderBottom: '1px solid #f0f0f0', gap: 12, background: '#fff' }}>
      <div style={{ fontWeight: 600, fontSize: 16 }}>🤖 智能助手</div>
      {currentProjectContext && (
        <Tag
          icon={<FolderOutlined />}
          closable
          onClose={() => bindProject(null)}
          style={{ margin: 0, padding: '2px 8px' }}
          color="blue"
        >
          讨论中：{currentProjectContext}
        </Tag>
      )}
      <div style={{ flex: 1 }} />
      <span style={{ fontSize: 11, color: '#8c8c8c' }}>默认模型：{modelLabel}</span>
      <Button icon={<PlusOutlined />} onClick={createConversation} size="small">新对话</Button>
    </div>
  )
}
```

- [ ] **Step 3: 验证编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add src/components/ai/ConversationSidebar.tsx src/components/ai/ChatHeader.tsx
git commit -m "feat(ai): add conversation sidebar + chat header"
```

---

## Task 21: AIAssistantContainer（组装 Chat 全页面）

**Files:**
- Create: `src/containers/AIAssistantContainer.tsx`

- [ ] **Step 1: 创建容器**

Create `src/containers/AIAssistantContainer.tsx`:
```tsx
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
    <div style={{ display: 'flex', height: 'calc(100vh - 48px)', background: '#fff',
      border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden' }}>
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
```

- [ ] **Step 2: 验证编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/containers/AIAssistantContainer.tsx
git commit -m "feat(ai): assemble AIAssistantContainer with sidebar + header + chat"
```

---

## Task 22: AI 配置面板容器（5 子 tab）

**Files:**
- Create: `src/components/ai/config/AIConfigPanel.tsx`

- [ ] **Step 1: 创建容器（先用占位）**

Create `src/components/ai/config/AIConfigPanel.tsx`:
```tsx
'use client'
import { Tabs } from 'antd'
import { ModelProviderPanel } from './ModelProviderPanel'
import { KnowledgeBasePanel } from './KnowledgeBasePanel'
import { ToolsPanel } from './ToolsPanel'
import { MCPServersPanel } from './MCPServersPanel'
import { PromptTemplatesPanel } from './PromptTemplatesPanel'

export default function AIConfigPanel() {
  return (
    <Tabs
      defaultActiveKey="providers"
      items={[
        { key: 'providers', label: '模型供应商', children: <ModelProviderPanel /> },
        { key: 'kb', label: '知识库', children: <KnowledgeBasePanel /> },
        { key: 'tools', label: '工具', children: <ToolsPanel /> },
        { key: 'mcp', label: 'MCP 服务器', children: <MCPServersPanel /> },
        { key: 'prompts', label: '提示词模板', children: <PromptTemplatesPanel /> },
      ]}
    />
  )
}
```

**注意：** 5 个 panel 文件在下一个 task 里一起创建，本 step 执行后 TypeScript 会报错。先提交 panel 文件，再在下一个 task 里添加它们。实际操作中可以在同一个 task 里一起建空 panel 占位。为安全起见，改为先创建 5 个占位文件：

- [ ] **Step 2: 创建 5 个 panel 占位文件**

Create `src/components/ai/config/ModelProviderPanel.tsx`:
```tsx
'use client'
export function ModelProviderPanel() { return <div>模型供应商（即将实现）</div> }
```

Create `src/components/ai/config/KnowledgeBasePanel.tsx`:
```tsx
'use client'
export function KnowledgeBasePanel() { return <div>知识库（即将实现）</div> }
```

Create `src/components/ai/config/ToolsPanel.tsx`:
```tsx
'use client'
export function ToolsPanel() { return <div>工具（即将实现）</div> }
```

Create `src/components/ai/config/MCPServersPanel.tsx`:
```tsx
'use client'
export function MCPServersPanel() { return <div>MCP 服务器（即将实现）</div> }
```

Create `src/components/ai/config/PromptTemplatesPanel.tsx`:
```tsx
'use client'
export function PromptTemplatesPanel() { return <div>提示词模板（即将实现）</div> }
```

- [ ] **Step 3: 验证编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add src/components/ai/config/
git commit -m "feat(ai): AI config panel scaffold with 5 sub-tabs"
```

---

## Task 23: ModelProviderPanel（实装）

**Files:**
- Modify: `src/components/ai/config/ModelProviderPanel.tsx`

- [ ] **Step 1: 替换占位实现**

Replace `src/components/ai/config/ModelProviderPanel.tsx` with:
```tsx
'use client'
import { useState } from 'react'
import { Button, Card, Drawer, Form, Input, Select, Slider, Switch, Tag, Row, Col, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useAIConfigStore } from '@/stores/ai-config'
import type { ModelProvider } from '@/types/ai'

export function ModelProviderPanel() {
  const { providers, updateProvider, toggleProvider, defaultProviderId, setDefaultProviderId } = useAIConfigStore()
  const [editing, setEditing] = useState<ModelProvider | null>(null)
  const [form] = Form.useForm()

  const openEdit = (p: ModelProvider) => {
    setEditing(p)
    form.setFieldsValue(p)
  }

  const onSave = async () => {
    const values = await form.validateFields()
    if (editing) {
      updateProvider(editing.id, { ...values, enabled: true })
      message.success('已保存')
    }
    setEditing(null)
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <Input.Search placeholder="搜索供应商" style={{ width: 240 }} />
        <Button icon={<PlusOutlined />}>新建供应商</Button>
        <Button onClick={() => message.info('即将上线')}>批量导入</Button>
        <Button onClick={() => message.info('即将上线')}>导出</Button>
      </div>
      <Row gutter={[12, 12]}>
        {providers.map(p => (
          <Col key={p.id} xs={24} sm={12} md={8} lg={6}>
            <Card hoverable onClick={() => openEdit(p)} size="small"
              style={{ borderRadius: 8, borderColor: p.id === defaultProviderId ? '#1677ff' : undefined }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: '#8c8c8c' }}>{p.models.length} 个模型</div>
                </div>
                <Switch
                  size="small" checked={p.enabled}
                  onClick={(_, e) => e.stopPropagation()}
                  onChange={() => toggleProvider(p.id)}
                />
              </div>
              <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {p.enabled ? <Tag color="success">已接入</Tag> : <Tag>未配置</Tag>}
                {p.id === defaultProviderId && <Tag color="blue">默认</Tag>}
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Drawer
        title={editing ? `编辑 · ${editing.name}` : ''}
        open={!!editing}
        onClose={() => setEditing(null)}
        width={480}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button onClick={() => { if (editing) { setDefaultProviderId(editing.id); message.success('已设为默认') } }}>
              设为默认
            </Button>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button onClick={() => setEditing(null)}>取消</Button>
              <Button type="primary" onClick={onSave}>保存</Button>
            </div>
          </div>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="供应商名称"><Input disabled /></Form.Item>
          <Form.Item name="apiEndpoint" label="API Endpoint"><Input /></Form.Item>
          <Form.Item name="apiKey" label="API Key"><Input.Password /></Form.Item>
          <Form.Item name="defaultModel" label="默认模型">
            <Select options={editing?.models.map(m => ({ label: m, value: m })) ?? []} />
          </Form.Item>
          <Form.Item name="temperature" label="温度（0 - 2）"><Slider min={0} max={2} step={0.1} /></Form.Item>
          <Form.Item name="maxTokens" label="最大 Token"><Input type="number" /></Form.Item>
        </Form>
      </Drawer>
    </div>
  )
}
```

- [ ] **Step 2: 验证编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/components/ai/config/ModelProviderPanel.tsx
git commit -m "feat(ai): implement ModelProviderPanel with card grid + edit drawer"
```

---

## Task 24: KnowledgeBasePanel（实装）

**Files:**
- Modify: `src/components/ai/config/KnowledgeBasePanel.tsx`

- [ ] **Step 1: 替换实现**

Replace `src/components/ai/config/KnowledgeBasePanel.tsx`:
```tsx
'use client'
import { useState } from 'react'
import { Button, Drawer, Form, Input, Select, Switch, Table, Tag, Tabs, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useAIConfigStore } from '@/stores/ai-config'
import type { KnowledgeBase } from '@/types/ai'

export function KnowledgeBasePanel() {
  const { knowledgeBases, updateKnowledgeBase, toggleKnowledgeBase } = useAIConfigStore()
  const [editing, setEditing] = useState<KnowledgeBase | null>(null)
  const [form] = Form.useForm()

  const structured = knowledgeBases.filter(k => k.type === 'structured')
  const documents = knowledgeBases.filter(k => k.type === 'document')

  const openEdit = (k: KnowledgeBase) => { setEditing(k); form.setFieldsValue(k) }
  const onSave = async () => {
    const values = await form.validateFields()
    if (editing) updateKnowledgeBase(editing.id, values)
    setEditing(null)
    message.success('已保存')
  }

  const structCols = [
    { title: '名称', dataIndex: 'name' },
    { title: '字段数', dataIndex: 'fields', render: (f: string[]) => f?.length ?? 0, width: 80 },
    { title: '记录数', dataIndex: 'recordCount', width: 100 },
    { title: '状态', dataIndex: 'indexStatus', width: 100,
      render: (s: string) => <Tag color={s === 'ready' ? 'green' : s === 'indexing' ? 'blue' : 'red'}>{s}</Tag> },
    { title: '启用', dataIndex: 'enabled', width: 80,
      render: (v: boolean, k: KnowledgeBase) => <Switch checked={v} onChange={() => toggleKnowledgeBase(k.id)} /> },
    { title: '操作', width: 80, render: (_: any, k: KnowledgeBase) => <a onClick={() => openEdit(k)}>编辑</a> },
  ]
  const docCols = [
    { title: '名称', dataIndex: 'name' },
    { title: '大小', dataIndex: 'size', width: 100 },
    { title: '状态', dataIndex: 'indexStatus', width: 100,
      render: (s: string) => <Tag color={s === 'ready' ? 'green' : s === 'indexing' ? 'blue' : 'red'}>
        {s === 'ready' ? '已索引' : s === 'indexing' ? '索引中' : '错误'}</Tag> },
    { title: '启用', dataIndex: 'enabled', width: 80,
      render: (v: boolean, k: KnowledgeBase) => <Switch checked={v} onChange={() => toggleKnowledgeBase(k.id)} /> },
    { title: '操作', width: 80, render: (_: any, k: KnowledgeBase) => <a onClick={() => openEdit(k)}>编辑</a> },
  ]

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <Input.Search placeholder="搜索知识库" style={{ width: 240 }} />
        <Button icon={<PlusOutlined />}>新建知识库</Button>
        <Button onClick={() => message.info('即将上线')}>批量导入</Button>
        <Button onClick={() => message.info('即将上线')}>导出</Button>
      </div>
      <Tabs
        items={[
          { key: 's', label: `结构化数据源 (${structured.length})`,
            children: <Table size="small" rowKey="id" columns={structCols} dataSource={structured} pagination={false} /> },
          { key: 'd', label: `文档知识 (${documents.length})`,
            children: <Table size="small" rowKey="id" columns={docCols} dataSource={documents} pagination={false} /> },
        ]}
      />
      <Drawer title={editing?.name} open={!!editing} onClose={() => setEditing(null)} width={480}
        footer={<div style={{ textAlign: 'right' }}><Button onClick={() => setEditing(null)} style={{ marginRight: 8 }}>取消</Button><Button type="primary" onClick={onSave}>保存</Button></div>}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称"><Input /></Form.Item>
          <Form.Item name="visibleRoles" label="可见角色">
            <Select mode="multiple" options={[
              { label: '系统管理员', value: '系统管理员' },
              { label: '项目经理', value: '项目经理' },
              { label: '产品经理', value: '产品经理' },
              { label: '开发工程师', value: '开发工程师' },
              { label: '测试工程师', value: '测试工程师' },
              { label: '管理层', value: '管理层' },
            ]} />
          </Form.Item>
          {editing?.type === 'document' && (<>
            <Form.Item label="切片策略">
              <Select defaultValue="semantic" options={[
                { label: '固定长度', value: 'fixed' },
                { label: '语义切分', value: 'semantic' },
              ]} />
            </Form.Item>
            <Form.Item label="Embedding 模型">
              <Select defaultValue="text-embedding-3-small" options={[
                { label: 'text-embedding-3-small', value: 'text-embedding-3-small' },
                { label: 'bge-large-zh', value: 'bge-large-zh' },
              ]} />
            </Form.Item>
          </>)}
        </Form>
      </Drawer>
    </div>
  )
}
```

- [ ] **Step 2: 验证编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add src/components/ai/config/KnowledgeBasePanel.tsx
git commit -m "feat(ai): implement KnowledgeBasePanel with structured/document split"
```

---

## Task 25: ToolsPanel + MCPServersPanel + PromptTemplatesPanel（实装）

**Files:**
- Modify: `src/components/ai/config/ToolsPanel.tsx`
- Modify: `src/components/ai/config/MCPServersPanel.tsx`
- Modify: `src/components/ai/config/PromptTemplatesPanel.tsx`

**说明：** 三个 panel 结构高度相似（列表 + Drawer 编辑），放在一个 task 里完成以减少 commit 噪音。

- [ ] **Step 1: ToolsPanel**

Replace `src/components/ai/config/ToolsPanel.tsx`:
```tsx
'use client'
import { useState } from 'react'
import { Button, Drawer, Form, Input, Select, Switch, Table, Tag, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useAIConfigStore } from '@/stores/ai-config'
import type { Tool } from '@/types/ai'

export function ToolsPanel() {
  const { tools, updateTool, toggleTool } = useAIConfigStore()
  const [editing, setEditing] = useState<Tool | null>(null)
  const [form] = Form.useForm()

  const cols = [
    { title: '名称', dataIndex: 'name' },
    { title: '类型', dataIndex: 'type', width: 100,
      render: (t: string) => <Tag>{t.toUpperCase()}</Tag> },
    { title: '调用方式', dataIndex: 'callTemplate', ellipsis: true },
    { title: '关联系统', dataIndex: 'relatedSystem', width: 100 },
    { title: '状态', dataIndex: 'enabled', width: 100,
      render: (v: boolean, t: Tool) => <Switch checked={v} onChange={() => toggleTool(t.id)} /> },
    { title: '操作', width: 80, render: (_: any, t: Tool) => <a onClick={() => { setEditing(t); form.setFieldsValue(t) }}>编辑</a> },
  ]

  const onSave = async () => {
    const v = await form.validateFields()
    if (editing) updateTool(editing.id, v)
    setEditing(null)
    message.success('已保存')
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <Input.Search placeholder="搜索工具" style={{ width: 240 }} />
        <Button icon={<PlusOutlined />}>新建工具</Button>
      </div>
      <Table size="small" rowKey="id" columns={cols} dataSource={tools} pagination={false} />
      <Drawer title={editing?.name} open={!!editing} onClose={() => setEditing(null)} width={480}
        footer={<div style={{ textAlign: 'right' }}><Button onClick={() => setEditing(null)} style={{ marginRight: 8 }}>取消</Button><Button type="primary" onClick={onSave}>保存</Button></div>}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称"><Input /></Form.Item>
          <Form.Item name="type" label="类型">
            <Select options={[
              { label: 'CLI', value: 'cli' },
              { label: 'HTTP', value: 'http' },
              { label: '内部函数', value: 'function' },
              { label: 'Shell', value: 'shell' },
            ]} />
          </Form.Item>
          <Form.Item name="callTemplate" label="调用模板（支持 {} 占位符）"><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="relatedSystem" label="关联系统"><Input /></Form.Item>
        </Form>
      </Drawer>
    </div>
  )
}
```

- [ ] **Step 2: MCPServersPanel**

Replace `src/components/ai/config/MCPServersPanel.tsx`:
```tsx
'use client'
import { useState } from 'react'
import { Badge, Button, Card, Col, Drawer, Form, Input, Row, Select, Switch, Tag, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useAIConfigStore } from '@/stores/ai-config'
import type { MCPServer } from '@/types/ai'

const STATUS_MAP = {
  connected: { color: 'success' as const, text: '已连接' },
  disconnected: { color: 'default' as const, text: '未连接' },
  error: { color: 'error' as const, text: '连接失败' },
}

export function MCPServersPanel() {
  const { mcpServers, updateMCPServer, toggleMCPServerTool } = useAIConfigStore()
  const [editing, setEditing] = useState<MCPServer | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [form] = Form.useForm()

  const testConnection = (s: MCPServer) => {
    message.loading({ content: '测试中...', key: 'mcp-test', duration: 0 })
    setTimeout(() => {
      if (s.connectionStatus === 'connected') {
        message.success({ content: '连接成功', key: 'mcp-test' })
      } else {
        message.error({ content: '连接失败', key: 'mcp-test' })
      }
    }, 1500)
  }

  const onSave = async () => {
    const v = await form.validateFields()
    if (editing) updateMCPServer(editing.id, v)
    setEditing(null)
    message.success('已保存')
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <Input.Search placeholder="搜索 MCP 服务器" style={{ width: 240 }} />
        <Button icon={<PlusOutlined />}>新建 MCP</Button>
      </div>
      <Row gutter={[12, 12]}>
        {mcpServers.map(s => {
          const status = STATUS_MAP[s.connectionStatus]
          const isExpanded = expanded === s.id
          return (
            <Col key={s.id} xs={24} md={12} lg={8}>
              <Card size="small" style={{ borderRadius: 8 }}
                title={<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Badge status={status.color} />
                  <span>{s.name}</span>
                  <Tag style={{ marginLeft: 'auto' }}>{s.protocol.toUpperCase()}</Tag>
                </div>}
                extra={<a onClick={() => { setEditing(s); form.setFieldsValue(s) }}>编辑</a>}
              >
                <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 8, wordBreak: 'break-all' }}>
                  {s.endpoint}
                </div>
                <div style={{ fontSize: 12, marginBottom: 8 }}>
                  {status.text} · 工具数：{s.exposedTools.length}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <Button size="small" onClick={() => testConnection(s)}>测试连接</Button>
                  <Button size="small" onClick={() => setExpanded(isExpanded ? null : s.id)}>
                    {isExpanded ? '收起工具' : '查看工具'}
                  </Button>
                </div>
                {isExpanded && (
                  <div style={{ marginTop: 12, borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
                    {s.exposedTools.map(t => (
                      <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 8,
                        padding: '4px 0', fontSize: 12 }}>
                        <Switch size="small" checked={t.enabled}
                          onChange={() => toggleMCPServerTool(s.id, t.name)} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 500 }}>{t.name}</div>
                          <div style={{ color: '#8c8c8c', fontSize: 11 }}>{t.description}</div>
                        </div>
                      </div>
                    ))}
                    {s.exposedTools.length === 0 && <div style={{ color: '#8c8c8c', fontSize: 12 }}>无可用工具</div>}
                  </div>
                )}
              </Card>
            </Col>
          )
        })}
      </Row>
      <Drawer title={editing?.name} open={!!editing} onClose={() => setEditing(null)} width={480}
        footer={<div style={{ textAlign: 'right' }}><Button onClick={() => setEditing(null)} style={{ marginRight: 8 }}>取消</Button><Button type="primary" onClick={onSave}>保存</Button></div>}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称"><Input /></Form.Item>
          <Form.Item name="protocol" label="协议">
            <Select options={[
              { label: 'stdio', value: 'stdio' },
              { label: 'SSE', value: 'sse' },
              { label: 'HTTP', value: 'http' },
            ]} />
          </Form.Item>
          <Form.Item name="endpoint" label="命令或 URL"><Input /></Form.Item>
        </Form>
      </Drawer>
    </div>
  )
}
```

- [ ] **Step 3: PromptTemplatesPanel**

Replace `src/components/ai/config/PromptTemplatesPanel.tsx`:
```tsx
'use client'
import { useState } from 'react'
import { Button, Card, Col, Drawer, Form, Input, Row, Select, Switch, Tag, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useAIConfigStore } from '@/stores/ai-config'
import type { PromptTemplate } from '@/types/ai'

const CATEGORY_COLORS: Record<string, string> = {
  'analysis': 'purple', 'query': 'blue', 'flow': 'green',
}
const CATEGORY_LABELS: Record<string, string> = {
  'analysis': '分析', 'query': '查询', 'flow': '流程',
}

export function PromptTemplatesPanel() {
  const { promptTemplates, updatePromptTemplate } = useAIConfigStore()
  const [editing, setEditing] = useState<PromptTemplate | null>(null)
  const [form] = Form.useForm()

  const onSave = async () => {
    const v = await form.validateFields()
    if (editing) updatePromptTemplate(editing.id, v)
    setEditing(null)
    message.success('已保存')
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <Input.Search placeholder="搜索模板" style={{ width: 240 }} />
        <Button icon={<PlusOutlined />}>新建模板</Button>
      </div>
      <Row gutter={[12, 12]}>
        {promptTemplates.map(t => (
          <Col key={t.id} xs={24} sm={12} md={8} lg={6}>
            <Card size="small" hoverable
              onClick={() => { setEditing(t); form.setFieldsValue(t) }}
              style={{ borderRadius: 8 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Tag color={CATEGORY_COLORS[t.category]}>{CATEGORY_LABELS[t.category]}</Tag>
                {t.showInQuickChips && <Tag color="gold">快捷</Tag>}
              </div>
              <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>{t.name}</div>
              <div style={{ fontSize: 12, color: '#8c8c8c',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.content}
              </div>
            </Card>
          </Col>
        ))}
      </Row>
      <Drawer title={editing?.name} open={!!editing} onClose={() => setEditing(null)} width={480}
        footer={<div style={{ textAlign: 'right' }}><Button onClick={() => setEditing(null)} style={{ marginRight: 8 }}>取消</Button><Button type="primary" onClick={onSave}>保存</Button></div>}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="模板名"><Input /></Form.Item>
          <Form.Item name="category" label="分类">
            <Select options={[
              { label: '分析', value: 'analysis' },
              { label: '查询', value: 'query' },
              { label: '流程', value: 'flow' },
            ]} />
          </Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="content" label="模板内容（{} 占位符）"><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="showInQuickChips" label="在快捷芯片显示" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  )
}
```

- [ ] **Step 4: 验证编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 5: 提交**

```bash
git add src/components/ai/config/ToolsPanel.tsx src/components/ai/config/MCPServersPanel.tsx src/components/ai/config/PromptTemplatesPanel.tsx
git commit -m "feat(ai): implement Tools/MCP/Prompt panels with list+drawer pattern"
```

---

## Task 26: 集成到 page.tsx 与 AppShell 的主导航

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/containers/AppShell.tsx`

**说明：** `activeModule` 是宽松的 `string` 类型；加 `'aiAssistant'` 不需修改类型。`AppShell.tsx` 里 MainHeader 的导航菜单通过 `Menu` 渲染（在第 121 行附近 `onClick={({ key }) => ...setActiveModule(key)...}`）。

- [ ] **Step 1: page.tsx 增加 aiAssistant 分支**

Modify `src/app/page.tsx`：

在 import 区末尾加：
```ts
import AIAssistantContainer from '@/containers/AIAssistantContainer'
```

在 `{activeModule === 'config' && <ConfigContainer />}` 这一行**后面**紧跟着加：
```tsx
{/* AI Assistant */}
{activeModule === 'aiAssistant' && <AIAssistantContainer />}
```

- [ ] **Step 2: AppShell MainHeader 菜单追加条目**

Modify `src/containers/AppShell.tsx`，定位到 MainHeader 的 `Menu` 渲染（第 121 行上下）。查找 `items={[` 或直接找 `activeModule` 菜单定义位置。在菜单 items 数组里追加：
```ts
{ key: 'aiAssistant', label: <span>🤖 智能助手</span> }
```

具体位置 —— 先运行这条命令定位：
```bash
grep -n "items=\[" src/containers/AppShell.tsx
```
然后在对应 `items=[...]` 数组里追加新条目（保持与现有条目的风格一致）。

- [ ] **Step 3: 验证编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: 手动验证**

启动 dev server（如已运行则跳过）：
```bash
npm run dev
```
在浏览器打开 `http://localhost:3004`，点击左上主导航的「🤖 智能助手」，应看到 Chat 界面（左侧会话栏空 + 中间空消息区 + 快捷芯片 + 输入框）。

- [ ] **Step 5: 提交**

```bash
git add src/app/page.tsx src/containers/AppShell.tsx
git commit -m "feat(ai): integrate AI Assistant module into main navigation"
```

---

## Task 27: ConfigContainer 集成 AI 配置 tab

**Files:**
- Modify: `src/containers/ConfigContainer.tsx`

**说明：** `ConfigContainer.tsx` 是 718 行大文件，使用 `<Tabs>` 承载若干配置 tab。需要先定位 Tabs 的 `items` 数组，把 AI 配置作为新 tab 追加。

- [ ] **Step 1: 定位 Tabs 渲染位置**

Run:
```bash
grep -n "Tabs\|items:\s*\[\|configTab" src/containers/ConfigContainer.tsx | head -20
```
记录结果。典型做法：在 `<Tabs items={[...]}>` 的 items 数组末尾追加 AI 配置条目。

- [ ] **Step 2: 导入 AIConfigPanel**

在 `ConfigContainer.tsx` 的 import 区（文件顶部）加：
```ts
import AIConfigPanel from '@/components/ai/config/AIConfigPanel'
```

- [ ] **Step 3: 在 Tabs items 数组末尾追加**

```ts
{ key: 'ai', label: 'AI 配置', children: <AIConfigPanel /> }
```

**注意：** 具体插入位置取决于该文件 Tabs 的渲染形态（可能是 JSX `<Tabs.TabPane>` 或 items 数组）。如果是 `<Tabs.TabPane>` 风格，则追加：
```tsx
<Tabs.TabPane key="ai" tab="AI 配置"><AIConfigPanel /></Tabs.TabPane>
```

根据当前 ConfigContainer.tsx 的既有写法匹配即可。

- [ ] **Step 4: 验证编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 5: 手动验证**

在浏览器点击「配置中心」，切到「AI 配置」tab，确认 5 个子 tab（模型供应商 / 知识库 / 工具 / MCP 服务器 / 提示词模板）都能切换、数据展示正常、Drawer 能打开。

- [ ] **Step 6: 提交**

```bash
git add src/containers/ConfigContainer.tsx
git commit -m "feat(ai): integrate AI config panel into config center"
```

---

## Task 28: MainHeader 增加全局「🤖 问 AI」按钮

**Files:**
- Modify: `src/containers/AppShell.tsx`

**说明：** MainHeader 顶部右侧是用户切换 Dropdown（Avatar + currentLoginUser）。需要在**其左侧**追加一个「🤖 问 AI」按钮：点击后调用 `setActiveModule('aiAssistant')`，若当前 `selectedProject` 存在则调用 `useAIChatStore.getState().bindProject(selectedProject.name)`。

- [ ] **Step 1: 在 AppShell.tsx 顶部 import 追加**

```ts
import { useAIChatStore } from '@/stores/ai-chat'
import { RobotOutlined } from '@ant-design/icons'
```

- [ ] **Step 2: 在 MainHeader 函数内部、用户 Dropdown 左侧插入按钮**

先定位用户 Dropdown 所在位置：
```bash
grep -n "Dropdown\|Avatar\|currentLoginUser" src/containers/AppShell.tsx | head -20
```

在返回 JSX 的 `<Dropdown>` 外层（包含 user switcher 的布局容器）左侧追加：
```tsx
<Button
  type="text"
  size="small"
  icon={<RobotOutlined />}
  onClick={() => {
    const { selectedProject, setActiveModule } = useProjectStore.getState()
    const { setActiveModule: setUi } = useUiStore.getState()
    const { bindProject } = useAIChatStore.getState()
    setUi('aiAssistant')
    if (selectedProject) bindProject(selectedProject.name)
  }}
  style={{ color: '#fff', marginRight: 12 }}
>
  问 AI
</Button>
```

**注意：** AppShell.tsx 中 `setActiveModule` 是来自 `useUiStore`，不是 `useProjectStore`。看 file 第 44 行：`setActiveModule: (v: string) => void` 来自 `useUiStore`。

修正后代码（按当前项目的 store 暴露方式）：
```tsx
<Button
  type="text"
  size="small"
  icon={<RobotOutlined />}
  onClick={() => {
    const proj = useProjectStore.getState().selectedProject
    useUiStore.getState().setActiveModule('aiAssistant')
    if (proj) useAIChatStore.getState().bindProject(proj.name)
  }}
  style={{ color: '#fff', marginRight: 12 }}
>
  问 AI
</Button>
```

- [ ] **Step 3: 验证编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: 手动验证**

在浏览器打开任意页面，顶部右侧的用户 Avatar 左侧应出现「🤖 问 AI」按钮。点击后进入智能助手模块。若之前在项目空间时点，应看到顶栏出现"讨论中：XX 项目"绑定标签。

- [ ] **Step 5: 提交**

```bash
git add src/containers/AppShell.tsx
git commit -m "feat(ai): add global \"问 AI\" button in main header"
```

---

## Task 29: 跨 tab 联动 + 端到端 demo 验证

**Files:** 无新增。此任务纯手动验证，不对代码做改动，但要求跑完一遍完整 demo 流程并记录观察。

- [ ] **Step 1: 运行全套测试与编译检查**

```bash
npm run test
```
Expected: vitest 所有测试通过（Task 7 的 11 个 matcher 测试）

```bash
npx tsc --noEmit
```
Expected: 无错误

```bash
npm run build
```
Expected: 构建成功（Next.js production build 完成，无错误）

- [ ] **Step 2: 启动 dev server 做端到端验证**

```bash
npm run dev
```

浏览器打开后，按 spec §11.4 的跨 tab 联动清单逐项验证：

**验证 1 — 提示词模板联动快捷芯片**
1. 打开智能助手，记录当前快捷芯片数量（应为 6 个）
2. 进入配置中心 → AI 配置 → 提示词模板
3. 找到任意一条 `showInQuickChips=false` 的模板（如"版本计划"），编辑并打开 `showInQuickChips`
4. 回到智能助手，**应看到快捷芯片数量增加到 7 条，且新条目出现**

**验证 2 — MCP 服务器禁用影响思考过程**
1. 进入配置中心 → AI 配置 → MCP 服务器
2. 展开"Jira MCP Server" 的工具列表，禁用其中 `jira_search_issues`
3. 回到智能助手，问一个会触发场景 ①"MR V2.3 的基本情况"
4. 观察 AI 思考过程的展示（Note: 当前实现未对 MCP 禁用状态做 UI 降级，此步属于 demo 扩展点 —— 记录为"待后续改进"）。核心目标是走通配置页的 UI 操作并无报错

**验证 3 — 切换默认模型影响顶栏徽章**
1. 进入配置中心 → AI 配置 → 模型供应商
2. 点击 "公司内网模型" 卡片，点击 Drawer 底部"设为默认"
3. 回到智能助手，**应看到顶栏"默认模型"小字变为 `internal-llm-v3`**

**验证 4 — 完整 demo 剧本跑一遍**

按如下顺序提问，记录每一步是否正常：
1. "X6877-D8400_H991 的基本情况" → 应显示思考过程 + 风险计划项卡片 + 项目信息卡片 + 跳转链接
2. "X6877-D8400_H991 的所有计划" → 应显示筛选器 + 计划表格（8 项）
3. "我在 X6877-D8400_H991 负责的计划" → 切换为"我负责"过滤（以 `张三` 登录为例应显示 `支付流程重构`）
4. "X6877-D8400_H991 的需求进展" → 应显示需求分布 + 需求列表
5. "X6877-D8400_H991 转维到哪一步了" → 应显示转维流程图 + 下一步行动清单
6. "今天天气怎么样" → 应走兜底场景
7. 切换登录用户到没有 `X6877-D8400_H991` 权限的用户（如 `杜甫`），再问 "X6877-D8400_H991 的基本情况" → 应显示权限拒绝响应 + SPM 姓名

**验证 5 — 项目空间跳转 AI 带上下文**
1. 从「工作台」点击进入任一项目详情（项目空间）
2. 点击顶部右侧的「🤖 问 AI」按钮
3. **应进入智能助手 + 顶栏显示"讨论中：XX 项目"绑定标签**
4. 问 "计划" → 应识别到当前项目上下文并返回对应 scenario

- [ ] **Step 3: 修复发现的问题**

若验证中发现任何问题（类型错误、场景不匹配、卡片渲染异常等），回到对应 task 修复。

- [ ] **Step 4: 最终提交**

如果上述验证全部通过、未做任何代码修改，本 task 不产出 commit。
如果有修复，最后做一次整体提交：

```bash
git add -A
git commit -m "fix(ai): resolve issues found during end-to-end demo walkthrough"
```

---

## 完成后的交付清单

- [x] 5 类 AI 资源配置完整可视化编辑（模型/知识库/工具/MCP/提示词）
- [x] Chat 界面含会话侧栏、消息列表、思考过程、卡片响应、引用来源、快捷芯片
- [x] 4 个核心场景 + 兜底 + 权限拒绝响应
- [x] 11 个关键词匹配器单元测试
- [x] 全局顶栏"问 AI"按钮 + 项目空间上下文自动绑定
- [x] 配置 ↔ Chat 闭环联动（默认模型、快捷芯片、MCP 工具列表）
- [x] localStorage 持久化会话历史
- [x] 无真实后端依赖，`npm run build` 成功
