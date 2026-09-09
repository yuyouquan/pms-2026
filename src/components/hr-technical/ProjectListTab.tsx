'use client'

import { useState, useMemo, useCallback } from 'react'
import { Card, Table, Select, Button, Space, Tooltip, Popover } from 'antd'
import { PlusOutlined, DownloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useHrTechnicalStore } from '@/stores/hrTechnical'
import {
  TECH_PLANNING_YEAR_OPTIONS,
  formatPersonMonth,
  formatPercent,
} from '@/constants/hrTechnical'
import type { HrTechnicalProject, HrTechnicalVersion, BudgetType } from '@/types/hrTechnical'
import { exportSheet, exportTimestamp } from '@/utils/exportExcel'
import type { ExportColumn } from '@/utils/exportExcel'
import { useProjectStore } from '@/stores/project'
import { getHrFormalProjectOptions } from '@/lib/hrFormalProjectSource'

/* ── 正式项目编码单元格 ───────────────────────────────────────────── */
function IpmCodeCell({
  record,
  bindIpmProject,
}: {
  record: HrTechnicalProject
  bindIpmProject: (projectId: string, ipmCode: string) => void
}) {
  const [open, setOpen] = useState(false)
  const formalProjects = useProjectStore(s => s.projects)
  const options = useMemo(
    () => getHrFormalProjectOptions('technical', formalProjects).map(p => ({ value: p.code, label: `${p.code} - ${p.name}` })),
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
  const projects = useHrTechnicalStore(s => s.projects)
  const filters = useHrTechnicalStore(s => s.filters)
  const setFilters = useHrTechnicalStore(s => s.setFilters)
  const bindIpmProject = useHrTechnicalStore(s => s.bindIpmProject)
  const getLatestVersions = useHrTechnicalStore(s => s.getLatestVersions)

  // 1. 按多条件过滤
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      if (filters.planningYear.length > 0 && !filters.planningYear.includes(p.planningYear)) return false
      if (filters.techDomain.length > 0 && !filters.techDomain.includes(p.techDomain)) return false
      if (filters.tmg.length > 0 && !filters.tmg.includes(p.tmg)) return false
      if (filters.techTrack.length > 0 && !filters.techTrack.includes(p.techTrack)) return false
      if (filters.subTrack.length > 0 && !filters.subTrack.includes(p.subTrack)) return false
      if (filters.subTaskName.length > 0 && !filters.subTaskName.includes(p.subTaskName)) return false
      return true
    })
  }, [projects, filters])

  // 2. 为每个项目计算各预算类型的最新版本
  const projectLatestVersions = useMemo(() => {
    const map = new Map<string, Record<BudgetType, HrTechnicalVersion | null>>()
    for (const p of filteredProjects) {
      const latest = getLatestVersions(p.id)
      const byType: Record<BudgetType, HrTechnicalVersion | null> = {
        annual: latest.find(v => v.budgetType === 'annual') ?? null,
        projectEstimate: latest.find(v => v.budgetType === 'projectEstimate') ?? null,
        projectBudget: latest.find(v => v.budgetType === 'projectBudget') ?? null,
      }
      map.set(p.id, byType)
    }
    return map
  }, [filteredProjects, getLatestVersions])

  // 3. 合计行
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

  // 4. 列定义
  const columns: ColumnsType<HrTechnicalProject> = useMemo(() => {
    const getLatestForType = (
      record: HrTechnicalProject,
      budgetType: BudgetType,
    ): HrTechnicalVersion | null => {
      return projectLatestVersions.get(record.id)?.[budgetType] ?? null
    }

    const techFieldCol = (dataIndex: keyof HrTechnicalProject, title: string, width: number) => ({
      title,
      dataIndex,
      key: dataIndex,
      width,
      ellipsis: true,
      render: (text: string, record: HrTechnicalProject) => (
        <Tooltip title={text}>
          <span style={{ color: 'var(--pms-text-primary)' }}>{text}</span>
          {record.status === 'cancelled' && dataIndex === 'tdtName' && (
            <span style={{ marginLeft: 8, color: 'var(--pms-text-tertiary)', fontSize: 12 }}>
              已取消
            </span>
          )}
        </Tooltip>
      ),
    })

    return [
      {
        ...techFieldCol('tdtName', 'TDT项目名称', 200),
        fixed: 'left',
        render: (text: string, record: HrTechnicalProject) => (
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
        width: 160,
        render: (_value: string | null, record: HrTechnicalProject) => (
          <IpmCodeCell record={record} bindIpmProject={bindIpmProject} />
        ),
      },
      techFieldCol('planningYear', '规划年度', 90),
      techFieldCol('techDomain', '技术领域', 120),
      techFieldCol('tmg', 'TMG及领域', 120),
      techFieldCol('techTrack', '技术赛道', 120),
      techFieldCol('subTrack', '子赛道', 120),
      techFieldCol('subTaskName', '子任务名称', 140),
      {
        title: '年度预算',
        key: 'annualBudget',
        width: 110,
        align: 'right',
        render: (_value: number, record: HrTechnicalProject) => {
          const version = getLatestForType(record, 'annual')
          if (!version) return <span style={{ color: 'var(--pms-text-tertiary)' }}>-</span>
          return formatPersonMonth(version.estimatedInvestment)
        },
      },
      {
        title: '项目概算',
        key: 'projectEstimate',
        width: 110,
        align: 'right',
        render: (_value: number, record: HrTechnicalProject) => {
          const version = getLatestForType(record, 'projectEstimate')
          if (!version) return <span style={{ color: 'var(--pms-text-tertiary)' }}>-</span>
          return formatPersonMonth(version.estimatedInvestment)
        },
      },
      {
        title: '项目预算',
        key: 'projectBudget',
        width: 110,
        align: 'right',
        render: (_value: number, record: HrTechnicalProject) => {
          const version = getLatestForType(record, 'projectBudget')
          if (!version) return <span style={{ color: 'var(--pms-text-tertiary)' }}>-</span>
          return formatPersonMonth(version.estimatedInvestment)
        },
      },
      {
        title: '项目核算',
        dataIndex: 'projectAccounting',
        key: 'projectAccounting',
        width: 110,
        align: 'right',
        render: (v: number) => formatPersonMonth(v),
      },
      {
        title: '预算使用率',
        key: 'budgetUsageRate',
        width: 110,
        align: 'right',
        render: (_value: number, record: HrTechnicalProject) =>
          record.projectBudget
            ? formatPercent(record.projectAccounting / record.projectBudget)
            : '-',
      },
    ]
  }, [projectLatestVersions, bindIpmProject])

  // 5. 筛选器选项
  const uniqueOptions = useCallback(
    (field: keyof HrTechnicalProject) => {
      const set = new Set<string>()
      projects.forEach(p => {
        const val = p[field]
        if (typeof val === 'string' && val) set.add(val)
      })
      return [...set].sort().map(v => ({ value: v, label: v }))
    },
    [projects],
  )

  const planningYearOptions = useMemo(
    () => TECH_PLANNING_YEAR_OPTIONS.map(o => ({ value: o.value, label: o.label })),
    [],
  )
  const techDomainOptions = useMemo(() => uniqueOptions('techDomain'), [uniqueOptions])
  const tmgOptions = useMemo(() => uniqueOptions('tmg'), [uniqueOptions])
  const techTrackOptions = useMemo(() => uniqueOptions('techTrack'), [uniqueOptions])
  const subTrackOptions = useMemo(() => uniqueOptions('subTrack'), [uniqueOptions])
  const subTaskNameOptions = useMemo(() => uniqueOptions('subTaskName'), [uniqueOptions])

  // 6. 导出
  const handleExport = useCallback(() => {
    const exportColumns: ExportColumn[] = [
      { key: 'tdtName', title: 'TDT项目名称', width: 20 },
      {
        key: 'ipmProjectCode',
        title: '正式项目编码',
        width: 18,
        formatter: (_v: any, row: any) => row.ipmProjectCode || '-',
      },
      { key: 'planningYear', title: '规划年度', width: 10 },
      { key: 'techDomain', title: '技术领域', width: 12 },
      { key: 'tmg', title: 'TMG及领域', width: 12 },
      { key: 'techTrack', title: '技术赛道', width: 12 },
      { key: 'subTrack', title: '子赛道', width: 12 },
      { key: 'subTaskName', title: '子任务名称', width: 15 },
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
      `技术项目列表_${exportTimestamp()}.xlsx`,
      '技术项目列表',
    )
  }, [filteredProjects, projectLatestVersions])

  const filterSelect = (
    label: string,
    value: string[],
    options: { value: string; label: string }[],
    onChange: (val: string[]) => void,
    minWidth = 160,
  ) => (
    <Space size={6}>
      <span style={{ color: 'var(--pms-text-secondary)', fontSize: 12, whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <Select
        mode="multiple"
        allowClear
        maxTagCount="responsive"
        style={{ minWidth, maxWidth: minWidth + 80 }}
        placeholder={`全部${label}`}
        value={value}
        options={options}
        onChange={val => onChange(val as string[])}
      />
    </Space>
  )

  return (
    <div className="pms-hr-tech-project-list">
      {/* 顶部筛选条 */}
      <Card
        className="pms-toolbar"
        size="small"
        style={{ borderRadius: 8, marginBottom: 12 }}
        styles={{ body: { padding: '10px 16px' } }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <Space size={12} wrap style={{ flex: 1, minWidth: 0 }}>
            {filterSelect('规划年度', filters.planningYear, planningYearOptions, v => setFilters({ planningYear: v }), 120)}
            {filterSelect('技术领域', filters.techDomain, techDomainOptions, v => setFilters({ techDomain: v }))}
            {filterSelect('TMG及领域', filters.tmg, tmgOptions, v => setFilters({ tmg: v }))}
            {filterSelect('技术赛道', filters.techTrack, techTrackOptions, v => setFilters({ techTrack: v }))}
            {filterSelect('子赛道', filters.subTrack, subTrackOptions, v => setFilters({ subTrack: v }))}
            {filterSelect('子任务名称', filters.subTaskName, subTaskNameOptions, v => setFilters({ subTaskName: v }))}
          </Space>

          <Space size={8} style={{ flexShrink: 0 }}>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>导出</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={onNewProject}>新建项目</Button>
          </Space>
        </div>
      </Card>

      {/* 项目列表 */}
      <Table<HrTechnicalProject>
        className="pms-table"
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
              {Array.from({ length: 7 }).map((_, i) => (
                <Table.Summary.Cell key={i} index={1 + i} />
              ))}
              <Table.Summary.Cell index={8} align="right">{formatPersonMonth(totals.annualBudget)}</Table.Summary.Cell>
              <Table.Summary.Cell index={9} align="right">{formatPersonMonth(totals.projectEstimate)}</Table.Summary.Cell>
              <Table.Summary.Cell index={10} align="right">{formatPersonMonth(totals.projectBudget)}</Table.Summary.Cell>
              <Table.Summary.Cell index={11} align="right">{formatPersonMonth(totals.projectAccounting)}</Table.Summary.Cell>
              <Table.Summary.Cell index={12} align="right">
                {totals.projectBudget ? formatPercent(totals.projectAccounting / totals.projectBudget) : '-'}
              </Table.Summary.Cell>
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />

      <style jsx global>{`
        .pms-hr-tech-project-list .pms-table {
          font-variant-numeric: tabular-nums;
        }
        .pms-hr-tech-project-list .pms-table tfoot.ant-table-summary {
          display: table-header-group;
        }
        .pms-hr-tech-project-list .pms-table .pms-summary-row > td {
          background: var(--pms-brand-surface) !important;
          color: var(--pms-text-primary);
          font-weight: 600;
          border-top: 1px solid var(--pms-brand-border);
        }
        .pms-hr-tech-project-list .pms-table .pms-row-cancelled > td {
          background: #f0f0f0 !important;
        }
        .pms-hr-tech-project-list .pms-table .pms-row-cancelled {
          opacity: 0.7;
        }
        .pms-hr-tech-project-list .pms-table .pms-row-cancelled:hover > td {
          background: #e8e8e8 !important;
        }
        .pms-hr-tech-project-list .pms-table .pms-ipm-code-cell {
          cursor: pointer;
          transition: background 0.2s;
          border-radius: 4px;
          padding: 2px 4px;
          margin: -2px -4px;
        }
        .pms-hr-tech-project-list .pms-table .pms-ipm-code-cell:hover {
          background: var(--pms-brand-surface);
        }
      `}</style>
    </div>
  )
}
