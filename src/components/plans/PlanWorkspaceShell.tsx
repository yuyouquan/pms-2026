'use client'

import type { ReactNode } from 'react'
import { Card, Col, Divider, Row, Space } from 'antd'
import type { PlanWorkspaceViewMode } from '@/lib/planWorkspace'
import { PlanViewModeSwitcher } from '@/components/plans/PlanViewModeSwitcher'

export interface PlanWorkspaceShellProps {
  scopeTabs?: ReactNode
  notices?: ReactNode
  versionControls?: ReactNode
  primaryActions?: ReactNode
  utilityActions?: ReactNode
  viewMode: PlanWorkspaceViewMode
  onViewModeChange: (viewMode: PlanWorkspaceViewMode) => void
  horizontalDisabled?: boolean
  children: ReactNode
}

export function PlanWorkspaceShell({
  scopeTabs,
  notices,
  versionControls,
  primaryActions,
  utilityActions,
  viewMode,
  onViewModeChange,
  horizontalDisabled = false,
  children,
}: PlanWorkspaceShellProps) {
  return (
    <div className="pms-plan-workspace">
      {scopeTabs && <div aria-label="计划作用域">{scopeTabs}</div>}
      {notices && <div aria-label="计划通知">{notices}</div>}
      <Card
        className="pms-plan-toolbar pms-toolbar"
        size="small"
        style={{ marginBottom: 16, borderRadius: 8 }}
        styles={{ body: { padding: '12px 16px' } }}
      >
        <Row justify="space-between" align="middle" gutter={[12, 8]}>
          <Col>
            <Space size={8} separator={<Divider orientation="vertical" style={{ margin: 0 }} />}>
              <div aria-label="计划版本操作">{versionControls}</div>
              {primaryActions}
            </Space>
          </Col>
          <Col>
            <Space size={6}>
              <div aria-label="计划工具">{utilityActions}</div>
              <Divider orientation="vertical" style={{ margin: '0 2px' }} />
              <PlanViewModeSwitcher
                viewMode={viewMode}
                onViewModeChange={onViewModeChange}
                horizontalDisabled={horizontalDisabled}
              />
            </Space>
          </Col>
        </Row>
      </Card>
      <Card className="pms-plan-content pms-solid-surface" style={{ borderRadius: 8 }} styles={{ body: { padding: 0 } }}>
        <div aria-label="计划内容">{children}</div>
      </Card>
    </div>
  )
}
