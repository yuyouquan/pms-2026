'use client'
import { useState } from 'react'
import { Card, Segmented, Table, Tag, Progress } from 'antd'
import type { PlansTableData, PlanRow } from '@/types/ai'
import { useProjectStore } from '@/stores/project'

const TYPE_COLOR: Record<string, string> = {
  '版本': 'purple',
  '需求': 'blue',
  '开发': 'gold',
  '测试': 'green',
  '其他': 'default',
}

export function PlansTableCard({ data }: { data: PlansTableData }) {
  const [activeFilter, setActiveFilter] = useState(data.activeFilter)
  const currentUser = useProjectStore(s => s.currentLoginUser)

  const visibleRows = data.rows.filter(r => {
    if (activeFilter === 'all') return true
    if (activeFilter === 'mine') return r.owner === currentUser
    return r.type === activeFilter
  })

  const columns = [
    {
      title: '类型',
      dataIndex: 'type',
      width: 80,
      render: (t: string) => (
        <Tag color={TYPE_COLOR[t]} style={{ margin: 0 }}>
          {t}
        </Tag>
      ),
    },
    {
      title: '计划名',
      dataIndex: 'name',
      render: (n: string, r: PlanRow) =>
        r.isRisk ? <span style={{ color: '#ff4d4f', fontWeight: 500 }}>{n}</span> : n,
    },
    {
      title: '负责人',
      dataIndex: 'owner',
      width: 90,
    },
    {
      title: '进度',
      dataIndex: 'progress',
      width: 120,
      render: (p: number) => <Progress percent={p} size="small" showInfo={false} />,
    },
    {
      title: '截止日',
      dataIndex: 'deadline',
      width: 110,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (s: string, r: PlanRow) => (
        <Tag color={r.isRisk ? 'red' : 'default'} style={{ margin: 0 }}>
          {s}
        </Tag>
      ),
    },
  ]

  return (
    <Card size="small" style={{ borderRadius: 8 }}>
      <div style={{ marginBottom: 12 }}>
        <Segmented
          size="small"
          value={activeFilter}
          onChange={(v) => setActiveFilter(v as string)}
          options={data.filters.map(f => ({ value: f.key, label: `${f.label} ${f.count}` }))}
        />
      </div>
      <Table
        size="small"
        rowKey="id"
        columns={columns}
        dataSource={visibleRows}
        pagination={false}
        rowClassName={(r) => (r.isRisk ? 'plans-table-risk-row' : '')}
      />
      <style jsx global>{`
        .plans-table-risk-row {
          background: #fff1f0;
        }
      `}</style>
    </Card>
  )
}
