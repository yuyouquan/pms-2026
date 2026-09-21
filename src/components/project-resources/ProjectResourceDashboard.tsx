'use client'
import { useEffect, useState, type CSSProperties } from 'react'
import { App, Button, Empty, Select, Segmented, Table, Tag, Tooltip } from 'antd'
import { ArrowRightOutlined, CheckCircleOutlined, DownloadOutlined, ExclamationCircleOutlined, InfoCircleOutlined, ReloadOutlined } from '@ant-design/icons'
import type { ProjectItem } from '@/types/app'
import type { HrProjectCategory } from '@/lib/hrFormalProjectSource'
import type { ResourceBudgetType } from '@/components/project-resources/resourceVersionViewData'
import { resourceStore, useResourceStore, resourceProjectName } from '@/components/project-resources/resourceVersionAdapter'
import { useProjectStore } from '@/stores/project'
import { usePermissionStore } from '@/stores/permission'
import { useHrConfigStore } from '@/stores/hrConfig'
import { canResourceAction } from '@/lib/hrProjectRegistry'
import { buildDashboardAnalysis, dashboardDelta, dashboardSources, DASHBOARD_BUDGETS, selectDashboardSource } from '@/components/project-resources/resourceDashboardData'
import { DashboardCostMix, DashboardStageBars, DashboardTrend } from '@/components/project-resources/ResourceDashboardCharts'
import { exportResourceDashboard } from '@/components/project-resources/exportResourceDashboard'
import HrSourceLink from '@/components/project-resources/HrSourceLink'

