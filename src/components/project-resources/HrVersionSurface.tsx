'use client'

import { Button, Modal, Space } from 'antd'
import type { ModalProps } from 'antd'

/** Share the business form between the pipeline dialog and project workspace. */
export function HrVersionSurface({ embedded = false, children, ...props }: ModalProps & { embedded?: boolean }) {
  if (!embedded) return <Modal {...props}>{children}</Modal>
  if (!props.open) return null
  const footer = props.footer === undefined ? (
    <Space>
      <Button {...props.cancelButtonProps} onClick={props.onCancel}>{props.cancelText ?? '取消'}</Button>
      <Button type="primary" {...props.okButtonProps} loading={props.confirmLoading} onClick={props.onOk}>{props.okText ?? '保存'}</Button>
    </Space>
  ) : typeof props.footer === 'function' ? null : props.footer
  return <section className="pms-hr-version-surface" aria-label="资源版本内容">
    <header className="pms-hr-version-surface-header">{props.title}</header>
    <div className="pms-hr-version-surface-content">{children}</div>
    {footer !== null && <footer className="pms-hr-version-surface-actions">{footer}</footer>}
  </section>
}
