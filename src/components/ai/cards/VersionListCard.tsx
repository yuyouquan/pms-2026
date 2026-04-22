'use client'
import { Card, Table, Tag, Progress } from 'antd'
import { LinkOutlined } from '@ant-design/icons'
import type { VersionListCardData } from '@/types/ai'

const STATUS_COLOR: Record<string, string> = {
  success: 'green',
  failed: 'red',
  'in-progress': 'blue',
}

const STATUS_LABEL: Record<string, string> = {
  success: '成功',
  failed: '失败',
  'in-progress': '进行中',
}

export function VersionListCard({ data }: { data: VersionListCardData }) {
  const columns = [
    { title: '版本号', dataIndex: 'versionNumber', width: 100,
      render: (v: string, r: any) => <b>{v}</b> },
    { title: '类型', dataIndex: 'releaseType', width: 80,
      render: (t: string) => <Tag color="purple" style={{ margin: 0 }}>{t}</Tag> },
    { title: '项目', dataIndex: 'projectName', ellipsis: true },
    { title: '发布日期', dataIndex: 'releaseDate', width: 110 },
    { title: '状态', dataIndex: 'status', width: 80,
      render: (s: string) => <Tag color={STATUS_COLOR[s]} style={{ margin: 0 }}>{STATUS_LABEL[s]}</Tag> },
    { title: '稳定性', dataIndex: 'stabilityScore', width: 110,
      render: (s: number, r: any) => r.status === 'failed' ? '-' : (
        <Progress percent={s} size="small" showInfo={false}
          strokeColor={s >= 90 ? '#52c41a' : s >= 80 ? '#1677ff' : '#faad14'} />) },
    { title: '缺陷', dataIndex: 'defectCount', width: 60,
      render: (c: number, r: any) => <span style={{ color: c > 10 ? '#ff4d4f' : '#595959' }}>{c}</span> },
    { title: '链接', dataIndex: 'buildUrl', width: 60,
      render: (u: string) => <a href={u} target="_blank" rel="noreferrer"><LinkOutlined /></a> },
  ]
  return (
    <Card size="small" style={{ borderRadius: 8 }}>
      <div style={{ fontWeight: 500, marginBottom: 12, fontSize: 14 }}>
        📦 版本发布清单 ({data.timeRange}, 成功率 {data.successRate}%)
      </div>
      <Table size="small" rowKey="id" columns={columns} dataSource={data.items} pagination={false} />
    </Card>
  )
}
