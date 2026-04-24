import type { ScenarioConfig, ThinkingStep, ScenarioVars, LeveledPlan } from '@/types/ai'
import { useProjectStore } from '@/stores/project'
import { usePlanStore, INITIAL_LEVEL2_PLAN_META } from '@/stores/plan'
import { LEVEL1_TASKS } from '@/components/plan/PlanModule'
import { MOCK_VERSIONS, MOCK_PRODUCT_SPECS, MOCK_LEVELED_PLANS, L1_MILESTONE_ORDER } from '@/mock/ai-extended'
import { IR_MOCK_DATA, SR_MOCK_DATA } from '@/components/plans/RequirementDevPlan'
import { INITIAL_DATA as VERSION_TRAIN_RECORDS } from '@/components/plans/VersionTrainPlan'

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

// ─── L1 Plan derivation helper ──────────────────────────────────────

type PlanTask = {
  id: string
  parentId?: string
  taskName: string
  status: string
  progress: number
  responsible?: string
  planStartDate?: string
  planEndDate?: string
  actualStartDate?: string
  actualEndDate?: string
}

function mapStatus(raw: string): LeveledPlan['status'] {
  const s = raw ?? ''
  if (s.includes('已完成') || s === 'done') return '已完成'
  if (s.includes('延期')) return '延期'
  if (s.includes('阻塞')) return '阻塞'
  if (s.includes('进行中')) return '进行中'
  return '未开始'
}

function detectRisk(task: PlanTask): boolean {
  if (mapStatus(task.status) === '延期' || mapStatus(task.status) === '阻塞') return true
  // Heuristic: if planEndDate has passed and progress < 100, flag risk
  if (task.planEndDate && task.progress < 100) {
    const planEnd = new Date(task.planEndDate).getTime()
    const now = new Date('2026-04-22').getTime()   // demo current date
    if (planEnd < now && task.progress < 100) return true
  }
  return false
}

/**
 * Derive L1 LeveledPlan[] for a given project, reading from the real plan store.
 * 整机产品项目 (whole-machine products) with markets OP/TR/RU produce 3 sets tagged by market.
 * Other project types produce a single set from LEVEL1_TASKS template.
 */
function deriveL1Plans(projectName: string): LeveledPlan[] {
  const project = useProjectStore.getState().projects.find(p => p.name === projectName)
  const isWholeMachine = (project as any)?.type === '整机产品项目'
  const planStore = usePlanStore.getState()

  const convert = (tasks: PlanTask[], market?: string): LeveledPlan[] =>
    tasks.map(t => ({
      id: `l1-${projectName}-${market ?? 'default'}-${t.id}`,
      projectName,
      level: 'L1' as const,
      name: t.taskName,
      owner: t.responsible || '未分配',
      parentId: t.parentId ? `l1-${projectName}-${market ?? 'default'}-${t.parentId}` : undefined,
      depth: (t.parentId ? 2 : 1) as 1 | 2,
      market,
      planDate: t.planEndDate || t.planStartDate || '',
      actualDate: t.actualEndDate || undefined,
      progress: t.progress ?? 0,
      status: mapStatus(t.status),
      isRisk: detectRisk(t),
    }))

  if (isWholeMachine) {
    const projectMarkets = ((project as any)?.markets ?? []) as string[]
    const allMarkets: Array<'OP' | 'TR' | 'RU'> = ['OP', 'TR', 'RU']
    const marketsToUse = (projectMarkets.length > 0
      ? allMarkets.filter(m => projectMarkets.includes(m))
      : allMarkets) as Array<'OP' | 'TR' | 'RU'>

    const all: LeveledPlan[] = []
    for (const market of marketsToUse) {
      const marketData = planStore.marketPlanData[market]
      const tasks = ((marketData?.tasks ?? LEVEL1_TASKS) as unknown) as PlanTask[]
      all.push(...convert(tasks, market))
    }
    return all
  }

  // Non-whole-machine: use the LEVEL1_TASKS template
  return convert((LEVEL1_TASKS as unknown) as PlanTask[])
}

