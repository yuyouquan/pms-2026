'use client'
import { Card, Tree, Tag, Progress } from 'antd'
import type { DataNode } from 'antd/es/tree'
import type { PlansHierarchyCardData, LeveledPlan } from '@/types/ai'

const L2_CATEGORY_COLOR: Record<string, string> = {
  '需求开发': 'blue', '版本火车': 'purple', '独立应用': 'gold', '测试': 'green', '其他': 'default',
}

function renderPlanLabel(p: LeveledPlan, icon: string, extra?: React.ReactNode) {
  const color = p.status === '已完成' ? 'green' : p.status === '延期' || p.status === '阻塞' ? 'red' : p.isRisk ? 'orange' : 'default'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span>{icon}</span>
      <span style={{ fontWeight: 500, color: p.isRisk ? '#ff4d4f' : undefined }}>{p.name}</span>
      {extra}
      {p.owner && <span style={{ color: '#8c8c8c', fontSize: 12 }}>· {p.owner}</span>}
      <Tag color={color} style={{ margin: 0 }}>{p.status}</Tag>
      {p.progress > 0 && p.progress < 100 && (
        <Progress percent={p.progress} size="small" showInfo={false} style={{ width: 80, marginLeft: 4 }} />
      )}
    </span>
  )
}

export function PlansHierarchyCard({ data }: { data: PlansHierarchyCardData }) {
  const treeData: DataNode[] = data.l1.map(l1 => {
    const l2Children = data.l2.filter(x => x.parentId === l1.id)
    return {
      key: l1.id,
      title: renderPlanLabel(l1, '🏁'),
      children: l2Children.map(l2 => {
        const l3Children = data.l3.filter(x => x.parentId === l2.id)
        const catBadge = l2.category ? <Tag color={L2_CATEGORY_COLOR[l2.category] ?? 'default'} style={{ margin: 0 }}>{l2.category}</Tag> : null
        return {
          key: l2.id,
          title: renderPlanLabel(l2, '📋', catBadge),
          children: l3Children.map(l3 => {
            const deptBadge = l3.department ? <Tag color="cyan" style={{ margin: 0 }}>{l3.department}</Tag> : null
            return {
              key: l3.id,
              title: renderPlanLabel(l3, '🏗️', deptBadge),
            }
          }),
        }
      }),
    }
  })

  // Expand all L1 nodes by default; collapse L2's children
  const defaultExpandedKeys = data.l1.map(l1 => l1.id)

  return (
    <Card size="small" style={{ borderRadius: 8 }}>
      <div style={{ fontWeight: 500, marginBottom: 12, fontSize: 14 }}>
        🌳 {data.projectName} · 计划层级总览
        <span style={{ fontSize: 12, color: '#8c8c8c', marginLeft: 8, fontWeight: 400 }}>
          L1 {data.l1.length} · L2 {data.l2.length} · L3 {data.l3.length}
        </span>
      </div>
      <Tree
        treeData={treeData}
        defaultExpandedKeys={defaultExpandedKeys}
        selectable={false}
        blockNode
      />
    </Card>
  )
}
