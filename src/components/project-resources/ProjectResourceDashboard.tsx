'use client'
import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { App, Button, DatePicker, Select, Segmented, Tooltip } from 'antd'
import { DownloadOutlined, InfoCircleOutlined, ReloadOutlined } from '@ant-design/icons'
import type { ProjectItem } from '@/types/app'
import { resolveHrFormalSource, type HrProjectCategory } from '@/lib/hrFormalProjectSource'
import { resourceStore, useResourceStore } from '@/components/project-resources/resourceVersionAdapter'
import { useProjectStore } from '@/stores/project'
import { usePermissionStore } from '@/stores/permission'
import { useHrConfigStore } from '@/stores/hrConfig'
import { resolveMachineDepartmentInvestments } from '@/lib/resourceAllocation'
import { canResourceAction } from '@/lib/hrProjectRegistry'
import { buildDashboardAnalysis, dashboardSources, DASHBOARD_BUDGETS, selectDashboardSource } from '@/components/project-resources/resourceDashboardData'
import { buildAccountingAnalysis, dashboardDepartmentParents, UNASSIGNED_PRIMARY, type DashboardFilter } from '@/components/project-resources/resourceAccounting'
import { resourceAccountingDataset } from '@/mock/resourceAccounting'
import { dashboardBusinessTrend } from '@/components/project-resources/resourceDashboardBusiness'
import { exportResourceBusinessDashboard } from '@/components/project-resources/exportResourceBusinessDashboard'
import ResourceDashboardMetrics from '@/components/project-resources/ResourceDashboardMetrics'
import ResourceBusinessTrend from '@/components/project-resources/ResourceBusinessTrend'
import ResourceAccountingDetails from '@/components/project-resources/ResourceAccountingDetails'
import { buildResourceDepartmentDetails } from '@/components/project-resources/cumulativeEstimateData'
import { dashboardStageDefinition } from '@/components/project-resources/resourceDashboardStages'
import { resolveBudgetScheduleDisplay } from '@/lib/budgetMilestoneScheduling'
import { usePlanStore } from '@/stores/plan'
import { useTechnicalPlanStore } from '@/stores/technicalPlan'
import type { DashboardTrendGrain } from '@/components/project-resources/resourceDashboardBusiness'

