'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import { Button, Card, DatePicker, Empty, Flex, Form, Input, List, Modal, Tooltip, Typography, message } from 'antd'
import type { InputRef } from 'antd'
import { isMachineProjectType } from '@/constants/projectTypes'
import { compareSemanticTos } from '@/lib/roadmapSorting'
import {
  formatTosVersionFull,
  normalizeLegacyTosVersionName,
  normalizeTosVersionName,
} from '@/lib/roadmapValidation'
import { useRoadmapStore } from '@/stores/roadmap'
import type { ProjectItem } from '@/types/app'
import type { PlannedRoadmapProject, TosVersionConfig } from '@/types/roadmap'

const CREATE_VERSION_ID = '__create__'

const versionCardStyle: CSSProperties = {
  borderColor: 'var(--border-purple)',
  borderRadius: 'var(--radius-lg)',
  background: 'var(--bg-glass)',
}

interface TosVersionMaintenanceModalProps {
  open: boolean
  onCancel: () => void
  normalProjects: readonly ProjectItem[]
  plannedProjects: readonly PlannedRoadmapProject[]
  canEdit: boolean
  onChanged?: () => void
}

interface TosVersionFormValues {
  name: string
  period?: [Dayjs | null, Dayjs | null]
  targetText: string
}

export interface TosVersionReferenceCounts {
  normalReferenceCount: number
  plannedReferenceCount: number
  referenceCount: number
}

function resolveTosReferenceId(value: unknown, versions: readonly TosVersionConfig[]): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const trimmed = value.trim()
  const byId = versions.find(version => version.id === trimmed)
  if (byId) return byId.id
  const normalized = normalizeTosVersionName(trimmed)
  if (normalized) {
    return versions.find(version => (
      version.major === normalized.major
      && version.minor === normalized.minor
      && version.patch === normalized.patch
    ))?.id ?? null
  }
  if (!/^(?:tos\s*)?\d+\.\d+$/i.test(trimmed)) return null
  const legacyNormalized = normalizeLegacyTosVersionName(trimmed)
  if (!legacyNormalized) return null
  return versions.find(version => (
    version.major === legacyNormalized.major && version.minor === legacyNormalized.minor
  ))?.id ?? null
}

function resolveNormalProjectTosReference(
  project: ProjectItem,
  versions: readonly TosVersionConfig[],
): string | null {
  if (!isMachineProjectType(project.type)) return null
  if (typeof project.firstSaleTosVersionId === 'string' && project.firstSaleTosVersionId.trim()) {
    return resolveTosReferenceId(project.firstSaleTosVersionId, versions)
  }
  return resolveTosReferenceId(project.tosVersionName, versions)
    ?? resolveTosReferenceId(project.tosVersion, versions)
}

export function countTosVersionReferences(
  normalProjects: readonly ProjectItem[],
  plannedProjects: readonly Pick<PlannedRoadmapProject, 'id' | 'firstSaleTosVersionId'>[],
  version: Pick<TosVersionConfig, 'id'>,
  versions: readonly TosVersionConfig[],
): TosVersionReferenceCounts {
  const normalReferences = new Set(normalProjects.flatMap(project => (
    resolveNormalProjectTosReference(project, versions) === version.id
      ? [`normal:${project.id}`]
      : []
  )))
  const plannedReferences = new Set(plannedProjects.flatMap(project => (
    project.firstSaleTosVersionId === version.id
      ? [`planned:${project.id}`]
      : []
  )))
  const normalReferenceCount = normalReferences.size
  const plannedReferenceCount = plannedReferences.size
  return {
    normalReferenceCount,
    plannedReferenceCount,
    referenceCount: normalReferenceCount + plannedReferenceCount,
  }
}

