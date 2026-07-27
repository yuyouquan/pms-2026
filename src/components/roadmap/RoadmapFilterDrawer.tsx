'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, DatePicker, Drawer, Empty, Flex, Input, Select, Tooltip, Typography } from 'antd'
import dayjs from 'dayjs'
import {
  createFilterCondition,
  getFieldOptionsWithDuplicateDisabled,
  isValuelessFilterOperator,
  type FilterFieldDefinition,
} from '@/lib/filterConditions'
import { getRoadmapFilterOperators } from '@/lib/roadmapFilters'
import type { RoadmapFilterCondition, RoadmapFilterOperator } from '@/types/roadmap'

const DRAWER_Z_INDEX = 1300
const ROADMAP_FILTER_CONTROL_HEIGHT = 32

const conditionCardStyle: CSSProperties = {
  padding: 8,
  overflowX: 'auto',
  border: '1px solid var(--border-purple)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--bg-purple-tint)',
}

const conditionRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(108px, 1fr) minmax(86px, .8fr) minmax(132px, 1.2fr) 32px',
  alignItems: 'center',
  gap: 8,
}

function createRoadmapFilterCondition(): RoadmapFilterCondition {
  return createFilterCondition() as RoadmapFilterCondition
}

interface RoadmapFilterDrawerProps {
  open: boolean
  onClose: () => void
  conditions: readonly RoadmapFilterCondition[]
  fieldDefinitions: readonly FilterFieldDefinition[]
  onApply: (conditions: RoadmapFilterCondition[]) => void
}

