'use client'

import type { HTMLAttributes, ReactNode } from 'react'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
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
  projectListHeaderId?: string
  projectListColumnLocked?: boolean
}

interface SortableProjectListHeaderContextProps {
  items: string[]
  children: ReactNode
  onDragEnd: (event: DragEndEvent) => void
}

export function SortableProjectListHeaderContext({
  items,
  children,
  onDragEnd,
}: SortableProjectListHeaderContextProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={items} strategy={horizontalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  )
}

export function SortableProjectListHeader({
  projectListColumnUnit: unitKey,
  projectListHeaderId: headerId,
  projectListColumnLocked: locked = false,
  children,
  className,
  style,
  ...cellProps
}: SortableProjectListHeaderCellProps) {
  const sortableId = headerId ?? unitKey ?? 'project-list-header'
  const sortable = useSortable({
    id: sortableId,
    disabled: locked || !unitKey,
    data: { unitKey },
  })
  const transform = sortable.transform
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
      className={[
        className,
        'pms-project-list-sortable-header',
        locked ? 'is-locked' : '',
        sortable.isDragging ? 'is-dragging' : '',
      ].filter(Boolean).join(' ')}
      style={{
        ...style,
        transform: CSS.Transform.toString(transform),
        transition: sortable.transition,
      }}
      {...(!locked && unitKey ? sortable.attributes : {})}
      {...(!locked && unitKey ? sortable.listeners : {})}
    >
      <span className="pms-project-list-sortable-header-content">{children}</span>
    </th>
  )
}
