'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ReloadOutlined } from '@ant-design/icons'
import { Alert, Button, Collapse, Form, Input, Modal, Select, Space, Tag, message } from 'antd'
import { ALL_USERS } from '@/components/permission/PermissionModule'
import ProjectInfoFieldInput from '@/components/project-info/ProjectInfoFieldInput'
import {
  getEffectiveProjectInfoFields,
  getProjectInfoFields,
  getProjectInfoGroups,
  isTargetProjectInfoType,
  type ProjectInfoGroupKey,
} from '@/constants/projectInfoSchema'
import { PROJECT_TYPES, PROJECT_TYPE_TOS_VERSION } from '@/constants/projectTypes'
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
import {
  defaultProjectCreationDraftRepository,
  isProjectCreationDraftEmpty,
  PROJECT_CREATION_DRAFT_SCHEMA_VERSION,
  type ProjectCreationDraftRepository,
} from '@/lib/projectCreationDraft'
import { inferSoftwareProjectTypeFromName } from '@/constants/projectTypes'
import type { ProjectInfoValues } from '@/types/app'

type ProjectInfoFormState = ProjectInfoValues & {
  bid?: string
  projectName?: string
  type?: string
  responsiblePersons?: string[]
  healthStatus?: string
  status?: string
  currentNode?: string
  cancelPauseDate?: string
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
  draftOwnerId?: string
  draftRepository?: ProjectCreationDraftRepository
  onCancel: () => void
  onSubmit: (payload: ProjectInfoSubmitPayload) => Promise<void> | void
}

export const PROJECT_CREATION_DRAFT_SAVE_DELAY_MS = 300