export default function RoadmapFilterDrawer({
  open,
  onClose,
  conditions,
  fieldDefinitions,
  onApply,
}: RoadmapFilterDrawerProps) {
  const [draftConditions, setDraftConditions] = useState<RoadmapFilterCondition[]>([
    createRoadmapFilterCondition(),
  ])

  useEffect(() => {
    if (!open) return
    setDraftConditions(conditions.length ? [...conditions] : [createRoadmapFilterCondition()])
  }, [conditions, open])

  const definitionsByKey = useMemo(
    () => new Map(fieldDefinitions.map(definition => [definition.key, definition])),
    [fieldDefinitions],
  )
  const fieldOptions = useMemo(
    () => fieldDefinitions.map(definition => ({ label: definition.label, value: definition.key })),
    [fieldDefinitions],
  )

  const updateCondition = (id: string, patch: Partial<RoadmapFilterCondition>) => {
    setDraftConditions(current => current.map(condition => (
      condition.id === id ? { ...condition, ...patch } : condition
    )))
  }

  const handleFieldChange = (condition: RoadmapFilterCondition, field: string) => {
    const definition = definitionsByKey.get(field)
    updateCondition(condition.id, {
      field: field as RoadmapFilterCondition['field'],
      operator: definition?.kind === 'text' ? 'contains' : 'equals',
      value: definition?.kind === 'enum' ? [] : '',
    })
  }

  const removeCondition = (id: string) => {
    setDraftConditions(current => {
      const remaining = current.filter(condition => condition.id !== id)
      return remaining.length ? remaining : [createRoadmapFilterCondition()]
    })
  }

  const renderValueControl = (condition: RoadmapFilterCondition) => {
    const definition = definitionsByKey.get(condition.field)
    if (!definition || isValuelessFilterOperator(condition.operator)) return null

    if (definition.kind === 'enum') {
      return (
        <Select
          aria-label={`${definition.label}筛选值`}
          size="small"
          mode="multiple"
          maxTagCount="responsive"
          allowClear
          value={Array.isArray(condition.value)
            ? condition.value
            : condition.value ? [condition.value] : []}
          placeholder={`请选择${definition.label}`}
          options={definition.options ?? []}
          onChange={value => updateCondition(condition.id, { value })}
          style={{ width: '100%', height: ROADMAP_FILTER_CONTROL_HEIGHT }}
        />
      )
    }

    if (definition.kind === 'date') {
      return (
        <DatePicker
          aria-label={`${definition.label}筛选值`}
          size="small"
          allowClear
          format="YYYY-MM-DD"
          value={typeof condition.value === 'string' && condition.value
            ? dayjs(condition.value, 'YYYY-MM-DD')
            : null}
          onChange={date => updateCondition(condition.id, { value: date?.format('YYYY-MM-DD') ?? '' })}
          style={{ width: '100%', height: ROADMAP_FILTER_CONTROL_HEIGHT }}
        />
      )
    }

    return (
      <Input
        aria-label={`${definition.label}筛选值`}
        size="small"
        value={typeof condition.value === 'string' ? condition.value : ''}
        placeholder={`请输入${definition.label}`}
        onChange={event => updateCondition(condition.id, { value: event.target.value })}
        style={{ height: ROADMAP_FILTER_CONTROL_HEIGHT }}
      />
    )
  }

  const resetAdvancedFilters = () => {
    setDraftConditions([createRoadmapFilterCondition()])
  }

  const applyAdvancedFilters = () => {
    const selectedFields = new Set<string>()
    const normalized = draftConditions.flatMap(condition => {
      const definition = definitionsByKey.get(condition.field)
      if (!definition || selectedFields.has(condition.field)) return []
      if (!getRoadmapFilterOperators(condition.field, definition.kind)
        .some(option => option.value === condition.operator)) return []
      const valueless = isValuelessFilterOperator(condition.operator)
      const value = definition.kind === 'enum'
        ? valueless
          ? []
          : [...new Set((Array.isArray(condition.value) ? condition.value : [condition.value])
            .filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
            .map(item => item.trim()))]
        : valueless
          ? ''
          : typeof condition.value === 'string'
            ? condition.value.trim()
            : ''
      if (!valueless && (Array.isArray(value) ? value.length === 0 : !value)) return []
      selectedFields.add(condition.field)
      return [{ ...condition, value }]
    })
    onApply(normalized)
    onClose()
  }

  return (
    <Drawer
      className="pms-roadmap-filter-drawer"
      title="筛选条件"
      open={open}
      onClose={onClose}
      placement="right"
      width="min(520px, 100vw)"
      zIndex={DRAWER_Z_INDEX}
      footer={(
        <Flex justify="space-between" align="center" gap={12} wrap>
          <Button size="small" onClick={resetAdvancedFilters} style={{ height: ROADMAP_FILTER_CONTROL_HEIGHT }}>
            重置筛选
          </Button>
          <Flex gap={8}>
            <Button size="small" onClick={onClose} style={{ height: ROADMAP_FILTER_CONTROL_HEIGHT }}>取消</Button>
            <Button type="primary" size="small" onClick={applyAdvancedFilters} style={{ height: ROADMAP_FILTER_CONTROL_HEIGHT }}>
              应用
            </Button>
          </Flex>
        </Flex>
      )}
    >
      <Typography.Paragraph type="secondary" style={{ marginBottom: 10, fontSize: 12 }}>
        同一条件内多个值按 OR 生效，多个条件按 AND 关系同时生效。
      </Typography.Paragraph>
      <Flex vertical gap={8}>
        {draftConditions.length ? draftConditions.map(condition => {
          const definition = definitionsByKey.get(condition.field)
          const operatorOptions = getRoadmapFilterOperators(condition.field, definition?.kind ?? 'text')
          return (
            <div key={condition.id} style={conditionCardStyle}>
              <div className="pms-roadmap-filter-condition-row" style={conditionRowStyle}>
                <Select
                  aria-label="筛选字段"
                  size="small"
                  placeholder="字段"
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
                    value: isValuelessFilterOperator(operator)
                      ? definition?.kind === 'enum' ? [] : ''
                      : condition.value,
                  })}
                  style={{ minWidth: 0, height: ROADMAP_FILTER_CONTROL_HEIGHT }}
                />
                {!isValuelessFilterOperator(condition.operator)
                  ? renderValueControl(condition)
                  : <div aria-hidden />}
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
            </div>
          )
        }) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无筛选条件" />}
        <Button
          type="dashed"
          size="small"
          icon={<PlusOutlined />}
          disabled={draftConditions.length >= fieldDefinitions.length}
          onClick={() => setDraftConditions(current => [...current, createRoadmapFilterCondition()])}
          style={{ height: ROADMAP_FILTER_CONTROL_HEIGHT }}
          block
        >
          添加条件
        </Button>
      </Flex>
    </Drawer>
  )
}
