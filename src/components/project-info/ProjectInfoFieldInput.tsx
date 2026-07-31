'use client'

import { AutoComplete, Button, Card, Input, Select, Space } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { ALL_USERS } from '@/components/permission/PermissionModule'
import type { ProjectInfoFieldDefinition } from '@/constants/projectInfoSchema'
import {
  createJiraProjectConfig,
  JIRA_PROJECT_NAME_OPTIONS,
  JIRA_PROJECT_TYPE_OPTIONS,
  JIRA_SERVER_OPTIONS,
  type JiraProjectConfig,
} from '@/lib/jiraProject'
import type { ProjectInfoValue } from '@/types/app'

interface ProjectInfoFieldInputProps {
  field: ProjectInfoFieldDefinition
  value?: ProjectInfoValue
  onChange?: (value: ProjectInfoValue) => void
  firstLaunchProjectOptions?: Array<{ label: string; value: string }>
  optionsOverride?: readonly (string | { label: string; value: string; disabled?: boolean })[]
}

const toText = (value: ProjectInfoValue | undefined) => (
  typeof value === 'string' ? value : ''
)

const FREE_TEXT_OPTIONS: Record<string, string[]> = {
  developmentMode: ['自研', '联合开发', 'ODC', '外研'],
  kernelVersion: ['5.10', '5.15', '6.1', '6.6'],
}

export default function ProjectInfoFieldInput({
  field,
  value,
  onChange,
  firstLaunchProjectOptions = [],
  optionsOverride,
}: ProjectInfoFieldInputProps) {
  if (field.inputType === 'jira') {
    const rows = Array.isArray(value) && value.every(item => typeof item === 'object')
      ? value as JiraProjectConfig[]
      : []
    const updateRow = (id: string, patch: Partial<JiraProjectConfig>) => {
      onChange?.(rows.map(row => row.id === id ? { ...row, ...patch } : row))
    }
    return (
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        {rows.map(row => (
          <Card key={row.id} size="small" className="pms-project-info-jira-row">
            <div className="pms-project-info-jira-grid">
              <Select value={row.server} options={JIRA_SERVER_OPTIONS} onChange={server => updateRow(row.id, { server })} />
              <Select showSearch value={row.projectKey || undefined} options={JIRA_PROJECT_NAME_OPTIONS.map(item => ({ label: item, value: item }))} onChange={projectKey => updateRow(row.id, { projectKey })} placeholder="JIRA 项目" />
              <Select value={row.type} options={JIRA_PROJECT_TYPE_OPTIONS} onChange={type => updateRow(row.id, { type })} />
              <Button danger type="text" icon={<DeleteOutlined />} onClick={() => onChange?.(rows.filter(item => item.id !== row.id))}>删除</Button>
            </div>
          </Card>
        ))}
        <Button type="dashed" icon={<PlusOutlined />} onClick={() => onChange?.([...rows, createJiraProjectConfig()])}>添加 JIRA 项目</Button>
      </Space>
    )
  }

  if (field.readOnly) {
    return <Input value={toText(value)} disabled placeholder="自动获取" />
  }

  if (field.inputType === 'person') {
    return (
      <Select
        allowClear
        showSearch
        value={toText(value) || undefined}
        placeholder="请选择人员"
        options={ALL_USERS.map(user => ({ label: user, value: user }))}
        onChange={next => onChange?.(next || '')}
      />
    )
  }

  if (field.inputType === 'people') {
    return (
      <Select
        mode="multiple"
        value={Array.isArray(value) ? value as string[] : []}
        placeholder="请选择人员"
        options={ALL_USERS.map(user => ({ label: user, value: user }))}
        onChange={next => onChange?.(next)}
      />
    )
  }

  if (field.inputType === 'multiSelect') {
    return (
      <Select
        mode="multiple"
        showSearch
        optionFilterProp="label"
        value={Array.isArray(value) ? value as string[] : []}
        placeholder="请选择整机项目"
        options={firstLaunchProjectOptions}
        onChange={next => onChange?.(next)}
      />
    )
  }

  if (field.inputType === 'boolean' || (field.inputType === 'select' && (optionsOverride?.length || field.options?.length))) {
    const options = (optionsOverride || field.options || []).map(option => (
      typeof option === 'string' ? { label: option, value: option } : option
    ))
    const current = toText(value)
    if (current && !options.some(option => option.value === current)) {
      options.unshift({ label: `${current}（已停用）`, value: current, disabled: true })
    }
    return (
      <Select
        allowClear
        showSearch={field.inputType === 'select'}
        value={current || undefined}
        placeholder={field.placeholder || `请选择${field.label}`}
        options={options}
        onChange={next => onChange?.(next || '')}
      />
    )
  }

  if (field.inputType === 'select') {
    return (
      <AutoComplete
        value={toText(value)}
        options={(FREE_TEXT_OPTIONS[field.key] || []).map(option => ({ value: option }))}
        onChange={next => onChange?.(next)}
        placeholder={field.placeholder || `请输入${field.label}`}
      />
    )
  }

  return (
    <Input
      type={field.inputType === 'date' ? 'date' : 'text'}
      value={toText(value)}
      placeholder={field.placeholder || `请输入${field.label}`}
      onChange={event => onChange?.(event.target.value)}
    />
  )
}
