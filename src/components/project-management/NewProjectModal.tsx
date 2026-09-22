'use client'

import { useEffect, useMemo, useRef } from 'react'
import { App, Form, Input, Modal, Select } from 'antd'
import { ALL_USERS } from '@/components/permission/PermissionModule'
import { PROJECT_CATEGORY_MACHINE } from '@/constants/projectTypes'
import { EXTERNAL_PROJECT_POOL } from '@/data/externalProjectPool'
import { findProjectCategoryMapping } from '@/lib/enumConsumers'
import { createConfiguredProject } from '@/lib/projectRegistry'
import { ensureEnumHydrated, useEnumStore } from '@/stores/enums'
import { useProjectStore } from '@/stores/project'
import { usePermissionStore } from '@/stores/permission'
import { canConfigureProjectScope, getCreatableProjectAttributes, getCreatableProjectTypes, PROJECT_REGISTRY_MANAGERS } from '@/lib/projectRegistryPermissions'
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
  const submitting = useRef(false)
  const projects = useProjectStore(state => state.projects)
  const currentLoginUser = useProjectStore(state => state.currentLoginUser)
  const isAdmin = usePermissionStore(state => state.globalRoles.some(role => role.name === '管理组' && role.members.includes(currentLoginUser)))
  const allowedAttributes = useMemo(() => getCreatableProjectAttributes(currentLoginUser, isAdmin), [currentLoginUser, isAdmin])
  const rowsByType = useEnumStore(state => state.rowsByType)
  const hasHydrated = useEnumStore(state => state.hasHydrated)
  const hydrationError = useEnumStore(state => state.hydrationError)
  const projectAttribute = Form.useWatch('projectAttribute', form) ?? allowedAttributes[0] ?? 'formal'
  const sourceBid = Form.useWatch('sourceBid', form)

  useEffect(() => {
    if (open) void ensureEnumHydrated()
  }, [open])

  useEffect(() => {
    if (!open) return
    form.resetFields()
    const attribute = allowedAttributes[0]
    const types = attribute ? getCreatableProjectTypes(currentLoginUser, attribute, isAdmin) : []
    form.setFieldsValue({ projectAttribute: attribute, type: attribute === 'roadmap' ? types[0] : undefined })
  }, [open, currentLoginUser, isAdmin, allowedAttributes, form])

  const availableSources = useMemo(() => {
    const registered = new Set(projects.map(project => project.sourceBid).filter(Boolean))
    return EXTERNAL_PROJECT_POOL.filter(source => {
      const category = findProjectCategoryMapping(rowsByType, source.ipmProjectCategoryName)?.pmsProjectCategory
      return !registered.has(source.bid) && Boolean(category && canConfigureProjectScope(currentLoginUser, 'formal', category, isAdmin))
    })
  }, [projects, rowsByType, currentLoginUser, isAdmin])

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
    if (submitting.current) return
    submitting.current = true
    try {
      const values = await form.validateFields().catch(() => null)
      if (!values || mappingError) return
      const result = createConfiguredProject(values, useProjectStore.getState().currentLoginUser)
      if (!result.ok) {
        message.error(result.message)
        return
      }
      message.success('项目创建成功')
      form.resetFields()
      onCreated(result.projectId)
    } finally {
      submitting.current = false
    }
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
      okButtonProps={{ disabled: !allowedAttributes.length }}
      destroyOnHidden
      width={560}
    >
      <Form<NewProjectFormValues>
        form={form}
        layout="vertical"
        initialValues={{
          projectAttribute: allowedAttributes[0],
          type: allowedAttributes[0] === 'roadmap' ? PROJECT_CATEGORY_MACHINE : undefined,
          responsiblePersons: [],
        }}
        preserve={false}
      >
        <Form.Item name="projectAttribute" label="项目属性" rules={[{ required: true, message: '请选择项目属性' }]}>
          <Select
            options={allowedAttributes.map(value => ({
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
            options={getCreatableProjectTypes(currentLoginUser, projectAttribute, isAdmin).map(value => ({ value, label: value }))}
          />
        </Form.Item>

        <Form.Item name="responsiblePersons" label="责任人" extra="所选责任人将成为空间系统管理员，并同步到对应项目的负责人角色。" rules={[{ required: true, type: 'array', min: 1, message: '请至少选择一位责任人' }]}>
          <Select
            mode="multiple"
            showSearch
            optionFilterProp="label"
            placeholder="请选择责任人"
            options={[...ALL_USERS, ...PROJECT_REGISTRY_MANAGERS].map(value => ({ value, label: value }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
