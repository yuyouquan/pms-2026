'use client'
import { Button, Table, Tooltip } from 'antd'
import { ArrowRightOutlined, CheckCircleOutlined, ExclamationCircleOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { DashboardCostMix, DashboardStageBars } from '@/components/project-resources/ResourceDashboardCharts'
import type { DashboardAnalysis } from '@/components/project-resources/resourceDashboardData'
import type { ResourceBudgetType } from '@/components/project-resources/resourceVersionViewData'
export default function ResourceDashboardDetails({ focus, focusLabel, period, onOpenVersion }: {
  focus: DashboardAnalysis; focusLabel: string; period: string; onOpenVersion: (type: ResourceBudgetType, versionId?: string) => void
}) {
  return <div className="pms-dashboard-more-content">
    <section className="pms-resource-panel"><div className="pms-dashboard-panel-head"><h3>费用构成</h3><span>{focusLabel} · {period}</span></div><DashboardCostMix analysis={focus} /><p className="pms-dashboard-note">人力费率 {focus.rate.toFixed(2)} 万元/人月；非人力明细以元计入。</p></section>
        <div className="pms-dashboard-grid pms-dashboard-grid-detail">
          <section className="pms-resource-panel"><div className="pms-dashboard-panel-head"><h3>部门投入结构</h3><span>{period} · 人月</span></div>
            <Table className="pms-table pms-dashboard-departments" size="small" rowKey="key" dataSource={focus.departments} pagination={false} scroll={{ x: 680, y: 345 }} columns={[
              { title: '一级部门', dataIndex: 'primary', width: 110, render: value => value || '待填写' }, { title: '二级部门', dataIndex: 'secondary', width: 110, render: value => value || '待填写' },
              { title: '所选期间投入', dataIndex: 'selected', align: 'right', width: 112, render: value => focus.months.length ? value.toFixed(1) : '—' },
              { title: '占比', dataIndex: 'share', width: 100, render: value => !focus.months.length ? '—' : <span className="pms-dashboard-share"><span style={{ width: `${Math.min(100, value)}%` }} /><em>{value.toFixed(1)}%</em></span> },
              { title: '全周期分配 / 目标', key: 'balance', align: 'right', width: 158, render: (_, row) => `${row.allocated.toFixed(1)} / ${row.target.toFixed(1)}` },
              { title: '全周期偏差', dataIndex: 'delta', align: 'right', width: 130, render: (value, row) => <span className={row.deficit || row.excess ? 'pms-resource-difference' : ''}>{row.deficit && row.excess ? `不足 ${row.deficit.toFixed(1)} / 超额 ${row.excess.toFixed(1)}` : `${value > 0 ? '+' : ''}${value.toFixed(1)}`}</span> },
            ]} />
          </section>
          <section className="pms-resource-panel"><div className="pms-dashboard-panel-head"><h3>阶段投入分布</h3><Tooltip title="按每个月主要覆盖阶段归属统计；跨阶段月份归入天数最多的阶段，与资源月度视图的阶段口径一致。"><InfoCircleOutlined /></Tooltip></div><DashboardStageBars analysis={focus} /><p className="pms-dashboard-note">按月份主阶段归属 · {period}</p></section>
        </div>
        <div className="pms-dashboard-grid pms-dashboard-grid-detail">
          <section className="pms-resource-panel"><div className="pms-dashboard-panel-head"><h3>非人力科目结构</h3><span>{period} · 元</span></div>
            <Table className="pms-table" size="small" rowKey="key" dataSource={focus.subjects} pagination={false} scroll={{ x: 440, y: 300 }} locale={{ emptyText: '当前筛选范围暂无非人力科目' }} columns={[
              { title: '二级科目', dataIndex: 'secondary' }, { title: '三级科目', dataIndex: 'tertiary' }, { title: '金额', dataIndex: 'amount', align: 'right', render: value => value.toFixed(2) }, { title: '占比', dataIndex: 'share', align: 'right', render: value => `${value.toFixed(1)}%` },
            ]} />
          </section>
          <section className="pms-resource-panel"><div className="pms-dashboard-panel-head"><h3>数据检查</h3><span>全周期 · {focusLabel}</span></div>
            <div className="pms-dashboard-issues">{focus.issues.length ? focus.issues.map(issue => <div key={issue.key} className={`pms-dashboard-issue pms-dashboard-issue-${issue.severity}`}>{issue.severity === 'warning' ? <ExclamationCircleOutlined /> : <InfoCircleOutlined />}<div><strong>{issue.title}</strong><p>{issue.detail}</p></div></div>) : <div className="pms-dashboard-check-pass"><CheckCircleOutlined /><span>部门比例和月度分配均已平衡</span></div>}</div>
            <Button type="link" className="pms-dashboard-issue-action" onClick={() => onOpenVersion(focus.source.version.budgetType, focus.source.version.id)}>前往来源版本核对 <ArrowRightOutlined /></Button>
          </section>
        </div>
  </div>
}
