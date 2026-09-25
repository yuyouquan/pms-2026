import type { NonLaborInvestment, NonLaborInvestmentItem } from '@/types/nonLaborInvestment'
import type { ConfigRecord } from '@/types/hrConfig'
import { nonLaborItemKey, nonLaborMonths, nonLaborDepartmentPairs, validateNonLaborInvestment } from '@/lib/nonLaborInvestment'
import { fromNonLaborDisplayAmount, nonLaborAmountPrecision, type NonLaborAmountUnit } from '@/lib/nonLaborAmountUnit'

type MonthRange = Pick<NonLaborInvestment, 'startMonth' | 'endMonth'>

export function nonLaborSpreadsheetColumns(range: MonthRange, unit: NonLaborAmountUnit = '元') {
  return [
    { key: 'primaryDepartment', title: '一级部门' },
    { key: 'secondaryDepartment', title: '二级部门' },
    { key: 'tertiaryDepartment', title: '三级部门' },
    { key: 'secondarySubject', title: '二级科目' },
    { key: 'tertiarySubject', title: '三级科目' },
    ...nonLaborMonths(range).map(month => ({ key: month, title: `${month.slice(0, 4)}年${month.slice(5)}月（${unit}）` })),
  ]
}

function parseAmount(value: unknown, unit: NonLaborAmountUnit): number {
  if (value === null || value === undefined || value === '' || value === '-') return 0
  if (typeof value !== 'number' && typeof value !== 'string') throw new Error('金额格式不正确')
  let text = String(value).trim()
  if (!text) return 0
  if (text.includes(',')) {
    if (!/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) throw new Error('金额格式不正确')
    text = text.replaceAll(',', '')
  }
  const amount = Number(text)
  if (!Number.isFinite(amount) || amount < 0) throw new Error('金额必须为非负数')
  const factor = 10 ** nonLaborAmountPrecision(unit)
  if (Math.abs(amount * factor - Math.round(amount * factor)) > 0.000001) throw new Error(unit === '万元' ? '金额（万元）最多保留六位小数' : '金额最多保留两位小数')
  return fromNonLaborDisplayAmount(amount, unit)
}

/** Parse completely before replacing a draft; one invalid row rejects the whole import. */
export function parseNonLaborInvestmentRows(rows: unknown[][], range: MonthRange, subjects: readonly ConfigRecord[], departments: readonly ConfigRecord[], previous?: NonLaborInvestment, unit: NonLaborAmountUnit = '元'): NonLaborInvestment {
  const months = nonLaborMonths(range)
  if (!months.length) throw new Error('请先填写里程碑时间以生成费用投入月份')
  const columns = nonLaborSpreadsheetColumns(range, unit)
  const header = (rows[0] ?? []).map(cell => String(cell ?? '').trim())
  while (header.at(-1) === '') header.pop()
  const legacy = header[0] === '二级部门'
  const expectedColumns = legacy ? columns.slice(1) : columns
  if (header.length !== expectedColumns.length || expectedColumns.some((column, index) => header[index] !== column.title)) {
    throw new Error('表头、金额单位或月份与当前模板不一致，请下载当前模板后重新导入')
  }
  const items: NonLaborInvestmentItem[] = []
  const keys = new Set<string>()
  for (const [index, row] of rows.slice(1).entries()) {
    if (!row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '')) continue
    try {
      if (row.slice(expectedColumns.length).some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '')) throw new Error('存在模板之外的列')
      const offset = legacy ? 0 : 1
      const [secondaryDepartment, tertiaryDepartment, secondarySubject, tertiarySubject] = row.slice(offset, offset + 4).map(cell => String(cell ?? '').trim())
      let primaryDepartment = legacy ? '' : String(row[0] ?? '').trim()
      if (!legacy && !primaryDepartment) throw new Error('请选择一级部门')
      if (legacy) {
        const parents = [...new Set(nonLaborDepartmentPairs(departments).filter(dept => dept.secondaryDepartment === secondaryDepartment && dept.tertiaryDepartment === tertiaryDepartment).map(dept => dept.primaryDepartment).filter(Boolean))]
        if (parents.length > 1) throw new Error('旧模板的部门归属不唯一，请下载含一级部门的新模板')
        primaryDepartment = parents[0] ?? ''
      }
      const subject = subjects.find(item => item.enabled !== false && item.secondarySubject === secondarySubject && item.tertiarySubject === tertiarySubject)
      const item: NonLaborInvestmentItem = {
        id: 'non-labor-import-' + crypto.randomUUID(),
        ...(primaryDepartment ? { primaryDepartment } : {}), secondaryDepartment, tertiaryDepartment, secondarySubject, tertiarySubject,
        subjectDescription: String(subject?.description ?? ''),
        subjectId: subject?.id ?? '',
        monthlyAmounts: Object.fromEntries(months.map((month, monthIndex) => [month, parseAmount(row[monthIndex + offset + 4], unit)])),
      }
      const validated = validateNonLaborInvestment({ ...range, items: [item] }, subjects, undefined, departments).items[0]
      const key = nonLaborItemKey(validated)
      if (keys.has(key)) throw new Error('一级部门、二级部门、三级部门、二级科目和三级科目组合重复')
      keys.add(key)
      const retained = previous?.items.find(row => nonLaborItemKey(row) === key) ?? previous?.items.find(row => !row.primaryDepartment && row.secondaryDepartment === validated.secondaryDepartment && row.tertiaryDepartment === validated.tertiaryDepartment && row.secondarySubject === validated.secondarySubject && row.tertiarySubject === validated.tertiarySubject)
      if (retained) {
        validated.id = retained.id
        validated.monthlyAmounts = { ...Object.fromEntries(Object.entries(retained.monthlyAmounts).filter(([month]) => !months.includes(month))), ...validated.monthlyAmounts }
      }
      items.push(validated)
    } catch (error) {
      throw new Error(`第 ${index + 2} 行：${error instanceof Error ? error.message : '数据格式不正确'}`)
    }
  }
  if (!items.length) throw new Error('未解析到有效数据，请填写模板后重新导入')
  return { ...range, items }
}
