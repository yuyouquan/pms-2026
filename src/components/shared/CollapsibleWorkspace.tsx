'use client'

import type { CSSProperties, ReactNode } from 'react'
import { Button, Tooltip } from 'antd'
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons'

interface CollapsibleSidebarShellProps {
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  title: ReactNode
  children: ReactNode
  ariaLabel: string
  className?: string
  expandedWidth?: number
  collapsedWidth?: number
}

interface ConfigWorkspaceShellProps extends CollapsibleSidebarShellProps {
  content: ReactNode
}

export function CollapsibleSidebarShell({
  collapsed,
  onCollapsedChange,
  title,
  children,
  ariaLabel,
  className = '',
  expandedWidth = 250,
  collapsedWidth = 64,
}: CollapsibleSidebarShellProps) {
  const style = {
    '--pms-sidebar-expanded-width': `${expandedWidth}px`,
    '--pms-sidebar-collapsed-width': `${collapsedWidth}px`,
  } as CSSProperties

  return (
    <aside
      className={`pms-collapsible-sidebar${collapsed ? ' is-collapsed' : ''}${className ? ` ${className}` : ''}`}
      aria-label={ariaLabel}
      style={style}
    >
      {!collapsed && <div className="pms-collapsible-sidebar__title">{title}</div>}
      <div className="pms-collapsible-sidebar__content">{children}</div>
      <Tooltip title={collapsed ? '展开侧栏' : '收起侧栏'} placement="right">
        <Button
          className="pms-collapsible-sidebar__toggle"
          type="text"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          aria-label={collapsed ? '展开侧栏' : '收起侧栏'}
          aria-expanded={!collapsed}
          onClick={() => onCollapsedChange(!collapsed)}
        />
      </Tooltip>
    </aside>
  )
}

export function ConfigWorkspaceShell({ content, ...sidebarProps }: ConfigWorkspaceShellProps) {
  const sidebarWidth = sidebarProps.collapsed
    ? (sidebarProps.collapsedWidth ?? 64)
    : (sidebarProps.expandedWidth ?? 250)

  return (
    <section
      className={`pms-config-workspace${sidebarProps.collapsed ? ' is-collapsed' : ''}`}
      style={{ '--pms-config-sidebar-width': `${sidebarWidth}px` } as CSSProperties}
    >
      <CollapsibleSidebarShell {...sidebarProps} />
      <div className="pms-config-workspace__content">{content}</div>
    </section>
  )
}
