'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, DatePicker, Drawer, Empty, Flex, Input, Select, Tooltip, Typography } from 'antd'
import dayjs from 'dayjs'
import {
  createFilterCondition,
  getFieldOptionsWithDuplicateDisabled,
  getFilterOperatorsForKind,
  isValuelessFilterOperator,
  normalizeFilterConditions,
  type FilterFieldDefinition,
} from '@/lib/filterConditions'
import type { RoadmapFilterCondition, RoadmapFilterOperator } from '@/types/roadmap'

const DRAWER_Z_INDEX = 1300

const conditionCardStyle: CSSProperties = {
  padding: 12,
  border: '1px solid var(--border-purple)',
  borderRadius: 'var(--radius-lg)',
  background: 'var(--bg-purple-tint)',
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
      value: '',
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
          size="large"
          allowClear
          value={condition.value || undefined}
          placeholder={`请选择${definition.label}`}
          options={definition.options ?? []}
          onChange={value => updateCondition(condition.id, { value: value ?? '' })}
          style={{ width: '100%', minHeight: 44 }}
        />
      )
    }

    if (definition.kind === 'date') {
      return (
        <DatePicker
          aria-label={`${definition.label}筛选值`}
          size="large"
          allowClear
          format="YYYY-MM-DD"
          value={condition.value ? dayjs(condition.value, 'YYYY-MM-DD') : null}
          onChange={date => updateCondition(condition.id, { value: date?.format('YYYY-MM-DD') ?? '' })}
          style={{ width: '100%', minHeight: 44 }}
        />
      )
    }

    return (
      <Input
        aria-label={`${definition.label}筛选值`}
        size="large"
        value={condition.value}
        placeholder={`请输入${definition.label}`}
        onChange={event => updateCondition(condition.id, { value: event.target.value })}
        style={{ minHeight: 44 }}
      />
    )
  }

  const resetAdvancedFilters = () => {
    setDraftConditions([createRoadmapFilterCondition()])
  }

  const applyAdvancedFilters = () => {
    onApply(normalizeFilterConditions(draftConditions, fieldDefinitions))
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
          <Button size="large" onClick={resetAdvancedFilters} style={{ minHeight: 44 }}>
            重置筛选
          </Button>
          <Flex gap={8}>
            <Button size="large" onClick={onClose} style={{ minHeight: 44 }}>取消</Button>
            <Button type="primary" size="large" onClick={applyAdvancedFilters} style={{ minHeight: 44 }}>
              应用
            </Button>
          </Flex>
        </Flex>
      )}
    >
      <Typography.Paragraph type="secondary">
        多个条件按 AND 关系同时生效；字段、条件、值需要成组设置。
      </Typography.Paragraph>
      <Flex vertical gap={12}>
        {draftConditions.length ? draftConditions.map(condition => {
          const definition = definitionsByKey.get(condition.field)
          const operatorOptions = getFilterOperatorsForKind(definition?.kind ?? 'text')
          return (
            <div key={condition.id} style={conditionCardStyle}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) minmax(104px, .8fr) 44px', gap: 8 }}>
                <Select
                  aria-label="筛选字段"
                  size="large"
                  placeholder="字段"
                  value={condition.field || undefined}
                  options={getFieldOptionsWithDuplicateDisabled(fieldOptions, draftConditions, condition.id)}
                  onChange={field => handleFieldChange(condition, field)}
                  style={{ minWidth: 0, minHeight: 44 }}
                />
                <Select
                  aria-label="筛选条件"
                  size="large"
                  placeholder="条件"
                  value={condition.operator}
                  options={operatorOptions as unknown as { label: string; value: RoadmapFilterOperator }[]}
                  onChange={operator => updateCondition(condition.id, {
                    operator,
                    value: isValuelessFilterOperator(operator) ? '' : condition.value,
                  })}
                  style={{ minWidth: 0, minHeight: 44 }}
                />
                <Tooltip title="删除条件">
                  <Button
                    aria-label="删除筛选条件"
                    danger
                    size="large"
                    icon={<DeleteOutlined />}
                    onClick={() => removeCondition(condition.id)}
                    style={{ width: 44, minWidth: 44, height: 44 }}
                  />
                </Tooltip>
              </div>
              {!isValuelessFilterOperator(condition.operator) ? (
                <div style={{ marginTop: 8 }}>
                  <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>值</Typography.Text>
                  {renderValueControl(condition)}
                </div>
              ) : null}
            </div>
          )
        }) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无筛选条件" />}
        <Button
          type="dashed"
          size="large"
          icon={<PlusOutlined />}
          disabled={draftConditions.length >= fieldDefinitions.length}
          onClick={() => setDraftConditions(current => [...current, createRoadmapFilterCondition()])}
          style={{ minHeight: 44 }}
          block
        >
          添加条件
        </Button>
      </Flex>
    </Drawer>
  )
}
