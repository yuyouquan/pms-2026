'use client'

import { createContext, useContext, useMemo, type HTMLAttributes } from 'react'
import { Button, Tooltip } from 'antd'
import { HolderOutlined } from '@ant-design/icons'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type SortableHandle = Pick<ReturnType<typeof useSortable>, 'attributes' | 'listeners' | 'setActivatorNodeRef'>
const HandleContext = createContext<SortableHandle | null>(null)

export function EnumSortableRow({ children, className, style, ...props }: HTMLAttributes<HTMLTableRowElement> & { 'data-row-key': string }) {
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition, isDragging } = useSortable({ id: props['data-row-key'] })
  const handle = useMemo(() => ({ attributes, listeners, setActivatorNodeRef }), [attributes, listeners, setActivatorNodeRef])
  return (
    <HandleContext.Provider value={handle}>
      <tr
        {...props}
        ref={setNodeRef}
        className={`${className ?? ''}${isDragging ? ' pms-enum-row-dragging' : ''}`}
        style={{ ...style, transform: CSS.Transform.toString(transform ? { ...transform, x: 0 } : null), transition, ...(isDragging ? { position: 'relative', zIndex: 2 } : {}) }}
      >{children}</tr>
    </HandleContext.Provider>
  )
}

export function EnumDragHandle({ label, disabled }: { label: string; disabled: boolean }) {
  const handle = useContext(HandleContext)
  return (
    <Tooltip title="拖动调整顺序">
      <Button
        {...handle?.attributes}
        {...handle?.listeners}
        ref={handle?.setActivatorNodeRef}
        type="text"
        size="small"
        className="pms-enum-drag-handle"
        aria-label={`拖动排序 ${label}`}
        disabled={disabled}
        icon={<HolderOutlined />}
      />
    </Tooltip>
  )
}
