'use client'

import { useMemo } from 'react'
import { Modal, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { ConfigRecord } from '@/types/hrConfig'
import { HR_MODEL_STATISTIC_PHASES, summarizeHrModels, type HrModelStatistic } from '@/lib/hrModelStatistics'

interface HrModelStatisticsModalProps {
  open: boolean
  records: ConfigRecord[]
  onCancel: () => void
}

const columns: ColumnsType<HrModelStatistic> = [
  { title: '模型版本号', dataIndex: 'modelVersion', key: 'modelVersion', width: 120, render: value => value || '未填写' },
  { title: '项目等级', dataIndex: 'projectLevel', key: 'projectLevel', width: 80, render: value => value || '-' },
  {
    title: '状态', dataIndex: 'status', key: 'status', width: 110,
    render: (status: HrModelStatistic['status']) => (
      <Tag color={status === 'enabled' ? 'green' : status === 'mixed' ? 'orange' : 'default'}>
        {status === 'enabled' ? '启用' : status === 'disabled' ? '禁用' : '状态不一致'}
      </Tag>
    ),
  },
  { title: '部门记录数', dataIndex: 'recordCount', key: 'recordCount', width: 100, align: 'right' },
  ...HR_MODEL_STATISTIC_PHASES.map(({ key, label }) => ({
    title: label, dataIndex: key, key, width: 100, align: 'right' as const,
    render: (value: number) => value.toFixed(1),
  })),
  { title: '合计', dataIndex: 'total', key: 'total', width: 100, align: 'right', render: (value: number) => <strong>{value.toFixed(1)}</strong> },
]

export default function HrModelStatisticsModal({ open, records, onCancel }: HrModelStatisticsModalProps) {
  const summaries = useMemo(() => summarizeHrModels(records), [records])

  return (
    <Modal title="模型版本统计" open={open} onCancel={onCancel} footer={null} width={1200} destroyOnHidden>
      <div style={{ margin: '12px 0', color: 'var(--pms-text-secondary)' }}>
        按模型版本和项目等级汇总全部部门记录，包含已禁用版本。
      </div>
      <Table<HrModelStatistic>
        rowKey="key"
        columns={columns}
        dataSource={summaries}
        size="small"
        scroll={{ x: 1110 }}
        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: total => `共 ${total} 组` }}
      />
    </Modal>
  )
}
