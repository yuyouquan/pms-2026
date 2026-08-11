'use client'

import { useState, useMemo, useCallback } from 'react'
import { Card, Table, Input, Select, Button, Space, Switch, Tooltip, Popover } from 'antd'
import { PlusOutlined, SearchOutlined, DownloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useHrMachineStore } from '@/stores/hrMachine'
import {
  MACHINE_BRANDS,
  MACHINE_PRODUCT_LINES,
  PROJECT_YEARS,
  IPM_PROJECTS,
  formatPersonMonth,
  formatPercent,
} from '@/constants/hrMachine'
import type { HrMachineProject, HrMachineVersion, BudgetType } from '@/types/hrMachine'
import { exportSheet, exportTimestamp } from '@/utils/exportExcel'
import type { ExportColumn } from '@/utils/exportExcel'

/* ── IPM 项目下拉选项（模块级常量，避免重复计算） ──────────────────── */
const IPM_PROJECT_OPTIONS = IPM_PROJECTS.map(p => ({
  value: p.code,
  label: `${p.code} - ${p.name}`,
}))

/* ── 正式项目编码单元格（独立组件，内部管理 Popover 状态） ─────────── */
function IpmCodeCell({
  record,
  bindIpmProject,
}: {
  record: HrMachineProject
  bindIpmProject: (projectId: string, ipmCode: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover
      trigger="click"
      placement="bottomLeft"
      open={open}
      onOpenChange={setOpen}
      content={
        <div onClick={e => e.stopPropagation()} style={{ width: 300 }}>
          <Select
            showSearch
            style={{ width: '100%' }}
            placeholder="选择 IPM 正式项目"
            value={record.ipmProjectCode ?? undefined}
            options={IPM_PROJECT_OPTIONS}
            optionFilterProp="label"
            onChange={(code: string) => {
              bindIpmProject(record.id, code)
              setOpen(false)
            }}
          />
        </div>
      }
    >
      <div
        className="pms-ipm-code-cell"
        onClick={e => e.stopPropagation()}
        style={{ minHeight: 32, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
      >
        {record.ipmProjectCode ? (
          <>
            <span style={{ color: 'var(--pms-brand-strong)', fontWeight: 600, fontSize: 13 }}>
              {record.ipmProjectCode}
            </span>
            {record.ipmProjectName && (
              <span style={{ color: 'var(--pms-text-secondary)', fontSize: 11, marginTop: 2 }}>
                {record.ipmProjectName}
              </span>
            )}
          </>
        ) : (
          <span style={{ color: 'var(--pms-text-tertiary)', fontSize: 13 }}>未绑定</span>
        )}
      </div>
    </Popover>
  )
}

/* ── 主组件 ────────────────────────────────────────────────────────── */

interface ProjectListTabProps {
  onSelectProject: (projectId: string) => void
  onNewProject: () => void
}

export default function ProjectListTab({ onSelectProject, onNewProject }: ProjectListTabProps) {
  const projects = useHrMachineStore(s => s.projects)
  const filters = useHrMachineStore(s => s.filters)
  const setFilters = useHrMachineStore(s => s.setFilters)
  const bindIpmProject = useHrMachineStore(s => s.bindIpmProject)
  const getLatestVersions = useHrMachineStore(s => s.getLatestVersions)

  // 1. 按品牌 / 产品线 / 项目名称（子串）/ 项目年份 / 是否取消暂停 过滤
  const filteredProjects = useMemo(() => {
    const keyword = filters.projectName.trim().toLowerCase()
    return projects.filter(p => {
      if (filters.brand !== 'all' && p.brand !== filters.brand) return false
      if (filters.productLine !== 'all' && p.productLine !== filters.productLine) return false
      if (keyword && !p.name.toLowerCase().includes(keyword)) return false
      if (filters.projectYear !== 'all' && p.projectYear !== filters.projectYear) return false
      if (!filters.showCancelled && p.status === 'cancelled') return false
      return true
    })
  }, [projects, filters.brand, filters.productLine, filters.projectName, filters.projectYear, filters.showCancelled])

  // 2. 为每个项目计算各预算类型的最新版本（通过 store 的 getLatestVersions）
  const projectLatestVersions = useMemo(() => {
    const map = new Map<string, Record<BudgetType, HrMachineVersion | null>>()
    for (const p of filteredProjects) {
      const latest = getLatestVersions(p.id)
      const byType: Record<BudgetType, HrMachineVersion | null> = {
        annual: latest.find(v => v.budgetType === 'annual') ?? null,
        projectEstimate: latest.find(v => v.budgetType === 'projectEstimate') ?? null,
        projectBudget: latest.find(v => v.budgetType === 'projectBudget') ?? null,
      }
      map.set(p.id, byType)
    }
    return map
  }, [filteredProjects, getLatestVersions])

  // 3. 合计行：三预算列取最新版本 estimatedInvestment 之和；项目核算取项目字段之和
  const totals = useMemo(() => {
    return filteredProjects.reduce(
      (acc, p) => {
        const byType = projectLatestVersions.get(p.id)
        acc.annualBudget += byType?.annual?.estimatedInvestment ?? 0
        acc.projectEstimate += byType?.projectEstimate?.estimatedInvestment ?? 0
        acc.projectBudget += byType?.projectBudget?.estimatedInvestment ?? 0
        acc.projectAccounting += p.projectAccounting
        return acc
      },
      { annualBudget: 0, projectEstimate: 0, projectBudget: 0, projectAccounting: 0 },
    )
  }, [filteredProjects, projectLatestVersions])

  // 4. 列定义（数字列右对齐；三预算列展示最新版本数据 + 锁定/未锁定颜色标记）
  const columns: ColumnsType<HrMachineProject> = useMemo(() => {
    /** 取指定项目+预算类型的最新版本 */
    const getLatestForType = (
      record: HrMachineProject,
      budgetType: BudgetType,
    ): HrMachineVersion | null => {
      return projectLatestVersions.get(record.id)?.[budgetType] ?? null
    }

    return [
      {
        title: '项目名称',
        dataIndex: 'name',
        key: 'name',
        width: 220,
        ellipsis: true,
        render: (text: string, record: HrMachineProject) => (
          <Tooltip title={text}>
            <span style={{ color: 'var(--pms-brand-strong)', fontWeight: 600 }}>{text}</span>
            {record.status === 'cancelled' && (
              <span style={{ marginLeft: 8, color: 'var(--pms-text-tertiary)', fontSize: 12 }}>
                已取消
              </span>
            )}
          </Tooltip>
        ),
      },
      {
        title: '正式项目编码',
        dataIndex: 'ipmProjectCode',
        key: 'ipmProjectCode',
        width: 180,
        render: (_value: string | null, record: HrMachineProject) => (
          <IpmCodeCell record={record} bindIpmProject={bindIpmProject} />
        ),
      },
      {
        title: '品牌',
        dataIndex: 'brand',
        key: 'brand',
        width: 100,
        render: (text: string) => (
          <span style={{ color: 'var(--pms-text-primary)' }}>{text}</span>
        ),
      },
      {
        title: '产品线',
        dataIndex: 'productLine',
        key: 'productLine',
        width: 100,
      },
      {
        title: '项目等级',
        dataIndex: 'projectLevel',
        key: 'projectLevel',
        width: 100,
        align: 'center',
        render: (text: string) => (
          <span
            style={{
              display: 'inline-block',
              minWidth: 28,
              padding: '2px 10px',
              borderRadius: 10,
              background: 'var(--pms-brand-surface)',
              color: 'var(--pms-brand-strong)',
              fontSize: 12,
              fontWeight: 600,
              border: '1px solid var(--pms-brand-border)',
            }}
          >
            {text}
          </span>
        ),
      },
      {
        title: '年度预算',
        key: 'annualBudget',
        width: 120,
        align: 'right',
        onCell: (record: HrMachineProject) => {
          const version = getLatestForType(record, 'annual')
          if (!version) return {}
          return {
            className: version.lockState === 'locked' ? 'pms-cell-locked' : 'pms-cell-unlocked',
          }
        },
        render: (_value: number, record: HrMachineProject) => {
          const version = getLatestForType(record, 'annual')
          if (!version) return <span style={{ color: 'var(--pms-text-tertiary)' }}>-</span>
          return formatPersonMonth(version.estimatedInvestment)
        },
      },
      {
        title: '项目概算',
        key: 'projectEstimate',
        width: 120,
        align: 'right',
        onCell: (record: HrMachineProject) => {
          const version = getLatestForType(record, 'projectEstimate')
          if (!version) return {}
          return {
            className: version.lockState === 'locked' ? 'pms-cell-locked' : 'pms-cell-unlocked',
          }
        },
        render: (_value: number, record: HrMachineProject) => {
          const version = getLatestForType(record, 'projectEstimate')
          if (!version) return <span style={{ color: 'var(--pms-text-tertiary)' }}>-</span>
          return formatPersonMonth(version.estimatedInvestment)
        },
      },
      {
        title: '项目预算',
        key: 'projectBudget',
        width: 120,
        align: 'right',
        onCell: (record: HrMachineProject) => {
          const version = getLatestForType(record, 'projectBudget')
          if (!version) return {}
          return {
            className: version.lockState === 'locked' ? 'pms-cell-locked' : 'pms-cell-unlocked',
          }
        },
        render: (_value: number, record: HrMachineProject) => {
          const version = getLatestForType(record, 'projectBudget')
          if (!version) return <span style={{ color: 'var(--pms-text-tertiary)' }}>-</span>
          return formatPersonMonth(version.estimatedInvestment)
        },
      },
      {
        title: '项目核算',
        dataIndex: 'projectAccounting',
        key: 'projectAccounting',
        width: 120,
        align: 'right',
        render: (v: number) => formatPersonMonth(v),
      },
      {
        title: '预算使用率',
        key: 'budgetUsageRate',
        width: 120,
        align: 'right',
        render: (_value: number, record: HrMachineProject) =>
          formatPercent(record.projectAccounting, record.projectBudget),
      },
    ]
  }, [projectLatestVersions, bindIpmProject])

  // 5. 筛选器选项
  const brandOptions = useMemo(
    () => [{ value: 'all' as const, label: '全部品牌' }, ...MACHINE_BRANDS],
    [],
  )
  const productLineOptions = useMemo(
    () => [{ value: 'all' as const, label: '全部产品线' }, ...MACHINE_PRODUCT_LINES],
    [],
  )
  const yearOptions = useMemo(
    () =>
      [
        { value: 'all' as const, label: '全部年份' },
        ...PROJECT_YEARS.map(y => ({ value: y, label: y })),
      ],
    [],
  )

  // 6. 导出当前筛选数据到 xlsx
  const handleExport = useCallback(() => {
    const exportColumns: ExportColumn[] = [
      { key: 'name', title: '项目名称', width: 20 },
      {
        key: 'ipmProjectCode',
        title: '正式项目编码',
        width: 18,
        formatter: (_v: any, row: any) => row.ipmProjectCode || '-',
      },
      { key: 'brand', title: '品牌', width: 10 },
      { key: 'productLine', title: '产品线', width: 10 },
      { key: 'projectLevel', title: '项目等级', width: 10 },
      {
        key: 'annualBudget',
        title: '年度预算',
        width: 12,
        formatter: (_v: any, row: any) => {
          const byType = projectLatestVersions.get(row.id)
          return byType?.annual ? formatPersonMonth(byType.annual.estimatedInvestment) : '-'
        },
      },
      {
        key: 'projectEstimate',
        title: '项目概算',
        width: 12,
        formatter: (_v: any, row: any) => {
          const byType = projectLatestVersions.get(row.id)
          return byType?.projectEstimate
            ? formatPersonMonth(byType.projectEstimate.estimatedInvestment)
            : '-'
        },
      },
      {
        key: 'projectBudget',
        title: '项目预算',
        width: 12,
        formatter: (_v: any, row: any) => {
          const byType = projectLatestVersions.get(row.id)
          return byType?.projectBudget
            ? formatPersonMonth(byType.projectBudget.estimatedInvestment)
            : '-'
        },
      },
      {
        key: 'projectAccounting',
        title: '项目核算',
        width: 12,
        formatter: (v: any) => formatPersonMonth(v),
      },
      {
        key: 'budgetUsageRate',
        title: '预算使用率',
        width: 12,
        formatter: (_v: any, row: any) =>
          formatPercent(row.projectAccounting, row.projectBudget),
      },
    ]
    exportSheet(
      filteredProjects,
      exportColumns,
      `项目列表_${exportTimestamp()}.xlsx`,
      '项目列表',
    )
  }, [filteredProjects, projectLatestVersions])

  return (
    <div className="pms-hr-machine-project-list">
      {/* 顶部筛选条 */}
      <Card
        className="pms-toolbar"
        size="small"
        style={{ borderRadius: 8, marginBottom: 12 }}
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
                style={{ width: 140 }}
                value={filters.brand}
                options={brandOptions}
                onChange={value => setFilters({ brand: value })}
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
                产品线
              </span>
              <Select
                style={{ width: 140 }}
                value={filters.productLine}
                options={productLineOptions}
                onChange={value => setFilters({ productLine: value })}
              />
            </Space>

            <Input
              allowClear
              placeholder="搜索项目名称"
              prefix={<SearchOutlined style={{ color: 'var(--pms-text-tertiary)' }} />}
              style={{ width: 200 }}
              value={filters.projectName}
              onChange={e => setFilters({ projectName: e.target.value })}
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
                style={{ width: 180 }}
                value={filters.projectYear}
                options={yearOptions}
                onChange={value => setFilters({ projectYear: value })}
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
                是否取消暂停
              </span>
              <Switch
                checkedChildren="是"
                unCheckedChildren="否"
                checked={filters.showCancelled}
                onChange={checked => setFilters({ showCancelled: checked })}
              />
            </Space>
          </Space>

          <Space size={8}>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              导出
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={onNewProject}>
              新建项目
            </Button>
          </Space>
        </div>
      </Card>

      {/* 项目列表 */}
      <Table<HrMachineProject>
        className="pms-table"
        rowKey="id"
        columns={columns}
        dataSource={filteredProjects}
        scroll={{ x: 'max-content' }}
        pagination={{ pageSize: 15, showTotal: t => '共 ' + t + ' 个项目' }}
        rowClassName={record => (record.status === 'cancelled' ? 'pms-row-cancelled' : '')}
        onRow={record => ({
          onClick: () => onSelectProject(record.id),
          style: { cursor: 'pointer' },
        })}
        summary={() => (
          <Table.Summary>
            <Table.Summary.Row className="pms-summary-row">
              <Table.Summary.Cell index={0}>合计</Table.Summary.Cell>
              <Table.Summary.Cell index={1} />
              <Table.Summary.Cell index={2} />
              <Table.Summary.Cell index={3} />
              <Table.Summary.Cell index={4} />
              <Table.Summary.Cell index={5} align="right">
                {formatPersonMonth(totals.annualBudget)}
              </Table.Summary.Cell>
              <Table.Summary.Cell index={6} align="right">
                {formatPersonMonth(totals.projectEstimate)}
              </Table.Summary.Cell>
              <Table.Summary.Cell index={7} align="right">
                {formatPersonMonth(totals.projectBudget)}
              </Table.Summary.Cell>
              <Table.Summary.Cell index={8} align="right">
                {formatPersonMonth(totals.projectAccounting)}
              </Table.Summary.Cell>
              <Table.Summary.Cell index={9} align="right">
                {formatPercent(totals.projectAccounting, totals.projectBudget)}
              </Table.Summary.Cell>
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />

      <style jsx global>{`
        .pms-hr-machine-project-list .pms-table {
          font-variant-numeric: tabular-nums;
        }
        /* 将合计行（tfoot）提升至表头下方、表体上方显示 */
        .pms-hr-machine-project-list .pms-table tfoot.ant-table-summary {
          display: table-header-group;
        }
        .pms-hr-machine-project-list .pms-table .pms-summary-row > td {
          background: var(--pms-brand-surface) !important;
          color: var(--pms-text-primary);
          font-weight: 600;
          border-top: 1px solid var(--pms-brand-border);
        }
        /* 已取消项目：灰色背景 + 半透明 */
        .pms-hr-machine-project-list .pms-table .pms-row-cancelled > td {
          background: #f0f0f0 !important;
        }
        .pms-hr-machine-project-list .pms-table .pms-row-cancelled {
          opacity: 0.7;
        }
        .pms-hr-machine-project-list .pms-table .pms-row-cancelled:hover > td {
          background: #e8e8e8 !important;
        }
        /* 版本锁定状态：绿色背景 */
        .pms-hr-machine-project-list .pms-table td.pms-cell-locked {
          background: #f0f9eb !important;
        }
        .pms-hr-machine-project-list .pms-table tr:hover td.pms-cell-locked {
          background: #e6f4d6 !important;
        }
        /* 版本未锁定状态：灰色背景 */
        .pms-hr-machine-project-list .pms-table td.pms-cell-unlocked {
          background: #f5f5f5 !important;
        }
        .pms-hr-machine-project-list .pms-table tr:hover td.pms-cell-unlocked {
          background: #ececec !important;
        }
        /* IPM 编码列样式 */
        .pms-hr-machine-project-list .pms-table .pms-ipm-code-cell {
          cursor: pointer;
          transition: background 0.2s;
          border-radius: 4px;
          padding: 2px 4px;
          margin: -2px -4px;
        }
        .pms-hr-machine-project-list .pms-table .pms-ipm-code-cell:hover {
          background: var(--pms-brand-surface);
        }
      `}</style>
    </div>
  )
}
