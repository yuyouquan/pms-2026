'use client';

import { useEffect, type ReactElement, type ReactNode } from 'react';
import { Popover } from 'antd';

type FloatingConfigPopoverProps = {
  open: boolean;
  trigger: ReactElement;
  title: ReactNode;
  children: ReactNode;
  footer: ReactNode;
  width: number;
  ariaLabel?: string;
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
  ariaLabel,
  className,
  onCancel,
  getPopupContainer,
}: FloatingConfigPopoverProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel, open]);

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
        <section
          className="pms-floating-config-panel"
          aria-label={ariaLabel ?? (typeof title === 'string' ? title : '配置面板')}
        >
          <header className="pms-floating-config-header">{title}</header>
          <div className="pms-floating-config-body">{children}</div>
          <footer className="pms-floating-config-footer">{footer}</footer>
        </section>
      }
    >
      {trigger}
    </Popover>
  );
}
