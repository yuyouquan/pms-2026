'use client';

import { useEffect, useRef, type ReactElement, type ReactNode } from 'react';
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
  const panelRef = useRef<HTMLElement>(null);
  const wasOpenRef = useRef(false);

  const getVisiblePanel = () => (
    panelRef.current?.getClientRects().length ? panelRef.current : undefined
  );

  const isTopmostFloatingPanel = () => {
    const visiblePanels = Array.from(
      document.querySelectorAll<HTMLElement>('.pms-floating-config-panel'),
    ).filter(panel => panel.getClientRects().length > 0);
    return visiblePanels[visiblePanels.length - 1] === panelRef.current;
  };

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
          if (document.activeElement === firstControl) {
            // Popup motion may restore focus to the trigger after the first
            // successful focus. Re-check once after that motion settles.
            timeout = window.setTimeout(() => {
              if (!panel?.contains(document.activeElement)) firstControl.focus();
            }, 240);
            return;
          }
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
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (event.defaultPrevented || !isTopmostFloatingPanel()) return;
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
          ref={panelRef}
          className="pms-floating-config-panel"
          role="dialog"
          aria-modal="false"
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
