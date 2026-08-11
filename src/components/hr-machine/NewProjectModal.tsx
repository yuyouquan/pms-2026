'use client'

import { useEffect, useState } from 'react'
import { Modal, Form, Input, InputNumber, Select, message } from 'antd'
import { useHrMachineStore } from '@/stores/hrMachine'
import {
  MACHINE_BRANDS,
  MACHINE_PRODUCT_LINES,
  PROJECT_LEVELS,
  HR_MODEL_VERSIONS,
  PROJECT_YEARS,
} from '@/constants/hrMachine'
import type { MachineBrand, MachineProductLine } from '@/types/hrMachine'

interface NewProjectModalProps {
  open: boolean
  onCancel: () => void
}

export default function NewProjectModal({ open, onCancel }: NewProjectModalProps) {
  const [form] = Form.useForm()
  const { addProject } = useHrMachineStore()
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      form.resetFields()
      form.setFieldsValue({
        brand: 'TECNO' as MachineBrand,
        productLine: 'CAMON' as MachineProductLine,
        projectLevel: 'S',
        levelCoefficient: 1,
        hrModelVersion: HR_MODEL_VERSIONS[0],
        projectYear: PROJECT_YEARS[0],
      })
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
          name="brand"
          label="品牌"
          rules={[{ required: true, message: '请选择品牌' }]}
        >
          <Select
            options={MACHINE_BRANDS.map(b => ({ value: b.value, label: b.label }))}
            placeholder="请选择品牌"
          />
        </Form.Item>

        <Form.Item
          name="productLine"
          label="产品线"
          rules={[{ required: true, message: '请选择产品线' }]}
        >
          <Select
            options={MACHINE_PRODUCT_LINES.map(p => ({ value: p.value, label: p.label }))}
            placeholder="请选择产品线"
          />
        </Form.Item>

        <Form.Item
          name="projectLevel"
          label="项目等级"
          rules={[{ required: true, message: '请选择项目等级' }]}
        >
          <Select
            options={PROJECT_LEVELS.map(l => ({ value: l, label: l }))}
            placeholder="请选择项目等级"
          />
        </Form.Item>

        <Form.Item
          name="levelCoefficient"
          label="等级系数"
          rules={[{ required: true, message: '请输入等级系数' }]}
        >
          <InputNumber
            min={0}
            step={0.1}
            precision={2}
            style={{ width: '100%' }}
            placeholder="请输入等级系数"
          />
        </Form.Item>

        <Form.Item
          name="hrModelVersion"
          label="人力模型版本"
          rules={[{ required: true, message: '请选择人力模型版本' }]}
        >
          <Select
            options={HR_MODEL_VERSIONS.map(v => ({ value: v, label: v }))}
            placeholder="请选择人力模型版本"
          />
        </Form.Item>

        <Form.Item
          name="projectYear"
          label="项目年份"
          rules={[{ required: true, message: '请选择项目年份' }]}
        >
          <Select
            options={PROJECT_YEARS.map(y => ({ value: y, label: y }))}
            placeholder="请选择项目年份"
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
