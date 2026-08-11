'use client'

import { useMemo, useState } from 'react'
import { Card, Table, Button, Tooltip, Tag, Checkbox, Space } from 'antd'
import { EditOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useHrMachineStore } from '@/stores/hrMachine'
import { BUDGET_TYPES, BUDGET_TYPE_LABELS, formatPersonMonth } from '@/constants/hrMachine'
import type { MonthlyInvestment, BudgetType } from '@/types/hrMachine'

interface MonthlyInvestmentTabProps {
  onEditMonthly: (monthlyId: string) => void
}

/** 表格行：在月度投入记录上附加项目名称，便于直接渲染 */
interface MonthlyInvestmentRow extends MonthlyInvestment {
  projectName: string
}

/** 将 "YYYY-MM" 月度 key 格式化为表头 "YYYY年MM月" */
function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-')
  return `${year}年${month}月`
}

export default function MonthlyInvestmentTab({ onEditMonthly }: MonthlyInvestmentTabProps) {
  const monthlyInvestments = useHrMachineStore((s) => s.monthlyInvestments)
  const projects = useHrMachineStore((s) => s.projects)

  // 预算类型筛选（默认全部选上）
  const ALL_BUDGET_TYPES: BudgetType[] = BUDGET_TYPES.map((t) => t.value)
  const [selectedBudgetTypes, setSelectedBudgetTypes] = useState<BudgetType[]>(ALL_BUDGET_TYPES)
  const budgetTypeOptions = useMemo(
    () => BUDGET_TYPES.map((t) => ({ label: t.label, value: t.value })),
    [],
  )

  // 项目 id → 名称 查找表
  const projectNameMap = useMemo(() => {
    const map = new Map<string, string>()
    projects.forEach((project) => map.set(project.id, project.name))
    return map
  }, [projects])

  // 组装表格行：将项目名称挂到每条月度投入记录上，并按预算类型筛选
  const dataSource = useMemo<MonthlyInvestmentRow[]>(
    () =>
      monthlyInvestments
        .filter((mi) => selectedBudgetTypes.includes(mi.budgetType))
        .map((mi) => ({
          ...mi,
          projectName: projectNameMap.get(mi.projectId) ?? '-',
        })),
    [monthlyInvestments, projectNameMap, selectedBudgetTypes],
  )

  // 收集筛选后所有出现过的月份 key，并按时间正序排列
  const sortedMonths = useMemo(() => {
    const monthSet = new Set<string>()
    dataSource.forEach((mi) => {
      Object.keys(mi.monthlyData).forEach((key) => monthSet.add(key))
    })
    return [...monthSet].sort((a, b) => a.localeCompare(b))
  }, [dataSource])

  // 构建列：固定左侧基础列 + 动态月度列 + 固定右侧操作列
  const columns = useMemo<ColumnsType<MonthlyInvestmentRow>>(() => {
    const baseColumns: ColumnsType<MonthlyInvestmentRow> = [
      {
        title: '项目名称',
        dataIndex: 'projectName',
        key: 'projectName',
        width: 200,
        fixed: 'left',
        render: (value: string, record: MonthlyInvestmentRow) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Tooltip title={value}>
              <span style={{ fontWeight: 600, color: 'var(--pms-text-primary)' }}>{value}</span>
            </Tooltip>
            {record.isEdited && (
              <Tag color="blue" style={{ fontSize: 11, marginInlineEnd: 0 }}>
                已编辑
              </Tag>
            )}
          </div>
        ),
      },
      {
        title: '一级部门',
        dataIndex: 'primaryDepartment',
        key: 'primaryDepartment',
        width: 120,
        render: (value: string) => value || '-',
      },
      {
        title: '二级部门',
        dataIndex: 'secondaryDepartment',
        key: 'secondaryDepartment',
        width: 120,
        render: (value: string) => value || '-',
      },
      {
        title: '预算类型',
        dataIndex: 'budgetType',
        key: 'budgetType',
        width: 100,
        render: (value: MonthlyInvestment['budgetType']) =>
          BUDGET_TYPE_LABELS[value] ?? value,
      },
      {
        title: '版本号',
        dataIndex: 'versionNumber',
        key: 'versionNumber',
        width: 100,
        render: (value: string) => value || '-',
      },
      {
        title: '预估合计',
        dataIndex: 'estimatedTotal',
        key: 'estimatedTotal',
        width: 110,
        align: 'right',
        render: (value: number) => (
          <span style={{ fontWeight: 600 }}>{formatPersonMonth(value)}</span>
        ),
      },
    ]

    // 动态月度列：横向展示每个月的投入（人月）
    const monthColumns: ColumnsType<MonthlyInvestmentRow> = sortedMonths.map(
      (monthKey) => ({
        title: formatMonthLabel(monthKey),
        key: `month-${monthKey}`,
        width: 100,
        align: 'right',
        render: (_value: unknown, record: MonthlyInvestmentRow) =>
          formatPersonMonth(record.monthlyData[monthKey] ?? 0),
      }),
    )

    // 操作列：固定在右侧，点击触发编辑
    const actionColumn: ColumnsType<MonthlyInvestmentRow> = [
      {
        title: '操作',
        key: 'action',
        width: 80,
        fixed: 'right',
        align: 'center',
        render: (_value: unknown, record: MonthlyInvestmentRow) => (
          <Tooltip title="编辑月度投入">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={(e) => {
                e.stopPropagation()
                onEditMonthly(record.id)
              }}
            />
          </Tooltip>
        ),
      },
    ]

    return [...baseColumns, ...monthColumns, ...actionColumn]
  }, [sortedMonths, onEditMonthly])

  return (
    <div className="pms-monthly-investment-tab">
      <Card
        className="pms-toolbar"
        size="small"
        style={{ marginBottom: 12 }}
        styles={{ body: { padding: '10px 16px' } }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <Space size={12} wrap>
            <span style={{ color: 'var(--pms-text-secondary)', fontSize: 13, whiteSpace: 'nowrap' }}>
              预算类型
            </span>
            <Checkbox.Group
              options={budgetTypeOptions}
              value={selectedBudgetTypes}
              onChange={(checkedValues) => setSelectedBudgetTypes(checkedValues as BudgetType[])}
            />
            <span style={{ color: 'var(--pms-text-tertiary)', fontSize: 12, whiteSpace: 'nowrap' }}>
              投入记录：{dataSource.length} 条 · 月度列：{sortedMonths.length} 列
            </span>
          </Space>
          <span style={{ fontSize: 12, color: 'var(--pms-text-secondary)' }}>
            仅展示各预算类型最新锁定版本的月度投入；系统按机型阶段自动拆分，点击行可手动编辑
          </span>
        </div>
      </Card>

      <div className="pms-solid-surface">
        <Table<MonthlyInvestmentRow>
          className="pms-table"
          rowKey="id"
          columns={columns}
          dataSource={dataSource}
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 15, showTotal: (t) => '共 ' + t + ' 条' }}
          onRow={(record) => ({
            style: { cursor: 'pointer' },
            onClick: () => onEditMonthly(record.id),
          })}
        />
      </div>
    </div>
  )
}
