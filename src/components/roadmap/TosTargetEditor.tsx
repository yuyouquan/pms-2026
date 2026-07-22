'use client'

import { useEffect, useState } from 'react'
import { Button, Flex, Form, Input, Modal, Typography, message } from 'antd'
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
  targetText: string
}

const EMPTY_TARGET_FORM: TosTargetFormValues = { targetText: '' }

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
      ? { targetText: version.targets.join('\n') }
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
    const targetText = values.targetText ?? ''
    const normalizedTargets = targetText.trim() ? [targetText] : []

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
        版本目标将完全按照多行文本的换行格式展示。
      </Typography.Paragraph>
      <Form form={form} layout="vertical" preserve={false} disabled={!canEdit}>
        <Form.Item
          label="版本目标"
          name="targetText"
          rules={[{ max: 4000, message: '版本目标不能超过 4000 个字符' }]}
        >
          <Input.TextArea
            aria-label={`${version?.name ?? 'tOS'} 版本目标`}
            rows={10}
            placeholder="请输入版本目标，可自由换行"
            maxLength={4000}
            showCount
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
