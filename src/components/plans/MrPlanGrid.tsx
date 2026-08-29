'use client'

import { DatePicker, Table, Tooltip } from 'antd'
import { ExclamationCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import { numberMrTemplateActivities } from '@/lib/mrTemplateRules'
import { projectTosMrHorizontalColumns } from '@/lib/mrVersionPlanRules'
import type { MrActivityDateMap, MrGroupedColumn, MrPlanViewMode, MrTemplateActivity } from '@/types/mrVersionPlan'

export interface MrPlanGridRow {
  key: string
  version: string
  activities: MrTemplateActivity[]
  dates: MrActivityDateMap
  identity?: Record<string, string>
  slashDates?: boolean
}

export interface MrPlanGridIdentityColumn {
  key: string
  title: string
  width?: number
}

export interface MrPlanGridProps {
  mode: MrPlanViewMode
  logicalRows: MrPlanGridRow[]
  identityColumns?: MrPlanGridIdentityColumn[]
  editableCell: (row: MrPlanGridRow, activity: MrTemplateActivity) => boolean
  cellErrors: Readonly<Record<string, readonly string[]>>
  onDateChange: (row: MrPlanGridRow, activity: MrTemplateActivity, value: string) => void
  emptyText?: string
}

interface VerticalGridRow {
  key: string
  logicalRow: MrPlanGridRow
  activity: MrTemplateActivity
  number: string
}

export function getMrPlanCellKey(rowKey: string, activityId: string): string {
  return `${rowKey}::${activityId}`
}

function buildHorizontalSchema(rows: readonly MrPlanGridRow[]): MrGroupedColumn[] {
  const groups: MrGroupedColumn[] = []
  const byTitle = new Map<string, MrGroupedColumn>()
  const leaves = new Set<string>()
  rows.forEach(row => {
    projectTosMrHorizontalColumns(row.activities).forEach(sourceGroup => {
      let group = byTitle.get(sourceGroup.title)
      if (!group) {
        group = { key: sourceGroup.key, title: sourceGroup.title, children: [] }
        groups.push(group)
        byTitle.set(group.title, group)
      }
      sourceGroup.children.forEach(child => {
        if (leaves.has(child.key)) return
        leaves.add(child.key)
        group!.children.push({ ...child })
      })
    })
  })
  return groups
}

function findActivityByNames(row: MrPlanGridRow, parentName: string, activityName: string) {
  const parent = row.activities.find(activity => activity.parentId === null && activity.activityName === parentName)
  return parent
    ? row.activities.find(activity => activity.parentId === parent.id && activity.activityName === activityName)
    : undefined
}

function renderDateCell(
  row: MrPlanGridRow,
  activity: MrTemplateActivity,
  editable: boolean,
  errors: readonly string[],
  onChange: (value: string) => void,
) {
  const slash = activity.parentId === null || row.slashDates === true
  const value = slash ? '/' : row.dates[activity.id] ?? ''
  const ariaLabel = `${row.version}-${activity.activityName}-日期`
  const content = slash
    ? <span aria-label={ariaLabel}>/</span>
    : editable
      ? (
          <DatePicker
            aria-label={ariaLabel}
            value={value ? dayjs(value, 'YYYY-MM-DD', true) : null}
            format="YYYY-MM-DD"
            allowClear
            onChange={(_, dateText) => onChange(Array.isArray(dateText) ? dateText[0] ?? '' : dateText)}
            status={errors.length ? 'error' : undefined}
            style={{ width: '100%' }}
          />
        )
      : <span aria-label={ariaLabel}>{value || '-'}</span>

  if (!errors.length) return content
  return (
    <span className="pms-mr-date-with-error">
      {content}
      <Tooltip color="red" title={errors.join('；')}>
        <ExclamationCircleOutlined className="pms-mr-error-icon" tabIndex={0} aria-label={`${ariaLabel}-错误：${errors.join('；')}`} />
      </Tooltip>
    </span>
  )
}

export default function MrPlanGrid({
  mode,
  logicalRows,
  identityColumns = [],
  editableCell,
  cellErrors,
  onDateChange,
  emptyText = '暂无MR版本计划',
}: MrPlanGridProps) {
  const renderDate = (row: MrPlanGridRow, activity: MrTemplateActivity) => {
    const errors = cellErrors[getMrPlanCellKey(row.key, activity.id)] ?? []
    return renderDateCell(row, activity, editableCell(row, activity), errors, value => onDateChange(row, activity, value))
  }

  if (mode === 'vertical') {
    const rows: VerticalGridRow[] = logicalRows.flatMap(logicalRow => (
      numberMrTemplateActivities(logicalRow.activities).map(activity => ({
        key: `${logicalRow.key}::${activity.id}`,
        logicalRow,
        activity,
        number: activity.number,
      }))
    ))
    const columns: ColumnsType<VerticalGridRow> = [
      {
        title: 'tOS版本号',
        key: 'version',
        width: 150,
        fixed: 'left',
        className: 'pms-mr-sticky-version',
        render: (_, row) => row.logicalRow.version,
      },
      ...identityColumns.map(column => ({
        title: column.title,
        key: column.key,
        width: column.width ?? 120,
        fixed: 'left' as const,
        className: 'pms-mr-sticky-identity',
        render: (_: unknown, row: VerticalGridRow) => row.logicalRow.identity?.[column.key] || '-',
      })),
      { title: '活动序号', dataIndex: 'number', key: 'number', width: 110 },
      { title: '活动名称', key: 'activityName', width: 240, render: (_, row) => row.activity.activityName },
      {
        title: '日期',
        key: 'date',
        width: 210,
        onCell: row => ({
          className: (cellErrors[getMrPlanCellKey(row.logicalRow.key, row.activity.id)] ?? []).length
            ? 'pms-mr-invalid-cell'
            : undefined,
        }),
        render: (_, row) => renderDate(row.logicalRow, row.activity),
      },
    ]
    return (
      <Table<VerticalGridRow>
        className="pms-table pms-mr-plan-grid pms-mr-plan-grid--vertical"
        aria-label="MR版本计划竖版表格"
        rowKey="key"
        columns={columns}
        dataSource={rows}
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText }}
        rowClassName={row => row.activity.parentId === null ? 'pms-mr-parent-row' : 'pms-mr-child-row'}
      />
    )
  }

  const schema = buildHorizontalSchema(logicalRows)
  const columns: ColumnsType<MrPlanGridRow> = [
    {
      title: 'tOS版本号',
      dataIndex: 'version',
      key: 'version',
      width: 150,
      fixed: 'left',
      className: 'pms-mr-sticky-version',
    },
    ...identityColumns.map(column => ({
      title: column.title,
      key: column.key,
      width: column.width ?? 120,
      fixed: 'left' as const,
      className: 'pms-mr-sticky-identity',
      render: (_: unknown, row: MrPlanGridRow) => row.identity?.[column.key] || '-',
    })),
    ...schema.map(group => ({
      title: group.title,
      key: group.key,
      children: group.children.map(child => ({
        title: child.title,
        key: child.key,
        width: 190,
        onCell: (row: MrPlanGridRow) => {
          const activity = findActivityByNames(row, child.parentName, child.activityName)
          return {
            className: activity && (cellErrors[getMrPlanCellKey(row.key, activity.id)] ?? []).length
              ? 'pms-mr-invalid-cell'
              : undefined,
          }
        },
        render: (_: unknown, row: MrPlanGridRow) => {
          const activity = findActivityByNames(row, child.parentName, child.activityName)
          return activity ? renderDate(row, activity) : '-'
        },
      })),
    })),
  ]
  return (
    <Table<MrPlanGridRow>
      className="pms-table pms-mr-plan-grid pms-mr-plan-grid--horizontal"
      aria-label="MR版本计划横版表格"
      rowKey="key"
      columns={columns}
      dataSource={logicalRows}
      pagination={false}
      scroll={{ x: 'max-content' }}
      locale={{ emptyText }}
    />
  )
}
