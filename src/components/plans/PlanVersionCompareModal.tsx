'use client'

import { useEffect, useMemo, useState } from 'react'
import { HistoryOutlined, SearchOutlined } from '@ant-design/icons'
import { Button, Checkbox, Modal, Select, Space, Table, Tooltip } from 'antd'
import type { CompareTableRow, FieldDiff } from '@/lib/versionCompare'

export interface PlanVersionCompareOption {
  id: string
  versionNo: string
  status: string
}

export interface PlanVersionCompareModalProps {
  open: boolean
  rows: CompareTableRow[]
  versions: PlanVersionCompareOption[]
  baseVersionId: string
  targetVersionId: string
  onBaseVersionChange: (versionId: string) => void
  onTargetVersionChange: (versionId: string) => void
  onCompare: () => void
  onCancel: () => void
}

type CompareFilterType = 'all' | CompareTableRow['changeType']

export function PlanVersionCompareModal({
  open,
  rows,
  versions,
  baseVersionId,
  targetVersionId,
  onBaseVersionChange,
  onTargetVersionChange,
  onCompare,
  onCancel,
}: PlanVersionCompareModalProps) {
  const [filterType, setFilterType] = useState<CompareFilterType>('all')
  const [showUnchanged, setShowUnchanged] = useState(false)

  useEffect(() => {
    if (!open) {
      setFilterType('all')
      setShowUnchanged(false)
    }
  }, [open])

  const handleCompare = () => {
    setFilterType('all')
    onCompare()
  }
  const handleCancel = () => {
    setFilterType('all')
    setShowUnchanged(false)
    onCancel()
  }

  const changedRows = useMemo(() => rows.filter(row => row.changeType !== '未变更'), [rows])
  const filteredRows = useMemo(() => {
    const sourceRows = showUnchanged ? rows : changedRows
    return filterType === 'all' ? sourceRows : sourceRows.filter(row => row.changeType === filterType)
  }, [changedRows, filterType, rows, showUnchanged])
  const stats = useMemo(() => ({
    added: changedRows.filter(row => row.changeType === '新增').length,
    deleted: changedRows.filter(row => row.changeType === '删除').length,
    modified: changedRows.filter(row => row.changeType === '修改').length,
  }), [changedRows])

  const renderDiffCell = (row: CompareTableRow, fieldKey: string, value: unknown) => {
    const diff = row.fieldDiffs.find((item: FieldDiff) => item.field === fieldKey)
    if (row.changeType === '修改' && diff) {
      return (
        <Tooltip title={<div style={{ fontSize: 12 }}><div>修改人: {row.modifier}</div><div>修改时间: {row.modifyTime}</div></div>}>
          <div style={{ lineHeight: 1.6 }}>
            <div style={{ color: '#ff4d4f', fontSize: 11, textDecoration: 'line-through', opacity: 0.7 }}>{diff.oldValue}</div>
            <div style={{ color: 'var(--pms-brand)', fontWeight: 600, fontSize: 12 }}>{diff.newValue}</div>
          </div>
        </Tooltip>
      )
    }
    if (row.changeType === '新增') return <span style={{ color: '#52c41a', fontWeight: 500 }}>{String(value || '-')}</span>
    if (row.changeType === '删除') return <span style={{ color: '#ff4d4f', textDecoration: 'line-through', opacity: 0.7 }}>{String(value || '-')}</span>
    return <span style={{ color: '#4b5563' }}>{String(value || '-')}</span>
  }
  const columns = [
    { title: '序号', dataIndex: 'taskId', key: 'taskId', width: 70, render: (value: string, row: CompareTableRow) => <span style={{ fontWeight: 600, fontSize: 12, color: row.changeType === '新增' ? '#52c41a' : row.changeType === '删除' ? '#ff4d4f' : row.changeType === '修改' ? 'var(--pms-brand)' : '#9ca3af' }}>{value}</span> },
    { title: '变更类型', dataIndex: 'changeType', key: 'changeType', width: 80, render: (value: CompareTableRow['changeType']) => { const config = { 新增: { color: '#52c41a', bg: '#f6ffed' }, 删除: { color: '#ff4d4f', bg: '#fff2f0' }, 修改: { color: 'var(--pms-brand)', bg: 'var(--pms-brand-surface)' }, 未变更: { color: '#9ca3af', bg: '#fafafa' } }[value]; return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500, color: config.color, background: config.bg, border: value === '修改' ? '1px solid var(--pms-brand-border)' : `1px solid ${config.color}20` }}>{value}</span> } },
    { title: '任务名称', dataIndex: 'taskName', key: 'taskName', width: 160, ellipsis: true, render: (value: string, row: CompareTableRow) => renderDiffCell(row, 'taskName', value) },
    { title: '责任人', dataIndex: 'responsible', key: 'responsible', width: 80, render: (value: string, row: CompareTableRow) => renderDiffCell(row, 'responsible', value) },
    { title: '前置任务', dataIndex: 'predecessor', key: 'predecessor', width: 80, render: (value: string, row: CompareTableRow) => renderDiffCell(row, 'predecessor', value) },
    { title: '计划开始', dataIndex: 'planStartDate', key: 'planStartDate', width: 105, render: (value: string, row: CompareTableRow) => renderDiffCell(row, 'planStartDate', value) },
    { title: '计划完成', dataIndex: 'planEndDate', key: 'planEndDate', width: 105, render: (value: string, row: CompareTableRow) => renderDiffCell(row, 'planEndDate', value) },
    { title: '预估工期', dataIndex: 'estimatedDays', key: 'estimatedDays', width: 80, render: (value: number, row: CompareTableRow) => renderDiffCell(row, 'estimatedDays', value ? `${value}天` : '-') },
    { title: '实际开始', dataIndex: 'actualStartDate', key: 'actualStartDate', width: 105, render: (value: string, row: CompareTableRow) => renderDiffCell(row, 'actualStartDate', value) },
    { title: '实际完成', dataIndex: 'actualEndDate', key: 'actualEndDate', width: 105, render: (value: string, row: CompareTableRow) => renderDiffCell(row, 'actualEndDate', value) },
    { title: '实际工期', dataIndex: 'actualDays', key: 'actualDays', width: 80, render: (value: number, row: CompareTableRow) => renderDiffCell(row, 'actualDays', value ? `${value}天` : '-') },
    { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: (value: string, row: CompareTableRow) => renderDiffCell(row, 'status', value) },
    { title: '进度', dataIndex: 'progress', key: 'progress', width: 70, render: (value: number, row: CompareTableRow) => renderDiffCell(row, 'progress', `${value}%`) },
  ]

  return (
    <Modal
      className="pms-modal"
      title={<Space><HistoryOutlined style={{ color: 'var(--pms-brand)' }} /><span style={{ fontWeight: 600 }}>历史版本对比</span></Space>}
      open={open}
      onCancel={handleCancel}
      footer={null}
      width={1200}
      styles={{ body: { padding: '20px 24px' } }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', background: 'linear-gradient(135deg, #f8fafc 0%, #eef2f7 100%)', borderRadius: 10, marginBottom: 16, border: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>基准版本</span>
          <Select aria-label="基准版本" value={baseVersionId} onChange={onBaseVersionChange} style={{ width: 180 }} options={versions.map(version => ({ value: version.id, label: `${version.versionNo} (${version.status})` }))} />
        </div>
        <div style={{ fontSize: 18, color: '#bfbfbf' }}>→</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>对比版本</span>
          <Select aria-label="对比版本" value={targetVersionId} onChange={onTargetVersionChange} style={{ width: 180 }} options={versions.map(version => ({ value: version.id, label: `${version.versionNo} (${version.status})` }))} />
        </div>
        <Button type="primary" icon={<SearchOutlined />} style={{ borderRadius: 6 }} onClick={handleCompare}>开始对比</Button>
      </div>
      {rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#bfbfbf' }}>
          <HistoryOutlined style={{ fontSize: 36, display: 'block', marginBottom: 12, color: '#e5e7eb' }} />
          <div style={{ fontSize: 14, color: '#9ca3af' }}>选择两个版本后点击“开始对比”查看差异</div>
        </div>
      ) : (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            {[
              { label: '变更总计', value: changedRows.length, color: 'var(--pms-brand)', filter: 'all' as const },
              { label: '新增', value: stats.added, color: '#52c41a', filter: '新增' as const },
              { label: '修改', value: stats.modified, color: 'var(--pms-brand)', filter: '修改' as const },
              { label: '删除', value: stats.deleted, color: '#ff4d4f', filter: '删除' as const },
            ].map(item => <button type="button" key={item.filter} onClick={() => setFilterType(item.filter)} style={{ flex: 1, padding: '10px 16px', borderRadius: 8, cursor: 'pointer', textAlign: 'left', background: filterType === item.filter ? `${item.color}10` : '#fafafa', border: filterType === item.filter ? `1px solid ${item.color}` : '1px solid #f3f4f6' }}><div style={{ fontSize: 20, fontWeight: 700, color: item.color }}>{item.value}</div><div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{item.label}</div></button>)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>共 {filteredRows.length} 条记录</span>
            <Checkbox checked={showUnchanged} onChange={event => setShowUnchanged(event.target.checked)}><span style={{ fontSize: 12 }}>显示未变更项</span></Checkbox>
          </div>
          <Table<CompareTableRow> className="pms-table" columns={columns} dataSource={filteredRows} size="small" bordered pagination={filteredRows.length > 15 ? { pageSize: 15, size: 'small', showTotal: total => `共 ${total} 条` } : false} scroll={{ x: 1200, y: 420 }} rowKey="key" onRow={record => ({ style: { background: record.changeType === '新增' ? '#f6ffed' : record.changeType === '删除' ? '#fff2f0' : record.changeType === '修改' ? 'var(--pms-brand-surface)' : undefined } })} />
        </div>
      )}
    </Modal>
  )
}
