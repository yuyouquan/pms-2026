'use client'

import { useEffect, useMemo } from 'react'
import { Form, Modal, Select, Space, Tag, Typography, message } from 'antd'
import { isMachineProjectType } from '@/constants/projectTypes'
import { isTechnicalSubprojectConfigured } from '@/lib/technicalProjectRules'
import { useEnumStore } from '@/stores/enums'
import { useHasPermission } from '@/stores/permission'
import { useProjectStore } from '@/stores/project'
import {
  TECHNICAL_CORE_VALUES,
  TECHNICAL_DEVELOPMENT_MODES,
  useTechnicalProjectStore,
} from '@/stores/technicalProject'
import type { TechnicalSubproject, TechnicalSubprojectConfiguration } from '@/types/technicalProject'

const { Text } = Typography

export interface SubprojectConfigModalProps {
  open: boolean
  subproject: TechnicalSubproject | null
  currentLoginUser?: string
  onCancel: () => void
  onSaved?: (configuration: TechnicalSubprojectConfiguration) => void
}

export default function SubprojectConfigModal({
  open,
  subproject,
  currentLoginUser,
  onCancel,
  onSaved,
}: SubprojectConfigModalProps) {
  const [form] = Form.useForm<TechnicalSubprojectConfiguration>()
  const loginUserFromProject = useProjectStore(state => state.currentLoginUser)
  const projects = useProjectStore(state => state.projects)
  const valuesByType = useEnumStore(state => state.valuesByType)
  const hasHydrated = useEnumStore(state => state.hasHydrated)
  const hydrateEnumStore = useEnumStore(state => state.hydrateEnumStore)
  const updateConfiguration = useTechnicalProjectStore(state => state.updateConfiguration)
  const user = currentLoginUser || loginUserFromProject
  const canDo = useHasPermission(user, subproject?.parentProjectId)
  const canEdit = Boolean(subproject?.active) && canDo('basicInfo:编辑')

  useEffect(() => {
    if (open && !hasHydrated) void hydrateEnumStore()
  }, [hasHydrated, hydrateEnumStore, open])

  useEffect(() => {
    if (!open || !subproject) return
    form.setFieldsValue(subproject.configuration)
  }, [form, open, subproject])

  const tosOptions = useMemo(() => {
    const current = valuesByType['tos-2-part']
    const selected = subproject?.configuration?.firstTosVersion || ''
    return [
      ...current.map(value => ({ value, label: value })),
      ...selected && !current.includes(selected)
        ? [{ value: selected, label: `${selected}（历史值）`, disabled: true }]
        : [],
    ]
  }, [subproject?.configuration?.firstTosVersion, valuesByType])

  const machineOptions = useMemo(() => projects
    .filter(project => isMachineProjectType(project.type))
    .map(project => ({ value: project.id, label: project.name })), [projects])

  const closeWithoutSaving = () => {
    form.resetFields()
    onCancel()
  }

  const save = async () => {
    if (!subproject || !canEdit) return
    let values: TechnicalSubprojectConfiguration
    try {
      values = await form.validateFields()
    } catch {
      return
    }
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
      return
    }
    message.success('子项目信息已保存')
    onSaved?.(configuration)
    form.resetFields()
    onCancel()
  }

  return (
    <Modal
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
      okButtonProps={{ disabled: !canEdit }}
      onOk={() => void save()}
      onCancel={closeWithoutSaving}
      destroyOnHidden
      width={560}
    >
      <Text type="secondary">子项目由 IPM 同步，此处仅维护 PMS 内的交付配置。</Text>
      <Form form={form} layout="vertical" requiredMark="optional" style={{ marginTop: 20 }}>
        <Form.Item name="coreValue" label="核心价值" rules={[{ required: true, message: '请选择核心价值' }]}>
          <Select
            placeholder="请选择"
            options={TECHNICAL_CORE_VALUES.map(value => ({ value, label: value }))}
            disabled={!canEdit}
          />
        </Form.Item>
        <Form.Item name="developmentMode" label="开发模式" rules={[{ required: true, message: '请选择开发模式' }]}>
          <Select
            placeholder="请选择"
            options={TECHNICAL_DEVELOPMENT_MODES.map(value => ({ value, label: value }))}
            disabled={!canEdit}
          />
        </Form.Item>
        <Form.Item name="firstTosVersion" label="首导tOS">
          <Select
            allowClear
            placeholder="请选择两位 tOS 版本"
            options={tosOptions}
            disabled={!canEdit || !hasHydrated}
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
