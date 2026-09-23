'use client'
import { Alert, Table, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { DashboardInvestment, ResourceDepartmentDetail, ResourceDepartmentDetails as Details } from '@/components/project-resources/cumulativeEstimateData'
const format = (value: number | undefined, digits: number) => value === undefined ? '—' : value.toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits })
const investment = (value?: DashboardInvestment) => <div className="pms-dashboard-department-value"><span>{format(value?.labor, 3)}</span><small>{format(value?.cost, 2)} 万元</small></div>
const percent = (value?: number) => <span className={(value ?? 0) > 100 ? 'pms-resource-difference' : undefined}>{format(value, 1)}%</span>
const rates = (labor?: number, cost?: number) => <div className="pms-dashboard-department-value"><span>人月 {percent(labor)}</span><small>费用 {percent(cost)}</small></div>
export default function ResourceDepartmentDetails({ details }: { details: Details }) {
  const columns: ColumnsType<ResourceDepartmentDetail> = [
    { title: '一级部门', dataIndex: 'primary', width: 120, fixed: 'left' },
    { title: '二级部门', dataIndex: 'secondary', width: 120, fixed: 'left' },
    ...([{ key: 'annual', title: '年度预算' }, { key: 'estimate', title: '项目概算' }, { key: 'budget', title: '项目预算' }, { key: 'cumulative', title: '累至今日预估投入' }, { key: 'actual', title: '项目核算' }] as const).map(item => ({ title: item.title, dataIndex: item.key, width: 150, align: 'right' as const, render: investment })),
    { title: <Tooltip title="项目核算 ÷ 累至今日预估投入，分别按人月和总费用计算；分子与项目核算列一致。">累至今日执行率</Tooltip>, key: 'toDateExecution', width: 160, align: 'right', render: (_, row) => rates(row.toDateExecution, row.toDateCostExecution) },
    { title: <Tooltip title="项目核算 ÷ 项目预算，分别按人月和总费用计算；沿用当前部门和日期筛选。">全生命周期预算执行率</Tooltip>, key: 'lifecycleExecution', width: 180, align: 'right', render: (_, row) => rates(row.lifecycleExecution, row.lifecycleCostExecution) },
  ]
  return <div aria-label="部门投入明细">
    <p className="pms-dashboard-ledger-note">投入及执行率均为人月在上、费用在下；总费用包含人力和非人力费用。累至今日预估截至 {details.today}，只随部门筛选变化；按正式项目预算 → 正式年度预算 → 正式项目概算取数，各阶段按里程碑间自然日均摊，开始日为 0、结束日为 100%。预估费用 = 预估人月 × 费率 + 截至今日非人力计划费用（当月按已过工作日占比折算）。两种执行率的分子均与项目核算列一致。</p>
    {details.cumulative?.issues.length ? <Alert type="warning" showIcon message="累至今日预估暂无法完整计算" description={details.cumulative.issues.join('；')} /> : null}
    <Table<ResourceDepartmentDetail> className="pms-table" size="small" rowKey="key" dataSource={details.rows} columns={columns} pagination={false} scroll={{ x: 1330 }} locale={{ emptyText: '当前筛选范围暂无部门投入数据' }} summary={() => details.rows.length ? <Table.Summary.Row>
      <Table.Summary.Cell index={0} colSpan={2}>合计</Table.Summary.Cell>
      {(['annual', 'estimate', 'budget', 'cumulative', 'actual'] as const).map((key, index) => <Table.Summary.Cell key={key} index={index + 2} align="right">{investment(details.total[key])}</Table.Summary.Cell>)}
      <Table.Summary.Cell index={7} align="right">{rates(details.total.toDateExecution, details.total.toDateCostExecution)}</Table.Summary.Cell>
      <Table.Summary.Cell index={8} align="right">{rates(details.total.lifecycleExecution, details.total.lifecycleCostExecution)}</Table.Summary.Cell>
    </Table.Summary.Row> : null} />
  </div>
}
