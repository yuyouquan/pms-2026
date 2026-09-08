'use client'

import { useEffect, useState } from 'react'
import { Modal, Form, Input, Select, message } from 'antd'
import { useHrTechnicalStore } from '@/stores/hrTechnical'
import { TECH_PLANNING_YEAR_OPTIONS } from '@/constants/hrTechnical'

interface NewProjectModalProps {
  open: boolean
  onCancel: () => void
}

export default function NewProjectModal({ open, onCancel }: NewProjectModalProps) {
  const [form] = Form.useForm()
  const { addProject } = useHrTechnicalStore()
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
      title="新建技术项目"
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={submitting}
      okText="创建"
      cancelText="取消"
      width={640}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          name="tdtName"
          label="TDT项目名称"
          rules={[{ required: true, message: '请输入TDT项目名称' }]}
        >
          <Input placeholder="请输入TDT项目名称" maxLength={50} />
        </Form.Item>

        <Form.Item
          name="planningYear"
          label="规划年度"
          rules={[{ required: true, message: '请选择规划年度' }]}
        >
          <Select
            placeholder="请选择规划年度"
            options={TECH_PLANNING_YEAR_OPTIONS}
          />
        </Form.Item>

        <Form.Item
          name="techDomain"
          label="技术领域"
          rules={[{ required: true, message: '请输入技术领域' }]}
        >
          <Input placeholder="请输入技术领域，如：影像技术" maxLength={30} />
        </Form.Item>

        <Form.Item
          name="tmg"
          label="TMG及领域"
          rules={[{ required: true, message: '请输入TMG及领域' }]}
        >
          <Input placeholder="请输入TMG及领域，如：影像TMG" maxLength={30} />
        </Form.Item>

        <Form.Item
          name="techTrack"
          label="技术赛道"
          rules={[{ required: true, message: '请输入技术赛道' }]}
        >
          <Input placeholder="请输入技术赛道，如：摄像头驱动" maxLength={30} />
        </Form.Item>

        <Form.Item
          name="subTrack"
          label="子赛道"
          rules={[{ required: true, message: '请输入子赛道' }]}
        >
          <Input placeholder="请输入子赛道，如：传感器驱动" maxLength={30} />
        </Form.Item>

        <Form.Item
          name="subTaskName"
          label="子任务名称"
          rules={[{ required: true, message: '请输入子任务名称' }]}
        >
          <Input placeholder="请输入子任务名称" maxLength={50} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
