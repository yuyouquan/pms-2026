'use client'
import { useState } from 'react'
import { Card, Table, Tag } from 'antd'
import type { RequirementDistData } from '@/types/ai'

export function RequirementDistCard({ data }: { data: RequirementDistData }) {
  const [activeStatus, setActiveStatus] = useState<string | null>(null)
  const visible = activeStatus ? data.requirements.filter(r => r.status === activeStatus) : data.requirements
  const total = data.totalCount || 1

  return (
    <Card size="small" style={{ borderRadius: 8 }}>
      <div style={{ fontWeight: 500, marginBottom: 12, fontSize: 14 }}>🧩 需求状态分布（共 {data.totalCount} 个）</div>
      {/* Simple horizontal stacked bar as "饼图" substitute */}
      <div style={{ display: 'flex', height: 24, borderRadius: 4, overflow: 'hidden', marginBottom: 8, border: '1px solid #f0f0f0' }}>
        {data.distribution.map(d => (
          d.count > 0 && (
            <div key={d.status}
              onClick={() => setActiveStatus(activeStatus === d.status ? null : d.status)}
              style={{ width: `${(d.count / total) * 100}%`, background: d.color, cursor: 'pointer',
                color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title={`${d.status}: ${d.count}`}
            >
              {d.count > 0 ? d.count : ''}
            </div>
          )
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12, fontSize: 12 }}>
        {data.distribution.map(d => (
          <div key={d.status} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
            onClick={() => setActiveStatus(activeStatus === d.status ? null : d.status)}>
            <span style={{ width: 10, height: 10, background: d.color, borderRadius: 2, display: 'inline-block' }} />
            <span>{d.status}: <b>{d.count}</b></span>
          </div>
        ))}
        {activeStatus && (
          <a style={{ marginLeft: 'auto' }} onClick={() => setActiveStatus(null)}>清除过滤</a>
        )}
      </div>
      <Table
        size="small"
        rowKey="id"
        columns={[
          { title: '需求名', dataIndex: 'name' },
          { title: '负责人', dataIndex: 'owner', width: 90 },
          { title: '状态', dataIndex: 'status', width: 100,
            render: (s: string) => {
              const color = data.distribution.find(d => d.status === s)?.color ?? '#9ca3af'
              return <Tag color={color} style={{ margin: 0, color: '#fff' }}>{s}</Tag>
            } },
          { title: '优先级', dataIndex: 'priority', width: 80 },
          { title: '阻塞原因', dataIndex: 'blockReason', width: 100,
            render: (v?: string) => v ? <Tag color="red">{v}</Tag> : '-' },
        ]}
        dataSource={visible}
        pagination={false}
      />
    </Card>
  )
}
