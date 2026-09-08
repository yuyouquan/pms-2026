/* ── HR Pipeline sidebar navigation definition ──────────────────────── */

export type HrSidebarGroupKey = 'overview' | 'investment' | 'non-human' | 'config'

export interface HrSidebarLeafItem {
  key: string
  label: string
  /** Short description shown in expanded sidebar */
  description?: string
}

export interface HrSidebarGroup {
  key: HrSidebarGroupKey
  label: string
  /** Icon name from Ant Design Icons (resolved in component) */
  icon: string
  children: HrSidebarLeafItem[]
}

export const HR_SIDEBAR_NAV: HrSidebarGroup[] = [
  {
    key: 'overview',
    label: '资源总览',
    icon: 'DashboardOutlined',
    children: [
      { key: 'overview/manpower', label: '人力总览', description: '人员分布与投入概览' },
      { key: 'overview/expense', label: '费用总览', description: '费用支出汇总' },
      { key: 'overview/project', label: '项目总览', description: '项目资源分布' },
    ],
  },
  {
    key: 'investment',
    label: '人力投入',
    icon: 'TeamOutlined',
    children: [
      { key: 'investment/machine', label: '整机产品项目' },
      { key: 'investment/tos', label: 'tOS项目' },
      { key: 'investment/tech', label: '技术项目' },
      { key: 'investment/capability', label: '能力建设项目' },
      { key: 'investment/other', label: '其他项目' },
    ],
  },
  {
    key: 'non-human',
    label: '非人力投入',
    icon: 'FundOutlined',
    children: [
      { key: 'non-human/expense-budget', label: '费用预算' },
      { key: 'non-human/asset-budget', label: '资产预算' },
    ],
  },
  {
    key: 'config',
    label: '配置中心',
    icon: 'SettingOutlined',
    children: [
      { key: 'config/hr-model', label: '人力模型', description: '整机产品 — 人力模型配置' },
      { key: 'config/tos-phase-ratio', label: 'tOS阶段投入比', description: 'tOS项目 — 阶段投入比' },
      { key: 'config/tos-brand-allocation', label: '品牌&产品线分摊比', description: 'tOS项目 — 品牌分摊比' },
      { key: 'config/tech-module-dept', label: '模块与部门', description: '技术项目 — 模块与部门' },
      { key: 'config/tech-tmg', label: 'TMG及技术领域', description: '技术项目 — TMG及领域' },
      { key: 'config/tech-phase-ratio', label: '技术阶段投入比', description: '技术项目 — 阶段投入比' },
    ],
  },
]

/** Flat list of all leaf keys — useful for validation / iteration */
export const HR_SIDEBAR_LEAF_KEYS = HR_SIDEBAR_NAV.flatMap(g => g.children.map(c => c.key))

/** Default active leaf when module first entered */
export const HR_DEFAULT_ACTIVE_LEAF = 'overview/manpower' as const

/** Map group key → group display label */
export const HR_GROUP_LABEL_MAP: Record<HrSidebarGroupKey, string> = Object.fromEntries(
  HR_SIDEBAR_NAV.map(g => [g.key, g.label]),
) as Record<HrSidebarGroupKey, string>

/** Resolve which group a leaf key belongs to */
export function resolveGroupOfLeaf(leafKey: string): HrSidebarGroupKey | null {
  for (const g of HR_SIDEBAR_NAV) {
    if (g.children.some(c => c.key === leafKey)) return g.key
  }
  return null
}

/** Resolve leaf display label by key */
export function resolveLeafLabel(leafKey: string): string | null {
  for (const g of HR_SIDEBAR_NAV) {
    const leaf = g.children.find(c => c.key === leafKey)
    if (leaf) return leaf.label
  }
  return null
}
