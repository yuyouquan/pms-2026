'use client'
import { useState, type CSSProperties } from 'react'
import { Empty, InputNumber, Table, Tabs } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { HrProjectCategory } from '@/lib/hrFormalProjectSource'
import { hrNonLaborMonthRange } from '@/lib/hrNonLaborRange'
import { formatPersonMonth } from '@/constants/hrMachine'
import { buildResourceMonthlyView, type ResourceMonthlyRow } from '@/components/project-resources/resourceVersionViewData'
import type { ResourceVersion } from '@/components/project-resources/resourceVersionAdapter'
import { useHrConfigStore } from '@/stores/hrConfig'
import ResourceInlineField from '@/components/project-resources/ResourceInlineField'
import { groupResourceMonths, resourceInvestmentStages, summarizeResourceMonths, sumMonthlyRow } from '@/components/project-resources/resourceMonthlyPresentation'

export default function ResourceVersionViews({ category, version, rows, readOnly, onSaveMonth }: {
  category: HrProjectCategory; version: ResourceVersion; rows: ResourceMonthlyRow[]; readOnly: boolean
  onSaveMonth: (rowId: string, month: string, value: number) => void
}) {
  const [year, setYear] = useState('all')
  const [mode, setMode] = useState('labor')
  const rate = useHrConfigStore(state => Number(state.data.feeRate?.[0]?.value ?? 5))
  const cost = mode === 'cost', multiplier = cost ? rate : 1
  const unit = cost ? '万元' : '人月'
  const amount = (value: number) => (value * multiplier).toFixed(cost ? 2 : 1)
  const range = hrNonLaborMonthRange(category, 'milestones' in version ? version.milestones : version, true)
  const complete = buildResourceMonthlyView(rows, version.id, range.startMonth ?? undefined, range.endMonth ?? undefined)
  const selectedYear = complete.years.includes(year) ? year : 'all'
  const view = selectedYear === 'all' ? complete : buildResourceMonthlyView(rows, version.id, range.startMonth ?? undefined, range.endMonth ?? undefined, selectedYear)
  const stages = resourceInvestmentStages(category, version)
  const groups = groupResourceMonths(view.months, stages)
  const stats = summarizeResourceMonths(view, stages)
  const periodLabel = selectedYear === 'all' ? '全周期' : `${selectedYear} 年`
  const visibleYears = selectedYear === 'all' ? complete.years : [selectedYear]
  const columns: ColumnsType<ResourceMonthlyRow> = [
    { title: '一级部门', dataIndex: 'primaryDepartment', width: 125, fixed: 'left', align: 'center' },
    { title: '二级部门', dataIndex: 'secondaryDepartment', width: 125, fixed: 'left', align: 'center' },
    ...groups.flatMap(group => group.months.map(month => ({ title: <span className="pms-resource-month-label" style={{ color: group.color }}>{Number(month.slice(5))}月<small>{month.slice(0, 4)}</small></span>, key: month, width: 110, align: 'center' as const,
        render: (_: unknown, row: ResourceMonthlyRow) => {
          const label = `${row.primaryDepartment} ${row.secondaryDepartment} ${month}投入人月`
          return cost || readOnly ? amount(row.monthlyData[month] ?? 0) : <ResourceInlineField label={label} value={row.monthlyData[month] ?? 0} display={amount(row.monthlyData[month] ?? 0)}
            onSave={value => onSaveMonth(row.id, month, value === null ? 0 : Number(value))}
            renderEditor={(value, change) => <InputNumber controls={false} aria-label={label} min={0} precision={1} value={Number(value)} style={{ width: '100%' }} onChange={change} />} />
        } }))),
    ...visibleYears.map(value => ({ title: `${value}小计`, key: value, width: 110, align: 'center' as const,
      render: (_: unknown, row: ResourceMonthlyRow) => amount(sumMonthlyRow(row, complete.months.filter(month => month.startsWith(`${value}-`)))) })),
    { title: '全周期合计', key: 'all', width: 110, align: 'center', render: (_, row) => amount(sumMonthlyRow(row)) },
    { title: '已分配合计', key: 'balance', width: 215, fixed: 'right', align: 'center', render: (_, row) => {
      const allocated = sumMonthlyRow(row), delta = Math.round((allocated - row.estimatedTotal) * 1000) / 1000
      return <span className={`pms-resource-month-balance${Math.abs(delta) >= 0.0005 ? ' pms-resource-difference' : ''}`}>{amount(allocated)}/{amount(row.estimatedTotal)}（{delta > 0 ? '+' : delta < 0 ? '-' : ''}{amount(Math.abs(delta))}）</span>
    } },
  ]
  const chartWidth = Math.max(640, view.months.length * 60)
  const peak = Math.max(1, ...Object.values(view.totals))
  const slot = (chartWidth - 64) / Math.max(1, view.months.length)
  return <section className="pms-resource-panel pms-resource-monthly" aria-label="当前版本月度投入">
    <div className="pms-resource-section-head pms-resource-monthly-heading"><h3>月度人力投入</h3>
      <div className="pms-resource-monthly-summary"><span>版本预估 <strong>{formatPersonMonth(version.estimatedInvestment)}</strong></span><span>已分配 <strong>{formatPersonMonth(complete.allocatedTotal)}</strong></span><span>全周期投入 <strong>{formatPersonMonth(complete.visibleTotal)}</strong> 人月</span></div>
    </div>
    <Tabs className="pms-resource-year-tabs" activeKey={selectedYear} onChange={setYear} items={[
      { key: 'all', label: `全部 ${complete.months.length} 个月` },
      ...complete.years.map(value => { const months = complete.months.filter(month => month.startsWith(`${value}-`)); const total = months.reduce((sum, month) => sum + complete.totals[month], 0); return { key: value, label: `${value} 年 · ${months.length} 个月 · ${formatPersonMonth(total)} 人月 / ${(total * rate).toFixed(2)} 万元` } }),
    ]} />
    <div className="pms-resource-view-stats">
      <div><span>{periodLabel}总投入</span><strong>{(stats.total * rate).toFixed(2)} <small>万元</small></strong><span>合计 {formatPersonMonth(stats.total)} 人月{selectedYear !== 'all' && ` · 全周期 ${formatPersonMonth(complete.visibleTotal)} 人月`}</span></div>
      <div><span>月均人力（{periodLabel}）</span><strong>{formatPersonMonth(stats.average)} <small>人</small></strong><span>峰值 {formatPersonMonth(stats.peak)} 人{stats.peakMonth && `（${stats.peakMonth}）`}</span></div>
      <div><span>计划区间</span><strong className="pms-resource-period">{complete.months[0] ?? '待填写'} → {complete.months.at(-1) ?? '待填写'}</strong><span>{complete.months.length} 个月 · 跨 {complete.years.length} 个年度</span></div>
      <div><span>阶段分布（{periodLabel}）</span><div className="pms-resource-stage-legend">{stats.stages.map(stage => <span key={stage.key} style={{ '--stage-color': stage.color } as CSSProperties}>{stage.label} {stage.ratio.toFixed(1)}%</span>)}</div></div>
    </div>
    <Tabs activeKey={mode} onChange={setMode} items={[{ key: 'labor', label: '投入人月' }, { key: 'cost', label: '费用(万元)' }]} />
    {view.months.length ? <>
      <div className="pms-resource-trend" tabIndex={0} aria-label="月度投入趋势，可横向滚动"><svg role="img" aria-label={`${version.versionNumber}月度${cost ? '费用' : '人力投入'}趋势`} viewBox={`0 0 ${chartWidth} 170`} style={{ width: chartWidth, minWidth: '100%' }}>
        <title>数值与下方表格一致，单位：{unit}</title><line x1="32" y1="138" x2={chartWidth - 16} y2="138" stroke="var(--pms-border)" />
        {view.months.map((month, index) => { const value = view.totals[month], height = value / peak * 100, x = 40 + index * slot; return <g key={month}><title>{month}：{amount(value)} {unit}</title>
          <rect x={x} y={138 - height} width={Math.max(12, slot - 20)} height={height} rx="3" fill="var(--pms-brand)" opacity=".76" />
          <text x={x + (slot - 20) / 2} y={Math.max(20, 131 - height)} textAnchor="middle" className="pms-resource-chart-value">{amount(value)}</text>
          <text x={x + (slot - 20) / 2} y="159" textAnchor="middle" className="pms-resource-chart-label">{month}</text>
        </g> })}
      </svg></div>
      <Table<ResourceMonthlyRow> className="pms-table pms-hr-investment-table pms-resource-monthly-table" size="small" rowKey="id" columns={columns} dataSource={view.rows} pagination={false} scroll={{ x: 575 + visibleYears.length * 110 + view.months.length * 110 }} locale={{ emptyText: '当前版本暂无部门月度投入' }}
        summary={() => <Table.Summary.Row><Table.Summary.Cell index={0} colSpan={2} align="center">合计</Table.Summary.Cell>
          {view.months.map((month, index) => <Table.Summary.Cell key={month} index={index + 2} align="center">{amount(view.totals[month])}</Table.Summary.Cell>)}
          {visibleYears.map((value, index) => <Table.Summary.Cell key={value} index={view.months.length + index + 2} align="center">{amount(complete.months.filter(month => month.startsWith(`${value}-`)).reduce((sum, month) => sum + complete.totals[month], 0))}</Table.Summary.Cell>)}
          <Table.Summary.Cell index={view.months.length + visibleYears.length + 2} align="center">{amount(complete.allocatedTotal)}</Table.Summary.Cell>
          <Table.Summary.Cell index={view.months.length + visibleYears.length + 3} align="center"><span className={Math.abs(complete.allocatedTotal - version.estimatedInvestment) >= 0.0005 ? 'pms-resource-difference' : ''}>{amount(complete.allocatedTotal)}/{amount(version.estimatedInvestment)}（{complete.allocatedTotal > version.estimatedInvestment ? '+' : complete.allocatedTotal < version.estimatedInvestment ? '-' : ''}{amount(Math.abs(complete.allocatedTotal - version.estimatedInvestment))}）</span></Table.Summary.Cell>
        </Table.Summary.Row>} />
    </> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="填写里程碑时间后生成月度视图" />}
  </section>
}
