'use client'
import { Card, Collapse, Tree, Tag, Progress } from 'antd'
import type { DataNode } from 'antd/es/tree'
import type { PlansByCategoryCardData, LeveledPlan } from '@/types/ai'

const CATEGORY_COLOR: Record<string, string> = {
  '需求开发': 'blue', '版本火车': 'purple', '独立应用': 'gold', '测试': 'green', '其他': 'default',
}

function statusColor(p: LeveledPlan) {
  if (p.status === '已完成') return 'green'
  if (p.status === '延期' || p.status === '阻塞') return 'red'
  if (p.isRisk) return 'orange'
  return 'default'
}

function nodeIcon(depth: number) {
  return depth === 1 ? '📂' : depth === 2 ? '📋' : '🔹'
}

function buildTree(plans: LeveledPlan[]): DataNode[] {
  const idsInSlice = new Set(plans.map(p => p.id))
  const roots = plans.filter(p => !p.parentId || !idsInSlice.has(p.parentId))
  const childrenOf = (id: string) => plans.filter(p => p.parentId === id)

  const toNode = (p: LeveledPlan): DataNode => ({
    key: p.id,
    title: (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span>{nodeIcon(p.depth)}</span>
        <span style={{ fontWeight: 500, color: p.isRisk ? '#ff4d4f' : undefined }}>{p.name}</span>
        {p.department && <Tag color="cyan" style={{ margin: 0 }}>{p.department}</Tag>}
        {p.market && <Tag color="blue" style={{ margin: 0 }}>{p.market}</Tag>}
        {p.owner && <span style={{ color: '#8c8c8c', fontSize: 12 }}>· {p.owner}</span>}
        <span style={{ color: '#8c8c8c', fontSize: 12 }}>· {p.planDate}</span>
        <Tag color={statusColor(p)} style={{ margin: 0 }}>{p.status}</Tag>
        {p.progress > 0 && p.progress < 100 && (
          <Progress percent={p.progress} size="small" showInfo={false} style={{ width: 80, marginLeft: 4 }} />
        )}
      </span>
    ),
    children: childrenOf(p.id).map(toNode),
  })

  return roots.map(toNode)
}

export function PlansByCategoryCard({ data }: { data: PlansByCategoryCardData }) {
  // Render single category if specified, else all categories as collapsible
  if (data.category !== 'ALL') {
    const tree = buildTree(data.l2Plans)
    return (
      <Card size="small" style={{ borderRadius: 8 }}>
        <div style={{ fontWeight: 500, marginBottom: 12, fontSize: 14 }}>
          📋 {data.projectName} · {data.category}（二级计划）
        </div>
        <Tree treeData={tree} defaultExpandAll selectable={false} blockNode />
      </Card>
    )
  }

  const categories = Array.from(new Set(data.l2Plans.map(p => p.category ?? '其他')))
  return (
    <Card size="small" style={{ borderRadius: 8 }}>
      <div style={{ fontWeight: 500, marginBottom: 12, fontSize: 14 }}>
        📋 {data.projectName} · 二级计划（按分类）
      </div>
      <Collapse
        defaultActiveKey={categories}
        size="small"
        items={categories.map(cat => {
          const plansInCat = data.l2Plans.filter(p => (p.category ?? '其他') === cat)
          return {
            key: cat,
            label: (
              <span>
                <Tag color={CATEGORY_COLOR[cat] ?? 'default'} style={{ marginRight: 8 }}>{cat}</Tag>
                <span style={{ fontSize: 12, color: '#8c8c8c' }}>{plansInCat.length} 项</span>
              </span>
            ),
            children: <Tree treeData={buildTree(plansInCat)} defaultExpandAll selectable={false} blockNode />,
          }
        })}
      />
    </Card>
  )
}
