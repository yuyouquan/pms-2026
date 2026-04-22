import type { ScenarioConfig, ThinkingStep, ScenarioVars } from '@/types/ai'
import { useProjectStore } from '@/stores/project'

// ─── Shared helpers ─────────────────────────────────────────────────

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
  'X6855_H8917': '技术项目。',
  'X6876_H786': '整机产品项目。',
  'tOS17.1': 'tOS 17.1 技术项目。',
  'X6890-D8500_H1001': 'CAMON 系列整机产品。',
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
  'X6855_H8917': [
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
  'X6890-D8500_H1001': [
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
  SCENARIO_PROJECT_BASIC_INFO,
  SCENARIO_PROJECT_PLANS,
  SCENARIO_REQUIREMENT_STATUS,
  SCENARIO_TRANSFER_STATUS,
  FALLBACK,
]

// Helper shared by scenario builders
export { kb, tool, mcp, reasoning }
