'use client'

import { useState } from 'react'
import { Alert, Empty, Select, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { HrProjectCategory } from '@/lib/hrFormalProjectSource'
import { hrNonLaborMonthRange } from '@/lib/hrNonLaborRange'
import { formatPersonMonth } from '@/constants/hrMachine'
import { buildResourceMonthlyView, type ResourceMonthlyRow } from '@/components/project-resources/resourceVersionViewData'
import type { ResourceVersion } from '@/components/project-resources/resourceVersionAdapter'

export default function ResourceVersionViews({ category, version, rows }: {
  category: HrProjectCategory; version: ResourceVersion; rows: ResourceMonthlyRow[]
}) {
  const [year, setYear] = useState('all')
  const range = hrNonLaborMonthRange(category, 'milestones' in version ? version.milestones : version, true)
  const complete = buildResourceMonthlyView(rows, version.id, range.startMonth ?? undefined, range.endMonth ?? undefined)
  const selectedYear = complete.years.includes(year) ? year : 'all'
  const view = selectedYear === 'all' ? complete : buildResourceMonthlyView(rows, version.id, range.startMonth ?? undefined, range.endMonth ?? undefined, selectedYear)
  const columns: ColumnsType<ResourceMonthlyRow> = [
    { title: '一级部门', dataIndex: 'primaryDepartment', width: 130, fixed: 'left' },
    { title: '二级部门', dataIndex: 'secondaryDepartment', width: 130, fixed: 'left' },
    ...view.months.map(month => ({ title: `${month.slice(0, 4)}年${month.slice(5)}月`, key: month, width: 112, align: 'right' as const,
      render: (_: unknown, row: ResourceMonthlyRow) => formatPersonMonth(row.monthlyData[month] ?? 0) })),
    { title: selectedYear === 'all' ? '已分配合计' : '当年合计', key: 'total', width: 120, align: 'right', fixed: 'right',
      render: (_, row) => formatPersonMonth(view.months.reduce((sum, month) => sum + (row.monthlyData[month] || 0), 0)) },
  ]
  const missingDepartments = Math.max(0, version.estimatedInvestment - complete.estimatedTotal)
  const remaining = complete.remainingTotal + missingDepartments
  const excess = complete.excessTotal
  const chartWidth = Math.max(640, view.months.length * 52)
  const peak = Math.max(1, ...Object.values(view.totals))
  const slot = (chartWidth - 64) / Math.max(1, view.months.length)
  return <section className="pms-resource-monthly" aria-label="当前版本月度投入">
    <div className="pms-resource-section-head">
      <div><h3>月度人力投入</h3><span className="pms-resource-caption">{version.versionNumber} · 单位：人月</span></div>
      <Select aria-label="月度投入年份" value={selectedYear} style={{ minWidth: 136 }} onChange={setYear}
        options={[{ value: 'all', label: '全部年份' }, ...complete.years.map(value => ({ value, label: `${value}年` }))]} />
    </div>
    <div className="pms-resource-monthly-summary">
      <span>版本预估 <strong>{formatPersonMonth(version.estimatedInvestment)}</strong></span>
      <span>已分配 <strong>{formatPersonMonth(complete.allocatedTotal)}</strong></span>
      <span>{selectedYear === 'all' ? '全周期' : `${selectedYear}年`}投入 <strong>{formatPersonMonth(view.visibleTotal)}</strong></span>
    </div>
    {(remaining >= 0.1 || excess >= 0.1) && <Alert type="warning" showIcon
      title={[remaining >= 0.1 ? `尚有 ${formatPersonMonth(remaining)} 人月待分配` : '', excess >= 0.1 ? `部门月度分配超额 ${formatPersonMonth(excess)} 人月` : ''].filter(Boolean).join('；')}
      description="请核对当前版本的里程碑和手工月度分配；预估投入合计保留原值。" />}
    {view.months.length ? <>
      <div className="pms-resource-trend" tabIndex={0} aria-label="月度投入趋势，可横向滚动">
        <svg role="img" aria-label={`${version.versionNumber}月度人力投入趋势`} viewBox={`0 0 ${chartWidth} 190`} style={{ width: chartWidth, minWidth: '100%' }}>
          <title>当前版本月度人力投入，数值与下方表格一致</title>
          <line x1="32" y1="152" x2={chartWidth - 16} y2="152" stroke="var(--pms-border)" />
          {view.months.map((month, index) => {
            const amount = view.totals[month]
            const height = amount / peak * 110
            const x = 40 + index * slot
            return <g key={month}><title>{month}：{formatPersonMonth(amount)} 人月</title>
              <rect x={x} y={152 - height} width={Math.max(12, slot - 20)} height={height} rx="3" fill="var(--pms-brand)" opacity=".76" />
              <text x={x + (slot - 20) / 2} y={Math.max(22, 143 - height)} textAnchor="middle" className="pms-resource-chart-value">{formatPersonMonth(amount)}</text>
              <text x={x + (slot - 20) / 2} y="174" textAnchor="middle" className="pms-resource-chart-label">{month}</text>
            </g>
          })}
        </svg>
      </div>
      <Table<ResourceMonthlyRow> className="pms-table pms-hr-investment-table" size="small" rowKey="id"
        columns={columns} dataSource={view.rows} pagination={false} scroll={{ x: 380 + view.months.length * 112 }}
        locale={{ emptyText: '当前版本暂无部门月度投入' }}
        summary={() => <Table.Summary.Row><Table.Summary.Cell index={0} colSpan={2}>合计</Table.Summary.Cell>
          {view.months.map((month, index) => <Table.Summary.Cell key={month} index={index + 2} align="right">{formatPersonMonth(view.totals[month])}</Table.Summary.Cell>)}
          <Table.Summary.Cell index={view.months.length + 2} align="right">{formatPersonMonth(view.visibleTotal)}</Table.Summary.Cell>
        </Table.Summary.Row>} />
    </> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="填写里程碑时间后生成月度视图" />}
  </section>
}
