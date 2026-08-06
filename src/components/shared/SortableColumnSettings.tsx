'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
import { Button, Checkbox, Empty, Input, Tooltip } from 'antd'
import { HolderOutlined, SearchOutlined } from '@ant-design/icons'
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
import { FloatingConfigPopover } from '@/components/shared/FloatingConfigPopover'
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
  trigger: ReactElement
  definitions: readonly SortableColumnDefinition<Key>[]
  value: SortableColumnSettingsValue<Key>
  defaultValue?: SortableColumnSettingsValue<Key>
  minVisible?: number
  applyLabel?: string
  onApply: (value: SortableColumnSettingsValue<Key>) => void
  onCancel: () => void
  getPopupContainer?: (triggerNode: HTMLElement) => HTMLElement
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
  trigger,
  definitions,
  value,
  defaultValue,
  minVisible = 1,
  onApply,
  onCancel,
  getPopupContainer,
}: SortableColumnSettingsProps<Key>) {
  const [draft, setDraft] = useState<SortableColumnSettingsValue<Key>>(
    () => normalizeColumnSettings(definitions, value),
  )
  const [searchText, setSearchText] = useState('')
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
      setSearchText('')
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
  const commitDraft = (nextValue: SortableColumnSettingsValue<Key>) => {
    const normalized = normalizeColumnSettings(definitions, nextValue)
    setDraft(normalized)
    onApply(normalized)
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    commitDraft({
      ...draft,
      order: moveColumnSetting(
        definitions,
        draft.order,
        String(active.id) as Key,
        String(over.id) as Key,
      ),
    })
  }

  const handleVisibilityChange = (key: Key, checked: boolean) => {
    const definition = definitionByKey.get(key)
    if (!definition || definition.hideable === false) return

    const currentVisible = new Set(draft.visible)
    const currentHideableCount = hideableDefinitions
      .filter(item => currentVisible.has(item.key))
      .length
    if (!checked && currentHideableCount <= minimum) return

    if (checked) currentVisible.add(key)
    else currentVisible.delete(key)

    commitDraft({
      ...draft,
      visible: draft.order.filter(item => currentVisible.has(item)),
    })
  }

  const handleReset = () => {
    commitDraft(normalizeColumnSettings(
      definitions,
      defaultValue ?? getDefaultColumnSettings(definitions),
    ))
  }

  const normalizedSearchText = searchText.trim().toLocaleLowerCase('zh-CN')
  const filteredOrder = draft.order.filter(key => {
    if (!normalizedSearchText) return true
    const definition = definitionByKey.get(key)
    if (!definition) return false
    const searchableText = `${definition.title} ${getSortableColumnAccessibilityLabel(definition)}`
      .toLocaleLowerCase('zh-CN')
    return searchableText.includes(normalizedSearchText)
  })
  const renderedRows = filteredOrder.map(key => {
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
  })

  return (
    <FloatingConfigPopover
      open={open}
      trigger={trigger}
      width={400}
      ariaLabel="字段配置"
      onCancel={onCancel}
      getPopupContainer={getPopupContainer}
      title={(
        <div className="pms-floating-config-title-row">
          <span>字段配置</span>
          <Button type="link" danger size="small" onClick={handleReset}>重置</Button>
        </div>
      )}
      footer={null}
    >
      <Input
        allowClear
        value={searchText}
        prefix={<SearchOutlined />}
        placeholder="搜索字段"
        aria-label="搜索字段配置"
        onChange={event => setSearchText(event.target.value)}
        style={{ marginBottom: 10 }}
      />
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={filteredOrder} strategy={verticalListSortingStrategy}>
          <div className="pms-sortable-column-list">
            {renderedRows.length
              ? renderedRows
              : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未找到匹配列" />}
          </div>
        </SortableContext>
      </DndContext>
    </FloatingConfigPopover>
  )
}
