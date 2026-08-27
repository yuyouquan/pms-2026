'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Empty,
  Flex,
  Form,
  Input,
  List,
  Modal,
  Select,
  Skeleton,
  Tooltip,
  Typography,
  message,
} from 'antd'
import { isMachineProjectType } from '@/constants/projectTypes'
import { useEnumHydration, useSingleEnumOptions } from '@/hooks/useEnumOptions'
import { formatTosSnapshot, normalizeTosSnapshot } from '@/lib/enumConsumers'
import { compareSemanticTos } from '@/lib/roadmapSorting'
import { normalizeLegacyRoadmapProductType } from '@/lib/roadmapValidation'
import { useRoadmapStore } from '@/stores/roadmap'
import { useEnumStore } from '@/stores/enums'
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

function resolveProjectVersion(project: ProjectItem): string {
  if (!isMachineProjectType(project.type)) return ''
  const productType = normalizeLegacyRoadmapProductType(project.productType)
  const candidates = productType === '新品'
    ? [project.firstSaleTosVersionId, project.firstSaleTosVersion]
    : productType === '老品'
      ? [project.currentTosVersionId, project.currentTosVersion]
      : [
          project.firstSaleTosVersionId,
          project.firstSaleTosVersion,
          project.currentTosVersionId,
          project.currentTosVersion,
          project.tosVersionName,
          project.tosVersion,
        ]
  return candidates.map(normalizeTosSnapshot).find(Boolean) ?? ''
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
  const submitLockRef = useRef(false)
  const dirtyRef = useRef(false)
  const [editingVersionId, setEditingVersionId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const tosVersions = useRoadmapStore(state => state.tosVersions)
  const setTosVersionDetails = useRoadmapStore(state => state.setTosVersionDetails)
  const deleteTosVersionDetails = useRoadmapStore(state => state.deleteTosVersionDetails)

  const historicalValues = useMemo(
    () => tosVersions.map(version => version.id),
    [tosVersions],
  )
  const options = useSingleEnumOptions('roadmap-tos', historicalValues, open)
  const { hasHydrated, hydrationError, retryHydration } = useEnumHydration(open)

  const descendingVersions = useMemo(
    () => [...tosVersions].sort((left, right) => compareSemanticTos(right, left)),
    [tosVersions],
  )
  const referenceCounts = useMemo(() => {
    const counts = new Map<string, { normal: number; planned: number; total: number }>()
    for (const version of tosVersions) {
      const normal = new Set(normalProjects
        .filter(project => resolveProjectVersion(project) === version.id)
        .map(project => project.id)).size
      const planned = new Set(plannedProjects
        .filter(project => normalizeTosSnapshot(project.firstSaleTosVersionId) === version.id)
        .map(project => project.id)).size
      counts.set(version.id, { normal, planned, total: normal + planned })
    }
    return counts
  }, [normalProjects, plannedProjects, tosVersions])

  useEffect(() => {
    if (!open) return
    setEditingVersionId(null)
    dirtyRef.current = false
    form.resetFields()
  }, [form, open])

  const resetInlineForm = () => {
    dirtyRef.current = false
    setEditingVersionId(null)
    form.resetFields()
  }
  const confirmDiscard = (next: () => void) => {
    if (!dirtyRef.current || !form.isFieldsTouched()) {
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
  const requestClose = () => confirmDiscard(() => {
    resetInlineForm()
    onCancel()
  })
  const beginEdit = (version: TosVersionConfig | null) => {
    setEditingVersionId(version?.id ?? CREATE_VERSION_ID)
    form.resetFields()
    form.setFieldsValue(version ? {
      name: version.id,
      period: version.periodStartDate && version.periodEndDate
        ? [dayjs(version.periodStartDate), dayjs(version.periodEndDate)]
        : undefined,
      targetText: version.targets.join('\n'),
    } : { name: '', period: undefined, targetText: '' })
    dirtyRef.current = false
  }
  const requestEdit = (version: TosVersionConfig | null) => {
    const nextId = version?.id ?? CREATE_VERSION_ID
    if (nextId === editingVersionId) return
    confirmDiscard(() => beginEdit(version))
  }

  const editingReferenceCount = editingVersionId && editingVersionId !== CREATE_VERSION_ID
    ? referenceCounts.get(editingVersionId)?.total ?? 0
    : 0
  const selectableOptions = options.map(option => ({
    ...option,
    disabled: option.disabled || (
      tosVersions.some(version => version.id === option.value)
      && option.value !== editingVersionId
    ),
  }))

  const handleSubmit = async () => {
    if (submitLockRef.current) return
    submitLockRef.current = true
    try {
      const enumState = useEnumStore.getState()
      if (!canEdit || !enumState.hasHydrated || enumState.hydrationError) {
        message.error(enumState.hydrationError || '枚举配置正在加载，请稍后重试')
        return
      }
      let values: TosVersionFormValues
      try {
        values = await form.validateFields()
      } catch {
        return
      }
      const versionId = normalizeTosSnapshot(values.name)
      const periodStartDate = values.period?.[0]?.format('YYYY-MM-DD') ?? ''
      const periodEndDate = values.period?.[1]?.format('YYYY-MM-DD') ?? ''
      const targetText = values.targetText?.trim() ?? ''
      setSubmitting(true)
      const result = setTosVersionDetails(
        editingVersionId === CREATE_VERSION_ID ? null : editingVersionId,
        {
          versionId,
          periodStartDate,
          periodEndDate,
          targets: targetText ? [targetText] : [],
        },
      )
      if (!result.ok) {
        if (result.reason === 'duplicate') {
          form.setFields([{ name: 'name', errors: ['该版本已维护，请选择其他版本'] }])
        } else if (result.reason === 'invalid') {
          const versionError = result.errors.versionId
          if (versionError) form.setFields([{ name: 'name', errors: [versionError] }])
          else message.error(result.errors.periodStartDate ?? result.errors.periodEndDate ?? '保存失败，请检查输入')
        } else {
          message.error('版本维护记录不存在，请刷新后重试')
        }
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

  const handleDelete = (version: TosVersionConfig) => {
    const count = referenceCounts.get(version.id)?.total ?? 0
    if (!canEdit || count > 0) return
    Modal.confirm({
      title: `删除 ${formatTosSnapshot(version.id)} 的路标维护信息？`,
      content: '仅删除路标中的周期和版本目标，不会删除配置中心的枚举值。',
      okText: '确认删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => {
        const result = deleteTosVersionDetails(version.id)
        if (!result.ok) {
          message.error('版本维护记录不存在，请刷新后重试')
          return Promise.reject(new Error('tos-version-details-delete-failed'))
        }
        if (editingVersionId === version.id) resetInlineForm()
        message.success('tOS 版本维护信息已删除')
        onChanged?.()
      },
    })
  }

  const renderEditingCard = () => (
    <Card
      size="small"
      title={editingVersionId === CREATE_VERSION_ID ? '新增版本维护' : '编辑版本维护'}
      style={{ ...versionCardStyle, width: '100%' }}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        onValuesChange={() => { dirtyRef.current = true }}
      >
        <Flex gap={12} wrap>
          <Form.Item
            label="tOS 版本"
            name="name"
            rules={[{ required: true, message: '请选择 tOS 版本' }]}
            style={{ flex: '1 1 220px', marginBottom: 12 }}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="从 tOS版本-路标中选择"
              options={selectableOptions}
              loading={!hasHydrated}
              disabled={editingReferenceCount > 0}
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
        {editingReferenceCount > 0 ? (
          <Alert type="info" showIcon message="该版本已被项目引用，编辑时不可更换版本号。" style={{ marginBottom: 12 }} />
        ) : null}
        <Form.Item
          label="版本目标"
          name="targetText"
          rules={[{ max: 4000, message: '版本目标不能超过 4000 个字符' }]}
          style={{ marginBottom: 12 }}
        >
          <Input.TextArea rows={5} maxLength={4000} showCount placeholder="请输入版本目标，可自由换行" />
        </Form.Item>
        <Flex justify="flex-end" gap={8}>
          <Button onClick={() => confirmDiscard(resetInlineForm)}>取消</Button>
          <Button type="primary" htmlType="submit" loading={submitting} disabled={submitting}>保存</Button>
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
      {!hasHydrated ? <Skeleton active paragraph={{ rows: 4 }} /> : hydrationError ? (
        <Alert
          type="error"
          showIcon
          message="加载 tOS 版本枚举失败"
          action={<Button size="small" onClick={() => void retryHydration()}>重试</Button>}
        />
      ) : (
        <Flex vertical gap={16}>
          {canEdit ? <Flex justify="flex-end"><Button type="primary" onClick={() => requestEdit(null)}>新增版本</Button></Flex> : null}
          {editingVersionId === CREATE_VERSION_ID ? renderEditingCard() : null}
          <List
            aria-label="tOS 版本列表"
            dataSource={descendingVersions}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无版本维护信息" /> }}
            renderItem={version => {
              const counts = referenceCounts.get(version.id) ?? { normal: 0, planned: 0, total: 0 }
              return (
                <List.Item style={{ paddingInline: 0 }}>
                  {editingVersionId === version.id ? renderEditingCard() : (
                    <Card size="small" style={{ ...versionCardStyle, width: '100%' }}>
                      <Flex justify="space-between" align="center" gap={16} wrap>
                        <Flex vertical gap={4} style={{ minWidth: 0, flex: 1 }}>
                          <Typography.Text strong>{formatTosSnapshot(version.id)}</Typography.Text>
                          <Typography.Text type="secondary">
                            项目周期：{version.periodStartDate && version.periodEndDate
                              ? `${version.periodStartDate} 至 ${version.periodEndDate}`
                              : '未设置'}
                          </Typography.Text>
                          <Typography.Text type="secondary" ellipsis={{ tooltip: version.targets.join('\n') }}>
                            版本目标：{version.targets.length ? version.targets.join('；') : '未设置'}
                          </Typography.Text>
                          <Tooltip title={`正常项目 ${counts.normal} 个，待规划项目 ${counts.planned} 个`}>
                            <Typography.Text type="secondary">引用 {counts.total} 个项目</Typography.Text>
                          </Tooltip>
                        </Flex>
                        {canEdit ? (
                          <Flex gap={8}>
                            <Button onClick={() => requestEdit(version)}>编辑</Button>
                            <Tooltip title={counts.total ? `已被 ${counts.total} 个项目引用，无法删除` : undefined}>
                              <Button danger disabled={counts.total > 0} onClick={() => handleDelete(version)}>删除</Button>
                            </Tooltip>
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
      )}
    </Modal>
  )
}
