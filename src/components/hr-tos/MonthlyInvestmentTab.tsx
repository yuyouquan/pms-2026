'use client'

import MonthlyAllocationNotice from '@/components/hr-shared/MonthlyAllocationNotice'
import { canAccessHrProject } from '@/lib/hrProjectRegistry'
import { useMemo, useState } from 'react'
import { Card, Table, Button, Tooltip, Tag, Checkbox, Space, Input, Select } from 'antd'
import { EditOutlined, DownloadOutlined, SearchOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useHrTosStore } from '@/hooks/useHrResourceStores'
import {
  TOS_BUDGET_TYPES,
  TOS_BUDGET_TYPE_LABELS,
  formatPersonMonth,
} from '@/constants/hrTos'
import type { TosMonthlyInvestment, BudgetType } from '@/types/hrTos'
import { exportSheet, exportTimestamp } from '@/utils/exportExcel'
import type { ExportColumn } from '@/utils/exportExcel'
import MonthlyEditModal from './MonthlyEditModal'

/** 表格行：在月度投入记录上附加项目信息，便于直接渲染 */
interface MonthlyInvestmentRow extends TosMonthlyInvestment {
  projectName: string
}

/** 将 "YYYY-MM" 月度 key 格式化为表头 "YYYY年MM月" */
function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-')
  return `${year}年${month}月`
}

