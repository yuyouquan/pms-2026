'use client'

import { useEffect, useMemo, useState } from 'react'
import { FileOutlined, LinkOutlined, UploadOutlined } from '@ant-design/icons'
import { Button, Collapse, DatePicker, Form, Input, Radio, Select, Space, Tag, Upload, type FormInstance } from 'antd'
import dayjs from 'dayjs'
import { ALL_USERS } from '@/components/permission/PermissionModule'
import {
  TECHNICAL_DELIVERABLE_FIELDS,
  TECHNICAL_TEAM_FIELDS,
} from '@/constants/technicalProject'
import { useSingleEnumOptions, useTmgOptions } from '@/hooks/useEnumOptions'
import { getTmgSubdomainState } from '@/lib/enumConsumers'
import { getPreProjectCandidates, switchDeliverableMode } from '@/lib/technicalProjectRules'
import { useEnumStore } from '@/stores/enums'
import type { ProjectInfoProject } from '@/lib/projectInfoValues'
import type { DeliverableValue } from '@/types/technicalProject'
import type { ProjectInfoFieldDefinition, ProjectInfoGroupDefinition, ProjectInfoGroupKey } from '@/constants/projectInfoSchema'

const personOptions = ALL_USERS.map(user => ({ label: user, value: user }))
const TECHNICAL_SOURCE_SNAPSHOT_KEYS = new Set(['secondaryCategory', 'technicalTrack', 'projectName'])
const technicalTeamFieldsByKey = new Map(TECHNICAL_TEAM_FIELDS.map(field => [field.key, field]))
const technicalDeliverableFieldsByKey = new Map(TECHNICAL_DELIVERABLE_FIELDS.map(field => [field.key, field]))
const TECHNICAL_GROUP_COLORS: Record<ProjectInfoGroupKey, string> = {
  basic: 'var(--pms-brand)',
  extended: '#f59e0b',
  team: '#14b8a6',
}

function DeliverableControl({ label, value, onChange }: { label: string; value?: DeliverableValue; onChange?: (value: DeliverableValue) => void }) {
  const [kind, setKind] = useState<'url' | 'file'>(value?.kind || 'url')
  useEffect(() => {
    if (value?.kind) setKind(value.kind)
  }, [value?.kind])
  return (
    <div className="pms-technical-deliverable">
      <Radio.Group
        size="small"
        value={kind}
        aria-label={`${label}录入方式`}
        onChange={event => {
          const nextKind = event.target.value as 'url' | 'file'
          setKind(nextKind)
          onChange?.(switchDeliverableMode(value, nextKind))
        }}
      >
        <Radio.Button value="url"><LinkOutlined /> 链接</Radio.Button>
        <Radio.Button value="file"><FileOutlined /> 文件</Radio.Button>
      </Radio.Group>
      {kind === 'url' ? (
        <Input
          allowClear
          value={value?.kind === 'url' ? value.url : ''}
          prefix={<LinkOutlined />}
          placeholder="https://"
          aria-label={`${label}链接`}
          onChange={event => onChange?.(event.target.value ? { kind: 'url', url: event.target.value } : null)}
        />
      ) : (
        <Space>
          <Upload
            maxCount={1}
            showUploadList={false}
            beforeUpload={file => {
              onChange?.({ kind: 'file', name: file.name, size: file.size, mimeType: file.type || 'application/octet-stream' })
              return Upload.LIST_IGNORE
            }}
          >
            <Button icon={<UploadOutlined />} aria-label={`上传${label}`}>选择文件</Button>
          </Upload>
          {value?.kind === 'file' && value.name && <Tag closable onClose={() => onChange?.(null)}>{value.name}</Tag>}
        </Space>
      )}
    </div>
  )
}

function YearControl({ value, onChange }: { value?: string; onChange?: (value: string) => void }) {
  return (
    <DatePicker
      picker="year"
      inputReadOnly
      allowClear
      value={value ? dayjs(`${value}-01-01`) : null}
      onChange={date => onChange?.(date ? date.format('YYYY') : '')}
      style={{ width: '100%' }}
      placeholder="请选择年份"
    />
  )
}

