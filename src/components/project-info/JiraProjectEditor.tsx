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
  rows: JiraProjectConfig[]
  onChange: (rows: JiraProjectConfig[]) => void
  errors?: JiraProjectValidationError[]
  disabled?: boolean
  affectProjectOptions?: Array<{ label: string; value: string }>
}

const projectOptions = JIRA_PROJECT_NAME_OPTIONS.map(value => ({ label: value, value }))

export function JiraProjectEditor({
  rows,
  onChange,
  errors = [],
  disabled = false,
  affectProjectOptions = [],
}: JiraProjectEditorProps) {
  const resolvedAffectProjectOptions = Array.from(new Map([
    ...JIRA_AFFECT_PROJECT_OPTIONS,
    ...affectProjectOptions,
  ].map(option => [option.value, option])).values())

  const updateRow = (rowId: string, patch: Partial<JiraProjectConfig>) => {
    onChange(rows.map(row => row.id === rowId ? patchJiraProjectConfig(row, patch) : row))
  }

  const getFieldErrors = (row: JiraProjectConfig, rowIndex: number, fieldKey: JiraProjectEditorFieldKey) => (
    errors.filter(error => (
      error.fieldKey === fieldKey
      && (error.rowId === row.id || (error.rowId === undefined && error.rowIndex === rowIndex))
    ))
  )

  const renderCell = (row: JiraProjectConfig, rowIndex: number, key: JiraProjectEditorFieldKey) => {
    const fieldErrors = getFieldErrors(row, rowIndex, key)
    let control: React.ReactNode
    if (key === 'server') {
      control = <Select value={row.server || undefined} options={JIRA_SERVER_OPTIONS} disabled={disabled} onChange={server => updateRow(row.id, { server })} />
    } else if (key === 'projectKey') {
      control = <Select showSearch optionFilterProp="label" value={row.projectKey || undefined} options={projectOptions} disabled={disabled} placeholder="请输入后选择" onChange={projectKey => updateRow(row.id, { projectKey })} />
    } else if (key === 'type') {
      control = <Select value={row.type || undefined} options={JIRA_PROJECT_TYPE_OPTIONS} disabled={disabled} onChange={type => updateRow(row.id, { type })} />
    } else if (key === 'shared') {
      control = <Switch checked={row.shared} disabled={disabled} onChange={shared => updateRow(row.id, { shared })} />
    } else if (key === 'affectProjects') {
      control = <Select allowClear showSearch optionFilterProp="label" value={row.affectProjects || undefined} options={resolvedAffectProjectOptions} disabled={disabled || !row.shared} placeholder="请选择项目" onChange={affectProjects => updateRow(row.id, { affectProjects: affectProjects || '' })} />
    } else {
      control = (
        <Space size={4}>
          <Tooltip title="复制">
            <Button type="text" size="small" icon={<CopyOutlined />} aria-label="复制 JIRA 项目" disabled={disabled} onClick={() => onChange([...rows, copyJiraProjectConfig(row)])} />
          </Tooltip>
          <Tooltip title="删除">
            <Button type="text" danger size="small" icon={<DeleteOutlined />} aria-label="删除 JIRA 项目" disabled={disabled} onClick={() => onChange(rows.filter(item => item.id !== row.id))} />
          </Tooltip>
        </Space>
      )
    }
    return (
      <div key={key} className={`pms-jira-project-editor__cell pms-jira-project-editor__cell--${key}`} data-jira-field={key}>
        {control}
        {fieldErrors.map((error, index) => <div key={`${error.message}-${index}`} className="pms-jira-project-editor__error" role="alert">{error.message}</div>)}
      </div>
    )
  }

  return (
    <div className="pms-jira-project-editor">
      <div className="pms-jira-project-editor__toolbar">
        <span className="pms-jira-project-editor__title">JIRA库配置</span>
        <Button size="small" type="primary" icon={<PlusOutlined />} disabled={disabled} onClick={() => onChange([...rows, createJiraProjectConfig()])}>新增一行</Button>
      </div>
      <div className="pms-jira-project-editor__scroll">
        <div className="pms-jira-project-editor__table">
          <div className="pms-jira-project-editor__header">
            {JIRA_PROJECT_EDITOR_COLUMNS.map(column => (
              <div key={column.key} className={`pms-jira-project-editor__header-cell pms-jira-project-editor__header-cell--${column.key}`}>
                <span>{column.label}</span>
                {(['server', 'projectKey', 'type'].includes(column.key) || column.key === 'affectProjects') && <sup>{column.key === 'affectProjects' ? '（共库时必填）' : '*'}</sup>}
              </div>
            ))}
          </div>
          {rows.map((row, rowIndex) => (
            <div key={row.id} className="pms-jira-project-editor__row" data-jira-row={row.id}>
              {JIRA_PROJECT_EDITOR_COLUMNS.map(column => renderCell(row, rowIndex, column.key))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
