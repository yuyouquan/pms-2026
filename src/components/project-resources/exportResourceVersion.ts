import { exportMultiSheet, exportTimestamp } from '@/utils/exportExcel'
import { BUDGET_TYPE_LABELS, MILESTONE_FIELDS } from '@/constants/hrMachine'
import { TOS_MILESTONE_FIELDS, TOS_PHASE_INVESTMENT_FIELDS } from '@/constants/hrTos'
import { TECH_MILESTONE_FIELDS, TECH_PHASE_INVESTMENT_FIELDS } from '@/constants/hrTechnical'
import { resolveMachineDepartmentInvestments, resolveMachinePhaseFields } from '@/lib/resourceAllocation'
import { formatHrBatch } from '@/lib/hrVersionRules'
import type { ResourceVersion } from '@/components/project-resources/resourceVersionAdapter'
import { buildResourceMonthlyView, type ResourceMonthlyRow } from '@/components/project-resources/resourceVersionViewData'
import { nonLaborMonths } from '@/lib/nonLaborInvestment'
import { toNonLaborDisplayAmount, type NonLaborAmountUnit } from '@/lib/nonLaborAmountUnit'

export function buildResourceVersionExportData(projectName: string, version: ResourceVersion, rows: ResourceMonthlyRow[], nonLaborUnit: NonLaborAmountUnit = '元') {
  const view = buildResourceMonthlyView(rows, version.id)
  const labels = Object.fromEntries([...MILESTONE_FIELDS, ...TOS_MILESTONE_FIELDS, ...TECH_MILESTONE_FIELDS].map(field => [field.key, field.label]))
  const dates = 'milestones' in version ? version.milestones : { projectStartTime: version.projectStartTime, projectEndTime: version.projectEndTime }
  const milestones = Object.entries(dates).map(([key, value]) => ({ field: labels[key] ?? ({projectStartTime:'项目开始时间',projectEndTime:'项目结束时间'} as Record<string,string>)[key] ?? key, value }))
  const phases = 'modelSnapshot' in version ? resolveMachinePhaseFields(version) : [...TOS_PHASE_INVESTMENT_FIELDS, ...TECH_PHASE_INVESTMENT_FIELDS].filter((field,index,all)=>all.findIndex(item=>item.key===field.key)===index)
  const departments = 'hrModelVersion' in version ? resolveMachineDepartmentInvestments(version) : version.departmentInvestments
  const phaseColumns = phases.filter(field=> departments.some(row=>field.key in row)).map(field=>({key:field.key,title:field.label}))
  const moneyMonths = nonLaborMonths(version.nonLaborInvestment ?? { startMonth: null, endMonth: null, items: [] })
  const metadata = [
    ['项目', projectName], ['预算类型', BUDGET_TYPE_LABELS[version.budgetType]], ['版本', version.versionNumber],
    ['正式版本',version.isActive?'是':'否'], ['锁定状态',version.lockState==='locked'?'已锁定':'未锁定'], ['批次',formatHrBatch(version.batch)],
    ['创建人',version.createdBy], ['创建时间',version.createdAt], ['复制来源',version.copiedFromVersionNumber ?? '-'], ['预估投入（人月）',version.estimatedInvestment],
    ...('hrModelVersion' in version ? [['项目等级',version.projectLevel],['等级系数',version.levelCoefficient],['人力模型版本',version.hrModelVersion]]:[]),
  ].map(([field,value])=>({field,value}))
  const nonLaborRows = version.nonLaborInvestment?.items.map(item => ({
    ...item,
    estimatedInvestment: toNonLaborDisplayAmount(Math.round(moneyMonths.reduce((sum, month) => sum + (item.monthlyAmounts[month] ?? 0), 0) * 100) / 100, nonLaborUnit),
    ...Object.fromEntries(Object.entries(item.monthlyAmounts).map(([month, amount]) => [month, toNonLaborDisplayAmount(amount, nonLaborUnit)])),
  })) ?? []
  return { view, milestones, departments, phaseColumns, moneyMonths, metadata, nonLaborRows }
}

export function exportResourceVersion(projectName: string, version: ResourceVersion, rows: ResourceMonthlyRow[], nonLaborUnit: NonLaborAmountUnit = '元') {
  const { view, milestones, departments, phaseColumns, moneyMonths, metadata, nonLaborRows } = buildResourceVersionExportData(projectName, version, rows, nonLaborUnit)
  exportMultiSheet([
    {sheetName:'版本信息',rows:metadata,columns:[{key:'field',title:'字段'},{key:'value',title:'内容'}]},
    {sheetName:'里程碑',rows:milestones,columns:[{key:'field',title:'节点'},{key:'value',title:'时间'}]},
    {sheetName:'部门预估投入',rows:departments,columns:[{key:'primaryDepartment',title:'一级部门'},{key:'secondaryDepartment',title:'二级部门'},{key:'estimatedInvestment',title:'合计（人月）'},...phaseColumns]},
    {sheetName:'月度人力投入',rows:view.rows.map(row=>({...row,...row.monthlyData})),columns:[{key:'primaryDepartment',title:'一级部门'},{key:'secondaryDepartment',title:'二级部门'},...view.months.map(month=>({key:month,title:month+'（人月）'}))]},
    {sheetName:'非人力投入',rows:nonLaborRows,columns:[{key:'secondaryDepartment',title:'二级部门'},{key:'tertiaryDepartment',title:'三级部门'},{key:'secondarySubject',title:'二级科目'},{key:'tertiarySubject',title:'三级科目'},{key:'estimatedInvestment',title:`合计（${nonLaborUnit}）`},...moneyMonths.map(month=>({key:month,title:`${month}（${nonLaborUnit}）`}))]},
  ],`${projectName}-${BUDGET_TYPE_LABELS[version.budgetType]}-${version.versionNumber}-${exportTimestamp()}.xlsx`)
}
