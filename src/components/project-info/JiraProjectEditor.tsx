'use client'

import { CopyOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Select, Space, Switch, Tooltip } from 'antd'
import {
  copyJiraProjectConfig,
  createJiraProjectConfig,
  JIRA_AFFECT_PROJECT_OPTIONS,
  JIRA_PROJECT_NAME_OPTIONS,
  JIRA_PROJECT_TYPE_OPTIONS,
  JIRA_SERVER_OPTIONS,
  JiraProjectValidationError,
  patchJiraProjectConfig,
  type JiraProjectConfig,
} from '@/lib/jiraProject'

export const JIRA_PROJECT_EDITOR_COLUMNS = [
  { key: 'server', label: 'JIRA服务器' },
  { key: 'projectKey', label: 'JIRA库名' },
  { key: 'type', label: '类型' },
  { key: 'shared', label: '共库' },
  { key: 'affectProjects', label: 'Affect Projects' },
  { key: 'actions', label: '操作' },
] as const

type JiraProjectEditorFieldKey = keyof JiraProjectConfig | 'actions'

interface JiraProjectEditorProps {
  rows?: JiraProjectConfig[]
  value?: JiraProjectConfig[]
  anchorId?: string
  onChange: (rows: JiraProjectConfig[]) => void
  errors?: JiraProjectValidationError[]
  disabled?: boolean
  affectProjectOptions?: Array<{ label: string; value: string }>
}

const projectOptions = JIRA_PROJECT_NAME_OPTIONS.map(value => ({ label: value, value }))

export function JiraProjectEditor({
  rows = [],
  value,
  anchorId,
  onChange,
  errors = [],
  disabled = false,
  affectProjectOptions = [],
}: JiraProjectEditorProps) {
  const resolvedRows = Array.isArray(value) ? value : rows
  const resolvedAffectProjectOptions = Array.from(new Map([
    ...JIRA_AFFECT_PROJECT_OPTIONS,
    ...affectProjectOptions,
  ].map(option => [option.value, option])).values())

  const updateRow = (rowIndex: number, patch: Partial<JiraProjectConfig>) => {
    onChange(resolvedRows.map((row, index) => index === rowIndex ? patchJiraProjectConfig(row, patch) : row))
  }

  const getFieldErrors = (rowIndex: number, fieldKey: JiraProjectEditorFieldKey) => (
    errors.filter(error => (
      error.fieldKey === fieldKey
      && error.rowIndex === rowIndex
    ))
  )

  const renderCell = (row: JiraProjectConfig, rowIndex: number, key: JiraProjectEditorFieldKey) => {
    const fieldErrors = getFieldErrors(rowIndex, key)
    const column = JIRA_PROJECT_EDITOR_COLUMNS.find(item => item.key === key)
    const controlLabel = `第 ${rowIndex + 1} 行${column?.label || '操作'}`
    const errorIds = fieldErrors.map((_, errorIndex) => `jira-project-editor-error-${rowIndex}-${key}-${errorIndex}`)
    const invalidProps = {
      'aria-label': controlLabel,
      'aria-invalid': fieldErrors.length > 0 || undefined,
      'aria-describedby': errorIds.length ? errorIds.join(' ') : undefined,
    }
    let control: React.ReactNode
    if (key === 'server') {
      control = <Select {...invalidProps} value={row.server || undefined} options={JIRA_SERVER_OPTIONS} disabled={disabled} onChange={server => updateRow(rowIndex, { server })} />
    } else if (key === 'projectKey') {
      control = <Select {...invalidProps} showSearch optionFilterProp="label" value={row.projectKey || undefined} options={projectOptions} disabled={disabled} placeholder="请输入后选择" onChange={projectKey => updateRow(rowIndex, { projectKey })} />
    } else if (key === 'type') {
      control = <Select {...invalidProps} value={row.type || undefined} options={JIRA_PROJECT_TYPE_OPTIONS} disabled={disabled} onChange={type => updateRow(rowIndex, { type })} />
    } else if (key === 'shared') {
      control = <Switch {...invalidProps} checked={row.shared} disabled={disabled} onChange={shared => updateRow(rowIndex, { shared })} />
    } else if (key === 'affectProjects') {
      control = <Select {...invalidProps} allowClear showSearch optionFilterProp="label" value={row.affectProjects || undefined} options={resolvedAffectProjectOptions} disabled={disabled || !row.shared} placeholder="请选择项目" onChange={affectProjects => updateRow(rowIndex, { affectProjects: affectProjects || '' })} />
    } else {
      control = (
        <Space size={4}>
          <Tooltip title="复制">
            <Button type="text" size="small" icon={<CopyOutlined />} aria-label={`复制第 ${rowIndex + 1} 行 JIRA 项目`} disabled={disabled} onClick={() => onChange([...resolvedRows.slice(0, rowIndex + 1), copyJiraProjectConfig(row), ...resolvedRows.slice(rowIndex + 1)])} />
          </Tooltip>
          <Tooltip title="删除">
            <Button type="text" danger size="small" icon={<DeleteOutlined />} aria-label={`删除第 ${rowIndex + 1} 行 JIRA 项目`} disabled={disabled} onClick={() => onChange(resolvedRows.filter((_, index) => index !== rowIndex))} />
          </Tooltip>
        </Space>
      )
    }
    return (
      <div key={key} role="cell" className={`pms-jira-project-editor__cell pms-jira-project-editor__cell--${key}`} data-jira-field={key}>
        {control}
        {fieldErrors.map((error, errorIndex) => <div key={`${error.message}-${errorIndex}`} id={errorIds[errorIndex]} className="pms-jira-project-editor__error" role="alert">{error.message}</div>)}
      </div>
    )
  }

  return (
    <div id={anchorId} className="pms-jira-project-editor">
      <div className="pms-jira-project-editor__toolbar">
        <span className="pms-jira-project-editor__title">JIRA库配置</span>
        <Button size="small" type="primary" icon={<PlusOutlined />} disabled={disabled} onClick={() => onChange([...resolvedRows, createJiraProjectConfig()])}>新增一行</Button>
      </div>
      <div className="pms-jira-project-editor__scroll">
        <div className="pms-jira-project-editor__table" role="table" aria-label="JIRA库配置">
          <div className="pms-jira-project-editor__header" role="row">
            {JIRA_PROJECT_EDITOR_COLUMNS.map(column => (
              <div key={column.key} id={`jira-project-editor-column-${column.key}`} role="columnheader" className={`pms-jira-project-editor__header-cell pms-jira-project-editor__header-cell--${column.key}`}>
                <span>{column.label}</span>
                {(['server', 'projectKey', 'type'].includes(column.key) || column.key === 'affectProjects') && <sup>{column.key === 'affectProjects' ? '（共库时必填）' : '*'}</sup>}
              </div>
            ))}
          </div>
          {resolvedRows.map((row, rowIndex) => (
            <div key={`${row.id || 'jira-row'}-${rowIndex}`} role="row" className="pms-jira-project-editor__row" data-jira-row={rowIndex}>
              {JIRA_PROJECT_EDITOR_COLUMNS.map(column => renderCell(row, rowIndex, column.key))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
