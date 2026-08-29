'use client'

import { createContext, useContext, type CSSProperties, type HTMLAttributes } from 'react'
import { Button, Empty, Input, Popconfirm, Space, Table, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DeleteOutlined, HolderOutlined, PlusOutlined } from '@ant-design/icons'
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { moveMrTemplateActivity, normalizeMrTemplateActivities, numberMrTemplateActivities, removeMrTemplateActivity } from '@/lib/mrTemplateRules'
import type { MrTemplateActivity } from '@/types/mrVersionPlan'

export interface MrTemplateTableProps {
  activities: MrTemplateActivity[]
  editable: boolean
  onChange: (activities: MrTemplateActivity[]) => void
}

type NumberedActivity = ReturnType<typeof numberMrTemplateActivities>[number]
const DragContext = createContext<Record<string, { attributes: Record<string, unknown>; listeners?: Record<string, unknown> }>>({})

interface SortableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  'data-row-key': string
}

function SortableRow(props: SortableRowProps) {
  const id = String(props['data-row-key'] || '')
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style: CSSProperties = {
    ...props.style,
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { position: 'relative', zIndex: 3 } : {}),
  }
  const context = useContext(DragContext)
  context[id] = { attributes: attributes as unknown as Record<string, unknown>, listeners: listeners as unknown as Record<string, unknown> }
  return <tr {...props} ref={setNodeRef} style={style} />
}

const createId = () => `mr-custom-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`}`

export default function MrTemplateTable({ activities, editable, onChange }: MrTemplateTableProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const rows = numberMrTemplateActivities(activities)
  const dragBindings: Record<string, { attributes: Record<string, unknown>; listeners?: Record<string, unknown> }> = {}

  const emit = (next: readonly MrTemplateActivity[]) => onChange(normalizeMrTemplateActivities(next.map(row => ({ ...row }))))
  const rename = (id: string, activityName: string) => emit(activities.map(row => row.id === id ? { ...row, activityName } : row))
  const addParent = () => emit([
    ...activities,
    { id: createId(), parentId: null, order: activities.filter(row => row.parentId === null).length, activityName: '新增一级活动', source: 'custom' },
  ])
  const addChild = (parentId: string) => emit([
    ...activities,
    { id: createId(), parentId, order: activities.filter(row => row.parentId === parentId).length, activityName: '新增二级活动', source: 'custom' },
  ])
  const remove = (id: string) => emit(removeMrTemplateActivity(activities, id))
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!editable || !over || active.id === over.id) return
    const activeRow = activities.find(row => row.id === active.id)
    const overRow = activities.find(row => row.id === over.id)
    if (!activeRow || !overRow || activeRow.parentId !== overRow.parentId) return
    emit(moveMrTemplateActivity(activities, String(active.id), String(over.id)))
  }

  const columns: ColumnsType<NumberedActivity> = [
    { title: 'tOS版本号', key: 'tosVersion', width: 140, render: () => '-' },
    {
      title: '活动序号', dataIndex: 'number', key: 'number', width: 130,
      render: (value: string, row) => (
        <Space size={6} style={{ paddingLeft: row.depth * 18 }}>
          {editable && (
            <button
              type="button"
              className="pms-mr-drag-handle"
              aria-label={`拖动活动-${row.number}`}
              {...dragBindings[row.id]?.attributes}
              {...dragBindings[row.id]?.listeners}
            ><HolderOutlined /></button>
          )}
          <span>{value}</span>
        </Space>
      ),
    },
    {
      title: '活动名称', dataIndex: 'activityName', key: 'activityName', width: 360,
      render: (_: unknown, row) => (
        <div className="pms-mr-template-name-cell" onPointerDown={event => event.stopPropagation()}>
          {editable ? (
            <Input
              size="small"
              value={row.activityName}
              maxLength={100}
              aria-label={`活动名称-${row.number}`}
              onChange={event => rename(row.id, event.target.value)}
            />
          ) : <span>{row.activityName || '-'}</span>}
          {editable && (
            <Space size={2} className="pms-mr-template-row-actions">
              {row.parentId === null && (
                <Tooltip title="新增二级活动">
                  <Button type="text" size="small" icon={<PlusOutlined />} aria-label={`新增子活动-${row.number}`} onClick={() => addChild(row.id)} />
                </Tooltip>
              )}
              <Popconfirm title="确认删除该活动？" description={row.parentId === null ? '其下所有二级活动也会删除。' : undefined} onConfirm={() => remove(row.id)}>
                <Tooltip title="删除活动">
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label={`删除活动-${row.number}`} />
                </Tooltip>
              </Popconfirm>
            </Space>
          )}
        </div>
      ),
    },
    { title: '日期', key: 'date', width: 140, render: () => '-' },
  ]

  return (
    <div className="pms-mr-template-table">
      <DragContext.Provider value={dragBindings}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={rows.map(row => row.id)} strategy={verticalListSortingStrategy}>
            <Table
              className="pms-table"
              rowKey="id"
              size="middle"
              pagination={false}
              columns={columns}
              dataSource={rows}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无模板活动" /> }}
              components={editable ? { body: { row: SortableRow } } : undefined}
              rowClassName={row => row.parentId === null ? 'pms-mr-template-parent-row' : ''}
              scroll={{ x: 770 }}
            />
          </SortableContext>
        </DndContext>
      </DragContext.Provider>
      {editable && <Button type="dashed" icon={<PlusOutlined />} aria-label="新增一级活动" onClick={addParent}>新增一级活动</Button>}
    </div>
  )
}
