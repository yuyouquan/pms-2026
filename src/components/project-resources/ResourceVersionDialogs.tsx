'use client'
import { useState } from 'react'
import { App, Form, Input, Modal, Select, Table, Tag } from 'antd'
import dayjs from 'dayjs'
import type { ResourceVersion } from '@/components/project-resources/resourceVersionAdapter'
import type { ResourceOperationLog, ResourceVersionOptions } from '@/types/resourceOperations'

export function ResourceVersionCreateDialog({ versions, sourceId, onCreate, onCancel }: {
  versions: ResourceVersion[]; sourceId?: string; onCreate: (options: ResourceVersionOptions) => void; onCancel: () => void
}) {
  const [form] = Form.useForm<ResourceVersionOptions>()
  const { message } = App.useApp()
  const [saving, setSaving] = useState(false)
  return <Modal open title="新建版本" okText="创建版本" cancelText="取消" confirmLoading={saving} onCancel={onCancel}
    onOk={async () => {
      const values = await form.validateFields().catch(() => null)
      if (!values) return
      setSaving(true)
      try { onCreate(values) } catch (error) { message.warning(error instanceof Error ? error.message : '创建失败') }
      finally { setSaving(false) }
    }}>
    <Form form={form} layout="vertical" initialValues={{ sourceVersionId: sourceId ?? '' }}>
      <Form.Item name="versionNumber" label="版本号" rules={[{ required: true, message: '请填写版本号' }, { pattern: /^\d+(\.\d+)*$/, message: '请填写数字版本号，例如 0.3 或 1.2' }]}>
        <Input autoFocus prefix="V" aria-label="新版本号" placeholder="例如 0.3" />
      </Form.Item>
      <Form.Item name="sourceVersionId" label="初始化方式">
        <Select aria-label="版本初始化方式" options={[{ value: '', label: '初始化空白版本' }, ...versions.map(version => ({ value: version.id, label: `复制 ${version.versionNumber}` }))]} />
      </Form.Item>
    </Form>
  </Modal>
}

export function ResourceOperationLogDialog({ logs, versionId, onCancel }: {
  logs: ResourceOperationLog[]; versionId?: string; onCancel: () => void
}) {
  const [filter, setFilter] = useState(versionId ?? 'all')
  const versions = [...new Map(logs.map(log => [log.versionId, log.versionNumber])).entries()]
  const selected = filter === 'all' ? logs : logs.filter(log => log.versionId === filter)
  return <Modal open title="操作日志" width={1000} footer={null} onCancel={onCancel}>
    <Select aria-label="日志版本" style={{ width: 180, marginBottom: 12 }} value={filter} onChange={setFilter}
      options={[{ value: 'all', label: '所有版本' }, ...versions.map(([value, label]) => ({ value, label }))]} />
    <Table<ResourceOperationLog> size="small" rowKey="id" dataSource={[...selected].sort((a, b) => b.timestamp.localeCompare(a.timestamp))}
      pagination={{ pageSize: 10, showSizeChanger: false }} scroll={{ x: 800 }} locale={{ emptyText: '暂无操作日志' }} columns={[
        { title: '版本', dataIndex: 'versionNumber', width: 90, render: value => <Tag>{value}</Tag> },
        { title: '操作', dataIndex: 'action', width: 130 },
        { title: '修改内容', key: 'changes', render: (_, log) => <div className="pms-resource-log-changes">{log.changes.map((change, index) => <div key={index}><strong>{change.field}</strong>：{change.before || '空'} → {change.after || '空'}</div>)}</div> },
        { title: '操作人', dataIndex: 'operator', width: 110 },
        { title: '时间', dataIndex: 'timestamp', width: 175, render: value => dayjs(value).format('YYYY-MM-DD HH:mm:ss') },
      ]} />
  </Modal>
}
