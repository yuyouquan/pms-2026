import { formatNonLaborAmount } from '@/lib/nonLaborInvestment'

export type NonLaborAmountUnit = '元' | '万元'

export const nonLaborAmountPrecision = (unit: NonLaborAmountUnit = '元'): number => unit === '万元' ? 6 : 2

/** Domain amounts always stay in yuan, including cents. Only presentation uses wan yuan. */
export const toNonLaborDisplayAmount = (amount: number, unit: NonLaborAmountUnit = '元'): number =>
  unit === '万元' ? Number((amount / 10000).toFixed(6)) : amount

export const fromNonLaborDisplayAmount = (amount: number, unit: NonLaborAmountUnit = '元'): number =>
  unit === '万元' ? Number((amount * 10000).toFixed(2)) : amount

export const formatNonLaborDisplayAmount = (amount: number, unit: NonLaborAmountUnit = '元'): string =>
  unit === '万元'
    ? toNonLaborDisplayAmount(amount, unit).toLocaleString('zh-CN', { maximumFractionDigits: 6 })
    : formatNonLaborAmount(amount)