/**
 * Derive L2 LeveledPlan[] for a given project from plan store data.
 * Includes categories: 需求开发 (from createdLevel2Plans + level2PlanTasks), 版本火车 (same).
 * Returns empty array if project has no L2 plans in store.
 */
export function deriveL2Plans(projectName: string): LeveledPlan[] {
  const planStore = usePlanStore.getState()
  const plans = planStore.createdLevel2Plans
  const allTasks = planStore.level2PlanTasks as any[]
  const result: LeveledPlan[] = []

  for (const plan of plans) {
    // Check if this plan belongs to this project (via INITIAL_LEVEL2_PLAN_META or fixed plans which are shared)
    const meta = INITIAL_LEVEL2_PLAN_META[plan.id]
    const isForThisProject = meta ? meta.projectName === projectName : plan.fixed
    if (!isForThisProject) continue

    // Determine category
    const isRequirementDev = plan.name.includes('需求开发')
    const isVersionTrain = plan.name.includes('版本火车') || plan.name.includes('MR') || plan.name.includes('FR')
    const category: '需求开发' | '版本火车' | '独立应用' | '测试' | '其他' =
      isRequirementDev ? '需求开发'
      : isVersionTrain ? '版本火车'
      : '其他'

    // Root = the plan itself (depth 1)
    const rootId = `l2-${projectName}-${plan.id}`
    const meta_any = meta as any
    result.push({
      id: rootId,
      projectName,
      level: 'L2',
      depth: 1,
      category,
      name: plan.name,
      owner: meta_any?.spm ?? '未指派',
      market: meta_any?.marketName,
      planDate: '',
      progress: 0,
      status: '进行中',
      isRisk: false,
      description: meta_any ? `MR: ${meta_any.mrVersion ?? '-'} · tOS: ${meta_any.tosVersion ?? '-'}` : undefined,
    })

    // Tasks for this plan (planId matches)
    const planTasks = allTasks.filter(t => t.planId === plan.id)
    for (const t of planTasks) {
      const depthFromId = (String(t.id).match(/\./g) ?? []).length + 1
      // Map dotted id (1 / 1.1 / 1.1.1) to depth 1/2/3 — but L2 root is at depth 1, so these become depth 2/3/4.
      // Since user said L2 tree max depth 3, cap plan-task depth at 3.
      const ownDepth = Math.min(1 + depthFromId, 3) as 1 | 2 | 3
      const level: 'L2' | 'L3' = ownDepth === 3 ? 'L3' : 'L2'
      const taskParentId = t.parentId
        ? `l2-${projectName}-${plan.id}-${t.parentId}`
        : rootId
      result.push({
        id: `l2-${projectName}-${plan.id}-${t.id}`,
        projectName,
        level,
        depth: ownDepth,
        category,
        parentId: taskParentId,
        name: t.taskName,
        owner: t.responsible || '未指派',
        planDate: t.planEndDate || t.planStartDate || '',
        actualDate: t.actualEndDate || undefined,
        progress: t.progress ?? 0,
        status: mapStatus(t.status),
        isRisk: detectRisk(t),
      })
    }
  }

  return result
}

/**
 * Derive project info card data from real project store.
 * Includes a computed description + computed "基础信息 + 计划概要 + 配置概要".
 */
export function deriveProjectDescription(projectName: string): string {
  const project = useProjectStore.getState().projects.find(p => p.name === projectName)
  if (!project) return '（暂无描述）'
  const parts: string[] = []
  if ((project as any).brand && (project as any).marketName) parts.push(`${(project as any).brand} ${(project as any).marketName}`)
  parts.push(`${(project as any).type}`)
  if ((project as any).chipPlatform && (project as any).cpu) parts.push(`搭载 ${(project as any).chipPlatform} ${(project as any).cpu}`)
  if ((project as any).markets && (project as any).markets.length > 0) parts.push(`面向 ${(project as any).markets.join('/')} 市场`)
  if ((project as any).tosVersion) parts.push(`基于 ${(project as any).tosVersion}`)
  return parts.join('，') + '。'
}

/**
 * Derive a ProductSpec-shape object from real project data (replacing MOCK_PRODUCT_SPECS lookup).
 * Returns undefined if no real spec data available.
 */
