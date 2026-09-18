import { formatPersonMonth } from '@/constants/hrMachine'

export function formatMachineDetailPhase(row: Record<string, unknown>, phaseKey: string): string {
  const value = row[phaseKey]
  return typeof value === 'number' ? formatPersonMonth(value) : '—'
}
