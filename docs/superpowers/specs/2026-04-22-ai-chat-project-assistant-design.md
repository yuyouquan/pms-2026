# AI Chat 项目助手 — 设计文档

- 状态: Draft
- 日期: 2026-04-22
- 作者: youquan.yu
- 上下文: 老板早会提出，希望在 PMS 系统上增加 AI chat，让用户输入项目名或项目相关问题，可以整合本系统数据及外部系统数据做分析并反馈结果。本次交付是 Demo 级，用于架构能力展示与下一步立项

## 1. 目标与非目标

### 目标
- 在现有 PMS-2026 前端工程中增加两个新界面：**智能助手 Chat** 与 **AI 配置**
- Chat 基于关键词 mock 实现，围绕 4 个核心业务主题（项目基础信息、项目计划、需求状态、转维流程）回答问题
- AI 配置展示完整的"模型 / 知识库 / 工具 / MCP / 提示词"5 类可配置资源，对齐市面主流 AI 平台（Dify / LobeChat / OpenWebUI）的结构与命名
- Chat 的思考过程与卡片响应能让老板直观看到"AI 在调用配置好的知识库 / 工具 / MCP"，形成配置 ↔ 使用的闭环叙事
- 项目相关的查询遵循现有 RBAC 体系，无权限时返回友好提示并告知项目 SPM 姓名

### 非目标
- 不接入真实 LLM（所有 AI 能力均关键词 mock）
- 不实现真实 MCP 客户端协议（连接状态与工具列表均展示层 mock）
- 不真实调用外部 CLI / HTTP API
- 不做多轮对话上下文记忆（每条输入独立匹配场景）
- 不做多 AI 助手角色切换（简化为单一默认助手）
- 不做权限申请流程（仅在 Chat 回复中告知 SPM 姓名，用户自行去飞书联系）
- 不做对话历史的后端持久化（仅 localStorage）
- 不做移动端适配、国际化

## 2. 总体架构

### 2.1 模块关系
```
┌────────────────────── PMS-2026 前端 ──────────────────────┐
│                                                            │
│  全局顶栏    ... [🤖 问 AI]  [👤 用户切换]                 │
│                                                            │
│  左侧主导航                                                │
│  ├─ 配置中心 (既有)                                        │
│  │   └─ AI 配置 tab (新增)                                 │
│  │       ├─ 模型供应商                                     │
│  │       ├─ 知识库                                         │
│  │       ├─ 工具                                           │
│  │       ├─ MCP 服务器                                     │
│  │       └─ 提示词模板                                     │
│  ├─ 项目空间 (既有)                                        │
│  ├─ 转维 (既有)                                            │
│  └─ 🤖 智能助手 (新增顶层)                                 │
│      ├─ 会话历史侧栏                                       │
│      └─ 主对话区 (ChatGPT 三区布局)                        │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 2.2 数据流
```
用户输入
  ↓
关键词匹配 (ai-matcher.ts)
  ↓ → 识别 scenarioId + 项目名实体 + 过滤修饰词
场景是否需要项目权限？
  ├─ 是 → 调用 permissionStore.hasProjectAccess
  │       ├─ 无权限 → 权限拒绝响应（告知 SPM 姓名）
  │       └─ 有权限 → 继续
  └─ 否 → 继续
  ↓
按场景配置分步渲染
  1. 思考过程（图标 + 调用目标 + 延迟）
  2. Markdown 正文（打字机效果）
  3. 结构化卡片（依次淡入）
  4. 引用来源
  ↓
