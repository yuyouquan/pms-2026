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
  type DragOverEvent,
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
  unitOrder: string[]
  children: ReactNode
  canDrop: (activeUnitKey: string, overUnitKey: string) => boolean
  onDragEnd: (event: DragEndEvent) => void
  onDragStateChange: (state: ProjectListColumnDragState | null) => void
}

interface ActiveUnit {
  key: string
  label: string
}

export interface ProjectListColumnDragState {
  activeUnitKey: string
  overUnitKey: string | null
  overHeaderId: string | null
  dropEdge: 'before' | 'after' | null
}

const ProjectListHeaderDragContext = createContext<ProjectListColumnDragState | null>(null)

const getUnitLabel = (item: { data: { current?: Record<string, unknown> } } | null) => (
  String(item?.data.current?.unitLabel ?? item?.data.current?.unitKey ?? '字段')
)
const getUnitKey = (item: { data: { current?: Record<string, unknown> } } | null) => (
  String(item?.data.current?.unitKey ?? '')
)

export function SortableProjectListHeaderContext({
  items,
  unitOrder,
  children,
  canDrop,
  onDragEnd,
  onDragStateChange,
}: SortableProjectListHeaderContextProps) {
  const [activeUnit, setActiveUnit] = useState<ActiveUnit | null>(null)
  const [dragState, setDragState] = useState<ProjectListColumnDragState | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const syncDropIndicator = (state: ProjectListColumnDragState | null) => {
    document.querySelectorAll<HTMLElement>('.pms-project-summary-table-shell[data-column-drop-active="true"]')
      .forEach(shell => {
        shell.removeAttribute('data-column-drop-active')
        shell.style.removeProperty('--pms-project-list-drop-x')
      })
    if (!state?.overHeaderId || !state.dropEdge) return
    const target = Array.from(document.querySelectorAll<HTMLElement>(
      '.pms-project-summary-table-shell [data-project-list-header-id]',
    )).find(header => header.dataset.projectListHeaderId === state.overHeaderId)
    const shell = target?.closest<HTMLElement>('.pms-project-summary-table-shell')
    if (!target || !shell) return
    const targetRect = target.getBoundingClientRect()
    const shellRect = shell.getBoundingClientRect()
    const dropX = (state.dropEdge === 'before' ? targetRect.left : targetRect.right) - shellRect.left
    shell.dataset.columnDropActive = 'true'
    shell.style.setProperty('--pms-project-list-drop-x', `${Math.round(dropX)}px`)
  }

  const publishDragState = (state: ProjectListColumnDragState | null) => {
    setDragState(state)
    onDragStateChange(state)
    syncDropIndicator(state)
  }

  const getLiveDragState = (
    active: DragStartEvent['active'],
    over: DragOverEvent['over'],
  ): ProjectListColumnDragState => {
    const activeUnitKey = getUnitKey(active)
    const overUnitKey = over ? getUnitKey(over) : ''
    const validTarget = Boolean(over && canDrop(activeUnitKey, overUnitKey))
    const activeIndex = unitOrder.indexOf(activeUnitKey)
    const overIndex = unitOrder.indexOf(overUnitKey)
    return {
      activeUnitKey,
      overUnitKey: validTarget ? overUnitKey : null,
      overHeaderId: validTarget ? String(over?.id ?? '') : null,
      dropEdge: validTarget && activeIndex >= 0 && overIndex >= 0
        ? (activeIndex < overIndex ? 'after' : 'before')
        : null,
    }
  }

  const clearDragState = () => {
    setActiveUnit(null)
    publishDragState(null)
  }

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
            && canDrop(getUnitKey(active), getUnitKey(over))
            ? `已将${getUnitLabel(active)}放到${getUnitLabel(over)}附近`
            : `未移动${getUnitLabel(active)}：${over ? getUnitLabel(over) : '当前位置'}不可作为放置位置`,
          onDragCancel: ({ active }) => `已取消拖动${getUnitLabel(active)}`,
        },
      }}
      onDragStart={({ active }: DragStartEvent) => {
        setActiveUnit({
          key: String(active.data.current?.unitKey ?? ''),
          label: getUnitLabel(active),
        })
        publishDragState(getLiveDragState(active, null))
      }}
      onDragOver={({ active, over }: DragOverEvent) => {
        publishDragState(getLiveDragState(active, over))
      }}
      onDragCancel={clearDragState}
      onDragEnd={event => {
        onDragEnd(event)
        clearDragState()
      }}
    >
      <ProjectListHeaderDragContext.Provider value={dragState}>
        <SortableContext items={items} strategy={horizontalListSortingStrategy}>
          {children}
        </SortableContext>
      </ProjectListHeaderDragContext.Provider>
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
  const dragState = useContext(ProjectListHeaderDragContext)
  const activeUnitKey = dragState?.activeUnitKey ?? null
  const sortableId = headerId ?? unitKey ?? 'project-list-header'
  const sortable = useSortable({
    id: sortableId,
    disabled: unitKey ? { draggable: locked, droppable: false } : true,
    data: { unitKey, unitLabel, locked },
  })
  const isUnitDragging = Boolean(unitKey && activeUnitKey === unitKey)
  const isDropTarget = Boolean(
    headerId
    && dragState?.overHeaderId === headerId
    && dragState.overUnitKey === unitKey,
  )
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
        isDropTarget && dragState?.dropEdge ? `is-drop-${dragState.dropEdge}` : '',
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
