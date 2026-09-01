export const TEXT_FILTER_OPERATORS = [
  { value: 'equals', label: '等于' },
  { value: 'notEquals', label: '不等于' },
  { value: 'contains', label: '包含' },
  { value: 'notContains', label: '不包含' },
  { value: 'isEmpty', label: '为空' },
  { value: 'isNotEmpty', label: '不为空' },
] as const

export const ENUM_FILTER_OPERATORS = TEXT_FILTER_OPERATORS

export const MULTI_ENUM_FILTER_OPERATORS = [
  { value: 'contains', label: '包含' },
  { value: 'notContains', label: '不包含' },
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
  options?: { label: string; value: string; disabled?: boolean }[]
  multiple?: boolean
}

export interface FilterCondition {
  id: string
  field: string
  operator: FilterOperator
  value: string
}

export interface LinkedFilterCondition {
  id: string
  field: string
  operator: FilterOperator | 'equalsAny'
  value: string | string[]
}

export type AnyFilterCondition = FilterCondition | LinkedFilterCondition

export const createFilterCondition = (): FilterCondition => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  field: '',
  operator: 'contains',
  value: '',
})

export const isValuelessFilterOperator = (operator: FilterOperator | 'equalsAny') =>
  operator === 'isEmpty' || operator === 'isNotEmpty'

export const getDefaultFilterOperator = (kind: FilterFieldKind): FilterOperator => (
  kind === 'date' ? 'equals' : 'contains'
)

export const isMultiValueFilterOperator = (
  operator: FilterOperator | 'equalsAny',
  kind: FilterFieldKind,
) => kind === 'enum' && (
  operator === 'contains' || operator === 'notContains' || operator === 'equalsAny'
)

export const normalizeFilterValueForOperator = (
  value: string | string[],
  operator: FilterOperator | 'equalsAny',
  kind: FilterFieldKind,
): string | string[] => {
  if (isValuelessFilterOperator(operator)) return ''
  if (isMultiValueFilterOperator(operator, kind)) {
    return Array.isArray(value) ? value : (value ? [value] : [])
  }
  return Array.isArray(value) ? value[0] ?? '' : value
}

export function getFilterOperatorsForKind(kind: FilterFieldKind) {
  if (kind === 'enum') return ENUM_FILTER_OPERATORS
  if (kind === 'date') return DATE_FILTER_OPERATORS
  return TEXT_FILTER_OPERATORS
}

function isOperatorAllowedForDefinition(
  operator: FilterOperator | 'equalsAny',
  definition: FilterFieldDefinition,
): boolean {
  if (operator === 'equalsAny') return definition.kind === 'enum'
  return getFilterOperatorsForKind(definition.kind).some(option => option.value === operator)
}

const EMPTY_FILTER_SENTINELS = new Set(['', '-', '—'])

const isEmptyFilterValue = (value: unknown) => (
  value == null || EMPTY_FILTER_SENTINELS.has(String(value).trim())
)

export const normalizeFilterValue = (value: string | string[]) => {
  if (!Array.isArray(value)) return value.trim()
  return [...new Set(value.map(item => item.trim()).filter(Boolean))]
}

export const isFilterConditionActive = (condition: AnyFilterCondition) => {
  const value = normalizeFilterValue(condition.value)
  return Boolean(
    condition.field
    && (isValuelessFilterOperator(condition.operator)
      || (Array.isArray(value) ? value.length : value)),
  )
}

export function normalizeFilterConditions<T extends AnyFilterCondition>(
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
    const operator = condition.operator === 'equalsAny' ? 'contains' : condition.operator
    if (definition && !isOperatorAllowedForDefinition(operator, definition)) return

    const normalizedValue = normalizeFilterValue(condition.value)
    const keepMultipleValues = definition
      ? isMultiValueFilterOperator(operator, definition.kind)
      : condition.operator === 'equalsAny'
    selectedFields.add(condition.field)
    normalized.push({
      ...condition,
      operator,
      value: isValuelessFilterOperator(operator)
        ? ''
        : keepMultipleValues
          ? normalizedValue
          : Array.isArray(normalizedValue)
            ? normalizedValue[0] ?? ''
            : normalizedValue,
    } as T)
  })

  return normalized
}

export function applyFilterConditions<T extends object>(
  rows: readonly T[],
  conditions: readonly AnyFilterCondition[],
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
    if (kind === 'date' && isEmptyFilterValue(actualRaw)) return false
    const actualText = String(actualRaw ?? '')
    const actual = (definitionsByKey ? actualText.trim() : actualText).toLowerCase()
    const definition = definitionsByKey?.get(condition.field)
    if (definition?.kind === 'enum') {
      const actualValues = (Array.isArray(actualRaw) ? actualRaw : [actualRaw])
        .map(value => String(value ?? '').trim().toLowerCase())
        .filter(Boolean)
      const expectedValues = (Array.isArray(condition.value) ? condition.value : [condition.value])
        .map(value => value.trim().toLowerCase())
        .filter(Boolean)
      if (condition.operator === 'contains') {
        return expectedValues.some(value => actualValues.includes(value))
      }
      if (condition.operator === 'notContains') {
        return expectedValues.every(value => !actualValues.includes(value))
      }
    }

    const expected = (Array.isArray(condition.value) ? condition.value[0] ?? '' : condition.value)
      .trim()
      .toLowerCase()

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
  conditions: readonly AnyFilterCondition[],
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
