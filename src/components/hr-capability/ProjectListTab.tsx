'use client'

import { useMemo, useState } from 'react'
import { Card, Table, Button, Tooltip, Tag, Space, Select, Popover, App, Input } from 'antd'
import { DownloadOutlined, SearchOutlined, LinkOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useHrCapabilityStore } from '@/stores/hrCapability'
import {
  formatPersonMonth,
  formatPercent,
} from '@/constants/hrCapability'
import type { HrCapabilityProject } from '@/types/hrCapability'
import { exportSheet, exportTimestamp } from '@/utils/exportExcel'
import type { ExportColumn } from '@/utils/exportExcel'
import { useProjectStore } from '@/stores/project'
import { getHrFormalProjectOptions } from '@/lib/hrFormalProjectSource'

interface ProjectListTabProps {
  onSelectProject: (projectId: string) => void
  onNewProject: () => void
}

/** IPM 编码单元格：可点击弹出绑定弹框 */
function IpmCodeCell({ project }: { project: HrCapabilityProject }) {
  const { message } = App.useApp()
  const bindIpmProject = useHrCapabilityStore((s) => s.bindIpmProject)
  const [open, setOpen] = useState(false)
  const formalProjects = useProjectStore(s => s.projects)
  const formalProjectOptions = useMemo(() => getHrFormalProjectOptions('capability', formalProjects), [formalProjects])

  const handleSelect = (code: string) => {
    const ipmProject = formalProjectOptions.find((p) => p.code === code)
    if (ipmProject) {
      bindIpmProject(project.id, ipmProject.code, ipmProject.name)
      message.success(`已绑定 ${ipmProject.code} - ${ipmProject.name}`)
      setOpen(false)
    }
  }

  const content = (
    <div onClick={e => e.stopPropagation()} style={{ width: 320 }}>
      <Select
        style={{ width: '100%' }}
        value={project.ipmProjectCode ?? undefined}
        placeholder="选择正式项目编码"
        showSearch
        optionFilterProp="label"
        options={formalProjectOptions.map((p) => ({
          label: `${p.code} - ${p.name}`,
          value: p.code,
        }))}
        onChange={handleSelect}
      />
    </div>
  )

  if (project.ipmProjectCode) {
    return (
      <Popover content={content} trigger="click" open={open} onOpenChange={setOpen}>
        <span onClick={e => e.stopPropagation()} style={{ cursor: 'pointer', color: 'var(--pms-brand-strong)' }}>
          <Tooltip title={project.ipmProjectName ?? ''}>
            <Space size={2}>
              <LinkOutlined style={{ fontSize: 12 }} />
              <span>{project.ipmProjectCode}</span>
            </Space>
          </Tooltip>
        </span>
      </Popover>
    )
  }

  return (
    <Popover content={content} trigger="click" open={open} onOpenChange={setOpen}>
      <Button type="dashed" size="small" icon={<LinkOutlined />} onClick={e => e.stopPropagation()}>
        绑定IPM
      </Button>
    </Popover>
  )
}

