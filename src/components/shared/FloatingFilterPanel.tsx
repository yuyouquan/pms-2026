'use client'

import type { ReactElement, ReactNode } from 'react'
import { Button, Space } from 'antd'
import { CloseOutlined, PlusOutlined } from '@ant-design/icons'
import { FloatingConfigPopover } from '@/components/shared/FloatingConfigPopover'

interface FloatingFilterPanelProps {
  open: boolean
  trigger: ReactElement
  children: ReactNode
  title?: ReactNode
  onReset: () => void
  onAdd: () => void
  onClose: () => void
  addDisabled?: boolean
  getPopupContainer?: (triggerNode: HTMLElement) => HTMLElement
}

export function FloatingFilterPanel({
  open,
  trigger,
  children,
  title = '筛选',
  onReset,
  onAdd,
  onClose,
  addDisabled,
  getPopupContainer,
}: FloatingFilterPanelProps) {
  return (
    <FloatingConfigPopover
      open={open}
      trigger={trigger}
      title={(
        <div className="pms-filter-panel-header">
          <div>
            <div className="pms-filter-panel-title">{title}</div>
            <div className="pms-filter-panel-subtitle">符合以下所有条件</div>
          </div>
          <Space size={8}>
            <Button className="pms-filter-reset-button" danger onClick={onReset}>重置</Button>
            <Button
              type="primary"
              className="pms-filter-add-button"
              icon={<PlusOutlined />}
              disabled={addDisabled}
              onClick={onAdd}
            >
              增加
            </Button>
            <Button
              type="text"
              className="pms-filter-close-button"
              aria-label="关闭筛选"
              icon={<CloseOutlined />}
              onClick={onClose}
            />
          </Space>
        </div>
      )}
      width={720}
      ariaLabel="筛选"
      onCancel={onClose}
      getPopupContainer={getPopupContainer}
    >
      <div className="pms-filter-panel-content">{children}</div>
    </FloatingConfigPopover>
  )
}
