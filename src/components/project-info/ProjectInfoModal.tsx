'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Collapse, Form, Input, Modal, Select, Space, Tag, message } from 'antd'
import { ALL_USERS } from '@/components/permission/PermissionModule'
import ProjectInfoFieldInput from '@/components/project-info/ProjectInfoFieldInput'
import {
  getProjectInfoFields,
  getProjectInfoGroups,
  isTargetProjectInfoType,
  type ProjectInfoGroupKey,
} from '@/constants/projectInfoSchema'
import { PROJECT_TYPES } from '@/constants/projectTypes'
import { fetchByBid, type ExternalProjectEntry } from '@/data/externalProjectPool'
import {
  deriveMachineProjectInfoValues,
  deriveTosProjectAggregates,
  validateProjectInfoValues,
} from '@/lib/projectInfoRules'
import {
  buildProjectInfoValues,
  type ProjectInfoProject,
} from '@/lib/projectInfoValues'
import { inferSoftwareProjectTypeFromName } from '@/constants/projectTypes'
import type { ProjectInfoValues } from '@/types/app'

type ProjectInfoFormState = ProjectInfoValues & {
  bid?: string
  projectName?: string
  type?: string
  responsiblePersons?: string[]
  healthStatus?: string
  status?: string
  marketName?: string
  brand?: string
  productLine?: string
}

export interface ProjectInfoSubmitPayload {
  bid?: string
  projectName: string
  projectType: string
  responsiblePersons: string[]
  healthStatus: string
  infoValues: ProjectInfoValues
  sourceEntry?: ExternalProjectEntry
  sourceValues: ReturnType<typeof fetchByBid>
}

interface ProjectInfoModalProps {
  mode: 'create' | 'edit'
  open: boolean
  candidateProjects: ExternalProjectEntry[]
  project?: ProjectInfoProject
  existingProjects: ProjectInfoProject[]
  responsiblePersons: string[]
  onCancel: () => void
  onSubmit: (payload: ProjectInfoSubmitPayload) => Promise<void> | void
}

const HEALTH_OPTIONS = [
  { label: '正常', value: 'normal' },
  { label: '预警', value: 'warning' },
  { label: '风险', value: 'risk' },
]

const GROUP_COLORS: Record<ProjectInfoGroupKey, string> = {
  basic: '#6366f1',
  extended: '#f59e0b',
  team: '#14b8a6',
}

const hasValue = (value: unknown) => (
  value !== undefined
  && value !== null
  && value !== ''
  && (!Array.isArray(value) || value.length > 0)
)

