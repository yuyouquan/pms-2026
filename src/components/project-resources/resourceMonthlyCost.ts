import { nonLaborMonths } from '@/lib/nonLaborInvestment'
import type { NonLaborInvestment } from '@/types/nonLaborInvestment'
import type { buildResourceMonthlyView, ResourceMonthlyRow } from '@/components/project-resources/resourceVersionViewData'

export interface ResourceMonthlyCostRow extends ResourceMonthlyRow { isNonLabor?: boolean }
const finite = (value: number) => Number.isFinite(value) ? value : 0
// One cent is 0.000001 万元. Keep that precision until formatting the final result.
const roundedCost = (value: number) => Math.round(value * 1_000_000) / 1_000_000
export const sumResourceCost = (values: Record<string, number>, months = Object.keys(values)) =>
  roundedCost(months.reduce((sum, month) => sum + finite(values[month] ?? 0), 0))

/** Costs are a read-only projection; expense rows never alter labor allocations. */
export function buildResourceMonthlyCostView(labor: ReturnType<typeof buildResourceMonthlyView>, expense: NonLaborInvestment | undefined,
  rate: number, estimatedLabor: number) {
  const validRate = Number.isFinite(rate) && rate >= 0 ? rate : 0
  const expenseMonths = expense ? nonLaborMonths(expense) : []
  const rows: ResourceMonthlyCostRow[] = labor.rows.map(row => ({ ...row,
    estimatedTotal: roundedCost(row.estimatedTotal * validRate),
    monthlyData: Object.fromEntries(Object.entries(row.monthlyData).map(([month, value]) => [month, roundedCost(finite(value) * validRate)])),
  }))
  const expenses = Object.fromEntries(expenseMonths.map(month => [month,
    roundedCost((expense?.items ?? []).reduce((sum, item) => sum + finite(item.monthlyAmounts[month] ?? 0), 0) / 10000),
  ]))
  const nonLaborTotal = sumResourceCost(expenses)
  if (expense?.items.length && expenseMonths.length) rows.push({
    id: 'non-labor-cost-summary', versionId: '', primaryDepartment: '非人力投入', secondaryDepartment: '',
    estimatedTotal: nonLaborTotal, monthlyData: expenses, isNonLabor: true,
  })
  const months = [...new Set([...labor.months, ...expenseMonths])].sort()
  const totals = Object.fromEntries(months.map(month => [month,
    roundedCost(rows.reduce((sum, row) => sum + (row.monthlyData[month] ?? 0), 0)),
  ]))
  return { rows, months, totals, nonLaborTotal,
    allocatedTotal: roundedCost(rows.reduce((sum, row) => sum + sumResourceCost(row.monthlyData), 0)),
    estimatedTotal: roundedCost(estimatedLabor * validRate + nonLaborTotal),
  }
}
