'use client'

import { Tag, Tooltip } from 'antd'
import { LinkOutlined } from '@ant-design/icons'
import { formatJiraProjectTag, getJiraProjectUrl, type JiraProjectConfig } from '@/lib/jiraProject'
import { isValidTrialQuantity, readFanTrialRows } from '@/lib/fanTrial'
import type { ProjectInfoValue } from '@/types/app'
import type { ReactNode } from 'react'

function TagList({ children, compact, label }: { children: ReactNode; compact?: boolean; label: string }) {
  const full = <span className="pms-project-info-tags" aria-label={label}>{children}</span>
  return compact ? <Tooltip title={full} mouseEnterDelay={0.3} styles={{ root: { maxWidth: 620 } }}>
    <span className="pms-project-info-tags pms-project-info-tags--compact" aria-label={label} onClick={event => event.stopPropagation()}>{children}</span>
  </Tooltip> : full
}

export function JiraProjectTags({ value, compact }: { value: unknown; compact?: boolean }) {
  const rows = Array.isArray(value) ? value.filter((item): item is JiraProjectConfig => !!item && typeof item === 'object' && 'id' in item) : []
  return rows.length ? <TagList label="JIRA项目" compact={compact}>{rows.map(item => <Tag key={item.id} color="blue" icon={<LinkOutlined />}>
    <a href={getJiraProjectUrl(item)} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()}>{formatJiraProjectTag(item)}</a>
  </Tag>)}</TagList> : <span className="pms-project-info-empty">-</span>
}

export function FanTrialTags({ value, compact }: { value?: ProjectInfoValue; compact?: boolean }) {
  const rows = readFanTrialRows(value)
  return rows.length ? <TagList label="粉丝试用国家及试用台数" compact={compact}>{rows.map(row => <Tag key={row.country} color="blue">
    {row.country}：{isValidTrialQuantity(row.quantity) ? `${row.quantity} 台` : '待填写'}
  </Tag>)}</TagList> : <span className="pms-project-info-empty">国家及试用台数待配置</span>
}
