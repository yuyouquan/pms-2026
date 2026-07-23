'use client'

import { useEffect, useState } from 'react'
import { Button, Checkbox, Drawer, Flex, Typography } from 'antd'
import {
  DEFAULT_ROADMAP_EVOLUTION_VISIBLE_COLUMNS,
  DEFAULT_ROADMAP_TABLE_VISIBLE_COLUMNS,
  ensureRoadmapLockedColumns,
} from '@/lib/roadmapFilters'
import { ROADMAP_COLUMNS, type RoadmapColumnKey, type RoadmapViewMode } from '@/types/roadmap'

const DRAWER_Z_INDEX = 1300
const NO_LOCKED_COLUMNS: readonly RoadmapColumnKey[] = []

interface RoadmapColumnSettingsDrawerProps {
  open: boolean
  onClose: () => void
  viewMode: RoadmapViewMode
  visibleColumns: readonly RoadmapColumnKey[]
  lockedColumns?: readonly RoadmapColumnKey[]
  onChange: (columns: RoadmapColumnKey[]) => void
}

export default function RoadmapColumnSettingsDrawer({
  open,
  onClose,
  viewMode,
  visibleColumns,
  lockedColumns = NO_LOCKED_COLUMNS,
  onChange,
}: RoadmapColumnSettingsDrawerProps) {
  const [draftColumns, setDraftColumns] = useState<RoadmapColumnKey[]>(() => (
    ensureRoadmapLockedColumns(visibleColumns, lockedColumns)
  ))
  const defaultVisibleColumns = viewMode === 'table'
    ? DEFAULT_ROADMAP_TABLE_VISIBLE_COLUMNS
    : DEFAULT_ROADMAP_EVOLUTION_VISIBLE_COLUMNS

  useEffect(() => {
    if (open) setDraftColumns(ensureRoadmapLockedColumns(visibleColumns, lockedColumns))
  }, [lockedColumns, open, visibleColumns])

  const updateDraftColumns = (values: Array<string | number>) => {
    const next = ROADMAP_COLUMNS
      .map(column => column.key)
      .filter(key => values.includes(key))
    const nextWithLockedColumns = ensureRoadmapLockedColumns(next, lockedColumns)
    if (nextWithLockedColumns.length) setDraftColumns(nextWithLockedColumns)
  }

  const applyColumns = () => {
    const next = ensureRoadmapLockedColumns(draftColumns, lockedColumns)
    if (!next.length) return
    onChange(next)
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
            onClick={() => setDraftColumns(ensureRoadmapLockedColumns(defaultVisibleColumns, lockedColumns))}
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
        当前视图单独保存列设置，至少保留 1 个业务字段。
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
            const isLocked = lockedColumns.includes(column.key)
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
                  cursor: isLocked || (checked && draftColumns.length === 1) ? 'not-allowed' : 'pointer',
                }}
              >
                <Checkbox
                  value={column.key}
                  disabled={isLocked || (checked && draftColumns.length === 1)}
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
