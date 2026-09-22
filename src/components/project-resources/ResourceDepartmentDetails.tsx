'use client'
import { Alert, Table, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { DashboardInvestment, ResourceDepartmentDetail, ResourceDepartmentDetails as Details } from '@/components/project-resources/cumulativeEstimateData'
const format = (value: number | undefined, digits: number) => value === undefined ? '—' : value.toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits })
const investment = (value?: DashboardInvestment) => <div className="pms-dashboard-department-value"><span>{format(value?.labor, 3)}</span><small>{format(value?.cost, 2)} 万元</small></div>
const percent = (value?: number) => <span className={(value ?? 0) > 100 ? 'pms-resource-difference' : undefined}>{format(value, 1)}%</span>
export default function ResourceDepartmentDetails({ details }: { details: Details }) {
  const columns: ColumnsType<ResourceDepartmentDetail> = [
    { title: '一级部门', dataIndex: 'primary', width: 120, fixed: 'left' },
    { title: '二级部门', dataIndex: 'secondary', width: 120, fixed: 'left' },
    ...([{ key: 'annual', title: '年度预算' }, { key: 'estimate', title: '项目概算' }, { key: 'budget', title: '项目预算' }, { key: 'cumulative', title: '累至今日预估投入' }, { key: 'actual', title: '项目核算' }] as const).map(item => ({ title: item.title, dataIndex: item.key, width: 150, align: 'right' as const, render: investment })),
    { title: <Tooltip title="截至今日核算人月 ÷ 累至今日预估人月；不受顶部日期筛选影响。">累至今日执行率</Tooltip>, dataIndex: 'toDateExecution', width: 160, align: 'right', render: (value: number | undefined, row) => <Tooltip title={`截至今日核算 ${format(row.actualToDate?.labor, 3)} / 预估 ${format(row.cumulative?.labor, 3)} 人月`}>{percent(value)}</Tooltip> },
    { title: <Tooltip title="核算费用 ÷ 项目预算费用；沿用当前部门和日期筛选。">全生命周期预算执行率</Tooltip>, dataIndex: 'lifecycleExecution', width: 180, align: 'right', render: percent },
  ]
  return <div aria-label="部门投入明细">
    <p className="pms-dashboard-ledger-note">投入以人月显示，下方为费用（万元）。累至今日截至 {details.today}，只随部门筛选变化；按正式项目预算 → 正式年度预算 → 正式项目概算取数，各阶段按里程碑间自然日均摊，开始日为 0、结束日为 100%。预估费用仅含人力费用。</p>
    {details.cumulative?.issues.length ? <Alert type="warning" showIcon message="累至今日预估暂无法完整计算" description={details.cumulative.issues.join('；')} /> : null}
    <Table<ResourceDepartmentDetail> className="pms-table" size="small" rowKey="key" dataSource={details.rows} columns={columns} pagination={false} scroll={{ x: 1330 }} locale={{ emptyText: '当前筛选范围暂无部门投入数据' }} summary={() => details.rows.length ? <Table.Summary.Row>
      <Table.Summary.Cell index={0} colSpan={2}>合计</Table.Summary.Cell>
      {(['annual', 'estimate', 'budget', 'cumulative', 'actual'] as const).map((key, index) => <Table.Summary.Cell key={key} index={index + 2} align="right">{investment(details.total[key])}</Table.Summary.Cell>)}
      <Table.Summary.Cell index={7} align="right">{percent(details.total.toDateExecution)}</Table.Summary.Cell>
      <Table.Summary.Cell index={8} align="right">{percent(details.total.lifecycleExecution)}</Table.Summary.Cell>
    </Table.Summary.Row> : null} />
  </div>
}
