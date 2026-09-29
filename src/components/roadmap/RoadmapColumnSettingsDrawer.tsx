'use client'

import type { ReactElement } from 'react'
import { SortableColumnSettings } from '@/components/shared/SortableColumnSettings'
import {
  getRoadmapSortableColumnDefinitions,
  normalizeRoadmapColumnSettings,
} from '@/lib/roadmapFilters'
import type { SortableColumnSettingsValue } from '@/lib/columnSettings'
import type { RoadmapColumnKey, RoadmapViewMode } from '@/types/roadmap'

interface RoadmapColumnSettingsDrawerProps {
  open: boolean
  trigger: ReactElement
  getPopupContainer?: (triggerNode: HTMLElement) => HTMLElement
  onClose: () => void
  viewMode: RoadmapViewMode
  allowedColumns?: readonly string[]
  value: SortableColumnSettingsValue<RoadmapColumnKey>
  onChange: (value: SortableColumnSettingsValue<RoadmapColumnKey>) => void
}

export default function RoadmapColumnSettingsDrawer({
  open,
  trigger,
  getPopupContainer,
  onClose,
  viewMode,
  allowedColumns,
  value,
  onChange,
}: RoadmapColumnSettingsDrawerProps) {
  const definitions = getRoadmapSortableColumnDefinitions(viewMode).filter(column => !allowedColumns || allowedColumns.includes(column.key))
  const defaults = normalizeRoadmapColumnSettings(viewMode, null)
  const defaultValue = { order: defaults.order.filter(key => !allowedColumns || allowedColumns.includes(key)), visible: defaults.visible.filter(key => !allowedColumns || allowedColumns.includes(key)) }

  return (
    <SortableColumnSettings
      open={open}
      trigger={trigger}
      getPopupContainer={getPopupContainer}
      definitions={definitions}
      value={value}
      defaultValue={defaultValue}
      applyLabel="应用"
      onApply={nextValue => {
        onChange(nextValue)
      }}
      onCancel={onClose}
    />
  )
}
