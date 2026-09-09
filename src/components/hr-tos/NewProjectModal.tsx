'use client'

import { useEffect, useState } from 'react'
import { App, Modal, Form, Input } from 'antd'
import { useHrTosStore } from '@/stores/hrTos'

interface NewProjectModalProps {
  open: boolean
  onCancel: () => void
}

export default function NewProjectModal({ open, onCancel }: NewProjectModalProps) {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const { addProject } = useHrTosStore()
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      form.resetFields()
    }
  }, [open, form])

  const handleOk = async () => {
    try {
      setSubmitting(true)
      const values = await form.validateFields()
      addProject(values)
      message.success('项目创建成功')
    } catch {
      // validation error, keep modal open
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      className="pms-modal"
      title="新建项目"
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={submitting}
      okText="创建"
      cancelText="取消"
      width={480}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          name="name"
          label="项目名称"
          rules={[{ required: true, message: '请输入项目名称' }]}
        >
          <Input placeholder="请输入项目名称" maxLength={50} />
        </Form.Item>

        <Form.Item
          name="projectTarget"
          label="项目目标"
          rules={[{ required: true, message: '请输入项目目标' }]}
        >
          <Input.TextArea
            placeholder="请输入项目目标"
            maxLength={200}
            autoSize={{ minRows: 3, maxRows: 6 }}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