追加到当前会话
```

### 2.3 关键设计原则
- **纯前端 demo**：无后端服务，无真实 API；所有"调用 MCP / 工具 / 知识库"都是视觉演出
- **配置 ↔ Chat 字符串对齐**：AI 配置里登记的资源名（如"Jira MCP Server"、"gitlab-cli"）必须与场景配置中思考过程引用的名字一致，通过相同字面量建立感知上的闭环
- **场景配置驱动**：所有业务逻辑写在 `src/mock/ai-scenarios.ts`，UI 组件按配置渲染，新增场景只需加一条配置

## 3. 功能决策摘要

| 维度 | 决策 | 备注 |
|---|---|---|
| AI 能力 | 关键词 mock | 无真实 LLM |
| 导航 | Chat 独立顶层 + AI 配置作为配置中心新 tab | |
| AI 配置结构 | 5 个平铺子 tab（模型 / 知识库 / 工具 / MCP / 提示词） | 对齐 Dify / LobeChat |
| Chat 布局 | ChatGPT 三区（会话侧栏 + 主对话） | |
| 响应形态 | 思考过程（可折叠）+ 结构化卡片 + 局部引用来源 | 演出节奏 ~4 秒 |
| 场景数 | 4 核心场景 + 1 兜底 | 围绕 4 大主题 |
| 提示词模板数 | 10 条 | 每个场景 2-3 条提问变体 |
| 权限 | 复用现有 RBAC；无权限时告知 SPM 姓名 | 由用户自行去飞书找 SPM |
| 多助手 | 不做 | 单一默认助手 |

## 4. 智能助手 Chat 界面

### 4.1 布局
参考 ChatGPT 三区：
- 左侧：**会话历史侧栏**（可折叠），含「+ 新对话」、置顶区、分组（今天 / 本周 / 更早）
- 中间顶部：**顶栏**（`📁 项目上下文 ×` + `🔄 新对话` + 右侧小字 `默认模型：claude-opus-4-7`）
- 中间中部：**消息列表**
- 中间底部：**快捷问题芯片** + **输入框**

### 4.2 消息气泡
**用户消息**：右对齐

**AI 消息**：左对齐，含以下可选模块（按场景配置展示）：
1. 思考过程面板（默认展开、可折叠）
2. Markdown 正文
3. 结构化卡片（8 种类型，见 §7）
4. 引用来源（横向显示 `📎 来源：X¹ · Y² · Z³`）
5. 底部操作：👍 👎 🔁 重新生成 📋 复制

### 4.3 演出节奏（发送后的视觉时序）
- t=0ms：用户消息气泡即时出现
- t=100ms：AI 气泡占位 + 骨架
- t=400ms/900ms/1400ms：思考过程分步出现
- t=1800ms：思考过程收起为 `✓ 已完成 N 步 ▼`
- t=1900ms 起：正文打字机流式输出（~30 字/秒）
- t=3500ms：卡片依次淡入
- t=4000ms：引用来源淡入，操作条显示

全程约 4-8 秒（视正文长度而定；卡片/引用在正文打字完成前就会开始淡入，二者并行）。各阶段时序来自场景配置里的 `delay`，可调。

### 4.4 项目上下文
- 从项目空间跳入时自动绑定当前项目，顶栏显示 `📁 讨论中：MR V2.3 ×`
- Chat 内也能从下拉手动绑定/解绑
- 未命中项目实体的提问会用当前绑定项目补充

### 4.5 快捷问题芯片
- 位置：输入框上方横排
- 数量：空会话时显示 4-6 条；有对话后缩减至 2-3 条
- 来源：提示词模板 tab 中 `showInQuickChips=true` 的模板
- 交互规则（按优先级）：
  - 模板**无占位符** → 直接用模板内容填入输入框并自动发送
  - 模板**有占位符** AND 当前有项目上下文 → 用上下文填充占位符后自动发送
  - 模板**有占位符** BUT 当前无项目上下文 → 将模板填入输入框（占位符 `{项目名}` 保留并高亮显示），光标定位到占位符处，等待用户手工输入后确认发送

### 4.6 全局入口
在应用全局顶栏、**用户切换控件左侧**新增「🤖 问 AI」按钮：
- 从任何模块点击都会跳入智能助手
- 若当前在项目空间，自动绑定 `selectedProject.name` 作为项目上下文

## 5. AI 配置界面

进入路径：配置中心 → 顶部新增 "AI 配置" tab → 进入后再分 5 个子 tab。

每个子 tab 统一布局：
```
[搜索]                        [+ 新建]  [批量导入] [导出]
列表区（卡片或表格）
点击条目 → 右侧 Drawer 详情/编辑表单
```

（批量导入/导出按钮仅展示，点击 toast "即将上线"）

### 5.1 Tab: 模型供应商

视觉：供应商卡片网格（Logo + 名称 + 已接入模型数 + 启用开关）。

预填充（8 个供应商，3 个已接入）：

| 供应商 | 状态 | 预置模型 |
|---|---|---|
| OpenAI | 已接入 | gpt-4o, gpt-4-turbo |
| Anthropic | 已接入 | claude-opus-4-7, claude-sonnet-4-6, claude-haiku-4-5 |
| 公司内网模型 | 已接入 | internal-llm-v3（默认） |
| 阿里通义 | 未配置 | - |
| 百度文心 | 未配置 | - |
| 智谱 GLM | 未配置 | - |
| Ollama 本地 | 未配置 | - |
| 自定义 (OpenAI 兼容) | 未配置 | - |

编辑 Drawer 字段：供应商名（只读）、API Endpoint、API Key（掩码）、默认模型（下拉）、温度（Slider 0-2）、最大 Token、超时、启用开关。

### 5.2 Tab: 知识库

视觉：表格，按类型分组（结构化数据源 / 文档知识）。

结构化数据源预填充（5 条）：
- 项目主表（24 字段，146 记录）
- 版本主表（18 字段，89 记录）
- 转维申请表（32 字段，8 记录）
- 路标视图数据（视图，12 字段，146 记录）
- 待办与计划（15 字段，234 记录）

文档知识预填充（3 条）：
- 转维操作手册 V3.pdf（1.2 MB，已索引）
- MR 版本发布流程.md（24 KB，已索引）
- 项目健康度评分标准.docx（56 KB，索引中）

编辑 Drawer：名称、表选择、字段勾选、可见角色（多选，枚举来自 `permissionStore.roles`，如 SPM / 开发 / 测试 / 访客）、启用开关；文档类额外有上传区、切片策略、Embedding 模型（均为展示字段）。

### 5.3 Tab: 工具

视觉：表格。

预填充（6 条）：

| 名称 | 类型 | 调用方式 | 关联系统 | 状态 |
|---|---|---|---|---|
| gitlab-cli | CLI | `glab issue list` | GitLab | 启用 |
| jenkins-cli | CLI | `jenkins-cli build` | Jenkins | 启用 |
| 项目空间跳转 | 函数 | JS function | PMS | 启用 |
| Jira HTTP API | HTTP | `GET /rest/api/2/...` | Jira | 启用 |
| 发送企微通知 | HTTP | `POST /cgi-bin/webhook/...` | 企业微信 | 启用 |
| 自定义脚本 | Shell | `bash ./scripts/...` | 本地 | 禁用 |

编辑 Drawer：名称、类型、调用模板（支持参数占位符）、参数 schema、超时、可见角色、启用开关。

### 5.4 Tab: MCP 服务器

视觉：卡片网格，每张卡片显示连接状态徽章 + 可用工具数，可展开查看暴露工具列表。

预填充（4 个）：
- Jira MCP Server（SSE，已连接，暴露 8 个工具）
- Confluence MCP（HTTP，已连接，5 个工具）
- 代码审查 MCP（stdio，已连接，3 个工具）
- Figma MCP（SSE，连接失败）

编辑 Drawer：名称、协议（stdio/SSE/HTTP）、命令或 URL、环境变量、连接测试按钮（点击后 setTimeout 1.5s 按当前 MCP 的 `connectionStatus` 字段返回结果：`connected` 显示成功 toast，其他状态显示失败 toast）。

### 5.5 Tab: 提示词模板

视觉：卡片网格。

预填充（10 条，对应 4 个场景的各种提问变体）：

| # | 模板名 | 场景 | 内容 | 在快捷芯片显示 |
|---|---|---|---|---|
| 1 | 项目基本情况 | ① | `{项目名} 的基本情况` | ✅ |
| 2 | 项目负责人是谁 | ① | `{项目名} 是谁负责的` | ✅ |
| 3 | 项目所有计划 | ② | `{项目名} 的所有计划` | ✅ |
| 4 | 我负责的计划 | ② | `我在 {项目名} 负责的计划` | ✅ |
| 5 | 版本计划 | ② | `{项目名} 的版本计划` | ❌ |
| 6 | 需求状态汇总 | ③ | `{项目名} 的需求进展` | ✅ |
| 7 | 需求阻塞情况 | ③ | `{项目名} 有哪些阻塞的需求` | ❌ |
| 8 | 转维进度 | ④ | `{项目名} 转维到哪一步了` | ✅ |
| 9 | 转维下一步 | ④ | `{项目名} 转维下一步该做什么` | ❌ |
| 10 | 转维负责人 | ④ | `{项目名} 当前转维是谁在处理` | ❌ |

编辑 Drawer：模板名、分类（analysis / query / flow）、描述、模板内容（`{}` 占位符高亮）、在快捷芯片显示开关。

## 6. 场景与匹配器

### 6.1 场景清单（4 核心 + 1 兜底）

#### 场景 ① 项目基础信息查询
- 关键词：`[["基本情况"], ["信息"], ["详情"], ["是谁", "负责"], ["负责人"]]` + 项目名
- 需要项目权限：是
- 思考过程：
  1. 🔍 调用知识库「项目主表」查询 {项目名}
  2. 🔍 调用知识库「待办与计划」扫描 {项目名} 的风险计划项
- 回答：
  - 开头：`📋 MR V2.3 基本信息如下`；有风险项时加 `⚠️ 注意：该项目有 N 项计划处于风险状态`
  - 卡片：风险计划项卡片（若有，最多 5 条）+ 项目信息卡片（名称 / SPM / 排期 / 当前版本 / 状态 / 描述）+ 跳转项目空间链接
- 引用：项目主表¹ · 待办与计划²

**风险项识别规则**（4 条，任一命中即为风险）：
- 状态为"延期"
- 截止日 ≤ 今日 + 3 天 且 进度 < 80%
- 状态标记"阻塞中"
- 优先级为"紧急"

#### 场景 ② 项目计划查询（多过滤维度）
- 关键词：主 `[["计划"], ["任务"], ["排期"]]` + 项目名
  - 可选 ownership：`["我", "我的", "我负责", "自己"]` → 过滤为当前用户负责
  - 可选 planType：`["版本", "需求", "开发", "测试"]` → 过滤为该类型
- 需要项目权限：是
- 思考过程：
  1. 🔍 调用知识库「待办与计划」查询 {项目名} 的计划
  2. 💭 按筛选条件过滤
- 回答：
  - 开头：`📅 MR V2.3 的 {筛选描述} 共 N 项`
  - 卡片：筛选器 Tab 组（`[全部] [我负责] [版本] [需求] [开发] [测试]`，可点切换实时过滤）+ 计划表格（类型 / 计划名 / 负责人 / 进度 / 截止日 / 状态，风险项红底高亮）
- 引用：待办与计划¹

#### 场景 ③ 项目需求状态汇总
- 关键词：`[["需求"], ["需求状态"], ["需求进展"]]` + 项目名
- 需要项目权限：是
- 思考过程：
  1. 🔍 调用知识库「项目主表」确认 {项目名}
  2. 🔍 调用知识库「待办与计划」筛选 {项目名} 下的需求类计划
  3. 💭 按状态分组统计
- 回答：
  - 开头：`🧩 MR V2.3 共有 N 个需求，当前状态分布如下`
  - 卡片：状态分布饼图卡片（待开始 / 开发中 / 测试中 / 已完成 / 阻塞，数量）+ 需求列表表格（可按状态筛选）
- 引用：项目主表¹ · 待办与计划²

#### 场景 ④ 项目转维流程状态
- 关键词：`[["转维"], ["转维进度"], ["转维流程"], ["转维", "下一步"]]` + 项目名
- 需要项目权限：是
- 思考过程：
  1. 🔍 调用知识库「项目主表」确认 {项目名}
  2. 🔍 调用知识库「转维申请表」查询 {项目名} 当前转维状态
  3. 🔍 调用知识库「转维操作手册」加载流程定义
- 回答：
  - 开头：`🚚 MR V2.3 当前转维进度：已完成 N 个阶段，当前处于【{当前阶段}】阶段`
  - 卡片：转维流程进度条（多阶段横向，高亮当前）+ 当前阶段详情（负责人、预计完成时间、未完成项）+ 下一步行动清单（3-5 件事）+ 跳转转维详情页链接
- 引用：转维申请表¹ · 转维操作手册²

#### 场景 ⑤ 兜底
- 触发条件：未命中任何场景
- 回答：`这个问题超出了我当前的能力范围 😅 试试这些我能回答的：`
- 卡片：4 条快捷芯片（覆盖 4 个主题各一条典型提问）

### 6.2 关键词匹配算法
```
1. 归一化：小写化 / 去空格 / 繁简统一
2. 项目名实体识别：
   a. 遍历 projectStore.projects 做最长匹配 + 模糊匹配（支持 "MR2.3" → "MR V2.3"）
   b. 若未在输入中识别到项目名，且 ctx.currentProject 非空，则回退采用 ctx.currentProject
