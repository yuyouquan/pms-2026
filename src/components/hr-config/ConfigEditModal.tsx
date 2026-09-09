'use client'

import { useEffect, useMemo } from 'react'
import { App, Modal, Form, Input, InputNumber, Select, Row, Col } from 'antd'
import type { ConfigModuleMeta, ConfigFormValues } from '@/types/hrConfig'
import { useHrConfigStore } from '@/stores/hrConfig'
import { useHrDepartmentOptions } from '@/hooks/useHrDepartmentOptions'

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
  const { message } = App.useApp()
  const { data, addRecord, updateRecord } = useHrConfigStore()
  const { primaryOptions, getSecondaryOptions, isValidPair } = useHrDepartmentOptions()
  const primaryDepartment = Form.useWatch('primaryDepartment', form)
  const isHrModel = moduleMeta.key === 'hrModel'

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
          formValues[col.key] = (editingRecord[col.key] as string | number | null) ?? null
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
      width={isHrModel ? 860 : 560}
      okText="确定"
      cancelText="取消"
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Row gutter={16}>
          {moduleMeta.columns.map(col => {
            const isPrimaryDepartment = isHrModel && col.key === 'primaryDepartment'
            const isSecondaryDepartment = isHrModel && col.key === 'secondaryDepartment'
            const isSelection = col.inputType === 'select' || isPrimaryDepartment || isSecondaryDepartment
            return (
              <Col key={col.key} xs={24} sm={isHrModel ? 12 : 24} md={isHrModel ? 8 : 24}>
                <Form.Item
                  name={col.key}
                  label={col.label}
                  dependencies={isSecondaryDepartment ? ['primaryDepartment'] : undefined}
                  rules={[
                    { required: true, message: `${isSelection ? '请选择' : '请输入'}${col.label}` },
                    ...(isSecondaryDepartment ? [{
                      validator: (_rule: unknown, secondary: unknown) => {
                        if (!secondary || isValidPair(String(form.getFieldValue('primaryDepartment') ?? ''), String(secondary))) {
                          return Promise.resolve()
                        }
                        return Promise.reject(new Error('请选择当前一级部门下的二级部门'))
                      },
                    }] : []),
                  ]}
                >
                  {isPrimaryDepartment ? (
                    <Select
                      placeholder="请选择一级部门"
                      options={primaryOptions}
                      showSearch
                      optionFilterProp="label"
                      onChange={(primary: string) => {
                        const secondary = String(form.getFieldValue('secondaryDepartment') ?? '')
                        if (!isValidPair(primary, secondary)) form.setFieldValue('secondaryDepartment', undefined)
                      }}
                    />
                  ) : isSecondaryDepartment ? (
                    <Select
                      placeholder="请选择二级部门"
                      options={getSecondaryOptions(String(primaryDepartment ?? ''))}
                      disabled={!primaryDepartment}
                      showSearch
                      optionFilterProp="label"
                    />
                  ) : col.inputType === 'number' ? (
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
              </Col>
            )
          })}
        </Row>
      </Form>
    </Modal>
  )
}
