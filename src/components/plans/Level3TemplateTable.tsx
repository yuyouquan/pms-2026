'use client'

import { useContext, createContext, type CSSProperties, type HTMLAttributes } from 'react'
import { Button, Empty, Input, Popconfirm, Select, Space, Table, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DeleteOutlined, HolderOutlined, PlusOutlined } from '@ant-design/icons'
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { LEVEL3_COLUMN_KEYS, LEVEL3_COLUMN_TITLES, type Level3ColumnKey } from '@/types/level3Plan'
import type { Level3TemplateActivity, NumberedLevel3TemplateActivity } from '@/types/level3Template'
import { normalizeLevel3TemplateActivities, numberLevel3TemplateActivities } from '@/lib/level3TemplateRules'

export interface Level3TemplateTableProps {
  activities: Level3TemplateActivity[]
  editable: boolean
  milestoneOptions: Array<{ value: string; label: string }>
  searchText?: string
  collapsedIds: string[]
  onActivitiesChange: (activities: Level3TemplateActivity[]) => void
  onCollapsedIdsChange: (ids: string[]) => void
}

const EditableContext = createContext(false)

interface SortableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  'data-row-key': string
}

function SortableRow(props: SortableRowProps) {
  const editable = useContext(EditableContext)
  const id = String(props['data-row-key'] || '')
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !editable })
  const style: CSSProperties = {
    ...props.style,
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { position: 'relative', zIndex: 2 } : {}),
  }
  return <tr {...props} ref={setNodeRef} style={style} {...(editable ? attributes : {})} {...(editable ? listeners : {})} />
}

