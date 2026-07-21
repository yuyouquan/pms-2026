'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Button, Checkbox, Radio, Select, Space, Tag, Tooltip } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import DimensionMatrixEditor from '@/components/project-info/DimensionMatrixEditor'
import {
  TOS_TYPE_OPTIONS,
  getMainTosType,
  normalizeTosTypeRows,
  type TosPlanType,
  type TosTypeConfigRow,
} from '@/lib/tosTypeRules'

const TOS_TYPE_MATRIX_FIELDS = [
  { key: 'isMain', label: '主类型' },
  { key: 'followsMain', label: '跟随主类型' },
] as const

type TosTypeMatrixField = typeof TOS_TYPE_MATRIX_FIELDS[number]
type TosTypeMatrixFieldKey = TosTypeMatrixField['key']

export interface TosTypeEditorModalProps {
  open: boolean
  rows: TosTypeConfigRow[]
  canEdit: boolean
  onChange: (rows: TosTypeConfigRow[]) => void
  onSave: () => void
  onCancel: () => void
}

export default function TosTypeEditorModal({
  open,
  rows,
  canEdit,
  onChange,
  onSave,
  onCancel,
}: TosTypeEditorModalProps) {
  const [selectedType, setSelectedType] = useState<TosPlanType>()
  const availableTypes = useMemo(
    () => TOS_TYPE_OPTIONS.filter(type => !rows.some(row => row.type === type)),
    [rows],
  )

  useEffect(() => {
    if (!availableTypes.length) {
      setSelectedType(undefined)
      return
    }
    if (!selectedType || !availableTypes.includes(selectedType)) {
      setSelectedType(availableTypes[0])
    }
  }, [availableTypes, selectedType])

  const updateRow = (rowId: string, patch: Partial<TosTypeConfigRow>) => {
    if (!canEdit) return
    const previousMainType = getMainTosType(rows)
    const nextRows = rows.map(row => ({ ...row }))
    const targetRow = nextRows.find(row => row.id === rowId)
    if (!targetRow) return

    if (patch.followsMain !== undefined && !targetRow.isMain) {
      targetRow.followsMain = patch.followsMain
    }
    if (patch.isMain) {
      nextRows.forEach(row => {
        row.isMain = row.id === rowId
      })
      targetRow.followsMain = false
    }

    onChange(normalizeTosTypeRows(nextRows, previousMainType))
  }

  const addType = () => {
    if (!canEdit || !selectedType || !availableTypes.includes(selectedType)) return
    const previousMainType = getMainTosType(rows)
    const nextRows = [
      ...rows,
      {
        id: `tos-type-${selectedType}-${Date.now()}`,
        type: selectedType,
        isMain: rows.length === 0,
        followsMain: false,
      },
    ]
    onChange(normalizeTosTypeRows(nextRows, previousMainType))
  }

  const removeType = (rowId: string) => {
    if (!canEdit || rows.length <= 1) return
    const targetRow = rows.find(row => row.id === rowId)
    if (targetRow?.isMain) return
    const previousMainType = getMainTosType(rows)
    const nextRows = rows.filter(row => row.id !== rowId)
    onChange(normalizeTosTypeRows(nextRows, previousMainType))
  }

  const renderControl = (fieldKey: TosTypeMatrixFieldKey, row: TosTypeConfigRow): ReactNode => {
    switch (fieldKey) {
      case 'isMain':
        return (
          <Radio
            checked={row.isMain}
            disabled={!canEdit}
            onChange={() => updateRow(row.id, { isMain: true })}
          >
            {row.isMain ? '当前主类型' : '设为主类型'}
          </Radio>
        )
      case 'followsMain':
        return (
          <Checkbox
            checked={!row.isMain && row.followsMain}
            disabled={row.isMain}
            onChange={event => updateRow(row.id, { followsMain: event.target.checked })}
          >
            跟随主类型计划
          </Checkbox>
        )
      default:
        return null
    }
  }

  const toolbar = (
    <>
      <Select<TosPlanType>
        value={selectedType}
        placeholder="请选择新增类型"
        options={availableTypes.map(type => ({ label: type, value: type }))}
        onChange={setSelectedType}
        disabled={!canEdit || !availableTypes.length}
      />
      <Button
        type="primary"
        icon={<PlusOutlined />}
        disabled={!canEdit || !selectedType || !availableTypes.length}
        onClick={addType}
      >
        增加类型
      </Button>
    </>
  )

  return (
    <DimensionMatrixEditor<TosTypeMatrixField, TosTypeConfigRow>
      open={open}
      title={<Space><EditOutlined style={{ color: '#6366f1' }} /><span>类型编辑</span></Space>}
      fields={TOS_TYPE_MATRIX_FIELDS}
      dimensions={rows}
      toolbar={toolbar}
      width={980}
      saveDisabled={!canEdit || rows.length === 0}
      onSave={onSave}
      onCancel={onCancel}
      renderDimensionHeader={row => (
        <div className="pms-dimension-matrix-header">
          <span>{row.type}</span>
          {row.isMain && <Tag color="blue">主类型</Tag>}
          <Tooltip title={row.isMain ? '请先指定其他主类型后再删除' : '删除类型'}>
            <span>
              <Button
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined />}
                aria-label={`删除${row.type}类型`}
                disabled={!canEdit || rows.length <= 1 || row.isMain}
                onClick={() => removeType(row.id)}
              />
            </span>
          </Tooltip>
        </div>
      )}
      renderControl={(field, row) => renderControl(field.key, row)}
    />
  )
}
