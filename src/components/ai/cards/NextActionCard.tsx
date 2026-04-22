'use client'
import { Card, List } from 'antd'
import { RightCircleOutlined } from '@ant-design/icons'
import type { NextActionData } from '@/types/ai'

export function NextActionCard({ data }: { data: NextActionData }) {
  return (
    <Card size="small" style={{ borderRadius: 8, borderColor: '#91caff' }}>
      <div style={{ fontWeight: 500, marginBottom: 8, color: '#1677ff' }}>
        ⏭️ 【{data.stageName}】下一步行动
      </div>
      <List
        size="small"
        dataSource={data.actions}
        renderItem={(item) => (
          <List.Item style={{ padding: '6px 0', borderBottom: 'none' }}>
            <RightCircleOutlined style={{ color: '#1677ff', marginRight: 8 }} />
            {item}
          </List.Item>
        )}
      />
    </Card>
  )
}