export default function MonthlyInvestmentTab() {
  const monthlyInvestments = useHrTosStore((s) => s.monthlyInvestments)
  const projects = useHrTosStore((s) => s.projects)

  // ── 编辑弹框：组件内部管理，直接弹出 ──────────────────────
  const [editingMonthlyId, setEditingMonthlyId] = useState<string | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)

  const handleEdit = (id: string) => {
    setEditingMonthlyId(id)
    setShowEditModal(true)
  }

  // ── 筛选状态（多选，空数组=不筛选） ──────────────────────
  const ALL_BUDGET_TYPES: BudgetType[] = TOS_BUDGET_TYPES.map((t) => t.value)
  const [selectedBudgetTypes, setSelectedBudgetTypes] = useState<BudgetType[]>(ALL_BUDGET_TYPES)
  const [selectedPrimaryDepartments, setSelectedPrimaryDepartments] = useState<string[]>([])
  const [selectedSecondaryDepartments, setSelectedSecondaryDepartments] = useState<string[]>([])
  const [projectNameSearch, setProjectNameSearch] = useState<string>('')

  const budgetTypeOptions = useMemo(
    () => TOS_BUDGET_TYPES.map((t) => ({ label: t.label, value: t.value })),
    [],
  )

  // ── 从数据中收集唯一的一级/二级部门 ──────────────────────
  const primaryDepartmentOptions = useMemo(() => {
    const set = new Set<string>()
    monthlyInvestments.forEach((mi) => {
      if (mi.primaryDepartment) set.add(mi.primaryDepartment)
    })
    return [...set].sort().map((d) => ({ value: d, label: d }))
  }, [monthlyInvestments])

  const secondaryDepartmentOptions = useMemo(() => {
    const set = new Set<string>()
    monthlyInvestments.forEach((mi) => {
      if (mi.secondaryDepartment) set.add(mi.secondaryDepartment)
    })
    return [...set].sort().map((d) => ({ value: d, label: d }))
  }, [monthlyInvestments])

  // ── 项目查找表：id → name ─────────────────────────────
  const projectMap = useMemo(() => {
    const map = new Map<string, string>()
    projects.forEach((project) => map.set(project.id, project.name))
    return map
  }, [projects])

  // ── 组装表格行：挂载项目信息 + 多条件筛选 ──────────────────
  const dataSource = useMemo<MonthlyInvestmentRow[]>(() => {
    const keyword = projectNameSearch.trim().toLowerCase()
    return monthlyInvestments
      .filter((mi) => selectedBudgetTypes.includes(mi.budgetType))
      .map((mi) => ({
        ...mi,
        projectName: projectMap.get(mi.projectId) ?? '-',
      }))
      .filter((row) => {
        if (
          selectedPrimaryDepartments.length > 0 &&
          !selectedPrimaryDepartments.includes(row.primaryDepartment)
        )
          return false
        if (
          selectedSecondaryDepartments.length > 0 &&
          !selectedSecondaryDepartments.includes(row.secondaryDepartment)
        )
          return false
        if (keyword && !row.projectName.toLowerCase().includes(keyword)) return false
        return true
      })
  }, [
    monthlyInvestments,
    projectMap,
    selectedBudgetTypes,
    selectedPrimaryDepartments,
    selectedSecondaryDepartments,
    projectNameSearch,
  ])

  // ── 收集筛选后所有出现过的月份 key，并按时间正序排列 ────────
  const sortedMonths = useMemo(() => {
    const monthSet = new Set<string>()
    dataSource.forEach((mi) => {
      Object.keys(mi.monthlyData).forEach((key) => monthSet.add(key))
    })
    return [...monthSet].sort((a, b) => a.localeCompare(b))
  }, [dataSource])

  // ── 合计行数据：预估合计 + 各月汇总 ────────────────────────
  const totalRow = useMemo(() => {
    let totalEstimated = 0
    const monthlyTotals: Record<string, number> = {}
    for (const row of dataSource) {
      totalEstimated += row.estimatedTotal || 0
      for (const monthKey of Object.keys(row.monthlyData)) {
        monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + (row.monthlyData[monthKey] || 0)
      }
    }
    return { totalEstimated, monthlyTotals }
  }, [dataSource])

  // ── 构建列：固定左侧基础列 + 动态月度列 + 固定右侧操作列 ────
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
              <Tag color="blue" style={{ fontSize: 12, marginInlineEnd: 0 }}>
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
        render: (value: TosMonthlyInvestment['budgetType']) =>
          TOS_BUDGET_TYPE_LABELS[value] ?? value,
      },
      {
        title: '版本号',
        dataIndex: 'versionNumber',
        key: 'versionNumber',
        width: 90,
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
              disabled={!canAccessHrProject(projects.find(project => project.id === record.projectId), true)}
              icon={<EditOutlined />}
              onClick={(e) => {
                e.stopPropagation()
                handleEdit(record.id)
              }}
            />
          </Tooltip>
        ),
      },
    ]

    return [...baseColumns, ...monthColumns, ...actionColumn]
  }, [sortedMonths, projects])

  // ── 导出：遵循当前筛选结果 ─────────────────────────────────
  const handleExport = () => {
    const exportColumns: ExportColumn[] = [
      { key: 'projectName', title: '项目名称', width: 20 },
      { key: 'primaryDepartment', title: '一级部门', width: 12 },
      { key: 'secondaryDepartment', title: '二级部门', width: 12 },
      {
        key: 'budgetType',
        title: '预算类型',
        width: 10,
        formatter: (value) => TOS_BUDGET_TYPE_LABELS[value as BudgetType] ?? String(value),
      },
      { key: 'versionNumber', title: '版本号', width: 10 },
      {
        key: 'estimatedTotal',
        title: '预估合计',
        width: 12,
        formatter: (value) => formatPersonMonth(Number(value)),
      },
      ...sortedMonths.map<ExportColumn>((monthKey) => ({
        key: `month_${monthKey}`,
        title: formatMonthLabel(monthKey),
        width: 12,
        formatter: (_value, row) =>
          formatPersonMonth(
            (row as MonthlyInvestmentRow).monthlyData?.[monthKey] ?? 0,
          ),
      })),
    ]

    exportSheet(
      dataSource,
      exportColumns,
      `月度预估投入_${exportTimestamp()}.xlsx`,
      '月度预估投入',
    )
  }

  return (
    <div className="pms-tos-monthly-investment-tab">
      <Card
        className="pms-toolbar"
        size="small"
        style={{ marginBottom: 12 }}
        styles={{ body: { padding: '10px 16px' } }}
      >
        {/* 第一行：左侧筛选 + 右侧导出 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <Space size={12} wrap style={{ flex: 1, minWidth: 0 }}>
            <span
              style={{
                color: 'var(--pms-text-secondary)',
                fontSize: 12,
                whiteSpace: 'nowrap',
              }}
            >
              预算类型
            </span>
            <Checkbox
              checked={
                selectedBudgetTypes.length > 0 &&
                selectedBudgetTypes.length === ALL_BUDGET_TYPES.length
              }
              indeterminate={
                selectedBudgetTypes.length > 0 &&
                selectedBudgetTypes.length < ALL_BUDGET_TYPES.length
              }
              onChange={(e) =>
                setSelectedBudgetTypes(e.target.checked ? [...ALL_BUDGET_TYPES] : [])
              }
            >
              全选
            </Checkbox>
            <Checkbox.Group
              options={budgetTypeOptions}
              value={selectedBudgetTypes}
              onChange={(checkedValues) =>
                setSelectedBudgetTypes(checkedValues as BudgetType[])
              }
            />

            <Space size={6}>
              <span
                style={{
                  color: 'var(--pms-text-secondary)',
                  fontSize: 12,
                  whiteSpace: 'nowrap',
                }}
              >
                一级部门
              </span>
              <Select
                mode="multiple"
                maxTagCount="responsive"
                style={{ minWidth: 170, maxWidth: 240 }}
                placeholder="全部一级部门"
                value={selectedPrimaryDepartments}
                options={primaryDepartmentOptions}
                onChange={(value) => setSelectedPrimaryDepartments(value as string[])}
              />
            </Space>

            <Space size={6}>
              <span
                style={{
                  color: 'var(--pms-text-secondary)',
                  fontSize: 12,
                  whiteSpace: 'nowrap',
                }}
              >
                二级部门
              </span>
              <Select
                mode="multiple"
                maxTagCount="responsive"
                style={{ minWidth: 170, maxWidth: 240 }}
                placeholder="全部二级部门"
                value={selectedSecondaryDepartments}
                options={secondaryDepartmentOptions}
                onChange={(value) => setSelectedSecondaryDepartments(value as string[])}
              />
            </Space>

            <Input
              allowClear
              placeholder="搜索项目名称"
              prefix={<SearchOutlined style={{ color: 'var(--pms-text-tertiary)' }} />}
              style={{ width: 200 }}
              value={projectNameSearch}
              onChange={(e) => setProjectNameSearch(e.target.value)}
            />
          </Space>

          <Button icon={<DownloadOutlined />} onClick={handleExport} style={{ flexShrink: 0 }}>
            导出
          </Button>
        </div>

        {/* 第二行：记录数信息 */}
        <div
          style={{
            marginTop: 8,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <span
            style={{
              color: 'var(--pms-text-tertiary)',
              fontSize: 12,
              whiteSpace: 'nowrap',
            }}
          >
            投入记录：{dataSource.length} 条 · 月度列：{sortedMonths.length} 列 ·
            按配置中心部门拆分，仅展示各预算类型最新版本
          </span>

        </div>
      </Card>

      <MonthlyAllocationNotice records={dataSource} />

      <div className="pms-solid-surface">
        <Table<MonthlyInvestmentRow>
          className="pms-table pms-hr-investment-table"
          rowKey="id"
          columns={columns}
          dataSource={dataSource}
          tableLayout="fixed"
          scroll={{ x: columns.reduce((total, column) => total + Number(column.width ?? 0), 0) }}
          pagination={{ pageSize: 15, showTotal: (t) => '共 ' + t + ' 条' }}
          onRow={(record) => ({
            style: { cursor: 'pointer' },
            onClick: () => handleEdit(record.id),
          })}
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row className="pms-summary-row">
                <Table.Summary.Cell index={0}>
                  <span style={{ fontWeight: 700 }}>合计</span>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1} />
                <Table.Summary.Cell index={2} />
                <Table.Summary.Cell index={3} />
                <Table.Summary.Cell index={4} />
                <Table.Summary.Cell index={5} align="right">
                  <span style={{ fontWeight: 700 }}>
                    {formatPersonMonth(totalRow.totalEstimated)}
                  </span>
                </Table.Summary.Cell>
                {sortedMonths.map((monthKey, idx) => (
                  <Table.Summary.Cell key={`total-${monthKey}`} index={6 + idx} align="right">
                    <span style={{ fontWeight: 600 }}>
                      {formatPersonMonth(totalRow.monthlyTotals[monthKey] || 0)}
                    </span>
                  </Table.Summary.Cell>
                ))}
                <Table.Summary.Cell index={6 + sortedMonths.length} />
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </div>

      {/* 编辑弹框：直接在本组件内弹出，不跳转单项目空间 */}
      <MonthlyEditModal
        open={showEditModal}
        monthlyId={editingMonthlyId}
        onCancel={() => {
          setShowEditModal(false)
          setEditingMonthlyId(null)
        }}
      />

      <style jsx global>{`
        .pms-tos-monthly-investment-tab .pms-table {
          font-variant-numeric: tabular-nums;
        }
        /* 合计行：品牌色背景突出显示 */
        .pms-tos-monthly-investment-tab .pms-table .pms-summary-row > td {
          background: var(--pms-brand-surface) !important;
          color: var(--pms-brand-strong);
          font-weight: 600;
          border-top: 2px solid var(--pms-brand-border);
        }
        .pms-tos-monthly-investment-tab .pms-table .pms-summary-row:hover > td {
          background: var(--pms-brand-surface) !important;
        }
      `}</style>
    </div>
  )
}
