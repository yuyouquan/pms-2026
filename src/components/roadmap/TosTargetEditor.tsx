'use client'

import { useEffect, useState } from 'react'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Empty, Flex, Form, Input, Modal, Tooltip, Typography, message } from 'antd'
import { useRoadmapStore } from '@/stores/roadmap'
import type { TosVersionConfig } from '@/types/roadmap'

interface TosTargetEditorProps {
  open: boolean
  onCancel: () => void
  version: TosVersionConfig | null
  canEdit: boolean
  onSaved?: () => void
}

interface TosTargetFormValues {
  targets: Array<{ value: string }>
}

const EMPTY_TARGET_FORM: TosTargetFormValues = { targets: [] }

export default function TosTargetEditor({
  open,
  onCancel,
  version,
  canEdit,
  onSaved,
}: TosTargetEditorProps) {
  const [form] = Form.useForm<TosTargetFormValues>()
  const [submitting, setSubmitting] = useState(false)
  const setTosTargets = useRoadmapStore(state => state.setTosTargets)

  useEffect(() => {
    if (!open) return
    form.setFieldsValue(version
      ? { targets: version.targets.map(value => ({ value })) }
      : EMPTY_TARGET_FORM)
  }, [form, open, version])

  const handleSave = async () => {
    if (!canEdit || !version) return
    let values: TosTargetFormValues
    try {
      values = await form.validateFields()
    } catch {
      return
    }
    const normalizedTargets = (values.targets ?? [])
      .map(target => target.value.trim())
      .filter(Boolean)

    setSubmitting(true)
    try {
      const result = setTosTargets(version.id, normalizedTargets)
      if (!result.ok) {
        message.error('tOS 版本不存在，请刷新后重试')
        return
      }
      message.success(normalizedTargets.length ? '版本目标已保存' : '版本目标已清空')
      onSaved?.()
      onCancel()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      className="pms-modal"
      title={version ? `维护 ${version.name} 目标` : '维护版本目标'}
      open={open}
      onCancel={onCancel}
      width={640}
      destroyOnHidden
      mask={{ closable: false }}
      footer={(
        <Flex justify="flex-end" gap={8}>
          <Button onClick={onCancel}>取消</Button>
          {canEdit ? (
            <Button type="primary" onClick={handleSave} loading={submitting} disabled={!version || submitting}>
              保存目标
            </Button>
          ) : null}
        </Flex>
      )}
    >
      <Typography.Paragraph type="secondary">
        每行维护一项目标；保存时会自动去除首尾空格，空白目标不会保留。
      </Typography.Paragraph>
      <Form form={form} layout="vertical" preserve={false} disabled={!canEdit}>
        <Form.List name="targets">
          {(fields, { add, remove }, { errors }) => (
            <Flex vertical gap={12}>
              {fields.length ? fields.map((field, index) => (
                <Flex key={field.key} align="flex-start" gap={8}>
                  <Form.Item
                    {...field}
                    label={`目标 ${index + 1}`}
                    name={[field.name, 'value']}
                    rules={[{ max: 200, message: '单项目标不能超过 200 个字符' }]}
                    style={{ flex: 1, marginBottom: 0 }}
                  >
                    <Input.TextArea
                      aria-label={`${version?.name ?? 'tOS'} 目标 ${index + 1}`}
                      autoSize={{ minRows: 1, maxRows: 3 }}
                      placeholder="请输入目标内容"
                      maxLength={200}
                      showCount
                    />
                  </Form.Item>
                  <Tooltip title={`删除目标 ${index + 1}`}>
                    <Button
                      type="text"
                      danger
                      size="large"
                      icon={<DeleteOutlined />}
                      aria-label={`删除目标 ${index + 1}`}
                      onClick={() => remove(field.name)}
                      style={{ marginTop: 30 }}
                    />
                  </Tooltip>
                </Flex>
              )) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未设置目标，可点击下方按钮新增" />
              )}
              <Form.ErrorList errors={errors} />
              <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ value: '' })} block>
                新增一项目标
              </Button>
            </Flex>
          )}
        </Form.List>
      </Form>
    </Modal>
  )
}
