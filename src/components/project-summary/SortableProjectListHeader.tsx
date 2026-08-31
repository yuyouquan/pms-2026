'use client'

import { createContext, useContext, useState, type HTMLAttributes, type ReactNode } from 'react'
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export interface SortableProjectListHeaderCellProps
  extends HTMLAttributes<HTMLTableCellElement> {
  projectListColumnUnit?: string
  projectListColumnLabel?: string
  projectListHeaderId?: string
  projectListColumnLocked?: boolean
}

interface SortableProjectListHeaderContextProps {
  items: string[]
  children: ReactNode
  onDragEnd: (event: DragEndEvent) => void
}

interface ActiveUnit {
  key: string
  label: string
}

const ActiveProjectListHeaderUnitContext = createContext<string | null>(null)

const getUnitLabel = (item: { data: { current?: Record<string, unknown> } } | null) => (
  String(item?.data.current?.unitLabel ?? item?.data.current?.unitKey ?? '字段')
)

export function SortableProjectListHeaderContext({
  items,
  children,
  onDragEnd,
}: SortableProjectListHeaderContextProps) {
  const [activeUnit, setActiveUnit] = useState<ActiveUnit | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{
        screenReaderInstructions: {
          draggable: '按空格键开始拖动，使用左右方向键调整列顺序，再按空格键放下。',
        },
        announcements: {
          onDragStart: ({ active }) => `已开始拖动${getUnitLabel(active)}`,
          onDragOver: ({ active, over }) => over
            ? `${getUnitLabel(active)}当前位于${getUnitLabel(over)}附近`
            : `${getUnitLabel(active)}已离开可放置区域`,
          onDragEnd: ({ active, over }) => over
            ? `已将${getUnitLabel(active)}放到${getUnitLabel(over)}附近`
            : `${getUnitLabel(active)}未移动`,
          onDragCancel: ({ active }) => `已取消拖动${getUnitLabel(active)}`,
        },
      }}
      onDragStart={({ active }: DragStartEvent) => setActiveUnit({
        key: String(active.data.current?.unitKey ?? ''),
        label: getUnitLabel(active),
      })}
      onDragCancel={() => setActiveUnit(null)}
      onDragEnd={event => {
        onDragEnd(event)
        setActiveUnit(null)
      }}
    >
      <ActiveProjectListHeaderUnitContext.Provider value={activeUnit?.key ?? null}>
        <SortableContext items={items} strategy={horizontalListSortingStrategy}>
          {children}
        </SortableContext>
      </ActiveProjectListHeaderUnitContext.Provider>
      <DragOverlay dropAnimation={null}>
        {activeUnit ? (
          <div className="pms-project-list-drag-overlay" aria-hidden="true">
            {activeUnit.label}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

export function SortableProjectListHeader({
  projectListColumnUnit: unitKey,
  projectListColumnLabel: unitLabel = unitKey ?? '字段',
  projectListHeaderId: headerId,
  projectListColumnLocked: locked = false,
  children,
  className,
  style,
  ...cellProps
}: SortableProjectListHeaderCellProps) {
  const activeUnitKey = useContext(ActiveProjectListHeaderUnitContext)
  const sortableId = headerId ?? unitKey ?? 'project-list-header'
  const sortable = useSortable({
    id: sortableId,
    disabled: unitKey ? { draggable: locked, droppable: false } : true,
    data: { unitKey, unitLabel, locked },
  })
  const isUnitDragging = Boolean(unitKey && activeUnitKey === unitKey)
  const suppressIndividualTransform = unitKey === 'milestone' && activeUnitKey === 'milestone'
  const transform = !suppressIndividualTransform && sortable.transform
    ? { ...sortable.transform, y: 0 }
    : null

  return (
    <th
      {...cellProps}
      ref={sortable.setNodeRef}
      data-project-list-column-unit={unitKey}
      data-project-list-header-id={headerId}
      data-project-list-draggable={!locked && unitKey ? 'true' : undefined}
      data-project-list-column-locked={locked ? 'true' : undefined}
      data-project-list-unit-placeholder={isUnitDragging ? 'true' : undefined}
      className={[
        className,
        'pms-project-list-sortable-header',
        locked ? 'is-locked' : '',
        isUnitDragging ? 'is-unit-dragging' : '',
        sortable.isDragging && !suppressIndividualTransform ? 'is-dragging' : '',
      ].filter(Boolean).join(' ')}
      style={{
        ...style,
        transform: CSS.Transform.toString(transform),
        transition: sortable.transition,
      }}
      {...(!locked && unitKey ? sortable.attributes : {})}
      aria-label={!locked && unitKey ? `拖动${unitLabel}调整列顺序` : cellProps['aria-label']}
      {...(!locked && unitKey ? sortable.listeners : {})}
    >
      <span className="pms-project-list-sortable-header-content">{children}</span>
    </th>
  )
}
