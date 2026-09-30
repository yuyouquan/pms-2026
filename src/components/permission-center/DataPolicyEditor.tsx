'use client'

import { useEffect, useState } from 'react'
import { Button, Checkbox, Empty, Input, InputNumber, Popover, Radio, Select, Tooltip } from 'antd'
import { CloseCircleFilled, DownOutlined, UpOutlined, DeleteOutlined, FilterOutlined, LockOutlined, PlusOutlined, SettingOutlined } from '@ant-design/icons'
import { getPermissionColumnFields, getPermissionFields } from '@/constants/permissionCenter'
import { getPermissionColumnUnits, getPermissionColumnUnitState, getSelectedPermissionColumns, togglePermissionColumnUnit } from '@/lib/permissionColumnUnits'
import { getPermissionOperators, validateMenuPolicy } from '@/lib/permissionCenter'
import type { MenuPolicy, PermissionCondition, PermissionMutationResult, PermissionOperator, ProjectDataScope } from '@/types/permissionCenter'
import styles from '@/components/permission-center/PermissionCenter.module.css'
import { PROJECT_ATTRIBUTE_LABELS, type ProjectAttribute } from '@/types/projectRegistry'

const OPERATOR_LABELS: Record<PermissionOperator, string> = {
  eq: '等于', neq: '不等于', contains: '包含', notContains: '不包含', in: '属于', notIn: '不属于', empty: '为空', notEmpty: '不为空', gt: '大于', gte: '大于等于', lt: '小于', lte: '小于等于',
}
interface Props {
  policy: MenuPolicy
  projectScope?: ProjectDataScope
  disabled: boolean
  columnsDisabled: boolean
  onUpdate: (update: (previous: MenuPolicy) => MenuPolicy) => PermissionMutationResult
  onColumnsUpdate: (update: (previous: MenuPolicy) => MenuPolicy) => PermissionMutationResult
  onDirtyChange: (dirty: boolean) => void
}
const newCondition = (): PermissionCondition => ({ id: `condition:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`, field: '', operator: 'eq', value: '' })
const valueLabel = (field: string, value: string) => field === 'projectAttribute' ? PROJECT_ATTRIBUTE_LABELS[value as ProjectAttribute] ?? value : value

