'use client'

import { useState, type MouseEvent } from 'react'
import { Button, Checkbox, Drawer, Space, Tooltip } from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import type { ProjectInfoFieldDefinition } from '@/constants/projectInfoSchema'

interface FieldVisibilityPickerProps {
  groupLabel: string
  fields: ProjectInfoFieldDefinition[]
  visibleFieldKeys: string[]
  onChange: (keys: string[]) => void
  disabled?: boolean
}

export default function FieldVisibilityPicker({
  groupLabel,
  fields,
  visibleFieldKeys,
  onChange,
  disabled = false,
}: FieldVisibilityPickerProps) {
  const [open, setOpen] = useState(false)
  const [draftKeys, setDraftKeys] = useState<string[]>(visibleFieldKeys)

  const openDrawer = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation()
    setDraftKeys(visibleFieldKeys)
    setOpen(true)
  }

  const resetToDefault = () => {
    setDraftKeys(fields
      .filter(field => !field.hideable || field.defaultVisible)
      .map(field => field.key))
  }

  const button = (
    <Button
      size="small"
      type="text"
      icon={<SettingOutlined />}
      disabled={disabled}
      onClick={openDrawer}
    >
      配置字段
    </Button>
  )

  return (
    <span
      className="pms-project-info-picker-trigger"
      onClick={event => event.stopPropagation()}
      onKeyDown={event => event.stopPropagation()}
    >
      {disabled ? <Tooltip title="无基础信息查看权限">{button}</Tooltip> : button}
      <Drawer
        rootClassName="pms-project-info-field-drawer"
        title={`配置字段 · ${groupLabel}`}
        open={open}
        onClose={() => setOpen(false)}
        width={420}
        placement="right"
        footer={(
          <div className="pms-project-info-picker-footer">
            <Button onClick={resetToDefault}>重置默认</Button>
            <Space>
              <Button onClick={() => setOpen(false)}>取消</Button>
              <Button
                type="primary"
                onClick={() => {
                  onChange(draftKeys)
                  setOpen(false)
                }}
              >
                确定
              </Button>
            </Space>
          </div>
        )}
      >
        <div className="pms-project-info-picker" role="group" aria-label="选择要展示的字段">
          <div className="pms-project-info-picker-title">选择要展示的字段</div>
          <div className="pms-project-info-picker-list">
            {fields.map(field => (
              <Checkbox
                key={field.key}
                className="pms-project-info-picker-row"
                checked={!field.hideable || draftKeys.includes(field.key)}
                disabled={!field.hideable}
                onChange={event => {
                  const checked = event.target.checked
                  setDraftKeys(currentKeys => checked
                    ? currentKeys.includes(field.key) ? currentKeys : [...currentKeys, field.key]
                    : currentKeys.filter(key => key !== field.key))
                }}
              >
                <span className="pms-project-info-picker-copy">
                  <span className="pms-project-info-picker-label">
                    {field.label}
                    {!field.hideable && <span className="pms-project-info-picker-required">必显</span>}
                  </span>
                  {field.conditionalHint && (
                    <span className="pms-project-info-picker-hint">
                      满足条件时显示 · {field.conditionalHint.replace(/时显示$/, '')}
                    </span>
                  )}
                </span>
              </Checkbox>
            ))}
          </div>
        </div>
      </Drawer>
    </span>
  )
}