3. 场景识别：每个场景的 keywords 是二维数组，外层 OR / 内层 AND
4. 多命中按 priority 降序取首个
5. 场景 ② 专属：识别 ownership 和 planType 修饰词
6. 回退判定：
   - 未命中任何场景 → fallback
   - 命中场景但 requiresProject=true 且仍无 projectName → fallback（并在兜底回答中提示用户"请在问题中带上项目名"）
```

关于项目名表达方式：下述场景描述中的"+ 项目名"指的是**必须能通过步骤 2 识别到项目名**（从输入或上下文），并非 keywords 数组内的字面量。

核心纯函数 `matchScenario(input, ctx): MatchResult`，可单元测试。

### 6.3 权限前置拦截
```
matchScenario 返回 scenarioId
  ↓
scenario.requiresProject?
  ├─ 否 → 直接执行场景
  └─ 是 → permissionStore.hasProjectAccess(currentUserId, projectName)?
          ├─ true → 执行场景
          └─ false → 权限拒绝响应
```

**权限拒绝响应（统一模板）：**
- 思考过程：`🔒 权限校验...无 {项目名} 的查看权限`（单步）
- 正文：`🔒 抱歉，你暂时没有 {项目名} 的查看权限。该项目的 SPM 是 {SPM姓名}，请去飞书找他申请。`
- 卡片：权限提示卡片（项目名 / SPM 姓名，仅信息，无按钮）
- 无引用

## 7. 数据模型

核心类型定义于 `src/types/ai.ts`：

```ts
// 配置层
export type ModelProvider = {
  id: string; name: string; logo?: string;
  enabled: boolean;
  apiEndpoint?: string; apiKey?: string;
  defaultModel?: string; models: string[];
  temperature: number; maxTokens: number;
};

