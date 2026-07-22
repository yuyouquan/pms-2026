export const TEXT_FILTER_OPERATORS = [
  { value: 'equals', label: '等于' },
  { value: 'notEquals', label: '不等于' },
  { value: 'contains', label: '包含' },
  { value: 'notContains', label: '不包含' },
  { value: 'isEmpty', label: '为空' },
  { value: 'isNotEmpty', label: '不为空' },
] as const

export const ENUM_FILTER_OPERATORS = [
  { value: 'equals', label: '等于' },
  { value: 'notEquals', label: '不等于' },
  { value: 'isEmpty', label: '为空' },
  { value: 'isNotEmpty', label: '不为空' },
] as const

export const DATE_FILTER_OPERATORS = [
  { value: 'equals', label: '等于' },
  { value: 'notEquals', label: '不等于' },
  { value: 'before', label: '早于' },
  { value: 'after', label: '晚于' },
] as const

// Kept as the text-field default for existing consumers such as the summary board.
export const FILTER_OPERATORS = TEXT_FILTER_OPERATORS

export type FilterOperator =
  | typeof TEXT_FILTER_OPERATORS[number]['value']
  | typeof DATE_FILTER_OPERATORS[number]['value']

export type FilterFieldKind = 'text' | 'enum' | 'date'

export interface FilterFieldDefinition {
  key: string
  label: string
  kind: FilterFieldKind
  options?: { label: string; value: string }[]
}

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

export function getFilterOperatorsForKind(kind: FilterFieldKind) {
  if (kind === 'enum') return ENUM_FILTER_OPERATORS
  if (kind === 'date') return DATE_FILTER_OPERATORS
  return TEXT_FILTER_OPERATORS
}

function isOperatorAllowedForKind(operator: FilterOperator, kind: FilterFieldKind): boolean {
  return getFilterOperatorsForKind(kind).some(option => option.value === operator)
}

const isEmptyFilterValue = (value: unknown) => value == null || String(value).trim() === ''

export const isFilterConditionActive = (condition: FilterCondition) =>
  Boolean(condition.field && (isValuelessFilterOperator(condition.operator) || condition.value.trim()))

export function normalizeFilterConditions<T extends FilterCondition>(
  conditions: readonly T[],
  fieldDefinitions?: readonly FilterFieldDefinition[],
): T[] {
  const selectedFields = new Set<string>()
  const normalized: T[] = []
  const definitionsByKey = fieldDefinitions
    ? new Map(fieldDefinitions.map(definition => [definition.key, definition]))
    : null

  conditions.forEach((condition) => {
    if (!isFilterConditionActive(condition) || selectedFields.has(condition.field)) return
    const definition = definitionsByKey?.get(condition.field)
    if (definitionsByKey && !definition) return
    if (definition && !isOperatorAllowedForKind(condition.operator, definition.kind)) return

    selectedFields.add(condition.field)
    normalized.push({
      ...condition,
      value: isValuelessFilterOperator(condition.operator) ? '' : condition.value.trim(),
    })
  })

  return normalized
}

export function applyFilterConditions<T extends object>(
  rows: readonly T[],
  conditions: readonly FilterCondition[],
  fieldDefinitions?: readonly FilterFieldDefinition[],
): T[] {
  const activeConditions = normalizeFilterConditions(conditions, fieldDefinitions)
  if (activeConditions.length === 0) return [...rows]

  const definitionsByKey = fieldDefinitions
    ? new Map(fieldDefinitions.map(definition => [definition.key, definition]))
    : null

  return rows.filter(row => activeConditions.every((condition) => {
    const actualRaw = (row as Record<string, unknown>)[condition.field]

    if (condition.operator === 'isEmpty') return isEmptyFilterValue(actualRaw)
    if (condition.operator === 'isNotEmpty') return !isEmptyFilterValue(actualRaw)

    const kind = definitionsByKey?.get(condition.field)?.kind ?? 'text'
    const actual = String(actualRaw ?? '').trim().toLowerCase()
    const expected = condition.value.trim().toLowerCase()

    if (condition.operator === 'equals') return actual === expected
    if (condition.operator === 'notEquals') return actual !== expected
    if (kind === 'date' && condition.operator === 'before') return Boolean(actual) && actual < expected
    if (kind === 'date' && condition.operator === 'after') return Boolean(actual) && actual > expected
    if (condition.operator === 'notContains') return !actual.includes(expected)
    return actual.includes(expected)
  }))
}

export function getFieldOptionsWithDuplicateDisabled<T extends { value: string; disabled?: boolean }>(
  options: T[],
  conditions: readonly FilterCondition[],
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
