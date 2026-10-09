'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Button, DatePicker, Empty, Input, Popover, Segmented, Select, Tooltip } from 'antd'
import { ApartmentOutlined, ArrowLeftOutlined, ArrowRightOutlined, BarChartOutlined, CalendarOutlined, DashboardOutlined, InfoCircleOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useProjectStore } from '@/stores/project'
import { usePermissionStore } from '@/stores/permission'
import { useHrConfigStore } from '@/stores/hrConfig'
import { useUiStore } from '@/stores/ui'
import { createCockpitPreferences, useCockpitUiStore, type CockpitPreferences } from '@/stores/cockpitUi'
import { useActivateProject } from '@/hooks/useActivateProject'
import { useResourceStore, resourceStore } from '@/components/project-resources/resourceVersionAdapter'
import { canResourceAction } from '@/lib/hrProjectRegistry'
import { evaluateMenuPermission } from '@/lib/permissionCenter'
import { getProjectInfoValue } from '@/lib/projectInfoValues'
import CockpitFiltersSummary from '@/components/cockpit/CockpitFiltersSummary'
import CockpitChart from '@/components/cockpit/CockpitChart'
import CockpitTable, { type CockpitColumn } from '@/components/cockpit/CockpitTable'
import CockpitMetricDetail, { type CockpitMetric } from '@/components/cockpit/CockpitMetricDetail'
import CockpitProjectRanking from '@/components/cockpit/CockpitProjectRanking'
import { cockpitProjectColumns, type CockpitProjectLens } from '@/components/cockpit/cockpitProjectLens'
import CockpitNumber from '@/components/cockpit/CockpitNumber'
import CockpitMotionContent from '@/components/cockpit/CockpitMotionContent'
import { useCockpitMotion } from '@/components/cockpit/useCockpitMotion'
import { cockpitDepartmentSelection, cockpitTrendDrilldown } from '@/components/cockpit/cockpitTrendInteraction'
import { collectCockpitInputs } from '@/components/cockpit/cockpitSources'
import {
  COCKPIT_CATEGORIES, buildCockpitFacts, canReadCockpitDepartment, cockpitOverview, cockpitRatios, cockpitShares, cockpitTrend,
  defaultCockpitScope, filterCockpitFacts, formatCockpit, summarizeCockpit,
  type AmountKey, type CockpitMode, type CockpitRow, type CockpitScope,
} from '@/components/cockpit/cockpitData'

const yearDates = (): [string, string] => [`${dayjs().year()}-01-01`, `${dayjs().year()}-12-31`]
const metricDefinitions: { key: AmountKey | 'deviation' | 'toDate' | 'annualExecution'; label: string; note: string; color: string }[] = [
  { key: 'annual', label: '年度预算', note: '年度预算 · 正式版本', color: '#7561d1' },
  { key: 'estimate', label: '项目概算', note: '项目概算 · 正式版本', color: '#3c99a0' },
  { key: 'budget', label: '项目预算', note: '项目预算 · 正式版本', color: '#cd9550' },
  { key: 'cumulative', label: '累至今日预估投入', note: '选定日期内，累计至今日', color: '#698dc8' },
  { key: 'actual', label: '项目核算', note: '工时核算 · 人天 / 当月工作日', color: '#39957d' },
  { key: 'deviation', label: '概算 → 预算偏差', note: '(项目预算 − 项目概算) / 项目概算', color: '#ad7c51' },
  { key: 'toDate', label: '累至今日预算执行率', note: '项目核算 / 累至今日预估投入', color: '#6d80b3' },
  { key: 'annualExecution', label: '全年执行率', note: '选定日期内，项目核算 / 项目预算', color: '#8775b7' },
]

