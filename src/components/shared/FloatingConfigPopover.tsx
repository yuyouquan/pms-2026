'use client';

import { useEffect, useId, useRef, type ReactElement, type ReactNode } from 'react';
import { Popover } from 'antd';

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

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
  const triggerContainerRef = useRef<HTMLSpanElement>(null);
  const wasOpenRef = useRef(false);
  const instanceId = useId();
  const popoverInstanceClass = `pms-floating-config-popover-${instanceId.replace(/:/g, '')}`;

  const getVisiblePanel = () => Array.from(document.querySelectorAll<HTMLElement>(
    `.${popoverInstanceClass} .pms-floating-config-panel`,
  )).find(element => element.getClientRects().length > 0);

  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;

    if (open) {
      let timeout = 0;
      const focusFirstControl = () => {
        const panel = getVisiblePanel();
        const firstControl = Array.from(
          panel?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
        ).find(element => element.getClientRects().length > 0);
        if (firstControl) {
          firstControl.focus();
          if (document.activeElement === firstControl) return;
        }
        timeout = window.setTimeout(focusFirstControl, 16);
      };
      // Wait for Ant Design's popup motion and auto-focus work to settle before
      // moving focus into the actual configuration panel.
      timeout = window.setTimeout(focusFirstControl, 120);
      return () => window.clearTimeout(timeout);
    }

    if (wasOpen) {
      triggerContainerRef.current
        ?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
      ?.focus();
    }
  }, [open, popoverInstanceClass]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (!getVisiblePanel()?.contains(document.activeElement)) return;
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
        root: `pms-floating-config-popover ${popoverInstanceClass} ${className ?? ''}`.trim(),
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
      <span ref={triggerContainerRef} style={{ display: 'inline-flex' }}>
        {trigger}
      </span>
    </Popover>
  );
}
