import { allocateNonLaborItemTotal } from '@/lib/resourceInlineEditing'
import type { NonLaborInvestment } from '@/types/nonLaborInvestment'

export function applyNonLaborItemTotalChange({ value, itemId, amount, inline, onChange, onItemTotalChange, onError }: {
  value: NonLaborInvestment
  itemId: string
  amount: number | null
  inline: boolean
  onChange?: (value: NonLaborInvestment) => void
  onItemTotalChange?: (itemId: string, value: number) => void
  onError: (message: string) => void
}) {
  const total = amount ?? 0
  if (onItemTotalChange) {
    onItemTotalChange(itemId, total)
    return
  }
  let next: NonLaborInvestment
  try {
    next = allocateNonLaborItemTotal(value, itemId, total)
  } catch (error) {
    if (inline) throw error
    onError(error instanceof Error ? error.message : '无法分配费用投入，请检查投入时间范围')
    return
  }
  onChange?.(next)
}
