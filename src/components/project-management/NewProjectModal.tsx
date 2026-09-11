'use client'

import { useEffect, useMemo } from 'react'
import { App, Form, Input, Modal, Select } from 'antd'
import { ALL_USERS } from '@/components/permission/PermissionModule'
import { PROJECT_CATEGORY_MACHINE } from '@/constants/projectTypes'
import { EXTERNAL_PROJECT_POOL } from '@/data/externalProjectPool'
import { findProjectCategoryMapping } from '@/lib/enumConsumers'
import { createConfiguredProject } from '@/lib/projectRegistry'
import { ensureEnumHydrated, useEnumStore } from '@/stores/enums'
import { useProjectStore } from '@/stores/project'
import {
  getRegistryProjectTypes,
  PROJECT_ATTRIBUTE_LABELS,
  type ConfiguredProjectInput,
  type ProjectAttribute,
} from '@/types/projectRegistry'

interface NewProjectModalProps {
  open: boolean
  onCancel: () => void
  onCreated: (projectId: string) => void
}

type NewProjectFormValues = ConfiguredProjectInput

export default function NewProjectModal({ open, onCancel, onCreated }: NewProjectModalProps) {
  const [form] = Form.useForm<NewProjectFormValues>()
  const { message } = App.useApp()
  const projects = useProjectStore(state => state.projects)
  const currentLoginUser = useProjectStore(state => state.currentLoginUser)
  const rowsByType = useEnumStore(state => state.rowsByType)
  const hasHydrated = useEnumStore(state => state.hasHydrated)
  const hydrationError = useEnumStore(state => state.hydrationError)
  const projectAttribute = Form.useWatch('projectAttribute', form) ?? 'formal'
  const sourceBid = Form.useWatch('sourceBid', form)

  useEffect(() => {
    if (open) void ensureEnumHydrated()
  }, [open])

  const availableSources = useMemo(() => {
    const registered = new Set(projects.map(project => project.sourceBid).filter(Boolean))
    return EXTERNAL_PROJECT_POOL.filter(source => !registered.has(source.bid))
  }, [projects])

  const source = useMemo(
    () => EXTERNAL_PROJECT_POOL.find(item => item.bid === sourceBid),
    [sourceBid],
  )
  const mapping = useMemo(
    () => source ? findProjectCategoryMapping(rowsByType, source.ipmProjectCategoryName) : undefined,
    [rowsByType, source],
  )
  const mappingError = source && hasHydrated && !hydrationError && (
    !mapping || !getRegistryProjectTypes('formal').includes(mapping.pmsProjectCategory)
  ) ? '该 IPM 项目分类尚未配置有效映射，请联系管理员维护' : null

  useEffect(() => {
    if (projectAttribute === 'formal') form.setFieldValue('type', mapping?.pmsProjectCategory)
  }, [form, mapping, projectAttribute])

  const close = () => {
    form.resetFields()
    onCancel()
  }

  const changeAttribute = (attribute: ProjectAttribute) => {
    form.setFieldsValue({
      projectAttribute: attribute,
      sourceBid: undefined,
      name: undefined,
      type: attribute === 'roadmap' ? PROJECT_CATEGORY_MACHINE : undefined,
    })
  }

  const submit = async () => {
    const values = await form.validateFields().catch(() => null)
    if (!values) return
    if (mappingError) return
    const result = createConfiguredProject(values, currentLoginUser)
    if (!result.ok) {
      message.error(result.message)
      return
    }
    message.success('项目创建成功')
    form.resetFields()
    onCreated(result.projectId)
  }

  return (
    <Modal
      className="pms-modal"
      title="新增项目"
      open={open}
      okText="确认"
      cancelText="取消"
      onOk={() => void submit()}
      onCancel={close}
      destroyOnHidden
      width={560}
    >
      <Form<NewProjectFormValues>
        form={form}
        layout="vertical"
        initialValues={{ projectAttribute: 'formal', responsiblePersons: [] }}
        preserve={false}
      >
        <Form.Item name="projectAttribute" label="项目属性" rules={[{ required: true, message: '请选择项目属性' }]}>
          <Select
            options={(Object.keys(PROJECT_ATTRIBUTE_LABELS) as ProjectAttribute[]).map(value => ({
              value,
              label: PROJECT_ATTRIBUTE_LABELS[value],
            }))}
            onChange={changeAttribute}
          />
        </Form.Item>

        {projectAttribute === 'formal' ? (
          <Form.Item
            name="sourceBid"
            label="项目名称"
            validateStatus={mappingError || hydrationError ? 'error' : undefined}
            help={mappingError || (hydrationError ? '项目类型映射加载失败，请稍后重试' : undefined)}
            rules={[{ required: true, message: '请选择 IPM 来源项目' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="请选择 IPM 来源项目"
              options={availableSources.map(item => ({
                value: item.bid,
                label: `${item.name}（${item.bid}）`,
              }))}
            />
          </Form.Item>
        ) : (
          <Form.Item name="name" label="项目名称" rules={[{ required: true, whitespace: true, message: '请输入项目名称' }]}>
            <Input maxLength={100} placeholder="请输入项目名称" />
          </Form.Item>
        )}

        <Form.Item name="type" label="项目类型" rules={[{ required: true, message: '请选择项目类型' }]}>
          <Select
            disabled={projectAttribute === 'formal' || projectAttribute === 'roadmap'}
            placeholder={projectAttribute === 'formal' ? '由 IPM 项目分类自动带出' : '请选择项目类型'}
            options={getRegistryProjectTypes(projectAttribute).map(value => ({ value, label: value }))}
          />
        </Form.Item>

        <Form.Item name="responsiblePersons" label="责任人" rules={[{ required: true, type: 'array', min: 1, message: '请至少选择一位责任人' }]}>
          <Select
            mode="multiple"
            showSearch
            optionFilterProp="label"
            placeholder="请选择责任人"
            options={ALL_USERS.map(value => ({ value, label: value }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
