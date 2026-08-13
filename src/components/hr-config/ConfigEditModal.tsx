'use client'

import { useEffect, useMemo } from 'react'
import { Modal, Form, Input, InputNumber, Select, message } from 'antd'
import type { ConfigModuleMeta, ConfigFormValues } from '@/types/hrConfig'
import { useHrConfigStore } from '@/stores/hrConfig'

interface ConfigEditModalProps {
  open: boolean
  moduleMeta: ConfigModuleMeta
  recordId: string | null
  onCancel: () => void
}

export default function ConfigEditModal({
  open,
  moduleMeta,
  recordId,
  onCancel,
}: ConfigEditModalProps) {
  const [form] = Form.useForm<ConfigFormValues>()
  const { data, addRecord, updateRecord } = useHrConfigStore()

  const isEdit = !!recordId
  const editingRecord = useMemo(() => {
    if (!recordId) return null
    return (data[moduleMeta.key] ?? []).find(r => r.id === recordId) ?? null
  }, [recordId, data, moduleMeta.key])

  useEffect(() => {
    if (open) {
      if (editingRecord) {
        const formValues: ConfigFormValues = {}
        moduleMeta.columns.forEach(col => {
          formValues[col.key] = editingRecord[col.key] ?? null
        })
        form.setFieldsValue(formValues)
      } else {
        form.resetFields()
      }
    }
  }, [open, editingRecord, form, moduleMeta.columns])

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      if (isEdit && recordId) {
        updateRecord(moduleMeta.key, recordId, values as ConfigFormValues)
        message.success('配置已更新')
      } else {
        addRecord(moduleMeta.key, values as ConfigFormValues)
        message.success('配置已新增')
      }
    } catch {
      // validation error, keep modal open
    }
  }

  return (
    <Modal
      title={`${isEdit ? '编辑' : '新增'}${moduleMeta.label}`}
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      destroyOnHidden
      width={560}
      okText="确定"
      cancelText="取消"
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        {moduleMeta.columns.map(col => (
          <Form.Item
            key={col.key}
            name={col.key}
            label={col.label}
            rules={col.inputType !== 'select' ? [{ required: true, message: `请输入${col.label}` }] : [{ required: true, message: `请选择${col.label}` }]}
          >
            {col.inputType === 'number' ? (
              <InputNumber
                style={{ width: '100%' }}
                placeholder={`请输入${col.label}`}
                min={0}
                step={col.key.includes('Ratio') || col.key.includes('Phase') ? 0.1 : 1}
              />
            ) : col.inputType === 'select' ? (
              <Select
                placeholder={`请选择${col.label}`}
                options={col.options}
              />
            ) : (
              <Input
                placeholder={`请输入${col.label}`}
              />
            )}
          </Form.Item>
        ))}
      </Form>
    </Modal>
  )
}
