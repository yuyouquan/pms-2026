'use client'
import { Alert, Empty, Table, Tag } from 'antd'
import type { CumulativeLabor } from '@/components/project-resources/cumulativeLaborData'
export default function ResourceCumulativeLabor({ analysis, today }: { analysis: CumulativeLabor; today: string }) {
  return <section className="pms-resource-panel pms-dashboard-ledger" aria-label="累至今日的人力投入">
    <div className="pms-dashboard-panel-head"><h3>累至今日的人力投入 <Tag>Mock</Tag></h3><span>截至 {today} · 合计 {analysis?.labor.toFixed(3) ?? '—'} 人月</span></div>
    <p className="pms-dashboard-ledger-note">按一级／二级部门汇总，仅随部门筛选变化。人月按每条工时记录的人天 ÷ 来源当月工作日累计。</p>
    {analysis?.issues.map(issue => <Alert key={issue} type="warning" showIcon message={issue} />)}
    {!analysis ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前项目暂无实际人力投入" /> : <Table className="pms-table" size="small" rowKey="key" dataSource={analysis.rows} pagination={false} scroll={{ x: 720 }} locale={{ emptyText: '所选部门截至今天暂无工时记录' }} columns={[
      { title: '一级部门', dataIndex: 'primary' }, { title: '二级部门', dataIndex: 'secondary' },
      { title: '投入人数', dataIndex: 'peopleCount', align: 'right' },
      { title: '累计人天', dataIndex: 'personDays', align: 'right', render: (value: number) => value.toFixed(2) },
      { title: '累计人月', dataIndex: 'labor', align: 'right', render: (value: number) => value.toFixed(3) },
      { title: '人月占比', dataIndex: 'share', align: 'right', render: (value: number) => `${value.toFixed(1)}%` },
    ]} summary={() => <Table.Summary.Row><Table.Summary.Cell index={0} colSpan={2}>合计</Table.Summary.Cell><Table.Summary.Cell index={2} align="right">{analysis.peopleCount}</Table.Summary.Cell><Table.Summary.Cell index={3} align="right">{analysis.personDays.toFixed(2)}</Table.Summary.Cell><Table.Summary.Cell index={4} align="right">{analysis.labor.toFixed(3)}</Table.Summary.Cell><Table.Summary.Cell index={5} align="right">{analysis.labor > 0 ? '100.0%' : '—'}</Table.Summary.Cell></Table.Summary.Row>} />}
  </section>
}
