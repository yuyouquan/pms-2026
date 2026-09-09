'use client'

import { useState, useMemo, useCallback } from 'react'
import { Card, Table, Select, Button, Space, Tooltip, Popover } from 'antd'
import { PlusOutlined, DownloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useHrTosStore } from '@/stores/hrTos'
import {
  formatPersonMonth,
  formatPercent,
} from '@/constants/hrTos'
import type { HrTosProject, HrTosVersion, BudgetType } from '@/types/hrTos'
import { exportSheet, exportTimestamp } from '@/utils/exportExcel'
import type { ExportColumn } from '@/utils/exportExcel'
import { useProjectStore } from '@/stores/project'
import { getHrFormalProjectOptions } from '@/lib/hrFormalProjectSource'

/* ── 正式项目编码单元格（独立组件，内部管理 Popover 状态） ─────────── */
function IpmCodeCell({
  record,
  bindIpmProject,
}: {
  record: HrTosProject
  bindIpmProject: (projectId: string, ipmCode: string) => void
}) {
  const [open, setOpen] = useState(false)
  const formalProjects = useProjectStore(s => s.projects)
  const options = useMemo(
    () => getHrFormalProjectOptions('tos', formalProjects).map(p => ({ value: p.code, label: `${p.code} - ${p.name}` })),
    [formalProjects],
  )

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
            options={options}
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
            <span style={{ color: 'var(--pms-brand-strong)', fontWeight: 600, fontSize: 12 }}>
              {record.ipmProjectCode}
            </span>
            {record.ipmProjectName && (
              <span style={{ color: 'var(--pms-text-secondary)', fontSize: 12, marginTop: 2 }}>
                {record.ipmProjectName}
              </span>
            )}
          </>
        ) : (
          <span style={{ color: 'var(--pms-text-tertiary)', fontSize: 12 }}>未绑定</span>
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
  const projects = useHrTosStore(s => s.projects)
  const filters = useHrTosStore(s => s.filters)
  const setFilters = useHrTosStore(s => s.setFilters)
  const bindIpmProject = useHrTosStore(s => s.bindIpmProject)
  const getLatestVersions = useHrTosStore(s => s.getLatestVersions)

  // 1. 按项目名称（多选）/ 是否取消暂停 过滤
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      if (filters.projectName.length > 0 && !filters.projectName.includes(p.name)) return false
      return true
    })
  }, [projects, filters.projectName])

  // 2. 为每个项目计算各预算类型的最新版本（通过 store 的 getLatestVersions）
  const projectLatestVersions = useMemo(() => {
    const map = new Map<string, Record<BudgetType, HrTosVersion | null>>()
    for (const p of filteredProjects) {
      const latest = getLatestVersions(p.id)
      const byType: Record<BudgetType, HrTosVersion | null> = {
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

  // 4. 列定义（数字列右对齐；三预算列展示最新版本数据）
  const columns: ColumnsType<HrTosProject> = useMemo(() => {
    /** 取指定项目+预算类型的最新版本 */
    const getLatestForType = (
      record: HrTosProject,
      budgetType: BudgetType,
    ): HrTosVersion | null => {
      return projectLatestVersions.get(record.id)?.[budgetType] ?? null
    }

    return [
      {
        title: '项目名称',
        dataIndex: 'name',
        key: 'name',
        fixed: 'left',
        width: 220,
        ellipsis: true,
        render: (text: string, record: HrTosProject) => (
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
        fixed: 'left',
        width: 180,
        render: (_value: string | null, record: HrTosProject) => (
          <IpmCodeCell record={record} bindIpmProject={bindIpmProject} />
        ),
      },
      {
        title: '项目目标',
        dataIndex: 'projectTarget',
        key: 'projectTarget',
        width: 280,
        ellipsis: true,
        render: (text: string) => (
          <Tooltip title={text}>
            <span style={{ color: 'var(--pms-text-primary)' }}>{text}</span>
          </Tooltip>
        ),
      },

      {
        title: '年度预算',
        key: 'annualBudget',
        width: 120,
        align: 'right',
        render: (_value: number, record: HrTosProject) => {
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
        render: (_value: number, record: HrTosProject) => {
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
        render: (_value: number, record: HrTosProject) => {
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
        render: (_value: number, record: HrTosProject) =>
          record.projectBudget
            ? formatPercent(record.projectAccounting / record.projectBudget)
            : '-',
      },
    ]
  }, [projectLatestVersions, bindIpmProject])

  // 5. 筛选器选项
  const projectNameOptions = useMemo(
    () => projects.map(p => ({ value: p.name, label: p.name })),
    [projects],
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
      { key: 'projectTarget', title: '项目目标', width: 30 },

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
          row.projectBudget
            ? formatPercent(row.projectAccounting / row.projectBudget)
            : '-',
      },
    ]
    exportSheet(
      filteredProjects,
      exportColumns,
      `tOS项目列表_${exportTimestamp()}.xlsx`,
      'tOS项目列表',
    )
  }, [filteredProjects, projectLatestVersions])

  return (
    <div className="pms-hr-tos-project-list">
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
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <Space size={12} wrap style={{ flex: 1, minWidth: 0 }}>
            <Space size={6}>
              <span
                style={{
                  color: 'var(--pms-text-secondary)',
                  fontSize: 12,
                  whiteSpace: 'nowrap',
                }}
              >
                项目名称
              </span>
              <Select
                mode="multiple"
                allowClear
                maxTagCount="responsive"
                style={{ minWidth: 200, maxWidth: 280 }}
                placeholder="全部项目"
                value={filters.projectName}
                options={projectNameOptions}
                onChange={value => setFilters({ projectName: value as string[] })}
              />
            </Space>

          </Space>

          <Space size={8} style={{ flexShrink: 0 }}>
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
      <Table<HrTosProject>
        className="pms-table pms-hr-investment-table"
        rowKey="id"
        columns={columns}
        dataSource={filteredProjects}
        tableLayout="fixed"
        scroll={{ x: columns.reduce((total, column) => total + Number(column.width ?? 0), 0) }}
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
              <Table.Summary.Cell index={3} align="right">
                {formatPersonMonth(totals.annualBudget)}
              </Table.Summary.Cell>
              <Table.Summary.Cell index={4} align="right">
                {formatPersonMonth(totals.projectEstimate)}
              </Table.Summary.Cell>
              <Table.Summary.Cell index={5} align="right">
                {formatPersonMonth(totals.projectBudget)}
              </Table.Summary.Cell>
              <Table.Summary.Cell index={6} align="right">
                {formatPersonMonth(totals.projectAccounting)}
              </Table.Summary.Cell>
              <Table.Summary.Cell index={7} align="right">
                {totals.projectBudget
                  ? formatPercent(totals.projectAccounting / totals.projectBudget)
                  : '-'}
              </Table.Summary.Cell>
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />

      <style jsx global>{`
        .pms-hr-tos-project-list .pms-table {
          font-variant-numeric: tabular-nums;
        }
        /* 将合计行（tfoot）提升至表头下方、表体上方显示 */
        .pms-hr-tos-project-list .pms-table tfoot.ant-table-summary {
          display: table-header-group;
        }
        .pms-hr-tos-project-list .pms-table .pms-summary-row > td {
          background: var(--pms-brand-surface) !important;
          color: var(--pms-text-primary);
          font-weight: 600;
          border-top: 1px solid var(--pms-brand-border);
        }
        /* 已取消项目：灰色背景 + 半透明 */
        .pms-hr-tos-project-list .pms-table .pms-row-cancelled > td {
          background: #f0f0f0 !important;
        }
        .pms-hr-tos-project-list .pms-table .pms-row-cancelled {
          opacity: 0.7;
        }
        .pms-hr-tos-project-list .pms-table .pms-row-cancelled:hover > td {
          background: #e8e8e8 !important;
        }
        /* IPM 编码列样式 */
        .pms-hr-tos-project-list .pms-table .pms-ipm-code-cell {
          cursor: pointer;
          transition: background 0.2s;
          border-radius: 4px;
          padding: 2px 4px;
          margin: -2px -4px;
        }
        .pms-hr-tos-project-list .pms-table .pms-ipm-code-cell:hover {
          background: var(--pms-brand-surface);
        }
      `}</style>
    </div>
  )
}