export function deriveProductSpec(projectName: string): import('@/types/ai').ProductSpec | undefined {
  const project = useProjectStore.getState().projects.find(p => p.name === projectName) as any
  if (!project) return undefined
  // Build per-market from marketPlanData (use last milestone end date as launch date per market)
  const perMarket: Record<string, import('@/types/ai').MarketSpecificInfo> = {}
  if (project.type === '整机产品项目') {
    const markets = (project.markets ?? []) as string[]
    const planStore = usePlanStore.getState()
    for (const m of markets) {
      const marketTasks = planStore.marketPlanData[m]?.tasks as any[] | undefined
      let launchDate = project.launchDate ?? ''
      if (marketTasks && marketTasks.length > 0) {
        // Find '上市保障' phase or last phase
        const shangshi = marketTasks.find((t: any) => t.taskName === '上市保障')
        if (shangshi) launchDate = shangshi.planEndDate || launchDate
      }
      perMarket[m] = {
        launchDate,
        keyFeatures: [],   // unknown from real data; leave empty
        tosPatch: `${project.tosVersion}-${m}`,
        notes: `${m} 市场变体`,
      }
    }
  }

  return {
    projectName,
    codename: project.model ?? project.name,
    marketName: project.marketName ?? project.name,
    brand: project.brand ?? 'TECNO',
    cpu: project.cpu ?? '（未填）',
    memory: project.memory ?? '（未填）',
    lcd: project.lcd ?? '（未填）',
    frontCamera: project.frontCamera ?? '（未填）',
    primaryCamera: project.primaryCamera ?? '（未填）',
    os: project.operatingSystem ?? project.androidVersion ?? '（未填）',
    tosVersion: project.tosVersion ?? '（未填）',
    markets: project.markets ?? [],
    launchDate: project.launchDate ?? '',
    productType: project.productType ?? '',
    chipPlatform: project.chipPlatform ?? '',
    projectLevel: project.projectLevel ?? '',
    currentStage: project.currentNode ?? project.status,
    spm: project.spm ?? '',
    tpm: project.tpm ?? '',
    ppm: project.ppm ?? '',
    perMarket: Object.keys(perMarket).length > 0 ? perMarket : undefined,
  }
}

/**
 * Derive risk plans for a project from L1 data (plans marked as at-risk).
 * Replaces the MOCK_RISK_PLANS lookup.
 */
export function deriveRiskPlans(projectName: string): Array<{ planType: string; planName: string; owner: string; reason: string }> {
  const l1 = deriveL1Plans(projectName)
  const risky = l1.filter(p => p.isRisk)
  return risky.map(p => ({
    planType: '里程碑',
    planName: p.market ? `${p.name}（${p.market}）` : p.name,
    owner: p.owner,
    reason: p.status === '延期' ? '延期' : p.status === '阻塞' ? '阻塞' : '计划期已过仍未完成',
  }))
}

// ─── Scenario ① 项目基础信息查询 ──────────────────────────────

// DEPRECATED: risks now computed from real L1 via deriveRiskPlans()
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

