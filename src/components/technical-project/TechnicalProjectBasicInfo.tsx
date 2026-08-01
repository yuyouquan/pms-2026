'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Descriptions, Empty, Space, Switch, Tabs, Tag, Tooltip, Typography } from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import SubprojectConfigModal from '@/components/technical-project/SubprojectConfigModal'
import { isTechnicalSubprojectConfigured, resolveTechnicalChildSelection } from '@/lib/technicalProjectRules'
import { useProjectStore } from '@/stores/project'
import { useTechnicalProjectStore } from '@/stores/technicalProject'
import type { TechnicalSubproject } from '@/types/technicalProject'

const { Paragraph, Text } = Typography

export interface TechnicalProjectBasicInfoProps {
  projectId: string
  currentLoginUser?: string
}

export default function TechnicalProjectBasicInfo({ projectId, currentLoginUser }: TechnicalProjectBasicInfoProps) {
  const [showInactive, setShowInactive] = useState(false)
  const [activeChildId, setActiveChildId] = useState('')
  const [configuringChild, setConfiguringChild] = useState<TechnicalSubproject | null>(null)
  const [configTrigger, setConfigTrigger] = useState<HTMLElement | null>(null)
  const projects = useProjectStore(state => state.projects)
  const subprojects = useTechnicalProjectStore(state => state.subprojects)
  const children = useMemo(() => subprojects
    .filter(item => item.parentProjectId === projectId && (item.active || showInactive))
    .sort((left, right) => left.ipmOrder - right.ipmOrder || left.id.localeCompare(right.id)), [projectId, showInactive, subprojects])

  useEffect(() => {
    setConfiguringChild(null)
    setConfigTrigger(null)
    setActiveChildId('')
  }, [projectId])

  useEffect(() => {
    const targetChildId = window.sessionStorage.getItem('pms:technical-project-list-target-child') || ''
    const nextChildId = resolveTechnicalChildSelection(
      children.map(child => child.id),
      targetChildId || activeChildId,
      false,
    )
    if (targetChildId && nextChildId === targetChildId) {
      window.sessionStorage.removeItem('pms:technical-project-list-target-child')
    }
    if (nextChildId !== activeChildId) setActiveChildId(nextChildId)
  }, [activeChildId, children])

  const machineName = (id: string) => projects.find(project => project.id === id)?.name || id || '-'
  const activeChild = children.find(child => child.id === activeChildId) || children[0]

  const items = children.map(child => ({
    key: child.id,
    label: (
      <Space size={6} className="technical-child-tab-label">
        <span>{child.name}</span>
        {!child.active && <Tag color="default" style={{ margin: 0 }}>已停用</Tag>}
        {child.active && !isTechnicalSubprojectConfigured(child) && <Tag color="warning" style={{ margin: 0 }}>待配置</Tag>}
        {child.active && (
          <Tooltip title="配置子项目信息">
            <Button
              type="text"
              size="small"
              className="technical-child-config-button"
              aria-label={`配置子项目 ${child.name}`}
              icon={<SettingOutlined />}
              onClick={event => {
                event.preventDefault()
                event.stopPropagation()
                setConfigTrigger(event.currentTarget)
                setConfiguringChild(child)
              }}
            />
          </Tooltip>
        )}
      </Space>
    ),
  }))

  return (
    <div className="technical-project-space" aria-label="技术项目基础信息">
      <Card
        className="technical-space-card technical-child-card"
        title="子项目基础信息"
        extra={(
          <Space size={8}>
            <Text type="secondary">显示已停用</Text>
            <Switch aria-label="显示已停用子项目" checked={showInactive} onChange={setShowInactive} />
          </Space>
        )}
      >
        {children.length ? (
          <>
            <Tabs
              activeKey={activeChild?.id}
              onChange={setActiveChildId}
              items={items}
              className="technical-child-tabs"
            />
            {activeChild && (
              <div className={activeChild.active ? '' : 'technical-child-readonly'} aria-readonly={!activeChild.active}>
                {!activeChild.active && (
                  <div className="technical-inactive-banner">
                    <Tag color="default">已停用</Tag>
                    <Text type="secondary">该子项目已从 IPM 停用，仅可查看历史基础信息。</Text>
                  </div>
                )}
                <Descriptions bordered size="small" column={{ xs: 1, md: 2 }}>
                  <Descriptions.Item label="子项目名称">{activeChild.name}</Descriptions.Item>
                  <Descriptions.Item label="IPM子项目ID"><Text code>{activeChild.id}</Text></Descriptions.Item>
                  <Descriptions.Item label="核心价值">{activeChild.configuration.coreValue || <Text type="secondary">待配置</Text>}</Descriptions.Item>
                  <Descriptions.Item label="开发模式">{activeChild.configuration.developmentMode || <Text type="secondary">待配置</Text>}</Descriptions.Item>
                  <Descriptions.Item label="首导tOS">{activeChild.configuration.firstTosVersion || '-'}</Descriptions.Item>
                  <Descriptions.Item label="首导整机产品">{machineName(activeChild.configuration.firstMachineProjectId)}</Descriptions.Item>
                </Descriptions>
                {!activeChild.active && activeChild.planReferences && (
                  <Paragraph type="secondary" style={{ margin: '14px 0 0' }}>历史计划引用已保留。</Paragraph>
                )}
              </div>
            )}
          </>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={showInactive ? '暂无子项目' : '暂无活动子项目'} />
        )}
      </Card>
      <SubprojectConfigModal
        open={Boolean(configuringChild)}
        subproject={configuringChild}
        currentLoginUser={currentLoginUser}
        returnFocusTo={configTrigger}
        onCancel={() => setConfiguringChild(null)}
      />
    </div>
  )
}
