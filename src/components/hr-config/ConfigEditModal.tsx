'use client'

import { isCurrentMachineModel, LEGACY_MACHINE_PHASES } from '@/lib/hrMachinePeriods'
import { useEffect, useMemo, useRef } from 'react'
import { App, Modal, Form, Input, InputNumber, Select, Row, Col } from 'antd'
import type { ConfigModuleMeta, ConfigFormValues } from '@/types/hrConfig'
import { useHrConfigStore } from '@/stores/hrConfig'
import { useProjectStore } from '@/stores/project'
import { useHasGlobalPermission } from '@/stores/permission'
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
  const actor = useProjectStore(state => state.currentLoginUser)
  const hasGlobalPermission = useHasGlobalPermission(actor)
  const canEdit = !['hrModel', 'nonLaborSubject'].includes(moduleMeta.key) || hasGlobalPermission(moduleMeta.key === 'hrModel' ? 'configCenter:hrModelEdit' : 'configCenter:nonLaborSubjectEdit')
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

  const initializedEditor = useRef('')
  useEffect(() => {
    if (!open) { initializedEditor.current = ''; return }
    const editorKey = `${moduleMeta.key}:${recordId ?? 'new'}`
    if (initializedEditor.current === editorKey) return
    initializedEditor.current = editorKey
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
  }, [open, recordId, editingRecord, form, moduleMeta.key, moduleMeta.columns])

  const handleOk = async () => {
    if (!canEdit) return
    if (isEdit && !editingRecord) { message.warning('该配置已被移除，请关闭弹窗后刷新列表'); return }
    try {
      const values = await form.validateFields()
      if (isEdit && recordId) {
        updateRecord(moduleMeta.key, recordId, values as ConfigFormValues)
        message.success('配置已更新')
      } else {
        addRecord(moduleMeta.key, values as ConfigFormValues)
        message.success('配置已新增')
      }
    } catch (error) {
      if (error instanceof Error) message.warning(error.message)
      // Form validation messages remain beside the relevant fields.
    }
  }

  return (
    <Modal
      className={isHrModel ? 'pms-modal pms-hr-version-modal pms-hr-model-modal' : 'pms-modal'}
      title={`${isEdit ? '编辑' : '新增'}${moduleMeta.label}`}
      open={open && canEdit}
      onOk={handleOk}
      onCancel={onCancel}
      destroyOnHidden
      width={isHrModel ? 1280 : 560}
      okText="确定"
      cancelText="取消"
    >
      {isHrModel && editingRecord && !isCurrentMachineModel(editingRecord) && <details style={{ marginBottom: 12 }}>
        <summary>原阶段投入（保留原值，供重新配置参考）</summary>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 8 }}>{LEGACY_MACHINE_PHASES.map(field => <span key={field.key}>{field.label}：{String(editingRecord[field.key] ?? 0)}</span>)}</div>
      </details>}
      <Form form={form} layout="vertical" style={isHrModel ? undefined : { marginTop: 16 }}>
        {(isHrModel ? [moduleMeta.columns.slice(0, 4), moduleMeta.columns.slice(4)] : [moduleMeta.columns]).map((columns, groupIndex) => <Row key={groupIndex} gutter={12}>
          {columns.map(col => {
            const isPrimaryDepartment = isHrModel && col.key === 'primaryDepartment'
            const isSecondaryDepartment = isHrModel && col.key === 'secondaryDepartment'
            const isSelection = col.inputType === 'select' || isPrimaryDepartment || isSecondaryDepartment
            return (
              <Col key={col.key} xs={24} sm={isHrModel ? 12 : 24} md={isHrModel ? 8 : 24} lg={isHrModel ? (groupIndex === 0 ? 6 : undefined) : 24} flex={isHrModel && groupIndex === 1 ? '1 1 0' : undefined}>
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
        </Row>)}
      </Form>
    </Modal>
  )
}
