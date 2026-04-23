'use client'
import { Card, Table, Tag, Progress, Tooltip, Button, message } from 'antd'
import { CopyOutlined, LinkOutlined } from '@ant-design/icons'
import type { VersionListCardData, VersionRelease } from '@/types/ai'

const STATUS_COLOR: Record<string, string> = {
  success: 'green', failed: 'red', 'in-progress': 'blue',
}
const STATUS_LABEL: Record<string, string> = {
  success: '成功', failed: '失败', 'in-progress': '进行中',
}
const PURPOSE_COLOR: Record<string, string> = {
  '转测版本': 'blue', 'OTATEST版本': 'purple', 'Release版本': 'green', 'Hotfix版本': 'orange',
}

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text).then(() => message.success(`已复制 ${label}`))
}

export function VersionListCard({ data }: { data: VersionListCardData }) {
  const columns = [
    {
      title: '版本号', dataIndex: 'versionNumber', width: 260, fixed: 'left' as const,
      render: (v: string) => (
        <Tooltip title={v}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <a style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis',
              whiteSpace: 'nowrap', maxWidth: 220, display: 'inline-block', verticalAlign: 'bottom' }}>{v}</a>
            <Button size="small" type="text" icon={<CopyOutlined />}
              onClick={(e) => { e.stopPropagation(); copyToClipboard(v, '版本号') }} />
          </span>
        </Tooltip>
      ),
    },
    {
      title: 'Fingerprint', dataIndex: 'fingerprint', width: 260,
      render: (fp: string) => (
        <Tooltip title={fp}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 12, color: '#595959', overflow: 'hidden', textOverflow: 'ellipsis',
              whiteSpace: 'nowrap', maxWidth: 220, display: 'inline-block', verticalAlign: 'bottom' }}>{fp}</span>
            {fp !== '-' && (
              <Button size="small" type="text" icon={<CopyOutlined />}
                onClick={(e) => { e.stopPropagation(); copyToClipboard(fp, 'Fingerprint') }} />
            )}
          </span>
        </Tooltip>
      ),
    },
    {
      title: '版本用途', dataIndex: 'purpose', width: 100,
      render: (p: string) => <Tag color={PURPOSE_COLOR[p] ?? 'default'} style={{ margin: 0 }}>{p}</Tag>,
    },
    { title: '市场', dataIndex: 'market', width: 70,
      render: (m: string) => <Tag style={{ margin: 0 }}>{m}</Tag> },
    { title: '版本类型', dataIndex: 'buildType', width: 100 },
    { title: '是否SMR', dataIndex: 'isSmr', width: 80,
      render: (b: boolean) => b ? <Tag color="cyan">是</Tag> : <Tag>否</Tag> },
    { title: 'SMR校验', dataIndex: 'smrResult', width: 90,
      render: (r: string) => r === 'PASS' ? <Tag color="success">PASS</Tag>
        : r === 'FAIL' ? <Tag color="error">FAIL</Tag> : <span style={{ color: '#bfbfbf' }}>-</span> },
    { title: '发布日期', dataIndex: 'releaseDate', width: 110 },
    { title: '状态', dataIndex: 'status', width: 90,
      render: (s: string) => <Tag color={STATUS_COLOR[s]} style={{ margin: 0 }}>{STATUS_LABEL[s]}</Tag> },
    { title: '稳定性', dataIndex: 'stabilityScore', width: 120,
      render: (s: number, r: VersionRelease) => r.status === 'failed' ? '-' : (
        <Progress percent={s} size="small" showInfo={false}
          strokeColor={s >= 90 ? '#52c41a' : s >= 80 ? '#1677ff' : '#faad14'} />) },
    { title: '缺陷', dataIndex: 'defectCount', width: 60,
      render: (c: number) => <span style={{ color: c > 10 ? '#ff4d4f' : '#595959' }}>{c}</span> },
    { title: 'SCM 项目', dataIndex: 'scmProjectCode', width: 180,
      render: (c: string) => <span style={{ fontSize: 12, color: '#595959' }}>{c}</span> },
    { title: '链接', dataIndex: 'buildUrl', width: 60, fixed: 'right' as const,
      render: (u: string) => <a href={u} target="_blank" rel="noreferrer"><LinkOutlined /></a> },
  ]
  return (
    <Card size="small" style={{ borderRadius: 8 }}>
      <div style={{ fontWeight: 500, marginBottom: 12, fontSize: 14 }}>
        📦 版本发布清单（{data.timeRange}，成功率 {data.successRate}%）
      </div>
      <Table
        size="small"
        rowKey="id"
        columns={columns}
        dataSource={data.items}
        pagination={false}
        scroll={{ x: 1600 }}
      />
    </Card>
  )
}
