'use client'
import { useState } from 'react'
import { App, Form, Input, Modal, Select } from 'antd'
import type { ResourceVersion } from '@/components/project-resources/resourceVersionAdapter'
import type { ResourceVersionOptions } from '@/types/resourceOperations'
export { default as ResourceOperationLogDialog } from '@/components/project-resources/ResourceOperationLogDialog'

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
      <Form.Item name="versionNumber" label="版本号" rules={[{ required: true, whitespace: true, message: '请填写版本号' }]}>
        <Input autoFocus prefix="V" aria-label="新版本号" placeholder="自由填写，同一预算分类下不可重复" />
      </Form.Item>
      <Form.Item name="sourceVersionId" label="初始化方式">
        <Select aria-label="版本初始化方式" options={[{ value: '', label: '初始化空白版本' }, ...versions.map(version => ({ value: version.id, label: `复制 ${version.versionNumber}` }))]} />
      </Form.Item>
    </Form>
  </Modal>
}