export type KnowledgeBase = {
  id: string; name: string;
  type: 'structured' | 'document';
  recordCount?: number; size?: string;
  fields?: string[];
  indexStatus: 'ready' | 'indexing' | 'error';
  enabled: boolean;
};

export type Tool = {
  id: string; name: string;
  type: 'cli' | 'http' | 'function';
  callTemplate: string;
  paramSchema?: Record<string, { type: string; required: boolean }>;
  enabled: boolean;
};

export type MCPServer = {
  id: string; name: string;
  protocol: 'stdio' | 'sse' | 'http';
  endpoint: string;
  connectionStatus: 'connected' | 'disconnected' | 'error';
  exposedTools: { name: string; description: string; enabled: boolean }[];
};

export type PromptTemplate = {
  id: string; name: string;
  category: 'analysis' | 'query' | 'flow';
  content: string;
  placeholders: string[];
  showInQuickChips: boolean;
};

// 场景层
export type ScenarioId = 'project-basic-info' | 'project-plans' | 'requirement-status' | 'transfer-status' | 'fallback';

export type ThinkingStep = {
  icon: '🔍' | '🔧' | '🌐' | '💭' | '🔒';
  type: 'knowledge' | 'tool' | 'mcp' | 'reasoning' | 'permission';
  target: string;
  delay: number;
  note?: string;
};

