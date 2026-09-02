'use client'

import { DatePicker, Input, Select } from 'antd'
import type { SizeType } from 'antd/es/config-provider/SizeContext'
import dayjs from 'dayjs'
import {
  isMultiValueFilterOperator,
  isValuelessFilterOperator,
  type AnyFilterCondition,
  type FilterFieldDefinition,
} from '@/lib/filterConditions'

interface FilterConditionValueProps {
  condition: AnyFilterCondition
  definition?: FilterFieldDefinition
  onChange: (value: string | string[]) => void
  size?: SizeType
}

export function FilterConditionValue({
  condition,
  definition,
  onChange,
  size,
}: FilterConditionValueProps) {
  if (isValuelessFilterOperator(condition.operator)) {
    return <span className="pms-filter-value-placeholder" aria-hidden />
  }
  if (!definition) {
    return <Input size={size} disabled placeholder="请先选择筛选字段" />
  }
  const ariaLabel = `${definition.label}筛选值`
  if (definition.kind === 'date') {
    const raw = Array.isArray(condition.value) ? condition.value[0] : condition.value
    const value = raw ? dayjs(raw) : null
    return (
      <DatePicker
        size={size}
        aria-label={ariaLabel}
        style={{ width: '100%' }}
        value={value?.isValid() ? value : null}
        onChange={date => onChange(date ? date.format('YYYY-MM-DD') : '')}
      />
    )
  }
  if (definition.kind === 'enum') {
    const multiple = isMultiValueFilterOperator(condition.operator, definition.kind)
    const rawValue = condition.value
    const value = multiple
      ? (Array.isArray(rawValue) ? rawValue : (rawValue ? [rawValue] : []))
      : (Array.isArray(rawValue) ? rawValue[0] : rawValue) || undefined
    return (
      <Select
        size={size}
        mode={multiple ? 'multiple' : undefined}
        aria-label={ariaLabel}
        allowClear
        showSearch
        optionFilterProp="label"
        style={{ width: '100%' }}
        placeholder="请选择筛选值"
        value={value}
        options={definition.options}
        onChange={next => onChange(next ?? (multiple ? [] : ''))}
      />
    )
  }
  const value = Array.isArray(condition.value) ? condition.value[0] ?? '' : condition.value
  return (
    <Input
      size={size}
      aria-label={ariaLabel}
      placeholder="输入筛选值"
      value={value}
      onChange={event => onChange(event.target.value)}
    />
  )
}
