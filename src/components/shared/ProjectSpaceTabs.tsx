'use client'

import { Tabs, type TabsProps } from 'antd'

/** Shared section navigation for project-space plans, resources and permissions. */
export function ProjectSpaceTabs({
  className = '',
  navigationOnly = false,
  ...props
}: TabsProps & { navigationOnly?: boolean }) {
  return (
    <Tabs
      {...props}
      className={`pms-project-space-tabs ${navigationOnly ? 'pms-project-space-tabs--navigation-only' : ''} ${className}`}
    />
  )
}