const createId = () => `level3-template-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`}`

export default function Level3TemplateTable({
  activities,
  editable,
  milestoneOptions,
  searchText = '',
  collapsedIds,
  onActivitiesChange,
  onCollapsedIdsChange,
}: Level3TemplateTableProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const rows = numberLevel3TemplateActivities(activities)
  const normalizedSearchText = searchText.trim().toLowerCase()
  const matchingIds = new Set(rows
    .filter(row => !normalizedSearchText || row.activityName.toLowerCase().includes(normalizedSearchText) || row.milestoneName.toLowerCase().includes(normalizedSearchText))
    .map(row => row.id))
  const searchableRows = !normalizedSearchText ? rows : rows.filter(row => (
    matchingIds.has(row.id)
    || (!row.parentId && rows.some(child => child.parentId === row.id && matchingIds.has(child.id)))
  ))
  const visibleRows = searchableRows.filter(row => !row.parentId || !collapsedIds.includes(row.parentId))

  const changeActivity = (id: string, patch: Partial<Level3TemplateActivity>) => {
    onActivitiesChange(normalizeLevel3TemplateActivities(activities.map(activity => (
      activity.id === id ? { ...activity, ...patch } : activity
    ))))
  }
  const addParent = () => onActivitiesChange(normalizeLevel3TemplateActivities([
    ...activities,
    { id: createId(), parentId: null, order: activities.filter(item => !item.parentId).length, activityName: '新增一级活动', milestoneId: '', milestoneName: '', source: 'custom' },
  ]))
  const addChild = (parentId: string) => onActivitiesChange(normalizeLevel3TemplateActivities([
    ...activities,
    { id: createId(), parentId, order: activities.filter(item => item.parentId === parentId).length, activityName: '新增二级活动', milestoneId: '', milestoneName: '', source: 'custom' },
  ]))
  const deleteActivity = (id: string) => onActivitiesChange(normalizeLevel3TemplateActivities(
    activities.filter(activity => activity.id !== id && activity.parentId !== id),
  ))
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!editable || !over || active.id === over.id) return
    const activeRow = activities.find(item => item.id === active.id)
    const overRow = activities.find(item => item.id === over.id)
    if (!activeRow || !overRow || activeRow.parentId !== overRow.parentId) return
    const siblings = activities.filter(item => item.parentId === activeRow.parentId).sort((a, b) => a.order - b.order)
    const from = siblings.findIndex(item => item.id === activeRow.id)
    const to = siblings.findIndex(item => item.id === overRow.id)
    const reordered = [...siblings]
    reordered.splice(to, 0, ...reordered.splice(from, 1))
    const orders = new Map(reordered.map((item, index) => [item.id, index]))
    onActivitiesChange(normalizeLevel3TemplateActivities(activities.map(item => (
      orders.has(item.id) ? { ...item, order: orders.get(item.id)! } : item
    ))))
  }

  const columns: ColumnsType<NumberedLevel3TemplateActivity> = LEVEL3_COLUMN_KEYS.map(key => {
    const base = { key, title: LEVEL3_COLUMN_TITLES[key], dataIndex: key, width: key === 'activityName' ? 260 : key === 'remark' ? 180 : 120 }
    if (key === 'number') return {
      ...base,
      fixed: 'left' as const,
      render: (value: string, row: NumberedLevel3TemplateActivity) => (
        <Space size={4} style={{ paddingLeft: row.depth * 18 }}>
          {editable && <HolderOutlined style={{ color: '#9ca3af' }} />}
          <span>{value}</span>
        </Space>
      ),
    }
    if (key === 'activityName') return {
      ...base,
      fixed: 'left' as const,
      render: (_: unknown, row: NumberedLevel3TemplateActivity) => (
        <div className="pms-level3-template-name-cell" onPointerDown={event => event.stopPropagation()}>
          {editable ? (
            <Input
              size="small"
              value={row.activityName}
              maxLength={100}
              aria-label={`活动名称-${row.number}`}
              onChange={event => changeActivity(row.id, { activityName: event.target.value })}
            />
          ) : <span>{row.activityName || '-'}</span>}
          {editable && (
            <Space size={2} className="pms-level3-template-row-actions">
              {!row.parentId && <Tooltip title="新增二级活动"><Button size="small" type="text" icon={<PlusOutlined />} aria-label={`新增子活动-${row.number}`} onClick={() => addChild(row.id)} /></Tooltip>}
              <Popconfirm title="确认删除该活动？" description={!row.parentId ? '其下所有二级活动也会删除。' : undefined} onConfirm={() => deleteActivity(row.id)}>
                <Tooltip title="删除"><Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label={`删除活动-${row.number}`} /></Tooltip>
              </Popconfirm>
            </Space>
          )}
        </div>
      ),
    }
    if (key === 'milestoneName') return {
      ...base,
      render: (_: unknown, row: NumberedLevel3TemplateActivity) => editable ? (
        <div onPointerDown={event => event.stopPropagation()}>
          <Select
            size="small"
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ width: '100%' }}
            value={row.milestoneId || undefined}
            options={milestoneOptions}
            placeholder="选择关键节点"
            aria-label={`关键节点-${row.number}`}
            onChange={value => {
              const option = milestoneOptions.find(item => item.value === value)
              changeActivity(row.id, { milestoneId: value || '', milestoneName: option?.label || '' })
            }}
          />
        </div>
      ) : (row.milestoneName || '-'),
    }
    return { ...base, render: () => '-' }
  })

  return (
    <div className="pms-level3-template-table">
      {editable && <Button type="primary" icon={<PlusOutlined />} onClick={addParent} style={{ marginBottom: 12 }}>新增活动</Button>}
      <EditableContext.Provider value={editable}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={visibleRows.map(row => row.id)} strategy={verticalListSortingStrategy}>
            <Table
              className="pms-table"
              rowKey="id"
              size="middle"
              pagination={false}
              columns={columns}
              dataSource={visibleRows}
              scroll={{ x: 1900 }}
              expandable={{
                expandedRowKeys: rows.filter(row => !row.parentId && !collapsedIds.includes(row.id)).map(row => row.id),
                rowExpandable: row => !row.parentId && rows.some(item => item.parentId === row.id),
                onExpand: (expanded, row) => onCollapsedIdsChange(expanded
                  ? collapsedIds.filter(id => id !== row.id)
                  : [...new Set([...collapsedIds, row.id])]),
              }}
              components={{ body: { row: SortableRow } }}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无三级计划模板活动" /> }}
              rowClassName={row => row.parentId ? 'pms-level3-child-row' : 'pms-level3-parent-row'}
            />
          </SortableContext>
        </DndContext>
      </EditableContext.Provider>
    </div>
  )
}
