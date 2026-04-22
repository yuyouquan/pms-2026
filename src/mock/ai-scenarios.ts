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
  FALLBACK,
]

// Helper shared by scenario builders
export { kb, tool, mcp, reasoning }
