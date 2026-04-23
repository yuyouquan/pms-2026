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
  | 'version-query'
  | 'version-compare'
  | 'product-info'
  | 'plans-l1'
  | 'plans-l2'
  | 'plans-l3'
  | 'plans-hierarchy'
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
  | { type: 'version-list'; data: VersionListCardData }
  | { type: 'version-compare'; data: VersionCompareCardData }
  | { type: 'product-info-v2'; data: ProductInfoCardData2 }
  | { type: 'milestones'; data: MilestonesCardData }
  | { type: 'plans-by-category'; data: PlansByCategoryCardData }
  | { type: 'plans-by-department'; data: PlansByDepartmentCardData }
  | { type: 'plans-hierarchy'; data: PlansHierarchyCardData }

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

// ─── Extended data (Phase 2) ──────────────────────────────────

export type VersionRelease = {
  id: string
  projectName: string              // PMS project (e.g. 'X6877-D8400_H991')
  scmProjectCode: string           // SCM identifier (e.g. 'CM8_H991(Android 16)')
  versionNumber: string            // e.g. 'CM8-16.2.0.230SP04(BASE006PF001AZ)'
  fingerprint: string              // e.g. 'TECNO/CM8-OP/TECNO-CM8:16/BP2A.250...'
  purpose: '转测版本' | 'OTATEST版本' | 'Release版本' | 'Hotfix版本'
  market: 'Base' | 'OP' | 'COCL' | 'TR' | 'RU'
  buildType: 'userdebug' | 'user'
  isSmr: boolean
  smrResult: '-' | 'PASS' | 'FAIL'
  releaseDate: string
  status: 'success' | 'failed' | 'in-progress'
  buildUrl: string
  stabilityScore: number
  perfScore: number
  defectCount: number
  notes?: string
}

export type ProductSpec = {
  projectName: string
  codename: string             // 'X6877'
  marketName: string           // 'NOTE 50 Pro'
  brand: string                // 'TECNO'
  cpu: string
  memory: string
  lcd: string
  frontCamera: string
  primaryCamera: string
  os: string                   // 'Android 16'
  tosVersion: string           // 'tOS 16.3'
  markets: string[]            // ['OP','TR','RU']
  launchDate: string
  productType: string          // '新品'
  chipPlatform: string         // 'MTK'
  projectLevel: string         // 'A'
  currentStage: string         // 'STR2'
  spm: string
  tpm: string
  ppm: string
}

export type PlanLevel = 'L1' | 'L2' | 'L3'
export type PlanCategoryL2 = '需求开发' | '版本火车' | '独立应用' | '测试' | '其他'

export type LeveledPlan = {
  id: string
  projectName: string
  level: PlanLevel
  name: string
  owner: string
  department?: string
  parentId?: string            // Can point to a node of same level (sub-milestones / sub-plans)
  category?: PlanCategoryL2
  depth: 1 | 2 | 3
  planDate: string
  actualDate?: string
  progress: number
  status: '未开始' | '进行中' | '已完成' | '延期' | '阻塞'
  isRisk: boolean
  description?: string
}

// Card data types for new scenarios

export type VersionListCardData = {
  projectName?: string         // undefined when cross-project
  timeRange: string            // '本周' | '本月' | '近 7 天' | etc
  items: VersionRelease[]
  successRate: number          // 0-100
}

export type VersionCompareCardData = {
  a: VersionRelease
  b: VersionRelease
  stabilityDelta: number       // b - a
  perfDelta: number
  defectDelta: number
}

export type ProductInfoCardData2 = {
  spec: ProductSpec
}

export type MilestonesCardData = {
  projectName: string
  milestones: LeveledPlan[]    // all L1
}

export type PlansByCategoryCardData = {
  projectName: string
  category: PlanCategoryL2 | 'ALL'
  l2Plans: LeveledPlan[]
  l1Parent?: LeveledPlan
}

export type PlansByDepartmentCardData = {
  projectName: string
  department?: string
  l3Plans: LeveledPlan[]
  l2Parent?: LeveledPlan
}

export type PlansHierarchyCardData = {
  projectName: string
  l1: LeveledPlan[]
  l2: LeveledPlan[]
  l3: LeveledPlan[]
}
