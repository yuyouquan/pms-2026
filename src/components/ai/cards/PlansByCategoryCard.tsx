'use client'
import { Card, Collapse, Tag, Table, Progress } from 'antd'
import type { PlansByCategoryCardData, LeveledPlan } from '@/types/ai'
import { MOCK_LEVELED_PLANS } from '@/mock/ai-extended'

const CATEGORY_COLOR: Record<string, string> = {
  '需求开发': 'blue', '版本火车': 'purple', '独立应用': 'gold', '测试': 'green', '其他': 'default',
}

function PlanTable({ plans }: { plans: LeveledPlan[] }) {
  const cols = [
    { title: '计划名', dataIndex: 'name',
      render: (n: string, r: LeveledPlan) =>
        r.isRisk ? <span style={{ color: '#ff4d4f', fontWeight: 500 }}>{n}</span> : n },
    { title: '负责人', dataIndex: 'owner', width: 90 },
    { title: '所属里程碑', width: 130,
      render: (_: any, r: LeveledPlan) => {
        const parent = MOCK_LEVELED_PLANS.find(p => p.id === r.parentId && p.level === 'L1')
        return parent ? <Tag color="geekblue" style={{ margin: 0 }}>{parent.name}</Tag> : '-'
      } },
    { title: '计划日期', dataIndex: 'planDate', width: 110 },
    { title: '进度', dataIndex: 'progress', width: 120,
      render: (p: number) => <Progress percent={p} size="small" showInfo={false} /> },
    { title: '状态', dataIndex: 'status', width: 90,
      render: (s: string, r: LeveledPlan) =>
        <Tag color={r.isRisk ? 'red' : s === '已完成' ? 'green' : 'default'} style={{ margin: 0 }}>{s}</Tag> },
  ]
  return <Table size="small" rowKey="id" columns={cols} dataSource={plans} pagination={false} />
}

export function PlansByCategoryCard({ data }: { data: PlansByCategoryCardData }) {
  if (data.category !== 'ALL') {
    return (
      <Card size="small" style={{ borderRadius: 8 }}>
        <div style={{ fontWeight: 500, marginBottom: 12, fontSize: 14 }}>
          📋 {data.projectName} · {data.category}（二级计划）
        </div>
        <PlanTable plans={data.l2Plans} />
      </Card>
    )
  }
  // Group by category
  const categories = Array.from(new Set(data.l2Plans.map(p => p.category ?? '其他')))
  return (
    <Card size="small" style={{ borderRadius: 8 }}>
      <div style={{ fontWeight: 500, marginBottom: 12, fontSize: 14 }}>
        📋 {data.projectName} · 二级计划（全部，按分类分组）
      </div>
      <Collapse
        defaultActiveKey={categories}
        items={categories.map(cat => {
          const plans = data.l2Plans.filter(p => (p.category ?? '其他') === cat)
          return {
            key: cat,
            label: (
              <span>
                <Tag color={CATEGORY_COLOR[cat] ?? 'default'} style={{ marginRight: 8 }}>{cat}</Tag>
                {plans.length} 项
              </span>
            ),
            children: <PlanTable plans={plans} />,
          }
        })}
      />
    </Card>
  )
}
