import { calcMachineDepartmentInvestments } from '@/constants/hrConfig'
import { nonLaborMonths } from '@/lib/nonLaborInvestment'
import type { DepartmentInvestmentRow } from '@/types/resourceInvestment'
import type { NonLaborInvestment } from '@/types/nonLaborInvestment'
import type { ConfigRecord } from '@/types/hrConfig'
import { machinePhaseFields } from '@/lib/hrMachinePeriods'

export interface LaborPhaseRule {
  key: string
  startField: string
  endField: string
}

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function distributeRounded(total: number, weights: readonly number[], scale: number) {
  const units = Math.round(total * scale)
  const weightTotal = weights.reduce((sum, value) => sum + value, 0)
  const raw = weights.map(weight => units * weight / weightTotal)
  const result = raw.map(value => Math.floor(value))
  let remainder = units - result.reduce((sum, value) => sum + value, 0)
  const order = raw.map((value, index) => ({ index, fraction: value - result[index] }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
  for (let index = 0; index < remainder; index++) result[order[index].index] += 1
  return result.map(value => value / scale)
}

export function allocateLaborTotal(total: number, phases: readonly LaborPhaseRule[], dates: Record<string, unknown>): Record<string, number> {
  if (!Number.isFinite(total) || total < 0 || Math.abs(total * 10 - Math.round(total * 10)) > 0.000001) {
    throw new Error('人力投入必须为非负数，最多保留一位小数')
  }
  if (total === 0) return Object.fromEntries(phases.map(phase => [phase.key, 0]))
  const weights = phases.map(phase => {
    const start = dates[phase.startField], end = dates[phase.endField]
    if (!validDate(start) || !validDate(end)) throw new Error('请先完善各阶段的开始和结束日期，再分配预估投入合计')
    const duration = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000
    if (duration < 0) throw new Error('阶段结束日期不能早于开始日期，请先修正日期')
    return duration
  })
  if (weights.every(value => value === 0)) throw new Error('阶段总周期为 0，请先完善日期，再分配预估投入合计')
  const values = distributeRounded(total, weights, 10)
  return Object.fromEntries(phases.map((phase, index) => [phase.key, values[index]]))
}

export function allocateNonLaborItemTotal(value: NonLaborInvestment, itemId: string, total: number): NonLaborInvestment {
  if (!Number.isFinite(total) || total < 0 || Math.abs(total * 100 - Math.round(total * 100)) > 0.000001) {
    throw new Error('非人力投入必须为非负数，最多保留两位小数')
  }
  const months = nonLaborMonths(value)
  if (!months.length) throw new Error('请先完善里程碑日期以生成费用投入月份，再填写预估投入合计')
  const item = value.items.find(row => row.id === itemId)
  if (!item) throw new Error('非人力投入行不存在')
  const amounts = distributeRounded(total, months.map(() => 1), 100)
  return {
    ...value,
    items: value.items.map(row => row.id === itemId ? {
      ...row,
      monthlyAmounts: { ...row.monthlyAmounts, ...Object.fromEntries(months.map((month, index) => [month, amounts[index]])) },
    } : row),
  }
}

export interface MachineInvestmentSource {
  modelSnapshot?: ConfigRecord[]
  projectLevel: string
  hrModelVersion: string
  levelCoefficient: number
  machineDepartmentInvestments?: DepartmentInvestmentRow[]
}

export function resolveMachineDepartmentInvestments(version: MachineInvestmentSource): DepartmentInvestmentRow[] {
  if (version.machineDepartmentInvestments) return version.machineDepartmentInvestments.map(row => ({ ...row }))
  return calcMachineDepartmentInvestments(version.modelSnapshot ?? [], version.projectLevel, version.hrModelVersion, version.levelCoefficient)
    .map(row => ({ ...row.phases, id: row.id, primaryDepartment: row.primaryDepartment, secondaryDepartment: row.secondaryDepartment, estimatedInvestment: row.estimatedTotal }))
}

/** Once actual rows exist, their saved schema controls every phase consumer even if model metadata later changes. */
export function resolveMachinePhaseFields(version: MachineInvestmentSource) {
  return machinePhaseFields(resolveMachineDepartmentInvestments(version))
}

export function buildMachineInvestmentView(version: MachineInvestmentSource) {
  const rows = resolveMachineDepartmentInvestments(version)
  return {
    rows,
    phaseFields: machinePhaseFields(rows),
    total: Math.round(rows.reduce((sum, row) => sum + row.estimatedInvestment, 0) * 10) / 10,
    usesActualRows: version.machineDepartmentInvestments !== undefined,
  }
}
