'use client'

import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { DeleteOutlined } from '@ant-design/icons'
import { Button, Empty, Select, Tooltip } from 'antd'
import { FloatingFilterPanel } from '@/components/shared/FloatingFilterPanel'
import { FilterConditionValue } from '@/components/shared/FilterConditionValue'
import {
  createFilterCondition,
  getDefaultFilterOperator,
  getFieldOptionsWithDuplicateDisabled,
  isValuelessFilterOperator,
  isMultiValueFilterOperator,
  normalizeFilterValueForOperator,
  type FilterFieldDefinition,
} from '@/lib/filterConditions'
import { getRoadmapFilterOperators } from '@/lib/roadmapFilters'
import { resolveRoadmapFilterDraft } from '@/lib/roadmapFilterDraft'
import type { RoadmapFilterCondition, RoadmapFilterOperator } from '@/types/roadmap'

const ROADMAP_FILTER_CONTROL_HEIGHT = 32

function createRoadmapFilterCondition(): RoadmapFilterCondition {
  return createFilterCondition() as RoadmapFilterCondition
}

interface RoadmapFilterDrawerProps {
  open: boolean
  trigger: ReactElement
  getPopupContainer?: (triggerNode: HTMLElement) => HTMLElement
  onClose: () => void
  conditions: readonly RoadmapFilterCondition[]
  fieldDefinitions: readonly FilterFieldDefinition[]
  onApply: (conditions: RoadmapFilterCondition[]) => void
}

export default function RoadmapFilterDrawer({
  open,
  trigger,
  getPopupContainer,
  onClose,
  conditions,
  fieldDefinitions,
  onApply,
}: RoadmapFilterDrawerProps) {
  const [draftConditions, setDraftConditions] = useState<RoadmapFilterCondition[]>([
    createRoadmapFilterCondition(),
  ])
  const previousOpenRef = useRef(false)
  const latestAppliedConditionsRef = useRef(conditions)
  latestAppliedConditionsRef.current = conditions

  useEffect(() => {
    const wasOpen = previousOpenRef.current
    previousOpenRef.current = open
    if (!open || wasOpen) return
    setDraftConditions(current => {
      const hydrated = resolveRoadmapFilterDraft({
        wasOpen,
        open,
        draft: current,
        applied: latestAppliedConditionsRef.current,
      })
      return hydrated.length ? hydrated : [createRoadmapFilterCondition()]
    })
  }, [open])

  const definitionsByKey = useMemo(
    () => new Map(fieldDefinitions.map(definition => [definition.key, definition])),
    [fieldDefinitions],
  )
  const fieldOptions = useMemo(
    () => fieldDefinitions.map(definition => ({ label: definition.label, value: definition.key })),
    [fieldDefinitions],
  )

  const normalizeConditions = (candidateConditions: readonly RoadmapFilterCondition[]) => {
    const selectedFields = new Set<string>()
    return candidateConditions.flatMap(condition => {
      const definition = definitionsByKey.get(condition.field)
      if (!definition || selectedFields.has(condition.field)) return []
      if (!getRoadmapFilterOperators(condition.field, definition.kind)
        .some(option => option.value === condition.operator)) return []
      const valueless = isValuelessFilterOperator(condition.operator)
      const value = definition.kind === 'enum'
        ? valueless
          ? ''
          : isMultiValueFilterOperator(condition.operator, definition.kind)
            ? [...new Set((Array.isArray(condition.value) ? condition.value : [condition.value])
              .filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
              .map(item => item.trim()))]
            : (Array.isArray(condition.value) ? condition.value[0] ?? '' : condition.value).trim()
        : valueless
          ? ''
          : typeof condition.value === 'string'
            ? condition.value.trim()
            : ''
      if (!valueless && (Array.isArray(value) ? value.length === 0 : !value)) return []
      selectedFields.add(condition.field)
      return [{ ...condition, value }]
    })
  }

  const commitRoadmapFilters = (next: RoadmapFilterCondition[]) => {
    setDraftConditions(next)
    onApply(normalizeConditions(next))
  }

  const updateCondition = (id: string, patch: Partial<RoadmapFilterCondition>) => {
    commitRoadmapFilters(draftConditions.map(condition => (
      condition.id === id ? { ...condition, ...patch } : condition
    )))
  }

  const handleFieldChange = (condition: RoadmapFilterCondition, field: string) => {
    const definition = definitionsByKey.get(field)
    updateCondition(condition.id, {
      field: field as RoadmapFilterCondition['field'],
      operator: getDefaultFilterOperator(definition?.kind ?? 'text'),
      value: '',
    })
  }

  const removeCondition = (id: string) => {
    const remaining = draftConditions.filter(condition => condition.id !== id)
    commitRoadmapFilters(remaining.length ? remaining : [createRoadmapFilterCondition()])
  }

  const renderValueControl = (condition: RoadmapFilterCondition) => {
    const definition = definitionsByKey.get(condition.field)
    return (
      <FilterConditionValue
        size="small"
        condition={condition}
        definition={definition}
        onChange={value => updateCondition(condition.id, { value })}
      />
    )
  }

  const resetAdvancedFilters = () => {
    commitRoadmapFilters([createRoadmapFilterCondition()])
  }

  return (
    <FloatingFilterPanel
      open={open}
      trigger={trigger}
      title="条件筛选"
      width={432}
      getPopupContainer={getPopupContainer}
      onReset={resetAdvancedFilters}
      onAdd={() => commitRoadmapFilters([...draftConditions, createRoadmapFilterCondition()])}
      addDisabled={draftConditions.length >= fieldDefinitions.length}
      onClose={onClose}
    >
      <div className="pms-filter-condition-list is-compact pms-roadmap-filter-body pms-solid-surface">
        {draftConditions.length ? draftConditions.map(condition => {
          const definition = definitionsByKey.get(condition.field)
          const operatorOptions = getRoadmapFilterOperators(condition.field, definition?.kind ?? 'text')
          return (
            <div key={condition.id} className="pms-filter-condition-row">
                <Select
                  aria-label="筛选字段"
                  size="small"
                  placeholder="筛选字段"
                  value={condition.field || undefined}
                  options={getFieldOptionsWithDuplicateDisabled(
                    fieldOptions,
                    draftConditions.map(item => ({
                      ...item,
                      value: Array.isArray(item.value) ? item.value.join(',') : item.value,
                    })),
                    condition.id,
                  )}
                  onChange={field => handleFieldChange(condition, field)}
                  style={{ minWidth: 0, height: ROADMAP_FILTER_CONTROL_HEIGHT }}
                />
                <Select
                  aria-label="筛选条件"
                  size="small"
                  placeholder="条件"
                  value={condition.operator}
                  options={operatorOptions as unknown as { label: string; value: RoadmapFilterOperator }[]}
                  onChange={operator => updateCondition(condition.id, {
                    operator,
                    value: normalizeFilterValueForOperator(
                      condition.value,
                      operator,
                      definition?.kind ?? 'text',
                    ),
                  })}
                  style={{ minWidth: 0, height: ROADMAP_FILTER_CONTROL_HEIGHT }}
                />
                {renderValueControl(condition)}
                <Tooltip title="删除条件">
                  <Button
                    aria-label="删除筛选条件"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => removeCondition(condition.id)}
                    style={{ width: ROADMAP_FILTER_CONTROL_HEIGHT, minWidth: ROADMAP_FILTER_CONTROL_HEIGHT, height: ROADMAP_FILTER_CONTROL_HEIGHT }}
                  />
                </Tooltip>
            </div>
          )
        }) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无筛选条件" />}
      </div>
    </FloatingFilterPanel>
  )
}
