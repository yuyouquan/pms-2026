'use client'

import { useEffect, useRef, useState } from 'react'
import { Button, Checkbox, Modal, Tooltip } from 'antd'
import { HolderOutlined } from '@ant-design/icons'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  getColumnDefinitionSignature,
  getDefaultColumnSettings,
  getSortableColumnAccessibilityLabel,
  moveColumnSetting,
  normalizeColumnSettings,
  type SortableColumnDefinition,
  type SortableColumnSettingsValue,
} from '@/lib/columnSettings'

export interface SortableColumnSettingsProps<Key extends string> {
  open: boolean
  definitions: readonly SortableColumnDefinition<Key>[]
  value: SortableColumnSettingsValue<Key>
  defaultValue?: SortableColumnSettingsValue<Key>
  minVisible?: number
  applyLabel?: string
  onApply: (value: SortableColumnSettingsValue<Key>) => void
  onCancel: () => void
}

interface SortableColumnRowProps<Key extends string> {
  definition: SortableColumnDefinition<Key>
  checked: boolean
  checkboxDisabled: boolean
  onCheckedChange: (checked: boolean) => void
}

function SortableColumnRow<Key extends string>({
  definition,
  checked,
  checkboxDisabled,
  onCheckedChange,
}: SortableColumnRowProps<Key>) {
  const fixed = definition.fixed === 'left'
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: definition.key, disabled: fixed })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  const accessibilityLabel = getSortableColumnAccessibilityLabel(definition)
  const unavailableReason = definition.disabledReason || '不可取消'
  const checkbox = (
    <Checkbox
      checked={checked}
      disabled={definition.hideable === false || checkboxDisabled}
      onChange={event => onCheckedChange(event.target.checked)}
      aria-label={`${accessibilityLabel}列${checked ? '已显示' : '已隐藏'}`}
    />
  )

  return (
    <div
      ref={setNodeRef}
      role="group"
      aria-label={accessibilityLabel}
      className={`pms-sortable-column-row${isDragging ? ' is-dragging' : ''}`}
      style={style}
    >
      {fixed ? (
        <span aria-hidden="true" />
      ) : (
        <button
          type="button"
          className="pms-sortable-column-handle"
          aria-label={`拖动${accessibilityLabel}调整顺序`}
          {...attributes}
          {...listeners}
        >
          <HolderOutlined />
        </button>
      )}
      {definition.hideable === false ? (
        <Tooltip title={unavailableReason}>{checkbox}</Tooltip>
      ) : checkbox}
      <span className="pms-sortable-column-title">{definition.title}</span>
      <span className="pms-sortable-column-fixed">
        {fixed ? '固定左侧' : definition.hideable === false ? unavailableReason : null}
      </span>
    </div>
  )
}

export function SortableColumnSettings<Key extends string>({
  open,
  definitions,
  value,
  defaultValue,
  minVisible = 1,
  applyLabel = '确定',
  onApply,
  onCancel,
}: SortableColumnSettingsProps<Key>) {
  const [draft, setDraft] = useState<SortableColumnSettingsValue<Key>>(
    () => normalizeColumnSettings(definitions, value),
  )
  const wasOpen = useRef(false)
  const definitionSignature = getColumnDefinitionSignature(definitions)
  const previousDefinitionSignature = useRef(definitionSignature)
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    if (open && !wasOpen.current) {
      setDraft(normalizeColumnSettings(definitions, value))
    } else if (
      open
      && wasOpen.current
      && previousDefinitionSignature.current !== definitionSignature
    ) {
      setDraft(current => normalizeColumnSettings(definitions, current))
    }
    wasOpen.current = open
    previousDefinitionSignature.current = definitionSignature
  }, [definitionSignature, definitions, open, value])

  const definitionByKey = new Map(
    definitions.map(definition => [definition.key, definition] as const),
  )
  const visibleKeys = new Set(draft.visible)
  const hideableDefinitions = definitions.filter(definition => definition.hideable !== false)
  const visibleHideableCount = hideableDefinitions
    .filter(definition => visibleKeys.has(definition.key))
    .length
  const minimum = Math.max(0, minVisible)
  const applyDisabled = hideableDefinitions.length > 0 && visibleHideableCount < minimum

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    setDraft(current => ({
      ...current,
      order: moveColumnSetting(
        definitions,
        current.order,
        String(active.id) as Key,
        String(over.id) as Key,
      ),
    }))
  }

  const handleVisibilityChange = (key: Key, checked: boolean) => {
    setDraft(current => {
      const definition = definitionByKey.get(key)
      if (!definition || definition.hideable === false) return current

      const currentVisible = new Set(current.visible)
      const currentHideableCount = hideableDefinitions
        .filter(item => currentVisible.has(item.key))
        .length
      if (!checked && currentHideableCount <= minimum) return current

      if (checked) currentVisible.add(key)
      else currentVisible.delete(key)

      return {
        ...current,
        visible: current.order.filter(item => currentVisible.has(item)),
      }
    })
  }

  const handleReset = () => {
    setDraft(normalizeColumnSettings(
      definitions,
      defaultValue ?? getDefaultColumnSettings(definitions),
    ))
  }

  const handleApply = () => {
    if (applyDisabled) return
    onApply(normalizeColumnSettings(definitions, draft))
  }

  return (
    <Modal
      className="pms-modal"
      title="列设置"
      open={open}
      onCancel={onCancel}
      footer={[
        <Button key="reset" onClick={handleReset}>重置</Button>,
        <Button key="cancel" onClick={onCancel}>取消</Button>,
        <Button key="apply" type="primary" disabled={applyDisabled} onClick={handleApply}>
          {applyLabel}
        </Button>,
      ]}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={draft.order} strategy={verticalListSortingStrategy}>
          <div className="pms-sortable-column-list">
            {draft.order.map(key => {
              const definition = definitionByKey.get(key)
              if (!definition) return null
              const checked = visibleKeys.has(key)
              const wouldViolateMinimum = definition.hideable !== false
                && checked
                && visibleHideableCount <= minimum
              return (
                <SortableColumnRow
                  key={key}
                  definition={definition}
                  checked={checked}
                  checkboxDisabled={wouldViolateMinimum}
                  onCheckedChange={nextChecked => handleVisibilityChange(key, nextChecked)}
                />
              )
            })}
          </div>
        </SortableContext>
      </DndContext>
    </Modal>
  )
}