export type ResponseCard =
  | { type: 'project-info'; data: ProjectInfoCardData }
  | { type: 'risk-plans'; data: RiskPlanCardData }
  | { type: 'plans-table'; data: PlansTableData }
  | { type: 'requirement-dist'; data: RequirementDistData }
  | { type: 'transfer-flow'; data: TransferFlowData }
  | { type: 'transfer-next-action'; data: NextActionData }
  | { type: 'link'; data: { text: string; href: string } }
  | { type: 'permission-notice'; data: { projectName: string; spm: string } };

export type ScenarioResponse = {
  markdown: string;
  cards: ResponseCard[];
  references: { label: string; index: number }[];
};

export type ScenarioVars = {
  projectName?: string;
  ownership?: 'all' | 'mine';
  planType?: string;
};

export type ScenarioConfig = {
  id: ScenarioId;
  name: string;
  keywords: string[][];
  requiresProject: boolean;
  modifiers?: {
    ownership?: string[];
    planType?: string[];
  };
  priority: number;
  buildThinking: (vars: ScenarioVars) => ThinkingStep[];
  buildResponse: (vars: ScenarioVars) => ScenarioResponse;
};

// 会话层
export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text?: string;
  thinkingSteps?: ThinkingStep[];
  cards?: ResponseCard[];
  references?: { label: string; index: number }[];
  timestamp: number;
  scenarioId?: ScenarioId;
};