export default function ProjectInfoModal({
  mode,
  open,
  candidateProjects,
  project,
  existingProjects,
  responsiblePersons,
  onCancel,
  onSubmit,
}: ProjectInfoModalProps) {
  const [form] = Form.useForm<ProjectInfoFormState>()
  const [submitting, setSubmitting] = useState(false)
  const [activeGroups, setActiveGroups] = useState<string[]>([])
  const [aggregateWarnings, setAggregateWarnings] = useState<string[]>([])
  const previousTypeRef = useRef<string>('')
  const watchedValues = (Form.useWatch([], form) || {}) as ProjectInfoFormState
  const projectType = String(watchedValues.type || project?.type || '')
  const fields = useMemo(() => getProjectInfoFields(projectType), [projectType])
  const groups = useMemo(() => getProjectInfoGroups(projectType), [projectType])
  const firstLaunchOptions = useMemo(() => existingProjects
    .filter(item => item.type === '整机产品项目')
    .map(item => ({ label: item.name, value: item.id })), [existingProjects])

  useEffect(() => {
    if (!open) return
    setAggregateWarnings([])
    if (mode === 'edit' && project) {
      const projectFields = getProjectInfoFields(project.type)
      const infoValues = buildProjectInfoValues(project, projectFields.map(field => field.key))
      const initialValues: ProjectInfoFormState = {
        ...infoValues,
        projectName: project.name,
        type: project.type,
        responsiblePersons,
        healthStatus: typeof project.healthStatus === 'string' ? project.healthStatus : 'normal',
        status: typeof project.status === 'string' ? project.status : '',
        marketName: typeof project.marketName === 'string' ? project.marketName : '',
        brand: typeof project.brand === 'string' ? project.brand : '',
        productLine: typeof project.productLine === 'string' ? project.productLine : '',
      }
      form.setFieldsValue(initialValues)
      previousTypeRef.current = project.type
      setActiveGroups(projectFields.length ? getProjectInfoGroups(project.type).map(group => group.key) : [])
      return
    }
    form.resetFields()
    form.setFieldsValue({ responsiblePersons: [], healthStatus: 'normal', status: '待立项' })
    previousTypeRef.current = ''
    setActiveGroups([])
  }, [form, mode, open, project, responsiblePersons])

  const clearTypeFields = (type: string) => {
    const fieldNames = getProjectInfoFields(type).map(field => field.key)
    if (fieldNames.length) form.setFields(fieldNames.map(name => ({ name, value: undefined, errors: [] })))
  }

  const applySourceValues = (bid: string, nextType?: string) => {
    const entry = candidateProjects.find(item => item.bid === bid)
    if (!entry) return
    const sourceValues = fetchByBid(bid)
    const type = nextType || String(form.getFieldValue('type') || '')
    form.setFieldsValue({
      marketName: sourceValues.marketName || '',
      brand: sourceValues.brand || '',
      productLine: sourceValues.productLine || '',
      status: '待立项',
    })
    if (type === '整机产品项目') {
      form.setFieldsValue(deriveMachineProjectInfoValues({ ...entry, ...sourceValues }))
    }
    if (type === 'tOS版本项目') {
      form.setFieldsValue({ newProductProjectList: '', legacyProductProjectList: '' })
    }
  }

  const handleCandidateChange = (bid: string) => {
    const entry = candidateProjects.find(item => item.bid === bid)
    if (!entry) return
    const inferredType = inferSoftwareProjectTypeFromName(entry.name)
    const shouldInferTos = inferredType === 'tOS版本项目'
    if (shouldInferTos) {
      const previousType = String(form.getFieldValue('type') || '')
      if (previousType && previousType !== inferredType) clearTypeFields(previousType)
      form.setFieldValue('type', inferredType)
      previousTypeRef.current = inferredType
      setActiveGroups(getProjectInfoGroups(inferredType).map(group => group.key))
    }
    applySourceValues(bid, shouldInferTos ? inferredType : undefined)
  }

  const commitTypeChange = (nextType: string, previousType: string) => {
    clearTypeFields(previousType)
    form.setFieldValue('type', nextType)
    previousTypeRef.current = nextType
    setAggregateWarnings([])
    setActiveGroups(getProjectInfoGroups(nextType).map(group => group.key))
    const bid = String(form.getFieldValue('bid') || '')
    if (bid) applySourceValues(bid, nextType)
  }

  const handleTypeChange = (nextType: string) => {
    const previousType = previousTypeRef.current
    if (!previousType || previousType === nextType) {
      previousTypeRef.current = nextType
      setActiveGroups(getProjectInfoGroups(nextType).map(group => group.key))
      const bid = String(form.getFieldValue('bid') || '')
      if (bid) applySourceValues(bid, nextType)
      return
    }
    const hasTypeValues = getProjectInfoFields(previousType).some(field => hasValue(form.getFieldValue(field.key)))
    if (!hasTypeValues) {
      commitTypeChange(nextType, previousType)
      return
    }
    form.setFieldValue('type', previousType)
    Modal.confirm({
      title: '切换项目类型？',
      content: '切换后将清空当前项目类型下已填写的信息。',
      okText: '确认切换',
      cancelText: '继续填写',
      onOk: () => commitTypeChange(nextType, previousType),
    })
  }

  const handleInfoFieldChange = (fieldKey: string, value: ProjectInfoValues[string]) => {
    if (fieldKey !== 'firstLaunchProjects') return
    const selectedIds = Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
    const selectedEntry = candidateProjects.find(item => item.bid === form.getFieldValue('bid'))
    const projectName = mode === 'edit' ? project?.name || '' : selectedEntry?.name || ''
    const result = deriveTosProjectAggregates(selectedIds, existingProjects, projectName)
    form.setFieldsValue(result.values)
    setAggregateWarnings(result.missingSources)
  }

  const requestClose = () => {
    if (!form.isFieldsTouched()) {
      onCancel()
      return
    }
    Modal.confirm({
      title: '放弃本次填写？',
      content: '关闭后，本次未保存的内容将丢失。',
      okText: '放弃',
      cancelText: '继续填写',
      okButtonProps: { danger: true },
      onOk: onCancel,
    })
  }

  const handleSubmit = async () => {
    let values: ProjectInfoFormState
    try {
      values = await form.validateFields()
    } catch (error) {
      const failed = error as { errorFields?: Array<{ name: Array<string | number> }> }
      const firstName = String(failed.errorFields?.[0]?.name?.[0] || '')
      const firstField = fields.find(field => field.key === firstName)
      if (firstField) setActiveGroups(previous => [...new Set([...previous, firstField.group])])
      if (firstName) setTimeout(() => form.scrollToField(firstName, { block: 'center' }), 0)
      return
    }

    const infoValues = fields.reduce<ProjectInfoValues>((result, field) => {
      const value = values[field.key]
      if (value !== undefined) result[field.key] = value
      return result
    }, {})
    const pureErrors = validateProjectInfoValues(projectType, infoValues, { tosAggregateMissingSources: aggregateWarnings })
    if (pureErrors.length) {
      const first = pureErrors[0]
      form.setFields(pureErrors.map(error => ({ name: error.fieldKey, errors: [error.message] })))
      setActiveGroups(previous => [...new Set([...previous, first.groupKey])])
      setTimeout(() => form.scrollToField(first.fieldKey, { block: 'center' }), 0)
      message.error(first.message)
      return
    }

    const sourceEntry = mode === 'create'
      ? candidateProjects.find(item => item.bid === values.bid)
      : undefined
    const projectName = mode === 'edit' ? project?.name || '' : sourceEntry?.name || ''
    if (!projectName) {
      message.error('未找到项目名称')
      return
    }
    setSubmitting(true)
    try {
      await onSubmit({
        bid: values.bid,
        projectName,
        projectType,
        responsiblePersons: Array.isArray(values.responsiblePersons) ? values.responsiblePersons : [],
        healthStatus: String(values.healthStatus || 'normal'),
        infoValues,
        sourceEntry,
        sourceValues: values.bid ? fetchByBid(values.bid) : {},
      })
      form.resetFields()
    } finally {
      setSubmitting(false)
    }
  }

  const coreItems = isTargetProjectInfoType(projectType) ? (
    <div className="pms-project-info-core-form">
      <div className="pms-project-info-section-heading">核心板块</div>
      <div className="pms-project-info-form-grid">
        {projectType === '整机产品项目' && (
          <>
            <Form.Item label="市场名" name="marketName"><Input disabled placeholder="自动获取" /></Form.Item>
            <Form.Item label="品牌" name="brand"><Input disabled placeholder="自动获取" /></Form.Item>
            <Form.Item label="产品线" name="productLine"><Input disabled placeholder="自动获取" /></Form.Item>
          </>
        )}
        <Form.Item label="项目状态" name="status"><Input disabled /></Form.Item>
        <Form.Item label="健康状态" name="healthStatus" rules={[{ required: true, message: '请选择健康状态' }]}>
          <Select options={HEALTH_OPTIONS} />
        </Form.Item>
      </div>
    </div>
  ) : null

  return (
    <Modal
      title={mode === 'create' ? '新增项目' : '编辑项目信息'}
      open={open}
      width={1080}
      onCancel={requestClose}
      onOk={handleSubmit}
      okText={mode === 'create' ? '创建' : '保存'}
      cancelText="取消"
      confirmLoading={submitting}
      destroyOnClose
      className="pms-modal pms-project-info-modal"
      styles={{ body: { maxHeight: '72vh', overflowY: 'auto', paddingRight: 8 } }}
    >
      <Form form={form} layout="vertical" preserve={false}>
        <div className="pms-project-info-form-grid pms-project-info-universal">
          {mode === 'create' ? (
            <Form.Item label="项目名" name="bid" rules={[{ required: true, message: '请选择项目名' }]}>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="搜索并选择项目"
                options={candidateProjects.map(item => ({ label: item.name, value: item.bid }))}
                onChange={handleCandidateChange}
              />
            </Form.Item>
          ) : (
            <Form.Item label="项目名" name="projectName"><Input disabled /></Form.Item>
          )}
          <Form.Item label="项目类型" name="type" rules={[{ required: true, message: '请选择项目类型' }]}>
            <Select disabled={mode === 'edit'} options={PROJECT_TYPES.map(type => ({ label: type, value: type }))} onChange={handleTypeChange} />
          </Form.Item>
          <Form.Item label="项目责任人" name="responsiblePersons" extra="负责项目可见范围，并作为权限中心的系统管理员" rules={[{ required: true, type: 'array', min: 1, message: '请选择项目责任人' }]}>
            <Select mode="multiple" showSearch optionFilterProp="label" options={ALL_USERS.map(user => ({ label: user, value: user }))} />
          </Form.Item>
        </div>

        {coreItems}

        {aggregateWarnings.length > 0 && (
          <Alert type="warning" showIcon style={{ marginBottom: 12 }} message="首发项目来源字段不完整" description={aggregateWarnings.join('；')} />
        )}

        {groups.length > 0 && (
          <Collapse
            activeKey={activeGroups}
            onChange={keys => setActiveGroups(keys as string[])}
            items={groups.map(group => {
              const groupFields = fields.filter(field => field.group === group.key)
              return {
                key: group.key,
                label: <Space><span className="pms-project-info-group-dot" style={{ background: GROUP_COLORS[group.key] }} /><strong>{group.label}</strong><Tag>{groupFields.length} 项</Tag></Space>,
                children: (
                  <div className="pms-project-info-form-grid">
                    {groupFields.map(field => {
                      const active = !field.visibleWhen || field.visibleWhen(watchedValues)
                      if (!active) return null
                      return (
                        <Form.Item
                          key={field.key}
                          label={field.label}
                          name={field.key}
                          extra={field.conditionalHint}
                          className={field.inputType === 'jira' ? 'pms-project-info-form-span' : undefined}
                          rules={field.requiredOnCreate ? [{ required: true, message: `请填写${field.label}` }] : undefined}
                        >
                          <ProjectInfoFieldInput
                            field={field}
                            firstLaunchProjectOptions={firstLaunchOptions}
                            onChange={value => handleInfoFieldChange(field.key, value)}
                          />
                        </Form.Item>
                      )
                    })}
                  </div>
                ),
              }
            })}
          />
        )}
      </Form>
    </Modal>
  )
}
