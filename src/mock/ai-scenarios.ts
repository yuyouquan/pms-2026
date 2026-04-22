import type { ScenarioConfig, ThinkingStep, ScenarioVars } from '@/types/ai'
import { useProjectStore } from '@/stores/project'
import { MOCK_VERSIONS, MOCK_PRODUCT_SPECS, MOCK_LEVELED_PLANS, L1_MILESTONE_ORDER } from '@/mock/ai-extended'

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
  // Read L2 plans with category '需求开发' — these are the project's requirement-development plans
  const l2Reqs = MOCK_LEVELED_PLANS.filter(
    p => p.projectName === projectName && p.level === 'L2' && p.category === '需求开发'
  )

  // Classify plan.status → distribution status buckets (demo heuristic)
  const classify = (row: typeof l2Reqs[0]) => {
    if (row.status === '延期' || row.status === '阻塞') return '阻塞'
    if (row.progress >= 100 || row.status === '已完成') return '已完成'
    if (row.progress >= 60) return '测试中'
    if (row.progress >= 10) return '开发中'
    return '待开始'
  }

  const requirements = l2Reqs.map(r => ({
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

// ─── Scenario ⑤ 版本查询 (new Phase 2) ───────────────────────

const SCENARIO_VERSION_QUERY: ScenarioConfig = {
  id: 'version-query',
  name: '版本查询',
  keywords: [
    ['版本'],
    ['发布'],
    ['release'],
  ],
  requiresProject: false,   // can be cross-project for "本周发了几个版本"
  priority: 10,             // higher than basic-info to catch version-centric queries first
  buildThinking: (vars) => [
    kb('版本主表 · 查询最近版本发布', 400),
    kb('构建系统 · 读取构建状态与指标', 500),
    reasoning('计算成功率与稳定性指标', 400),
  ],
  buildResponse: (vars) => {
    const input = (vars.rawInput ?? '').toLowerCase()
    const project = vars.projectName
    // Determine time range by keyword
    let timeRange = '近期'
    let daysBack = 14
    if (input.includes('本周') || input.includes('这周')) { timeRange = '本周'; daysBack = 7 }
    else if (input.includes('本月') || input.includes('这个月')) { timeRange = '本月'; daysBack = 30 }
    else if (input.includes('昨天')) { timeRange = '昨天'; daysBack = 1 }

    const now = new Date('2026-04-22').getTime()
    const cutoff = now - daysBack * 24 * 60 * 60 * 1000
    let items = MOCK_VERSIONS.filter(v => new Date(v.releaseDate).getTime() >= cutoff)
    if (project) items = items.filter(v => v.projectName === project)

    const successCount = items.filter(v => v.status === 'success').length
    const failedCount = items.filter(v => v.status === 'failed').length
    const total = items.length
    const successRate = total > 0 ? Math.round((successCount / total) * 100) : 0

    const scope = project ? `**${project}** ` : '全部项目 '
    const summary = total === 0
      ? `📦 ${scope}${timeRange}没有版本发布。`
      : `📦 ${scope}${timeRange}共发布 **${total}** 个版本，成功率 **${successRate}%**（成功 ${successCount} / 失败 ${failedCount}）`

    return {
      markdown: summary,
      cards: total === 0 ? [] : [
        { type: 'version-list', data: { projectName: project, timeRange, items, successRate } },
      ],
      references: [
        { label: '版本主表', index: 1 },
        { label: '构建系统', index: 2 },
      ],
    }
  },
}

// ─── Scenario ⑥ 版本对比 (new Phase 2) ──────────────────────

const SCENARIO_VERSION_COMPARE: ScenarioConfig = {
  id: 'version-compare',
  name: '版本对比',
  keywords: [
    ['版本', '对比'],
    ['版本', '比'],
    ['vs'],
    ['v', '相比'],
  ],
  requiresProject: true,
  priority: 12,   // higher than version-query so specific comparison wins
  buildThinking: (vars) => [
    kb('版本主表 · 加载对比候选版本', 400),
    kb('构建系统 · 拉取稳定性与性能指标', 500),
    reasoning('计算 delta 与变化趋势', 400),
  ],
  buildResponse: (vars) => {
    const project = vars.projectName!
    // Find two most recent successful versions for this project
    const versions = MOCK_VERSIONS
      .filter(v => v.projectName === project && v.status === 'success')
      .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate))

    if (versions.length < 2) {
      return {
        markdown: `📊 **${project}** 可对比的成功版本不足 2 个，暂无法生成对比。`,
        cards: [],
        references: [{ label: '版本主表', index: 1 }],
      }
    }

    const [b, a] = [versions[0], versions[1]]    // b = newer, a = older
    return {
      markdown: `📊 **${project}** 版本对比：**${a.versionNumber}** → **${b.versionNumber}**`,
      cards: [
        {
          type: 'version-compare', data: {
            a, b,
            stabilityDelta: b.stabilityScore - a.stabilityScore,
            perfDelta: b.perfScore - a.perfScore,
            defectDelta: b.defectCount - a.defectCount,
          },
        },
      ],
      references: [
        { label: '版本主表', index: 1 },
        { label: '构建系统', index: 2 },
      ],
    }
  },
}

// ─── Scenario ⑦ 产品信息 (new Phase 2) ──────────────────────

const SCENARIO_PRODUCT_INFO: ScenarioConfig = {
  id: 'product-info',
  name: '产品信息查询',
  keywords: [
    ['产品'],
    ['规格'],
    ['配置'],
    ['是啥'],
    ['啥产品'],
  ],
  requiresProject: true,
  priority: 9,
  buildThinking: (vars) => [
    kb(`产品规格库 · 查询 ${vars.projectName}`, 500),
    kb('项目主表 · 加载关联项目信息', 400),
  ],
  buildResponse: (vars) => {
    const project = vars.projectName!
    const spec = MOCK_PRODUCT_SPECS[project]
    if (!spec) {
      return {
        markdown: `📱 **${project}** 暂无产品规格信息。`,
        cards: [],
        references: [{ label: '产品规格库', index: 1 }],
      }
    }
    return {
      markdown: `📱 **${spec.codename}**（${spec.marketName}）是一款由 **${spec.brand}** 推出的 **${spec.productType}** 产品，面向 **${spec.markets.join(' / ')}** 市场，搭载 ${spec.os} + ${spec.tosVersion}。`,
      cards: [
        { type: 'product-info-v2', data: { spec } },
      ],
      references: [
        { label: '产品规格库', index: 1 },
        { label: '项目主表', index: 2 },
      ],
    }
  },
}

// ─── Scenario ⑧ 一级计划 / 里程碑 (new Phase 2) ──────────────

const SCENARIO_PLANS_L1: ScenarioConfig = {
  id: 'plans-l1',
  name: '一级计划 / 里程碑',
  keywords: [
    ['一级计划'],
    ['里程碑'],
    ['里程', '计划'],
    ['l1'],
  ],
  requiresProject: true,
  priority: 11,
  buildThinking: (vars) => [
    kb(`计划管理 · 加载 ${vars.projectName} 一级计划`, 500),
    reasoning('按里程碑顺序排序', 400),
  ],
  buildResponse: (vars) => {
    const project = vars.projectName!
    const milestones = MOCK_LEVELED_PLANS
      .filter(p => p.projectName === project && p.level === 'L1')
      .sort((a, b) => {
        const ia = L1_MILESTONE_ORDER.indexOf(a.name)
        const ib = L1_MILESTONE_ORDER.indexOf(b.name)
        if (ia !== -1 && ib !== -1) return ia - ib
        return a.planDate.localeCompare(b.planDate)
      })
    const riskCount = milestones.filter(m => m.isRisk).length
    return {
      markdown: `🏁 **${project}** 的一级计划（里程碑）共 **${milestones.length}** 个${riskCount > 0 ? `，其中 **${riskCount}** 个存在风险` : ''}`,
      cards: milestones.length === 0 ? [] : [
        { type: 'milestones', data: { projectName: project, milestones } },
      ],
      references: [{ label: '计划管理', index: 1 }],
    }
  },
}

// ─── Scenario ⑨ 二级计划 (new Phase 2) ─────────────────────

const SCENARIO_PLANS_L2: ScenarioConfig = {
  id: 'plans-l2',
  name: '二级计划 / 主计划',
  keywords: [
    ['二级计划'],
    ['主计划'],
    ['需求开发', '计划'],
    ['版本火车'],
    ['独立应用', '计划'],
    ['l2'],
  ],
  requiresProject: true,
  priority: 11,
  buildThinking: (vars) => [
    kb(`计划管理 · 加载 ${vars.projectName} 二级计划`, 500),
    reasoning('按分类分组', 400),
  ],
  buildResponse: (vars) => {
    const project = vars.projectName!
    const input = (vars.rawInput ?? '').toLowerCase()
    let category: any = 'ALL'
    if (input.includes('需求开发') || input.includes('需求')) category = '需求开发'
    else if (input.includes('版本火车') || input.includes('火车')) category = '版本火车'
    else if (input.includes('独立应用')) category = '独立应用'
    else if (input.includes('测试', 0)) category = '测试'

    let l2Plans = MOCK_LEVELED_PLANS.filter(p => p.projectName === project && p.level === 'L2')
    if (category !== 'ALL') l2Plans = l2Plans.filter(p => p.category === category)

    return {
      markdown: `📋 **${project}** 的二级计划${category !== 'ALL' ? `（${category}）` : ''}共 **${l2Plans.length}** 项`,
      cards: l2Plans.length === 0 ? [] : [
        { type: 'plans-by-category', data: { projectName: project, category, l2Plans } },
      ],
      references: [{ label: '计划管理', index: 1 }],
    }
  },
}

// ─── Scenario ⑩ 三级计划 / 部门拆分 (new Phase 2) ─────────

const SCENARIO_PLANS_L3: ScenarioConfig = {
  id: 'plans-l3',
  name: '三级计划 / 部门拆分',
  keywords: [
    ['三级计划'],
    ['部门', '计划'],
    ['拆分', '计划'],
    ['l3'],
    ['责任部门'],
  ],
  requiresProject: true,
  priority: 11,
  buildThinking: (vars) => [
    kb(`计划管理 · 加载 ${vars.projectName} 三级计划`, 500),
    reasoning('按责任部门分组', 400),
  ],
  buildResponse: (vars) => {
    const project = vars.projectName!
    const l3Plans = MOCK_LEVELED_PLANS.filter(p => p.projectName === project && p.level === 'L3')
    const departments = new Set(l3Plans.map(p => p.department).filter(Boolean) as string[])
    return {
      markdown: `🏗️ **${project}** 的三级计划共 **${l3Plans.length}** 项，分布在 **${departments.size}** 个责任部门`,
      cards: l3Plans.length === 0 ? [] : [
        { type: 'plans-by-department', data: { projectName: project, l3Plans } },
      ],
      references: [{ label: '计划管理', index: 1 }],
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

export const SCENARIOS: ScenarioConfig[] = [
  SCENARIO_VERSION_COMPARE,        // priority 12
  SCENARIO_PLANS_L1,               // priority 11
  SCENARIO_PLANS_L2,               // priority 11
  SCENARIO_PLANS_L3,               // priority 11
  SCENARIO_VERSION_QUERY,          // priority 10
  SCENARIO_PRODUCT_INFO,           // priority 9
  SCENARIO_TRANSFER_STATUS,        // priority 8
  SCENARIO_REQUIREMENT_STATUS,     // priority 7
  SCENARIO_PROJECT_PLANS,          // priority 6
  SCENARIO_PROJECT_BASIC_INFO,     // priority 5
  FALLBACK,
]

// Helper shared by scenario builders
export { kb, tool, mcp, reasoning }