export default function DataPolicyEditor({ policy, projectScope, disabled, columnsDisabled, onUpdate, onColumnsUpdate, onDirtyChange }: Props) {
  const filterFields = getPermissionFields(policy.menuId)
  const columnFields = getPermissionColumnFields(policy.menuId, projectScope)
  const [draft, setDraft] = useState(policy.data)
  const [draftError, setDraftError] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [columnSearch, setColumnSearch] = useState('')
  const [columnOpen, setColumnOpen] = useState(false)
  const [columnsExpanded, setColumnsExpanded] = useState(false)
  const columnUnits = getPermissionColumnUnits(policy.menuId, projectScope)
  const columnControlsDisabled = disabled || columnsDisabled
  const savedDataKey = JSON.stringify(policy.data)
  useEffect(() => { setDraft(policy.data); setDraftError(''); onDirtyChange(false) }, [savedDataKey]) // Only persisted data changes replace the condition draft.
  useEffect(() => () => onDirtyChange(false), [])
  const updateData = (data: MenuPolicy['data']) => {
    setDraft(data)
    // A filter edit must not migrate or expand legacy selected columns.
    const validation = validateMenuPolicy({ ...policy, data, columns: { mode: 'all', fields: [] } }, projectScope)
    if (!validation.ok) { setDraftError(validation.error); onDirtyChange(true); return }
    const result = onUpdate(previous => ({ ...previous, data }))
    setDraftError(result.ok ? '' : result.error)
    onDirtyChange(!result.ok)
  }
  const updateCondition = (id: string, patch: Partial<PermissionCondition>) => updateData({ ...draft, conditions: draft.conditions.map(condition => condition.id === id ? { ...condition, ...patch } : condition) })
  const removeCondition = (id: string) => updateData({ ...draft, mode: 'conditions', conditions: draft.conditions.filter(condition => condition.id !== id) })
  const columnKeys = columnFields.map(field => field.key)
  const selectedColumns = getSelectedPermissionColumns(policy.menuId, policy.columns, projectScope)
  const selectedUnits = columnUnits.filter(unit => getPermissionColumnUnitState(unit, selectedColumns).selectedCount > 0)
  const previewUnits = columnsExpanded ? selectedUnits : selectedUnits.slice(0, 8)
  const matchingUnits = columnUnits.filter(unit => unit.label.toLowerCase().includes(columnSearch.toLowerCase()))
  const requiredColumns = columnFields.filter(field => field.required).map(field => field.key)
  const updateColumns = (keys: string[], mode: 'all' | 'selected' = 'selected') => onColumnsUpdate(previous => ({ ...previous, columns: { mode, fields: mode === 'all' ? [] : [...new Set([...requiredColumns, ...keys.filter(key => columnKeys.includes(key))])] } }))
  const filterEditor = <div className={styles.editor} aria-label="筛选条件编辑器">
    <Select aria-label="条件匹配方式" value={draft.conjunction} onChange={conjunction => updateData({ ...draft, conjunction })}
      options={[{ value: 'all', label: '满足所有条件' }, { value: 'any', label: '满足任一条件' }]} disabled={disabled} />
    {draft.conditions.map((condition, index) => {
      const field = filterFields.find(field => field.key === condition.field)
      const operators = field ? getPermissionOperators(field) : ['eq'] as PermissionOperator[]
      const isMultiple = ['in', 'notIn'].includes(condition.operator)
      const substring = ['contains', 'notContains'].includes(condition.operator)
      const noValue = ['empty', 'notEmpty'].includes(condition.operator)
      return <div key={condition.id} className={styles.condition}>
        <Select aria-label={`条件${index + 1}字段`} className={styles.conditionFields} showSearch optionFilterProp="label" placeholder="选择字段"
          value={condition.field || undefined} options={filterFields.map(field => ({ value: field.key, label: field.label }))} disabled={disabled}
          onChange={field => updateCondition(condition.id, { field, operator: 'eq', value: '' })} />
        <Select aria-label={`条件${index + 1}运算符`} value={condition.operator} options={operators.map(value => ({ value, label: OPERATOR_LABELS[value] }))} disabled={disabled}
          onChange={operator => updateCondition(condition.id, { operator, value: ['in', 'notIn'].includes(operator) ? [] : '' })} />
        {!noValue && <div className={styles.conditionValue}>
          {(!substring && field?.options?.length) || isMultiple ? <Select aria-label={`条件${index + 1}值`} className={styles.conditionFields} showSearch allowClear optionFilterProp="label"
            mode={isMultiple ? (field?.options?.length ? 'multiple' : 'tags') : undefined}
            value={condition.value === '' ? undefined : condition.value as string | string[] | undefined}
            options={field?.options?.map(value => ({ value, label: valueLabel(condition.field, value) }))} placeholder={isMultiple ? '选择值或输入后按回车' : '选择值'} disabled={disabled}
            onChange={value => updateCondition(condition.id, { value: value ?? (isMultiple ? [] : '') })} />
            : field?.kind === 'number' ? <InputNumber aria-label={`条件${index + 1}值`} className={styles.conditionFields} value={typeof condition.value === 'number' ? condition.value : null} placeholder="输入数字" disabled={disabled}
              onChange={value => updateCondition(condition.id, { value: value ?? '' })} />
              : <Input aria-label={`条件${index + 1}值`} type={field?.kind === 'date' ? 'date' : 'text'} placeholder="输入条件值" disabled={disabled}
                value={typeof condition.value === 'string' ? condition.value : ''} onChange={event => updateCondition(condition.id, { value: event.target.value })} />}
        </div>}
        <Button className={styles.conditionRemove} aria-label={`删除条件${index + 1}`} type="text" danger icon={<DeleteOutlined />} disabled={disabled} onClick={() => removeCondition(condition.id)} />
      </div>
    })}
    <Button icon={<PlusOutlined />} disabled={disabled} onClick={() => updateData({ ...draft, mode: 'conditions', conditions: [...draft.conditions, newCondition()] })}>添加条件</Button>
    {draftError && <div className={styles.inlineError} role="status">条件未完整，尚未生效。{draftError}；继续使用上次已生效配置。</div>}
  </div>
  const columnEditor = <div className={styles.columnEditor} aria-label="可见列设置">
    <Input placeholder="搜索列" aria-label="搜索可见列" value={columnSearch} onChange={event => setColumnSearch(event.target.value)} allowClear />
    <div className={styles.toolbar} style={{ marginTop: 8 }}>
      <Button type="link" onClick={() => updateColumns(columnKeys)} disabled={columnControlsDisabled}>全选</Button>
      <Button type="link" onClick={() => updateColumns(requiredColumns)} disabled={columnControlsDisabled}>清空可选列</Button>
    </div>
    <div className={styles.columnList}>{matchingUnits.map(unit => {
      const state = getPermissionColumnUnitState(unit, selectedColumns)
      return <Checkbox key={unit.key} checked={state.checked} indeterminate={state.indeterminate} disabled={columnControlsDisabled || unit.required}
        onChange={event => updateColumns(togglePermissionColumnUnit(selectedColumns, unit, event.target.checked))}>
        {unit.label}{unit.required && <Tooltip title="视图必要识别列，必须保留"><span className={styles.muted}>（必要）</span></Tooltip>}
        {state.indeterminate && <Tooltip title={`已授权 ${state.selectedCount}/${unit.fieldKeys.length} 个节点，勾选后授权全部节点`}><span className={styles.muted}>（部分）</span></Tooltip>}
      </Checkbox>
    })}</div>
    {!matchingUnits.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有匹配的列" />}
  </div>
  if (projectScope === 'capability') return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无可配置列" />
  if (!filterFields.length) return null
  return <div className={styles.dataSections}>
    <section className={styles.dataSection} aria-label="可见数据配置">
    <div className={styles.dataSectionHeader}>
      <h3 className={styles.dataSectionTitle}>可见数据</h3>
      <Popover trigger="click" title="筛选条件" content={filterEditor} open={filterOpen} onOpenChange={setFilterOpen} placement="bottomRight">
        <Button icon={<FilterOutlined />} disabled={disabled} onClick={() => { if (draft.mode === 'all') updateData({ ...draft, mode: 'conditions', conditions: draft.conditions.length ? draft.conditions : [newCondition()] }) }}>筛选条件</Button>
      </Popover>
    </div>
    <div className={styles.dataRow}><Radio.Group value={draft.mode} disabled={disabled} onChange={event => {
      const mode = event.target.value as 'all' | 'conditions'
      updateData({ ...draft, mode, conditions: mode === 'conditions' && !draft.conditions.length ? [newCondition()] : draft.conditions })
      if (mode === 'conditions') setFilterOpen(true)
    }}><Radio value="all">全部数据</Radio><Radio value="conditions">符合筛选条件的数据</Radio></Radio.Group>
    </div>
    {draftError && <div className={styles.inlineError} role="status">条件未完整，尚未生效；继续使用上次已生效配置。<Button type="link" onClick={() => setFilterOpen(true)}>继续填写</Button></div>}
    {policy.data.mode === 'all' && <div className={styles.dataSummary}>可查看当前菜单下的全部数据</div>}
    {policy.data.mode === 'conditions' && <div className={styles.dataSummary}>
      <div className={styles.muted}>{policy.data.conjunction === 'all' ? '满足所有条件' : '满足任一条件'}</div>
      <div className={styles.chips} aria-label="已生效筛选条件">{policy.data.conditions.map(condition => {
        const field = filterFields.find(field => field.key === condition.field)
        const value = Array.isArray(condition.value) ? condition.value.map(value => valueLabel(condition.field, value)).join('、') : valueLabel(condition.field, String(condition.value ?? ''))
        const text = `${field?.label ?? condition.field} ${OPERATOR_LABELS[condition.operator]} ${value}`
        return <span className="pms-active-filter-chip" key={condition.id}><Tooltip title={text}>
          <button type="button" className="pms-active-filter-chip__content" disabled={disabled} onClick={() => setFilterOpen(true)} aria-label={`编辑筛选条件：${text}`}>
            <span className="pms-active-filter-chip__field">{field?.label ?? condition.field}</span><span className="pms-active-filter-chip__operator">{OPERATOR_LABELS[condition.operator]}</span>
            {!['empty', 'notEmpty'].includes(condition.operator) && <span className="pms-active-filter-chip__value">{value}</span>}
          </button></Tooltip><button type="button" className="pms-active-filter-chip__remove" disabled={disabled} aria-label={`删除筛选条件：${text}`} onClick={() => removeCondition(condition.id)}><CloseCircleFilled /></button>
        </span>
      })}</div>
    </div>}
    </section>
    <section className={styles.dataSection} aria-label="可见列配置" aria-describedby={columnsDisabled ? 'permission-condition-draft-block' : undefined}>
    <div className={styles.dataSectionHeader}>
      <h3 className={styles.dataSectionTitle}>可见列<span className={styles.dataSectionCount}>{policy.columns.mode === 'all' ? columnUnits.length : selectedUnits.length} / {columnUnits.length}</span></h3>
      <Popover trigger="click" title="可见列" content={columnEditor} placement="bottomRight" open={columnOpen} onOpenChange={setColumnOpen}><Button icon={<SettingOutlined />} disabled={columnControlsDisabled || !columnFields.length}>列设置</Button></Popover>
    </div>
    {columnFields.length ? <>
    <div className={styles.dataRow}><Radio.Group value={policy.columns.mode} disabled={columnControlsDisabled}
      onChange={event => updateColumns(selectedColumns, event.target.value)}><Radio value="all">全部列</Radio><Radio value="selected">指定列</Radio></Radio.Group></div>
    {policy.columns.mode === 'all' && <div className={styles.dataSummary}>可查看全部 {columnUnits.length} 项列设置</div>}
    {policy.columns.mode === 'selected' && <div className={styles.dataSummary}>
      <div className={styles.muted}>已选择 {selectedUnits.length} 项列设置</div>
      <div className={styles.chips} aria-label="已生效可见列">{!selectedUnits.length && <span className={styles.muted}>未选择可见列</span>}{previewUnits.map(unit => {
        const state = getPermissionColumnUnitState(unit, selectedColumns)
        const label = `${unit.label}${state.indeterminate ? '（部分）' : ''}`
        const hint = unit.required ? `${unit.label}：视图必要识别列，必须保留` : state.indeterminate ? `${unit.label}：已授权 ${state.selectedCount}/${unit.fieldKeys.length} 个节点` : unit.label
        return <span key={unit.key} className="pms-active-filter-chip">
          <Tooltip title={hint}><button type="button" aria-label={`配置可见列：${unit.label}`} disabled={columnControlsDisabled} onClick={() => setColumnOpen(true)} className={`pms-active-filter-chip__content ${unit.required ? styles.locked : ''}`}>
            <span className="pms-active-filter-chip__field">{label}</span>{unit.required && <LockOutlined />}
          </button></Tooltip>{!unit.required && <button type="button" className="pms-active-filter-chip__remove" disabled={columnControlsDisabled} aria-label={`取消可见列：${unit.label}`} onClick={() => updateColumns(togglePermissionColumnUnit(selectedColumns, unit, false))}><CloseCircleFilled /></button>}
        </span>
      })}</div>
      {selectedUnits.length > 8 && <Button type="link" className={styles.expandColumns} icon={columnsExpanded ? <UpOutlined /> : <DownOutlined />} aria-expanded={columnsExpanded} onClick={() => setColumnsExpanded(!columnsExpanded)}>{columnsExpanded ? '收起' : `展开全部（${selectedUnits.length}）`}</Button>}
    </div>}</> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无可配置列" />}
    </section>
  </div>
}
