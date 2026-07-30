'use client'

import type { ReactElement, ReactNode } from 'react'
import { Button, Space } from 'antd'
import { FloatingConfigPopover } from '@/components/shared/FloatingConfigPopover'

interface FloatingFilterPanelProps {
  open: boolean
  trigger: ReactElement
  children: ReactNode
  onReset: () => void
  onClear: () => void
  onCancel: () => void
  onConfirm: () => void
  confirmDisabled?: boolean
  getPopupContainer?: (triggerNode: HTMLElement) => HTMLElement
}

export function FloatingFilterPanel({
  open,
  trigger,
  children,
  onReset,
  onClear,
  onCancel,
  onConfirm,
  confirmDisabled,
  getPopupContainer,
}: FloatingFilterPanelProps) {
  return (
    <FloatingConfigPopover
      open={open}
      trigger={trigger}
      title={(
        <div className="pms-floating-config-title-row">
          <span>筛选符合以下所有条件的结果</span>
          <Space size={4}>
            <Button type="link" danger size="small" onClick={onReset}>重置</Button>
            <Button type="link" danger size="small" onClick={onClear}>清空</Button>
          </Space>
        </div>
      )}
      footer={(
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button onClick={onCancel}>取消</Button>
          <Button type="primary" disabled={confirmDisabled} onClick={onConfirm}>确认</Button>
        </Space>
      )}
      width={720}
      ariaLabel="筛选"
      onCancel={onCancel}
      getPopupContainer={getPopupContainer}
    >
      {children}
    </FloatingConfigPopover>
  )
}
