'use client';

import type { ReactElement, ReactNode } from 'react';
import { Popover } from 'antd';

type FloatingConfigPopoverProps = {
  open: boolean;
  trigger: ReactElement;
  title: ReactNode;
  children: ReactNode;
  footer: ReactNode;
  width: number;
  className?: string;
  onCancel: () => void;
  getPopupContainer?: (triggerNode: HTMLElement) => HTMLElement;
};

export function FloatingConfigPopover({
  open,
  trigger,
  title,
  children,
  footer,
  width,
  className,
  onCancel,
  getPopupContainer,
}: FloatingConfigPopoverProps) {
  return (
    <Popover
      open={open}
      trigger="click"
      placement="bottomRight"
      arrow={false}
      destroyOnHidden
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel();
      }}
      getPopupContainer={getPopupContainer}
      classNames={{
        root: `pms-floating-config-popover ${className ?? ''}`.trim(),
      }}
      styles={{
        container: {
          width: `min(${width}px, calc(100vw - 24px))`,
          padding: 0,
        },
      }}
      content={
        <section aria-label={String(title)} className="pms-floating-config-panel">
          <div className="pms-floating-config-panel-header">{title}</div>
          <div className="pms-floating-config-panel-body">{children}</div>
          <div className="pms-floating-config-panel-footer">{footer}</div>
        </section>
      }
    >
      {trigger}
    </Popover>
  );
}