export default function HrPipelineContainer() {
  const actor = useProjectStore(state => state.currentLoginUser)
  return <Cockpit key={actor} />
}
function Cockpit() {
  const activateProject = useActivateProject()
  const registry = useProjectStore(state => state.projects), actor = useProjectStore(state => state.currentLoginUser)
  const permission = usePermissionStore(), model = permission.permissionCenter
  const config = useHrConfigStore(state => state.data), rate = Number(config.feeRate?.[0]?.value ?? 5)
  const machine = useResourceStore('machine'), tos = useResourceStore('tos'), technical = useResourceStore('technical'), capability = useResourceStore('capability')
  const canManagement = evaluateMenuPermission(model, actor, 'cockpit.resources'), canTechnical = evaluateMenuPermission(model, actor, 'cockpit.technical')
  const savedPreferences = useCockpitUiStore(state => state.preferencesByActor[actor])
  const updatePreferences = useCockpitUiStore(state => state.updatePreferences)
  const preferences = useMemo(() => savedPreferences ?? createCockpitPreferences(), [savedPreferences])
  const { view, dates, scopePreference, departments, mode, trendTab, grain, hiddenTrendSeries, shareTab, shareScopePreferences, overviewTab, projectCategory, projectSearch } = preferences
  const setPreference = <K extends keyof CockpitPreferences>(key: K, value: CockpitPreferences[K]) => updatePreferences(actor, { [key]: value })
  const trendPanel = useRef<HTMLElement>(null), pendingPeriodFocus = useRef(false)
  const dateControls = useRef<HTMLDivElement>(null), pendingDateFocus = useRef(false)
  const previousPeriod = preferences.periodHistory.at(-1)
  const overviewPanel = useRef<HTMLElement>(null), pendingOverviewFocus = useRef(false)
  useEffect(() => {
    if (!pendingOverviewFocus.current) return
    pendingOverviewFocus.current = false
    overviewPanel.current?.scrollIntoView({ block: 'start', behavior: 'auto' })
    const scroller = overviewPanel.current?.querySelector<HTMLElement>('.cockpit-table-scroll')
    if (scroller) scroller.scrollLeft = 0
    const input = overviewPanel.current?.querySelector<HTMLInputElement>('input[aria-label="搜索项目总览"]')
    input?.focus({ preventScroll: true }); input?.select()
  }, [preferences])
  useEffect(() => {
    const scroller = overviewPanel.current?.querySelector<HTMLElement>('.cockpit-table-scroll')
    if (scroller) scroller.scrollLeft = 0
  }, [preferences.projectLens, overviewTab])
  useEffect(() => {
    if (pendingDateFocus.current) {
      pendingDateFocus.current = false
      dateControls.current?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true })
      return
    }
    if (!pendingPeriodFocus.current) return
    pendingPeriodFocus.current = false
    const target = trendPanel.current?.querySelector<SVGRectElement>('.cockpit-period-target[tabindex="0"]')
    target?.focus(); target?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' })
  }, [dates])
  const [detailMetric, setDetailMetric] = useState<CockpitMetric>()
  const [today, setToday] = useState(() => dayjs().format('YYYY-MM-DD'))
  useEffect(() => { COCKPIT_CATEGORIES.forEach(item => resourceStore(item.key).getState().refreshFormalProjects()) }, [registry])
  useEffect(() => { const timer = setInterval(() => setToday(dayjs().format('YYYY-MM-DD')), 60000); return () => clearInterval(timer) }, [])
  const selectedView = view === 'management' && canManagement ? 'management' : view === 'technical' && canTechnical ? 'technical' : canManagement ? 'management' : 'technical'
  const pageRoot = useRef<HTMLElement>(null)
  useCockpitMotion(pageRoot, selectedView, 'page', selectedView === 'management')
  const inputs = useMemo(() => canManagement ? collectCockpitInputs(registry, { machine, tos, technical, capability }, actor) : [], [registry, machine, tos, technical, capability, actor, permission, canManagement])
  const dateFilter = useMemo(() => ({ startDate: dates[0], endDate: dates[1] }), [dates])
  const allFacts = useMemo(() => buildCockpitFacts(inputs, dateFilter, rate, today, (input, primary, secondary) => canReadCockpitDepartment(model, actor, input.project, input.category, primary, secondary)), [inputs, dateFilter, rate, today, model, actor])
  const defaultScope = defaultCockpitScope(allFacts), scope = scopePreference ?? defaultScope
  const shareScopes = { research: shareScopePreferences.research ?? defaultScope, category: shareScopePreferences.category ?? defaultScope }
  const { options: departmentOptions, departments: effectiveDepartments } = useMemo(() => cockpitDepartmentSelection(allFacts, scope, departments), [allFacts, scope, departments])
  const facts = useMemo(() => filterCockpitFacts(allFacts, { scope, departments: effectiveDepartments }), [allFacts, scope, effectiveDepartments])
  const total = summarizeCockpit(facts), ratios = cockpitRatios(total, mode)
  const projectCount = new Set(facts.map(row => row.project.id)).size
  const warnings = [...new Set(facts.flatMap(row => row.issues))]
  const trend = cockpitTrend(facts, dateFilter, mode, trendTab as 'resource' | 'category', grain)
  const shareFacts = filterCockpitFacts(allFacts, { scope: shareScopes[shareTab], departments: effectiveDepartments })
  const shares = cockpitShares(shareFacts, dateFilter, shareTab)
  const overviewFacts = overviewTab === 'project' ? facts.filter(row => (projectCategory === 'all' || row.category === projectCategory) && row.project.name.toLowerCase().includes(projectSearch.trim().toLowerCase())) : facts
  const overviewRows = cockpitOverview(overviewFacts, overviewTab, mode)
  const overviewTotal: CockpitRow = { key: 'total', name: '合计', count: new Set(overviewFacts.map(row => row.project.id)).size, ...summarizeCockpit(overviewFacts) }
  const unit = mode === 'labor' ? '人月' : '万元'
  const percentage = (value?: number) => value === undefined ? '—' : `${formatCockpit(value)}%`
  const openProjectResources = (id: string) => useUiStore.getState().navigateWithEditGuard(() => {
    const latest = useProjectStore.getState(), project = latest.projects.find(item => item.id === id)
    if (!project || !canResourceAction({ pmsProjectId: id }, 'view', id, latest.currentLoginUser)) return
    activateProject(project)
    useUiStore.getState().setProjectSpaceModule('resources')
    useUiStore.getState().enterProjectSpace({ module: 'hrPipeline' })
  }, false)
  const overviewColumns: CockpitColumn<CockpitRow>[] = [{ key: 'name', label: overviewTab === 'category' ? '项目分类' : overviewTab === 'department' ? '二级部门' : '项目名称', width: overviewTab === 'project' ? 270 : 216, value: row => row.name,
    render: row => <div className="cockpit-row-name"><i style={{ background: COCKPIT_CATEGORIES.find(item => item.key === row.category)?.color ?? '#8995a8' }} />{overviewTab === 'project' && row.project ? <button className="cockpit-project-link" title={`查看 ${row.name} 的项目资源`} onClick={() => openProjectResources(row.project!.id)}><span>{row.name}</span><ArrowRightOutlined /></button> : <span title={row.name}>{row.name}</span>}{overviewTab === 'category' && <small>{row.count} 项</small>}</div> }]
  if (overviewTab === 'project') {
    overviewColumns.push({ key: 'category', label: '项目分类', width: 160, value: row => row.category, render: row => COCKPIT_CATEGORIES.find(item => item.key === row.category)?.label ?? '—' })
    const fields = [
      ...(projectCategory === 'all' || projectCategory === 'machine' ? [{ key: 'firstSaleTosVersion', label: '首销tOS版本' }] : []),
      { key: 'status', label: '项目状态' },
      ...(projectCategory === 'all' || projectCategory === 'machine' ? [{ key: 'softwareProjectLevel', label: '项目等级' }, { key: 'researchMode', label: '研发模式' }] : []),
    ]
    fields.forEach(field => { const read = (row: CockpitRow) => row.project && (field.key === 'status' || row.category === 'machine') ? String((field.key === 'firstSaleTosVersion' ? row.project.firstSaleTosVersionId || getProjectInfoValue({ ...row.project }, field.key) : getProjectInfoValue({ ...row.project }, field.key)) ?? '') || undefined : undefined
      overviewColumns.push({ ...field, width: 146, value: read, render: row => read(row) ?? '—' }) })
  }
  const amountColumns: { key: AmountKey; label: string }[] = [{ key: 'annual', label: '年度预算' }, { key: 'estimate', label: '项目概算' }, { key: 'budget', label: '项目预算' }, { key: 'cumulativeBudget', label: '累至今日项目预算' }, { key: 'actual', label: '项目核算' }]
  amountColumns.forEach(field => overviewColumns.push({ ...field, numeric: true, width: field.key === 'cumulativeBudget' ? 190 : 145, value: row => row[field.key]?.[mode], render: row => formatCockpit(row[field.key]?.[mode]) }))
  ;([{ key: 'deviation', label: '概算→预算偏差' }, { key: 'toDate', label: '累至今日预算执行率' }, { key: 'annualExecution', label: '年度执行率' }] as const).forEach(field => overviewColumns.push({ ...field, numeric: true, width: 190, value: row => cockpitRatios(row, mode)[field.key], render: row => percentage(cockpitRatios(row, mode)[field.key]) }))
  const projectColumns = overviewTab === 'project' && preferences.projectLens === 'actual' ? [...overviewColumns, {
    key: 'cumulative', label: '累至今日预估投入', numeric: true, width: 190,
    value: (row: CockpitRow) => row.cumulative?.[mode], render: (row: CockpitRow) => formatCockpit(row.cumulative?.[mode]),
  }] : overviewColumns
  const visibleOverviewColumns = overviewTab === 'project' ? cockpitProjectColumns(projectColumns, preferences.projectLens) : overviewColumns
  const shareColumns: CockpitColumn<typeof shares.rows[number]>[] = [
    { key: 'label', label: shareTab === 'research' ? '三级研发' : '项目分类', width: 166, render: row => <span className="cockpit-share-name"><i style={{ background: row.color }} />{row.label}</span> },
    { key: 'total', label: '总投入比', width: 128, numeric: true, render: row => <strong>{percentage(row.total)}</strong> },
    ...shares.months.map((month, index) => ({ key: month, label: month.replace('-', ''), width: 104, numeric: true, render: (row: typeof shares.rows[number]) => percentage(row.months[index]) })),
  ]
  const resetFilters = () => useCockpitUiStore.getState().resetFilters(actor)
  if (!canManagement && !canTechnical) return <Empty description="暂无驾驶舱访问权限" />
  return <main ref={pageRoot} className="cockpit" aria-label="驾驶舱">
    <header className="cockpit-heading">
      <div className="cockpit-title-group"><span className="cockpit-title-icon"><DashboardOutlined /></span><div><div className="cockpit-eyebrow">驾驶舱 <span>/</span> 资源管理</div><h1>资源全景</h1></div></div>
      <div className="cockpit-view-switch" role="tablist" aria-label="驾驶舱视角">
        {canManagement && <button role="tab" aria-selected={selectedView === 'management'} onClick={() => setPreference('view', 'management')}>管理层 / 部门经理 / 部门运营</button>}
        {canTechnical && <button role="tab" aria-selected={selectedView === 'technical'} onClick={() => setPreference('view', 'technical')}>技术运营</button>}
      </div>
    </header>
    {selectedView === 'technical' ? <section className="cockpit-technical-blank" role="tabpanel" aria-label="技术运营" /> : <section role="tabpanel" aria-label="资源管理看板" className="cockpit-management">
      <div className="cockpit-filterbar">
        <div ref={dateControls} className="cockpit-date-filter"><CalendarOutlined /><span className="cockpit-filter-label">统计日期</span><DatePicker.RangePicker aria-label="统计日期" allowClear={false} value={[dayjs(dates[0]), dayjs(dates[1])]} onChange={value => { if (value?.[0] && value[1]) setPreference('dates', [value[0].format('YYYY-MM-DD'), value[1].format('YYYY-MM-DD')]) }} presets={[{ label: '截至今日', value: [dayjs().startOf('year'), dayjs()] }, { label: '本年度', value: [dayjs().startOf('year'), dayjs().endOf('year')] }, { label: '本季度', value: [dayjs().month(Math.floor(dayjs().month() / 3) * 3).startOf('month'), dayjs().month(Math.floor(dayjs().month() / 3) * 3 + 2).endOf('month')] }, { label: '本月', value: [dayjs().startOf('month'), dayjs().endOf('month')] }]} /></div>
        <div className="cockpit-dept-filter"><ApartmentOutlined /><Select aria-label="部门范围" value={scope} onChange={value => updatePreferences(actor, { scopePreference: value, departments: [] })} options={[{ value: 'software', label: '软件工程部' }, { value: 'all', label: '全研发' }]} /><Select aria-label="二级部门" mode="multiple" placeholder="全部二级部门" value={effectiveDepartments} onChange={value => setPreference('departments', value)} options={departmentOptions.map(value => ({ value, label: value }))} maxTagCount="responsive" allowClear /></div>
        <Tooltip title="重置全部筛选，保留单位与视图"><Button type="text" icon={<ReloadOutlined />} aria-label="重置筛选" onClick={resetFilters} /></Tooltip>
        <Segmented aria-label="统计单位" value={mode} options={[{ label: '人月', value: 'labor' }, { label: '万元', value: 'cost' }]} onChange={value => setPreference('mode', value as CockpitMode)} />
      </div>
      <CockpitFiltersSummary dates={dates} defaultDates={yearDates()} scope={scope} explicitScope={scopePreference !== undefined} departments={effectiveDepartments}
        onResetDates={() => setPreference('dates', yearDates())}
        onResetScope={() => updatePreferences(actor, { scopePreference: undefined, departments: [] })}
        onRemoveDepartment={department => setPreference('departments', departments.filter(item => item !== department))} />
      {previousPeriod && <div className="cockpit-period-return" role="group" aria-label="期间探索导航">
        <button type="button" aria-label={`返回上级日期 ${previousPeriod[0]} 至 ${previousPeriod[1]}`} onClick={() => { pendingDateFocus.current = useCockpitUiStore.getState().returnToPeriod(actor) }}>
          <ArrowLeftOutlined /><span>返回上级日期</span><b>{previousPeriod[0]} — {previousPeriod[1]}</b>
        </button><small>仅恢复日期，保留部门、单位与视图</small>
      </div>}
      <div className="cockpit-context"><span><i />可见资源汇总 <b>{projectCount}</b> 个项目 <span className="cockpit-divider">/</span> 截至 {today}</span>
        <Popover title="数据口径" content={<div className="cockpit-rule-content"><p>预算仅取唯一正式版本，已绑定年度预算计入对应正式项目一次。未设置正式版本的指标不计入汇总，以“—”表示无可用来源。</p><p>核算 = 工时人天 / 来源月份工作日；费用含非人力费用。日期与部门筛选同时作用于所有指标。累至今日按日历日分摊，预算缺失时依次使用概算、年度预算。</p><p>比例由汇总值计算，不平均项目百分比。投入比使用工时人天占比；两个投入比可各自选择软工或全研发。</p><p>当前沿用系统演示资源与工时数据。{warnings.length ? `${warnings.length} 项来源记录待完善：${warnings.slice(0, 3).join('；')}` : '只汇总当前角色可访问的项目与部门。'}</p></div>}><button className="cockpit-text-button"><InfoCircleOutlined /> 数据口径{warnings.length ? ` · ${warnings.length} 项待完善` : ''}</button></Popover>
      </div>
      <div className="cockpit-metrics" role="group" aria-label="八项核心指标">
        {metricDefinitions.map(metric => {
          const ratio = ['deviation', 'toDate', 'annualExecution'].includes(metric.key)
          const value = ratio ? ratios[metric.key as keyof typeof ratios] : total[metric.key as AmountKey]?.[mode]
          const other = total[metric.key as AmountKey]?.[mode === 'labor' ? 'cost' : 'labor']
          const covered = new Set(facts.filter(row => row[metric.key as AmountKey]?.[mode] !== undefined).map(row => row.project.id)).size
          return <article className={`cockpit-metric${metric.key === 'actual' ? ' cockpit-metric-emphasis' : ''}`} key={metric.key} style={{ '--metric-color': metric.color } as CSSProperties}>
            <div className="cockpit-metric-title"><h2>{metric.label}</h2><Tooltip title={`${metric.note}。${ratio ? "按可用来源汇总后计算，缺失项不作为零值。" : `可用来源 ${covered}/${projectCount} 项；缺失或无效来源未纳入汇总。`}`}><button aria-label={`${metric.label}计算规则`}><InfoCircleOutlined /></button></Tooltip></div>
            <button className="cockpit-metric-value" aria-label={`查看${metric.label}来源明细`} onClick={() => setDetailMetric(metric)}><CockpitNumber value={value} suffix={ratio ? '%' : ''} context={mode} />{!ratio && <small>{unit}</small>}<ArrowRightOutlined className="cockpit-metric-drill" /></button>
            <div className="cockpit-metric-bottom">{ratio ? <><span>{metric.key === 'deviation' ? '概算与预算对比' : '预算执行进度'}</span><span className="cockpit-mini-meter"><i style={{ width: `${Math.min(100, Math.max(0, value ?? 0))}%` }} /></span></> : <><span>{formatCockpit(other)} {mode === 'labor' ? '万元' : '人月'}</span><small>{covered ? `${covered}/${projectCount} 项` : '暂无来源'}</small></>}</div>
          </article>
        })}
      </div>
      {!facts.length && <div className="cockpit-scope-note"><InfoCircleOutlined /><span>当前日期与部门范围暂无可用资源数据。</span>{scope === 'software' && <button onClick={() => { updatePreferences(actor, { scopePreference: 'all', departments: [] }) }}>查看全研发 <ArrowRightOutlined /></button>}</div>}
      <div className="cockpit-analysis-grid">
        <section ref={trendPanel} className="cockpit-panel cockpit-trend-panel" aria-label="投入趋势">
          <div className="cockpit-panel-header"><div><span className="cockpit-section-kicker">TREND</span><h2>投入趋势</h2></div><div className="cockpit-panel-tools">{trendTab === 'category' && <Segmented aria-label="趋势粒度" options={[{ label: '月', value: 'month' }, { label: '周', value: 'week' }]} value={grain} onChange={value => setPreference('grain', value as 'month' | 'week')} />}</div></div>
          <div className="cockpit-tabs" role="tablist" aria-label="趋势类型">{[{ key: 'resource', label: '资源管道总趋势' }, { key: 'category', label: '项目分类投入趋势' }].map(item => <button key={item.key} role="tab" aria-selected={trendTab === item.key} onClick={() => setPreference('trendTab', item.key as CockpitPreferences['trendTab'])}>{item.label}</button>)}</div>
          <CockpitMotionContent key={`${trendTab}:${grain}:${mode}:${dates.join()}:${scope}:${effectiveDepartments.join()}`} motionKey={`${trendTab}:${grain}`}><CockpitChart {...trend} mode={mode} bars={trendTab === 'category'} grain={trendTab === 'resource' ? 'month' : grain} dates={dates}
            hidden={hiddenTrendSeries[trendTab]} onHiddenChange={hidden => setPreference('hiddenTrendSeries', { ...hiddenTrendSeries, [trendTab]: hidden })}
            onInspectPeriod={period => { const patch = cockpitTrendDrilldown(period, trendTab === 'resource' ? 'month' : grain, dates, scope, shareScopes); if (patch) pendingPeriodFocus.current = useCockpitUiStore.getState().focusPeriod(actor, patch) }} /></CockpitMotionContent>
        </section>
        <section className="cockpit-panel cockpit-share-panel" aria-label="投入结构">
          <div className="cockpit-panel-header"><div><span className="cockpit-section-kicker">ALLOCATION</span><h2>投入结构</h2></div><Segmented aria-label={`${shareTab === 'research' ? '三级研发' : '项目分类'}投入范围`} value={shareScopes[shareTab]} options={[{ label: '软工', value: 'software' }, { label: '全研发', value: 'all' }]} onChange={value => setPreference('shareScopePreferences', { ...shareScopePreferences, [shareTab]: value as CockpitScope })} /></div>
          <div className="cockpit-tabs" role="tablist" aria-label="投入比例类型">{[{ key: 'research' as const, label: '三级研发投入比' }, { key: 'category' as const, label: '项目分类投入比' }].map(item => <button key={item.key} role="tab" aria-selected={shareTab === item.key} onClick={() => setPreference('shareTab', item.key)}>{item.label}</button>)}</div>
          <CockpitMotionContent key={shareTab} motionKey={shareTab}>
            <div className="cockpit-share-summary"><span>工时总投入 <strong>{shares.total ? formatCockpit(shares.total) : '—'}</strong> 人天</span><small>{shareScopes[shareTab] === 'software' ? '软件工程部' : '全研发'} · 选定日期</small></div>
            <div className="cockpit-share-bar" aria-label="投入比例分布">{shares.rows.map(row => <Tooltip key={row.key} title={`${row.label} ${percentage(row.total)}`}><span style={{ width: `${row.total ?? 0}%`, background: row.color }} /></Tooltip>)}</div>
            <CockpitTable rows={shares.rows} columns={shareColumns} label={shareTab === 'research' ? '三级研发投入比' : '项目分类投入比'} />
            <p className="cockpit-panel-note">月度占比随所选日期计算，横向滚动查看各月。{shares.rows.some(row => row.label === '未归类') ? '未配置研发分类的工时保留为未归类。' : ''}</p>
          </CockpitMotionContent>
        </section>
      </div>
      <CockpitProjectRanking facts={facts} metric={preferences.rankingMetric} mode={mode} onMetricChange={value => setPreference('rankingMetric', value)} onOpenProject={openProjectResources}
        onLocateProject={(name = '') => { pendingOverviewFocus.current = true; updatePreferences(actor, { overviewTab: 'project', projectCategory: 'all', projectSearch: name, projectLens: preferences.rankingMetric }) }} />
      <section ref={overviewPanel} className="cockpit-panel cockpit-overview" aria-label="资源总览明细">
        <div className="cockpit-panel-header"><div><span className="cockpit-section-kicker">OVERVIEW</span><h2>资源总览 <small>{unit}</small></h2></div><div className="cockpit-panel-tools">{overviewTab === 'project' && <Input className="cockpit-project-search" aria-label="搜索项目总览" placeholder="搜索项目" prefix={<SearchOutlined />} value={projectSearch} onChange={event => setPreference('projectSearch', event.target.value)} allowClear />}{overviewTab === 'project' && <Select aria-label="项目分类" value={projectCategory} onChange={value => setPreference('projectCategory', value)} options={[{ value: 'all', label: '全部项目分类' }, ...COCKPIT_CATEGORIES.map(item => ({ value: item.key, label: item.label }))]} />}<span className="cockpit-table-hint"><BarChartOutlined /> 点击表头排序 · 拖动边缘调宽</span></div></div>
        <div className="cockpit-tabs" role="tablist" aria-label="总览类型">{[{ key: 'category' as const, label: '项目分类总览' }, { key: 'department' as const, label: '二级部门总览' }, { key: 'project' as const, label: '项目总览' }].map(item => <button role="tab" key={item.key} aria-selected={overviewTab === item.key} onClick={() => setPreference('overviewTab', item.key)}>{item.label}</button>)}</div>
        {overviewTab === 'project' && <div className="cockpit-project-results" role="status"><span>匹配 <b>{overviewRows.length}</b> 个项目 <span>/ 当前全局范围 {projectCount} 个</span></span><small>分类和搜索仅筛选项目明细</small>{(projectSearch.trim() || projectCategory !== 'all') && <button className="cockpit-text-button" onClick={() => updatePreferences(actor, { projectCategory: 'all', projectSearch: '' })}>清除项目明细筛选</button>}</div>}
        {overviewTab === 'project' && <div className="cockpit-project-lens" role="group" aria-label="项目明细核对设置">
          <Segmented aria-label="项目明细视图" value={preferences.projectLens} onChange={value => setPreference('projectLens', value as CockpitProjectLens)} options={[{ label: '全部字段', value: 'all' }, { label: '预算核对', value: 'budget' }, { label: '核算核对', value: 'actual' }]} />
          <p>{preferences.projectLens === 'actual' ? '执行率使用累至今日预估投入，预算缺失时沿用概算或年度预算来源。' : preferences.projectLens === 'budget' ? '对照项目预算、概算偏差和年度预算；缺失来源保留为“—”。' : '展示项目信息与全部原有投入指标，横向滚动查看。'}</p>
        </div>}
        <CockpitMotionContent key={overviewTab} motionKey={`${overviewTab}:${preferences.projectLens}`}><CockpitTable rows={overviewRows} columns={visibleOverviewColumns} label="资源总览明细" footer={overviewTotal}
          view={preferences.overviewTables[overviewTab] ?? { widths: {} }} onViewChange={value => useCockpitUiStore.getState().updateOverviewTable(actor, overviewTab, value)} /></CockpitMotionContent>
      </section>
      <footer className="cockpit-footer"><span>资源正式版本 + 工时核算</span><span>仅展示当前角色授权范围内的数据</span></footer>
    </section>}
    {detailMetric && selectedView === 'management' && <CockpitMetricDetail key={detailMetric.key} metric={detailMetric} facts={facts} inputs={inputs} mode={mode} dates={dates} onClose={() => setDetailMetric(undefined)} onOpenProject={openProjectResources} />}
  </main>
}
