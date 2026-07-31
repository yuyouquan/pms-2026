'use client'

import { Button, Modal, Typography } from 'antd'

interface TosVersionMaintenanceModalProps {
  open: boolean
  onCancel: () => void
  onOpenConfig?: () => void
}

/**
 * Compatibility shell for stale callers. Roadmap version values are no longer
 * maintained here; the live toolbar navigates directly to shared enum config.
 */
export default function TosVersionMaintenanceModal({
  open,
  onCancel,
  onOpenConfig,
}: TosVersionMaintenanceModalProps) {
  return (
    <Modal
      className="pms-modal"
      title="tOS 版本维护"
      open={open}
      onCancel={onCancel}
      footer={(
        <>
          <Button onClick={onCancel}>关闭</Button>
          {onOpenConfig ? (
            <Button type="primary" onClick={onOpenConfig}>前往枚举值配置</Button>
          ) : null}
        </>
      )}
    >
      <Typography.Paragraph>
        两位 tOS 版本已统一迁移至配置中心的“枚举值配置”，此处不再提供独立维护目录。
      </Typography.Paragraph>
    </Modal>
  )
}
