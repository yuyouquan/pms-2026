'use client'

import { WarningOutlined } from '@ant-design/icons'
import { Alert, Button, Flex, Typography } from 'antd'
import { countConflictingPlannedProjects } from '@/lib/roadmapProjectAdapter'
import type { RoadmapPlanningConflictGroup } from '@/types/roadmap'

export interface RoadmapConflictAlertProps {
  groups: readonly RoadmapPlanningConflictGroup[]
  onViewConflicts: () => void
}

export default function RoadmapConflictAlert({
  groups,
  onViewConflicts,
}: RoadmapConflictAlertProps) {
  if (!groups.length) return null

  const plannedProjectCount = countConflictingPlannedProjects([...groups])

  return (
    <div aria-live="polite" style={{ margin: '0 0 var(--space-md)' }}>
      <Alert
        type="warning"
        showIcon
        icon={<WarningOutlined aria-hidden="true" />}
        message={(
          <Flex align="center" justify="space-between" gap={12} wrap>
            <Typography.Text strong style={{ color: 'var(--text-primary)' }}>
              {plannedProjectCount} 个待规划项目已存在对应正常项目
            </Typography.Text>
            <Button
              type="link"
              onClick={onViewConflicts}
              style={{ minHeight: 44, paddingInline: 12, fontWeight: 600 }}
            >
              查看冲突
            </Button>
          </Flex>
        )}
        description="请查看冲突并删除重复的待规划项目，正常项目仍保持只读。"
        style={{
          border: '1px solid var(--warning)',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--warning-light)',
          boxShadow: 'var(--shadow-sm)',
        }}
      />
    </div>
  )
}
