'use client'

import { useMemo, useState } from 'react'
import { Card, Table, Button, Tooltip, Tag, Checkbox, Space, Input, Select } from 'antd'
import { EditOutlined, DownloadOutlined, SearchOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useHrMachineStore } from '@/stores/hrMachine'
import {
  BUDGET_TYPES,
  BUDGET_TYPE_LABELS,
  PROJECT_YEARS,
  MACHINE_BRANDS,
  formatPersonMonth,
} from '@/constants/hrMachine'
import type { MonthlyInvestment, BudgetType } from '@/types/hrMachine'
import { exportSheet, exportTimestamp } from '@/utils/exportExcel'
import type { ExportColumn } from '@/utils/exportExcel'

interface MonthlyInvestmentTabProps {
  onEditMonthly: (monthlyId: string) => void
}

/** 表格行：在月度投入记录上附加项目信息，便于直接渲染 */
interface MonthlyInvestmentRow extends MonthlyInvestment {
  projectName: string
  projectYear: string
  brand: string
}

/** 将 "YYYY-MM" 月度 key 格式化为表头 "YYYY年MM月" */
function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-')
  return `${year}年${month}月`
}

export default function MonthlyInvestmentTab({ onEditMonthly }: MonthlyInvestmentTabProps) {
  const monthlyInvestments = useHrMachineStore((s) => s.monthlyInvestments)
  const projects = useHrMachineStore((s) => s.projects)

  // ── 筛选状态 ──────────────────────────────────────────────
  const ALL_BUDGET_TYPES: BudgetType[] = BUDGET_TYPES.map((t) => t.value)
  const [selectedBudgetTypes, setSelectedBudgetTypes] = useState<BudgetType[]>(ALL_BUDGET_TYPES)
  const [selectedYear, setSelectedYear] = useState<string>('all')
  const [selectedBrand, setSelectedBrand] = useState<string>('all')
  const [projectNameSearch, setProjectNameSearch] = useState<string>('')

  const budgetTypeOptions = useMemo(
    () => BUDGET_TYPES.map((t) => ({ label: t.label, value: t.value })),
    [],
  )
  const yearOptions = useMemo(
    () =>
      [{ value: 'all', label: '全部年份' }, ...PROJECT_YEARS.map((y) => ({ value: y, label: y }))],
    [],
  )
  const brandOptions = useMemo(
    () => [
      { value: 'all', label: '全部品牌' },
      ...MACHINE_BRANDS.map((b) => ({ value: b.value, label: b.label })),
    ],
    [],
  )

  // ── 项目查找表：id → { name, projectYear, brand } ─────────
  const projectMap = useMemo(() => {
    const map = new Map<string, { name: string; projectYear: string; brand: string }>()
    projects.forEach((project) =>
      map.set(project.id, {
        name: project.name,
        projectYear: project.projectYear,
        brand: project.brand,
      }),
    )
    return map
  }, [projects])

  // ── 组装表格行：挂载项目信息 + 多条件筛选 ──────────────────
  const dataSource = useMemo<MonthlyInvestmentRow[]>(() => {
    const keyword = projectNameSearch.trim().toLowerCase()
    return monthlyInvestments
      .filter((mi) => selectedBudgetTypes.includes(mi.budgetType))
      .map((mi) => {
        const project = projectMap.get(mi.projectId)
        return {
          ...mi,
          projectName: project?.name ?? '-',
          projectYear: project?.projectYear ?? '-',
          brand: project?.brand ?? '-',
        }
      })
      .filter((row) => {
        if (selectedYear !== 'all' && row.projectYear !== selectedYear) return false
        if (selectedBrand !== 'all' && row.brand !== selectedBrand) return false
        if (keyword && !row.projectName.toLowerCase().includes(keyword)) return false
        return true
      })
  }, [monthlyInvestments, projectMap, selectedBudgetTypes, selectedYear, selectedBrand, projectNameSearch])

  // ── 收集筛选后所有出现过的月份 key，并按时间正序排列 ────────
  const sortedMonths = useMemo(() => {
    const monthSet = new Set<string>()
    dataSource.forEach((mi) => {
      Object.keys(mi.monthlyData).forEach((key) => monthSet.add(key))
    })
    return [...monthSet].sort((a, b) => a.localeCompare(b))
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
              <Tag color="blue" style={{ fontSize: 11, marginInlineEnd: 0 }}>
                已编辑
              </Tag>
            )}
          </div>
        ),
      },
      {
        title: '项目年份',
        dataIndex: 'projectYear',
        key: 'projectYear',
        width: 150,
        render: (value: string) => value || '-',
      },
      {
        title: '品牌',
        dataIndex: 'brand',
        key: 'brand',
        width: 90,
        render: (value: string) => (
          <span style={{ color: 'var(--pms-text-primary)' }}>{value || '-'}</span>
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
        width: 140,
        render: (value: string, record: MonthlyInvestmentRow) => (
          <Space size={4}>
            <span>{value || '-'}</span>
            <Tag
              color={record.versionLockState === 'locked' ? 'green' : 'default'}
              style={{ fontSize: 11, marginInlineEnd: 0 }}
            >
              {record.versionLockState === 'locked' ? '已锁定' : '未锁定'}
            </Tag>
          </Space>
        ),
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

  // ── 导出：遵循当前筛选结果 ─────────────────────────────────
  const handleExport = () => {
    const exportColumns: ExportColumn[] = [
      { key: 'projectName', title: '项目名称', width: 20 },
      { key: 'projectYear', title: '项目年份', width: 18 },
      { key: 'brand', title: '品牌', width: 10 },
      { key: 'primaryDepartment', title: '一级部门', width: 12 },
      { key: 'secondaryDepartment', title: '二级部门', width: 12 },
      {
        key: 'budgetType',
        title: '预算类型',
        width: 10,
        formatter: (value) => BUDGET_TYPE_LABELS[value as BudgetType] ?? String(value),
      },
      { key: 'versionNumber', title: '版本号', width: 10 },
      {
        key: 'versionLockState',
        title: '版本锁定状态',
        width: 12,
        formatter: (value) => (value === 'locked' ? '已锁定' : '未锁定'),
      },
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
    <div className="pms-monthly-investment-tab">
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
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <Space size={12} wrap>
            <span
              style={{
                color: 'var(--pms-text-secondary)',
                fontSize: 13,
                whiteSpace: 'nowrap',
              }}
            >
              预算类型
            </span>
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
                  fontSize: 13,
                  whiteSpace: 'nowrap',
                }}
              >
                项目年份
              </span>
              <Select
                style={{ width: 170 }}
                value={selectedYear}
                options={yearOptions}
                onChange={(value) => setSelectedYear(value)}
              />
            </Space>

            <Space size={6}>
              <span
                style={{
                  color: 'var(--pms-text-secondary)',
                  fontSize: 13,
                  whiteSpace: 'nowrap',
                }}
              >
                品牌
              </span>
              <Select
                style={{ width: 120 }}
                value={selectedBrand}
                options={brandOptions}
                onChange={(value) => setSelectedBrand(value)}
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

          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            导出
          </Button>
        </div>

        {/* 第二行：记录数信息 + 颜色图例 */}
        <div
          style={{
            marginTop: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
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
            仅展示各预算类型最新版本的月度投入
          </span>

          <Space size={16}>
            <span
              style={{
                fontSize: 12,
                color: 'var(--pms-text-secondary)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 14,
                  height: 14,
                  background: '#f0f9eb',
                  border: '1px solid #d9ebd0',
                  borderRadius: 2,
                }}
              />
              已锁定版本
            </span>
            <span
              style={{
                fontSize: 12,
                color: 'var(--pms-text-secondary)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 14,
                  height: 14,
                  background: '#f5f5f5',
                  border: '1px solid #e0e0e0',
                  borderRadius: 2,
                }}
              />
              未锁定版本
            </span>
          </Space>
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
          rowClassName={(record) =>
            record.versionLockState === 'locked' ? 'pms-row-locked' : 'pms-row-unlocked'
          }
          onRow={(record) => ({
            style: { cursor: 'pointer' },
            onClick: () => onEditMonthly(record.id),
          })}
        />
      </div>

      <style jsx global>{`
        .pms-monthly-investment-tab .pms-table {
          font-variant-numeric: tabular-nums;
        }
        /* 已锁定版本：绿色背景 */
        .pms-monthly-investment-tab .pms-table .pms-row-locked > td {
          background: #f0f9eb !important;
        }
        .pms-monthly-investment-tab .pms-table .pms-row-locked:hover > td {
          background: #e8f5e0 !important;
        }
        /* 未锁定版本：灰色背景 */
        .pms-monthly-investment-tab .pms-table .pms-row-unlocked > td {
          background: #f5f5f5 !important;
        }
        .pms-monthly-investment-tab .pms-table .pms-row-unlocked:hover > td {
          background: #ececec !important;
        }
      `}</style>
    </div>
  )
}
