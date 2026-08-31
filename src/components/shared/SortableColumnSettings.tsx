'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
import { Button, Empty, Input, Tooltip } from 'antd'
import {
  EyeInvisibleOutlined,
  EyeOutlined,
  HolderOutlined,
  SearchOutlined,
} from '@ant-design/icons'
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
  normalizeValue?: (
    value?: Partial<SortableColumnSettingsValue<Key>> | readonly Key[] | null,
  ) => SortableColumnSettingsValue<Key>
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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: definition.key })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  const accessibilityLabel = getSortableColumnAccessibilityLabel(definition)
  const required = definition.hideable === false
  const unavailableReason = definition.disabledReason || '必显字段不可隐藏'
  const visibilityDisabled = required || checkboxDisabled

  return (
    <div
      ref={setNodeRef}
      role="group"
      aria-label={accessibilityLabel}
      className={`pms-sortable-column-row${isDragging ? ' is-dragging' : ''}`}
      style={style}
    >
      <button
        type="button"
        className="pms-sortable-column-handle"
        aria-label={`拖动${accessibilityLabel}调整顺序`}
        {...attributes}
        {...listeners}
      >
        <HolderOutlined />
      </button>
      <span className="pms-sortable-column-title">{definition.title}</span>
      {required && <span className="pms-sortable-column-required">必显</span>}
      <Tooltip title={visibilityDisabled ? unavailableReason : checked ? '隐藏字段' : '显示字段'}>
        <button
          type="button"
          className={`pms-sortable-column-visibility${checked ? ' is-visible' : ''}`}
          disabled={visibilityDisabled}
          aria-label={`${accessibilityLabel}列${checked ? '已显示' : '已隐藏'}`}
          onClick={() => onCheckedChange(!checked)}
        >
          {checked ? <EyeOutlined /> : <EyeInvisibleOutlined />}
        </button>
      </Tooltip>
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
  normalizeValue,
  onApply,
  onCancel,
  getPopupContainer,
}: SortableColumnSettingsProps<Key>) {
  const normalize = (
    candidate?: Partial<SortableColumnSettingsValue<Key>> | readonly Key[] | null,
  ) => normalizeValue?.(candidate) ?? normalizeColumnSettings(definitions, candidate)
  const [draft, setDraft] = useState<SortableColumnSettingsValue<Key>>(
    () => normalize(value),
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
      setDraft(normalize(value))
      setSearchText('')
    } else if (
      open
      && wasOpen.current
      && previousDefinitionSignature.current !== definitionSignature
    ) {
      setDraft(current => normalize(current))
    }
    wasOpen.current = open
    previousDefinitionSignature.current = definitionSignature
  }, [definitionSignature, definitions, normalizeValue, open, value])

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
    const normalized = normalize(nextValue)
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
    commitDraft(normalize(
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
      width={340}
      ariaLabel="字段配置"
      onCancel={onCancel}
      getPopupContainer={getPopupContainer}
      title={(
        <div className="pms-floating-config-title-row">
          <span>选择要显示的字段</span>
          <Button type="link" danger size="small" onClick={handleReset}>重置默认</Button>
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
