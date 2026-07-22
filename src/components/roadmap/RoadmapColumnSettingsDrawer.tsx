'use client'

import { useEffect, useState } from 'react'
import { Button, Checkbox, Drawer, Flex, Typography } from 'antd'
import { ROADMAP_COLUMNS, type RoadmapColumnKey } from '@/types/roadmap'

const DRAWER_Z_INDEX = 1300
const DEFAULT_VISIBLE_COLUMNS = ROADMAP_COLUMNS
  .filter(column => column.defaultVisible)
  .map(column => column.key)

interface RoadmapColumnSettingsDrawerProps {
  open: boolean
  onClose: () => void
  visibleColumns: readonly RoadmapColumnKey[]
  onChange: (columns: RoadmapColumnKey[]) => void
}

export default function RoadmapColumnSettingsDrawer({
  open,
  onClose,
  visibleColumns,
  onChange,
}: RoadmapColumnSettingsDrawerProps) {
  const [draftColumns, setDraftColumns] = useState<RoadmapColumnKey[]>([...visibleColumns])

  useEffect(() => {
    if (open) setDraftColumns([...visibleColumns])
  }, [open, visibleColumns])

  const updateDraftColumns = (values: Array<string | number>) => {
    const next = ROADMAP_COLUMNS
      .map(column => column.key)
      .filter(key => values.includes(key))
    if (next.length) setDraftColumns(next)
  }

  const applyColumns = () => {
    if (!draftColumns.length) return
    onChange(draftColumns)
    onClose()
  }

  return (
    <Drawer
      className="pms-roadmap-column-drawer"
      title="列设置"
      open={open}
      onClose={onClose}
      placement="right"
      width="min(420px, 100vw)"
      zIndex={DRAWER_Z_INDEX}
      footer={(
        <Flex justify="space-between" align="center" gap={12} wrap>
          <Button
            size="large"
            onClick={() => setDraftColumns([...DEFAULT_VISIBLE_COLUMNS])}
            style={{ minHeight: 44 }}
          >
            重置默认
          </Button>
          <Flex gap={8}>
            <Button size="large" onClick={onClose} style={{ minHeight: 44 }}>取消</Button>
            <Button type="primary" size="large" onClick={applyColumns} style={{ minHeight: 44 }}>应用</Button>
          </Flex>
        </Flex>
      )}
    >
      <Typography.Paragraph type="secondary">
        表单视图与版本演进视图共享同一份可见字段设置，至少保留 1 个业务字段。
      </Typography.Paragraph>
      <Checkbox.Group
        aria-label="路标可见业务字段"
        value={draftColumns}
        onChange={updateDraftColumns}
        style={{ width: '100%' }}
      >
        <Flex vertical gap={4}>
          {ROADMAP_COLUMNS.map(column => {
            const checked = draftColumns.includes(column.key)
            return (
              <label
                key={column.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  minHeight: 44,
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: checked ? 'var(--bg-purple-tint)' : 'transparent',
                  cursor: checked && draftColumns.length === 1 ? 'not-allowed' : 'pointer',
                }}
              >
                <Checkbox
                  value={column.key}
                  disabled={checked && draftColumns.length === 1}
                >
                  {column.label}
                </Checkbox>
              </label>
            )
          })}
        </Flex>
      </Checkbox.Group>
    </Drawer>
  )
}
