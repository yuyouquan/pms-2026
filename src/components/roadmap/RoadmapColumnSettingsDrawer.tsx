'use client'

import { SortableColumnSettings } from '@/components/shared/SortableColumnSettings'
import {
  getRoadmapSortableColumnDefinitions,
  normalizeRoadmapColumnSettings,
} from '@/lib/roadmapFilters'
import type { SortableColumnSettingsValue } from '@/lib/columnSettings'
import type { RoadmapColumnKey, RoadmapViewMode } from '@/types/roadmap'

interface RoadmapColumnSettingsDrawerProps {
  open: boolean
  onClose: () => void
  viewMode: RoadmapViewMode
  value: SortableColumnSettingsValue<RoadmapColumnKey>
  onChange: (value: SortableColumnSettingsValue<RoadmapColumnKey>) => void
}

export default function RoadmapColumnSettingsDrawer({
  open,
  onClose,
  viewMode,
  value,
  onChange,
}: RoadmapColumnSettingsDrawerProps) {
  const definitions = getRoadmapSortableColumnDefinitions(viewMode)
  const defaultValue = normalizeRoadmapColumnSettings(viewMode, null)

  return (
    <SortableColumnSettings
      open={open}
      definitions={definitions}
      value={value}
      defaultValue={defaultValue}
      applyLabel="应用"
      onApply={nextValue => {
        onChange(nextValue)
        onClose()
      }}
      onCancel={onClose}
    />
  )
}
