'use client'

import type { ReactNode } from 'react'
import { Collapse } from 'antd'

interface CollapsibleInformationSectionProps {
  title: string
  icon?: ReactNode
  count?: number | string
  extra?: ReactNode
  defaultActive?: boolean
  emptyState?: ReactNode
  children?: ReactNode
}

export default function CollapsibleInformationSection({
  title,
  icon,
  count,
  extra,
  defaultActive = false,
  emptyState,
  children,
}: CollapsibleInformationSectionProps) {
  const content = children ?? (
    <div className="pms-project-info-section-empty" role="status">
      {emptyState}
    </div>
  )

  return (
    <Collapse
      className="pms-project-info-collapse"
      aria-label={`${title}信息区`}
      defaultActiveKey={defaultActive ? ['content'] : []}
      items={[{
        key: 'content',
        label: (
          <div className="pms-project-info-group-heading">
            {icon && <span className="pms-project-info-group-icon" aria-hidden="true">{icon}</span>}
            <span className="pms-project-info-group-title">
              <strong>{title}</strong>
              {count !== undefined && <span className="pms-project-info-group-count">{count} 项</span>}
            </span>
          </div>
        ),
        extra,
        children: <div className="pms-project-info-section-content">{content}</div>,
      }]}
    />
  )
}