export default function ProjectResourceDashboard({ project, category, onOpenVersion }: {
  project: ProjectItem; category: HrProjectCategory; onOpenVersion: (type: ResourceBudgetType, versionId?: string) => void
}) {
  const { message } = App.useApp()
  const store = useResourceStore(category)
  useProjectStore(state => state.currentLoginUser)
  useProjectStore(state => state.projects)
  usePermissionStore()
  const rate = useHrConfigStore(state => Number(state.data.feeRate?.[0]?.value ?? 5))
  const [selected, setSelected] = useState<Partial<Record<ResourceBudgetType, string>>>({})
  const [year, setYear] = useState('all')
  const [department, setDepartment] = useState('all')
  const [focusType, setFocusType] = useState<ResourceBudgetType>('projectBudget')
  const [mode, setMode] = useState<'labor' | 'cost'>('labor')
  const [cumulative, setCumulative] = useState(false)
  useEffect(() => { resourceStore(category).getState().refreshFormalProjects() }, [category, project.id])
  const available = DASHBOARD_BUDGETS.map(item => dashboardSources(store.projects, project.id, item.key))
  const sources = available.map((items, index) => selectDashboardSource(items, selected[DASHBOARD_BUDGETS[index].key]))
  const unfiltered = sources.map(source => source && buildDashboardAnalysis(category, source, store.monthlyInvestments, rate))
  const years = [...new Set(unfiltered.flatMap(analysis => analysis?.years ?? []))].sort()
  const departments = [...new Set(sources.flatMap(source => source ? [
    ...store.monthlyInvestments.filter(row => row.versionId === source.version.id && !row.isArchived).map(row => row.secondaryDepartment),
    ...('departmentInvestments' in source.version ? source.version.departmentInvestments.map(row => row.secondaryDepartment) : []),
    ...(source.version.nonLaborInvestment?.items.map(item => item.secondaryDepartment) ?? []),
  ] : []))].filter(Boolean).sort()
  const effectiveYear = years.includes(year) ? year : 'all'
  const effectiveDepartment = departments.includes(department) ? department : 'all'
  const analyses = sources.map(source => source && buildDashboardAnalysis(category, source, store.monthlyInvestments, rate, { year: effectiveYear, department: effectiveDepartment }))
  const focus = analyses.find(analysis => analysis?.source.version.budgetType === focusType) ?? [...analyses].reverse().find(Boolean)
  const focusLabel = DASHBOARD_BUDGETS.find(item => item.key === focus?.source.version.budgetType)?.label
  const period = effectiveYear === 'all' ? '全周期' : `${effectiveYear} 年`
  const hasAny = sources.some(Boolean)
  const canExport = canResourceAction({ pmsProjectId: project.id }, 'export', project.id)
  const exportAnalysis = () => {
    if (!canResourceAction({ pmsProjectId: project.id }, 'export', project.id)) {
      message.warning('当前项目资源导出权限已变化')
      return
    }
    const current = resourceStore(category).getState()
    const currentSources = sources.map(source => source && dashboardSources(current.projects, project.id, source.version.budgetType).find(item => item.version.id === source.version.id))
    if (!currentSources.some(Boolean) || sources.some((source, index) => source && (!currentSources[index] || !canResourceAction(currentSources[index]?.owner, 'export', project.id)))) {
      message.warning('分析来源版本或查看权限已变化，请重新选择')
      return
    }
    const currentRate = Number(useHrConfigStore.getState().data.feeRate?.[0]?.value ?? 5)
    const currentAnalyses = currentSources.map(source => source && buildDashboardAnalysis(category, source, current.monthlyInvestments, currentRate, { year: effectiveYear, department: effectiveDepartment }))
    const currentFocus = currentAnalyses.find(analysis => analysis?.source.version.budgetType === focusType) ?? [...currentAnalyses].reverse().find(Boolean)
    exportResourceDashboard(project.name, currentAnalyses, currentFocus, effectiveYear, effectiveDepartment, mode, cumulative)
  }
  const warnings = focus?.issues.filter(issue => issue.severity === 'warning') ?? []
  return <section className="pms-resource-dashboard" aria-label="项目资源看板">
    <div className="pms-dashboard-toolbar">
      <div><h2>资源概览</h2><Tooltip title={`计划费用 = 月度人月 × 费率 ${rate} 万元/人月 + 非人力费用；三类预算独立比较，不合并累计。`}><span className="pms-dashboard-definition"><InfoCircleOutlined /> 计划投入分析</span></Tooltip></div>
      <div><Button icon={<ReloadOutlined />} onClick={() => { setSelected({}); setYear('all'); setDepartment('all') }}>恢复正式版本</Button>{canExport && <Button icon={<DownloadOutlined />} disabled={!hasAny} onClick={exportAnalysis}>导出分析</Button>}</div>
    </div>
    <div className="pms-dashboard-filters">
      <label><span>年份</span><Select aria-label="看板年份" value={effectiveYear} onChange={setYear} options={[{ value: 'all', label: '全周期' }, ...years.map(value => ({ value, label: `${value} 年` }))]} /></label>
      <label><span>二级部门</span><Select aria-label="看板二级部门" showSearch optionFilterProp="label" value={effectiveDepartment} onChange={setDepartment} options={[{ value: 'all', label: '全部二级部门' }, ...departments.map(value => ({ value, label: value }))]} /></label>
      <label><span>详细分析</span><Select aria-label="详细分析预算分类" value={focus?.source.version.budgetType} placeholder="请先选择来源版本" onChange={setFocusType} options={DASHBOARD_BUDGETS.map((item, index) => ({ value: item.key, label: item.label, disabled: !analyses[index] }))} /></label>
      <span className="pms-dashboard-filter-note">默认正式版本 · 手动切换仅用于分析</span>
    </div>
    <div className="pms-dashboard-sources">
      {DASHBOARD_BUDGETS.map((item, index) => {
        const source = sources[index], analysis = analyses[index], list = available[index], officials = list.filter(entry => entry.version.isActive)
        const baseline = index > 0 ? analyses[index - 1] : undefined
        const delta = dashboardDelta(analysis?.months.length ? analysis.cost : undefined, baseline?.months.length ? baseline.cost : undefined)
        const selectedValue = selected[item.key]
        return <article key={item.key} className={`pms-dashboard-source${focus?.source.version.budgetType === item.key ? ' pms-dashboard-source-focused' : ''}`} style={{ '--budget-color': item.color } as CSSProperties} aria-label={`${item.label}数据来源`}>
          <div className="pms-dashboard-source-title"><h3>{item.label}</h3>{source && <Tag color={source.version.isActive ? 'success' : 'default'}>{source.version.isActive ? '正式版本' : '分析版本'}</Tag>}</div>
          <Select aria-label={`${item.label}分析版本`} value={selectedValue ?? '__official__'} onChange={value => setSelected(previous => ({ ...previous, [item.key]: value === '__official__' ? undefined : value }))}
            options={[{ value: '__official__', label: officials.length === 1 ? `正式版本 · ${officials[0].version.versionNumber}` : officials.length ? '多个正式版本，请手动选择' : '未设置正式版本' }, ...list.map(entry => ({ value: entry.version.id, label: `${entry.version.versionNumber} · ${resourceProjectName(entry.owner)}${entry.version.isActive ? ' · 正式' : ''}${entry.version.lockState === 'locked' ? ' · 已锁定' : ''}` }))]} />
          {analysis && source ? <>
            <div className="pms-dashboard-source-values"><div><span>{period}费用</span><strong>{analysis.months.length ? analysis.cost.toFixed(2) : '—'} <small>万元</small></strong></div><div><span>{period}人力</span><strong>{analysis.months.length ? analysis.labor.toFixed(1) : '—'} <small>人月</small></strong></div></div>
            <div className="pms-dashboard-source-comparison">{delta ? <>较{DASHBOARD_BUDGETS[index - 1].label} {delta.amount > 0 ? '+' : ''}{delta.amount.toFixed(2)} 万元{delta.percent !== undefined && `（${delta.percent > 0 ? '+' : ''}${delta.percent.toFixed(1)}%）`}</> : analysis.months.length ? `全周期目标 ${analysis.target.toFixed(1)} 人月 · ${analysis.allMonths.length} 个月` : '所选年份暂无计划月份'}</div>
            <div className="pms-dashboard-source-footer"><HrSourceLink project={source.owner} name={resourceProjectName(source.owner)} /><Button type="link" size="small" aria-label={`查看${item.label}来源版本`} onClick={() => onOpenVersion(item.key, source.version.id)}>查看版本 <ArrowRightOutlined /></Button></div>
          </> : <div className="pms-dashboard-source-empty"><span>{selectedValue ? '所选版本已不可用，请重新选择' : list.length ? officials.length > 1 ? '存在多个正式版本，请选择分析来源' : '未纳入统计，可选择版本进行分析' : '暂无可查看的来源版本'}</span><Button type="link" onClick={() => onOpenVersion(item.key)}>查看{item.label} <ArrowRightOutlined /></Button></div>}
        </article>
      })}
    </div>
    {!hasAny ? <div className="pms-resource-panel"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无可分析的正式版本，请在上方选择版本，或前往预算分类设置正式版本。" /></div> : <>
      {focus && <>
        <div className="pms-dashboard-analysis-heading"><h3>{focusLabel} · {focus.source.version.versionNumber}</h3><span>{period} · {effectiveDepartment === 'all' ? '全部二级部门' : effectiveDepartment}</span></div>
        <div className="pms-dashboard-kpis">
          <div><span>计划投入金额</span><strong>{focus.months.length ? focus.cost.toFixed(2) : '—'} <small>万元</small></strong><span>{focus.months.length ? `人力 ${focus.laborCost.toFixed(2)} · 非人力 ${(focus.nonLaborYuan / 10000).toFixed(2)}` : '所选年份暂无计划月份'}</span></div>
          <div><span>计划投入人力</span><strong>{focus.months.length ? focus.labor.toFixed(1) : '—'} <small>人月</small></strong><span>全周期目标 {focus.target.toFixed(1)} 人月</span></div>
          <div><span>月均人力</span><strong>{focus.months.length ? focus.average.toFixed(1) : '—'} <small>人</small></strong><span>{focus.peak ? `峰值 ${focus.peak.value.toFixed(1)} 人 · ${focus.peak.month}` : '暂无月度计划'}</span></div>
          <div className={warnings.length ? 'pms-dashboard-kpi-warning' : ''}><span>待核对事项（全周期）</span><strong>{warnings.length} <small>项</small></strong><span>不足 {focus.deficit.toFixed(1)} · 超额 {focus.excess.toFixed(1)} 人月</span></div>
        </div>
      </>}
      <div className="pms-dashboard-grid pms-dashboard-grid-trend">
        <section className="pms-resource-panel"><div className="pms-dashboard-panel-head"><h3>预算趋势对比</h3><div><Segmented aria-label="趋势指标" value={mode} options={[{ value: 'labor', label: '投入人月' }, { value: 'cost', label: '费用（万元）' }]} onChange={value => setMode(value as 'labor' | 'cost')} /><Segmented aria-label="趋势计算方式" value={cumulative ? 'cumulative' : 'monthly'} options={[{ value: 'monthly', label: '月度' }, { value: 'cumulative', label: '累计' }]} onChange={value => setCumulative(value === 'cumulative')} /></div></div>
          <DashboardTrend analyses={analyses} mode={mode} cumulative={cumulative} />
        </section>
        {focus && <section className="pms-resource-panel"><div className="pms-dashboard-panel-head"><h3>费用构成</h3><span>{focusLabel} · {period}</span></div><DashboardCostMix analysis={focus} /><p className="pms-dashboard-note">人力费率 {focus.rate.toFixed(2)} 万元/人月；非人力明细以元计入。</p></section>}
      </div>
      {focus && <>
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
      </>}
    </>}
  </section>
}
