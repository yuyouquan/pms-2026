'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Skeleton,
  Space,
  Table,
  Tooltip,
  Typography,
  message,
} from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  NumberOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { normalizeEnumValue, TOS_ENUM_REGISTRY, TOS_ENUM_TYPE_KEYS } from '@/lib/enumValues'
import { useEnumStore } from '@/stores/enums'
import type { EnumActionResult, EnumTypeKey } from '@/types/enums'
import { useOverlayInteraction } from '@/hooks/useOverlayInteraction'

type ModalMode = 'add' | 'edit'

const FORMAT_HINT: Record<EnumTypeKey, string> = {
  'tos-2-part': '格式要求：数字.数字，例如 18.0',
  'tos-3-part': '格式要求：数字.数字.数字，例如 18.0.1',
}

function resultMessage(result: EnumActionResult): string {
  if (result.ok) return ''
  if (result.reason === 'duplicate') return '该枚举值已存在，请勿重复添加'
  if (result.reason === 'missing') return '原枚举值已不存在，请刷新后重试'
  if (result.reason === 'storage') return '本地存储写入失败，配置未保存，请恢复存储后重试'
  return '格式不正确，请按当前枚举类型的格式输入'
}

export default function EnumConfig() {
  const valuesByType = useEnumStore(state => state.valuesByType)
  const selectedType = useEnumStore(state => state.selectedType)
  const setSelectedType = useEnumStore(state => state.setSelectedType)
  const addEnumValue = useEnumStore(state => state.addEnumValue)
  const updateEnumValue = useEnumStore(state => state.updateEnumValue)
  const deleteEnumValue = useEnumStore(state => state.deleteEnumValue)
  const hasHydrated = useEnumStore(state => state.hasHydrated)
  const hydrationError = useEnumStore(state => state.hydrationError)
  const hydrateEnumStore = useEnumStore(state => state.hydrateEnumStore)
  const resetLocalConfig = useEnumStore(state => state.resetLocalConfig)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<ModalMode>('add')
  const [editingValue, setEditingValue] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [recoveryAction, setRecoveryAction] = useState<'retry' | 'reset' | null>(null)
  const updatedValueFocusRef = useRef<string | null>(null)
  const { captureTrigger, restoreTriggerFocus, tryBeginSubmit, releaseSubmission } = useOverlayInteraction()

  useEffect(() => {
    if (!hasHydrated) void hydrateEnumStore()
  }, [hasHydrated, hydrateEnumStore])

  const selectedDefinition = TOS_ENUM_REGISTRY[selectedType]
  const rows = useMemo(
    () => valuesByType[selectedType].map(value => ({ key: value, value })),
    [selectedType, valuesByType],
  )

  const restoreEnumTriggerFocus = () => {
    restoreTriggerFocus(() => {
      const updatedValue = updatedValueFocusRef.current
      updatedValueFocusRef.current = null
      const updatedEditButton = updatedValue
        ? Array.from(document.querySelectorAll<HTMLButtonElement>('[data-enum-edit-value]'))
          .find(button => button.dataset.enumEditValue === updatedValue)
        : null
      const addButton = document.querySelector<HTMLButtonElement>('[data-enum-add-value]')
      return updatedEditButton ?? (updatedValue ? addButton : undefined)
    })
  }

  const closeModal = () => {
    setModalOpen(false)
    setDraft('')
    setEditingValue(null)
    setFieldError('')
    setSubmitting(false)
    releaseSubmission()
    restoreEnumTriggerFocus()
  }

  const openAddModal = (trigger: HTMLElement) => {
    captureTrigger(trigger)
    setModalMode('add')
    setEditingValue(null)
    setDraft('')
    setFieldError('')
    setModalOpen(true)
  }

  const openEditModal = (value: string, trigger: HTMLElement) => {
    captureTrigger(trigger)
    setModalMode('edit')
    setEditingValue(value)
    setDraft(value)
    setFieldError('')
    setModalOpen(true)
  }

  const submit = () => {
    if (!tryBeginSubmit()) return
    setSubmitting(true)
    const result = modalMode === 'add'
      ? addEnumValue(selectedType, draft)
      : updateEnumValue(selectedType, editingValue ?? '', draft)

    if (!result.ok) {
      if (result.reason === 'storage') message.error(resultMessage(result))
      setFieldError(resultMessage(result))
      setSubmitting(false)
      releaseSubmission()
      return
    }

    if (modalMode === 'edit') updatedValueFocusRef.current = normalizeEnumValue(draft)
    message.success(modalMode === 'add' ? '枚举值已新增' : '枚举值已更新')
    closeModal()
    // Keep the synchronous guard closed through this event-loop turn even
    // though closing the modal clears its visual loading state.
    tryBeginSubmit()
    releaseSubmission(true)
  }

  const handleDelete = (value: string) => {
    const result = deleteEnumValue(selectedType, value)
    if (result.ok) message.success('枚举值已删除')
    else message.error(resultMessage(result))
  }

  const handleRetry = async () => {
    setRecoveryAction('retry')
    await hydrateEnumStore()
    setRecoveryAction(null)
  }

  const handleReset = async () => {
    setRecoveryAction('reset')
    const reset = await resetLocalConfig()
    if (reset) message.success('本地枚举配置已重置')
    else message.error('本地枚举配置重置失败')
    setRecoveryAction(null)
  }

  const columns: ColumnsType<{ key: string; value: string }> = [
    {
      title: '枚举值',
      dataIndex: 'value',
      key: 'value',
      render: value => <Typography.Text strong>{value}</Typography.Text>,
    },
    {
      title: '显示预览',
      dataIndex: 'value',
      key: 'preview',
      render: value => <span className="pms-enum-preview">tOS{value}</span>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 112,
      align: 'right',
      render: (_, record) => (
        <div className="pms-enum-actions">
          <Tooltip title="编辑枚举值">
            <Button
              aria-label={`编辑枚举值 ${record.value}`}
              data-enum-edit-value={record.value}
              type="text"
              icon={<EditOutlined />}
              onClick={event => {
                openEditModal(record.value, event.currentTarget)
              }}
            />
          </Tooltip>
          <Popconfirm
            title="删除枚举值？"
            description="删除后，历史已保存字符串不受影响；后续选择将不再包含此值。"
            okText="删除"
            okButtonProps={{ danger: true }}
            cancelText="取消"
            onConfirm={() => handleDelete(record.value)}
          >
            <Tooltip title="删除枚举值">
              <Button
                aria-label={`删除枚举值 ${record.value}`}
                danger
                type="text"
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </div>
      ),
    },
  ]

  if (!hasHydrated) {
    return (
      <Card className="pms-enum-loading" aria-live="polite">
        <Typography.Text type="secondary">正在加载枚举值…</Typography.Text>
        <Skeleton active paragraph={{ rows: 4 }} />
      </Card>
    )
  }

  if (hydrationError) {
    return (
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
    )
  }

  return (
    <section className="pms-enum-config" aria-label="枚举值配置">
      <Card className="pms-enum-type-card" title="枚举类型">
        <div className="pms-enum-type-list" role="list" aria-label="固定枚举类型">
          {TOS_ENUM_TYPE_KEYS.map(type => {
            const definition = TOS_ENUM_REGISTRY[type]
            const active = selectedType === type
            return (
              <button
                key={type}
                type="button"
                className={`pms-enum-type-item${active ? ' is-active' : ''}`}
                aria-pressed={active}
                onClick={() => setSelectedType(type)}
              >
                <span className="pms-enum-type-icon"><NumberOutlined /></span>
                <span>
                  <strong>{definition.label}</strong>
                  <small>{valuesByType[type].length} 个配置值</small>
                </span>
              </button>
            )
          })}
        </div>
      </Card>

      <Card
        className="pms-enum-values-card"
        title={(
          <div className="pms-enum-card-heading">
            <span>{selectedDefinition.label}</span>
            <small>仅维护可选值，枚举类型固定不可变更</small>
          </div>
        )}
        extra={(
          <Button data-enum-add-value type="primary" icon={<PlusOutlined />} onClick={event => openAddModal(event.currentTarget)}>
            新增枚举值
          </Button>
        )}
      >
        <Table
          className="pms-table pms-enum-table"
          columns={columns}
          dataSource={rows}
          pagination={false}
          size="middle"
          scroll={{ y: 440 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无枚举值" /> }}
        />
      </Card>

      <Modal
        className="pms-scroll-modal"
        open={modalOpen}
        title={modalMode === 'add' ? `新增${selectedDefinition.label}枚举值` : `编辑${selectedDefinition.label}枚举值`}
        okText="确认"
        cancelText="取消"
        okButtonProps={{ 'aria-label': '确认枚举值' }}
        cancelButtonProps={{ 'aria-label': '取消枚举值编辑' }}
        confirmLoading={submitting}
        destroyOnHidden
        onCancel={closeModal}
        onOk={submit}
      >
        <div className="pms-enum-form">
          <label htmlFor="enum-value-input">枚举值</label>
          <Input
            id="enum-value-input"
            aria-label="枚举值"
            aria-invalid={Boolean(fieldError)}
            aria-describedby="enum-format-hint enum-value-error"
            autoFocus
            value={draft}
            status={fieldError ? 'error' : undefined}
            placeholder={selectedType === 'tos-2-part' ? '例如 18.0' : '例如 18.0.1'}
            onChange={event => {
              setDraft(event.target.value)
              if (fieldError) setFieldError('')
            }}
            onPressEnter={submit}
          />
          <div id="enum-format-hint" className="pms-enum-format-hint">
            {FORMAT_HINT[selectedType]}。可直接粘贴带 tOS 前缀的合法值，保存时仅存数字点分字符串。
          </div>
          <div id="enum-value-error" className="pms-enum-field-error" role="alert">
            {fieldError}
          </div>
        </div>
      </Modal>
    </section>
  )
}
