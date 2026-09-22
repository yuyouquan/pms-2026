'use client'
import { Alert, Empty, Table, Tag } from 'antd'
import type { AccountingAnalysis } from '@/components/project-resources/resourceAccounting'
export default function ResourceAccountingDetails({ analysis }: { analysis?: AccountingAnalysis }) {
  return <section className="pms-resource-panel pms-dashboard-ledger" aria-label="工时投入明细">
    <div className="pms-dashboard-panel-head"><h3>工时投入明细 <Tag>Mock</Tag></h3><span>{analysis?.worklogs.length ?? 0} 条 · 合计 {analysis?.personDays.toFixed(2) ?? '—'} 人天 / {analysis?.labor.toFixed(3) ?? '—'} 人月</span></div>
    <p className="pms-dashboard-ledger-note">人月 = 人天 ÷ 来源当月工作日，逐条折算后汇总。当前为独立模拟明细，尚未接入 IPM；模拟工作日按周一至周五，接入后使用 IPM 日历口径。</p>
    {analysis?.issues.map(issue => <Alert key={issue} type="warning" showIcon message={issue} />)}
    {!analysis ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前项目暂无核算明细" /> : <>
      <Table className="pms-table" size="small" rowKey="id" dataSource={analysis.worklogs} pagination={{ pageSize: 10, showSizeChanger: false, hideOnSinglePage: true }} scroll={{ x: 1120 }} locale={{ emptyText: '当前筛选范围暂无工时记录' }} columns={[
        { title: '日期', dataIndex: 'date', width: 110, sorter: (a, b) => a.date.localeCompare(b.date) },
        { title: '人员', dataIndex: 'person', width: 110 }, { title: '一级部门', dataIndex: 'primaryDepartment', width: 110 }, { title: '二级部门', dataIndex: 'secondaryDepartment', width: 110 },
        { title: '投入人天', dataIndex: 'personDays', align: 'right', width: 100, render: (value: number) => value.toFixed(2) },
        { title: '当月工作日', dataIndex: 'monthWorkingDays', align: 'right', width: 110 },
        { title: '折算人月', dataIndex: 'labor', align: 'right', width: 100, render: (value: number) => value.toFixed(3) },
        { title: '人力费用（万元）', dataIndex: 'laborCost', align: 'right', width: 140, render: (value: number) => value.toFixed(2) },
        { title: '工作内容', dataIndex: 'description', width: 210 },
      ]} />

    </>}
  </section>
}
