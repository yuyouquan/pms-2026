'use client'
import { Card, Tree, Tag, Progress } from 'antd'
import type { DataNode } from 'antd/es/tree'
import type { MilestonesCardData, LeveledPlan } from '@/types/ai'

function statusColor(p: LeveledPlan) {
  if (p.status === '已完成') return 'green'
  if (p.status === '延期' || p.status === '阻塞') return 'red'
  if (p.isRisk) return 'orange'
  return 'default'
}

function buildTree(plans: LeveledPlan[]): DataNode[] {
  const idsInSlice = new Set(plans.map(p => p.id))
  const roots = plans.filter(p => !p.parentId || !idsInSlice.has(p.parentId))
  const childrenOf = (id: string) => plans.filter(p => p.parentId === id)

  const toNode = (p: LeveledPlan): DataNode => ({
    key: p.id,
    title: (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span>{p.depth === 1 ? '🏁' : '🎯'}</span>
        <span style={{ fontWeight: 500, color: p.isRisk ? '#ff4d4f' : undefined }}>{p.name}</span>
        {p.owner && <span style={{ color: '#8c8c8c', fontSize: 12 }}>· {p.owner}</span>}
        <span style={{ color: '#8c8c8c', fontSize: 12 }}>· 计划 {p.planDate}</span>
        {p.actualDate && <span style={{ color: '#8c8c8c', fontSize: 12 }}>· 实际 {p.actualDate}</span>}
        <Tag color={statusColor(p)} style={{ margin: 0 }}>{p.status}</Tag>
        {p.isRisk && <Tag color="red" style={{ margin: 0 }}>⚠️ 风险</Tag>}
        {p.progress > 0 && p.progress < 100 && (
          <Progress percent={p.progress} size="small" showInfo={false} style={{ width: 100, marginLeft: 4 }} />
        )}
      </span>
    ),
    children: childrenOf(p.id).map(toNode),
  })

  return roots.map(toNode)
}

export function MilestonesCard({ data }: { data: MilestonesCardData }) {
  const tree = buildTree(data.milestones)
  return (
    <Card size="small" style={{ borderRadius: 8 }}>
      <div style={{ fontWeight: 500, marginBottom: 12, fontSize: 14 }}>🏁 一级计划 / 里程碑</div>
      <Tree treeData={tree} defaultExpandAll selectable={false} blockNode />
    </Card>
  )
}