export type Conversation = {
  id: string; title: string;
  messages: ChatMessage[];
  pinned: boolean;
  boundProject: string | null;
  createdAt: number; updatedAt: number;
};
```

## 8. 状态管理

### 8.1 `src/stores/ai-config.ts`
```ts
type AIConfigStore = {
  providers: ModelProvider[];
  knowledgeBases: KnowledgeBase[];
  tools: Tool[];
  mcpServers: MCPServer[];
  promptTemplates: PromptTemplate[];
  defaultProviderId: string;

  // 每类资源的 CRUD：add/update/remove/toggle
};
```

### 8.2 `src/stores/ai-chat.ts`
```ts
type AIChatStore = {
  conversations: Conversation[];
  activeConversationId: string | null;
  currentProjectContext: string | null;
  isStreaming: boolean;

  sendMessage: (text: string) => Promise<void>;
  createConversation: () => string;
  renameConversation: (id: string, title: string) => void;
  pinConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  bindProject: (projectName: string | null) => void;
  setActiveConversation: (id: string) => void;
};
```

`sendMessage` 主流程：
```
appendMessage(user)
set isStreaming = true
match = matchScenario(text, ctx)
if scenario.requiresProject:
  if !permissionStore.hasProjectAccess(currentUserId, match.vars.projectName):
    await streamPermissionDenied(match.vars.projectName)
    return
await streamScenarioResponse(match)
set isStreaming = false
```

会话持久化到 localStorage（key: `pms-2026-ai-chat`），打开 Chat 页面时从 localStorage 恢复。

## 9. 组件结构

```
src/
├─ stores/
│   ├─ ai-config.ts
│   └─ ai-chat.ts
├─ mock/
│   ├─ ai-config.ts          # 预填充 5 类资源
│   └─ ai-scenarios.ts       # 4 个场景 + 兜底配置
├─ components/
│   └─ ai/
│       ├─ AIAssistantPage.tsx
│       ├─ ConversationSidebar.tsx
│       ├─ ChatHeader.tsx
│       ├─ MessageList.tsx
│       ├─ MessageBubble.tsx
│       ├─ ThinkingProcess.tsx
│       ├─ ResponseCard.tsx          # 分发器
│       ├─ cards/
│       │   ├─ ProjectInfoCard.tsx
│       │   ├─ RiskPlansCard.tsx
│       │   ├─ PlansTableCard.tsx
│       │   ├─ RequirementDistCard.tsx
│       │   ├─ TransferFlowCard.tsx
│       │   ├─ NextActionCard.tsx
│       │   ├─ LinkCard.tsx
│       │   └─ PermissionNoticeCard.tsx
│       ├─ ReferenceList.tsx
│       ├─ QuickPromptChips.tsx
│       ├─ ChatInput.tsx
│       └─ config/
│           ├─ AIConfigPanel.tsx     # 5 子 tab 容器
│           ├─ ModelProviderPanel.tsx
│           ├─ KnowledgeBasePanel.tsx
│           ├─ ToolsPanel.tsx
│           ├─ MCPServersPanel.tsx
│           └─ PromptTemplatesPanel.tsx
├─ types/
│   └─ ai.ts
└─ lib/
    └─ ai-matcher.ts
