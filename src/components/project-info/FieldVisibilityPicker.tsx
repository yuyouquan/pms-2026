'use client'

import { Button, Checkbox, Popover, Space, Tooltip } from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import type { ProjectInfoFieldDefinition } from '@/constants/projectInfoSchema'

interface FieldVisibilityPickerProps {
  fields: ProjectInfoFieldDefinition[]
  visibleFieldKeys: string[]
  onChange: (keys: string[]) => void
  disabled?: boolean
}

export default function FieldVisibilityPicker({
  fields,
  visibleFieldKeys,
  onChange,
  disabled = false,
}: FieldVisibilityPickerProps) {
  const content = (
    <div className="pms-project-info-picker" onClick={event => event.stopPropagation()}>
      <div className="pms-project-info-picker-title">选择要展示的字段</div>
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        {fields.map(field => (
          <Checkbox
            key={field.key}
            checked={!field.hideable || visibleFieldKeys.includes(field.key)}
            disabled={!field.hideable}
            onChange={event => {
              const next = event.target.checked
                ? [...visibleFieldKeys, field.key]
                : visibleFieldKeys.filter(key => key !== field.key)
              onChange(next)
            }}
          >
            <span>{field.label}</span>
            {field.conditionalHint && <span className="pms-project-info-picker-hint">（满足条件时显示）</span>}
          </Checkbox>
        ))}
      </Space>
    </div>
  )

  const button = (
    <Button
      size="small"
      type="text"
      icon={<SettingOutlined />}
      disabled={disabled}
      onClick={event => event.stopPropagation()}
    >
      配置字段
    </Button>
  )

  if (disabled) return <Tooltip title="无基础信息查看权限">{button}</Tooltip>
  return <Popover placement="bottomRight" trigger="click" content={content}>{button}</Popover>
}