const CREATE_FORM_DEFAULTS: ProjectInfoFormState = {
  responsiblePersons: [],
  healthStatus: 'normal',
  status: '待立项',
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
  draftOwnerId,
  draftRepository = defaultProjectCreationDraftRepository,
  onCancel,
  onSubmit,
}: ProjectInfoModalProps) {
  const [form] = Form.useForm<ProjectInfoFormState>()
  const [submitting, setSubmitting] = useState(false)
  const [activeGroups, setActiveGroups] = useState<string[]>([])
  const [aggregateWarnings, setAggregateWarnings] = useState<string[]>([])
  const [draftHydrated, setDraftHydrated] = useState(false)
  const previousTypeRef = useRef<string>('')
  const lastAppliedSourceRef = useRef<string>('')
  const activeGroupsRef = useRef<string[]>([])
  const candidateProjectsRef = useRef(candidateProjects)
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const draftHydrationPromiseRef = useRef<Promise<void> | null>(null)
  const draftMutationQueueRef = useRef<Promise<void>>(Promise.resolve())
  const componentMountedRef = useRef(true)
  const watchedValues = (Form.useWatch([], { form, preserve: true }) || {}) as ProjectInfoFormState
  const projectType = String(watchedValues.type || project?.type || '')
  const fields = useMemo(() => getProjectInfoFields(projectType), [projectType])
  const editableFields = useMemo(() => fields.filter(field => !field.readOnly), [fields])
  const groups = useMemo(() => getProjectInfoGroups(projectType), [projectType])
  const firstLaunchOptions = useMemo(() => existingProjects
    .filter(item => item.type === '整机产品项目')
    .map(item => ({ label: item.name, value: item.id })), [existingProjects])

  const cancelDraftSave = useCallback(() => {
    if (draftSaveTimerRef.current === null) return
    clearTimeout(draftSaveTimerRef.current)
    draftSaveTimerRef.current = null
  }, [])

  useEffect(() => {
    componentMountedRef.current = true
    return () => {
      componentMountedRef.current = false
      cancelDraftSave()
    }
  }, [cancelDraftSave])

  const enqueueDraftMutation = useCallback((operation: () => Promise<void>) => {
    const result = draftMutationQueueRef.current
      .catch(() => undefined)
      .then(operation)
    draftMutationQueueRef.current = result.catch(() => undefined)
    return result
  }, [])

  const resetCreateForm = useCallback(() => {
    form.resetFields()
    form.setFieldsValue(CREATE_FORM_DEFAULTS)
    setAggregateWarnings([])
    activeGroupsRef.current = []
    setActiveGroups([])
    previousTypeRef.current = ''
    lastAppliedSourceRef.current = ''
  }, [form])

  useEffect(() => {
    candidateProjectsRef.current = candidateProjects
  }, [candidateProjects])

  useEffect(() => {
    activeGroupsRef.current = activeGroups
  }, [activeGroups])

  useEffect(() => {
    if (!open || mode !== 'edit' || !project) return
    setDraftHydrated(false)
    lastAppliedSourceRef.current = ''
    setAggregateWarnings([])
    // The Form instance survives modal close/reopen. Clear the previous project's
    // unmentioned fields before applying the next project's values.
    form.resetFields()
    const projectFields = getProjectInfoFields(project.type)
    const storedInfoValues = buildProjectInfoValues(project, projectFields.map(field => field.key))
    let infoValues = storedInfoValues
    if (project.type === PROJECT_TYPE_TOS_VERSION) {
      const selectedIds = Array.isArray(storedInfoValues.firstLaunchProjects)
        ? storedInfoValues.firstLaunchProjects.filter((item): item is string => typeof item === 'string')
        : []
      const aggregateResult = deriveTosProjectAggregates(selectedIds, existingProjects, project.name)
      infoValues = { ...storedInfoValues, ...aggregateResult.values }
      setAggregateWarnings(aggregateResult.missingSources)
    }
    const initialValues: ProjectInfoFormState = {
      ...infoValues,
      projectName: project.name,
      type: project.type,
      responsiblePersons,
      healthStatus: typeof project.healthStatus === 'string' ? project.healthStatus : 'normal',
      status: typeof project.status === 'string' ? project.status : '',
      currentNode: typeof project.currentNode === 'string' ? project.currentNode : '',
      cancelPauseDate: typeof project.cancelPauseDate === 'string' ? project.cancelPauseDate : '',
      marketName: typeof project.marketName === 'string' ? project.marketName : '',
      brand: typeof project.brand === 'string' ? project.brand : '',
      productLine: typeof project.productLine === 'string' ? project.productLine : '',
    }
    form.setFieldsValue(initialValues)
    previousTypeRef.current = project.type
    const nextActiveGroups = projectFields.length
      ? getProjectInfoGroups(project.type).map(group => group.key)
      : []
    activeGroupsRef.current = nextActiveGroups
    setActiveGroups(nextActiveGroups)
  }, [existingProjects, form, mode, open, project, responsiblePersons])

  useEffect(() => {
    if (!open || mode !== 'create') {
      setDraftHydrated(false)
      draftHydrationPromiseRef.current = null
      cancelDraftSave()
      return
    }

    let stale = false
    setDraftHydrated(false)
    cancelDraftSave()
    resetCreateForm()

    const hydrateDraft = async () => {
      if (!draftOwnerId) {
        if (!stale) setDraftHydrated(true)
        return
      }

      try {
        const draft = await draftRepository.get(draftOwnerId)
        if (stale) return

        const restoredBid = typeof draft?.values.bid === 'string' ? draft.values.bid : ''
        if (restoredBid && !candidateProjectsRef.current.some(item => item.bid === restoredBid)) {
          try {
            await enqueueDraftMutation(() => draftRepository.clear(draftOwnerId))
          } catch {
            if (!stale) message.error('项目草稿清空失败')
          }
          if (stale) return
        } else if (draft) {
          form.setFieldsValue(draft.values as ProjectInfoFormState)
          const restoredType = typeof draft.values.type === 'string' ? draft.values.type : ''
          previousTypeRef.current = restoredType
          activeGroupsRef.current = draft.activeGroups
          setActiveGroups(draft.activeGroups)
        }
      } catch {
        if (!stale) message.error('项目草稿读取失败')
      } finally {
        if (!stale) setDraftHydrated(true)
      }
    }

    const hydrationPromise = hydrateDraft()
    draftHydrationPromiseRef.current = hydrationPromise

    return () => {
      stale = true
      cancelDraftSave()
    }
  }, [cancelDraftSave, draftOwnerId, draftRepository, enqueueDraftMutation, form, mode, open, resetCreateForm])

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
    const shouldInferTos = inferredType === PROJECT_TYPE_TOS_VERSION
    const previousType = String(form.getFieldValue('type') || '')
    const previousFirstLaunchProjectIds = previousType === PROJECT_TYPE_TOS_VERSION
      && Array.isArray(form.getFieldValue('firstLaunchProjects'))
      ? (form.getFieldValue('firstLaunchProjects') as unknown[]).filter((item): item is string => typeof item === 'string')
      : []
    // Candidate-specific fields must never leak from the previously selected
    // external project. Source-derived values are reapplied immediately below.
    if (previousType) clearTypeFields(previousType)
    if (shouldInferTos) {
      form.setFieldValue('type', inferredType)
      previousTypeRef.current = inferredType
      setActiveGroups(getProjectInfoGroups(inferredType).map(group => group.key))
    }
    applySourceValues(bid, shouldInferTos ? inferredType : undefined)
    if (shouldInferTos && previousFirstLaunchProjectIds.length > 0) {
      const aggregateResult = deriveTosProjectAggregates(previousFirstLaunchProjectIds, existingProjects, entry.name)
      form.setFieldsValue(aggregateResult.values)
      setAggregateWarnings(aggregateResult.missingSources)
    } else {
      setAggregateWarnings([])
    }
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

  const watchedBid = String(watchedValues.bid || '')
  const firstLaunchSignature = Array.isArray(watchedValues.firstLaunchProjects)
    ? watchedValues.firstLaunchProjects.join('|')
    : ''

  useEffect(() => {
    if (!open || mode !== 'create' || !watchedBid) return
    const sourceKey = `${watchedBid}::${projectType}`
    if (lastAppliedSourceRef.current === sourceKey) return
    const previousBid = lastAppliedSourceRef.current.split('::')[0]
    const selectedFirstLaunchIds = Array.isArray(form.getFieldValue('firstLaunchProjects'))
      ? (form.getFieldValue('firstLaunchProjects') as unknown[]).filter((item): item is string => typeof item === 'string')
      : []
    if (previousBid && previousBid !== watchedBid && projectType) clearTypeFields(projectType)
    applySourceValues(watchedBid, projectType)
    if (projectType === PROJECT_TYPE_TOS_VERSION && selectedFirstLaunchIds.length > 0) {
      const entry = candidateProjects.find(item => item.bid === watchedBid)
      const aggregateResult = deriveTosProjectAggregates(selectedFirstLaunchIds, existingProjects, entry?.name || '')
      form.setFieldsValue(aggregateResult.values)
      setAggregateWarnings(aggregateResult.missingSources)
    }
    lastAppliedSourceRef.current = sourceKey
  }, [candidateProjects, existingProjects, form, mode, open, projectType, watchedBid])

  useEffect(() => {
    if (!open || projectType !== PROJECT_TYPE_TOS_VERSION) return
    const selectedIds = firstLaunchSignature.split('|').filter(Boolean)
    const selectedEntry = candidateProjects.find(item => item.bid === watchedBid)
    const projectName = mode === 'edit' ? project?.name || '' : selectedEntry?.name || ''
    const result = deriveTosProjectAggregates(selectedIds, existingProjects, projectName)
    form.setFieldsValue(result.values)
    setAggregateWarnings(result.missingSources)
  }, [candidateProjects, existingProjects, firstLaunchSignature, form, mode, open, project, projectType, watchedBid])

  const persistCreateDraft = useCallback(async () => {
    if (mode !== 'create' || !draftOwnerId) return

    const values = form.getFieldsValue(true) as ProjectInfoFormState
    if (isProjectCreationDraftEmpty(values)) {
      await enqueueDraftMutation(() => draftRepository.clear(draftOwnerId))
      return
    }

    await enqueueDraftMutation(() => draftRepository.save({
      schemaVersion: PROJECT_CREATION_DRAFT_SCHEMA_VERSION,
      ownerId: draftOwnerId,
      values,
      activeGroups: activeGroupsRef.current,
      updatedAt: new Date().toISOString(),
    }))
  }, [draftOwnerId, draftRepository, enqueueDraftMutation, form, mode])

  useEffect(() => {
    if (!open || mode !== 'create' || !draftOwnerId || !draftHydrated) return

    let stale = false
    cancelDraftSave()
    draftSaveTimerRef.current = setTimeout(() => {
      draftSaveTimerRef.current = null
      void persistCreateDraft().catch(() => {
        if (!stale) message.error('项目草稿自动保存失败')
      })
    }, PROJECT_CREATION_DRAFT_SAVE_DELAY_MS)

    return () => {
      stale = true
      cancelDraftSave()
    }
  }, [activeGroups, cancelDraftSave, draftHydrated, draftOwnerId, mode, open, persistCreateDraft, watchedValues])

  const requestClose = async () => {
    if (mode === 'create') {
      cancelDraftSave()
      try {
        await draftHydrationPromiseRef.current
        await persistCreateDraft()
        if (componentMountedRef.current) onCancel()
      } catch {
        message.error('项目草稿自动保存失败')
      }
      return
    }

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

  const requestResetCreateDraft = () => {
    if (mode !== 'create' || !draftOwnerId) return

    Modal.confirm({
      title: '重新填写？',
      content: '将清空当前已填写并自动保存的全部内容，此操作不可撤销。',
      okText: '确认清空',
      cancelText: '继续填写',
      okButtonProps: { danger: true },
      onOk: async () => {
        cancelDraftSave()
        try {
          await enqueueDraftMutation(() => draftRepository.clear(draftOwnerId))
        } catch (error) {
          message.error('项目草稿清空失败')
          throw error
        }
        if (!componentMountedRef.current) return
        resetCreateForm()
        setDraftHydrated(true)
      },
    })
  }

  const handleSubmit = async () => {
    let values: ProjectInfoFormState
    try {
      await form.validateFields()
      values = form.getFieldsValue(true) as ProjectInfoFormState
    } catch (error) {
      const failed = error as { errorFields?: Array<{ name: Array<string | number> }> }
      const firstName = String(failed.errorFields?.[0]?.name?.[0] || '')
      const firstField = fields.find(field => field.key === firstName)
      if (firstField) setActiveGroups(previous => [...new Set([...previous, firstField.group])])
      if (firstName) setTimeout(() => form.scrollToField(firstName, { block: 'center' }), 0)
      return
    }

    const effectiveFields = getEffectiveProjectInfoFields(projectType, values)
    const infoValues = effectiveFields.reduce<ProjectInfoValues>((result, field) => {
      const value = values[field.key]
      if (value !== undefined) result[field.key] = value
      return result
    }, {})
    const editableFieldKeys = new Set(editableFields.map(field => field.key))
    const editableErrors = validateProjectInfoValues(
      projectType,
      infoValues,
      {
        tosAggregateMissingSources: aggregateWarnings,
        validateRequiredOnCreate: mode === 'create',
      },
    ).filter(error => editableFieldKeys.has(error.fieldKey))
    if (editableErrors.length) {
      const first = editableErrors[0]
      form.setFields(editableErrors.map(error => ({ name: error.fieldKey, errors: [error.message] })))
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
      if (mode === 'create' && draftOwnerId) {
        cancelDraftSave()
        try {
          await enqueueDraftMutation(() => draftRepository.clear(draftOwnerId))
        } catch {
          message.error('项目草稿清空失败')
          return
        }
      }
      if (componentMountedRef.current) {
        if (mode === 'create') resetCreateForm()
        else form.resetFields()
      }
    } finally {
      if (componentMountedRef.current) setSubmitting(false)
    }
  }

  return (
    <Modal
      title={mode === 'create' ? (
        <div className="pms-project-info-modal-title-row">
          <span>新增项目</span>
          <Button type="text" danger size="small" icon={<ReloadOutlined />} onClick={requestResetCreateDraft}>
            重新填写
          </Button>
        </div>
      ) : '编辑项目信息'}
      open={open}
      width={1240}
      onCancel={requestClose}
      onOk={handleSubmit}
      okText={mode === 'create' ? '创建' : '保存'}
      cancelText="取消"
      confirmLoading={submitting}
      destroyOnHidden
      className="pms-modal pms-project-info-modal"
      styles={{ body: { maxHeight: '72vh', overflowY: 'auto', paddingRight: 24 } }}
    >
      <Form
        form={form}
        layout="vertical"
        onValuesChange={(changedValues) => {
          if (typeof changedValues.bid === 'string') handleCandidateChange(changedValues.bid)
          if (typeof changedValues.type === 'string') handleTypeChange(changedValues.type)
          if (changedValues.firstLaunchProjects !== undefined) {
            handleInfoFieldChange('firstLaunchProjects', changedValues.firstLaunchProjects)
          }
        }}
      >
        <div className="pms-project-info-form-grid pms-project-info-universal">
          {mode === 'create' ? (
            <Form.Item label="项目名" name="bid" rules={[{ required: true, message: '请选择项目名' }]}>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="搜索并选择项目"
                options={candidateProjects.map(item => ({ label: item.name, value: item.bid }))}
              />
            </Form.Item>
          ) : (
            <Form.Item label="项目名" name="projectName"><Input disabled /></Form.Item>
          )}
          <Form.Item label="项目类型" name="type" rules={[{ required: true, message: '请选择项目类型' }]}>
            <Select disabled={mode === 'edit'} options={PROJECT_TYPES.map(type => ({ label: type, value: type }))} />
          </Form.Item>
          <Form.Item label="项目责任人" name="responsiblePersons" extra="负责项目可见范围，并作为权限中心的系统管理员" rules={[{ required: true, type: 'array', min: 1, message: '请选择项目责任人' }]}>
            <Select mode="multiple" showSearch optionFilterProp="label" options={ALL_USERS.map(user => ({ label: user, value: user }))} />
          </Form.Item>
          {isTargetProjectInfoType(projectType) && (
            <Form.Item label="健康状态" name="healthStatus" initialValue="normal" rules={[{ required: true, message: '请选择健康状态' }]}>
              <Select options={HEALTH_OPTIONS} />
            </Form.Item>
          )}
        </div>

        {aggregateWarnings.length > 0 && (
          <Alert type="warning" showIcon style={{ marginBottom: 12 }} message="首发项目来源字段不完整" description={aggregateWarnings.join('；')} />
        )}

        {groups.length > 0 && (
          <Collapse
            className="pms-project-info-form-groups"
            activeKey={activeGroups}
            onChange={(keys) => {
              const nextActiveGroups = keys as string[]
              activeGroupsRef.current = nextActiveGroups
              setActiveGroups(nextActiveGroups)
            }}
            items={groups.map(group => {
              const groupFields = editableFields.filter(field => field.group === group.key)
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
                          rules={mode === 'create' && field.requiredOnCreate
                            ? [{ required: true, message: `请填写${field.label}` }]
                            : undefined}
                        >
                          <ProjectInfoFieldInput
                            field={field}
                            firstLaunchProjectOptions={firstLaunchOptions}
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
