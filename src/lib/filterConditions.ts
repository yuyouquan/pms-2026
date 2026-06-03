export const FILTER_OPERATORS = [
  { value: 'equals', label: '等于' },
  { value: 'notEquals', label: '不等于' },
  { value: 'contains', label: '包含' },
  { value: 'notContains', label: '不包含' },
  { value: 'isEmpty', label: '为空' },
  { value: 'isNotEmpty', label: '不为空' },
] as const

export type FilterOperator = typeof FILTER_OPERATORS[number]['value']

export interface FilterCondition {
  id: string
  field: string
  operator: FilterOperator
  value: string
}

export const createFilterCondition = (): FilterCondition => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  field: '',
  operator: 'equals',
  value: '',
})

export const isValuelessFilterOperator = (operator: FilterOperator) =>
  operator === 'isEmpty' || operator === 'isNotEmpty'

const isEmptyFilterValue = (value: unknown) => value == null || String(value).trim() === ''

export const isFilterConditionActive = (condition: FilterCondition) =>
  Boolean(condition.field && (isValuelessFilterOperator(condition.operator) || condition.value.trim()))

export function normalizeFilterConditions<T extends FilterCondition>(conditions: T[]): T[] {
  const selectedFields = new Set<string>()
  const normalized: T[] = []

  conditions.forEach((condition) => {
    if (!isFilterConditionActive(condition) || selectedFields.has(condition.field)) return

    selectedFields.add(condition.field)
    normalized.push({
      ...condition,
      value: isValuelessFilterOperator(condition.operator) ? '' : condition.value.trim(),
    })
  })

  return normalized
}

export function applyFilterConditions<T extends Record<string, any>>(rows: T[], conditions: FilterCondition[]): T[] {
  const activeConditions = normalizeFilterConditions(conditions)
  if (activeConditions.length === 0) return rows

  return rows.filter(row => activeConditions.every((condition) => {
    const actualRaw = row[condition.field]

    if (condition.operator === 'isEmpty') return isEmptyFilterValue(actualRaw)
    if (condition.operator === 'isNotEmpty') return !isEmptyFilterValue(actualRaw)

    const actual = String(actualRaw ?? '').toLowerCase()
    const expected = condition.value.trim().toLowerCase()

    if (condition.operator === 'equals') return actual === expected
    if (condition.operator === 'notEquals') return actual !== expected
    if (condition.operator === 'notContains') return !actual.includes(expected)
    return actual.includes(expected)
  }))
}

export function getFieldOptionsWithDuplicateDisabled<T extends { value: string; disabled?: boolean }>(
  options: T[],
  conditions: FilterCondition[],
  currentConditionId: string,
): T[] {
  const selectedFields = new Set(
    conditions
      .filter(condition => condition.id !== currentConditionId && condition.field)
      .map(condition => condition.field),
  )

  return options.map(option => ({
    ...option,
    disabled: Boolean(option.disabled || selectedFields.has(option.value)),
  }))
}
