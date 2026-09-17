'use client'

import { useEffect, useRef, useState } from 'react'
import type { HTMLAttributes } from 'react'
import {
  App,
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import { CheckCircleOutlined, DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined, StopOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  ENUM_DEFINITIONS,
  filterEnumRows,
  formatEnumCellValue,
  getEnumRowSummary,
} from '@/lib/enumValues'
import { useEnumStore } from '@/stores/enums'
import { useHasGlobalPermission } from '@/stores/permission'
import type {
  EnumActionResult,
  EnumFieldErrors,
  EnumFieldKey,
  EnumRow,
  EnumRowDraft,
  EnumTypeKey,
} from '@/types/enums'
import { useOverlayInteraction } from '@/hooks/useOverlayInteraction'

type ModalMode = 'add' | 'edit'
type DraftValues = Partial<Record<EnumFieldKey, string>>

interface EnumConfigProps {
  currentLoginUser: string
}

const PROJECT_CATEGORY_OPTIONS = [
  '整机产品项目',
  'tOS版本项目',
  '技术项目',
  '能力建设项目',
] as const

function emptyDraft(type: EnumTypeKey): DraftValues {
  return Object.fromEntries(ENUM_DEFINITIONS[type].columns.map(column => [column.key, '']))
}

function rowDraft(type: EnumTypeKey, row: EnumRow): DraftValues {
  const values = row as unknown as Record<string, string>
  return Object.fromEntries(
    ENUM_DEFINITIONS[type].columns.map(column => [column.key, values[column.key] ?? '']),
  )
}

function resultMessage(result: EnumActionResult): string {
  if (result.ok) return ''
  if (result.reason === 'duplicate') return '配置值已存在，请检查标红字段后再试'
  if (result.reason === 'missing') return '该配置项已不存在，请刷新后重试'
  if (result.reason === 'storage') return '本地存储写入失败，配置未保存，请恢复存储后重试'
  return '请完善标红的必填项'
}

export default function EnumConfig({
  currentLoginUser,
}: EnumConfigProps) {
  const { message, modal } = App.useApp()
  const rowsByType = useEnumStore(state => state.rowsByType)
  const selectedType = useEnumStore(state => state.selectedType)
  const addEnumRow = useEnumStore(state => state.addEnumRow)
  const updateEnumRow = useEnumStore(state => state.updateEnumRow)
  const setEnumRowEnabled = useEnumStore(state => state.setEnumRowEnabled)
  const deleteEnumRow = useEnumStore(state => state.deleteEnumRow)
  const hasHydrated = useEnumStore(state => state.hasHydrated)
  const hydrationError = useEnumStore(state => state.hydrationError)
  const hydrateEnumStore = useEnumStore(state => state.hydrateEnumStore)
  const resetLocalConfig = useEnumStore(state => state.resetLocalConfig)
  const hasGlobalPermission = useHasGlobalPermission(currentLoginUser)
  const canEditEnums = hasGlobalPermission('configCenter:enumEdit')
  const canEditRef = useRef(canEditEnums)
  canEditRef.current = canEditEnums
  const editorTriggerRef = useRef<HTMLElement | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editorType, setEditorType] = useState<EnumTypeKey | null>(null)
  const [modalMode, setModalMode] = useState<ModalMode>('add')
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [draft, setDraft] = useState<DraftValues>(() => emptyDraft('first-sale-tos'))
  const [fieldErrors, setFieldErrors] = useState<EnumFieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [recoveryAction, setRecoveryAction] = useState<'retry' | 'reset' | null>(null)
  const [storageWriteContext, setStorageWriteContext] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [filterState, setFilterState] = useState<{ type: EnumTypeKey; values: DraftValues; status?: 'all' | 'enabled' | 'disabled' }>({
    type: selectedType,
    values: {},
  })
  const { captureTrigger, restoreTriggerFocus, tryBeginSubmit, releaseSubmission } = useOverlayInteraction()

  useEffect(() => {
    if (!hasHydrated) void hydrateEnumStore()
  }, [hasHydrated, hydrateEnumStore])

  const selectedDefinition = ENUM_DEFINITIONS[selectedType]
  const editorDefinition = editorType ? ENUM_DEFINITIONS[editorType] : null
  const rows = rowsByType[selectedType] as EnumRow[]
  const filterValues = filterState.type === selectedType ? filterState.values : {}
  const filterStatus = filterState.type === selectedType ? filterState.status ?? 'all' : 'all'
  const hasActiveFilters = filterStatus !== 'all' || Object.values(filterValues).some(value => value?.trim())
  const filteredRows = filterEnumRows(selectedType, rows, filterValues, filterStatus)

  useEffect(() => {
    setFilterState({ type: selectedType, values: {} })
  }, [selectedType])

  const setDraftField = (field: EnumFieldKey, value: string) => {
    setDraft(previous => ({ ...previous, [field]: value }))
    setFieldErrors(previous => {
      if (!previous[field]) return previous
      const next = { ...previous }
      delete next[field]
      return next
    })
  }

  const safeFocusFallback = (type: EnumTypeKey): HTMLElement | null => {
    const addButton = document.querySelector<HTMLElement>('[data-testid="enum-add-button"]')
    if (addButton) return addButton
    try {
      if (typeof CSS === 'undefined' || typeof CSS.escape !== 'function') return null
      return document.querySelector<HTMLElement>(`[data-testid="enum-type-${CSS.escape(type)}"]`)
        ?.closest<HTMLElement>('[role="menuitem"]') ?? null
    } catch {
      return null
    }
  }

  const restoreEnumTriggerFocus = (fallbackType = selectedType) => {
    const trigger = editorTriggerRef.current
    editorTriggerRef.current = null
    restoreTriggerFocus(() => (
      trigger?.isConnected ? trigger : safeFocusFallback(fallbackType)
    ))
  }

  const clearModal = () => {
    setModalOpen(false)
    setDraft(emptyDraft(selectedType))
    setEditorType(null)
    setEditingRowId(null)
    setFieldErrors({})
    setSubmitting(false)
  }

  const closeModal = () => {
    clearModal()
    releaseSubmission()
    restoreEnumTriggerFocus()
  }

  useEffect(() => {
    canEditRef.current = canEditEnums
    if (!canEditEnums && modalOpen) {
      message.warning('当前用户无权限编辑枚举值')
      setModalOpen(false)
      setDraft(emptyDraft(selectedType))
      setEditorType(null)
      setEditingRowId(null)
      setFieldErrors({})
      setSubmitting(false)
      releaseSubmission()
      restoreEnumTriggerFocus()
    }
  }, [canEditEnums, modalOpen, releaseSubmission, selectedType])

  const openAddModal = (trigger: HTMLElement) => {
    if (!canEditEnums) return
    captureTrigger(trigger)
    editorTriggerRef.current = trigger
    setEditorType(selectedType)
    setModalMode('add')
    setEditingRowId(null)
    setDraft(emptyDraft(selectedType))
    setFieldErrors({})
    setModalOpen(true)
  }

  const openEditModal = (row: EnumRow, trigger: HTMLElement) => {
    if (!canEditEnums) return
    captureTrigger(trigger)
    editorTriggerRef.current = trigger
    setEditorType(selectedType)
    setModalMode('edit')
    setEditingRowId(row.id)
    setDraft(rowDraft(selectedType, row))
    setFieldErrors({})
    setModalOpen(true)
  }

  const submit = () => {
    if (!tryBeginSubmit()) return
    if (!editorType || !editorDefinition) {
      releaseSubmission()
      return
    }
    setSubmitting(true)
    setFieldErrors({})
    setSaveError(null)
    const storeDraft = Object.fromEntries(
      editorDefinition.columns.map(column => [column.key, draft[column.key] ?? '']),
    ) as EnumRowDraft
    if (!canEditRef.current) {
      message.warning('当前用户无权限编辑枚举值')
      clearModal()
      releaseSubmission()
      restoreEnumTriggerFocus(editorType)
      return
    }
    const result = modalMode === 'add'
      ? addEnumRow(editorType, storeDraft)
      : updateEnumRow(editorType, editingRowId ?? '', storeDraft)

    if (!result.ok) {
      setFieldErrors(result.fieldErrors ?? {})
      const errorMessage = resultMessage(result)
      if (result.reason === 'storage') {
        setStorageWriteContext(true)
        setSaveError(errorMessage)
        message.error(`保存枚举值失败：${errorMessage}`)
      } else {
        message.error(errorMessage)
      }
      setSubmitting(false)
      releaseSubmission()
      return
    }

    setSaveError(null)
    message.success(modalMode === 'add' ? '配置值已新增' : '配置值已更新')
    clearModal()
    restoreEnumTriggerFocus()
    // Keep the synchronous guard closed through this event-loop turn even
    // though closing the modal clears its visual loading state.
    releaseSubmission(true)
  }

  const confirmDelete = (row: EnumRow, trigger: HTMLElement) => {
    if (!canEditEnums) return
    captureTrigger(trigger)
    const deleteType = selectedType
    const summary = getEnumRowSummary(deleteType, row)
    modal.confirm({
      centered: true,
      title: '删除配置值？',
      content: `确认删除“${summary}”吗？删除后无法恢复。`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => {
        if (!canEditRef.current) {
          message.warning('当前用户无权限编辑枚举值')
          restoreTriggerFocus(() => (
            trigger.isConnected ? trigger : safeFocusFallback(deleteType)
          ))
          return undefined
        }
        const result = deleteEnumRow(deleteType, row.id)
        if (!result.ok) {
          const errorMessage = resultMessage(result)
          if (result.reason === 'storage') {
            setStorageWriteContext(true)
            setSaveError(errorMessage)
            message.error(`保存枚举值失败：${errorMessage}`)
          } else {
            message.error(errorMessage)
          }
          return Promise.reject(new Error(result.reason))
        }
        setSaveError(null)
        message.success('配置值已删除')
        restoreTriggerFocus(() => (
          trigger.isConnected ? trigger : safeFocusFallback(deleteType)
        ))
        return undefined
      },
      onCancel: () => restoreTriggerFocus(() => (
        trigger.isConnected ? trigger : safeFocusFallback(deleteType)
      )),
    })
  }

  const confirmToggleRowEnabled = (row: EnumRow, trigger: HTMLElement) => {
    if (!canEditRef.current) return
    captureTrigger(trigger)
    const toggleType = selectedType
    const enabled = row.enabled === false
    const action = enabled ? '启用' : '禁用'
    const summary = getEnumRowSummary(toggleType, row)
    modal.confirm({
      centered: true,
      title: `${action}配置值？`,
      content: `确认${action}“${summary}”吗？${enabled
        ? '启用后，填写表单时可选择此配置值。'
        : '禁用后，填写表单时无法重新选择此配置值，已有数据和筛选不受影响。'}`,
      okText: `确认${action}`,
      okButtonProps: { danger: !enabled },
      cancelText: '取消',
      onOk: () => {
        if (!canEditRef.current) {
          message.warning('当前用户无权限编辑枚举值')
          return
        }
        const result = setEnumRowEnabled(toggleType, row.id, enabled)
        if (!result.ok) {
          const errorMessage = resultMessage(result)
          if (result.reason === 'storage') {
            setStorageWriteContext(true)
            setSaveError(errorMessage)
          }
          message.error(errorMessage)
          return Promise.reject(new Error(result.reason))
        }
        setSaveError(null)
        message.success(`配置值已${action}`)
      },
      afterClose: () => restoreTriggerFocus(() => (
        trigger.isConnected ? trigger : safeFocusFallback(toggleType)
      )),
    })
  }

  const handleRetry = async () => {
    setRecoveryAction('retry')
    const hydrated = await hydrateEnumStore()
    if (hydrated) {
      setStorageWriteContext(false)
      setSaveError(null)
    }
    setRecoveryAction(null)
  }

  const handleReset = async () => {
    setRecoveryAction('reset')
    const reset = await resetLocalConfig()
    if (reset) {
      setStorageWriteContext(false)
      setSaveError(null)
      message.success('本地枚举配置已重置')
    } else message.error('本地枚举配置重置失败')
    setRecoveryAction(null)
  }

  const saveErrorAlert = saveError ? (
    <Alert
      className="pms-enum-save-error"
      type="error"
      showIcon
      title="保存枚举值失败"
      description={saveError}
      action={(
        <Space size={6} wrap>
          <Button size="small" loading={recoveryAction === 'retry'} onClick={handleRetry}>
            重试存储
          </Button>
          <Button size="small" danger loading={recoveryAction === 'reset'} onClick={handleReset}>
            重置本地配置
          </Button>
        </Space>
      )}
    />
  ) : null

  const businessColumns: ColumnsType<EnumRow> = selectedDefinition.columns.map(column => ({
    title: column.label,
    dataIndex: column.key,
    key: column.key,
    ellipsis: true,
    render: (value: string) => (
      <Typography.Text>{formatEnumCellValue(selectedType, column.key, value ?? '')}</Typography.Text>
    ),
  }))
  const columns: ColumnsType<EnumRow> = [
    {
      title: '序号',
      key: 'sequence',
      width: 72,
      align: 'center',
      render: (_value, _row, index) => index + 1,
      className: 'pms-enum-sequence',
    },
    ...businessColumns,
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_value, row) => <Tag color={row.enabled === false ? 'default' : 'success'}>{row.enabled === false ? '禁用' : '启用'}</Tag>,
    },
    ...(canEditEnums ? [{
      title: '操作',
      key: 'actions',
      width: 136,
      fixed: 'right' as const,
      align: 'right' as const,
      render: (_value: unknown, row: EnumRow) => {
        const summary = getEnumRowSummary(selectedType, row)
        return (
          <div className="pms-enum-actions">
            <Tooltip title={row.enabled === false ? '启用配置值' : '禁用配置值'}>
              <Button
                type="text"
                aria-label={`${row.enabled === false ? '启用' : '禁用'}配置值 ${summary}`}
                data-testid={`enum-toggle-${row.id}`}
                icon={row.enabled === false ? <CheckCircleOutlined /> : <StopOutlined />}
                onClick={event => confirmToggleRowEnabled(row, event.currentTarget)}
              />
            </Tooltip>
            <Tooltip title="编辑配置值">
              <Button
                aria-label={`编辑配置值 ${summary}`}
                data-testid={`enum-edit-${row.id}`}
                type="text"
                icon={<EditOutlined />}
                onClick={event => openEditModal(row, event.currentTarget)}
              />
            </Tooltip>
            <Tooltip title="删除配置值">
              <Button
                aria-label={`删除配置值 ${summary}`}
                data-testid={`enum-delete-${row.id}`}
                danger
                type="text"
                icon={<DeleteOutlined />}
                onClick={event => confirmDelete(row, event.currentTarget)}
              />
            </Tooltip>
          </div>
        )
      },
    }] : []),
  ]

  const fieldItem = (field: EnumFieldKey, label: string, required = true, disabled = false) => (
    <Form.Item
      key={field}
      label={label}
      required={required}
      validateStatus={fieldErrors[field] ? 'error' : undefined}
      help={fieldErrors[field]}
    >
      <Input
        value={draft[field] ?? ''}
        disabled={disabled}
        aria-label={label}
        aria-invalid={Boolean(fieldErrors[field])}
        onChange={event => setDraftField(field, event.target.value)}
      />
    </Form.Item>
  )

  const renderDraftFields = () => {
    if (!editorDefinition) return null
    if (editorDefinition.kind === 'single') {
      return fieldItem('value', editorDefinition.label)
    }
    if (editorDefinition.kind === 'package-map') {
      const androidValues = rowsByType['android-version']
        .filter(row => row.enabled !== false)
        .map(row => row.value.trim())
        .filter(Boolean)
      const chipModels = [...new Set(rowsByType['chip-mapping']
        .filter(row => row.enabled !== false)
        .map(row => row.chipModel.trim())
        .filter(Boolean))]
      const androidOptions: Array<{ value: string; label: string; disabled?: boolean }> = androidValues
        .map(value => ({ value, label: value }))
      const chipModelOptions: Array<{ value: string; label: string; disabled?: boolean }> = chipModels
        .map(value => ({ value, label: value }))
      const historicalAndroid = draft.androidVersion?.trim() ?? ''
      const historicalChipModel = draft.chipModel?.trim() ?? ''
      if (modalMode === 'edit' && historicalAndroid && !androidValues.includes(historicalAndroid)) {
        androidOptions.push({ disabled: true, value: historicalAndroid, label: `${historicalAndroid}（已停用）` })
      }
      if (modalMode === 'edit' && historicalChipModel && !chipModels.includes(historicalChipModel)) {
        chipModelOptions.push({ disabled: true, value: historicalChipModel, label: `${historicalChipModel}（已停用）` })
      }
      return (
        <>
          <Form.Item
            label="安卓版本"
            required
            validateStatus={fieldErrors.androidVersion ? 'error' : undefined}
            help={fieldErrors.androidVersion}
          >
            <Select
              showSearch
              optionFilterProp="label"
              value={draft.androidVersion || undefined}
              aria-label="安卓版本"
              aria-invalid={Boolean(fieldErrors.androidVersion)}
              placeholder="请选择安卓版本"
              options={androidOptions}
              onChange={value => setDraftField('androidVersion', value)}
            />
          </Form.Item>
          <Form.Item
            label="芯片型号"
            required
            validateStatus={fieldErrors.chipModel ? 'error' : undefined}
            help={fieldErrors.chipModel}
          >
            <Select
              showSearch
              optionFilterProp="label"
              value={draft.chipModel || undefined}
              aria-label="芯片型号"
              aria-invalid={Boolean(fieldErrors.chipModel)}
              placeholder="请选择芯片型号"
              options={chipModelOptions}
              onChange={value => setDraftField('chipModel', value)}
            />
          </Form.Item>
          {fieldItem('packageMode', '组包方式')}
        </>
      )
    }
    if (editorDefinition.kind === 'chip-map') {
      return (
        <>
          {fieldItem('chipCode', '芯片编码')}
          {fieldItem('chipModel', '芯片型号')}
          {fieldItem('chipPlatform', '芯片平台')}
        </>
      )
    }
    if (editorDefinition.kind === 'project-category-map') {
      const isWholeMachine = draft.pmsProjectCategory === '整机产品项目'
      return (
        <>
          {fieldItem('ipmProjectCategory', 'IPM项目分类')}
          <Form.Item
            label="PMS项目分类"
            required
            validateStatus={fieldErrors.pmsProjectCategory ? 'error' : undefined}
            help={fieldErrors.pmsProjectCategory}
          >
            <Select
              value={draft.pmsProjectCategory || undefined}
              aria-label="PMS项目分类"
              placeholder="请选择PMS项目分类"
              options={PROJECT_CATEGORY_OPTIONS.map(value => ({ value, label: value }))}
              onChange={value => {
                setDraft(previous => ({
                  ...previous,
                  pmsProjectCategory: value,
                  pmsSecondaryCategory: value === '整机产品项目' ? previous.pmsSecondaryCategory ?? '' : '',
                }))
                setFieldErrors(previous => ({
                  ...previous,
                  pmsProjectCategory: undefined,
                  pmsSecondaryCategory: undefined,
                }))
              }}
            />
          </Form.Item>
          {fieldItem('pmsSecondaryCategory', 'PMS二级项目分类', isWholeMachine, draft.pmsProjectCategory !== '整机产品项目')}
        </>
      )
    }
    return (
      <>
        {fieldItem('domain', 'TMG及技术领域')}
        {fieldItem('subdomain', '子领域')}
      </>
    )
  }

  const editorModal = (
    <Modal
      title={editorDefinition
        ? `${modalMode === 'add' ? '新增' : '编辑'}${editorDefinition.label}`
        : ''}
      open={modalOpen}
      okText={modalMode === 'add' ? '新增' : '保存'}
      cancelText="取消"
      confirmLoading={submitting}
      closable={!submitting}
      mask={{ closable: !submitting }}
      keyboard={!submitting}
      onOk={submit}
      onCancel={submitting ? undefined : closeModal}
      destroyOnHidden
    >
      {saveErrorAlert}
      <Form className="pms-enum-form" layout="vertical" requiredMark="optional">
        {renderDraftFields()}
      </Form>
    </Modal>
  )

  if (!hasHydrated) {
    return (
      <Card className="pms-enum-loading" aria-live="polite">
        <Typography.Text type="secondary">正在加载枚举配置…</Typography.Text>
        <Skeleton active paragraph={{ rows: 6 }} />
      </Card>
    )
  }

  if (hydrationError && !storageWriteContext) {
    return (
      <>
        <Alert
          type="error"
          showIcon
          title="加载枚举值失败"
          description={(
            <Space orientation="vertical" size={10}>
              <span>{hydrationError}</span>
              <Space wrap>
                <Button size="small" loading={recoveryAction === 'retry'} onClick={handleRetry}>
                  重试
                </Button>
                <Button size="small" danger loading={recoveryAction === 'reset'} onClick={handleReset}>
                  重置本地配置
                </Button>
              </Space>
            </Space>
          )}
        />
        {editorModal}
      </>
    )
  }

  return (
    <>
          <Card className="pms-enum-values-card pms-config-workspace-card pms-solid-surface">
            {saveErrorAlert}
            <div className="pms-enum-table-header">
              <div className="pms-enum-table-heading">
                <Typography.Title level={4}>{selectedDefinition.label}</Typography.Title>
              </div>
              {canEditEnums && (
                <Button
                  data-testid="enum-add-button"
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={event => openAddModal(event.currentTarget)}
                >
                  新增枚举值
                </Button>
              )}
            </div>
            <div className="pms-enum-filters" role="search" aria-label="枚举值筛选">
              {selectedDefinition.columns.map(column => (
                <div className="pms-enum-filter-field" key={column.key}>
                  <label htmlFor={`enum-filter-${selectedType}-${column.key}`}>{column.label}</label>
                  <Input
                    id={`enum-filter-${selectedType}-${column.key}`}
                    aria-label={`筛选-${column.label}`}
                    prefix={<SearchOutlined />}
                    placeholder="请输入关键词"
                    allowClear
                    value={filterValues[column.key] ?? ''}
                    onChange={event => setFilterState({
                      type: selectedType,
                      status: filterStatus,
                      values: { ...filterValues, [column.key]: event.target.value },
                    })}
                  />
                </div>
              ))}
              <div className="pms-enum-filter-field">
                <label htmlFor="enum-filter-status">状态</label>
                <Select
                  id="enum-filter-status"
                  aria-label="筛选-状态"
                  value={filterStatus}
                  style={{ minWidth: 120 }}
                  options={[{ value: 'all', label: '全部' }, { value: 'enabled', label: '启用' }, { value: 'disabled', label: '禁用' }]}
                  onChange={status => setFilterState({ type: selectedType, values: filterValues, status })}
                />
              </div>
              <Button
                disabled={!hasActiveFilters}
                onClick={() => setFilterState({ type: selectedType, values: {} })}
              >清空筛选</Button>
            </div>
            <Table
              className="pms-table pms-enum-table"
              rowKey="id"
              columns={columns}
              dataSource={filteredRows}
              pagination={false}
              size="middle"
              scroll={{ x: 'max-content' }}
              onRow={row => ({ 'data-testid': `enum-row-${row.id}` } as HTMLAttributes<HTMLTableRowElement>)}
              locale={{
                emptyText: (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={hasActiveFilters ? '暂无匹配的配置值' : '暂无配置值'}>
                    {hasActiveFilters ? (
                      <Button type="link" onClick={() => setFilterState({ type: selectedType, values: {} })}>
                        清空筛选
                      </Button>
                    ) : canEditEnums && (
                      <Button type="link" icon={<PlusOutlined />} onClick={event => openAddModal(event.currentTarget)}>
                        新增枚举值
                      </Button>
                    )}
                  </Empty>
                ),
              }}
            />
          </Card>
      {editorModal}
    </>
  )
}
