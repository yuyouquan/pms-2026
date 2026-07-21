'use client'

import type { ReactNode } from 'react'
import { Button, Modal, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'

export interface DimensionMatrixField {
  key: string
  label: ReactNode
}

export interface DimensionMatrixColumn {
  id: string
}

export interface DimensionMatrixEditorProps<
  Field extends DimensionMatrixField = DimensionMatrixField,
  Dimension extends DimensionMatrixColumn = DimensionMatrixColumn,
> {
  open: boolean
  title: ReactNode
  fields: readonly Field[]
  dimensions: readonly Dimension[]
  toolbar: ReactNode
  notice?: ReactNode
  renderDimensionHeader: (dimension: Dimension) => ReactNode
  renderControl: (field: Field, dimension: Dimension) => ReactNode
  onSave: () => void
  onCancel: () => void
  saving?: boolean
  saveDisabled?: boolean
  width?: number
  fieldColumnWidth?: number
  dimensionColumnWidth?: number
  className?: string
}

export default function DimensionMatrixEditor<
  Field extends DimensionMatrixField = DimensionMatrixField,
  Dimension extends DimensionMatrixColumn = DimensionMatrixColumn,
>({
  open,
  title,
  fields,
  dimensions,
  toolbar,
  notice,
  renderDimensionHeader,
  renderControl,
  onSave,
  onCancel,
  saving = false,
  saveDisabled = false,
  width = 1200,
  fieldColumnWidth = 168,
  dimensionColumnWidth = 228,
  className,
}: DimensionMatrixEditorProps<Field, Dimension>) {
  const columns: ColumnsType<Field> = [
    {
      title: '字段',
      dataIndex: 'label',
      key: 'label',
      fixed: 'left',
      width: fieldColumnWidth,
      render: label => <strong className="pms-dimension-matrix-field-label">{label}</strong>,
    },
    ...dimensions.map(dimension => ({
      title: renderDimensionHeader(dimension),
      dataIndex: dimension.id,
      key: dimension.id,
      width: dimensionColumnWidth,
      render: (_value: unknown, field: Field) => renderControl(field, dimension),
    })),
  ]

  return (
    <Modal
      className={['pms-modal', 'pms-dimension-matrix-modal', className].filter(Boolean).join(' ')}
      title={title}
      open={open}
      onCancel={onCancel}
      width={width}
      footer={[
        <Button key="cancel" onClick={onCancel} disabled={saving}>取消</Button>,
        <Button
          key="save"
          type="primary"
          onClick={onSave}
          loading={saving}
          disabled={saving || saveDisabled}
        >
          保存
        </Button>,
      ]}
    >
      {notice}
      <div className="pms-dimension-matrix-toolbar">{toolbar}</div>
      <Table<Field>
        className="pms-dimension-matrix"
        rowKey="key"
        bordered
        size="small"
        pagination={false}
        dataSource={[...fields]}
        columns={columns}
        scroll={{ x: fieldColumnWidth + dimensions.length * dimensionColumnWidth }}
      />
    </Modal>
  )
}
