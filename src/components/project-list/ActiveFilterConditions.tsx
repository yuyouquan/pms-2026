'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Button, Tooltip } from 'antd'
import { CloseCircleFilled, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons'
import {
  DATE_FILTER_OPERATORS,
  ENUM_FILTER_OPERATORS,
  MULTI_ENUM_FILTER_OPERATORS,
  TEXT_FILTER_OPERATORS,
  isValuelessFilterOperator,
  normalizeFilterConditions,
  type AnyFilterCondition,
  type FilterFieldDefinition,
} from '@/lib/filterConditions'

export interface ActiveFilterConditionsProps {
  conditions: readonly AnyFilterCondition[]
  definitions: readonly FilterFieldDefinition[]
  onEdit: (conditionId: string) => void
  onRemove: (conditionId: string) => void
}

const OPERATOR_LABELS = new Map<string, string>([
  ...TEXT_FILTER_OPERATORS,
  ...ENUM_FILTER_OPERATORS,
  ...MULTI_ENUM_FILTER_OPERATORS,
  ...DATE_FILTER_OPERATORS,
].map(option => [option.value, option.label]))

const formatValue = (condition: AnyFilterCondition) => {
  if (isValuelessFilterOperator(condition.operator)) return ''
  return Array.isArray(condition.value) ? condition.value.join('、') : condition.value
}

export default function ActiveFilterConditions({
  conditions,
  definitions,
  onEdit,
  onRemove,
}: ActiveFilterConditionsProps) {
  const [expanded, setExpanded] = useState(false)
  const [visibleCount, setVisibleCount] = useState(conditions.length)
  const containerRef = useRef<HTMLDivElement>(null)
  const measurementRef = useRef<HTMLDivElement>(null)
  const definitionByKey = useMemo(
    () => new Map(definitions.map(definition => [definition.key, definition])),
    [definitions],
  )
  const activeConditions = useMemo(
    () => normalizeFilterConditions(conditions, definitions),
    [conditions, definitions],
  )

  useEffect(() => setExpanded(false), [definitions])

  useLayoutEffect(() => {
    const container = containerRef.current
    const measurement = measurementRef.current
    if (!container || !measurement) return

    const calculateVisibleCount = () => {
      const chipWidths = Array.from(measurement.children)
        .map(child => (child as HTMLElement).getBoundingClientRect().width)
      const availableWidth = Math.max(80, container.getBoundingClientRect().width - 104)
      let occupiedWidth = 0
      let nextVisibleCount = 0
      chipWidths.forEach(width => {
        const nextWidth = occupiedWidth + width + (nextVisibleCount ? 6 : 0)
        if (nextWidth > availableWidth) return
        occupiedWidth = nextWidth
        nextVisibleCount += 1
      })
      setVisibleCount(Math.min(activeConditions.length, Math.max(1, nextVisibleCount)))
    }

    calculateVisibleCount()
    const observer = new ResizeObserver(calculateVisibleCount)
    observer.observe(container)
    return () => observer.disconnect()
  }, [activeConditions])

  if (!activeConditions.length) return null

  const hiddenCount = Math.max(0, activeConditions.length - visibleCount)
  const displayedConditions = expanded
    ? activeConditions
    : activeConditions.slice(0, visibleCount)

  const renderChip = (condition: AnyFilterCondition, measurement = false) => {
    const definition = definitionByKey.get(condition.field)
    const fieldLabel = definition?.label ?? condition.field
    const operatorLabel = OPERATOR_LABELS.get(condition.operator) ?? condition.operator
    const valueLabel = formatValue(condition)
    const text = `${fieldLabel} ${operatorLabel}${valueLabel ? ` ${valueLabel}` : ''}`
    return (
      <span
        className="pms-active-filter-chip"
        key={`${measurement ? 'measure-' : ''}${condition.id}`}
        aria-hidden={measurement || undefined}
      >
        <button type="button" className="pms-active-filter-chip__content" onClick={() => onEdit(condition.id)}>
          <span className="pms-active-filter-chip__field">{fieldLabel}</span>
          <span className="pms-active-filter-chip__operator">{operatorLabel}</span>
          {valueLabel && <span className="pms-active-filter-chip__value">{valueLabel}</span>}
        </button>
        {!measurement && (
          <Tooltip title={`删除${text}`}>
            <button
              type="button"
              className="pms-active-filter-chip__remove"
              aria-label={`删除筛选条件：${text}`}
              onClick={() => onRemove(condition.id)}
            >
              <CloseCircleFilled />
            </button>
          </Tooltip>
        )}
      </span>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`pms-active-filter-conditions${expanded ? ' is-expanded' : ''}`}
      aria-label="已生效筛选条件"
    >
      <div className="pms-active-filter-conditions__chips">
        {displayedConditions.map(condition => renderChip(condition))}
        {!expanded && hiddenCount > 0 && (
          <span className="pms-active-filter-overflow">+{hiddenCount}</span>
        )}
      </div>
      {hiddenCount > 0 && (
        <Button
          className="pms-active-filter-toggle"
          size="small"
          type="default"
          icon={expanded ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
          aria-expanded={expanded}
          onClick={() => setExpanded(current => !current)}
        >
          {expanded ? '收起' : '展开'}
        </Button>
      )}
      <div ref={measurementRef} className="pms-active-filter-measure" aria-hidden>
        {activeConditions.map(condition => renderChip(condition, true))}
      </div>
    </div>
  )
}
