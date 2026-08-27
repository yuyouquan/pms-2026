'use client'

import { useEffect, useMemo, useState } from 'react'
import { FileOutlined, LinkOutlined, UploadOutlined } from '@ant-design/icons'
import { Button, DatePicker, Form, Input, Radio, Select, Space, Tag, Upload, type FormInstance } from 'antd'
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

const personOptions = ALL_USERS.map(user => ({ label: user, value: user }))

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
  existingProjects,
  currentProjectId,
  ipmProjectType,
  technicalTrack,
  historicalDomain,
  historicalSubdomain,
}: {
  form: FormInstance
  existingProjects: ProjectInfoProject[]
  currentProjectId?: string
  ipmProjectType: string
  technicalTrack: string
  historicalDomain?: string
  historicalSubdomain?: string
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

  return (
    <div className="pms-technical-project-fields">
      <div className="pms-technical-section-heading"><span>技术信息</span></div>
      <div className="pms-project-info-form-grid">
        <Form.Item label="技术赛道" name="technicalTrack"><Input disabled value={technicalTrack} /></Form.Item>
        <Form.Item label="TMG 及技术领域" name="tmg" rules={[{ required: true, message: '请选择 TMG 及技术领域' }]}>
          <Select
            showSearch
            optionFilterProp="label"
            placeholder={domainOptions.length ? '请选择技术领域' : '暂无可用配置，请先在配置中心维护'}
            options={domainOptions}
            onChange={handleDomainChange}
          />
        </Form.Item>
        <Form.Item label="子领域" name="subdomain" rules={[
          {
            validator: async (_, value) => {
              if (tmg && !subdomainOptions.some(option => !option.disabled) && !String(value || '').trim()) {
                throw new Error('暂无可用配置，请先在配置中心维护')
              }
            },
          },
          { required: true, message: '请选择子领域' },
        ]}>
          <Select
            disabled={!tmg || subdomainDisabled}
            showSearch
            optionFilterProp="label"
            placeholder={subdomainDisabled ? '无' : subdomainOptions.length ? '请选择子领域' : '暂无可用配置，请先在配置中心维护'}
            options={subdomainOptions}
          />
        </Form.Item>
        <Form.Item label="前置项目" name="preProjectId">
          <Select allowClear showSearch optionFilterProp="label" placeholder="搜索全部 PMS 项目（选填）" options={preProjectOptions} />
        </Form.Item>
        <Form.Item label="项目年份" name="projectYear" rules={[{ required: true, message: '请选择项目年份' }, { pattern: /^\d{4}$/, message: '请选择四位项目年份' }]}>
          <YearControl />
        </Form.Item>
        <Form.Item label="项目价值" name="projectValue" className="pms-project-info-form-span">
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder={projectValueOptions.length ? '请选择项目价值（选填）' : '暂无可用配置，请先在配置中心维护'}
            options={projectValueOptions}
          />
        </Form.Item>
      </div>

      <div className="pms-technical-section-heading"><span>团队人员</span><small>技术项目负责人将自动成为项目责任人</small></div>
      <div className="pms-project-info-form-grid">
        {TECHNICAL_TEAM_FIELDS.map(field => (
          <Form.Item key={field.key} label={field.label} name={field.key} rules={field.required ? [{ required: true, message: `请选择${field.label}` }] : undefined}>
            <Select allowClear showSearch optionFilterProp="label" placeholder={`请选择${field.label}`} options={personOptions} />
          </Form.Item>
        ))}
      </div>

      <div className="pms-technical-section-heading"><span>交付物</span><small>每项可选择链接或单个文件</small></div>
      <div className="pms-project-info-form-grid">
        {TECHNICAL_DELIVERABLE_FIELDS.map(field => (
          <Form.Item key={field.key} label={field.label} name={field.key}>
            <DeliverableControl label={field.label} />
          </Form.Item>
        ))}
      </div>
    </div>
  )
}