export default function ProjectResourceDashboard({ project, category }: {
  project: ProjectItem; category: HrProjectCategory
}) {
  const { message } = App.useApp(), store = useResourceStore(category)
  useProjectStore(state => state.currentLoginUser)
  useProjectStore(state => state.projects)
  usePermissionStore()
  const config = useHrConfigStore(state => state.data), rate = Number(config.feeRate?.[0]?.value ?? 5)
  const [primary, setPrimary] = useState('all'), [department, setDepartment] = useState('all')
  const [dates, setDates] = useState<[string, string]>()
  const [mode, setMode] = useState<'labor' | 'cost'>('labor'), [grain, setGrain] = useState<DashboardTrendGrain>('month')
  useEffect(() => { resourceStore(category).getState().refreshFormalProjects() }, [category, project.id])
  const [today, setToday] = useState(() => dayjs().format('YYYY-MM-DD'))
  useEffect(() => { const timer = setInterval(() => setToday(dayjs().format('YYYY-MM-DD')), 60_000); return () => clearInterval(timer) }, [])
  const planState = usePlanStore()
  useTechnicalPlanStore(state => state.plansByKey)
  const formal = resolveHrFormalSource(category, null, project.id)
  const display = category === 'capability' ? undefined : resolveBudgetScheduleDisplay(planState, category)
  const formalDates: Record<string, string | null | undefined> = category === 'capability' ? { projectStartTime: formal.projectStartTime, projectEndTime: formal.projectEndTime } : formal.milestones
  const projectStart = formalDates[display?.firstAnchorKey ?? 'projectStartTime'] ?? undefined
  const available = DASHBOARD_BUDGETS.map(item => dashboardSources(store.projects, project.id, item.key))
  const sources = available.map(items => selectDashboardSource(items))
  const dataset = resourceAccountingDataset(project.id)
  const pairs = sources.flatMap(source => source ? [
    ...store.monthlyInvestments.filter(row => row.versionId === source.version.id && !row.isArchived),
    ...('hrModelVersion' in source.version ? resolveMachineDepartmentInvestments(source.version) : source.version.departmentInvestments),
  ] : []).map(row => ({ primaryDepartment: row.primaryDepartment, secondaryDepartment: row.secondaryDepartment }))
  const actualPairs = [...(dataset?.worklogs ?? []), ...(dataset?.expenses ?? [])]
  const fallbackParents = dashboardDepartmentParents((config.hrModel ?? []).map(row => ({ primaryDepartment: String(row.primaryDepartment ?? ''), secondaryDepartment: String(row.secondaryDepartment ?? '') })))
  const departmentParents = { ...fallbackParents, ...dashboardDepartmentParents([...pairs, ...actualPairs]) }
  const expensePairs = sources.flatMap(source => source?.version.nonLaborInvestment?.items.map(item => ({ primaryDepartment: departmentParents[item.secondaryDepartment] ?? UNASSIGNED_PRIMARY, secondaryDepartment: item.secondaryDepartment })) ?? [])
  const allPairs = [...pairs, ...actualPairs, ...expensePairs]
  const primaries = [...new Set(allPairs.map(row => row.primaryDepartment || UNASSIGNED_PRIMARY))].sort()
  const effectivePrimary = primaries.includes(primary) ? primary : 'all'
  const departments = [...new Set(allPairs.filter(row => effectivePrimary === 'all' || (row.primaryDepartment || UNASSIGNED_PRIMARY) === effectivePrimary).map(row => row.secondaryDepartment))].filter(Boolean).sort()
  const effectiveDepartment = departments.includes(department) ? department : 'all'
  const filter: DashboardFilter = { primary: effectivePrimary, department: effectiveDepartment, startDate: dates?.[0], endDate: dates?.[1], departmentParents }
  const analyses = sources.map(source => source && buildDashboardAnalysis(category, source, store.monthlyInvestments, rate, filter))
  const accounting = buildAccountingAnalysis(dataset, rate, filter)
  const stagesFor = (items: typeof sources) => [...items.map(source => {
    if (!source) return undefined
    const version = source.version
    const model = 'scheduleModelSnapshot' in version && version.scheduleModelSnapshot?.category === category ? version.scheduleModelSnapshot : display
    return dashboardStageDefinition(category, 'milestones' in version ? { ...version.milestones } : { projectStartTime: version.projectStartTime, projectEndTime: version.projectEndTime }, model)
  }), dashboardStageDefinition(category, formalDates, display)]
  const stages = stagesFor(sources)
  const trend = dashboardBusinessTrend(analyses, accounting, mode, grain, stages)
  const details = buildResourceDepartmentDetails(category, sources, store.monthlyInvestments, rate, dataset, filter, today, projectStart)
  const period = dates ? `${dates[0]}～${dates[1]}` : '全周期'
  const canExport = canResourceAction({ pmsProjectId: project.id }, 'export', project.id)
  const exportAnalysis = () => {
    if (!canResourceAction({ pmsProjectId: project.id }, 'export', project.id)) { message.warning('当前项目资源导出权限已变化'); return }
    const current = resourceStore(category).getState()
    const currentSources = DASHBOARD_BUDGETS.map(item => selectDashboardSource(dashboardSources(current.projects, project.id, item.key)))
    if (currentSources.some((source, index) => source?.version.id !== sources[index]?.version.id || source && !canResourceAction(source.owner, 'export', project.id))) {
      message.warning('正式版本或导出权限已变化，请刷新看板后重试'); return
    }
    const currentRate = Number(useHrConfigStore.getState().data.feeRate?.[0]?.value ?? 5)
    const currentAnalyses = currentSources.map(source => source && buildDashboardAnalysis(category, source, current.monthlyInvestments, currentRate, filter))
    exportResourceBusinessDashboard(project.name, currentAnalyses, buildAccountingAnalysis(dataset, currentRate, filter), filter, mode, grain, stagesFor(currentSources), buildResourceDepartmentDetails(category, currentSources, current.monthlyInvestments, currentRate, dataset, filter, dayjs().format('YYYY-MM-DD'), projectStart))
  }
  return <section className="pms-resource-dashboard" aria-label="项目资源看板">
    <div className="pms-dashboard-toolbar">
      <div><h2>项目资源看板</h2><Tooltip title={`费用 = 人月 × 费率 ${rate} 万元/人月 + 非人力费用（元）÷ 10000。四类数据独立比较。`}><span className="pms-dashboard-definition"><InfoCircleOutlined /> 人月与费用分析</span></Tooltip></div>
      <div><Button icon={<ReloadOutlined />} onClick={() => { setPrimary('all'); setDepartment('all'); setDates(undefined) }}>重置筛选</Button>{canExport && <Button icon={<DownloadOutlined />} disabled={!sources.some(Boolean) && !accounting} onClick={exportAnalysis}>导出分析</Button>}</div>
    </div>
    <div className="pms-dashboard-filters">
      <label><span>一级部门</span><Select aria-label="看板一级部门" showSearch optionFilterProp="label" value={effectivePrimary} onChange={value => { setPrimary(value); setDepartment('all') }} options={[{ value: 'all', label: '全部一级部门' }, ...primaries.map(value => ({ value, label: value }))]} /></label>
      <label><span>二级部门</span><Select aria-label="看板二级部门" showSearch optionFilterProp="label" value={effectiveDepartment} onChange={setDepartment} options={[{ value: 'all', label: '全部二级部门' }, ...departments.map(value => ({ value, label: value }))]} /></label>
      <label><span>日期</span><DatePicker.RangePicker aria-label="看板日期范围" value={dates ? [dayjs(dates[0]), dayjs(dates[1])] : null} onChange={value => setDates(value?.[0] && value[1] ? [value[0].format('YYYY-MM-DD'), value[1].format('YYYY-MM-DD')] : undefined)} /></label>
      <span className="pms-dashboard-filter-note">{period} · 正式版本</span>
    </div>
    <ResourceDashboardMetrics sources={sources} analyses={analyses} accounting={accounting} details={details} />
    <section className="pms-resource-panel pms-dashboard-trend-panel">
      <div className="pms-dashboard-panel-head"><h3>四类投入趋势</h3><div><Segmented aria-label="趋势指标" value={mode} options={[{ value: 'labor', label: '投入人月' }, { value: 'cost', label: '费用（万元）' }]} onChange={value => setMode(value as 'labor' | 'cost')} /><Segmented aria-label="趋势周期" value={grain} options={[{ value: 'month', label: '月度' }, { value: 'week', label: '周度' }, { value: 'stage', label: '阶段' }]} onChange={value => setGrain(value as DashboardTrendGrain)} /></div></div>
      <ResourceBusinessTrend trend={trend} />
      <p className="pms-dashboard-note">预算按月度计划展示；周度、阶段及部分月份按当月周一至周五均摊折算，非实际发生时间。阶段按各来源里程碑归类，缺失区间列为未归属阶段。核算按正式项目里程碑及记录日期汇总，{accounting ? `模拟明细覆盖 ${accounting.dataset.startDate}～${accounting.dataset.endDate}` : '暂无核算来源'}；超出来源期间显示空缺。</p>
    </section>
    <ResourceAccountingDetails analysis={accounting} details={details} />
  </section>
}
