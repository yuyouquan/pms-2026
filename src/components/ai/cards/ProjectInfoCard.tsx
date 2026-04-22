'use client'
import { Card, Descriptions, Tag } from 'antd'
import type { ProjectInfoCardData } from '@/types/ai'

export function ProjectInfoCard({ data }: { data: ProjectInfoCardData }) {
  return (
    <Card size="small" style={{ borderRadius: 8 }}>
      <Descriptions title={<span style={{ fontSize: 14 }}>📋 项目信息</span>} column={2} size="small">
        <Descriptions.Item label="名称">{data.name}</Descriptions.Item>
        <Descriptions.Item label="SPM">{data.spm}</Descriptions.Item>
        <Descriptions.Item label="排期">{data.schedule}</Descriptions.Item>
        <Descriptions.Item label="当前版本">{data.currentVersion}</Descriptions.Item>
        <Descriptions.Item label="状态"><Tag color="blue">{data.status}</Tag></Descriptions.Item>
        <Descriptions.Item label="描述" span={2}>{data.description}</Descriptions.Item>
      </Descriptions>
    </Card>
  )
}
