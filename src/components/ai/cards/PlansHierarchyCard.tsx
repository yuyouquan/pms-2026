'use client'
import { Card, Collapse, Tree, Tag, Progress } from 'antd'
import type { DataNode } from 'antd/es/tree'
import type { PlansHierarchyCardData, LeveledPlan } from '@/types/ai'

const L2_CATEGORY_COLOR: Record<string, string> = {
  '需求开发': 'blue', '版本火车': 'purple', '独立应用': 'gold', '测试': 'green', '其他': 'default',
}

function statusColor(p: LeveledPlan) {
  if (p.status === '已完成') return 'green'
  if (p.status === '延期' || p.status === '阻塞') return 'red'
  if (p.isRisk) return 'orange'
  return 'default'
}

function renderNode(p: LeveledPlan, icon: string, extra?: React.ReactNode) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span>{icon}</span>
      <span style={{ fontWeight: 500, color: p.isRisk ? '#ff4d4f' : undefined }}>{p.name}</span>
      {extra}
      {p.department && <Tag color="cyan" style={{ margin: 0 }}>{p.department}</Tag>}
      {p.market && <Tag color="blue" style={{ margin: 0 }}>{p.market}</Tag>}
      {p.owner && <span style={{ color: '#8c8c8c', fontSize: 12 }}>· {p.owner}</span>}
      <Tag color={statusColor(p)} style={{ margin: 0 }}>{p.status}</Tag>
      {p.progress > 0 && p.progress < 100 && (
        <Progress percent={p.progress} size="small" showInfo={false} style={{ width: 80, marginLeft: 4 }} />
      )}
    </span>
  )
}

// Build tree from a flat list using parentId
function buildTree(plans: LeveledPlan[], iconForDepth: (depth: number) => string): DataNode[] {
  // roots = plans with no parent (or whose parent isn't in this slice)
  const idsInSlice = new Set(plans.map(p => p.id))
  const roots = plans.filter(p => !p.parentId || !idsInSlice.has(p.parentId))
  const childrenOf = (id: string): LeveledPlan[] =>
    plans.filter(p => p.parentId === id)

  const toNode = (p: LeveledPlan): DataNode => ({
    key: p.id,
    title: renderNode(p, iconForDepth(p.depth)),
    children: childrenOf(p.id).map(toNode),
  })

  return roots.map(toNode)
}

const L1_ICON = (depth: number) => depth === 1 ? '🏁' : '🎯'
const L2_ICON = (depth: number) => depth === 1 ? '📂' : depth === 2 ? '📋' : '🔹'

export function PlansHierarchyCard({ data }: { data: PlansHierarchyCardData }) {
  // L1 tree (data.l1 contains all L1 plans regardless of depth)
  const l1Tree = buildTree(data.l1, L1_ICON)

  // L2 trees by category — combine data.l2 + data.l3 into one pool, then build per-category trees
  const allL2 = [...data.l2, ...data.l3]
  const categories = Array.from(new Set(allL2.map(p => p.category).filter(Boolean))) as string[]
  const l2TreesByCategory = categories.map(cat => {
    const plansInCat = allL2.filter(p => p.category === cat)
    return { category: cat, tree: buildTree(plansInCat, L2_ICON), count: plansInCat.length }
  })

  return (
    <Card size="small" style={{ borderRadius: 8 }}>
      <div style={{ fontWeight: 500, marginBottom: 12, fontSize: 14 }}>
        🌳 {data.projectName} · 计划层级
        <span style={{ fontSize: 12, color: '#8c8c8c', marginLeft: 8, fontWeight: 400 }}>
          一级 {data.l1.length} · 二级 {allL2.length}
        </span>
      </div>

      {/* L1 tree section */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#262626', marginBottom: 6 }}>
          🏁 一级计划（里程碑）
        </div>
        <Tree treeData={l1Tree} defaultExpandAll selectable={false} blockNode />
      </div>

      {/* L2 trees per category */}
      <div style={{ fontSize: 13, fontWeight: 500, color: '#262626', marginBottom: 6 }}>
        📋 二级计划（按分类）
      </div>
      <Collapse
        defaultActiveKey={categories}
        size="small"
        items={l2TreesByCategory.map(({ category, tree, count }) => ({
          key: category,
          label: (
            <span>
              <Tag color={L2_CATEGORY_COLOR[category] ?? 'default'} style={{ marginRight: 8 }}>{category}</Tag>
              <span style={{ fontSize: 12, color: '#8c8c8c' }}>{count} 项</span>
            </span>
          ),
          children: <Tree treeData={tree} defaultExpandAll selectable={false} blockNode />,
        }))}
      />
    </Card>
  )
}
