'use client'

import { useEffect, useState } from 'react'
import { FileOutlined, LinkOutlined, UploadOutlined } from '@ant-design/icons'
import { Button, DatePicker, Form, Input, Radio, Select, Space, Tag, Upload, type FormInstance } from 'antd'
import dayjs from 'dayjs'
import { ALL_USERS } from '@/components/permission/PermissionModule'
import {
  NO_SUBDOMAIN_DOMAINS,
  SUBDOMAINS_BY_DOMAIN,
  TECHNICAL_DELIVERABLE_FIELDS,
  TECHNICAL_DOMAINS,
  TECHNICAL_TEAM_FIELDS,
} from '@/constants/technicalProject'
import { getPreProjectCandidates, switchDeliverableMode } from '@/lib/technicalProjectRules'
import type { ProjectInfoProject } from '@/lib/projectInfoValues'
import type { DeliverableValue, TechnicalDomain } from '@/types/technicalProject'

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
}: {
  form: FormInstance
  existingProjects: ProjectInfoProject[]
  currentProjectId?: string
  ipmProjectType: string
  technicalTrack: string
}) {
  const tmg = Form.useWatch('tmg', form) as TechnicalDomain | undefined
  const subdomainOptions = tmg ? SUBDOMAINS_BY_DOMAIN[tmg] || [] : []
  const subdomainDisabled = Boolean(tmg && NO_SUBDOMAIN_DOMAINS.includes(tmg))
  const preProjectOptions = getPreProjectCandidates(existingProjects, currentProjectId).map(project => ({
    value: project.id,
    label: `${project.name}（${project.type}）`,
  }))

  useEffect(() => {
    const current = String(form.getFieldValue('subdomain') || '')
    if (!tmg) {
      if (current) form.setFieldValue('subdomain', undefined)
      return
    }
    if (subdomainDisabled) {
      if (current !== '无') form.setFieldValue('subdomain', '无')
    } else if (!subdomainOptions.includes(current)) {
      form.setFieldValue('subdomain', undefined)
    }
  }, [form, subdomainDisabled, subdomainOptions, tmg])

  return (
    <div className="pms-technical-project-fields">
      <div className="pms-technical-section-heading"><span>技术信息</span></div>
      <div className="pms-project-info-form-grid">
        <Form.Item label="技术赛道" name="technicalTrack"><Input disabled value={technicalTrack} /></Form.Item>
        <Form.Item label="TMG 及技术领域" name="tmg" rules={[{ required: true, message: '请选择 TMG 及技术领域' }]}>
          <Select showSearch optionFilterProp="label" placeholder="请选择技术领域" options={TECHNICAL_DOMAINS.map(value => ({ label: value, value }))} />
        </Form.Item>
        <Form.Item label="子领域" name="subdomain" rules={[{ required: true, message: '请选择子领域' }]}>
          <Select disabled={!tmg || subdomainDisabled} showSearch optionFilterProp="label" placeholder={subdomainDisabled ? '无' : '请选择子领域'} options={subdomainOptions.map(value => ({ label: value, value }))} />
        </Form.Item>
        <Form.Item label="前置项目" name="preProjectId">
          <Select allowClear showSearch optionFilterProp="label" placeholder="搜索全部 PMS 项目（选填）" options={preProjectOptions} />
        </Form.Item>
        <Form.Item label="项目年份" name="projectYear" rules={[{ required: true, message: '请选择项目年份' }, { pattern: /^\d{4}$/, message: '请选择四位项目年份' }]}>
          <YearControl />
        </Form.Item>
        <Form.Item label="项目价值" name="projectValue" className="pms-project-info-form-span">
          <Input.TextArea
            showCount
            maxLength={2000}
            autoSize={{ minRows: 3, maxRows: 7 }}
            placeholder="说明项目价值（选填）"
            onPressEnter={event => event.stopPropagation()}
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