export default function TechnicalProjectCreateFields({
  form,
  fields,
  existingProjects,
  currentProjectId,
  historicalDomain,
  historicalSubdomain,
  validateRequiredOnCreate,
  groups,
  activeGroups,
  onActiveGroupsChange,
}: {
  form: FormInstance
  fields: readonly ProjectInfoFieldDefinition[]
  existingProjects: ProjectInfoProject[]
  currentProjectId?: string
  historicalDomain?: string
  historicalSubdomain?: string
  validateRequiredOnCreate: boolean
  groups: readonly ProjectInfoGroupDefinition[]
  activeGroups: string[]
  onActiveGroupsChange: (keys: string[]) => void
}) {
  const tmg = String(Form.useWatch('tmg', form) || '')
  const projectValue = String(Form.useWatch('projectValue', form) || '')
  const rowsByType = useEnumStore(state => state.rowsByType)
  const { domainOptions, subdomainOptions, autoValue, disabled: subdomainDisabled } = useTmgOptions(
    tmg,
    historicalSubdomain,
    historicalDomain,
  )
  const projectValueHistory = useMemo(() => projectValue ? [projectValue] : [], [projectValue])
  const projectValueOptions = useSingleEnumOptions('core-value', projectValueHistory)
  const projectStatusOptions = useSingleEnumOptions('technical-project-status', [])
  const preProjectOptions = getPreProjectCandidates(existingProjects, currentProjectId).map(project => ({
    value: project.id,
    label: `${project.name}（${project.type}）`,
  }))

  useEffect(() => {
    const current = String(form.getFieldValue('subdomain') || '')
    if (!current && autoValue) form.setFieldValue('subdomain', autoValue)
  }, [autoValue, form])

  const handleDomainChange = (nextDomain: string) => {
    const nextState = getTmgSubdomainState(rowsByType, nextDomain)
    const current = String(form.getFieldValue('subdomain') || '')
    if (nextState.autoValue) {
      form.setFieldValue('subdomain', nextState.autoValue)
      return
    }
    const isLive = nextState.options.some(option => !option.disabled && option.value === current)
    if (!isLive) form.setFieldValue('subdomain', undefined)
  }

  const fieldLabel = (field: ProjectInfoFieldDefinition) => (
    field.key === 'tmg' ? 'TMG 及技术领域' : field.label
  )

  const renderTechnicalControl = (field: ProjectInfoFieldDefinition) => {
    if (TECHNICAL_SOURCE_SNAPSHOT_KEYS.has(field.key)) return <Input disabled />
    if (field.key === 'status') {
      return <Select options={projectStatusOptions} placeholder={projectStatusOptions.length ? '请选择项目状态' : '暂无可用状态配置，请先在配置中心维护'} />
    }
    if (field.key === 'tmg') {
      return (
        <Select
          showSearch
          optionFilterProp="label"
          placeholder={domainOptions.length ? '请选择技术领域' : '暂无可用配置，请先在配置中心维护'}
          options={domainOptions}
          onChange={handleDomainChange}
        />
      )
    }
    if (field.key === 'subdomain') {
      return (
        <Select
          disabled={!tmg || subdomainDisabled}
          showSearch
          optionFilterProp="label"
          placeholder={subdomainDisabled ? '无' : subdomainOptions.length ? '请选择子领域' : '暂无可用配置，请先在配置中心维护'}
          options={subdomainOptions}
        />
      )
    }
    if (field.key === 'projectValue') {
      return (
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder={projectValueOptions.length ? '请选择项目价值' : '暂无可用配置，请先在配置中心维护'}
          options={projectValueOptions}
        />
      )
    }
    if (field.key === 'projectYear') return <YearControl />
    if (field.key === 'preProjectId') {
      return <Select allowClear showSearch optionFilterProp="label" placeholder="搜索全部 PMS 项目（选填）" options={preProjectOptions} />
    }
    const teamField = technicalTeamFieldsByKey.get(field.key as typeof TECHNICAL_TEAM_FIELDS[number]['key'])
    if (teamField) {
      return <Select allowClear showSearch optionFilterProp="label" placeholder={`请选择${teamField.label}`} options={personOptions} />
    }
    const deliverableField = technicalDeliverableFieldsByKey.get(field.key as typeof TECHNICAL_DELIVERABLE_FIELDS[number]['key'])
    if (deliverableField) return <DeliverableControl label={deliverableField.label} />
    return <Input disabled />
  }

  const renderField = (field: ProjectInfoFieldDefinition) => {
    const isRequired = !field.readOnly
      && (validateRequiredOnCreate ? field.requiredOnCreate : field.required)
    const label = fieldLabel(field)
    const requiredRule = isRequired ? [{ required: true, message: `请选择${label}` }] : []
    const rules = field.key === 'subdomain'
      ? [
          {
            validator: async (_: unknown, value: unknown) => {
              if (tmg && !subdomainOptions.some(option => !option.disabled) && !String(value || '').trim()) {
                throw new Error('暂无可用配置，请先在配置中心维护')
              }
            },
          },
          ...requiredRule,
        ]
      : field.key === 'projectYear'
        ? [...requiredRule, { pattern: /^\d{4}$/, message: '请选择四位项目年份' }]
        : requiredRule.length ? requiredRule : undefined
    return (
      <Form.Item
        key={field.key}
        data-project-create-field={field.key}
        label={label}
        name={field.key}
        className={field.inputType === 'deliverable' ? 'pms-project-info-form-span' : undefined}
        rules={rules}
      >
        {renderTechnicalControl(field)}
      </Form.Item>
    )
  }

  return (
    <div className="pms-technical-project-fields">
      <Collapse
        className="pms-project-info-form-groups"
        activeKey={activeGroups}
        onChange={keys => onActiveGroupsChange(keys as string[])}
        items={groups.map(group => {
          const groupFields = fields.filter(field => field.group === group.key)
          return {
            key: group.key,
            label: (
              <Space>
                <span className="pms-project-info-group-dot" style={{ background: TECHNICAL_GROUP_COLORS[group.key] }} />
                <strong>{group.label}</strong>
                <Tag>{groupFields.length} 项</Tag>
              </Space>
            ),
            children: (
              <div className="pms-project-info-form-grid" data-project-info-group={group.key}>
                {groupFields.map(renderField)}
              </div>
            ),
          }
        })}
      />
    </div>
  )
}