export default function ProjectListTab({ onSelectProject, onNewProject }: ProjectListTabProps) {
  const projects = useHrCapabilityStore((s) => s.projects)
  const filters = useHrCapabilityStore((s) => s.filters)
  const setFilters = useHrCapabilityStore((s) => s.setFilters)

  // 项目名称搜索
  const [searchText, setSearchText] = useState('')

  const projectNameOptions = useMemo(
    () => projects.map((p) => ({ label: p.name, value: p.name })),
    [projects],
  )

  const dataSource = useMemo(() => {
    const keyword = searchText.trim().toLowerCase()
    return projects
      .filter((p) => {
        if (filters.projectName.length > 0 && !filters.projectName.includes(p.name)) return false
        if (keyword && !p.name.toLowerCase().includes(keyword)) return false
        return true
      })
      .map((p) => {
        return {
          ...p,
          budgetUsageRate: p.projectBudget > 0
            ? p.projectAccounting / p.projectBudget
            : 0,
        }
      })
  }, [projects, filters, searchText])

  const totalRow = useMemo(() => {
    let annualBudget = 0
    let projectEstimate = 0
    let projectBudget = 0
    let projectAccounting = 0
    for (const p of dataSource) {
      annualBudget += p.annualBudget
      projectEstimate += p.projectEstimate
      projectBudget += p.projectBudget
      projectAccounting += p.projectAccounting
    }
    return { annualBudget, projectEstimate, projectBudget, projectAccounting }
  }, [dataSource])

  const columns = useMemo<ColumnsType<typeof dataSource[number]>>(() => [
    {
      title: '项目名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      fixed: 'left',
      render: (value: string, record: typeof dataSource[number]) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontWeight: 600, color: 'var(--pms-text-primary)' }}>{value}</span>
          {record.status === 'cancelled' && (
            <Tag color="red" style={{ fontSize: 12, marginInlineEnd: 0 }}>已取消</Tag>
          )}
        </div>
      ),
    },
    {
      title: '正式项目编码',
      dataIndex: 'ipmProjectCode',
      key: 'ipmProjectCode',
      fixed: 'left',
      width: 140,
      render: (_value: unknown, record: typeof dataSource[number]) => (
        <IpmCodeCell project={record} />
      ),
    },
    {
      title: '项目目标',
      dataIndex: 'projectTarget',
      key: 'projectTarget',
      width: 280,
      ellipsis: true,
      render: (value: string) => (
        <Tooltip title={value}>
          <span style={{ color: 'var(--pms-text-secondary)', fontSize: 12 }}>
            {value?.length > 40 ? `${value.slice(0, 40)}...` : value}
          </span>
        </Tooltip>
      ),
    },
    {
      title: '正式项目名称',
      dataIndex: 'ipmProjectName',
      key: 'ipmProjectName',
      width: 160,
      render: (value: string | null) => value ?? '-',
    },
    {
      title: '年度预算',
      dataIndex: 'annualBudget',
      key: 'annualBudget',
      width: 110,
      align: 'right',
      render: (value: number) => formatPersonMonth(value),
    },
    {
      title: '项目概算',
      dataIndex: 'projectEstimate',
      key: 'projectEstimate',
      width: 110,
      align: 'right',
      render: (value: number) => formatPersonMonth(value),
    },
    {
      title: '项目预算',
      dataIndex: 'projectBudget',
      key: 'projectBudget',
      width: 110,
      align: 'right',
      render: (value: number) => formatPersonMonth(value),
    },
    {
      title: '项目核算',
      dataIndex: 'projectAccounting',
      key: 'projectAccounting',
      width: 110,
      align: 'right',
      render: (value: number) => formatPersonMonth(value),
    },
    {
      title: '预算使用率',
      dataIndex: 'budgetUsageRate',
      key: 'budgetUsageRate',
      width: 100,
      align: 'right',
      render: (value: number) => (
        <span style={{ color: value > 0.8 ? '#cf1322' : value > 0.5 ? '#d48806' : 'var(--pms-text-secondary)' }}>
          {formatPercent(value)}
        </span>
      ),
    },
  ], [])

  const handleExport = () => {
    const exportColumns: ExportColumn[] = [
      { key: 'name', title: '项目名称', width: 20 },
      { key: 'ipmProjectCode', title: '正式项目编码', width: 14 },
      { key: 'projectTarget', title: '项目目标', width: 30 },
      { key: 'ipmProjectName', title: '正式项目名称', width: 16 },
      { key: 'annualBudget', title: '年度预算', width: 10, formatter: (v) => formatPersonMonth(Number(v)) },
      { key: 'projectEstimate', title: '项目概算', width: 10, formatter: (v) => formatPersonMonth(Number(v)) },
      { key: 'projectBudget', title: '项目预算', width: 10, formatter: (v) => formatPersonMonth(Number(v)) },
      { key: 'projectAccounting', title: '项目核算', width: 10, formatter: (v) => formatPersonMonth(Number(v)) },
      { key: 'budgetUsageRate', title: '预算使用率', width: 10, formatter: (v) => formatPercent(Number(v)) },
    ]
    exportSheet(
      dataSource,
      exportColumns,
      `能力建设项目列表_${exportTimestamp()}.xlsx`,
      '项目列表',
    )
  }

  return (
    <div className="pms-capability-project-list">
      <Card
        className="pms-toolbar"
        size="small"
        style={{ marginBottom: 12 }}
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
            <Select
              mode="multiple"
              maxTagCount="responsive"
              style={{ minWidth: 200, maxWidth: 320 }}
              placeholder="筛选项目名称"
              value={filters.projectName}
              options={projectNameOptions}
              onChange={(value) => setFilters({ projectName: value as string[] })}
            />
            <Input
              allowClear
              placeholder="搜索项目名称"
              prefix={<SearchOutlined style={{ color: 'var(--pms-text-tertiary)' }} />}
              style={{ width: 200 }}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </Space>
          <Space size={8} style={{ flexShrink: 0 }}>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>导出</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={onNewProject}>新建项目</Button>
          </Space>
        </div>
      </Card>

      <div className="pms-solid-surface">
        <Table
          className="pms-table pms-hr-investment-table"
          rowKey="id"
          columns={columns}
          dataSource={dataSource}
          tableLayout="fixed"
          scroll={{ x: columns.reduce((total, column) => total + Number(column.width ?? 0), 0) }}
          pagination={{ pageSize: 15, showTotal: (t) => `共 ${t} 条` }}
          onRow={(record) => ({
            style: { cursor: 'pointer' },
            onClick: () => onSelectProject(record.id),
          })}
          rowClassName={(record) =>
            record.status === 'cancelled' ? 'pms-row-cancelled' : ''
          }
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row className="pms-summary-row">
                <Table.Summary.Cell index={0}>
                  <span style={{ fontWeight: 700 }}>合计</span>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1} />
                <Table.Summary.Cell index={2} />
                <Table.Summary.Cell index={3} />
                <Table.Summary.Cell index={4} align="right">
                  <span style={{ fontWeight: 700 }}>{formatPersonMonth(totalRow.annualBudget)}</span>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={5} align="right">
                  <span style={{ fontWeight: 700 }}>{formatPersonMonth(totalRow.projectEstimate)}</span>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={6} align="right">
                  <span style={{ fontWeight: 700 }}>{formatPersonMonth(totalRow.projectBudget)}</span>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={7} align="right">
                  <span style={{ fontWeight: 700 }}>{formatPersonMonth(totalRow.projectAccounting)}</span>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={8} align="right">
                  {totalRow.projectBudget > 0 ? formatPercent(totalRow.projectAccounting / totalRow.projectBudget) : '-'}
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </div>

      <style jsx global>{`
        .pms-capability-project-list .pms-table {
          font-variant-numeric: tabular-nums;
        }
        .pms-capability-project-list .pms-table .pms-summary-row > td {
          background: var(--pms-brand-surface) !important;
          color: var(--pms-brand-strong);
          font-weight: 600;
          border-top: 2px solid var(--pms-brand-border);
        }
        .pms-capability-project-list .pms-table .pms-summary-row:hover > td {
          background: var(--pms-brand-surface) !important;
        }
        .pms-capability-project-list .pms-table .pms-row-cancelled > td {
          background: #fafafa !important;
          color: var(--pms-text-tertiary);
        }
        .pms-capability-project-list .pms-table .pms-row-cancelled:hover > td {
          background: #f0f0f0 !important;
        }
      `}</style>
    </div>
  )
}
