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
  // Version (highest priority per boss)
  { id: 'pt-v1', name: '本周发了几个版本', category: 'query',
    description: '查询本周发布版本统计',
    content: '本周发了几个版本', placeholders: [], showInQuickChips: true },
  { id: 'pt-v2', name: '项目最新版本', category: 'query',
    description: '查询项目最新发布版本',
    content: '{项目名} 最新版本', placeholders: ['项目名'], showInQuickChips: true },
  { id: 'pt-v3', name: '版本对比', category: 'analysis',
    description: '最近两个版本对比',
    content: '{项目名} 最近两个版本对比', placeholders: ['项目名'], showInQuickChips: true },

  // Product
  { id: 'pt-p1', name: '这是啥产品', category: 'query',
    description: '查询产品基础规格',
    content: '{项目名} 是啥产品', placeholders: ['项目名'], showInQuickChips: true },

  // Plans by level
  { id: 'pt-l1', name: '里程碑计划', category: 'query',
    description: '查询一级计划 / 里程碑',
    content: '{项目名} 的里程碑', placeholders: ['项目名'], showInQuickChips: true },
  { id: 'pt-l2', name: '二级计划', category: 'query',
    description: '查询二级计划',
    content: '{项目名} 的二级计划', placeholders: ['项目名'], showInQuickChips: true },
  { id: 'pt-l3', name: '三级计划（按部门）', category: 'query',
    description: '按责任部门查看三级计划',
    content: '{项目名} 的三级计划', placeholders: ['项目名'], showInQuickChips: false },

  // Existing
  { id: 'pt-b1', name: '项目基本情况', category: 'query',
    description: '项目基础信息',
    content: '{项目名} 的基本情况', placeholders: ['项目名'], showInQuickChips: false },
  { id: 'pt-r1', name: '需求状态', category: 'analysis',
    description: '需求状态分布',
    content: '{项目名} 的需求进展', placeholders: ['项目名'], showInQuickChips: false },
  { id: 'pt-t1', name: '转维进度', category: 'flow',
    description: '转维流程状态',
    content: '{项目名} 转维到哪一步了', placeholders: ['项目名'], showInQuickChips: false },
]

export const DEFAULT_PROVIDER_ID = 'anthropic'
