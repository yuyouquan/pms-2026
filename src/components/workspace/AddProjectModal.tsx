'use client'

import { useMemo, useEffect, useState } from 'react'
import { Modal, Form, Select, message } from 'antd'
import { ALL_USERS } from '@/components/permission/PermissionModule'
import { PROJECT_TYPES } from '@/data/projects'
import { EXTERNAL_PROJECT_POOL, fetchByBid, type ExternalProjectEntry } from '@/data/externalProjectPool'
import { useProjectStore } from '@/stores/project'
import { useUiStore } from '@/stores/ui'
import { usePermissionStore } from '@/stores/permission'
import { inferOsSeriesFromProjectName, inferTosVersionFromProjectName } from '@/constants/projectBasicFields'
import {
  PROJECT_TYPE_TOS_VERSION,
  inferSoftwareProjectTypeFromName,
  isSoftwareProjectType,
} from '@/constants/projectTypes'

interface AddProjectModalProps {
  open: boolean
  onCancel: () => void
}

interface FormShape {
  bid: string
  type: string
  responsiblePersons: string[]
}

export default function AddProjectModal({ open, onCancel }: AddProjectModalProps) {
  const [form] = Form.useForm<FormShape>()
  const [submitting, setSubmitting] = useState(false)

  const { projects, addProject, setSelectedProject, setProjectMember, setSelectedMarketTab } = useProjectStore()
  const { setActiveModule, setProjectSpaceModule } = useUiStore()
  const initProjectPermissions = usePermissionStore(s => s.initProjectPermissions)

  // Exclude bids whose name is already in projects.
  const candidatePool = useMemo<ExternalProjectEntry[]>(() => {
    const existingNames = new Set(projects.map(p => p.name))
    return EXTERNAL_PROJECT_POOL.filter(e => !existingNames.has(e.name))
  }, [projects])

  // Reset form when modal opens.
  useEffect(() => {
    if (open) form.resetFields()
  }, [open, form])

  const handleSubmit = async () => {
    let values: FormShape
    try {
      values = await form.validateFields()
    } catch {
      return
    }
    const entry = candidatePool.find(e => e.bid === values.bid)
    if (!entry) {
      message.error('未找到外部项目条目')
      return
    }
    setSubmitting(true)
    try {
      const extra = fetchByBid(entry.bid)
      const newId = `${Date.now()}`
      const projectType = values.type || inferSoftwareProjectTypeFromName(entry.name)
      const isSoftwareProject = isSoftwareProjectType(projectType)
      const inferredTosVersion = inferTosVersionFromProjectName(entry.name)
      const inferredOsSeries = inferOsSeriesFromProjectName(entry.name)
      const newProject: any = {
        id: newId,
        name: entry.name,
        type: projectType,
        status: '待立项',
        progress: 0,
        leader: values.responsiblePersons[0],
        markets: [],
        androidVersion: extra.androidVersion ?? '',
        chipPlatform: extra.chipPlatform ?? '',
        spm: entry.spm,
        updatedAt: '刚刚',
        productLine: extra.productLine ?? '',
        productSeries: projectType === PROJECT_TYPE_TOS_VERSION ? inferredOsSeries : '',
        osSeries: projectType === PROJECT_TYPE_TOS_VERSION ? inferredOsSeries : (isSoftwareProject ? '' : undefined),
        tosVersion: isSoftwareProject ? (inferredTosVersion || extra.tosVersion || '') : (extra.tosVersion ?? ''),
        brand: extra.brand ?? undefined,
        planStartDate: extra.planStartDate ?? '',
        planEndDate: extra.planEndDate ?? '',
        healthStatus: 'normal',
      }
      addProject(newProject)
      setProjectMember(newId, values.responsiblePersons)
      initProjectPermissions(newId, { '系统管理员': values.responsiblePersons })
      setSelectedProject(newProject)
      setSelectedMarketTab('OP')
      setProjectSpaceModule('basic')
      setActiveModule('projectSpace')
      message.success('项目创建成功')
      onCancel()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title="新增项目"
      open={open}
      onCancel={onCancel}
      onOk={handleSubmit}
      okText="创建"
      cancelText="取消"
      confirmLoading={submitting}
      destroyOnClose
    >
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item
          label="项目名"
          name="bid"
          rules={[{ required: true, message: '请选择项目名' }]}
        >
          <Select
            showSearch
            placeholder="搜索并选择项目"
            optionFilterProp="label"
            filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
            options={candidatePool.map(e => ({ label: e.name, value: e.bid }))}
            notFoundContent="无匹配项目"
            onChange={(bid) => {
              const selectedEntry = candidatePool.find(item => item.bid === bid)
              if (!selectedEntry) return
              const inferredType = inferSoftwareProjectTypeFromName(selectedEntry.name)
              if (inferredType === 'tOS版本项目') {
                form.setFieldValue('type', inferredType)
              }
            }}
          />
        </Form.Item>
        <Form.Item
          label="项目类型"
          name="type"
          rules={[{ required: true, message: '请选择项目类型' }]}
        >
          <Select
            placeholder="请选择项目类型"
            options={PROJECT_TYPES.map(t => ({ label: t, value: t }))}
          />
        </Form.Item>
        <Form.Item
          label="项目责任人"
          name="responsiblePersons"
          rules={[{ required: true, message: '请选择项目责任人', type: 'array', min: 1 }]}
          extra="创建后将成为权限中心的「系统管理员」"
        >
          <Select
            mode="multiple"
            placeholder="请选择项目责任人"
            options={ALL_USERS.map(u => ({ label: u, value: u }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
