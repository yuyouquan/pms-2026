'use client'

import { useMemo } from 'react'
import { Card, Table, Input, Select, Button, Space, Switch, Tooltip } from 'antd'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useHrMachineStore } from '@/stores/hrMachine'
import { MACHINE_BRANDS, MACHINE_PRODUCT_LINES, formatPersonMonth, formatPercent } from '@/constants/hrMachine'
import type { HrMachineProject } from '@/types/hrMachine'

interface ProjectListTabProps {
  onSelectProject: (projectId: string) => void
  onNewProject: () => void
}

export default function ProjectListTab({ onSelectProject, onNewProject }: ProjectListTabProps) {
  const projects = useHrMachineStore(s => s.projects)
  const filters = useHrMachineStore(s => s.filters)
  const setFilters = useHrMachineStore(s => s.setFilters)

  // 1. 按品牌 / 产品线 / 项目名称（子串）/ 是否取消暂停 过滤
  const filteredProjects = useMemo(() => {
    const keyword = filters.projectName.trim().toLowerCase()
    return projects.filter(p => {
      if (filters.brand !== 'all' && p.brand !== filters.brand) return false
      if (filters.productLine !== 'all' && p.productLine !== filters.productLine) return false
      if (keyword && !p.name.toLowerCase().includes(keyword)) return false
      if (!filters.showCancelled && p.status === 'cancelled') return false
      return true
    })
  }, [projects, filters.brand, filters.productLine, filters.projectName, filters.showCancelled])

  // 2. 合计行：年度预算 / 项目概算 / 项目预算 / 项目核算；预算执行率 = 合计核算 / 合计预算
  const totals = useMemo(() => {
    return filteredProjects.reduce(
      (acc, p) => {
        acc.annualBudget += p.annualBudget
        acc.projectEstimate += p.projectEstimate
        acc.projectBudget += p.projectBudget
        acc.projectAccounting += p.projectAccounting
        return acc
      },
      { annualBudget: 0, projectEstimate: 0, projectBudget: 0, projectAccounting: 0 },
    )
  }, [filteredProjects])

  // 3. 列定义（数字列右对齐）
  const columns: ColumnsType<HrMachineProject> = useMemo(() => [
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
      dataIndex: 'annualBudget',
      key: 'annualBudget',
      width: 120,
      align: 'right',
      render: (v: number) => formatPersonMonth(v),
    },
    {
      title: '项目概算',
      dataIndex: 'projectEstimate',
      key: 'projectEstimate',
      width: 120,
      align: 'right',
      render: (v: number) => formatPersonMonth(v),
    },
    {
      title: '项目预算',
      dataIndex: 'projectBudget',
      key: 'projectBudget',
      width: 120,
      align: 'right',
      render: (v: number) => formatPersonMonth(v),
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
      render: (_value, record: HrMachineProject) =>
        formatPercent(record.projectAccounting, record.projectBudget),
    },
  ], [])

  const brandOptions = useMemo(
    () => [{ value: 'all' as const, label: '全部品牌' }, ...MACHINE_BRANDS],
    [],
  )
  const productLineOptions = useMemo(
    () => [{ value: 'all' as const, label: '全部产品线' }, ...MACHINE_PRODUCT_LINES],
    [],
  )

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
              <span style={{ color: 'var(--pms-text-secondary)', fontSize: 13, whiteSpace: 'nowrap' }}>
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
              <span style={{ color: 'var(--pms-text-secondary)', fontSize: 13, whiteSpace: 'nowrap' }}>
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
              <span style={{ color: 'var(--pms-text-secondary)', fontSize: 13, whiteSpace: 'nowrap' }}>
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

          <Button type="primary" icon={<PlusOutlined />} onClick={onNewProject}>
            新建项目
          </Button>
        </div>
      </Card>

      {/* 项目列表 */}
      <Table<HrMachineProject>
        className="pms-table"
        rowKey="id"
        columns={columns}
        dataSource={filteredProjects}
        scroll={{ x: 'max-content' }}
        pagination={{ pageSize: 15, showTotal: (t) => '共 ' + t + ' 个项目' }}
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
              <Table.Summary.Cell index={4} align="right">
                {formatPersonMonth(totals.annualBudget)}
              </Table.Summary.Cell>
              <Table.Summary.Cell index={5} align="right">
                {formatPersonMonth(totals.projectEstimate)}
              </Table.Summary.Cell>
              <Table.Summary.Cell index={6} align="right">
                {formatPersonMonth(totals.projectBudget)}
              </Table.Summary.Cell>
              <Table.Summary.Cell index={7} align="right">
                {formatPersonMonth(totals.projectAccounting)}
              </Table.Summary.Cell>
              <Table.Summary.Cell index={8} align="right">
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
      `}</style>
    </div>
  )
}