// DEPRECATED: description now computed from real project fields via deriveProjectDescription()
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
    reasoning(`解析意图：查询「${vars.projectName}」基础信息（含计划 + 配置）`, 400),
    { icon: '🔒', type: 'permission', target: `权限校验...${vars.projectName} 通过`, delay: 350 },
    kb(`项目主表 · 加载 ${vars.projectName} 元数据`, 500),
    kb('计划管理 · 加载一级计划（里程碑）', 500),
    kb('计划管理 · 扫描风险计划项', 450),
    kb('产品规格库 · 加载硬件配置 / tOS / 市场', 500),
    mcp('Jira MCP Server · 拉取关联缺陷概况', 550),
    reasoning('综合三部分组装展示', 400),
  ],
  buildResponse: (vars) => {
    const name = vars.projectName!
    const p = useProjectStore.getState().projects.find(x => x.name === name)

    // Real risks from L1 data
    const risks = deriveRiskPlans(name)
    const hasRisk = risks.length > 0

    // Real milestones (L1)
    const milestones = deriveL1Plans(name)

    // Real config / spec
    const spec = deriveProductSpec(name)

    const headerParts: string[] = [`📋 **${name}** 基础信息如下（含 基础信息 / 计划信息 / 配置信息 三部分）`]
    if (hasRisk) {
      headerParts.push(`⚠️ 注意：该项目有 **${risks.length} 项计划处于风险状态**，建议优先关注 ↓`)
    }

    const cards: any[] = []

    if (hasRisk) cards.push({ type: 'risk-plans', data: { items: risks } })

    cards.push({
      type: 'project-info',
      data: {
        name,
        spm: p?.spm ?? '未知',
        schedule: p ? `${(p as any).planStartDate} ~ ${(p as any).planEndDate}` : '未知',
        currentVersion: (p as any)?.tosVersion ?? (p as any)?.androidVersion ?? '未知',
        status: p?.status ?? '未知',
        description: deriveProjectDescription(name),
      },
    })

    if (milestones.length > 0) {
      cards.push({ type: 'milestones', data: { projectName: name, milestones } })
    }

    if (spec) {
      cards.push({ type: 'product-info-v2', data: { spec } })
    }

    if (p) {
      cards.push({
        type: 'link',
        data: { text: '跳转到项目空间 →', href: '#', module: 'projectSpace', projectId: p.id },
      })
    }

    const references = [
      { label: '项目主表', index: 1 },
      { label: '计划管理', index: 2 },
      { label: '产品规格库', index: 3 },
    ]

    return { markdown: headerParts.join('\n\n'), cards, references }
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
  buildThinking: (vars) => [
    reasoning(`解析意图：查询「${vars.projectName}」计划${vars.ownership === 'mine' ? '（我负责）' : ''}${vars.planType ? `（${vars.planType}）` : ''}`, 400),
    { icon: '🔒', type: 'permission', target: `权限校验...${vars.projectName} 通过`, delay: 300 },
    kb('计划管理 · 加载所有计划数据', 500),
    reasoning('按筛选条件过滤（所有/我负责/类型）', 400),
    reasoning('整理为表格视图', 300),
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
  // Only include actual L2 plans (depth >= 2 within 需求开发 category) — not the domain groupers
  const l2Reqs = deriveL2Plans(projectName).filter(
    p => p.category === '需求开发' && p.depth >= 2
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
    reasoning(`解析意图：分析「${vars.projectName}」需求状态`, 400),
    { icon: '🔒', type: 'permission', target: `权限校验...${vars.projectName} 通过`, delay: 300 },
    kb(`项目主表 · 确认项目 ${vars.projectName}`, 400),
    kb('计划管理 · 筛选「需求开发」分类', 500),
    reasoning('按进度与状态分类到 5 个状态桶', 400),
    reasoning('识别风险项并标记优先级', 350),
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
    reasoning(`解析意图：查询「${vars.projectName}」转维进度`, 400),
    { icon: '🔒', type: 'permission', target: `权限校验...${vars.projectName} 通过`, delay: 300 },
    kb(`项目主表 · 确认 ${vars.projectName}`, 400),
    kb('转维申请表 · 加载当前转维状态', 500),
    kb('转维操作手册 · 加载流程定义', 500),
    mcp('SQA MCP Server · 拉取审核状态', 500),
    reasoning('定位当前阶段 + 推算下一步行动清单', 400),
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
    reasoning(`解析意图：${vars.projectName ? `「${vars.projectName}」` : '全项目'}版本发布查询`, 400),
    kb('版本主表 · 筛选时间窗版本', 500),
    tool('构建系统 API · 拉取每个版本的构建状态', 600),
    tool('质量看板 · 获取稳定性 / 性能指标', 500),
    reasoning('计算成功率与失败率', 350),
    reasoning('按发布日期排序并组装清单', 300),
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
    reasoning(`解析意图：对比「${vars.projectName}」近两个成功版本`, 400),
    kb('版本主表 · 加载候选成功版本列表', 500),
    tool('构建系统 API · 拉取较旧版本指标', 500),
    tool('构建系统 API · 拉取较新版本指标', 500),
    reasoning('计算 delta（稳定性 / 性能 / 缺陷数）', 400),
    reasoning('生成对比结论', 350),
  ],
  buildResponse: (vars) => {
    const project = vars.projectName!
    // Pick the newest market+buildType combo with at least 2 success versions
    const successes = MOCK_VERSIONS
      .filter(v => v.projectName === project && v.status === 'success')
      .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate))

    // Group by market+buildType and find a pair within the same group
    const groups: Record<string, typeof successes> = {}
    for (const v of successes) {
      const key = `${v.market}|${v.buildType}`
      if (!groups[key]) groups[key] = []
      groups[key].push(v)
    }

    const pair = Object.values(groups).find(g => g.length >= 2)
    if (!pair) {
      return {
        markdown: `📊 **${project}** 可对比的同市场+构建类型成功版本不足 2 个，暂无法生成对比。`,
        cards: [],
        references: [{ label: '版本主表', index: 1 }],
      }
    }

    const [b, a] = [pair[0], pair[1]]    // b = newer, a = older
    return {
      markdown: `📊 **${project}** 版本对比（${b.market} · ${b.buildType}）：**${a.versionNumber.split('(')[0]}** → **${b.versionNumber.split('(')[0]}**`,
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
    reasoning(`解析意图：查询「${vars.projectName}」产品规格`, 400),
    { icon: '🔒', type: 'permission', target: `权限校验...${vars.projectName} 通过`, delay: 300 },
    kb(`产品规格库 · 加载 ${vars.projectName} 完整规格`, 500),
    kb('项目主表 · 关联项目元数据', 400),
    tool('上市排期系统 · 获取首发与量产计划', 500),
    reasoning('综合规格 + 商业信息组装产品全貌', 350),
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

// ─── Scenario: 计划层级总览 (tree view) ───────────────

const SCENARIO_PLANS_HIERARCHY: ScenarioConfig = {
  id: 'plans-hierarchy',
  name: '计划层级总览',
  keywords: [
    ['计划', '层级'],
    ['计划', '树'],
    ['计划', '总览'],
    ['所有', '计划'],
    ['完整', '计划'],
    ['层级', '关系'],
  ],
  requiresProject: true,
  priority: 13,                  // higher than L1/L2/L3 (all at 11) and version-compare (12)
  buildThinking: (vars) => [
    reasoning(`解析意图：查询「${vars.projectName}」完整计划层级`, 400),
    { icon: '🔒', type: 'permission', target: `权限校验...${vars.projectName} 通过`, delay: 300 },
    kb(`计划管理 · 加载 ${vars.projectName} 全部 L1 节点`, 500),
    kb(`计划管理 · 加载 ${vars.projectName} 全部 L2 节点`, 500),
    kb(`计划管理 · 加载所有 L2 内部拆解`, 500),
    reasoning('分别构建里程碑树（L1）+ 分类树（L2）', 450),
    reasoning('计算总节点数与汇总指标', 350),
  ],
  buildResponse: (vars) => {
    const project = vars.projectName!
    const l1 = deriveL1Plans(project)
    const l2Derived = deriveL2Plans(project)
    const l2 = l2Derived.filter(p => p.level === 'L2')
    const l3 = l2Derived.filter(p => p.level === 'L3')
    const totalL2Tree = l2.length + l3.length
    return {
      markdown: `🌳 **${project}** 的计划层级：**${l1.length}** 个里程碑节点，**${totalL2Tree}** 个二级计划节点`,
      cards: [
        { type: 'plans-hierarchy', data: { projectName: project, l1, l2, l3 } },
      ],
      references: [{ label: '计划管理', index: 1 }],
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
    reasoning(`解析意图：查询「${vars.projectName}」一级计划（里程碑）`, 400),
    { icon: '🔒', type: 'permission', target: `权限校验...${vars.projectName} 通过`, delay: 300 },
    kb(`计划管理 · 加载 ${vars.projectName} L1 节点`, 500),
    reasoning('按 parent-child 重建里程碑树（最多 2 层）', 400),
    reasoning('扫描风险节点并标记', 300),
  ],
  buildResponse: (vars) => {
    const project = vars.projectName!
    const milestones = deriveL1Plans(project)
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
    reasoning(`解析意图：查询「${vars.projectName}」二级计划`, 400),
    { icon: '🔒', type: 'permission', target: `权限校验...${vars.projectName} 通过`, delay: 300 },
    kb(`计划管理 · 加载 ${vars.projectName} L2 节点`, 500),
    kb('计划管理 · 加载 L2 内部拆解节点', 500),
    reasoning('按分类（需求开发 / 版本火车 / 独立应用 / 测试）分组', 400),
    reasoning('按 parent-child 重建分类内的 3 层树', 400),
  ],
  buildResponse: (vars) => {
    const project = vars.projectName!
    const input = (vars.rawInput ?? '').toLowerCase()
    let category: any = 'ALL'
    if (input.includes('需求开发') || input.includes('需求')) category = '需求开发'
    else if (input.includes('版本火车') || input.includes('火车')) category = '版本火车'
    else if (input.includes('独立应用')) category = '独立应用'
    else if (input.includes('测试', 0)) category = '测试'

    // Include both L2 and L3 nodes — together they form the L2 tree structure
    let l2Plans = deriveL2Plans(project)
    if (category !== 'ALL') l2Plans = l2Plans.filter(p => p.category === category)

    if (l2Plans.length === 0) {
      return {
        markdown: `📋 **${project}** 当前没有维护二级计划数据。`,
        cards: [],
        references: [{ label: '计划管理', index: 1 }],
      }
    }

    return {
      markdown: `📋 **${project}** 的二级计划${category !== 'ALL' ? `（${category}）` : ''}共 **${l2Plans.length}** 项`,
      cards: [
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

// ─── Ask for project ───────────────────────────────────────────

const ASK_FOR_PROJECT: ScenarioConfig = {
  id: 'ask-for-project',
  name: '询问项目',
  keywords: [],
  requiresProject: false,
  priority: 0,
  buildThinking: () => [
    reasoning('解析意图：识别到是项目相关查询', 350),
    reasoning('扫描当前问题...未提取到项目名', 350),
    reasoning('检索对话上下文...最近 5 条历史也未命中', 400),
    reasoning('准备引导用户明确项目', 300),
  ],
  buildResponse: () => ({
    markdown: `🤔 你的问题涉及某个项目，但我从你的问题或上文里都没识别到项目名。\n\n请告诉我你想查询哪个项目？例如 **X6877-D8400_H991 的里程碑** 或直接写项目代号。`,
    cards: [],
    references: [],
  }),
}

// ─── Fallback ──────────────────────────────────────────────────

const FALLBACK: ScenarioConfig = {
  id: 'fallback',
  name: '兜底',
  keywords: [],
  requiresProject: false,
  priority: 0,
  buildThinking: () => [
    reasoning('解析用户意图...', 400),
    reasoning('检索可匹配场景...未命中', 400),
    reasoning('准备引导提示', 300),
  ],
  buildResponse: () => ({
    markdown: '这个问题超出了我当前的能力范围 😅 试试这些我能回答的：',
    cards: [],
    references: [],
  }),
}

export const SCENARIOS: ScenarioConfig[] = [
  SCENARIO_PLANS_HIERARCHY,        // priority 13 (new)
  SCENARIO_VERSION_COMPARE,        // priority 12
  SCENARIO_PLANS_L1,               // priority 11
  SCENARIO_PLANS_L2,               // priority 11
  // SCENARIO_PLANS_L3 removed — project has only L1+L2; L3 is per-L2-plan internal breakdown
  SCENARIO_VERSION_QUERY,          // priority 10
  SCENARIO_PRODUCT_INFO,           // priority 9
  SCENARIO_TRANSFER_STATUS,        // priority 8
  SCENARIO_REQUIREMENT_STATUS,     // priority 7
  SCENARIO_PROJECT_PLANS,          // priority 6
  SCENARIO_PROJECT_BASIC_INFO,     // priority 5
  ASK_FOR_PROJECT,
  FALLBACK,
]

// Helper shared by scenario builders
export { kb, tool, mcp, reasoning }