```

## 10. 与现有代码的集成

| 改动点 | 文件 | 内容 |
|---|---|---|
| 主导航加入 "智能助手" | `src/app/page.tsx` | `activeModule` 联合类型加 `'aiAssistant'`；左侧菜单增加一项；switch 分支渲染 `<AIAssistantPage />` |
| 配置中心加入 "AI 配置" tab | `src/app/page.tsx` | tabs 数组增加一条；渲染 `<AIConfigPanel />` |
| 全局顶栏「🤖 问 AI」按钮 | `src/app/page.tsx` | 用户切换控件左侧新增按钮；点击 `setActiveModule('aiAssistant')`；若 `selectedProject` 存在则 `aiChatStore.bindProject(selectedProject.name)` |
| 项目补 SPM 字段 | 项目 mock 数据 + 项目类型 | `Project` 类型加 `spm: string`；所有项目补默认 SPM 姓名 |
| 权限 store 暴露项目级查询 | `src/stores/permission.ts` | 确认存在 `hasProjectAccess(userId: string, projectName: string): boolean`；若缺则补 |

`page.tsx` 预计改动 +80 行，其他均为新增。

## 11. 演出细节

### 11.1 思考过程分步渲染
- `ThinkingProcess.tsx` 挂载时 `useEffect` 按 `step.delay` 累积 `setTimeout`，依次 `setSteps(prev => [...prev, step])`
- 全部 step 展示完后等 300ms，切换 `collapsed=true`，显示摘要 `✓ 已完成 N 步 ▼`

### 11.2 打字机效果
- 自定义 hook `useTypingEffect(text, speed)`：
  - 30 字/秒
  - 返回当前已显示字符子串
- 所有标点处有 120ms 停顿增强自然感

### 11.3 卡片淡入
- 每张卡片延迟挂载（按顺序各延迟 200ms）
- CSS `opacity 0 → 1` + `translateY(10px → 0)` 过渡

### 11.4 跨 Tab 联动示例
演示可演出的 3 个联动场景：
- 在"提示词模板"新增一条 `showInQuickChips=true` 的模板 → 回到 Chat，快捷芯片立刻出现
- 在"MCP 服务器"禁用 "Jira MCP Server" → Chat 里相关场景的思考过程第 N 步换为 `⚠️ Jira MCP 未启用，跳过`
- 在"模型供应商"切换 `defaultProviderId` → Chat 顶栏小字"默认模型"跟着变

## 12. 范围边界（明确不做）

| 项 | 理由 |
|---|---|
| 真实 LLM 接入 | 本次仅 mock |
| 真实 MCP 客户端 | 连接/工具列表均 mock |
| 真实 CLI / HTTP 调用 | 视觉演出 |
| 多轮对话记忆 | 每条独立匹配 |
| 多 AI 助手切换 | 已砍 |
| 配置导入/导出 | 按钮仅 toast |
| 后端持久化 | 仅 localStorage |
| 移动端 | PC 场景为主 |
| 文档切片/Embedding 真执行 | 展示字段 |
| 权限申请流程 | 仅提示 SPM 姓名 |
| 流式"停止生成"按钮 | 预留接口不暴露 UI |
| 国际化 | 中文为主 |

## 13. 工作量粗估

| 板块 | 天数 |
|---|---|
| 类型定义 + 2 个 store | 0.5 |
| 关键词匹配器 + 场景配置 | 1.0 |
| Chat 界面（5 组件） | 1.5 |
| 8 种卡片组件 | 1.5 |
| AI 配置 5 子 tab | 2.0 |
| Mock 数据填充 | 1.0 |
| 集成到 page.tsx + 顶栏按钮 | 0.5 |
| 演练 + 文案打磨 + 联动调试 | 1.0 |
| **合计** | **~9 天** |

## 14. 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| 关键词匹配漏判导致 demo 现场翻车 | 高 | 兜底场景 + 匹配器单元测试 20+ 用例 + 模糊匹配项目名 |
| `src/app/page.tsx` 已达 4600 行，继续追加造成维护困难 | 中 | 新功能全部拆到 `src/components/ai/` 目录；`page.tsx` 只做 switch 分发 |
| 演出时序在性能差的机器上卡顿 | 中 | 时序走 `setTimeout` 而非动画队列；允许配置里调总时长 |
| 现有 `permissionStore` 无 `hasProjectAccess` 方法 | 中 | 实施前先核对；若缺则作为先置任务补齐 |
| Mock 数据与场景响应文案对不上 | 低 | 场景响应用 `buildResponse(vars)` 函数动态生成，避免硬编码 |

## 15. 后续演进（非本次范围）

- 接入真实 LLM（OpenAI/Claude 代理）时，只需替换 `sendMessage` 的匹配流程为模型调用；UI/配置层零改动
- 支持多助手切换（Tab 6 功能）：加回 `AIAssistantsPanel`，在 Chat 顶栏恢复助手选择下拉
- 增加更多场景（延期预警、跨项目对比、跨系统查询）：新增 `ScenarioConfig` 一条即可
- 对话上下文记忆：引入多轮 state tracking 机制
- 权限申请表单流程
