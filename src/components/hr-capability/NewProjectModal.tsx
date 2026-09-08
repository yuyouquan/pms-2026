'use client'

import { useState } from 'react'
import { Modal, Form, Input, message } from 'antd'
import { useHrCapabilityStore } from '@/stores/hrCapability'

interface NewProjectModalProps {
  open: boolean
  onCancel: () => void
}

export default function NewProjectModal({ open, onCancel }: NewProjectModalProps) {
  const [form] = Form.useForm()
  const addProject = useHrCapabilityStore((s) => s.addProject)
  const setShowNewProjectModal = useHrCapabilityStore((s) => s.setShowNewProjectModal)

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      addProject({
        name: values.name,
        projectTarget: values.projectTarget,
      })
      message.success('项目创建成功')
      form.resetFields()
      setShowNewProjectModal(false)
    } catch {
      // validation error
    }
  }

  const handleCancel = () => {
    form.resetFields()
    setShowNewProjectModal(false)
    onCancel()
  }

  return (
    <Modal
      className="pms-modal"
      title="新建项目"
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      okText="创建"
      cancelText="取消"
      width={600}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          name="name"
          label="项目名称"
          rules={[{ required: true, message: '请输入项目名称' }]}
        >
          <Input placeholder="请输入项目名称" maxLength={100} />
        </Form.Item>
        <Form.Item
          name="projectTarget"
          label="项目目标"
          rules={[{ required: true, message: '请输入项目目标' }]}
        >
          <Input.TextArea
            placeholder="请输入项目目标"
            autoSize={{ minRows: 3, maxRows: 6 }}
            maxLength={500}
            showCount
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
