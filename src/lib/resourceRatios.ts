import { TOS_PHASE_INVESTMENT_FIELDS } from '@/constants/hrTos'
import { TECH_PHASE_INVESTMENT_FIELDS } from '@/constants/hrTechnical'
import type { HrProjectCategory } from '@/lib/hrFormalProjectSource'

export function getResourceRatioFields(category: HrProjectCategory): { key: string; label: string }[] {
  return category === 'tos' ? TOS_PHASE_INVESTMENT_FIELDS : category === 'technical' ? TECH_PHASE_INVESTMENT_FIELDS : category === 'capability' ? [{ key: 'projectPeriod', label: '项目周期' }] : []
}
type RatioVersion = { departmentPhaseRatios?: Record<string, Record<string, number>> }
type RatioRow = { id: string; estimatedInvestment: number }
export function getResourcePhaseRatios(category: HrProjectCategory, version: RatioVersion, row: RatioRow): Record<string, number> {
  const fields = getResourceRatioFields(category)
  const stored = version.departmentPhaseRatios?.[row.id]
  if (stored) return Object.fromEntries(fields.map(field => [field.key, stored[field.key] ?? 0]))
  if (category === 'capability') return { projectPeriod: 100 }
  const amounts = row as unknown as Record<string, number>
  const ratios = fields.map(field => row.estimatedInvestment > 0 ? Math.round((Number(amounts[field.key]) || 0) / row.estimatedInvestment * 10000) / 100 : 0)
  const phaseTotal = fields.reduce((sum, field) => sum + (Number(amounts[field.key]) || 0), 0)
  // Correct only rounding residue when the source row already represents a complete allocation.
  if (row.estimatedInvestment > 0 && Math.abs(phaseTotal - row.estimatedInvestment) < 0.000001 && ratios.length) {
    const index = ratios.indexOf(Math.max(...ratios))
    ratios[index] = Math.round((ratios[index] + 100 - ratios.reduce((sum, value) => sum + value, 0)) * 100) / 100
  }
  return Object.fromEntries(fields.map((field, index) => [field.key, ratios[index]]))
}
export function validateResourceRatio(value: number) {
  if (!Number.isFinite(value) || value < 0 || value > 100 || Math.abs(value * 100 - Math.round(value * 100)) > 0.000001) throw new Error('阶段比例必须为 0 到 100 的数字，最多保留两位小数')
}
export function allocateResourceRatios(total: number, ratios: Record<string, number>): Record<string, number> {
  if (!Number.isFinite(total) || total < 0 || Math.abs(total * 10 - Math.round(total * 10)) > 0.000001) throw new Error('人力投入必须为非负数，最多保留一位小数')
  const entries = Object.entries(ratios)
  entries.forEach(([,value]) => validateResourceRatio(value))
  const sum = entries.reduce((value, [,ratio]) => value + ratio, 0)
  const raw = entries.map(([,ratio]) => total * 10 * ratio / 100)
  if (Math.abs(sum - 100) >= 0.000001) return Object.fromEntries(entries.map(([key], index) => [key, Math.round(raw[index]) / 10]))
  const units = raw.map(value => Math.floor(value + 1e-9))
  const order = raw.map((value,index) => ({index, residue:value-units[index]})).sort((a,b) => b.residue-a.residue || a.index-b.index)
  const remainder = Math.round(total*10) - units.reduce((value,unit) => value+unit,0)
  for(let index=0;index<remainder;index++) units[order[index].index]++
  return Object.fromEntries(entries.map(([key],index) => [key,units[index]/10]))
}
export function getResourceFormalValidationErrors(category: HrProjectCategory, version: RatioVersion & { id: string; departmentInvestments?: RatioRow[]; estimatedInvestment: number; milestones?: object; projectStartTime?: string; projectEndTime?: string }, monthly: readonly { versionId: string; isArchived?: boolean; estimatedTotal: number; monthlyData: Record<string,number>; primaryDepartment: string; secondaryDepartment: string }[]): string[] {
  const errors: string[] = []
  for (const row of version.departmentInvestments ?? []) {
    const values = Object.values(getResourcePhaseRatios(category, version, row))
    const sum = values.reduce((total,value)=>total+value,0)
    if (values.some(value => !Number.isFinite(value) || value < 0 || value > 100) || Math.abs(sum-100)>0.000001) errors.push('部门阶段比例合计必须为 100%')
  }
  const rows = monthly.filter(row=>row.versionId===version.id && !row.isArchived)
  if (!rows.length && version.estimatedInvestment > 0) errors.push('请完善日期并分配月度投入')
  for(const row of rows) if(Math.abs(Object.values(row.monthlyData).reduce((sum,value)=>sum+value,0)-row.estimatedTotal)>0.000001) errors.push(`${row.primaryDepartment}/${row.secondaryDepartment}：月度已分配合计须等于部门预估投入`)
  return [...new Set(errors)]
}

/** Legacy detail modals still submit phase amounts; only changed rows rederive percentages. */
export function resourceRatiosAfterDepartmentWrite(category: HrProjectCategory, version: RatioVersion & { departmentInvestments: RatioRow[] }, rows: RatioRow[]) {
  if (JSON.stringify(version.departmentInvestments) === JSON.stringify(rows)) return version.departmentPhaseRatios
  return Object.fromEntries(rows.map(row => {
    const original = version.departmentInvestments.find(item => item.id === row.id)
    const amountKeys = ['estimatedInvestment', ...getResourceRatioFields(category).map(field => field.key)]
    const unchangedAmounts = original && amountKeys.every(key => (original as unknown as Record<string, unknown>)[key] === (row as unknown as Record<string, unknown>)[key])
    return [row.id, getResourcePhaseRatios(category, unchangedAmounts ? version : {}, row)]
  }))
}
