'use client'
import { Card, Collapse, Tag, Table, Progress } from 'antd'
import type { PlansByDepartmentCardData, LeveledPlan } from '@/types/ai'

function PlanTable({ plans }: { plans: LeveledPlan[] }) {
  const cols = [
    { title: '计划名', dataIndex: 'name',
      render: (n: string, r: LeveledPlan) =>
        r.isRisk ? <span style={{ color: '#ff4d4f', fontWeight: 500 }}>{n}</span> : n },
    { title: '负责人', dataIndex: 'owner', width: 90 },
    { title: '计划日期', dataIndex: 'planDate', width: 110 },
    { title: '进度', dataIndex: 'progress', width: 120,
      render: (p: number) => <Progress percent={p} size="small" showInfo={false} /> },
    { title: '状态', dataIndex: 'status', width: 90,
      render: (s: string, r: LeveledPlan) =>
        <Tag color={r.isRisk ? 'red' : s === '已完成' ? 'green' : 'default'} style={{ margin: 0 }}>{s}</Tag> },
  ]
  return <Table size="small" rowKey="id" columns={cols} dataSource={plans} pagination={false} />
}

export function PlansByDepartmentCard({ data }: { data: PlansByDepartmentCardData }) {
  const departments = Array.from(new Set(data.l3Plans.map(p => p.department ?? '未分配')))
  return (
    <Card size="small" style={{ borderRadius: 8 }}>
      <div style={{ fontWeight: 500, marginBottom: 12, fontSize: 14 }}>
        🏗️ {data.projectName} · 三级计划（按责任部门分组）
      </div>
      <Collapse
        defaultActiveKey={departments}
        items={departments.map(dept => {
          const plans = data.l3Plans.filter(p => (p.department ?? '未分配') === dept)
          const riskCount = plans.filter(p => p.isRisk).length
          return {
            key: dept,
            label: (
              <span>
                <Tag color="cyan" style={{ marginRight: 8 }}>{dept}</Tag>
                {plans.length} 项
                {riskCount > 0 && <Tag color="red" style={{ marginLeft: 4 }}>⚠️ {riskCount} 风险</Tag>}
              </span>
            ),
            children: <PlanTable plans={plans} />,
          }
        })}
      />
    </Card>
  )
}
