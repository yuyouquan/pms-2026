'use client'

import { Input, Select } from 'antd'
import { ALL_USERS } from '@/components/permission/PermissionModule'
import { JiraProjectEditor } from '@/components/project-info/JiraProjectEditor'
import type { ProjectInfoFieldDefinition } from '@/constants/projectInfoSchema'
import type { JiraProjectConfig } from '@/lib/jiraProject'
import type { ProjectInfoValue } from '@/types/app'
import { formatTosSnapshot } from '@/lib/enumConsumers'

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
    return <JiraProjectEditor rows={rows} onChange={nextRows => onChange?.(nextRows)} />
  }

  if (field.readOnly) {
    const displayValue = ['firstSaleTosVersion', 'currentTosVersion'].includes(field.key)
      ? formatTosSnapshot(value)
      : toText(value)
    return <Input value={displayValue} disabled placeholder="自动获取" />
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

  if (field.inputType === 'boolean' || (field.inputType === 'select' && (optionsOverride !== undefined || field.options !== undefined))) {
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
        placeholder={options.length === 0 ? '暂无可用配置，请先在配置中心维护' : field.placeholder || `请选择${field.label}`}
        options={options}
        onChange={next => onChange?.(next || '')}
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