export default function TosVersionMaintenanceModal({
  open,
  onCancel,
  normalProjects,
  plannedProjects,
  canEdit,
  onChanged,
}: TosVersionMaintenanceModalProps) {
  const [form] = Form.useForm<TosVersionFormValues>()
  const nameInputRef = useRef<InputRef>(null)
  const submitLockRef = useRef(false)
  const dirtyRef = useRef(false)
  const [editingVersionId, setEditingVersionId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const tosVersions = useRoadmapStore(state => state.tosVersions)
  const createTosVersion = useRoadmapStore(state => state.createTosVersion)
  const renameTosVersion = useRoadmapStore(state => state.renameTosVersion)
  const deleteTosVersion = useRoadmapStore(state => state.deleteTosVersion)

  const descendingVersions = useMemo(
    () => [...tosVersions].sort((left, right) => compareSemanticTos(right, left)),
    [tosVersions],
  )
  const referenceCountsByVersion = useMemo(
    () => new Map(tosVersions.map(version => [
      version.id,
      countTosVersionReferences(normalProjects, plannedProjects, version, tosVersions),
    ])),
    [normalProjects, plannedProjects, tosVersions],
  )

  useEffect(() => {
    if (!open) return
    setEditingVersionId(null)
    dirtyRef.current = false
    form.resetFields()
  }, [form, open])

  const focusNameInput = () => requestAnimationFrame(() => nameInputRef.current?.focus())

  const setNameError = (error: string) => {
    form.setFields([{ name: 'name', errors: [error] }])
    focusNameInput()
  }

  const normalizeNameField = () => {
    const rawName = form.getFieldValue('name')?.trim() ?? ''
    if (!rawName) return
    const normalized = normalizeTosVersionName(rawName)
    if (!normalized) {
      setNameError('格式应为 tOS 主版本.次版本，例如 tOS 18.1')
      return
    }
    const duplicate = tosVersions.some(version => (
      version.id !== editingVersionId && (
        version.name === normalized.name
        || (normalized.major >= 16 && version.major === normalized.major && version.minor === normalized.minor)
      )
    ))
    if (duplicate) {
      form.setFieldValue('name', normalized.name)
      setNameError('该版本已存在，请输入其他版本号')
      return
    }
    form.setFieldValue('name', normalized.name)
    form.setFields([{ name: 'name', errors: [] }])
  }

  const resetInlineForm = () => {
    dirtyRef.current = false
    setEditingVersionId(null)
    form.resetFields()
  }

  const beginEdit = (version: TosVersionConfig | null) => {
    setEditingVersionId(version?.id ?? CREATE_VERSION_ID)
    form.resetFields()
    form.setFieldsValue(version
      ? {
          name: formatTosVersionFull(version),
          period: version.periodStartDate && version.periodEndDate
            ? [dayjs(version.periodStartDate), dayjs(version.periodEndDate)]
            : undefined,
          targetText: version.targets.join('\n'),
        }
      : { name: '', period: undefined, targetText: '' })
    form.setFields([{ name: 'name', errors: [] }])
    dirtyRef.current = false
    focusNameInput()
  }

  const hasDirtyDraft = () => dirtyRef.current && form.isFieldsTouched()

  const confirmDiscard = (next: () => void) => {
    if (!hasDirtyDraft()) {
      next()
      return
    }
    Modal.confirm({
      title: '放弃未保存的修改？',
      content: '当前输入尚未保存。',
      okText: '放弃修改',
      cancelText: '继续编辑',
      onOk: next,
    })
  }

  const requestEdit = (version: TosVersionConfig | null) => {
    const nextId = version?.id ?? CREATE_VERSION_ID
    if (editingVersionId === nextId) return
    confirmDiscard(() => beginEdit(version))
  }

  const requestCancelEdit = () => confirmDiscard(resetInlineForm)

  const requestClose = () => confirmDiscard(() => {
    resetInlineForm()
    onCancel()
  })

  const handleSubmit = async () => {
    if (submitLockRef.current) return
    submitLockRef.current = true
    try {
      if (!canEdit) return
      let values: TosVersionFormValues
      try {
        values = await form.validateFields()
      } catch {
        focusNameInput()
        return
      }
      const normalized = normalizeTosVersionName(values.name)
      if (!normalized) {
        setNameError('格式应为完整三位版本，例如 tOS 18.1.0')
        return
      }

      const periodStartDate = values.period?.[0]?.format('YYYY-MM-DD') ?? ''
      const periodEndDate = values.period?.[1]?.format('YYYY-MM-DD') ?? ''
      const targetText = values.targetText?.trim() ?? ''
      const input = {
        name: normalized.name,
        periodStartDate,
        periodEndDate,
        targets: targetText ? [targetText] : [],
      }
      setSubmitting(true)
      const result = editingVersionId && editingVersionId !== CREATE_VERSION_ID
        ? renameTosVersion(editingVersionId, {
            name: input.name,
            periodStartDate: input.periodStartDate,
            periodEndDate: input.periodEndDate,
            targets: input.targets,
          })
        : createTosVersion({
            name: input.name,
            periodStartDate: input.periodStartDate,
            periodEndDate: input.periodEndDate,
            targets: input.targets,
          })
      if (!result.ok) {
        if (result.reason === 'duplicate') {
          setNameError('该版本已存在，请输入其他版本号')
          return
        }
        if (result.reason === 'invalid') {
          if (result.errors.name) {
            setNameError(result.errors.name)
          } else {
            message.error(result.errors.periodStartDate ?? result.errors.periodEndDate ?? '保存失败，请检查输入')
          }
          return
        }
        setNameError('版本不存在，请刷新后重试')
        return
      }
      message.success(editingVersionId === CREATE_VERSION_ID ? 'tOS 版本已新增' : 'tOS 版本已更新')
      resetInlineForm()
      onChanged?.()
    } finally {
      setSubmitting(false)
      submitLockRef.current = false
    }
  }

  const handleDelete = (version: TosVersionConfig, normalReferenceCount: number) => {
    if (!canEdit) return
    Modal.confirm({
      title: `删除 ${version.name}？`,
      content: '删除后该版本将不再出现在路标版本候选中。',
      okText: '确认删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => {
        const result = deleteTosVersion(version.id, normalReferenceCount)
        if (!result.ok) {
          const error = result.reason === 'referenced'
            ? `已被 ${result.referenceCount} 个项目引用，无法删除`
            : '版本不存在，请刷新后重试'
          message.error(error)
          return Promise.reject(new Error('tos-version-delete-failed'))
        }
        if (editingVersionId === version.id) resetInlineForm()
        message.success('tOS 版本已删除')
        onChanged?.()
      },
    })
  }

  const renderEditingCard = () => (
    <Card
      size="small"
      title={editingVersionId === CREATE_VERSION_ID ? '新增版本' : '编辑版本'}
      style={{ ...versionCardStyle, width: '100%' }}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        onValuesChange={() => {
          dirtyRef.current = true
        }}
      >
        <Flex gap={12} wrap>
          <Form.Item
            label="tOS 版本"
            name="name"
            rules={[{ required: true, whitespace: true, message: '请输入 tOS 版本' }]}
            style={{ flex: '1 1 220px', marginBottom: 12 }}
          >
            <Input
              ref={nameInputRef}
              placeholder="例如 tOS 18.1.0"
              autoComplete="off"
              onBlur={normalizeNameField}
            />
          </Form.Item>
          <Form.Item
            label="项目周期"
            name="period"
            style={{ flex: '1 1 300px', marginBottom: 12 }}
          >
            <DatePicker.RangePicker
              allowEmpty={[true, true]}
              format="YYYY-MM-DD"
              style={{ width: '100%' }}
              placeholder={['开始日期', '结束日期']}
            />
          </Form.Item>
        </Flex>
        <Form.Item
          label="版本目标"
          name="targetText"
          rules={[{ max: 4000, message: '版本目标不能超过 4000 个字符' }]}
          style={{ marginBottom: 12 }}
        >
          <Input.TextArea
            rows={5}
            maxLength={4000}
            showCount
            placeholder="请输入版本目标，可自由换行"
          />
        </Form.Item>
        <Flex justify="flex-end" gap={8}>
          <Button onClick={requestCancelEdit}>取消</Button>
          <Button type="primary" htmlType="submit" loading={submitting} disabled={submitting}>
            保存
          </Button>
        </Flex>
      </Form>
    </Card>
  )

  return (
    <Modal
      className="pms-modal"
      title="tOS 版本维护"
      open={open}
      onCancel={requestClose}
      width={820}
      destroyOnHidden
      footer={<Button onClick={requestClose}>关闭</Button>}
      styles={{ body: { maxHeight: '68vh', overflowY: 'auto', paddingInlineEnd: 8 } }}
    >
      <Flex vertical gap={16}>
        {canEdit ? (
          <Flex justify="flex-end">
            <Button type="primary" onClick={() => requestEdit(null)}>新增版本</Button>
          </Flex>
        ) : null}

        {editingVersionId === CREATE_VERSION_ID ? renderEditingCard() : null}

        <List
          aria-label="tOS 版本列表"
          dataSource={descendingVersions}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无 tOS 版本" /> }}
          renderItem={version => {
            const { normalReferenceCount, plannedReferenceCount, referenceCount } = referenceCountsByVersion.get(version.id)
              ?? { normalReferenceCount: 0, plannedReferenceCount: 0, referenceCount: 0 }
            const referenceTip = `正常项目 ${normalReferenceCount} 个，待规划项目 ${plannedReferenceCount} 个`
            return (
              <List.Item style={{ paddingInline: 0 }}>
                {editingVersionId === version.id ? renderEditingCard() : (
                  <Card size="small" style={{ ...versionCardStyle, width: '100%' }}>
                  <Flex justify="space-between" align="center" gap={16} wrap>
                    <Flex vertical gap={4} style={{ minWidth: 0, flex: 1 }}>
                      <Typography.Text strong style={{ fontSize: 'var(--text-lg)' }}>
                        {formatTosVersionFull(version)}
                      </Typography.Text>
                      {version.periodStartDate && version.periodEndDate ? (
                        <Typography.Text type="secondary">
                          项目周期：{version.periodStartDate} 至 {version.periodEndDate}
                        </Typography.Text>
                      ) : null}
                      <Typography.Text type="secondary" ellipsis={{ tooltip: version.targets.join('\n') }}>
                        版本目标：{version.targets.length ? version.targets.join('；') : '未设置'}
                      </Typography.Text>
                      <Tooltip title={referenceTip}>
                        <Typography.Text type="secondary">
                          引用 {referenceCount} 个项目
                        </Typography.Text>
                      </Tooltip>
                    </Flex>
                    {canEdit ? (
                      <Flex gap={8} wrap>
                        <Button onClick={() => requestEdit(version)}>编辑</Button>
                        {referenceCount > 0 ? (
                          <Tooltip
                            title={`已被 ${referenceCount} 个项目引用，无法删除`}
                            trigger={['hover', 'focus']}
                          >
                            <span
                              tabIndex={0}
                              role="button"
                              aria-disabled="true"
                              aria-label={`删除 ${version.name}：已被 ${referenceCount} 个项目引用，无法删除`}
                              style={{ display: 'inline-flex' }}
                            >
                              <Button danger disabled aria-hidden="true" tabIndex={-1}>删除</Button>
                            </span>
                          </Tooltip>
                        ) : (
                          <Button danger onClick={() => handleDelete(version, normalReferenceCount)}>删除</Button>
                        )}
                      </Flex>
                    ) : null}
                  </Flex>
                  </Card>
                )}
              </List.Item>
            )
          }}
        />
      </Flex>
    </Modal>
  )
}
