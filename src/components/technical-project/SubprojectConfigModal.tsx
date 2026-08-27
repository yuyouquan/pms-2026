'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Form, Modal, Select, Space, Tag, Typography, message } from 'antd'
import { isMachineProjectType } from '@/constants/projectTypes'
import { useSingleEnumOptions } from '@/hooks/useEnumOptions'
import { isTechnicalSubprojectConfigured } from '@/lib/technicalProjectRules'
import { useHasPermission } from '@/stores/permission'
import { useProjectStore } from '@/stores/project'
import { useTechnicalProjectStore } from '@/stores/technicalProject'
import type { TechnicalSubproject, TechnicalSubprojectConfiguration } from '@/types/technicalProject'
import { useOverlayInteraction } from '@/hooks/useOverlayInteraction'

const { Text } = Typography

export interface SubprojectConfigModalProps {
  open: boolean
  subproject: TechnicalSubproject | null
  currentLoginUser?: string
  onCancel: () => void
  onSaved?: (configuration: TechnicalSubprojectConfiguration) => void
  returnFocusTo?: HTMLElement | null
}

export default function SubprojectConfigModal({
  open,
  subproject,
  currentLoginUser,
  onCancel,
  onSaved,
  returnFocusTo,
}: SubprojectConfigModalProps) {
  const [form] = Form.useForm<TechnicalSubprojectConfiguration>()
  const loginUserFromProject = useProjectStore(state => state.currentLoginUser)
  const projects = useProjectStore(state => state.projects)
  const updateConfiguration = useTechnicalProjectStore(state => state.updateConfiguration)
  const user = currentLoginUser || loginUserFromProject
  const canDo = useHasPermission(user, subproject?.parentProjectId)
  const canEdit = Boolean(subproject?.active) && canDo('basicInfo:编辑')
  const [submitting, setSubmitting] = useState(false)
  const submissionSequenceRef = useRef(0)
  const { captureTrigger, restoreTriggerFocus, tryBeginSubmit, releaseSubmission } = useOverlayInteraction()

  useEffect(() => {
    if (!open || !subproject) return
    captureTrigger(returnFocusTo)
    form.setFieldsValue(subproject.configuration)
  }, [captureTrigger, form, open, returnFocusTo, subproject])

  const coreHistory = useMemo(() => subproject?.configuration.coreValue ? [subproject.configuration.coreValue] : [], [subproject?.configuration.coreValue])
  const developmentHistory = useMemo(() => subproject?.configuration.developmentMode ? [subproject.configuration.developmentMode] : [], [subproject?.configuration.developmentMode])
  const tosHistory = useMemo(() => subproject?.configuration.firstTosVersion ? [subproject.configuration.firstTosVersion] : [], [subproject?.configuration.firstTosVersion])
  const coreOptions = useSingleEnumOptions('core-value', coreHistory)
  const developmentOptions = useSingleEnumOptions('technical-development-mode', developmentHistory)
  const tosOptions = useSingleEnumOptions('first-sale-tos', tosHistory)

  const machineOptions = useMemo(() => projects
    .filter(project => isMachineProjectType(project.type))
    .map(project => ({ value: project.id, label: project.name })), [projects])

  const closeWithoutSaving = () => {
    submissionSequenceRef.current += 1
    form.resetFields()
    setSubmitting(false)
    releaseSubmission()
    onCancel()
    restoreTriggerFocus(returnFocusTo)
  }

  const save = async () => {
    if (!subproject || !canEdit) return
    if (!tryBeginSubmit()) return
    const submissionSequence = ++submissionSequenceRef.current
    setSubmitting(true)
    let values: TechnicalSubprojectConfiguration
    try {
      values = await form.validateFields()
    } catch {
      setSubmitting(false)
      releaseSubmission()
      return
    }
    if (submissionSequence !== submissionSequenceRef.current) return
    const configuration: TechnicalSubprojectConfiguration = {
      coreValue: values.coreValue,
      developmentMode: values.developmentMode,
      firstTosVersion: values.firstTosVersion || '',
      firstMachineProjectId: values.firstMachineProjectId || '',
    }
    const result = updateConfiguration(subproject.id, configuration)
    if (!result.ok) {
      message.error(result.reason === 'missing'
        ? '子项目已不存在'
        : result.reason === 'inactive'
          ? '子项目已停用，无法保存配置'
          : '子项目配置无效')
      setSubmitting(false)
      releaseSubmission()
      return
    }
    message.success('子项目信息已保存')
    onSaved?.(configuration)
    form.resetFields()
    setSubmitting(false)
    onCancel()
    restoreTriggerFocus(returnFocusTo)
    releaseSubmission(true)
  }

  return (
    <Modal
      className="pms-scroll-modal"
      open={open}
      title={(
        <Space size={10}>
          <span>子项目信息配置</span>
          {subproject && (
            <Tag color={isTechnicalSubprojectConfigured(subproject) ? 'success' : 'warning'}>
              {isTechnicalSubprojectConfigured(subproject) ? '已配置' : '待配置'}
            </Tag>
          )}
        </Space>
      )}
      okText="确认"
      cancelText="取消"
      okButtonProps={{ disabled: !canEdit || submitting }}
      confirmLoading={submitting}
      onOk={() => void save()}
      onCancel={closeWithoutSaving}
      destroyOnHidden
      width={560}
    >
      <Text type="secondary">子项目由 IPM 同步，此处仅维护 PMS 内的交付配置。</Text>
      <Form form={form} layout="vertical" requiredMark="optional" style={{ marginTop: 20 }}>
        <Form.Item name="coreValue" label="核心价值" rules={[{ required: true, message: '请选择核心价值' }]}>
          <Select
            placeholder={coreOptions.length ? '请选择' : '暂无可用配置，请先在配置中心维护'}
            options={coreOptions}
            disabled={!canEdit}
          />
        </Form.Item>
        <Form.Item name="developmentMode" label="开发模式" rules={[{ required: true, message: '请选择开发模式' }]}>
          <Select
            placeholder={developmentOptions.length ? '请选择' : '暂无可用配置，请先在配置中心维护'}
            options={developmentOptions}
            disabled={!canEdit}
          />
        </Form.Item>
        <Form.Item name="firstTosVersion" label="首导tOS">
          <Select
            allowClear
            placeholder={tosOptions.length ? '请选择首导 tOS 版本' : '暂无可用配置，请先在配置中心维护'}
            options={tosOptions}
            disabled={!canEdit}
          />
        </Form.Item>
        <Form.Item name="firstMachineProjectId" label="首导整机产品">
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="请搜索整机项目"
            options={machineOptions}
            disabled={!canEdit}
          />
        </Form.Item>
      </Form>
      {!canEdit && subproject?.active && (
        <Text type="secondary">当前账号无基础信息编辑权限。</Text>
      )}
    </Modal>
  )
}
