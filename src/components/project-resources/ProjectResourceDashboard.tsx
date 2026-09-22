'use client'
import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { App, Button, DatePicker, Select, Segmented, Tooltip } from 'antd'
import { DownloadOutlined, InfoCircleOutlined, ReloadOutlined } from '@ant-design/icons'
import type { ProjectItem } from '@/types/app'
import type { HrProjectCategory } from '@/lib/hrFormalProjectSource'
import type { ResourceBudgetType } from '@/components/project-resources/resourceVersionViewData'
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
import ResourceDashboardDetails from '@/components/project-resources/ResourceDashboardDetails'

export default function ProjectResourceDashboard({ project, category, onOpenVersion }: {
  project: ProjectItem; category: HrProjectCategory; onOpenVersion: (type: ResourceBudgetType, versionId?: string) => void
}) {
  const { message } = App.useApp(), store = useResourceStore(category)
  useProjectStore(state => state.currentLoginUser)
  useProjectStore(state => state.projects)
  usePermissionStore()
  const config = useHrConfigStore(state => state.data), rate = Number(config.feeRate?.[0]?.value ?? 5)
  const [selected, setSelected] = useState<Partial<Record<ResourceBudgetType, string>>>({})
  const [primary, setPrimary] = useState('all'), [department, setDepartment] = useState('all')
  const [dates, setDates] = useState<[string, string]>()
  const [focusType, setFocusType] = useState<ResourceBudgetType>('projectBudget')
  const [mode, setMode] = useState<'labor' | 'cost'>('labor'), [grain, setGrain] = useState<'month' | 'week'>('month')
  useEffect(() => { resourceStore(category).getState().refreshFormalProjects() }, [category, project.id])
  const available = DASHBOARD_BUDGETS.map(item => dashboardSources(store.projects, project.id, item.key))
  const sources = available.map((items, index) => selectDashboardSource(items, selected[DASHBOARD_BUDGETS[index].key]))
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
  const trend = dashboardBusinessTrend(analyses, accounting, mode, grain)
  const focus = analyses.find(analysis => analysis?.source.version.budgetType === focusType) ?? [...analyses].reverse().find(Boolean)
  const focusLabel = DASHBOARD_BUDGETS.find(item => item.key === focus?.source.version.budgetType)?.label ?? ''
  const period = dates ? `${dates[0]}～${dates[1]}` : '全周期'
  const canExport = canResourceAction({ pmsProjectId: project.id }, 'export', project.id)
  const exportAnalysis = () => {
    if (!canResourceAction({ pmsProjectId: project.id }, 'export', project.id)) { message.warning('当前项目资源导出权限已变化'); return }
    const current = resourceStore(category).getState()
    const currentSources = sources.map(source => source && dashboardSources(current.projects, project.id, source.version.budgetType).find(item => item.version.id === source.version.id))
    if (sources.some((source, index) => source && (!currentSources[index] || !canResourceAction(currentSources[index]?.owner, 'export', project.id)))) {
      message.warning('分析来源版本或查看权限已变化，请重新选择'); return
    }
    const currentRate = Number(useHrConfigStore.getState().data.feeRate?.[0]?.value ?? 5)
    const currentAnalyses = currentSources.map(source => source && buildDashboardAnalysis(category, source, current.monthlyInvestments, currentRate, filter))
    const currentFocus = currentAnalyses.find(analysis => analysis?.source.version.budgetType === focusType) ?? [...currentAnalyses].reverse().find(Boolean)
    exportResourceBusinessDashboard(project.name, currentAnalyses, buildAccountingAnalysis(dataset, currentRate, filter), currentFocus, filter, mode, grain)
  }
  return <section className="pms-resource-dashboard" aria-label="项目资源看板">
    <div className="pms-dashboard-toolbar">
      <div><h2>项目资源看板</h2><Tooltip title={`费用 = 人月 × 费率 ${rate} 万元/人月 + 非人力费用（元）÷ 10000。四类数据独立比较。`}><span className="pms-dashboard-definition"><InfoCircleOutlined /> 人月与费用分析</span></Tooltip></div>
      <div><Button icon={<ReloadOutlined />} onClick={() => { setSelected({}); setPrimary('all'); setDepartment('all'); setDates(undefined) }}>恢复正式版本</Button>{canExport && <Button icon={<DownloadOutlined />} disabled={!sources.some(Boolean) && !accounting} onClick={exportAnalysis}>导出分析</Button>}</div>
    </div>
    <div className="pms-dashboard-filters">
      <label><span>一级部门</span><Select aria-label="看板一级部门" showSearch optionFilterProp="label" value={effectivePrimary} onChange={value => { setPrimary(value); setDepartment('all') }} options={[{ value: 'all', label: '全部一级部门' }, ...primaries.map(value => ({ value, label: value }))]} /></label>
      <label><span>二级部门</span><Select aria-label="看板二级部门" showSearch optionFilterProp="label" value={effectiveDepartment} onChange={setDepartment} options={[{ value: 'all', label: '全部二级部门' }, ...departments.map(value => ({ value, label: value }))]} /></label>
      <label><span>日期</span><DatePicker.RangePicker aria-label="看板日期范围" value={dates ? [dayjs(dates[0]), dayjs(dates[1])] : null} onChange={value => setDates(value?.[0] && value[1] ? [value[0].format('YYYY-MM-DD'), value[1].format('YYYY-MM-DD')] : undefined)} /></label>
      <span className="pms-dashboard-filter-note">{period} · 默认正式版本，可切换分析</span>
    </div>
    <ResourceDashboardMetrics available={available} sources={sources} analyses={analyses} accounting={accounting} selected={selected} onSelect={(type, id) => setSelected(previous => ({ ...previous, [type]: id }))} onOpenVersion={onOpenVersion} />
    <section className="pms-resource-panel pms-dashboard-trend-panel">
      <div className="pms-dashboard-panel-head"><h3>四类投入趋势</h3><div><Segmented aria-label="趋势指标" value={mode} options={[{ value: 'labor', label: '投入人月' }, { value: 'cost', label: '费用（万元）' }]} onChange={value => setMode(value as 'labor' | 'cost')} /><Segmented aria-label="趋势周期" value={grain} options={[{ value: 'month', label: '月度' }, { value: 'week', label: '周度' }]} onChange={value => setGrain(value as 'month' | 'week')} /></div></div>
      <ResourceBusinessTrend trend={trend} />
      <p className="pms-dashboard-note">预算按月度计划展示；周度及部分月份按当月周一至周五均摊折算，非实际发生时间。核算按记录日期汇总，{accounting ? `模拟明细覆盖 ${accounting.dataset.startDate}～${accounting.dataset.endDate}` : '暂无核算来源'}；超出来源期间显示空缺。</p>
    </section>
    <ResourceAccountingDetails analysis={accounting} />
    {focus && <details className="pms-dashboard-more"><summary>更多分析 · 部门 / 阶段 / 费用构成 / 数据检查</summary>
      <div className="pms-dashboard-panel-head"><h3>{focusLabel} · {focus.source.version.versionNumber}</h3><Select aria-label="详细分析预算分类" value={focus.source.version.budgetType} onChange={setFocusType} options={DASHBOARD_BUDGETS.map((item, index) => ({ value: item.key, label: item.label, disabled: !analyses[index] }))} /></div>
      <ResourceDashboardDetails focus={focus} focusLabel={focusLabel} period={period} onOpenVersion={onOpenVersion} />
    </details>}
  </section>
}
